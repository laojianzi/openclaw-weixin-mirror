import semver from "semver";
import { tryRunOutput } from "#/lib/git.ts";
import type { RepositoryRef } from "#/lib/github.ts";
import { createRelease } from "#/lib/github.ts";

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
	const systemPrompt =
		"You are a professional technical writer. Generate concise, accurate release notes in English based on code diffs and README changes.";
	const userPrompt = `
Generate a changelog for version ${version}.
Previous version: ${prevVersion || "None (Initial Release)"}

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

	const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

	// Use copilot -p with --silent and --yolo for non-interactive scripting
	// We specify COPILOT_GITHUB_TOKEN in the environment
	// Using bunx --bun ensures we use the local version in node_modules
	const { execFileSync } = await import("node:child_process");

	try {
		const output = execFileSync(
			"bunx",
			["--bun", "copilot", "-p", fullPrompt, "--silent", "--yolo"],
			{
				env: { ...process.env, COPILOT_GITHUB_TOKEN: githubToken },
				encoding: "utf8",
				maxBuffer: 10 * 1024 * 1024,
			},
		);
		return output.trim();
	} catch (err: unknown) {
		throw new Error(
			`Copilot CLI failed: ${err instanceof Error ? err.message : String(err)}`,
		);
	}
}

export async function generateReleases(params: ReleaseParams): Promise<void> {
	if (params.versions.length === 0) {
		console.log("No new versions to release.");
		return;
	}

	const allTagsStr = tryRunOutput("git tag --sort=version:refname");
	const allTags = allTagsStr.split("\n").filter((tag) => semver.valid(tag));

	for (const version of params.versions) {
		console.log(`\n--- Generating release for ${version} ---`);

		const currentIndex = allTags.indexOf(version);
		const prevVersion =
			currentIndex > 0 ? (allTags.at(currentIndex - 1) ?? null) : null;

		let diffStr = "";
		if (prevVersion) {
			diffStr = tryRunOutput(`git diff ${prevVersion} ${version}`).slice(
				0,
				6000,
			);
		} else {
			diffStr = tryRunOutput(`git ls-tree -r --name-only ${version}`).slice(
				0,
				6000,
			);
		}

		const readmeStr = tryRunOutput(`git show ${version}:README.md`).slice(
			0,
			3000,
		);

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
			throw new Error(
				`Failed to create release ${version}:: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}
}
