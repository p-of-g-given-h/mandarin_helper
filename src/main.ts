import type { Extension } from "@codemirror/state";
import { MarkdownView, Notice, Plugin, normalizePath } from "obsidian";
import { registerDictionaryLookupCommand, triggerDictionaryLookup } from "./commands/dictionaryLookupCommand";
import { make_dictionary, type DictionaryEntry, type RankingDictionary } from "./dictionary";
import { createHanziEditorDecorationsExtension } from "./editor/hanziEditorDecorations";
import { registerHanziRubyPostProcessor } from "./rendering/hanziRubyRenderer";
import {
	DEFAULT_SETTINGS,
	type FontIncreasePercent,
	type MandarinHelperDisplayOptions,
	type MandarinHelperSettings,
	MandarinHelperSettingTab,
} from "./settings";

interface LegacyMandarinHelperSettings extends Partial<MandarinHelperSettings> {
	colorizePinyin?: boolean;
	colorizeHanzi?: boolean;
}

export default class MandarinHelperPlugin extends Plugin {
	settings: MandarinHelperSettings;
	dictionary: DictionaryEntry[] = [];
	ranking: RankingDictionary = {};
	private readonly editorExtensions: Extension[] = [];

	async onload() {
		await this.loadSettings();
		await this.loadDictionary();
		await this.loadRanking();

		this.applyToneColors();
		this.applyFontScale();
		this.syncEditorExtensions();
		this.registerEditorExtension(this.editorExtensions);
		registerDictionaryLookupCommand(this);
		this.addRibbonIcon("book-a", "Dictionary lookup", () => {
			triggerDictionaryLookup(this);
		});
		this.addSettingTab(new MandarinHelperSettingTab(this.app, this));
		registerHanziRubyPostProcessor(this, () => this.getDisplayOptions());
	}

	onunload() {
		this.clearFontScale();
		this.clearToneColors();
	}

	async updateSettings(settingsPatch: Partial<MandarinHelperSettings>): Promise<void> {
		this.settings = {
			...this.settings,
			...settingsPatch,
		};
		await this.saveSettings();
		this.applyToneColors();
		this.applyFontScale();
		this.syncEditorExtensions();
		this.app.workspace.updateOptions();
		this.rerenderMarkdownViews();
	}

	private syncEditorExtensions(): void {
		this.editorExtensions.length = 0;

		if (this.isPinyinDisplayed() || this.isHanziColorizationEnabled()) {
			this.editorExtensions.push(createHanziEditorDecorationsExtension(this.getDisplayOptions()));
		}
	}

	private rerenderMarkdownViews(): void {
		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			const view = leaf.view;
			if (view instanceof MarkdownView) {
				view.previewMode.rerender(true);
			}
		}
	}

	private async loadSettings(): Promise<void> {
		const rawSettings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as LegacyMandarinHelperSettings);
		const migratedColorizeByTone =
			rawSettings.colorizeByTone ?? rawSettings.colorizePinyin ?? rawSettings.colorizeHanzi ?? DEFAULT_SETTINGS.colorizeByTone;

		this.settings = {
			displayPinyin: rawSettings.displayPinyin ?? DEFAULT_SETTINGS.displayPinyin,
			colorizeByTone: migratedColorizeByTone,
			dictionarySource: rawSettings.dictionarySource ?? DEFAULT_SETTINGS.dictionarySource,
			fontIncreasePercent: this.normalizeFontIncreasePercent(rawSettings.fontIncreasePercent),
			tone1Color: rawSettings.tone1Color ?? DEFAULT_SETTINGS.tone1Color,
			tone2Color: rawSettings.tone2Color ?? DEFAULT_SETTINGS.tone2Color,
			tone3Color: rawSettings.tone3Color ?? DEFAULT_SETTINGS.tone3Color,
			tone4Color: rawSettings.tone4Color ?? DEFAULT_SETTINGS.tone4Color,
			tone5Color: rawSettings.tone5Color ?? DEFAULT_SETTINGS.tone5Color,
		};
	}

	private async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private async loadDictionary(): Promise<void> {
		const dictionaryPath = this.getDictionaryPath();

		if (!await this.app.vault.adapter.exists(dictionaryPath)) {
			this.dictionary = [];
			return;
		}

		try {
			this.dictionary = JSON.parse(await this.app.vault.adapter.read(dictionaryPath)) as DictionaryEntry[];
		} catch (error) {
			this.dictionary = [];
			console.error("Mandarin Helper: failed to load dictionary.json", error);
		}
	}

	private async loadRanking(): Promise<void> {
		for (const rankingPath of this.getRankingPaths()) {
			if (!await this.app.vault.adapter.exists(rankingPath)) {
				continue;
			}

			try {
				this.ranking = JSON.parse(await this.app.vault.adapter.read(rankingPath)) as RankingDictionary;
				return;
			} catch (error) {
				this.ranking = {};
				console.error(`Mandarin Helper: failed to load ranking.json from ${rankingPath}`, error);
				return;
			}
		}

		this.ranking = {};
	}

	async downloadDictionary(url: string): Promise<void> {
		const trimmedUrl = url.trim();

		if (trimmedUrl.length === 0) {
			new Notice("Dictionary source is empty.");
			return;
		}

		try {
			await make_dictionary(trimmedUrl, {
				writeJson: async (json) => {
					await this.ensureDictionaryFolderExists();
					await this.app.vault.adapter.write(this.getDictionaryPath(), json);
				},
			});
			await this.loadDictionary();
			new Notice(`Dictionary downloaded (${this.dictionary.length} entries).`);
		} catch (error) {
			console.error("Mandarin Helper: failed to download dictionary", error);
			new Notice(error instanceof Error ? error.message : "Failed to download dictionary.");
		}
	}

	private getDisplayOptions(): MandarinHelperDisplayOptions {
		return {
			displayPinyin: this.isPinyinDisplayed(),
			colorizePinyin: this.isToneColorizationEnabled() && this.isPinyinDisplayed(),
			colorizeHanzi: this.isToneColorizationEnabled(),
		};
	}

	private isPinyinDisplayed(): boolean {
		return this.settings.displayPinyin;
	}

	private isHanziColorizationEnabled(): boolean {
		return this.isToneColorizationEnabled();
	}

	private isToneColorizationEnabled(): boolean {
		return this.settings.colorizeByTone;
	}

	private applyToneColors(): void {
		document.documentElement.style.setProperty("--mandarin-helper-tone-1-color", this.settings.tone1Color);
		document.documentElement.style.setProperty("--mandarin-helper-tone-2-color", this.settings.tone2Color);
		document.documentElement.style.setProperty("--mandarin-helper-tone-3-color", this.settings.tone3Color);
		document.documentElement.style.setProperty("--mandarin-helper-tone-4-color", this.settings.tone4Color);
		document.documentElement.style.setProperty("--mandarin-helper-tone-5-color", this.settings.tone5Color);
	}

	private applyFontScale(): void {
		const scaleFactor = 1 + Number(this.settings.fontIncreasePercent) / 100;
		document.documentElement.style.setProperty("--mandarin-helper-scale-factor", scaleFactor.toString());
	}

	private clearToneColors(): void {
		document.documentElement.style.removeProperty("--mandarin-helper-tone-1-color");
		document.documentElement.style.removeProperty("--mandarin-helper-tone-2-color");
		document.documentElement.style.removeProperty("--mandarin-helper-tone-3-color");
		document.documentElement.style.removeProperty("--mandarin-helper-tone-4-color");
		document.documentElement.style.removeProperty("--mandarin-helper-tone-5-color");
	}

	private clearFontScale(): void {
		document.documentElement.style.removeProperty("--mandarin-helper-scale-factor");
	}

	private normalizeFontIncreasePercent(value: unknown): FontIncreasePercent {
		switch (value) {
			case "0":
			case "20":
			case "40":
			case "60":
			case "90":
				return value;
			default:
				return DEFAULT_SETTINGS.fontIncreasePercent;
		}
	}

	private getDictionaryPath(): string {
		return normalizePath(`${this.getDictionaryFolderPath()}/dictionary.json`);
	}

	private getRankingPaths(): string[] {
		return [
			normalizePath(`${this.getPluginFolderPath()}/ranking.json`),
			normalizePath(`${this.getDictionaryFolderPath()}/ranking.json`),
		];
	}

	private getDictionaryFolderPath(): string {
		return normalizePath(`${this.getPluginFolderPath()}/data`);
	}

	private getPluginFolderPath(): string {
		return normalizePath(`${this.app.vault.configDir}/plugins/${this.manifest.id}`);
	}

	private async ensureDictionaryFolderExists(): Promise<void> {
		const dictionaryFolderPath = this.getDictionaryFolderPath();

		if (!await this.app.vault.adapter.exists(dictionaryFolderPath)) {
			await this.app.vault.adapter.mkdir(dictionaryFolderPath);
		}
	}
}
