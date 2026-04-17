import assert from "node:assert/strict";
import { readFile, rm, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { deflateRawSync } from "node:zlib";
import { extractU8TextFromZip, findDictionaryMatches, make_dictionary, parse_line } from "../src/dictionary.ts";

const HANDEDICT_ZIP_URL = "https://github.com/gugray/HanDeDict/blob/master/handedict.zip";

export async function test_parse(): Promise<void> {
	await rm("dictionary.json", { force: true });
	const dictionaryText = "# comment\n\u4f60\u597d \u4f60\u597d [ni3 hao3] /hello/\n\u518d\u89c1 \u518d\u89c1 [zai4 jian4] /goodbye/\n";
	const zipBytes = createZipArchive([
		{ fileName: "dict/handedict.u8", contents: dictionaryText },
	]);

	const parsed = await make_dictionary(HANDEDICT_ZIP_URL, {
		fetchSource: async (url) => {
			assert.equal(url, "https://raw.githubusercontent.com/gugray/HanDeDict/master/handedict.zip");

			return {
				arrayBuffer: toArrayBuffer(zipBytes),
				status: 200,
				text: "",
			};
		},
		writeJson: async (json) => {
			await writeFile("dictionary.json", json, "utf8");
		},
	});
	const [hanzi, searchables, translations] = parsed[0] ?? [];

	assert.equal(parsed.length, 2);
	assert.equal(hanzi, "\u4f60\u597d");
	assert.deepEqual(searchables, ["nihao", "hello"]);
	assert.deepEqual(translations, ["hello"]);
	assert.ok(parsed.some(([, , entryTranslations]) => entryTranslations.includes("goodbye")));

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

export async function test_extract_u8_text_from_zip(): Promise<void> {
	const dictionaryText = "# comment\n\u4f60\u597d \u4f60\u597d [ni3 hao3] /hello/\n";
	const zipBytes = createZipArchive([
		{ fileName: "ignored/readme.txt", contents: "skip me" },
		{ fileName: "dict/handedict.u8", contents: dictionaryText },
	]);

	const extracted = await extractU8TextFromZip(zipBytes, "test zip");

	assert.equal(extracted, dictionaryText);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	test_find_dictionary_matches();
	test_find_dictionary_matches_prefers_lower_ranking_before_legacy_sort();
	test_parse_line_strips_example_suffix_from_searchable();
	await test_extract_u8_text_from_zip();
	await test_parse();
}

function createZipArchive(entries: Array<{ contents: string; fileName: string }>): Uint8Array {
	const encoder = new TextEncoder();
	const localFileParts: Uint8Array[] = [];
	const centralDirectoryParts: Uint8Array[] = [];
	let offset = 0;

	for (const entry of entries) {
		const fileNameBytes = encoder.encode(entry.fileName);
		const uncompressedData = encoder.encode(entry.contents);
		const compressedData = deflateRawSync(uncompressedData);
		const crc32 = getCrc32(uncompressedData);

		const localHeader = new Uint8Array(30 + fileNameBytes.length);
		const localHeaderView = new DataView(localHeader.buffer);
		localHeaderView.setUint32(0, 0x04034b50, true);
		localHeaderView.setUint16(4, 20, true);
		localHeaderView.setUint16(6, 0x0800, true);
		localHeaderView.setUint16(8, 8, true);
		localHeaderView.setUint32(14, crc32, true);
		localHeaderView.setUint32(18, compressedData.length, true);
		localHeaderView.setUint32(22, uncompressedData.length, true);
		localHeaderView.setUint16(26, fileNameBytes.length, true);
		localHeader.set(fileNameBytes, 30);
		localFileParts.push(localHeader, compressedData);

		const centralHeader = new Uint8Array(46 + fileNameBytes.length);
		const centralHeaderView = new DataView(centralHeader.buffer);
		centralHeaderView.setUint32(0, 0x02014b50, true);
		centralHeaderView.setUint16(4, 20, true);
		centralHeaderView.setUint16(6, 20, true);
		centralHeaderView.setUint16(8, 0x0800, true);
		centralHeaderView.setUint16(10, 8, true);
		centralHeaderView.setUint32(16, crc32, true);
		centralHeaderView.setUint32(20, compressedData.length, true);
		centralHeaderView.setUint32(24, uncompressedData.length, true);
		centralHeaderView.setUint16(28, fileNameBytes.length, true);
		centralHeaderView.setUint32(42, offset, true);
		centralHeader.set(fileNameBytes, 46);
		centralDirectoryParts.push(centralHeader);

		offset += localHeader.length + compressedData.length;
	}

	const centralDirectoryOffset = offset;
	const centralDirectorySize = centralDirectoryParts.reduce((size, part) => size + part.length, 0);
	const endOfCentralDirectory = new Uint8Array(22);
	const endOfCentralDirectoryView = new DataView(endOfCentralDirectory.buffer);
	endOfCentralDirectoryView.setUint32(0, 0x06054b50, true);
	endOfCentralDirectoryView.setUint16(8, entries.length, true);
	endOfCentralDirectoryView.setUint16(10, entries.length, true);
	endOfCentralDirectoryView.setUint32(12, centralDirectorySize, true);
	endOfCentralDirectoryView.setUint32(16, centralDirectoryOffset, true);

	return concatUint8Arrays([...localFileParts, ...centralDirectoryParts, endOfCentralDirectory]);
}

function concatUint8Arrays(parts: Uint8Array[]): Uint8Array {
	const totalLength = parts.reduce((length, part) => length + part.length, 0);
	const result = new Uint8Array(totalLength);
	let offset = 0;

	for (const part of parts) {
		result.set(part, offset);
		offset += part.length;
	}

	return result;
}

function getCrc32(bytes: Uint8Array): number {
	let crc = 0xffffffff;

	for (const byte of bytes) {
		crc ^= byte;
		for (let bit = 0; bit < 8; bit += 1) {
			crc = (crc & 1) === 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
		}
	}

	return (crc ^ 0xffffffff) >>> 0;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}
