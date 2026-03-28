export async function fetchPackageVersions(
	packageName: string,
): Promise<string[]> {
	const packagePath = packageName
		.split("/")
		.map((part) => encodeURIComponent(part))
		.join("/");
	const url = `https://registry.npmjs.org/${packagePath}`;
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(
			`npm registry returned ${response.status} ${response.statusText}`,
		);
	}

	const payload: unknown = await response.json();
	if (typeof payload !== "object" || payload === null) {
		throw new Error("Invalid npm registry payload");
	}

	const versionsValue = Reflect.get(payload, "versions");
	if (typeof versionsValue !== "object" || versionsValue === null) {
		throw new Error("Invalid npm versions payload");
	}

	return Object.keys(versionsValue);
}
