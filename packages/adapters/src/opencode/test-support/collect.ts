import { type AdapterEvent, AdapterEventSchema, type AdapterRunInput } from '@redhunter/shared';

export const RUN_INPUT: AdapterRunInput = {
  runId: 'run-1',
  agentId: 'programming',
  cwd: '/tmp',
  prompt: 'say hello',
};

// Drains a run, parsing every event through the shared schema. Bounded: a hang fails fast.
export async function collect(
  events: AsyncIterable<AdapterEvent>,
  onEvent: (event: AdapterEvent) => Promise<void> | void = () => {},
  timeoutMs = 3000,
): Promise<AdapterEvent[]> {
  const seen: AdapterEvent[] = [];
  const drain = async (): Promise<AdapterEvent[]> => {
    for await (const event of events) {
      seen.push(AdapterEventSchema.parse(event));
      await onEvent(event);
    }
    return seen;
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Run did not end, saw ${JSON.stringify(seen)}`)),
      timeoutMs,
    );
  });
  try {
    return await Promise.race([drain(), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export function types(events: readonly AdapterEvent[]): string[] {
  return events.map((event) => (event.type === 'tool' ? `tool:${event.status}` : event.type));
}
