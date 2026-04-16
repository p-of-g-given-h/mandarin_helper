import { writeFile } from "node:fs/promises";
import { pinyin } from "pinyin-pro";

export type DictionaryEntry = [string, string[], string[]];

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
	const slashParts = value.split("/");
	const [firstSlashPart = ""] = slashParts;
	const [, hanzi = ""] = firstSlashPart.trim().split(/\s+/u);
	const npinyin = normalize(pinyin(hanzi, { toneType: "none" }));
	const searchables = [npinyin];
	const translations: string[] = [];

	for (const slashPart of slashParts.slice(1)) {
		translations.push(slashPart);
		searchables.push(normalize(slashPart));
	}

	return [hanzi, searchables, translations];
}

export function parse(value: string): DictionaryEntry[] {
	return value
		.split(/\r?\n/u)
		.filter((line) => line.length > 0 && !line.startsWith("#"))
		.map((line) => parse_line(line));
}

export async function make_dictionary(url: string): Promise<DictionaryEntry[]> {
	const response = await fetch(resolveDictionaryUrl(url));

	if (!response.ok) {
		throw new Error(`Failed to download dictionary: ${response.status} ${response.statusText}`);
	}

	const parsed = parse(await response.text());
	await writeFile("dictionary.json", JSON.stringify(parsed, null, "\t"), "utf8");
	return parsed;
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
