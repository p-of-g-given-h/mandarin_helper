import { getSymbolPinyinArray } from "./pinyinCache";

const HANZI_CHARACTER_PATTERN = /\p{Script=Han}/u;
const HANZI_RUN_PATTERN = /\p{Script=Han}+/gu;

export type ToneNumber = 1 | 2 | 3 | 4 | 5;

const TONE_MARK_TO_TONE = new Map<string, ToneNumber>([
	["\u0101", 1],
	["\u0113", 1],
	["\u012b", 1],
	["\u014d", 1],
	["\u016b", 1],
	["\u01d6", 1],
	["\u0100", 1],
	["\u0112", 1],
	["\u012a", 1],
	["\u014c", 1],
	["\u016a", 1],
	["\u01d5", 1],
	["\u00e1", 2],
	["\u00e9", 2],
	["\u00ed", 2],
	["\u00f3", 2],
	["\u00fa", 2],
	["\u01d8", 2],
	["\u0144", 2],
	["\u1e3f", 2],
	["\u00c1", 2],
	["\u00c9", 2],
	["\u00cd", 2],
	["\u00d3", 2],
	["\u00da", 2],
	["\u01d7", 2],
	["\u0143", 2],
	["\u01ce", 3],
	["\u011b", 3],
	["\u01d0", 3],
	["\u01d2", 3],
	["\u01d4", 3],
	["\u01da", 3],
	["\u0148", 3],
	["\u01cd", 3],
	["\u011a", 3],
	["\u01cf", 3],
	["\u01d1", 3],
	["\u01d3", 3],
	["\u01d9", 3],
	["\u0147", 3],
	["\u00e0", 4],
	["\u00e8", 4],
	["\u00ec", 4],
	["\u00f2", 4],
	["\u00f9", 4],
	["\u01dc", 4],
	["\u01f9", 4],
	["\u00c0", 4],
	["\u00c8", 4],
	["\u00cc", 4],
	["\u00d2", 4],
	["\u00d9", 4],
	["\u01db", 4],
	["\u01f8", 4],
]);

export interface HanziRunMatch {
	startIndex: number;
	value: string;
}

export interface HanziCharacterAnnotation {
	character: string;
	syllable: string;
	tone: ToneNumber;
}

export function containsHanzi(text: string): boolean {
	return HANZI_CHARACTER_PATTERN.test(text);
}

export function getHanziRuns(text: string): HanziRunMatch[] {
	const matches: HanziRunMatch[] = [];
	const matcher = new RegExp(HANZI_RUN_PATTERN);
	let match = matcher.exec(text);

	while (match !== null) {
		matches.push({
			startIndex: match.index,
			value: match[0],
		});
		match = matcher.exec(text);
	}

	return matches;
}

export function getHanziCharacterAnnotations(hanziRun: string): HanziCharacterAnnotation[] | null {
	const syllables = getSymbolPinyinArray(hanziRun);
	const characters = Array.from(hanziRun);

	if (!Array.isArray(syllables) || syllables.length !== characters.length) {
		return null;
	}

	return characters.map((character, index) => ({
		character,
		syllable: syllables[index] ?? "",
		tone: getToneNumber(syllables[index] ?? ""),
	}));
}

export function getPinyinLabel(hanziRun: string): string {
	const syllables = getSymbolPinyinArray(hanziRun);
	return Array.isArray(syllables) ? syllables.join(" ") : String(syllables);
}

export function getToneNumber(syllable: string): ToneNumber {
	for (const character of syllable.normalize("NFC")) {
		const tone = TONE_MARK_TO_TONE.get(character);
		if (tone !== undefined) {
			return tone;
		}
	}

	return 5;
}
