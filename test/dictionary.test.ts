import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { findDictionaryMatches, make_dictionary } from "../src/dictionary.ts";

const HANDEDICT_URL = "https://github.com/gugray/HanDeDict/blob/master/handedict.u8";

export async function test_parse(): Promise<void> {
	await rm("dictionary.json", { force: true });

	const parsed = await make_dictionary(HANDEDICT_URL);
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
		["你好", ["nihao", "hello"], ["hello"]],
		["你", ["ni"], ["you"]],
		["再见", ["zaijian", "goodbye"], ["goodbye"]],
	];

	const hanziMatches = findDictionaryMatches(entries, "你");
	assert.deepEqual(hanziMatches.map((entry) => entry[0]), ["你", "你好"]);

	const searchableMatches = findDictionaryMatches(entries, "HEL");
	assert.deepEqual(searchableMatches.map((entry) => entry[0]), ["你好"]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	test_find_dictionary_matches();
	await test_parse();
}
