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
		"You are a professional technical writer for open-source projects. Your task is to generate high-quality, clean, and concise release notes in English. You MUST follow the provided template structure exactly, using bolded headers with emojis and a version title. No conversational filler, no meta-comments, and no Markdown code fences.";

	const userPrompt = `
Generate a changelog for version ${version} based on the provided context.
Previous version: ${prevVersion || "None (Initial Release)"}

TEMPLATE SPECIFICATION:
Your response must start with "## Version ${version}" and follow this exact style:

## Version ${version}

💥 **Breaking Changes**
- (List breaking changes here, if any)

✨ **New Features**
- (List new features here)

🐛 **Bug Fixes**
- (List bug fixes here)

📦 **Dependencies**
- (List dependency changes here)

🔧 **Other Changes**
- (List internal improvements, refactorings, or documentation updates here)

STYLE GUIDELINES:
- Use past tense or descriptive present tense (e.g., "Added support for...", "Improved reliability...", "Refactored module...").
- Be technically specific (mention headers, status codes, or file names when relevant).
- Omit any section that has no content.
- DO NOT use code fences (e.g., \`\`\`markdown).
- DO NOT add any text before or after the changelog.

CONTEXT:
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

		let content = output.trim();

		// Post-processing to strip markdown code fences if AI didn't follow the prompt
		if (content.startsWith("```markdown")) {
			content = content.replace(/^```markdown\n?/, "").replace(/\n?```$/, "");
		} else if (content.startsWith("```")) {
			content = content.replace(/^```\n?/, "").replace(/\n?```$/, "");
		}

		return content.trim();
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
