import type { AdapterEvent } from '@redhunter/shared';
import type { StreamMapper } from '../headless/types';
import { asRecord, asString, type RawRecord, toCount } from '../opencode/raw';

const FALLBACK_ERROR = 'claude run failed';
// Built-in tools that write files, mapped to the input key holding the path and the change kind.
const WRITE_TOOLS: Readonly<Record<string, { readonly key: string; readonly kind: string }>> = {
  Edit: { key: 'file_path', kind: 'update' },
  MultiEdit: { key: 'file_path', kind: 'update' },
  Write: { key: 'file_path', kind: 'write' },
  NotebookEdit: { key: 'notebook_path', kind: 'update' },
};

interface ToolUse {
  readonly name: string;
  readonly input: unknown;
}

// Maps `claude -p --output-format stream-json` lines (Agent SDK SDKMessage) to AdapterEvent.
// Headless runs have no permission host, so an `ask` rule is denied by claude itself; denials
// surface as `permission_request` (from system/permission_denied or result.permission_denials).
export class ClaudeEventMapper implements StreamMapper {
  readonly #tools = new Map<string, ToolUse>();
  readonly #seen = new Set<string>();
  readonly #texts: string[] = [];
  #lastError: string | undefined;

  get lastError(): string | undefined {
    return this.#lastError;
  }

  map(raw: unknown): AdapterEvent[] {
    const line = asRecord(raw);
    switch (line?.type) {
      case 'system':
        return this.#onSystem(line);
      case 'assistant':
        return this.#onAssistant(line);
      case 'user':
        return this.#onUser(line);
      case 'result':
        return this.#onResult(line);
      default:
        return [];
    }
  }

  #onSystem(line: RawRecord): AdapterEvent[] {
    if (line.subtype === 'init') {
      const sessionId = asString(line.session_id);
      if (!sessionId || !this.#first('init')) return [];
      return [{ type: 'started', vendorSessionId: sessionId }];
    }
    if (line.subtype === 'permission_denied') {
      return this.#denied(line.tool_use_id, line.tool_name, undefined, asString(line.message));
    }
    if (line.subtype === 'api_retry') this.#lastError = asString(line.error) || this.#lastError;
    return [];
  }

  #onAssistant(line: RawRecord): AdapterEvent[] {
    // Subagent messages carry parent_tool_use_id: their tools count, their prose does not.
    const isMain = line.parent_tool_use_id === null || line.parent_tool_use_id === undefined;
    const error = asString(line.error);
    if (error) this.#lastError = error;
    return blocksOf(line).flatMap((block): AdapterEvent[] => {
      if (block.type === 'text') {
        const text = asString(block.text);
        if (!isMain || !text) return [];
        this.#texts.push(text);
        return [{ type: 'text', text }];
      }
      const id = asString(block.id);
      const name = asString(block.name);
      if (block.type !== 'tool_use' || !id || !name || this.#tools.has(id)) return [];
      const tool = { name, input: block.input ?? {} };
      this.#tools.set(id, tool);
      return [{ type: 'tool', ...tool, status: 'started' }];
    });
  }

  #onUser(line: RawRecord): AdapterEvent[] {
    return blocksOf(line).flatMap((block): AdapterEvent[] => {
      const id = asString(block.tool_use_id);
      const tool = id === undefined ? undefined : this.#tools.get(id);
      if (block.type !== 'tool_result' || tool === undefined || !this.#first(`done:${id}`)) {
        return [];
      }
      const events: AdapterEvent[] = [{ type: 'tool', ...tool, status: 'completed' }];
      const write = WRITE_TOOLS[tool.name];
      const path = write === undefined ? undefined : asString(asRecord(tool.input)?.[write.key]);
      if (write !== undefined && path && block.is_error !== true) {
        events.push({ type: 'file_change', path, kind: write.kind });
      }
      return events;
    });
  }

  #onResult(line: RawRecord): AdapterEvent[] {
    const denials = Array.isArray(line.permission_denials) ? line.permission_denials : [];
    const events = denials.flatMap((item): AdapterEvent[] => {
      const denial = asRecord(item);
      return this.#denied(denial?.tool_use_id, denial?.tool_name, denial?.tool_input, undefined);
    });
    events.push(usage(line));
    const result = asString(line.result);
    if (line.subtype !== 'success') {
      const errors = Array.isArray(line.errors)
        ? line.errors.filter((e) => typeof e === 'string')
        : [];
      events.push({
        type: 'failed',
        error: errors.join('; ') || asString(line.subtype) || FALLBACK_ERROR,
      });
    } else if (line.is_error === true) {
      events.push({ type: 'failed', error: result || FALLBACK_ERROR });
    } else {
      const finalText = result ?? this.#texts.join('\n');
      const structured =
        line.structured_output === undefined ? {} : { structured: line.structured_output };
      events.push({ type: 'completed', finalText, ...structured });
    }
    return events;
  }

  // Detail prefers what the call wanted to do (command/path); the vendor message is a fallback.
  #denied(
    rawId: unknown,
    rawTool: unknown,
    rawInput: unknown,
    message: string | undefined,
  ): AdapterEvent[] {
    const id = asString(rawId);
    if (!id || !this.#first(`denied:${id}`)) return [];
    const known = this.#tools.get(id);
    const tool = asString(rawTool) || known?.name || 'unknown';
    const detail = describe(known?.input ?? rawInput) ?? message ?? '';
    return [{ type: 'permission_request', permissionId: id, tool, detail }];
  }

  #first(key: string): boolean {
    if (this.#seen.has(key)) return false;
    this.#seen.add(key);
    return true;
  }
}

function blocksOf(line: RawRecord): RawRecord[] {
  const content = asRecord(line.message)?.content;
  if (!Array.isArray(content)) return [];
  return content.flatMap((block): RawRecord[] => {
    const record = asRecord(block);
    return record === undefined ? [] : [record];
  });
}

function describe(input: unknown): string | undefined {
  const record = asRecord(input);
  return (
    asString(record?.command) ||
    asString(record?.file_path) ||
    asString(record?.notebook_path) ||
    asString(record?.url) ||
    undefined
  );
}

// Cache reads/writes are billed input (same rule as the opencode adapter).
function usage(line: RawRecord): AdapterEvent {
  const raw = asRecord(line.usage);
  const cost = line.total_cost_usd;
  const isValidCost = typeof cost === 'number' && Number.isFinite(cost) && cost >= 0;
  return {
    type: 'usage',
    inputTokens:
      toCount(raw?.input_tokens) +
      toCount(raw?.cache_creation_input_tokens) +
      toCount(raw?.cache_read_input_tokens),
    outputTokens: toCount(raw?.output_tokens),
    ...(isValidCost ? { costUsd: cost } : {}),
  };
}
