import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { gitBranchExists, gitTagExists, run, runOutput } from '#/lib/git.ts';

export interface SyncParams {
  readonly packageName: string;
  readonly versions: ReadonlyArray<string>;
}

export async function syncVersions(params: SyncParams): Promise<void> {
  if (params.versions.length === 0) {
    console.log('No new versions to sync.');
    return;
  }

  console.log(`Syncing ${params.versions.length} versions: ${params.versions.join(', ')}`);

  run('git config user.name "github-actions[bot]"');
  run('git config user.email "github-actions[bot]@users.noreply.github.com"');

  const orphanBranch = 'orphan';
  const repoDir = process.cwd();

  try {
    run('git fetch origin');
  } catch {
    console.log('Git fetch origin failed (might be a new repository). Ignoring.');
  }

  if (gitBranchExists(orphanBranch)) {
    console.log(`Branch ${orphanBranch} exists. Checking it out.`);
    try {
      run(`git checkout ${orphanBranch}`);
    } catch {
      run(`git checkout -b ${orphanBranch} origin/${orphanBranch}`);
    }
  } else {
    console.log(`Branch ${orphanBranch} does not exist. Creating as orphan.`);
    run(`git checkout --orphan ${orphanBranch}`);
    run('git reset');
    run('git clean -fdx');
  }

  for (const version of params.versions) {
    console.log(`\n--- Processing version ${version} ---`);

    if (gitTagExists(version)) {
      console.log(`Tag ${version} already exists. Skipping.`);
      continue;
    }

    const tempPkgDir = join(tmpdir(), `pkg-${version}`);

    if (existsSync(tempPkgDir)) {
      rmSync(tempPkgDir, { recursive: true, force: true });
    }
    mkdirSync(tempPkgDir, { recursive: true });

    console.log(`Packing ${params.packageName}@${version}...`);
    const tarballName = runOutput(`npm pack ${params.packageName}@${version} --silent`, {
      cwd: tempPkgDir,
    });
    const tarballPath = join(tempPkgDir, tarballName);

    console.log(`Extracting ${tarballPath} into temp directory...`);
    run(`tar -xzf "${tarballPath}" -C "${tempPkgDir}" --strip-components=1`);

    console.log(`Removing tarball ${tarballPath}...`);
    rmSync(tarballPath, { force: true });

    run(`git checkout ${orphanBranch}`);

    console.log('Cleaning working directory...');
    try {
      run('git rm -rf .');
    } catch {
      console.log('git rm failed, likely no tracked files. ignoring.');
    }
    run('git clean -fdx');

    console.log(`Copying files from ${tempPkgDir} to ${repoDir}...`);
    run(`cp -R "${tempPkgDir}/"* "${repoDir}/" 2>/dev/null || true`);
    run(`cp -R "${tempPkgDir}/".* "${repoDir}/" 2>/dev/null || true`);

    rmSync(tempPkgDir, { recursive: true, force: true });

    console.log('Committing changes...');
    run('git add -A');

    try {
      run(`git commit -m "${version}"`);
      console.log(`Creating tag ${version}...`);
      run(`git tag ${version}`);
    } catch {
      console.log(`Commit or tag failed for ${version}. Maybe no changes?`);
    }
  }

  console.log('\n--- Finished processing all versions. Pushing orphan branch and tags ---');
  run(`git push origin ${orphanBranch} --tags`);
}
