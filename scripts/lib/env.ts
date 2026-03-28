export interface Env {
  readonly githubRepository: string;
  readonly githubToken: string;
  readonly copilotToken?: string;
  readonly githubOutput?: string;
}

function requireEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} env var is required`);
  }
  return value;
}

export function parseEnv(): Env {
  return {
    githubRepository: requireEnvVar('GITHUB_REPOSITORY'),
    githubToken: requireEnvVar('GITHUB_TOKEN'),
    copilotToken: process.env.COPILOT_GITHUB_TOKEN,
    githubOutput: process.env.GITHUB_OUTPUT,
  };
}

export function parseRepository(repository: string): { owner: string; repo: string } {
  const [owner, repo] = repository.split('/');
  if (!owner || !repo) {
    throw new Error(`Invalid GITHUB_REPOSITORY value: ${repository}`);
  }
  return { owner, repo };
}
