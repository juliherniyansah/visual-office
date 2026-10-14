import { HeadlessAdapter } from '../headless/adapter';
import type { HeadlessAdapterOptions, HeadlessVendor } from '../headless/types';
import { prepareClaudeRun } from './settings';

export const CLAUDE_VENDOR: HeadlessVendor = {
  id: 'claude',
  defaultBinary: 'claude',
  prepare: prepareClaudeRun,
};

// `claude -p --output-format stream-json` per run (plan section 8); stdin is closed by
// spawnChild. ANTHROPIC_AUTH_TOKEN / WEBSOCKET_AUTH_FILE_DESCRIPTOR are always stripped.
export class ClaudeAdapter extends HeadlessAdapter {
  constructor(options: HeadlessAdapterOptions = {}) {
    super(CLAUDE_VENDOR, options);
  }
}
