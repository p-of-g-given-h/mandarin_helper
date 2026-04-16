import { pinyin } from "pinyin-pro";

const HANZI_CHARACTER_PATTERN = /\p{Script=Han}/u;
const HANZI_RUN_PATTERN = /\p{Script=Han}+/gu;

export interface HanziRunMatch {
	startIndex: number;
	value: string;
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

export function getPinyinSyllables(hanziRun: string): string[] | null {
	const syllables = pinyin(hanziRun, { type: "array", toneType: "symbol" });
	const characters = Array.from(hanziRun);

	if (!Array.isArray(syllables) || syllables.length !== characters.length) {
		return null;
	}

	return syllables;
}

export function getPinyinLabel(hanziRun: string): string {
	const syllables = pinyin(hanziRun, { type: "array", toneType: "symbol" });
	return Array.isArray(syllables) ? syllables.join(" ") : String(syllables);
}
