import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const COMPLETE_WORDLIST_URL = "https://github.com/drkameleon/complete-hsk-vocabulary/blob/main/complete.json";

export type RankingMap = Record<string, number>;

interface CompleteWordlistEntry {
	simplified?: unknown;
	frequency?: unknown;
}

export interface MakeRankingOptions {
	fetchText?: (url: string) => Promise<string>;
	writeJson?: (json: string) => Promise<void>;
	outputPath?: string;
}

export function parse_ranking(value: string): RankingMap {
	const parsed = JSON.parse(value) as unknown;

	if (!Array.isArray(parsed)) {
		throw new Error("Expected complete.json to contain a top-level array.");
	}

	const result: RankingMap = {};

	for (const item of parsed) {
		if (!isCompleteWordlistEntry(item)) {
			continue;
		}

		const { simplified, frequency } = item;

		if (typeof simplified !== "string" || simplified.length === 0) {
			continue;
		}

		if (typeof frequency !== "number" || !Number.isFinite(frequency)) {
			continue;
		}

		result[simplified] = frequency;
	}

	return result;
}

export async function make_ranking(
	url = COMPLETE_WORDLIST_URL,
	options?: MakeRankingOptions,
): Promise<RankingMap> {
	const resolvedUrl = resolveGithubBlobUrl(url);
	const fetchText = options?.fetchText ?? downloadText;

	let sourceText: string;

	try {
		sourceText = await fetchText(resolvedUrl);
	} catch (error) {
		throw new Error(
			`Failed to download ranking source from ${resolvedUrl}: ${getErrorMessage(error)}`,
		);
	}

	let ranking: RankingMap;

	try {
		ranking = parse_ranking(sourceText);
	} catch (error) {
		throw new Error(
			`Failed to parse ranking content from ${resolvedUrl}: ${getErrorMessage(error)}`,
		);
	}

	const json = JSON.stringify(ranking, null, "\t");

	if (options?.writeJson) {
		try {
			await options.writeJson(json);
		} catch (error) {
			throw new Error(
				`Failed to write generated ranking JSON for ${resolvedUrl}: ${getErrorMessage(error)}`,
			);
		}

		return ranking;
	}

	const outputPath = options?.outputPath ?? getDefaultOutputPath();

	try {
		await mkdir(path.dirname(outputPath), { recursive: true });
		await writeFile(outputPath, json, "utf8");
	} catch (error) {
		throw new Error(
			`Failed to write generated ranking JSON to ${outputPath}: ${getErrorMessage(error)}`,
		);
	}

	return ranking;
}

async function downloadText(url: string): Promise<string> {
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(`HTTP ${response.status}`);
	}

	return await response.text();
}

function getDefaultOutputPath(): string {
	const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
	return path.resolve(sourceDirectory, "..", "ranking.json");
}

function isCompleteWordlistEntry(value: unknown): value is CompleteWordlistEntry {
	return typeof value === "object" && value !== null;
}

function resolveGithubBlobUrl(url: string): string {
	const parsedUrl = new URL(url);

	if (
		parsedUrl.hostname === "github.com" &&
		parsedUrl.pathname.includes("/blob/")
	) {
		const pathSegments = parsedUrl.pathname.split("/").filter((segment) => segment.length > 0);
		const blobIndex = pathSegments.indexOf("blob");

		if (blobIndex === 2 && pathSegments.length > blobIndex + 1) {
			const [owner, repository] = pathSegments;
			const branch = pathSegments[blobIndex + 1];
			const filePath = pathSegments.slice(blobIndex + 2).join("/");

			return `https://raw.githubusercontent.com/${owner}/${repository}/${branch}/${filePath}`;
		}
	}

	return url;
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
