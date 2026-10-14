import type { Server as HttpServer } from 'node:http';
import { AgentIdSchema, type DomainEvent } from '@redhunter/shared';
import { type Namespace, Server, type Socket } from 'socket.io';
import { z } from 'zod';
import { hasRole } from '../auth/middleware';
import { type AccessClaims, verifyAccessToken } from '../auth/token';
import type { Logger } from '../events/dispatcher';
import { agentRoom, isAgentRoom, OFFICE_ROOM, roomsForEvent, runRoom } from './rooms';

export const OFFICE_NAMESPACE = '/office';
export const UNAUTHORIZED_MESSAGE = 'unauthorized';
const RECOVERY_WINDOW_MS = 2 * 60 * 1000;
const CLOSE_TIMEOUT_MS = 1_000;
const MAX_RUN_ID_LENGTH = 128;

const RunIdSchema = z.string().min(1).max(MAX_RUN_ID_LENGTH);

export type SubscribeAck = { ok: true } | { ok: false; error: 'invalid payload' | 'forbidden' };
type AckFn = (response: SubscribeAck) => void;

interface ServerToClientEvents {
  event: (event: DomainEvent) => void;
  'agent:event': (event: DomainEvent) => void;
  'run:event': (event: DomainEvent) => void;
}

// Client payloads are untrusted: every handler receives raw args and validates them itself.
type ClientToServerEvents = Record<
  'subscribe:agent' | 'unsubscribe:agent' | 'subscribe:run' | 'unsubscribe:run',
  (...args: unknown[]) => void
> & {
  resync: (ack: (response: { ok: boolean; runs?: unknown[]; agents?: unknown[]; error?: string }) => void) => void;
};

interface SocketData {
  claims: AccessClaims;
}

type OfficeSocket = Socket<ClientToServerEvents, ServerToClientEvents, object, SocketData>;
type OfficeNamespace = Namespace<ClientToServerEvents, ServerToClientEvents, object, SocketData>;

export interface GatewayOptions {
  readonly jwtSecret: string;
  readonly corsOrigins: readonly string[];
  readonly logger?: Logger;
  // Hook for todo 15 (run must exist / RBAC). Default: any authenticated viewer+ may subscribe.
  readonly canSubscribeRun?: (runId: string, claims: AccessClaims) => boolean | Promise<boolean>;
}

export interface RealtimeGateway {
  readonly io: Server<ClientToServerEvents, ServerToClientEvents, object, SocketData>;
  // EventSink for the dispatcher.
  deliver(event: DomainEvent): void;
  close(): Promise<void>;
}

// Browsers always send Origin on websocket/XHR, so a foreign one is refused at the engine
// handshake. A missing Origin means a non-browser client; it still needs a valid JWT.
function createOriginCheck(allowed: readonly string[]) {
  const origins = new Set(allowed);
  return (
    req: { headers: { origin?: string | undefined } },
    callback: (err: string | null | undefined, success: boolean) => void,
  ): void => {
    const { origin } = req.headers;
    callback(null, origin === undefined || origins.has(origin));
  };
}

function splitArgs(args: unknown[]): { payload: unknown; ack: AckFn } {
  const last = args.at(-1);
  if (typeof last === 'function') {
    return { payload: args.length > 1 ? args[0] : undefined, ack: last as AckFn };
  }
  return { payload: args[0], ack: () => {} };
}

function registerSubscriptions(
  socket: OfficeSocket,
  options: GatewayOptions,
  logger: Logger,
): void {
  const canSubscribeRun = options.canSubscribeRun ?? (() => true);

  async function handle(
    args: unknown[],
    toRoom: (payload: unknown) => string | undefined,
    authorize: (room: string) => boolean | Promise<boolean>,
    join: boolean,
  ): Promise<void> {
    const { payload, ack } = splitArgs(args);
    const room = toRoom(payload);
    if (room === undefined) {
      ack({ ok: false, error: 'invalid payload' });
      return;
    }
    if (join && !(await authorize(room))) {
      ack({ ok: false, error: 'forbidden' });
      return;
    }
    await (join ? socket.join(room) : socket.leave(room));
    ack({ ok: true });
  }

  const toAgentRoom = (payload: unknown): string | undefined => {
    const parsed = AgentIdSchema.safeParse(payload);
    return parsed.success ? agentRoom(parsed.data) : undefined;
  };
  const toRunRoom = (payload: unknown): string | undefined => {
    const parsed = RunIdSchema.safeParse(payload);
    return parsed.success ? runRoom(parsed.data) : undefined;
  };
  const isViewer = (): boolean => hasRole(socket.data.claims.role, 'viewer');
  const mayReadRun = async (room: string): Promise<boolean> =>
    isViewer() && (await canSubscribeRun(room.slice(runRoom('').length), socket.data.claims));

  const bind = (
    name: keyof ClientToServerEvents,
    toRoom: (payload: unknown) => string | undefined,
    authorize: (room: string) => boolean | Promise<boolean>,
    join: boolean,
  ): void => {
    socket.on(name, (...args: unknown[]) => {
      handle(args, toRoom, authorize, join).catch((err: unknown) => {
        logger.error(`realtime: ${name} failed`, err instanceof Error ? err.message : err);
      });
    });
  };
  bind('subscribe:agent', toAgentRoom, isViewer, true);
  bind('unsubscribe:agent', toAgentRoom, isViewer, false);
  bind('subscribe:run', toRunRoom, mayReadRun, true);
  bind('unsubscribe:run', toRunRoom, mayReadRun, false);

  socket.on('resync', async (ack) => {
    try {
      ack({ ok: true, runs: [], agents: [] });
    } catch (err) {
      logger.error('realtime: resync failed', String(err));
      ack({ ok: false, error: 'resync_failed' });
    }
  });
}

function useJwtAuth(nsp: OfficeNamespace, jwtSecret: string): void {
  nsp.use((socket, next) => {
    const token: unknown = socket.handshake.auth.token;
    if (typeof token !== 'string' || token === '') {
      next(new Error(UNAUTHORIZED_MESSAGE));
      return;
    }
    verifyAccessToken(token, jwtSecret).then(
      (claims) => {
        if (claims === null) {
          next(new Error(UNAUTHORIZED_MESSAGE));
          return;
        }
        socket.data.claims = claims;
        next();
      },
      (err: unknown) => next(new Error(UNAUTHORIZED_MESSAGE, { cause: err })),
    );
  });
}

async function settleWithin(promise: Promise<unknown>, timeoutMs: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });
  const settled = await Promise.race([promise.then(() => true), timeout]);
  clearTimeout(timer);
  return settled;
}

// Attach before listen(): Socket.IO shares the Express http.Server (path /socket.io).
export function createRealtimeGateway(http: HttpServer, options: GatewayOptions): RealtimeGateway {
  const logger = options.logger ?? console;
  const io = new Server<ClientToServerEvents, ServerToClientEvents, object, SocketData>(http, {
    cors: { origin: [...options.corsOrigins], credentials: false },
    allowRequest: createOriginCheck(options.corsOrigins),
    // skipMiddlewares false: a recovered session still re-verifies its JWT.
    connectionStateRecovery: {
      maxDisconnectionDuration: RECOVERY_WINDOW_MS,
      skipMiddlewares: false,
    },
  });
  // Only /office is served; the default namespace refuses everyone.
  io.use((_socket, next) => next(new Error(UNAUTHORIZED_MESSAGE)));

  const office: OfficeNamespace = io.of(OFFICE_NAMESPACE);
  useJwtAuth(office, options.jwtSecret);
  office.on('connection', (socket) => {
    void socket.join(OFFICE_ROOM);
    registerSubscriptions(socket, options, logger);
  });

  return {
    io,
    deliver(event) {
      const [, ...scoped] = roomsForEvent(event);
      office.to(OFFICE_ROOM).emit('event', event);
      for (const room of scoped) {
        office.to(room).emit(isAgentRoom(room) ? 'agent:event' : 'run:event', event);
      }
    },
    async close() {
      // bun 1.3.14: http.Server#close never calls back once a websocket was upgraded, so
      // io.close() can hang although the listener is already closed. Bound the wait.
      if (!(await settleWithin(io.close(), CLOSE_TIMEOUT_MS))) {
        logger.error('realtime: io.close() did not settle; listener closed, continuing shutdown');
      }
    },
  };
}
