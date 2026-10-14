import type { AdapterEvent, AdapterId, AdapterRunInput } from '@redhunter/shared';

// Maps one parsed stdout JSON line (any value, untrusted) to normalized events. Stateful per run.
export interface StreamMapper {
  map(raw: unknown): AdapterEvent[];
  // Last vendor error seen in the stream; names the cause when the CLI exits without a result.
  readonly lastError: string | undefined;
}

// Everything one CLI run needs. `cleanup` removes temp files and must never throw.
export interface CliLaunch {
  readonly args: readonly string[];
  readonly mapper: StreamMapper;
  cleanup(): void;
}

export interface HeadlessVendor {
  readonly id: AdapterId;
  // Resolved through the allow-listed child PATH unless the adapter gets an absolute binary.
  readonly defaultBinary: string;
  // Writes config/temp files and builds argv. A throw becomes one `failed` event.
  prepare(input: AdapterRunInput): Promise<CliLaunch>;
}

export interface HeadlessAdapterOptions {
  readonly binary?: string;
  // Vendor keys etc.; merged over the spawn allow-list, forbidden names stripped (spawnChild).
  readonly env?: Readonly<Record<string, string>>;
  readonly healthTimeoutMs?: number;
}
