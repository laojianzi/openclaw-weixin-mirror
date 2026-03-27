import { appendFileSync } from 'node:fs';

import semver from 'semver';

import { listReleases } from '#/lib/github.ts';
import type { ReleaseSummary, RepositoryRef } from '#/lib/github.ts';
import { fetchPackageVersions } from '#/lib/npm.ts';

export interface CheckParams {
  readonly packageName: string;
  readonly githubToken: string;
  readonly repository: RepositoryRef;
  readonly githubOutput?: string;
}

export async function checkForUnsyncedVersions(params: CheckParams): Promise<string[]> {
  console.log(`Checking npm for versions of ${params.packageName}...`);
  const npmVersions = await fetchPackageVersions(params.packageName);

  if (!Array.isArray(npmVersions)) {
    throw new Error('Failed to parse npm versions as array');
  }

  console.log(`Found ${npmVersions.length} versions on npm.`);

  console.log(
    `Fetching existing releases from GitHub for ${params.repository.owner}/${params.repository.repo}...`,
  );

  let existingReleases: ReadonlyArray<ReleaseSummary> = [];
  try {
    existingReleases = await listReleases(params.githubToken, params.repository);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error fetching releases, assuming 0 releases:', message);
  }

  const syncedVersions = new Set(
    existingReleases
      .map(release => release.tagName)
      .filter((tagName): tagName is string => semver.valid(tagName) !== null),
  );

  console.log(`Found ${syncedVersions.size} valid version releases on GitHub.`);

  const unsyncedVersions = npmVersions.filter(
    version => semver.valid(version) !== null && !syncedVersions.has(version),
  );
  unsyncedVersions.sort(semver.compare);

  console.log(`Found ${unsyncedVersions.length} unsynced versions.`);

  if (params.githubOutput) {
    appendFileSync(params.githubOutput, `unsynced_count=${unsyncedVersions.length}\n`);
    appendFileSync(params.githubOutput, `unsynced_versions=${unsyncedVersions.join(',')}\n`);
  }

  if (unsyncedVersions.length === 0) {
    console.log('Nothing to do.');
  } else {
    console.log(`Pending sync: ${unsyncedVersions.join(', ')}`);
  }

  return unsyncedVersions;
}
