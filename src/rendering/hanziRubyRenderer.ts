import { Plugin } from "obsidian";
import { containsHanzi, getHanziRuns, getPinyinLabel, getPinyinSyllables } from "../hanzi/annotation";

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

export function registerHanziRubyPostProcessor(plugin: Plugin, shouldDisplayPinyin: () => boolean): void {
	plugin.registerMarkdownPostProcessor((element) => {
		if (!shouldDisplayPinyin()) {
			return;
		}

		const textNodes = collectHanziTextNodes(element);

		for (const textNode of textNodes) {
			const replacement = buildAnnotatedFragment(textNode.textContent ?? "", element.ownerDocument);
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
	if (element.closest(".mandarin-helper-ruby") !== null) {
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

function buildAnnotatedFragment(text: string, document: Document): DocumentFragment | null {
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

		fragment.append(createRubyNode(hanziRun.value, document));
		lastIndex = startIndex + hanziRun.value.length;
	}

	if (lastIndex < text.length) {
		fragment.append(text.slice(lastIndex));
	}

	return fragment;
}

function createRubyNode(hanziRun: string, document: Document): HTMLElement {
	const ruby = document.createElement("ruby");
	ruby.className = "mandarin-helper-ruby";

	const syllables = getPinyinSyllables(hanziRun);
	const characters = Array.from(hanziRun);

	if (syllables === null) {
		ruby.textContent = hanziRun;

		const annotation = document.createElement("rt");
		annotation.textContent = getPinyinLabel(hanziRun);
		ruby.append(annotation);

		return ruby;
	}

	for (const [index, character] of characters.entries()) {
		ruby.append(character);

		const annotation = document.createElement("rt");
		annotation.textContent = syllables[index] ?? "";
		ruby.append(annotation);
	}

	return ruby;
}
