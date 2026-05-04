import { App, MarkdownView, Modal, Notice, Platform } from "obsidian";
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

		contentEl.createDiv({
			cls: "mandarin-helper-dictionary-copy-note",
			text: Platform.isMobile ? "Tap to insert at the cursor" : "Click to copy. Shift-click to insert at the cursor.",
		});

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
			rowEl.append(createHanziSegment(hanzi, rowEl.ownerDocument, this.displayOptions, this));
			rowEl.append(createPinyinSegment(hanzi, rowEl.ownerDocument, this.displayOptions, this));

			for (const translation of translations) {
				const translationSegment = rowEl.createSpan({
					cls: "mandarin-helper-dictionary-segment mandarin-helper-dictionary-translation-segment",
					text: translation,
				});
				makeSegmentClickable(translationSegment, this);
			}
		}
	}
}

function createHanziSegment(
	hanzi: string,
	document: Document,
	options: MandarinHelperDisplayOptions,
	modal: DictionaryLookupModal,
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

	makeSegmentClickable(segment, modal);
	return segment;
}

function createPinyinSegment(
	hanzi: string,
	document: Document,
	options: MandarinHelperDisplayOptions,
	modal: DictionaryLookupModal,
): HTMLElement {
	const segment = document.createElement("span");
	segment.className = "mandarin-helper-dictionary-segment mandarin-helper-dictionary-pinyin-segment";

	const annotations = getHanziCharacterAnnotations(hanzi);
	if (annotations === null) {
		const fallback = document.createElement("span");
		fallback.className = "mandarin-helper-pinyin";
		fallback.textContent = getPinyinLabel(hanzi);
		segment.append(fallback);
		makeSegmentClickable(segment, modal);
		return segment;
	}

	for (const [index, annotation] of annotations.entries()) {
		if (index > 0) {
			segment.append(document.createTextNode(" "));
		}

		segment.append(createToneAwareSpan(annotation.syllable, annotation.tone, document, "mandarin-helper-pinyin", options.colorizePinyin));
	}

	makeSegmentClickable(segment, modal);
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

function makeSegmentClickable(segment: HTMLElement, modal: DictionaryLookupModal): void {
	segment.addClass("mandarin-helper-dictionary-segment-clickable");
	segment.tabIndex = 0;
	segment.setAttribute("role", "button");

	segment.addEventListener("click", (event) => {
		void handleSegmentAction(segment, modal, shouldInsertSegment(event));
	});

	segment.addEventListener("keydown", (event) => {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			void handleSegmentAction(segment, modal, shouldInsertSegment(event));
		}
	});
}

function shouldInsertSegment(event: MouseEvent | KeyboardEvent): boolean {
	return Platform.isMobile || event.shiftKey;
}

async function handleSegmentAction(segment: HTMLElement, modal: DictionaryLookupModal, shouldInsert: boolean): Promise<void> {
	if (shouldInsert) {
		insertSegmentContent(segment, modal);
		return;
	}

	await copySegmentContent(segment, modal);
}

function insertSegmentContent(segment: HTMLElement, modal: DictionaryLookupModal): void {
	const text = segment.textContent?.trim() ?? "";

	if (text.length === 0) {
		return;
	}

	const editor = modal.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
	if (!editor) {
		new Notice("No active editor to insert into.");
		return;
	}

	const insertionStart = editor.getCursor("to");
	editor.replaceRange(text, insertionStart);
	editor.setCursor({
		line: insertionStart.line,
		ch: insertionStart.ch + text.length,
	});
	modal.close();
	new Notice(`Inserted: ${text}`);
}

async function copySegmentContent(segment: HTMLElement, modal: DictionaryLookupModal): Promise<void> {
	const text = segment.textContent?.trim() ?? "";

	if (text.length === 0) {
		return;
	}

	try {
		await navigator.clipboard.writeText(text);
		modal.close();
		new Notice(`Copied to clipboard: ${text}`);
	} catch (error) {
		console.error("Mandarin Helper: failed to copy dictionary segment", error);
		new Notice("Failed to copy to clipboard.");
	}
}
