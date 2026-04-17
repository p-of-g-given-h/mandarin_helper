import { MarkdownView, Notice } from "obsidian";
import { findDictionaryMatches } from "../dictionary";
import type MandarinHelperPlugin from "../main";
import type { MandarinHelperDisplayOptions } from "../settings";
import { DictionaryLookupModal } from "../ui/dictionaryLookupModal";

export function registerDictionaryLookupCommand(plugin: MandarinHelperPlugin): void {
	plugin.addCommand({
		id: "dictionary-lookup",
		name: "Dictionary Lookup",
		hotkeys: [
			{
				modifiers: ["Ctrl", "Shift"],
				key: "D",
			},
		],
		checkCallback: (checking) => {
			const selection = getLookupText(plugin);

			if (selection.length === 0) {
				return false;
			}

			if (!checking) {
				openDictionaryLookup(plugin, selection);
			}

			return true;
		},
	});
}

export function triggerDictionaryLookup(plugin: MandarinHelperPlugin): void {
	const selection = getLookupText(plugin);

	if (selection.length === 0) {
		new Notice("Select text or place the cursor on a line to look it up in the dictionary.");
		return;
	}

	openDictionaryLookup(plugin, selection);
}

function openDictionaryLookup(plugin: MandarinHelperPlugin, selection: string): void {
	if (plugin.dictionary.length === 0) {
		new Notice("No dictionary is loaded.");
		return;
	}

	const matches = findDictionaryMatches(plugin.dictionary, selection);
	const displayOptions: MandarinHelperDisplayOptions = {
		displayPinyin: true,
		colorizePinyin: plugin.settings.colorizeByTone,
		colorizeHanzi: plugin.settings.colorizeByTone,
	};
	new DictionaryLookupModal(plugin.app, selection, matches, displayOptions).open();
}

function getSelectedText(plugin: MandarinHelperPlugin): string {
	const activeMarkdownView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
	const editorSelection = activeMarkdownView?.editor.getSelection().trim();

	if (editorSelection && editorSelection.length > 0) {
		return editorSelection;
	}

	return window.getSelection()?.toString().trim() ?? "";
}

function getLookupText(plugin: MandarinHelperPlugin): string {
	const selectedText = getSelectedText(plugin);
	if (selectedText.length > 0) {
		return selectedText;
	}

	return getCurrentLineLookupText(plugin);
}

function getCurrentLineLookupText(plugin: MandarinHelperPlugin): string {
	const activeMarkdownView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
	const editor = activeMarkdownView?.editor;

	if (!editor) {
		return "";
	}

	const currentLine = editor.getLine(editor.getCursor().line);
	return stripMarkdownForLookup(currentLine);
}

function stripMarkdownForLookup(value: string): string {
	return value
		.replace(/!\[([^\]]*)\]\([^)]+\)/gu, "$1")
		.replace(/\[([^\]]+)\]\([^)]+\)/gu, "$1")
		.replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/gu, "$2")
		.replace(/\[\[([^\]]+)\]\]/gu, "$1")
		.replace(/^\s{0,3}(?:>\s*)+/gu, "")
		.replace(/^\s{0,3}(?:[-*+]|\d+\.)\s+\[(?: |x|X)\]\s+/gu, "")
		.replace(/^\s{0,3}(?:[-*+]|\d+\.)\s+/gu, "")
		.replace(/^\s{0,3}#{1,6}\s+/gu, "")
		.replace(/[`*_~>#]/gu, "")
		.replace(/[\[\]()!]/gu, "")
		.replace(/\s+/gu, " ")
		.trim();
}
