import { Plugin } from "obsidian";
import { pinyin } from "pinyin-pro";

const HAS_HANZI_PATTERN = /\p{Script=Han}/u;
const HANZI_RUN_PATTERN = /\p{Script=Han}+/gu;
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

export function registerHanziRubyPostProcessor(plugin: Plugin): void {
	plugin.registerMarkdownPostProcessor((element) => {
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
			if (parent === null || !HAS_HANZI_PATTERN.test(text) || shouldSkipNode(parent)) {
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
	if (!HAS_HANZI_PATTERN.test(text)) {
		return null;
	}

	const fragment = document.createDocumentFragment();
	let lastIndex = 0;
	HANZI_RUN_PATTERN.lastIndex = 0;
	let match = HANZI_RUN_PATTERN.exec(text);

	while (match !== null) {
		const startIndex = match.index;
		const hanziRun = match[0];

		if (startIndex > lastIndex) {
			fragment.append(text.slice(lastIndex, startIndex));
		}

		fragment.append(createRubyNode(hanziRun, document));
		lastIndex = startIndex + hanziRun.length;
		match = HANZI_RUN_PATTERN.exec(text);
	}

	HANZI_RUN_PATTERN.lastIndex = 0;

	if (lastIndex < text.length) {
		fragment.append(text.slice(lastIndex));
	}

	return fragment;
}

function createRubyNode(hanziRun: string, document: Document): HTMLElement {
	const ruby = document.createElement("ruby");
	ruby.className = "mandarin-helper-ruby";

	const syllables = pinyin(hanziRun, { type: "array", toneType: "symbol" });
	const characters = Array.from(hanziRun);

	if (!Array.isArray(syllables) || syllables.length !== characters.length) {
		ruby.textContent = hanziRun;

		const annotation = document.createElement("rt");
		annotation.textContent = Array.isArray(syllables) ? syllables.join(" ") : String(syllables);
		ruby.append(annotation);

		return ruby;
	}

	for (const [index, character] of characters.entries()) {
		ruby.append(character);

		const annotation = document.createElement("rt");
		annotation.textContent = syllables[index];
		ruby.append(annotation);
	}

	return ruby;
}
