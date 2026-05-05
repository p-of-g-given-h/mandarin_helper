import { pinyin } from "pinyin-pro";

const MAX_PINYIN_CACHE_ENTRIES = 10000;

type CachedPinyinValue = string | string[];
type PinyinCacheMode = "plain" | "symbol-array";

const pinyinCache = new Map<string, CachedPinyinValue>();

export function getPlainPinyin(hanzi: string): string {
	return getCachedPinyin("plain", hanzi, () => pinyin(hanzi, { toneType: "none" })) as string;
}

export function getSymbolPinyinArray(hanzi: string): string | string[] {
	return getCachedPinyin(
		"symbol-array",
		hanzi,
		() => pinyin(hanzi, { type: "array", toneType: "symbol" }) as string | string[],
	);
}

function getCachedPinyin(mode: PinyinCacheMode, hanzi: string, createValue: () => CachedPinyinValue): CachedPinyinValue {
	const cacheKey = `${mode}\u0000${hanzi}`;
	const cachedValue = pinyinCache.get(cacheKey);

	if (cachedValue !== undefined) {
		pinyinCache.delete(cacheKey);
		pinyinCache.set(cacheKey, cachedValue);
		return cachedValue;
	}

	const value = createValue();
	if (pinyinCache.size >= MAX_PINYIN_CACHE_ENTRIES) {
		const oldestKey = pinyinCache.keys().next();
		if (!oldestKey.done) {
			pinyinCache.delete(oldestKey.value);
		}
	}

	pinyinCache.set(cacheKey, value);
	return value;
}
