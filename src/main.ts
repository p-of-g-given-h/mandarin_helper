import type { Extension } from "@codemirror/state";
import { MarkdownView, Plugin } from "obsidian";
import { createHanziEditorDecorationsExtension } from "./editor/hanziEditorDecorations";
import { registerHanziRubyPostProcessor } from "./rendering/hanziRubyRenderer";
import { DEFAULT_SETTINGS, type MandarinHelperDisplayOptions, type MandarinHelperSettings, MandarinHelperSettingTab } from "./settings";

interface LegacyMandarinHelperSettings extends Partial<MandarinHelperSettings> {
	colorizePinyin?: boolean;
	colorizeHanzi?: boolean;
}

export default class MandarinHelperPlugin extends Plugin {
	settings: MandarinHelperSettings;
	private readonly editorExtensions: Extension[] = [];

	async onload() {
		await this.loadSettings();

		this.applyToneColors();
		this.syncEditorExtensions();
		this.registerEditorExtension(this.editorExtensions);
		this.addSettingTab(new MandarinHelperSettingTab(this.app, this));
		registerHanziRubyPostProcessor(this, () => this.getDisplayOptions());
	}

	onunload() {
		this.clearToneColors();
	}

	async updateSettings(settingsPatch: Partial<MandarinHelperSettings>): Promise<void> {
		this.settings = {
			...this.settings,
			...settingsPatch,
		};
		await this.saveSettings();
		this.applyToneColors();
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

	private clearToneColors(): void {
		document.documentElement.style.removeProperty("--mandarin-helper-tone-1-color");
		document.documentElement.style.removeProperty("--mandarin-helper-tone-2-color");
		document.documentElement.style.removeProperty("--mandarin-helper-tone-3-color");
		document.documentElement.style.removeProperty("--mandarin-helper-tone-4-color");
		document.documentElement.style.removeProperty("--mandarin-helper-tone-5-color");
	}
}
