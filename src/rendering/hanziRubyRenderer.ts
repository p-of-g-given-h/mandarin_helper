import { Plugin } from "obsidian";
import { containsHanzi, getHanziCharacterAnnotations, getHanziRuns, getPinyinLabel, type ToneNumber } from "../hanzi/annotation";
import type { MandarinHelperDisplayOptions } from "../settings";

const SKIPPED_TAGS = new Set([
	"CODE",
	"PRE",
	"RUBY",
	"RT",
	"RP",
	"SCRIPT",
	"STYLE",
	"TEXTAREA",
	"INPUT",
	"KBD",
	"SAMP",
]);

export function registerHanziRubyPostProcessor(plugin: Plugin, getDisplayOptions: () => MandarinHelperDisplayOptions): void {
	plugin.registerMarkdownPostProcessor((element) => {
		const options = getDisplayOptions();
		if (!options.displayPinyin && !options.colorizeHanzi) {
			return;
		}

		const textNodes = collectHanziTextNodes(element);

		for (const textNode of textNodes) {
			const replacement = buildAnnotatedFragment(textNode.textContent ?? "", element.ownerDocument, options);
			if (replacement !== null) {
				textNode.replaceWith(replacement);
			}
		}
	});
}

function collectHanziTextNodes(root: HTMLElement): Text[] {
	const view = root.ownerDocument.defaultView;
	if (view === null) {
		return [];
	}

	const walker = root.ownerDocument.createTreeWalker(root, view.NodeFilter.SHOW_TEXT, {
		acceptNode(node) {
			if (!(node instanceof Text)) {
				return view.NodeFilter.FILTER_REJECT;
			}

			const parent = node.parentElement;
			const text = node.textContent ?? "";
			if (parent === null || !containsHanzi(text) || shouldSkipNode(parent)) {
				return view.NodeFilter.FILTER_REJECT;
			}

			return view.NodeFilter.FILTER_ACCEPT;
		},
	});

	const textNodes: Text[] = [];
	let currentNode = walker.nextNode();
	while (currentNode !== null) {
		if (currentNode instanceof Text) {
			textNodes.push(currentNode);
		}
		currentNode = walker.nextNode();
	}

	return textNodes;
}

function shouldSkipNode(element: HTMLElement): boolean {
	if (element.closest(".mandarin-helper-ruby, .mandarin-helper-hanzi") !== null) {
		return true;
	}

	let current: HTMLElement | null = element;
	while (current !== null) {
		if (SKIPPED_TAGS.has(current.tagName)) {
			return true;
		}

		current = current.parentElement;
	}

	return false;
}

function buildAnnotatedFragment(text: string, document: Document, options: MandarinHelperDisplayOptions): DocumentFragment | null {
	if (!containsHanzi(text)) {
		return null;
	}

	const fragment = document.createDocumentFragment();
	let lastIndex = 0;
	for (const hanziRun of getHanziRuns(text)) {
		const startIndex = hanziRun.startIndex;

		if (startIndex > lastIndex) {
			fragment.append(text.slice(lastIndex, startIndex));
		}

		fragment.append(createAnnotatedNode(hanziRun.value, document, options));
		lastIndex = startIndex + hanziRun.value.length;
	}

	if (lastIndex < text.length) {
		fragment.append(text.slice(lastIndex));
	}

	return fragment;
}

function createAnnotatedNode(hanziRun: string, document: Document, options: MandarinHelperDisplayOptions): Node {
	const annotations = getHanziCharacterAnnotations(hanziRun);
	if (options.displayPinyin) {
		return createRubyNode(hanziRun, annotations, document, options);
	}

	if (annotations === null) {
		return document.createTextNode(hanziRun);
	}

	const fragment = document.createDocumentFragment();
	for (const annotation of annotations) {
		fragment.append(createHanziNode(annotation.character, annotation.tone, document, options.colorizeHanzi));
	}

	return fragment;
}

function createRubyNode(
	hanziRun: string,
	annotations: ReturnType<typeof getHanziCharacterAnnotations>,
	document: Document,
	options: MandarinHelperDisplayOptions,
): HTMLElement {
	const ruby = document.createElement("ruby");
	ruby.className = "mandarin-helper-ruby";

	if (annotations === null) {
		ruby.textContent = hanziRun;

		const annotation = document.createElement("rt");
		annotation.className = options.colorizePinyin ? "mandarin-helper-pinyin mandarin-helper-colorize-pinyin" : "mandarin-helper-pinyin";
		annotation.textContent = getPinyinLabel(hanziRun);
		ruby.append(annotation);

		return ruby;
	}

	for (const annotation of annotations) {
		ruby.append(createHanziNode(annotation.character, annotation.tone, document, options.colorizeHanzi));

		const rubyText = document.createElement("rt");
		rubyText.className = options.colorizePinyin ? "mandarin-helper-pinyin mandarin-helper-colorize-pinyin" : "mandarin-helper-pinyin";
		rubyText.dataset.tone = String(annotation.tone);
		rubyText.textContent = annotation.syllable;
		ruby.append(rubyText);
	}

	return ruby;
}

function createHanziNode(character: string, tone: ToneNumber, document: Document, shouldColorize: boolean): HTMLElement {
	const hanzi = document.createElement("span");
	hanzi.className = shouldColorize ? "mandarin-helper-hanzi mandarin-helper-colorize-hanzi" : "mandarin-helper-hanzi";
	hanzi.dataset.tone = String(tone);
	hanzi.textContent = character;
	return hanzi;
}
