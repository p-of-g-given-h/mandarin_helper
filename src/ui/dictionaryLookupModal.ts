import { App, Modal } from "obsidian";
import { getHanziCharacterAnnotations, getPinyinLabel, type ToneNumber } from "../hanzi/annotation";
import type { DictionaryEntry } from "../dictionary";
import type { MandarinHelperDisplayOptions } from "../settings";

export class DictionaryLookupModal extends Modal {
	constructor(
		app: App,
		private readonly query: string,
		private readonly matches: DictionaryEntry[],
		private readonly displayOptions: MandarinHelperDisplayOptions,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl, modalEl, titleEl } = this;
		titleEl.setText(`Dictionary lookup: ${this.query}`);
		modalEl.addClass("mandarin-helper-dictionary-modal");
		contentEl.empty();

		const resultsEl = contentEl.createDiv({ cls: "mandarin-helper-dictionary-results" });

		if (this.matches.length === 0) {
			resultsEl.createDiv({
				cls: "mandarin-helper-dictionary-empty",
				text: "No matching dictionary entries found.",
			});
			return;
		}

		for (const [hanzi, , translations] of this.matches) {
			const rowEl = resultsEl.createDiv({ cls: "mandarin-helper-dictionary-row" });
			rowEl.append(createHanziSegment(hanzi, rowEl.ownerDocument, this.displayOptions));
			rowEl.append(createPinyinSegment(hanzi, rowEl.ownerDocument, this.displayOptions));

			for (const translation of translations) {
				rowEl.createSpan({
					cls: "mandarin-helper-dictionary-segment mandarin-helper-dictionary-translation-segment",
					text: translation,
				});
			}
		}
	}
}

function createHanziSegment(
	hanzi: string,
	document: Document,
	options: MandarinHelperDisplayOptions,
): HTMLElement {
	const segment = document.createElement("span");
	segment.className = "mandarin-helper-dictionary-segment mandarin-helper-dictionary-hanzi-segment";

	const annotations = getHanziCharacterAnnotations(hanzi);
	if (annotations === null) {
		segment.textContent = hanzi;
		return segment;
	}

	for (const annotation of annotations) {
		segment.append(createToneAwareSpan(annotation.character, annotation.tone, document, "mandarin-helper-hanzi", options.colorizeHanzi));
	}

	return segment;
}

function createPinyinSegment(
	hanzi: string,
	document: Document,
	options: MandarinHelperDisplayOptions,
): HTMLElement {
	const segment = document.createElement("span");
	segment.className = "mandarin-helper-dictionary-segment mandarin-helper-dictionary-pinyin-segment";

	const annotations = getHanziCharacterAnnotations(hanzi);
	if (annotations === null) {
		const fallback = document.createElement("span");
		fallback.className = "mandarin-helper-pinyin";
		fallback.textContent = getPinyinLabel(hanzi);
		segment.append(fallback);
		return segment;
	}

	for (const [index, annotation] of annotations.entries()) {
		if (index > 0) {
			segment.append(document.createTextNode(" "));
		}

		segment.append(createToneAwareSpan(annotation.syllable, annotation.tone, document, "mandarin-helper-pinyin", options.colorizePinyin));
	}

	return segment;
}

function createToneAwareSpan(
	text: string,
	tone: ToneNumber,
	document: Document,
	baseClassName: string,
	shouldColorize: boolean,
): HTMLElement {
	const span = document.createElement("span");
	span.className = shouldColorize ? `${baseClassName} ${getToneColorClass(baseClassName)}` : baseClassName;
	span.dataset.tone = String(tone);
	span.textContent = text;
	return span;
}

function getToneColorClass(baseClassName: string): string {
	return baseClassName === "mandarin-helper-pinyin" ? "mandarin-helper-colorize-pinyin" : "mandarin-helper-colorize-hanzi";
}
