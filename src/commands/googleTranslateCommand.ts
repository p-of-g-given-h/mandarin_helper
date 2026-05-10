import { Notice } from "obsidian";
import { getLookupText } from "../editor/lookupText";
import type MandarinHelperPlugin from "../main";

const GOOGLE_TRANSLATE_POPUP_FEATURES = "popup=yes,width=1000,height=720";

export function registerGoogleTranslateCommand(plugin: MandarinHelperPlugin): void {
	plugin.addCommand({
		id: "google-translate-to-simplified-chinese",
		name: "Translate to mandarin",
		icon: "book-type",
		checkCallback: (checking) => {
			const lookupText = getLookupText(plugin);

			if (lookupText.length === 0) {
				return false;
			}

			if (!checking) {
				openGoogleTranslate(lookupText);
			}

			return true;
		},
	});
}

export function triggerGoogleTranslate(plugin: MandarinHelperPlugin): void {
	const lookupText = getLookupText(plugin);

	if (lookupText.length === 0) {
		new Notice("Select text or place the cursor on a line to translate.");
		return;
	}

	openGoogleTranslate(lookupText);
}

function openGoogleTranslate(lookupText: string): void {
	const popup = window.open(buildGoogleTranslateUrl(lookupText), "mandarin-helper-google-translate", GOOGLE_TRANSLATE_POPUP_FEATURES);

	if (!popup) {
		new Notice("Could not open google translate popup.");
		return;
	}

	popup.opener = null;
	popup.focus();
}

function buildGoogleTranslateUrl(lookupText: string): string {
	const url = new URL("https://translate.google.com/");
	url.searchParams.set("sl", "auto");
	url.searchParams.set("tl", "zh-CN");
	url.searchParams.set("text", lookupText);
	url.searchParams.set("op", "translate");
	return url.toString();
}
