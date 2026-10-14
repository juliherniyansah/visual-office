// Narrowing helpers for untrusted SSE JSON. The server (1.18.35) is newer than the SDK
// types (1.18.13), so payloads are parsed defensively instead of trusted as SDK `Event`.
export type RawRecord = Readonly<Record<string, unknown>>;

export function asRecord(value: unknown): RawRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as RawRecord)
    : undefined;
}

export function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function asStrings(value: unknown): string[] {
  if (typeof value === 'string') return value === '' ? [] : [value];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item !== '');
}

// Token counts must satisfy TokenCountSchema (non-negative int); anything else counts as 0.
export function toCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

// Session of an event: top-level (v2 + most v1), else nested part/info (v1 message events).
export function sessionOf(properties: RawRecord): string | undefined {
  return (
    asString(properties.sessionID) ??
    asString(asRecord(properties.part)?.sessionID) ??
    asString(asRecord(properties.info)?.sessionID)
  );
}
