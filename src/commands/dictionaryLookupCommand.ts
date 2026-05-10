import { Notice } from "obsidian";
import { findDictionaryMatches } from "../dictionary";
import { getLookupText } from "../editor/lookupText";
import type MandarinHelperPlugin from "../main";
import type { MandarinHelperDisplayOptions } from "../settings";
import { DictionaryLookupModal } from "../ui/dictionaryLookupModal";

export function registerDictionaryLookupCommand(plugin: MandarinHelperPlugin): void {
	plugin.addCommand({
		id: "dictionary-lookup",
		name: "Dictionary lookup",
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

	const matches = findDictionaryMatches(plugin.dictionary, selection, plugin.ranking);
	const displayOptions: MandarinHelperDisplayOptions = {
		displayPinyin: true,
		colorizePinyin: plugin.settings.colorizeByTone,
		colorizeHanzi: plugin.settings.colorizeByTone,
	};
	new DictionaryLookupModal(plugin.app, selection, matches, displayOptions).open();
}
