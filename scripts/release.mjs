import { execSync } from 'node:child_process';
import { Octokit } from '@octokit/rest';
import semver from 'semver';

function runOutput(command) {
  try {
    return execSync(command, { encoding: 'utf-8' }).trim();
  } catch (err) {
    return '';
  }
}

async function generateChangelog(githubToken, version, prevVersion, diffStr, readmeStr) {
  const endpoint = 'https://models.inference.ai.azure.com/chat/completions';
  
  const systemPrompt = `You are a professional technical writer. Generate concise, accurate release notes in Chinese based on code diffs and README changes.`;
  const userPrompt = `
Generate a changelog for version ${version}.
Previous version: ${prevVersion || 'None (Initial Release)'}

Please provide structured output with the following sections:
💥 Breaking Changes
✨ New Features
🐛 Bug Fixes
📦 Dependencies
🔧 Other Changes

Omit sections with no content. Output plain Markdown, no code fences.

README content snippet:
${readmeStr}

Code Diff snippet:
${diffStr}
`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${githubToken}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 1000,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (err) {
    console.error(`AI Changelog generation failed for ${version}:`, err.message);
    return `### 自动生成更新日志失败\n\n版本 ${version} 已发布。由于生成更新日志时遇到错误，请查看源代码了解详细变更。`;
  }
}

async function main() {
  const repository = process.env.GITHUB_REPOSITORY;
  const githubToken = process.env.GITHUB_TOKEN;
  const newVersionsEnv = process.env.NEW_VERSIONS;

  if (!repository || !githubToken) {
    throw new Error('GITHUB_REPOSITORY and GITHUB_TOKEN env vars are required');
  }

  if (!newVersionsEnv) {
    console.log('No NEW_VERSIONS found. Exiting.');
    return;
  }

  const versions = newVersionsEnv.split(',').filter(Boolean);
  if (versions.length === 0) {
    console.log('No new versions to release.');
    return;
  }

  const [owner, repo] = repository.split('/');
  const octokit = new Octokit({ auth: githubToken });

  // Get all tags on the orphan branch to determine previous versions
  // We run this after sync, so all new tags should be present locally
  const allTagsStr = runOutput('git tag --sort=version:refname');
  const allTags = allTagsStr.split('\n').filter(t => semver.valid(t));

  for (const version of versions) {
    console.log(`\n--- Generating release for ${version} ---`);
    
    // Find prevVersion
    const currentIndex = allTags.indexOf(version);
    const prevVersion = currentIndex > 0 ? allTags[currentIndex - 1] : null;

    let diffStr = '';
    if (prevVersion) {
      diffStr = runOutput(`git diff ${prevVersion} ${version}`).slice(0, 6000);
    } else {
      // First version, just list files
      diffStr = runOutput(`git ls-tree -r --name-only ${version}`).slice(0, 6000);
    }

    const readmeStr = runOutput(`git show ${version}:README.md`).slice(0, 3000);

    console.log(`Generating changelog via AI for ${version}...`);
    const changelog = await generateChangelog(githubToken, version, prevVersion, diffStr, readmeStr);

    console.log(`Creating GitHub Release for ${version}...`);
    const isPrerelease = semver.prerelease(version) !== null;
    
    try {
      await octokit.rest.repos.createRelease({
        owner,
        repo,
        tag_name: version,
        name: version,
        body: changelog,
        prerelease: isPrerelease
      });
      console.log(`Successfully created release ${version}.`);
    } catch (err) {
      console.error(`Failed to create release ${version}:`, err.message);
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
