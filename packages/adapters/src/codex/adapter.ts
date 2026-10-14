import { HeadlessAdapter } from '../headless/adapter';
import type { HeadlessAdapterOptions, HeadlessVendor } from '../headless/types';
import { prepareCodexRun } from './config';

export const CODEX_VENDOR: HeadlessVendor = {
  id: 'codex',
  defaultBinary: 'codex',
  prepare: prepareCodexRun,
};

// `codex exec --json` per run (plan section 8). Vendor key (OPENAI_API_KEY) only via options.env.
export class CodexAdapter extends HeadlessAdapter {
  constructor(options: HeadlessAdapterOptions = {}) {
    super(CODEX_VENDOR, options);
  }
}
