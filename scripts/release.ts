import semver from 'semver';

import { createRelease } from '#/lib/github.ts';
import type { RepositoryRef } from '#/lib/github.ts';
import { tryRunOutput } from '#/lib/git.ts';

export interface ReleaseParams {
  readonly githubToken: string;
  readonly repository: RepositoryRef;
  readonly versions: ReadonlyArray<string>;
}

async function generateChangelog(
  githubToken: string,
  version: string,
  prevVersion: string | null,
  diffStr: string,
  readmeStr: string,
): Promise<string> {
  const endpoint = 'https://models.inference.ai.azure.com/chat/completions';

  const systemPrompt =
    'You are a professional technical writer. Generate concise, accurate release notes in English based on code diffs and README changes.';
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
        Authorization: `Bearer ${githubToken}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 1000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status} ${response.statusText}`);
    }

    const data: unknown = await response.json();
    const choices =
      typeof data === 'object' && data !== null ? Reflect.get(data, 'choices') : undefined;

    if (!Array.isArray(choices)) {
      throw new Error('Invalid AI response payload: choices missing');
    }

    const firstChoice = choices.at(0);
    if (typeof firstChoice !== 'object' || firstChoice === null) {
      throw new Error('Invalid AI response payload: first choice missing');
    }

    const message = Reflect.get(firstChoice, 'message');
    if (typeof message !== 'object' || message === null) {
      throw new Error('Invalid AI response payload: message missing');
    }

    const content = Reflect.get(message, 'content');
    if (typeof content !== 'string') {
      throw new Error('Invalid AI response payload: content missing');
    }

    return content.trim();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`AI Changelog generation failed for ${version}:`, message);
    return `### 自动生成更新日志失败\n\n版本 ${version} 已发布。由于生成更新日志时遇到错误，请查看源代码了解详细变更。`;
  }
}

export async function generateReleases(params: ReleaseParams): Promise<void> {
  if (params.versions.length === 0) {
    console.log('No new versions to release.');
    return;
  }

  const allTagsStr = tryRunOutput('git tag --sort=version:refname');
  const allTags = allTagsStr.split('\n').filter(tag => semver.valid(tag));

  for (const version of params.versions) {
    console.log(`\n--- Generating release for ${version} ---`);

    const currentIndex = allTags.indexOf(version);
    const prevVersion = currentIndex > 0 ? (allTags.at(currentIndex - 1) ?? null) : null;

    let diffStr = '';
    if (prevVersion) {
      diffStr = tryRunOutput(`git diff ${prevVersion} ${version}`).slice(0, 6000);
    } else {
      diffStr = tryRunOutput(`git ls-tree -r --name-only ${version}`).slice(0, 6000);
    }

    const readmeStr = tryRunOutput(`git show ${version}:README.md`).slice(0, 3000);

    console.log(`Generating changelog via AI for ${version}...`);
    const changelog = await generateChangelog(
      params.githubToken,
      version,
      prevVersion,
      diffStr,
      readmeStr,
    );

    console.log(`Creating GitHub Release for ${version}...`);
    const isPrerelease = semver.prerelease(version) !== null;

    try {
      await createRelease(params.githubToken, params.repository, {
        tagName: version,
        name: version,
        body: changelog,
        prerelease: isPrerelease,
      });
      console.log(`Successfully created release ${version}.`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Failed to create release ${version}:`, message);
    }
  }
}
