import { afterAll, expect, test } from 'bun:test';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { type AdapterEvent, AdapterEventSchema } from '@redhunter/shared';
import { OpencodeAdapter } from './adapter';
import { createScratchDir } from './test-support/fake-binary';

const IS_LIVE = process.env.LIVE_OPENCODE === '1';
const BINARY = process.env.OPENCODE_BIN ?? '/home/programer/.bun/bin/opencode';
const LOG = join(import.meta.dir, '../../../../.omo/evidence/11/live-smoke.log');
const LIVE_TIMEOUT_MS = 180_000;
const PROMPT =
  'Run the shell command `echo hello` with the bash tool, then reply with its output only.';

const scratch = createScratchDir();
// No vendor keys passed: the real binary reads its own stored credentials under HOME.
const adapter = new OpencodeAdapter({
  binary: BINARY,
  serverCwd: scratch.path,
  serverTimeoutMs: 30_000,
});
afterAll(async () => {
  await adapter.dispose();
  scratch.remove();
});

function log(line: string): void {
  appendFileSync(LOG, `${new Date().toISOString()} ${line}\n`);
}

test.skipIf(!IS_LIVE)(
  'live opencode runs an echo hello task through a bash permission',
  async () => {
    mkdirSync(dirname(LOG), { recursive: true });
    writeFileSync(LOG, `# T11 live smoke, binary ${BINARY}\n`);
    const version = await adapter.healthcheck();
    log(`healthcheck version=${version}`);
    const events: AdapterEvent[] = [];
    for await (const event of adapter.start({
      runId: 'live-smoke',
      agentId: 'programming',
      cwd: scratch.path,
      prompt: PROMPT,
    })) {
      events.push(AdapterEventSchema.parse(event));
      log(`event ${JSON.stringify(event)}`);
      if (event.type === 'permission_request') {
        await adapter.answerPermission('live-smoke', event.permissionId, 'allow');
        log(`answered ${event.permissionId} allow`);
      }
    }
    const last = events.at(-1);
    log(`result ${last?.type ?? 'none'}`);
    expect(version).not.toBe('');
    expect(events[0]?.type).toBe('started');
    expect(
      events.some((e) => e.type === 'tool' && e.name === 'bash' && e.status === 'completed'),
    ).toBe(true);
    expect(last?.type).toBe('completed');
    expect(last?.type === 'completed' ? last.finalText : '').toContain('hello');
  },
  LIVE_TIMEOUT_MS,
);
