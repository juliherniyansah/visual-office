import type { AdapterEvent } from '@redhunter/shared';
import type { StreamMapper } from '../headless/types';
import { asRecord, asString, type RawRecord, toCount } from '../opencode/raw';

const FALLBACK_ERROR = 'codex turn failed';
const COMMAND_TOOL = 'bash';
const WEB_SEARCH_TOOL = 'web_search';

export interface CodexMapperOptions {
  // `--output-schema` was passed: the final agent message is JSON for `completed.structured`.
  readonly isStructured?: boolean;
}

interface ToolCall {
  readonly name: string;
  readonly input: unknown;
}

// Maps `codex exec --json` JSONL (codex-rs/exec/src/exec_events.rs ThreadEvent) to AdapterEvent.
// Stateful per run. `error` lines are not terminal (codex emits them while reconnecting); the
// turn ends with `turn.completed` or `turn.failed`.
export class CodexEventMapper implements StreamMapper {
  readonly #isStructured: boolean;
  readonly #seen = new Set<string>();
  readonly #texts: string[] = [];
  #lastError: string | undefined;

  constructor(options: CodexMapperOptions = {}) {
    this.#isStructured = options.isStructured ?? false;
  }

  get lastError(): string | undefined {
    return this.#lastError;
  }

  map(raw: unknown): AdapterEvent[] {
    const event = asRecord(raw);
    switch (asString(event?.type)) {
      case 'thread.started':
        return this.#onThread(asString(event?.thread_id));
      case 'item.started':
        return this.#onItem(asRecord(event?.item), false);
      case 'item.completed':
        return this.#onItem(asRecord(event?.item), true);
      case 'turn.completed':
        return [usage(asRecord(event?.usage)), this.#completed()];
      case 'turn.failed': {
        const error = asString(asRecord(event?.error)?.message) || FALLBACK_ERROR;
        return [{ type: 'failed', error }];
      }
      case 'error':
        this.#lastError = asString(event?.message) || this.#lastError;
        return [];
      default:
        return [];
    }
  }

  #onThread(threadId: string | undefined): AdapterEvent[] {
    if (!threadId || !this.#first('thread')) return [];
    return [{ type: 'started', vendorSessionId: threadId }];
  }

  #onItem(item: RawRecord | undefined, isCompleted: boolean): AdapterEvent[] {
    const id = asString(item?.id);
    if (item === undefined || !id) return [];
    if (item.type === 'agent_message') return isCompleted ? this.#onText(id, item) : [];
    if (item.type === 'file_change') return isCompleted ? this.#onFileChange(id, item) : [];
    const call = toolCall(item);
    if (call === undefined) return [];
    const events: AdapterEvent[] = [];
    if (this.#first(`tool:${id}:started`))
      events.push({ type: 'tool', ...call, status: 'started' });
    if (!isCompleted || !this.#first(`tool:${id}:completed`)) return events;
    const exit = item.exit_code;
    const exitCode = typeof exit === 'number' && Number.isInteger(exit) ? { exitCode: exit } : {};
    events.push({ type: 'tool', ...call, status: 'completed', ...exitCode });
    // ponytail: exec mode rejects approval requests itself (no reply channel), so a declined
    // command is surfaced after the fact; the adapter only records the human answer.
    if (item.status === 'declined') {
      const detail = asString(item.command) ?? '';
      events.push({ type: 'permission_request', permissionId: id, tool: call.name, detail });
    }
    return events;
  }

  #onText(id: string, item: RawRecord): AdapterEvent[] {
    const text = asString(item.text);
    if (!text || !this.#first(`text:${id}`)) return [];
    this.#texts.push(text);
    return [{ type: 'text', text }];
  }

  #onFileChange(id: string, item: RawRecord): AdapterEvent[] {
    if (item.status !== 'completed' || !this.#first(`patch:${id}`)) return [];
    const changes = Array.isArray(item.changes) ? item.changes : [];
    return changes.flatMap((change): AdapterEvent[] => {
      const record = asRecord(change);
      const path = asString(record?.path);
      if (!path) return [];
      return [{ type: 'file_change', path, kind: asString(record?.kind) || 'update' }];
    });
  }

  #completed(): AdapterEvent {
    const finalText = this.#texts.join('\n');
    const last = this.#texts.at(-1);
    if (!this.#isStructured || last === undefined) return { type: 'completed', finalText };
    try {
      return { type: 'completed', finalText, structured: JSON.parse(last) };
    } catch {
      // Not JSON despite --output-schema: keep the text, leave `structured` unset for verify().
      return { type: 'completed', finalText };
    }
  }

  #first(key: string): boolean {
    if (this.#seen.has(key)) return false;
    this.#seen.add(key);
    return true;
  }
}

function toolCall(item: RawRecord): ToolCall | undefined {
  switch (item.type) {
    case 'command_execution':
      return { name: COMMAND_TOOL, input: { command: asString(item.command) ?? '' } };
    case 'mcp_tool_call': {
      const name = [asString(item.server), asString(item.tool)].filter(Boolean).join('.');
      return { name: name || 'mcp', input: item.arguments ?? {} };
    }
    case 'web_search':
      return { name: WEB_SEARCH_TOOL, input: { query: asString(item.query) ?? '' } };
    default:
      return undefined;
  }
}

// OpenAI usage: cached_input_tokens is a subset of input_tokens, reasoning a subset of output.
function usage(raw: RawRecord | undefined): AdapterEvent {
  return {
    type: 'usage',
    inputTokens: toCount(raw?.input_tokens),
    outputTokens: toCount(raw?.output_tokens),
  };
}
