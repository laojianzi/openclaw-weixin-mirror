import { execSync } from 'node:child_process';

export interface CommandOptions {
  readonly cwd?: string;
}

function formatExecError(command: string, err: unknown): Error {
  if (typeof err === 'object' && err !== null) {
    const stderrValue = Reflect.get(err, 'stderr');
    const stderr =
      typeof stderrValue === 'string'
        ? stderrValue
        : stderrValue !== undefined && stderrValue !== null
          ? String(stderrValue)
          : '';
    const messageValue = Reflect.get(err, 'message');
    const message = typeof messageValue === 'string' ? messageValue : String(err);
    return new Error(`Command failed: ${command}\n${stderr || message}`);
  }

  return new Error(`Command failed: ${command}\n${String(err)}`);
}

export function run(command: string, options: CommandOptions = {}): void {
  console.log(`> ${command}`);
  try {
    const output = execSync(command, {
      cwd: options.cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (output) {
      process.stdout.write(output);
    }
  } catch (err: unknown) {
    throw formatExecError(command, err);
  }
}

export function runOutput(command: string, options: CommandOptions = {}): string {
  try {
    return execSync(command, {
      cwd: options.cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (err: unknown) {
    throw formatExecError(command, err);
  }
}

export function tryRunOutput(command: string, options: CommandOptions = {}): string {
  try {
    return runOutput(command, options);
  } catch {
    return '';
  }
}

export function gitBranchExists(branchName: string): boolean {
  try {
    runOutput(`git rev-parse --verify origin/${branchName}`);
    return true;
  } catch {
    try {
      runOutput(`git rev-parse --verify ${branchName}`);
      return true;
    } catch {
      return false;
    }
  }
}

export function gitTagExists(tagName: string): boolean {
  try {
    runOutput(`git rev-parse --verify refs/tags/${tagName}`);
    return true;
  } catch {
    return false;
  }
}
