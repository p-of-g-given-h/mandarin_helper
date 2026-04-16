import { App, Modal } from "obsidian";
import type { DictionaryEntry } from "../dictionary";

export class DictionaryLookupModal extends Modal {
	constructor(
		app: App,
		private readonly query: string,
		private readonly matches: DictionaryEntry[],
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl, modalEl, titleEl } = this;
		titleEl.setText(`Dictionary lookup: ${this.query}`);
		modalEl.addClass("mandarin-helper-dictionary-modal");
		contentEl.empty();

		const summaryEl = contentEl.createDiv({ cls: "mandarin-helper-dictionary-summary" });
		summaryEl.setText(`${this.matches.length} matches`);

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
			rowEl.createSpan({
				cls: "mandarin-helper-dictionary-segment mandarin-helper-dictionary-hanzi-segment",
				text: hanzi,
			});

			for (const translation of translations) {
				rowEl.createSpan({
					cls: "mandarin-helper-dictionary-segment mandarin-helper-dictionary-translation-segment",
					text: translation,
				});
			}
		}
	}
}
