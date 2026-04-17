import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { make_ranking, parse_ranking } from "../src/wordlist.ts";

const SAMPLE_COMPLETE_JSON = JSON.stringify([
	{
		simplified: "你好",
		frequency: 123,
	},
	{
		simplified: "世界",
		frequency: 456,
	},
	{
		simplified: "",
		frequency: 789,
	},
	{
		simplified: "跳过",
	},
	{
		frequency: 999,
	},
]);

export function test_parse_ranking(): void {
	assert.deepEqual(parse_ranking(SAMPLE_COMPLETE_JSON), {
		"你好": 123,
		"世界": 456,
	});
}

export async function test_make_ranking(): Promise<void> {
	let writtenJson = "";

	const ranking = await make_ranking("https://github.com/drkameleon/complete-hsk-vocabulary/blob/main/complete.json", {
		fetchText: async () => SAMPLE_COMPLETE_JSON,
		writeJson: async (json) => {
			writtenJson = json;
		},
	});

	assert.deepEqual(ranking, {
		"你好": 123,
		"世界": 456,
	});
	assert.deepEqual(JSON.parse(writtenJson), ranking);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	test_parse_ranking();
	await test_make_ranking();
}
