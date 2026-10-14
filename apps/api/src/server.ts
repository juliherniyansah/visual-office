import { createServer, type Server } from 'node:http';
import type { Express } from 'express';

export interface ListenOptions {
  readonly port: number;
  readonly host: string;
}

// Separate from listen so Socket.IO (realtime/gateway.ts) attaches to the same http.Server first.
export function createHttpServer(app: Express): Server {
  return createServer(app);
}

export function listen(server: Server, options: ListenOptions): Promise<Server> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port, options.host, () => {
      server.off('error', reject);
      resolve(server);
    });
  });
}

export function startServer(app: Express, options: ListenOptions): Promise<Server> {
  return listen(createHttpServer(app), options);
}

const CLOSE_TIMEOUT_MS = 1_000;

// Stops accepting connections and drops idle keep-alive sockets. The wait is bounded because
// bun 1.3.14 never fires the close callback after a websocket upgrade (listener is closed anyway).
export function closeHttpServer(server: Server): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, CLOSE_TIMEOUT_MS);
    if (!server.listening) {
      clearTimeout(timer);
      resolve();
      return;
    }
    server.close(() => {
      clearTimeout(timer);
      resolve();
    });
    server.closeAllConnections();
  });
}
