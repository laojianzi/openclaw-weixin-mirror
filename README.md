# openclaw-weixin Mirror

This repository is an unofficial mirror of the npm package [`@tencent-weixin/openclaw-weixin`](https://www.npmjs.com/package/@tencent-weixin/openclaw-weixin).

## Mission

- **Version mirroring**: Reliably synchronize `@tencent-weixin/openclaw-weixin` releases from npm into this repository with traceable history.
- **Source archival**: Preserve unpacked source snapshots on the `orphan` branch (one commit and one tag per version).
- **Release intelligence**: Generate English release notes from version diffs and publish them to GitHub Releases.
- **Developer enablement**: Provide readable source, release notes, and historical traceability to support both human and AI-assisted analysis and extension.

## System Architecture

```mermaid
flowchart LR
  classDef ext fill:#f7f7f7,stroke:#999,stroke-width:1px,color:#222;
  classDef core fill:#eaf3ff,stroke:#4a78c2,stroke-width:1px,color:#102a43;
  classDef data fill:#eefbf3,stroke:#2f9e64,stroke-width:1px,color:#1b4332;
  classDef ci fill:#fff4e6,stroke:#e07a00,stroke-width:1px,color:#7a3e00;

  GH[GitHub Actions<br/>.github/workflows/sync.yml]:::ci --> IDX[scripts/index.ts<br/>Orchestrator]:::core

  subgraph Stage1[Check Stage]
    CHK[scripts/check.ts]:::core
    NPM[(npm Registry)]:::ext
    API[(GitHub REST API)]:::ext
  end

  subgraph Stage2[Sync Stage]
    SYN[scripts/sync.ts]:::core
    GIT[scripts/lib/git.ts]:::core
    ORPHAN[(orphan branch)]:::data
    TAGS[(Git tags)]:::data
  end

  subgraph Stage3[Release Stage]
    REL[scripts/release.ts]:::core
    MODEL[(GitHub Models API)]:::ext
    RELEASES[(GitHub Releases)]:::data
  end

  subgraph SharedLibs[Shared Libraries]
    ENV[scripts/lib/env.ts]:::core
    GH_LIB[scripts/lib/github.ts]:::core
    NPM_LIB[scripts/lib/npm.ts]:::core
  end

  IDX --> CHK --> SYN --> REL

  CHK --> NPM
  CHK --> API
  CHK -.uses.-> ENV
  CHK -.uses.-> GH_LIB
  CHK -.uses.-> NPM_LIB

  SYN --> GIT
  SYN --> ORPHAN
  SYN --> TAGS
  SYN -.uses.-> ENV

  REL --> MODEL
  REL --> RELEASES
  REL -.uses.-> GH_LIB
  REL -.reads tags/diff.-> GIT
```

## Runtime And Tooling

- Runtime: Bun (native TypeScript execution)
- Language: TypeScript (ESM)
- Package manager: Bun
- Main entrypoint: `scripts/index.ts`

## Browsing Versions

- **Source Code**: The un-minified source code for each version lives on the `orphan` branch, with a linear history (one commit per version).
- **By Tag/Version**: You can browse code for a specific version by running: `git checkout <version>` (e.g., `git checkout 1.0.0`). Note that tags do not have a `v` prefix.
- **Releases**: View AI-generated changelogs for each version in the [GitHub Releases](https://github.com/) section of this repository.

## Local Development

Install dependencies:

```bash
bun install --frozen-lockfile
```

Run the full sync orchestration (check -> sync -> release):

```bash
bun run scripts/index.ts
```

Type-check scripts:

```bash
bun run typecheck
```

Run all tests:

```bash
bun test
```

Run a single test file:

```bash
bun test scripts/lib/env.test.ts
```

Run a single test by name pattern:

```bash
bun test --test-name-pattern "throws when repository format is invalid" scripts/lib/env.test.ts
```

## Automation

- **Main Branch**: All automation logic, including GitHub Actions workflows and TypeScript scripts used to synchronize the repository with the npm registry, is located on the `main` branch.
- **Process**: Versions are synced automatically via a scheduled GitHub Actions workflow that runs daily at 03:00 (UTC+8). It executes `bun run scripts/index.ts`, which checks for unsynced versions, imports tarballs to `orphan`, and creates releases using the GitHub Models API.
