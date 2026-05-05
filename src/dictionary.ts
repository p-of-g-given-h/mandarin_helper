import { requestUrl } from "obsidian";
import { getPlainPinyin } from "./hanzi/pinyinCache";

export type DictionaryEntry = [string, string[], string[]];
export type RankingDictionary = Record<string, number>;
export interface DictionaryFile {
	entries: DictionaryEntry[];
	version: "1.1.0";
}
export interface DictionaryMatch {
	entry: DictionaryEntry;
	ranking: number;
	hanziLength: number;
	secondaryLength: number;
}
export interface MakeDictionaryOptions {
	fetchSource?: (url: string) => Promise<DictionarySourceResponse>;
	writeJson?: (json: string) => Promise<void>;
}

interface DictionarySourceResponse {
	arrayBuffer: ArrayBuffer;
	status: number;
	text: string;
}

interface ZipEntry {
	compressionMethod: number;
	compressedSize: number;
	fileName: string;
	localHeaderOffset: number;
	uncompressedSize: number;
}

const ZIP_LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const ZIP_CENTRAL_DIRECTORY_HEADER_SIGNATURE = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const ZIP_STORED_COMPRESSION_METHOD = 0;
const ZIP_DEFLATE_COMPRESSION_METHOD = 8;
const ZIP_DATA_DESCRIPTOR_FLAG = 0x0008;
const ZIP_ENCRYPTED_FLAG = 0x0001;
const ZIP_UTF8_FLAG = 0x0800;
const ZIP64_FIELD_LIMIT = 0xffff;
const ZIP64_OFFSET_LIMIT = 0xffffffff;
const MAX_DICTIONARY_MATCHES_PER_QUERY = 50;
const DICTIONARY_FILE_VERSION: DictionaryFile["version"] = "1.1.0";

export function normalize(value: string): string {
	let normalized = "";
	let parenthesesDepth = 0;
	let bracketDepth = 0;

	for (const character of value) {
		// we want to match against words in parantheses after all
		// if (character === "(") {
		// 	parenthesesDepth += 1;
		// 	continue;
		// }

		// if (character === ")") {
		// 	parenthesesDepth = Math.max(0, parenthesesDepth - 1);
		// 	continue;
		// }

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
		.toLowerCase();
}

export function normalizePinyin(value: string): string {
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
	const npinyin = normalizePinyin(getPlainPinyin(hanzi));
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
	const fetchSource = options?.fetchSource ?? downloadDictionarySource;
	let response: DictionarySourceResponse;

	try {
		response = await fetchSource(resolvedUrl);
		if (response.status >= 400) {
			throw new Error(`HTTP ${response.status}`);
		}
	} catch (error) {
		throw new Error(
			`Failed to download dictionary from ${resolvedUrl}: ${getErrorMessage(error)}`,
		);
	}

	let sourceText: string;
	let parsed: DictionaryEntry[];

	try {
		sourceText = await getDictionarySourceText(response, resolvedUrl);
		parsed = parse(sourceText);
	} catch (error) {
		throw new Error(
			`Failed to parse dictionary content from ${resolvedUrl}: ${getErrorMessage(error)}`,
		);
	}

	const json = JSON.stringify(createDictionaryFile(parsed), null, "\t");

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

export function createDictionaryFile(entries: DictionaryEntry[]): DictionaryFile {
	return {
		entries,
		version: DICTIONARY_FILE_VERSION,
	};
}

export function parseDictionaryFileJson(value: string): DictionaryEntry[] {
	const parsed = JSON.parse(value) as unknown;

	if (Array.isArray(parsed)) {
		return parsed as DictionaryEntry[];
	}

	if (isDictionaryFile(parsed)) {
		return parsed.entries;
	}

	throw new Error("Dictionary JSON must be an array or an object with an entries array.");
}

function isDictionaryFile(value: unknown): value is DictionaryFile {
	return typeof value === "object"
		&& value !== null
		&& "entries" in value
		&& Array.isArray(value.entries);
}

export async function extractU8TextFromZip(
	zipSource: ArrayBuffer | Uint8Array,
	sourceLabel = "zip archive",
): Promise<string> {
	const zipBytes = zipSource instanceof Uint8Array ? zipSource : new Uint8Array(zipSource);
	const zipView = new DataView(zipBytes.buffer, zipBytes.byteOffset, zipBytes.byteLength);
	const endOfCentralDirectoryOffset = findEndOfCentralDirectoryOffset(zipBytes, zipView);
	const totalEntries = zipView.getUint16(endOfCentralDirectoryOffset + 10, true);
	const centralDirectoryOffset = zipView.getUint32(endOfCentralDirectoryOffset + 16, true);

	if (totalEntries === ZIP64_FIELD_LIMIT || centralDirectoryOffset === ZIP64_OFFSET_LIMIT) {
		throw new Error(`Zip64 archives are not supported for ${sourceLabel}.`);
	}

	let offset = centralDirectoryOffset;
	const entries: ZipEntry[] = [];

	for (let index = 0; index < totalEntries; index += 1) {
		if (offset + 46 > zipBytes.byteLength) {
			throw new Error(`Central directory entry ${index + 1} in ${sourceLabel} is truncated.`);
		}

		const signature = zipView.getUint32(offset, true);
		if (signature !== ZIP_CENTRAL_DIRECTORY_HEADER_SIGNATURE) {
			throw new Error(`Invalid central directory entry ${index + 1} in ${sourceLabel}.`);
		}

		const generalPurposeBitFlag = zipView.getUint16(offset + 8, true);
		const compressionMethod = zipView.getUint16(offset + 10, true);
		const compressedSize = zipView.getUint32(offset + 20, true);
		const uncompressedSize = zipView.getUint32(offset + 24, true);
		const fileNameLength = zipView.getUint16(offset + 28, true);
		const extraFieldLength = zipView.getUint16(offset + 30, true);
		const fileCommentLength = zipView.getUint16(offset + 32, true);
		const localHeaderOffset = zipView.getUint32(offset + 42, true);
		const fileNameOffset = offset + 46;
		const fileNameEnd = fileNameOffset + fileNameLength;

		if (localHeaderOffset === ZIP64_OFFSET_LIMIT || compressedSize === ZIP64_OFFSET_LIMIT || uncompressedSize === ZIP64_OFFSET_LIMIT) {
			throw new Error(`Zip64 entries are not supported for ${sourceLabel}.`);
		}

		if (fileNameEnd > zipBytes.byteLength) {
			throw new Error(`Filename for entry ${index + 1} in ${sourceLabel} is truncated.`);
		}

		entries.push({
			compressionMethod,
			compressedSize,
			fileName: decodeZipText(
				zipBytes.subarray(fileNameOffset, fileNameEnd),
				(generalPurposeBitFlag & ZIP_UTF8_FLAG) !== 0,
			),
			localHeaderOffset,
			uncompressedSize,
		});

		offset = fileNameEnd + extraFieldLength + fileCommentLength;
	}

	const u8Entry = entries.find((entry) => !entry.fileName.endsWith("/") && entry.fileName.toLowerCase().endsWith(".u8"));
	if (!u8Entry) {
		throw new Error(`No .u8 file was found in ${sourceLabel}.`);
	}

	return decodeDictionaryText(await extractZipEntryData(zipBytes, zipView, u8Entry, sourceLabel));
}

export function findDictionaryMatches(
	entries: DictionaryEntry[],
	query: string,
	rankingDictionary: RankingDictionary = {},
): DictionaryEntry[] {
	const rawQuery = query.trim();
	const normalizedQuery = normalize(rawQuery);
	const queryRegexes = [
		{
			regex: createExactPinyinQueryRegex(rawQuery),
			searchableIndexes: [0],
			shouldMatchHanzi: false,
		},
		{
			regex: createWordSearchableQueryRegex(normalizedQuery),
			searchableIndexes: null,
			shouldMatchHanzi: false,
		},
		{
			regex: createSearchableQueryRegex(normalizedQuery),
			searchableIndexes: null,
			shouldMatchHanzi: true,
		},
	];

	if (rawQuery.length === 0) {
		return [];
	}

	const selectedHanzi = new Set<string>();
	const resultSets = queryRegexes.map(({ regex, searchableIndexes, shouldMatchHanzi }) =>
		getSortedDictionaryMatches(entries, rawQuery, regex, rankingDictionary, searchableIndexes, shouldMatchHanzi),
	);

	return resultSets.flatMap((matches) => {
		const selectedMatches = matches
			.filter((match) => !selectedHanzi.has(match.entry[0]))
			.slice(0, MAX_DICTIONARY_MATCHES_PER_QUERY);

		for (const match of selectedMatches) {
			selectedHanzi.add(match.entry[0]);
		}

		return selectedMatches.map((match) => match.entry);
	});
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

async function getDictionarySourceText(response: DictionarySourceResponse, sourceLabel: string): Promise<string> {
	const responseBytes = new Uint8Array(response.arrayBuffer);
	if (isZipArchive(responseBytes)) {
		return extractU8TextFromZip(responseBytes, sourceLabel);
	}

	return response.text;
}

async function downloadDictionarySource(url: string): Promise<DictionarySourceResponse> {
	const response = await requestUrl(url);

	return {
		arrayBuffer: response.arrayBuffer,
		status: response.status,
		text: response.text,
	};
}

function getSortedDictionaryMatches(
	entries: DictionaryEntry[],
	rawQuery: string,
	normalizedQueryRegex: RegExp | null,
	rankingDictionary: RankingDictionary,
	searchableIndexes: number[] | null,
	shouldMatchHanzi: boolean,
): DictionaryMatch[] {
	if (normalizedQueryRegex === null && !shouldMatchHanzi) {
		return [];
	}

	return entries
		.map((entry) => {
			const sortKey = getDictionaryMatchSortKey(
				entry,
				rawQuery,
				normalizedQueryRegex,
				rankingDictionary,
				searchableIndexes,
				shouldMatchHanzi,
			);
			return sortKey === null ? null : { entry, ...sortKey };
		})
		.filter((match): match is DictionaryMatch => match !== null)
		.sort(compareDictionaryMatches);
}

function compareDictionaryMatches(left: DictionaryMatch, right: DictionaryMatch): number {
	return left.ranking - right.ranking
		|| left.hanziLength - right.hanziLength
		|| left.secondaryLength - right.secondaryLength;
}

function getDictionaryMatchSortKey(
	[hanzi, searchables]: DictionaryEntry,
	rawQuery: string,
	normalizedQueryRegex: RegExp | null,
	rankingDictionary: RankingDictionary,
	searchableIndexes: number[] | null,
	shouldMatchHanzi: boolean,
): Omit<DictionaryMatch, "entry"> | null {
	const matchingSearchableLengths: number[] = [];

	const matchesHanzi = shouldMatchHanzi && hanzi.includes(rawQuery);

	if (normalizedQueryRegex !== null) {
		const selectedSearchables = searchableIndexes === null
			? searchables
			: searchableIndexes.flatMap((index) => searchables[index] === undefined ? [] : [searchables[index]]);

		for (const searchable of selectedSearchables) {
			if (normalizedQueryRegex.test(searchable)) {
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

function createExactPinyinQueryRegex(rawQuery: string): RegExp | null {
	const normalizedPinyinQuery = normalizePinyin(rawQuery);
	if (normalizedPinyinQuery.length === 0) {
		return null;
	}

	return new RegExp(`^${escapeRegex(normalizedPinyinQuery)}$`, "u");
}

function createWordSearchableQueryRegex(normalizedQuery: string): RegExp | null {
	const parts = normalizedQuery
		.split(/\s+/u)
		.filter((part) => part.length > 0);

	if (parts.length === 0) {
		return null;
	}

	const pattern = parts
		.map(escapeRegex)
		.join("[^\\p{L}]+");

	return new RegExp(`(?:^|[^\\p{L}])${pattern}(?:[^\\p{L}]|$)`, "u");
}

function createSearchableQueryRegex(normalizedQuery: string): RegExp | null {
	if (normalizedQuery.length === 0) {
		return null;
	}

	const pattern = normalizedQuery
		.split(/\s+/u)
		.map(escapeRegex)
		.join(".*");

	return new RegExp(pattern, "u");
}

function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function stripSearchableExampleSuffix(value: string): string {
	const exampleMatch = /[:;]\s*Bsp\.:/u.exec(value);
	return exampleMatch?.index === undefined ? value : value.slice(0, exampleMatch.index);
}

function isZipArchive(bytes: Uint8Array): boolean {
	return bytes.byteLength >= 4
		&& bytes[0] === 0x50
		&& bytes[1] === 0x4b
		&& bytes[2] === 0x03
		&& bytes[3] === 0x04;
}

function findEndOfCentralDirectoryOffset(bytes: Uint8Array, zipView: DataView): number {
	const minimumEndOfCentralDirectoryLength = 22;
	const maximumCommentLength = 0xffff;
	const minimumOffset = Math.max(0, bytes.byteLength - minimumEndOfCentralDirectoryLength - maximumCommentLength);

	for (let offset = bytes.byteLength - minimumEndOfCentralDirectoryLength; offset >= minimumOffset; offset -= 1) {
		if (zipView.getUint32(offset, true) === ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
			return offset;
		}
	}

	throw new Error("Zip archive is missing an end-of-central-directory record.");
}

function decodeZipText(bytes: Uint8Array, _isUtf8: boolean): string {
	return new TextDecoder("utf-8").decode(bytes);
}

function decodeDictionaryText(bytes: Uint8Array): string {
	return new TextDecoder("utf-8").decode(bytes).replace(/^\uFEFF/u, "");
}

async function extractZipEntryData(
	zipBytes: Uint8Array,
	zipView: DataView,
	entry: ZipEntry,
	sourceLabel: string,
): Promise<Uint8Array> {
	if (entry.localHeaderOffset + 30 > zipBytes.byteLength) {
		throw new Error(`Local file header for ${entry.fileName} in ${sourceLabel} is truncated.`);
	}

	if (zipView.getUint32(entry.localHeaderOffset, true) !== ZIP_LOCAL_FILE_HEADER_SIGNATURE) {
		throw new Error(`Invalid local file header for ${entry.fileName} in ${sourceLabel}.`);
	}

	const generalPurposeBitFlag = zipView.getUint16(entry.localHeaderOffset + 6, true);
	if ((generalPurposeBitFlag & ZIP_ENCRYPTED_FLAG) !== 0) {
		throw new Error(`Encrypted zip entries are not supported (${entry.fileName}).`);
	}

	const fileNameLength = zipView.getUint16(entry.localHeaderOffset + 26, true);
	const extraFieldLength = zipView.getUint16(entry.localHeaderOffset + 28, true);
	const dataOffset = entry.localHeaderOffset + 30 + fileNameLength + extraFieldLength;
	const dataEnd = dataOffset + entry.compressedSize;

	if ((generalPurposeBitFlag & ZIP_DATA_DESCRIPTOR_FLAG) !== 0 && entry.compressedSize === 0) {
		throw new Error(`Zip data descriptors without central-directory sizes are not supported (${entry.fileName}).`);
	}

	if (dataEnd > zipBytes.byteLength) {
		throw new Error(`Compressed data for ${entry.fileName} in ${sourceLabel} is truncated.`);
	}

	const compressedData = zipBytes.subarray(dataOffset, dataEnd);
	let extractedData: Uint8Array;

	switch (entry.compressionMethod) {
		case ZIP_STORED_COMPRESSION_METHOD:
			extractedData = compressedData;
			break;
		case ZIP_DEFLATE_COMPRESSION_METHOD:
			extractedData = await inflateRaw(compressedData);
			break;
		default:
			throw new Error(`Unsupported zip compression method ${entry.compressionMethod} for ${entry.fileName}.`);
	}

	if (extractedData.byteLength !== entry.uncompressedSize) {
		throw new Error(`Unexpected uncompressed size for ${entry.fileName} in ${sourceLabel}.`);
	}

	return extractedData;
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
	if (typeof DecompressionStream !== "function") {
		throw new Error("Zip decompression is not available in this environment.");
	}

	const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
	return new Uint8Array(await new Response(stream).arrayBuffer());
}
