import { randomUUID } from 'node:crypto';
import type { AdapterRunInput } from '@redhunter/shared';
import { createRunDir, writeRunFile } from '../headless/files';
import type { CliLaunch } from '../headless/types';
import { ClaudeEventMapper } from './event-mapper';

export const DEFAULT_MAX_TURNS = 30;
// Section 13 baseline, passed as --disallowedTools AND in settings deny (defense in depth).
export const RM_RF_RULE = 'Bash(rm -rf*)';
// The composed prompt goes in --append-system-prompt-file; argv only carries this fixed query,
// so prompt text can never be read as a flag and never shows up in `ps`.
export const CLAUDE_TASK_QUERY = 'Carry out the task described in your system prompt.';

export interface ClaudeSettings {
  readonly permissions: {
    readonly allow: string[];
    readonly ask: string[];
    readonly deny: string[];
    readonly defaultMode: 'default';
  };
}

// Mirrors the opencode sandbox (section 13): edits and shell ask, `bun test`/`git status`
// allowed, web fetch denied. Fresh object per call so callers cannot mutate a shared policy.
export function buildClaudeSettings(): ClaudeSettings {
  return {
    permissions: {
      allow: ['Bash(bun test*)', 'Bash(git status*)'],
      ask: ['Bash', 'Edit', 'MultiEdit', 'Write', 'NotebookEdit'],
      deny: [RM_RF_RULE, 'WebFetch'],
      defaultMode: 'default',
    },
  };
}

export interface ClaudeArgsOptions {
  readonly maxTurns: number;
  readonly sessionId: string;
  readonly settingsFile: string;
  readonly systemPromptFile: string;
}

// Plan section 8 flags + section 13 --disallowedTools only. Never --dangerously-skip-permissions.
export function buildClaudeArgs(options: ClaudeArgsOptions): string[] {
  return [
    '-p',
    '--output-format',
    'stream-json',
    '--permission-mode',
    'default',
    '--permission-prompts',
    'all',
    '--max-turns',
    String(options.maxTurns),
    '--session-id',
    options.sessionId,
    '--settings',
    options.settingsFile,
    '--append-system-prompt-file',
    options.systemPromptFile,
    '--disallowedTools',
    RM_RF_RULE,
    CLAUDE_TASK_QUERY,
  ];
}

// ponytail: resumeVendorSessionId is ignored (plan s8 lists no claude resume flag); add
// `--resume <id>` once the owner confirms the flag set for the installed version.
export async function prepareClaudeRun(input: AdapterRunInput): Promise<CliLaunch> {
  const dir = createRunDir('claude');
  try {
    const args = buildClaudeArgs({
      maxTurns: input.policy?.maxTurns ?? DEFAULT_MAX_TURNS,
      sessionId: randomUUID(),
      settingsFile: writeRunFile(dir, 'settings.json', JSON.stringify(buildClaudeSettings())),
      systemPromptFile: writeRunFile(dir, 'system-prompt.md', input.prompt),
    });
    return { args, mapper: new ClaudeEventMapper(), cleanup: dir.remove };
  } catch (error) {
    dir.remove();
    throw error;
  }
}
