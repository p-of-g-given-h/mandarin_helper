import { requestUrl } from "obsidian";
import { pinyin } from "pinyin-pro";

export type DictionaryEntry = [string, string[], string[]];
export type RankingDictionary = Record<string, number>;
export interface DictionaryMatch {
	entry: DictionaryEntry;
	ranking: number;
	hanziLength: number;
	secondaryLength: number;
}
export interface MakeDictionaryOptions {
	writeJson?: (json: string) => Promise<void>;
}

export function normalize(value: string): string {
	let normalized = "";
	let parenthesesDepth = 0;
	let bracketDepth = 0;

	for (const character of value) {
		if (character === "(") {
			parenthesesDepth += 1;
			continue;
		}

		if (character === ")") {
			parenthesesDepth = Math.max(0, parenthesesDepth - 1);
			continue;
		}

		if (character === "[") {
			bracketDepth += 1;
			continue;
		}

		if (character === "]") {
			bracketDepth = Math.max(0, bracketDepth - 1);
			continue;
		}

		if (parenthesesDepth === 0 && bracketDepth === 0) {
			normalized += character;
		}
	}

	return normalized
		.replace(/\s+/gu, "")
		.toLowerCase()
		.replace(/u:|v|\u00fc/gu, "u");
}

export function parse_line(value: string): DictionaryEntry {
	const slashParts = value.split("/").filter((slashPart) => slashPart.length > 0);
	const [firstSlashPart = ""] = slashParts;
	const [, hanzi = ""] = firstSlashPart.trim().split(/\s+/u);
	const npinyin = normalize(pinyin(hanzi, { toneType: "none" }));
	const searchables = [npinyin];
	const translations: string[] = [];

	for (const slashPart of slashParts.slice(1)) {
		translations.push(slashPart);
		searchables.push(normalize(stripSearchableExampleSuffix(slashPart)));
	}

	return [hanzi, searchables, translations];
}

export function parse(value: string): DictionaryEntry[] {
	return value
		.split(/\r?\n/u)
		.filter((line) => line.length > 0 && !line.startsWith("#"))
		.map((line) => parse_line(line));
}

export async function make_dictionary(url: string, options?: MakeDictionaryOptions): Promise<DictionaryEntry[]> {
	const resolvedUrl = resolveDictionaryUrl(url);
	let sourceText: string;

	try {
		const response = await requestUrl(resolvedUrl);
		if (response.status >= 400) {
			throw new Error(`HTTP ${response.status}`);
		}

		sourceText = response.text;
	} catch (error) {
		throw new Error(
			`Failed to download dictionary from ${resolvedUrl}: ${getErrorMessage(error)}`,
		);
	}

	let parsed: DictionaryEntry[];

	try {
		parsed = parse(sourceText);
	} catch (error) {
		throw new Error(
			`Failed to parse dictionary content from ${resolvedUrl}: ${getErrorMessage(error)}`,
		);
	}

	const json = JSON.stringify(parsed, null, "\t");

	if (options?.writeJson) {
		try {
			await options.writeJson(json);
		} catch (error) {
			throw new Error(
				`Failed to write generated dictionary JSON for ${resolvedUrl}: ${getErrorMessage(error)}`,
			);
		}
		return parsed;
	}

	return parsed;
}

export function findDictionaryMatches(
	entries: DictionaryEntry[],
	query: string,
	rankingDictionary: RankingDictionary = {},
): DictionaryEntry[] {
	const rawQuery = query.trim();
	const normalizedQuery = normalize(rawQuery);

	if (rawQuery.length === 0) {
		return [];
	}

	return entries
		.map((entry) => {
			const sortKey = getDictionaryMatchSortKey(entry, rawQuery, normalizedQuery, rankingDictionary);
			return sortKey === null ? null : { entry, ...sortKey };
		})
		.filter((match): match is DictionaryMatch => match !== null)
		.sort((left, right) =>
			left.ranking - right.ranking
			|| left.hanziLength - right.hanziLength
			|| left.secondaryLength - right.secondaryLength,
		)
		.map((match) => match.entry);
}

function resolveDictionaryUrl(url: string): string {
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

function getDictionaryMatchSortKey(
	[hanzi, searchables]: DictionaryEntry,
	rawQuery: string,
	normalizedQuery: string,
	rankingDictionary: RankingDictionary,
): Omit<DictionaryMatch, "entry"> | null {
	const matchingSearchableLengths: number[] = [];

	const matchesHanzi = hanzi.includes(rawQuery);

	if (normalizedQuery.length > 0) {
		for (const searchable of searchables) {
			if (searchable.includes(normalizedQuery)) {
				matchingSearchableLengths.push(searchable.length);
			}
		}
	}

	if (!matchesHanzi && matchingSearchableLengths.length === 0) {
		return null;
	}

	return {
		ranking: rankingDictionary[hanzi] ?? 1000000,
		hanziLength: hanzi.length,
		secondaryLength: matchesHanzi
			? Math.min(...searchables.map((searchable) => searchable.length))
			: Math.min(...matchingSearchableLengths),
	};
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function stripSearchableExampleSuffix(value: string): string {
	const exampleIndex = value.indexOf("; Bsp.:");
	return exampleIndex === -1 ? value : value.slice(0, exampleIndex);
}
