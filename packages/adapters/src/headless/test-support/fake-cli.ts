import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createScratchDir,
  type ScratchDir,
  writeFakeBinary,
} from '../../opencode/test-support/fake-binary';

export interface FakeCli {
  readonly scratch: ScratchDir;
  // Sandbox cwd handed to the adapter (codex writes .codex/config.toml here).
  readonly cwd: string;
  readonly binary: string;
  // argv (one per line), env dump, stdin probe and pid written by the fake on each run.
  readonly argvFile: string;
  readonly envFile: string;
  readonly stdinFile: string;
  readonly pidFile: string;
  argv(): string[];
  env(): string;
}

// `body` runs after the probes; `$FIXTURE` cats a JSONL file. `--version` prints `version`.
export function createFakeCli(name: string, body: string, version = `${name} 9.9.9`): FakeCli {
  const scratch = createScratchDir();
  const cwd = join(scratch.path, 'work');
  const argvFile = join(scratch.path, 'argv.txt');
  const envFile = join(scratch.path, 'env.txt');
  const stdinFile = join(scratch.path, 'stdin.txt');
  const pidFile = join(scratch.path, 'pid.txt');
  const binary = writeFakeBinary(
    scratch.path,
    name,
    [
      `if [ "$1" = "--version" ]; then echo '${version}'; exit 0; fi`,
      `mkdir -p '${cwd}'`,
      `echo $$ > '${pidFile}'`,
      `for arg in "$@"; do printf '%s\\n' "$arg"; done > '${argvFile}'`,
      `env > '${envFile}'`,
      `if read -r line; then echo open > '${stdinFile}'; else echo closed > '${stdinFile}'; fi`,
      body,
    ].join('\n'),
  );
  Bun.spawnSync(['mkdir', '-p', cwd]);
  return {
    scratch,
    cwd,
    binary,
    argvFile,
    envFile,
    stdinFile,
    pidFile,
    argv: () => readFileSync(argvFile, 'utf8').split('\n').slice(0, -1),
    env: () => readFileSync(envFile, 'utf8'),
  };
}

export function readPid(cli: FakeCli): number {
  return Number(readFileSync(cli.pidFile, 'utf8').trim());
}
