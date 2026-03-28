import { checkForUnsyncedVersions } from "#/check.ts";
import { parseEnv, parseRepository } from "#/lib/env.ts";
import { generateReleases } from "#/release.ts";
import { syncVersions } from "#/sync.ts";

async function main(): Promise<void> {
	const env = parseEnv();
	const repository = parseRepository(env.githubRepository);
	const packageName = "@tencent-weixin/openclaw-weixin";

	const unsyncedVersions = await checkForUnsyncedVersions({
		packageName,
		githubToken: env.githubToken,
		repository,
		githubOutput: env.githubOutput,
	});

	if (unsyncedVersions.length === 0) {
		return;
	}

	await syncVersions({
		packageName,
		versions: unsyncedVersions,
	});

	await generateReleases({
		githubToken: env.copilotToken || env.githubToken,
		repository,
		versions: unsyncedVersions,
	});
}

main().catch((err: unknown) => {
	if (err instanceof Error) {
		console.error(err.message);
	} else {
		console.error(String(err));
	}
	process.exit(1);
});
