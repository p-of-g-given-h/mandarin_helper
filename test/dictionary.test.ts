import assert from "node:assert/strict";
import { readFile, rm, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { findDictionaryMatches, make_dictionary, parse_line } from "../src/dictionary.ts";

const HANDEDICT_URL = "https://github.com/gugray/HanDeDict/blob/master/handedict.u8";

export async function test_parse(): Promise<void> {
	await rm("dictionary.json", { force: true });

	const parsed = await make_dictionary(HANDEDICT_URL, {
		writeJson: async (json) => {
			await writeFile("dictionary.json", json, "utf8");
		},
	});
	const [hanzi, searchables, translations] = parsed[0] ?? [];

	assert.ok(parsed.length > 1000);
	assert.ok(typeof hanzi === "string" && hanzi.length > 0);
	assert.ok(Array.isArray(searchables) && searchables.length > 0);
	assert.ok(typeof searchables?.[0] === "string" && searchables[0].length > 0);
	assert.ok(Array.isArray(translations) && translations.length > 0);
	assert.ok(parsed.some(([, , entryTranslations]) => entryTranslations.some((translation) => translation.length > 0)));

	const dictionaryFile = JSON.parse(await readFile("dictionary.json", "utf8")) as unknown[];
	assert.equal(dictionaryFile.length, parsed.length);
}

export function test_find_dictionary_matches(): void {
	const entries = [
		["\u4f60\u597d", ["nihao", "hello"], ["hello"]],
		["\u4f60", ["ni"], ["you"]],
		["\u518d\u89c1", ["zaijian", "goodbye"], ["goodbye"]],
		["\u5929\u6c14", ["tianqi", "weather", "sky"], ["weather"]],
		["\u5929\u5802", ["tiantang", "heaven"], ["heaven"]],
		["\u4f60\u4eec", ["help"], ["help"]],
		["\u4ed6\u4eec\u597d", ["hey"], ["hey"]],
	];

	const hanziMatches = findDictionaryMatches(entries, "\u4f60");
	assert.deepEqual(hanziMatches.map((entry) => entry[0]), ["\u4f60", "\u4f60\u4eec", "\u4f60\u597d"]);

	const searchableMatches = findDictionaryMatches(entries, "HEL");
	assert.deepEqual(searchableMatches.map((entry) => entry[0]), ["\u4f60\u4eec", "\u4f60\u597d"]);

	const searchablePrimarySortMatches = findDictionaryMatches(entries, "he");
	assert.deepEqual(searchablePrimarySortMatches.map((entry) => entry[0]), ["\u4f60\u4eec", "\u4f60\u597d", "\u5929\u5802", "\u5929\u6c14", "\u4ed6\u4eec\u597d"]);

	const hanziSecondarySortMatches = findDictionaryMatches(entries, "\u5929");
	assert.deepEqual(hanziSecondarySortMatches.map((entry) => entry[0]), ["\u5929\u6c14", "\u5929\u5802"]);
}

export function test_find_dictionary_matches_prefers_lower_ranking_before_legacy_sort(): void {
	const entries = [
		["\u4f60\u597d", ["nihao", "hello"], ["hello"]],
		["\u4f60", ["ni"], ["you"]],
		["\u4f60\u4eec", ["help"], ["help"]],
	];

	const rankedMatches = findDictionaryMatches(entries, "\u4f60", {
		"\u4f60\u597d": 20,
		"\u4f60": 50,
	});
	assert.deepEqual(rankedMatches.map((entry) => entry[0]), ["\u4f60\u597d", "\u4f60", "\u4f60\u4eec"]);
}

export function test_parse_line_strips_example_suffix_from_searchable(): void {
	const [hanzi, searchables, translations] = parse_line("\u50b3\u7d71 \u4f20\u7edf /tradition: Bsp.: alte Tradition/legacy/");

	assert.equal(hanzi, "\u4f20\u7edf");
	assert.deepEqual(searchables, ["chuantong", "tradition", "legacy"]);
	assert.deepEqual(translations, ["tradition: Bsp.: alte Tradition", "legacy"]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	test_find_dictionary_matches();
	test_find_dictionary_matches_prefers_lower_ranking_before_legacy_sort();
	test_parse_line_strips_example_suffix_from_searchable();
	await test_parse();
}
