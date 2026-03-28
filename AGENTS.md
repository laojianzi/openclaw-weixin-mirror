# AGENTS.md

## Purpose
- This repository mirrors `@tencent-weixin/openclaw-weixin` into an `orphan` branch and publishes GitHub Releases.
- The `main` branch contains only automation code and workflow definitions.
- Optimize for safe, repeatable automation; avoid behavior changes unless explicitly requested.

## Current Stack
- Runtime: Bun (native TypeScript execution).
- Language: TypeScript (ESM modules).
- Package manager: Bun.
- Core dependencies: `@octokit/rest`, `semver`.
- Type-checker: `typescript`.

## Repository Layout
- `scripts/index.ts`: orchestrator (`check -> sync -> release`).
- `scripts/check.ts`: reads npm versions and computes unsynced versions.
- `scripts/sync.ts`: checks out `orphan`, imports package tarballs, commits tags, pushes.
- `scripts/release.ts`: generates AI changelog text and creates GitHub Releases.
- `scripts/lib/env.ts`: environment parsing and validation.
- `scripts/lib/github.ts`: Octokit singleton and typed release wrappers.
- `scripts/lib/npm.ts`: npm registry fetch helper.
- `scripts/lib/git.ts`: typed git command wrappers.
- `scripts/lib/env.test.ts`: Bun test coverage for env parsing helpers.
- `.github/workflows/sync.yml`: scheduled/manual workflow entrypoint.

## Required Environment Variables
- `GITHUB_REPOSITORY`: `owner/repo` identifier.
- `GITHUB_TOKEN`: token used for GitHub API and release creation.
- `COPILOT_GITHUB_TOKEN`: token used for GitHub Copilot CLI (AI changelog).
- `GITHUB_OUTPUT`: optional; used for workflow output values.

## Setup Commands
- Install dependencies: `bun install --frozen-lockfile`
- Install Copilot CLI: `npm install -g @github/copilot`
- Show top-level dependencies: `bun pm ls`
- Verify Bun version: `bun --version`

## Build, Lint, Test Commands
This repo does not have a transpile/build step for runtime execution.

### Build
- Runtime execution: `bun run scripts/index.ts`
- No emit build step is required.

### Lint / Static Checks
- Biome is used for fast linting and formatting.
- Check formatting/lint: `bun run lint`
- Auto-fix formatting/lint: `bun run format`
- Type-check command: `bun run typecheck`
- Direct equivalent: `bunx tsc --noEmit`

### Tests (Bun)
- Run all tests: `bun test`
- Run one test file: `bun test scripts/lib/env.test.ts`
- Run a single test by name:
  - `bun test --test-name-pattern "throws when repository format is invalid" scripts/lib/env.test.ts`

### Testing Guidance
- Keep tests deterministic and offline by default.
- Prefer testing pure helper functions in `scripts/lib/*`.
- Avoid live network and live git mutation in unit tests.
- For integration coverage, use disposable clones/worktrees.

## Operational Commands

### Full Orchestration
- Command: `bun run scripts/index.ts`
- Stage flow:
  1) check npm vs releases
  2) sync unsynced versions into `orphan`
  3) generate releases (requires `COPILOT_GITHUB_TOKEN`)

### Check Stage
- Internal entry: `checkForUnsyncedVersions(...)` in `scripts/check.ts`
- Input: typed params (package name, token, repository, output path)
- Output: sorted unsynced semver list

### Sync Stage
- Internal entry: `syncVersions(...)` in `scripts/sync.ts`
- Input: typed params (package name, versions)
- Output: side effects in git (`orphan` commits/tags/push)

### Release Stage
- Internal entry: `generateReleases(...)` in `scripts/release.ts`
- Input: typed params (token, repository, versions)
- Output: GitHub Releases for synced versions
- Requirement: `COPILOT_GITHUB_TOKEN` must be in the environment to use the GitHub Copilot CLI.

## TypeScript Configuration Expectations
- Keep `tsconfig.json` explicit and self-documenting.
- Current compiler intent:
  - `target: ES2025`
  - `module: ESNext`
  - `moduleResolution: bundler`
  - `allowImportingTsExtensions: true`
  - `lib: ["ES2025"]`
  - `noEmit: true`
  - `strict: true`
  - `noUncheckedIndexedAccess: true`
  - `noImplicitOverride: true`
  - `noUncheckedSideEffectImports: true`
  - `types: ["bun-types", "node"]`

## Import Conventions
- Use `#/` subpath imports for project modules.
- Do not use deep `../` cross-directory imports when `#/` is available.
- Import order:
  1) Node built-ins
  2) third-party modules
  3) local `#/` modules
- Keep one import declaration per line group for readability.

## Formatting And Naming
- Tool: Biome (config in `biome.json`).
- Indentation: 1 tab (default Biome preference).
- Strings: single quotes.
- Semicolons: always.
- Function/variable names: `camelCase`.
- Types/interfaces: `PascalCase`.
- Env keys: `UPPER_SNAKE_CASE` in `process.env` access.

## Type Safety Rules
- Every exported function must have an explicit return type.
- Do not use `any`; use `unknown` and narrow.
- Validate environment and external payloads immediately.
- Use `Array.prototype.at()` plus undefined checks when indexing.
- Prefer readonly fields in data contracts passed across modules.

## Error Handling Rules
- Top-level script failures must exit non-zero.
- `catch` bindings should be `unknown` and narrowed (`instanceof Error`).
- Include command/context in thrown errors.
- For command execution helpers, include stderr/message in error output.
- Allow graceful fallbacks only when explicitly intentional and logged.

## Git And Side-Effect Safety
- Treat git operations as high-risk.
- Preserve branch/tag existence checks.
- Preserve idempotent behavior (skip existing tags, tolerate no-op commits).
- Do not remove cleanup logic around temp directories/worktrees.
- Document push/tag behaviors in PR notes.

## CI / Workflow Expectations
- Keep `.github/workflows/sync.yml` aligned with Bun execution.
- Workflow should remain both scheduled and manually dispatchable.
- Do not split orchestration back into environment-coupled stage scripts unless required.

## Cursor/Copilot Rule Files
- Checked paths:
  - `.cursor/rules/`
  - `.cursorrules`
  - `.github/copilot-instructions.md`
- Current state: none of these files exist.
- If they appear later, treat them as additional authoritative instructions.

## Contribution Notes For Agents
- Keep edits tightly scoped to requested outcomes.
- Prefer improving typing/tooling/tests without changing runtime behavior.
- Update docs (`AGENTS.md`, `README.md`) when commands or workflow shape changes.
- Provide exact verification commands in PR descriptions.
