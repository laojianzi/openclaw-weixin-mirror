# openclaw-weixin Mirror

This repository is an unofficial mirror of the npm package [`@tencent-weixin/openclaw-weixin`](https://www.npmjs.com/package/@tencent-weixin/openclaw-weixin).

## Browsing Versions

- **Source Code**: The un-minified source code for each version lives on the `orphan` branch, with a linear history (one commit per version).
- **By Tag/Version**: You can browse code for a specific version by running: `git checkout <version>` (e.g., `git checkout 1.0.0`). Note that tags do not have a `v` prefix.
- **Releases**: View AI-generated changelogs for each version in the [GitHub Releases](https://github.com/) section of this repository.

## Automation

- **Main Branch**: All automation logic, including GitHub Actions workflows and Node.js scripts used to synchronize the repository with the npm registry, is located on the `main` branch.
- **Process**: Versions are synced automatically via a scheduled GitHub Actions workflow that runs daily at 03:00 (UTC+8). It downloads the tarball from npm, unpacks it to the `orphan` branch, and generates a release using the GitHub Models API.
