import type { AdapterEvent } from '@redhunter/shared';
import { asRecord, asString, asStrings, type RawRecord, sessionOf, toCount } from './raw';

const FALLBACK_TOOL = 'unknown';
const FALLBACK_ERROR = 'opencode session error';

// Stateful per run: one mapper per opencode session. Accepts both SDK v1 event shapes and
// the v2 names the 1.18.35 server emits (`permission.asked`, `message.part.delta`).
// Terminal events (completed/failed) are returned but not latched; the adapter stops reading.
export class OpencodeEventMapper {
  readonly #sessionId: string;
  readonly #assistantMessages = new Set<string>();
  // partId -> text so far; Map keeps first-seen order for finalText.
  readonly #texts = new Map<string, string>();
  readonly #seen = new Set<string>();

  constructor(sessionId: string) {
    this.#sessionId = sessionId;
  }

  map(raw: unknown): AdapterEvent[] {
    const event = asRecord(raw);
    const type = asString(event?.type);
    const properties = asRecord(event?.properties);
    if (type === undefined || properties === undefined) return [];
    const session = sessionOf(properties);
    // A session-less error fails every run on the shared server (fail closed).
    if (type === 'session.error' && session === undefined) return [failed(properties)];
    if (session !== this.#sessionId) return [];
    switch (type) {
      case 'message.updated':
        return this.#onMessage(properties);
      case 'message.part.updated':
        return this.#onPart(properties);
      case 'message.part.delta':
        return this.#onDelta(properties);
      case 'permission.asked':
      case 'permission.updated':
        return this.#onPermission(type, properties);
      case 'session.idle':
        return [{ type: 'completed', finalText: this.#finalText() }];
      case 'session.error':
        return [failed(properties)];
      default:
        return [];
    }
  }

  #onMessage(properties: RawRecord): AdapterEvent[] {
    const info = asRecord(properties.info);
    const id = asString(info?.id);
    if (id !== undefined && info?.role === 'assistant') this.#assistantMessages.add(id);
    return [];
  }

  #onPart(properties: RawRecord): AdapterEvent[] {
    const part = asRecord(properties.part);
    switch (part?.type) {
      case 'text':
        return this.#onTextPart(part, asString(properties.delta));
      case 'tool':
        return this.#onToolPart(part);
      case 'step-finish':
        return this.#once(part, () => [usage(part)]);
      case 'patch':
        return this.#once(part, () =>
          asStrings(part.files).map((path) => ({ type: 'file_change', path, kind: 'modified' })),
        );
      default:
        return [];
    }
  }

  // Only assistant output is user-facing: the prompt is echoed back as a user text part.
  #onTextPart(part: RawRecord, delta: string | undefined): AdapterEvent[] {
    const id = asString(part.id);
    const text = asString(part.text);
    const messageId = asString(part.messageID);
    if (id === undefined || text === undefined || messageId === undefined) return [];
    if (
      !this.#assistantMessages.has(messageId) ||
      part.ignored === true ||
      part.synthetic === true
    ) {
      return [];
    }
    const previous = this.#texts.get(id) ?? '';
    this.#texts.set(id, text);
    // ponytail: a snapshot that rewrites (not extends) earlier text only updates finalText.
    const added = delta ?? (text.startsWith(previous) ? text.slice(previous.length) : '');
    return added === '' ? [] : [{ type: 'text', text: added }];
  }

  #onDelta(properties: RawRecord): AdapterEvent[] {
    const id = asString(properties.partID);
    const delta = asString(properties.delta);
    if (properties.field !== 'text' || id === undefined || !delta) return [];
    // Unknown part = not an accepted assistant text part (user echo, ignored, reasoning).
    const previous = this.#texts.get(id);
    if (previous === undefined) return [];
    this.#texts.set(id, previous + delta);
    return [{ type: 'text', text: delta }];
  }

  // One `started` and one `completed` per callID, whatever the number of state updates.
  #onToolPart(part: RawRecord): AdapterEvent[] {
    const callId = asString(part.callID);
    const state = asRecord(part.state);
    const status = state?.status;
    if (callId === undefined || state === undefined || status === 'pending') return [];
    const name = asString(part.tool) || FALLBACK_TOOL;
    const input = asRecord(state.input) ?? {};
    const events: AdapterEvent[] = [];
    if (status !== 'running' && status !== 'completed' && status !== 'error') return events;
    if (this.#first(`tool:${callId}:started`)) {
      events.push({ type: 'tool', name, input, status: 'started' });
    }
    if (status !== 'running' && this.#first(`tool:${callId}:completed`)) {
      const exit = status === 'completed' ? asRecord(state.metadata)?.exit : undefined;
      const exitCode = typeof exit === 'number' && Number.isInteger(exit) ? { exitCode: exit } : {};
      events.push({ type: 'tool', name, input, status: 'completed', ...exitCode });
    }
    return events;
  }

  #onPermission(type: string, properties: RawRecord): AdapterEvent[] {
    const permissionId = asString(properties.id);
    if (!permissionId || !this.#first(`permission:${permissionId}`)) return [];
    if (type === 'permission.asked') {
      const tool = asString(properties.permission) || FALLBACK_TOOL;
      return [
        { type: 'permission_request', permissionId, tool, detail: patternsOf(properties.patterns) },
      ];
    }
    const patterns = patternsOf(properties.pattern);
    const title = asString(properties.title) ?? '';
    const detail = patterns === '' ? title : `${title} (${patterns})`;
    return [
      {
        type: 'permission_request',
        permissionId,
        tool: asString(properties.type) || FALLBACK_TOOL,
        detail,
      },
    ];
  }

  #once(part: RawRecord, build: () => AdapterEvent[]): AdapterEvent[] {
    const id = asString(part.id);
    return id !== undefined && this.#first(`part:${id}`) ? build() : [];
  }

  #first(key: string): boolean {
    if (this.#seen.has(key)) return false;
    this.#seen.add(key);
    return true;
  }

  #finalText(): string {
    return [...this.#texts.values()].filter((text) => text !== '').join('\n');
  }
}

function patternsOf(value: unknown): string {
  return asStrings(value).join(', ');
}

// Cache reads/writes are billed input; reasoning is billed output.
function usage(part: RawRecord): AdapterEvent {
  const tokens = asRecord(part.tokens);
  const cache = asRecord(tokens?.cache);
  const cost = part.cost;
  const isValidCost = typeof cost === 'number' && Number.isFinite(cost) && cost >= 0;
  return {
    type: 'usage',
    inputTokens: toCount(tokens?.input) + toCount(cache?.read) + toCount(cache?.write),
    outputTokens: toCount(tokens?.output) + toCount(tokens?.reasoning),
    ...(isValidCost ? { costUsd: cost } : {}),
  };
}

function failed(properties: RawRecord): AdapterEvent {
  const error = asRecord(properties.error);
  const name = asString(error?.name);
  const message = asString(asRecord(error?.data)?.message);
  if (name !== undefined && message) return { type: 'failed', error: `${name}: ${message}` };
  return { type: 'failed', error: name || message || FALLBACK_ERROR };
}
