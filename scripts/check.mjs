import { execSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { Octokit } from '@octokit/rest';
import semver from 'semver';

async function main() {
  const packageName = '@tencent-weixin/openclaw-weixin';
  const repository = process.env.GITHUB_REPOSITORY;
  const githubToken = process.env.GITHUB_TOKEN;

  if (!repository) {
    throw new Error('GITHUB_REPOSITORY env var is required');
  }

  const [owner, repo] = repository.split('/');
  
  console.log(`Checking npm for versions of ${packageName}...`);
  const npmViewOutput = execSync(`npm view ${packageName} versions --json`, { encoding: 'utf-8' });
  const npmVersions = JSON.parse(npmViewOutput);
  
  if (!Array.isArray(npmVersions)) {
    throw new Error('Failed to parse npm versions as array');
  }

  console.log(`Found ${npmVersions.length} versions on npm.`);

  console.log(`Fetching existing releases from GitHub for ${owner}/${repo}...`);
  const octokit = new Octokit({ auth: githubToken });
  let existingReleases = [];
  try {
    existingReleases = await octokit.paginate(octokit.rest.repos.listReleases, {
      owner,
      repo,
      per_page: 100,
    });
  } catch (err) {
    if (err.status !== 404) {
      console.error('Error fetching releases, assuming 0 releases:', err.message);
    }
  }

  const syncedVersions = new Set(
    existingReleases
      .map(release => release.tag_name)
      // The prompt specified that tags have no 'v' prefix, so we don't strictly need to strip it,
      // but it's good practice. We assume the tag name IS the valid semver.
      .filter(tag => semver.valid(tag))
  );

  console.log(`Found ${syncedVersions.size} valid version releases on GitHub.`);

  const unsyncedVersions = npmVersions.filter(v => semver.valid(v) && !syncedVersions.has(v));
  unsyncedVersions.sort(semver.compare);

  console.log(`Found ${unsyncedVersions.length} unsynced versions.`);

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `unsynced_count=${unsyncedVersions.length}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `unsynced_versions=${unsyncedVersions.join(',')}\n`);
  }

  if (unsyncedVersions.length === 0) {
    console.log("Nothing to do.");
  } else {
    console.log(`Pending sync: ${unsyncedVersions.join(', ')}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
