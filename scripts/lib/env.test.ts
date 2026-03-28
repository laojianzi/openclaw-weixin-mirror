import { describe, expect, test } from "bun:test";

import { parseRepository } from "#/lib/env.ts";

describe("parseRepository", () => {
	test("parses owner and repo from owner/repo input", () => {
		const parsed = parseRepository("acme/mirror");

		expect(parsed).toEqual({ owner: "acme", repo: "mirror" });
	});

	test("throws when repository format is invalid", () => {
		expect(() => parseRepository("invalid-repository")).toThrow(
			"Invalid GITHUB_REPOSITORY value: invalid-repository",
		);
	});
});
