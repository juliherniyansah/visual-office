import type { AdapterRunInput } from '@redhunter/shared';
import { createRunDir, writePolicyFile, writeRunFile } from '../headless/files';
import type { CliLaunch } from '../headless/types';
import { CodexEventMapper } from './event-mapper';

export const CODEX_CONFIG_PATH = '.codex/config.toml';
const SANDBOX_MODE = 'workspace-write';
const APPROVAL_POLICY = 'on-request';

// Plan section 13. Top-level keys, not a [profiles] table: codex ignores `profile`/`profiles`
// in a project-local .codex/config.toml (developers.openai.com/codex/config-reference).
export function buildCodexConfig(): string {
  return `approval_policy = "${APPROVAL_POLICY}"\nsandbox_mode = "${SANDBOX_MODE}"\n`;
}

export function writeCodexConfig(cwd: string): string {
  return writePolicyFile('codex', cwd, CODEX_CONFIG_PATH, buildCodexConfig());
}

export interface CodexArgsOptions {
  readonly cwd: string;
  readonly outputFile: string;
  readonly prompt: string;
  readonly schemaFile?: string;
  // `codex exec resume <thread_id>` (plan section 8).
  readonly resumeId?: string;
}

// Plan section 8 flags only. Never --yolo / --dangerously-bypass-approvals-and-sandbox.
export function buildCodexArgs(options: CodexArgsOptions): string[] {
  const command = options.resumeId === undefined ? ['exec'] : ['exec', 'resume', options.resumeId];
  const schema = options.schemaFile === undefined ? [] : ['--output-schema', options.schemaFile];
  // `--` ends option parsing (clap), so a prompt like "--yolo" stays a prompt.
  const prompt = options.prompt.startsWith('-') ? ['--', options.prompt] : [options.prompt];
  return [
    ...command,
    '--json',
    '--ephemeral',
    '-C',
    options.cwd,
    '-s',
    SANDBOX_MODE,
    '--ignore-user-config',
    '-o',
    options.outputFile,
    ...schema,
    ...prompt,
  ];
}

export async function prepareCodexRun(input: AdapterRunInput): Promise<CliLaunch> {
  writeCodexConfig(input.cwd);
  const dir = createRunDir('codex');
  try {
    const schemaFile =
      input.outputSchema === undefined
        ? undefined
        : writeRunFile(dir, 'output-schema.json', JSON.stringify(input.outputSchema));
    const args = buildCodexArgs({
      cwd: input.cwd,
      outputFile: `${dir.path}/last-message.txt`,
      prompt: input.prompt,
      ...(schemaFile === undefined ? {} : { schemaFile }),
      ...(input.resumeVendorSessionId === undefined
        ? {}
        : { resumeId: input.resumeVendorSessionId }),
    });
    const mapper = new CodexEventMapper({ isStructured: schemaFile !== undefined });
    return { args, mapper, cleanup: dir.remove };
  } catch (error) {
    dir.remove();
    throw error;
  }
}
