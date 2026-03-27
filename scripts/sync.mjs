import { execSync } from 'node:child_process';
import { rmSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function run(command, options = {}) {
  console.log(`> ${command}`);
  return execSync(command, { stdio: 'inherit', ...options });
}

function runOutput(command) {
  return execSync(command, { encoding: 'utf-8' }).trim();
}

function gitBranchExists(branchName) {
  try {
    runOutput(`git rev-parse --verify origin/${branchName}`);
    return true;
  } catch (err) {
    try {
      runOutput(`git rev-parse --verify ${branchName}`);
      return true;
    } catch {
      return false;
    }
  }
}

function gitTagExists(tagName) {
  try {
    runOutput(`git rev-parse --verify refs/tags/${tagName}`);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const packageName = '@tencent-weixin/openclaw-weixin';
  const newVersionsEnv = process.env.NEW_VERSIONS;
  
  if (!newVersionsEnv) {
    console.log('No NEW_VERSIONS found in environment. Exiting.');
    return;
  }

  const versions = newVersionsEnv.split(',').filter(Boolean);
  if (versions.length === 0) {
    console.log('No new versions to sync.');
    return;
  }

  console.log(`Syncing ${versions.length} versions: ${versions.join(', ')}`);

  // Setup git user for commits
  run('git config user.name "github-actions[bot]"');
  run('git config user.email "github-actions[bot]@users.noreply.github.com"');

  const orphanBranch = 'orphan';
  const repoDir = process.cwd();

  // Try to checkout the orphan branch if it exists, otherwise create it
  // We need to fetch it first if it exists remotely
  try {
    run('git fetch origin');
  } catch (err) {
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
    run('git rm -rf .');
    // Ensure we have an empty initial commit so we can commit files to it cleanly.
    // It's not strictly necessary, but makes it a true branch with history.
    run('git commit --allow-empty -m "Initial empty commit"');
  }

  // Iterate over each version and commit
  for (const version of versions) {
    console.log(`\n--- Processing version ${version} ---`);

    if (gitTagExists(version)) {
      console.log(`Tag ${version} already exists. Skipping.`);
      continue;
    }

    const tempPkgDir = join(tmpdir(), `pkg-${version}`);
    
    // Clean up temp dir if it exists
    if (existsSync(tempPkgDir)) {
      rmSync(tempPkgDir, { recursive: true, force: true });
    }
    mkdirSync(tempPkgDir, { recursive: true });

    console.log(`Packing ${packageName}@${version}...`);
    // Run npm pack in the temp directory so the tarball is created there
    const tarballName = execSync(`npm pack ${packageName}@${version} --silent`, { cwd: tempPkgDir, encoding: 'utf-8' }).trim();
    const tarballPath = join(tempPkgDir, tarballName);

    console.log(`Extracting ${tarballPath} into temp directory...`);
    run(`tar -xzf "${tarballPath}" -C "${tempPkgDir}" --strip-components=1`);

    console.log(`Removing tarball ${tarballPath}...`);
    rmSync(tarballPath, { force: true });

    // Ensure we are on the orphan branch
    run(`git checkout ${orphanBranch}`);

    // Clean current working directory (excluding .git)
    console.log('Cleaning working directory...');
    // `git rm -rf .` removes all tracked files from index and working tree
    try {
        run('git rm -rf .');
    } catch (e) {
        console.log('git rm failed, likely no tracked files. ignoring.');
    }
    // `git clean -fdx` removes untracked and ignored files (excluding .git as it's protected by default)
    run('git clean -fdx');

    // Copy extracted files from temp to repo
    console.log(`Copying files from ${tempPkgDir} to ${repoDir}...`);
    // Using cp -r. Note: cp -R behaves differently on macOS vs Linux regarding hidden files.
    // To be safe, we use a shell glob or just copy the directory contents
    run(`cp -R "${tempPkgDir}/"* "${repoDir}/" 2>/dev/null || true`);
    run(`cp -R "${tempPkgDir}/".* "${repoDir}/" 2>/dev/null || true`);
    
    // Clean up temp dir after copy
    rmSync(tempPkgDir, { recursive: true, force: true });

    console.log('Committing changes...');
    run('git add -A');
    
    try {
        run(`git commit -m "${version}"`);
        console.log(`Creating tag ${version}...`);
        run(`git tag ${version}`);
    } catch (e) {
        console.log(`Commit or tag failed for ${version}. Maybe no changes?`);
    }
  }

  console.log('\n--- Finished processing all versions. Pushing orphan branch and tags ---');
  // Return to the branch we started on (optional, but good practice if testing locally)
  // For actions, it just runs and exits.
  run(`git push origin ${orphanBranch} --tags`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
