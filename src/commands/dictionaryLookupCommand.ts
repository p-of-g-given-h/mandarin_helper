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
			const selection = getSelectedText(plugin);

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
