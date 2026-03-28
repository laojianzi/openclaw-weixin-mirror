import { Octokit } from "@octokit/rest";

export interface RepositoryRef {
	readonly owner: string;
	readonly repo: string;
}

export interface ReleaseSummary {
	readonly tagName: string;
}

let octokitSingleton: Octokit | undefined;

export function getOctokit(githubToken: string): Octokit {
	if (!octokitSingleton) {
		octokitSingleton = new Octokit({ auth: githubToken });
	}
	return octokitSingleton;
}

export async function listReleases(
	githubToken: string,
	repository: RepositoryRef,
): Promise<ReadonlyArray<ReleaseSummary>> {
	const octokit = getOctokit(githubToken);
	try {
		const releases = await octokit.paginate(octokit.rest.repos.listReleases, {
			owner: repository.owner,
			repo: repository.repo,
			per_page: 100,
		});

		return releases.map((release) => ({
			tagName: release.tag_name,
		}));
	} catch (err: unknown) {
		if (typeof err === "object" && err !== null) {
			const status = Reflect.get(err, "status");
			if (status === 404) {
				return [];
			}
		}

		throw err;
	}
}

export async function createRelease(
	githubToken: string,
	repository: RepositoryRef,
	params: {
		readonly tagName: string;
		readonly name: string;
		readonly body: string;
		readonly prerelease: boolean;
	},
): Promise<void> {
	const octokit = getOctokit(githubToken);
	await octokit.rest.repos.createRelease({
		owner: repository.owner,
		repo: repository.repo,
		tag_name: params.tagName,
		name: params.name,
		body: params.body,
		prerelease: params.prerelease,
	});
}
