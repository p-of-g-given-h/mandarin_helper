import type { Extension } from "@codemirror/state";
import { MarkdownView, Plugin } from "obsidian";
import { createHanziEditorDecorationsExtension } from "./editor/hanziEditorDecorations";
import { registerHanziRubyPostProcessor } from "./rendering/hanziRubyRenderer";
import { DEFAULT_SETTINGS, type MandarinHelperDisplayOptions, type MandarinHelperSettings, MandarinHelperSettingTab } from "./settings";

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

		if (this.settings.displayPinyin || this.settings.colorizeHanzi) {
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
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<MandarinHelperSettings>);
	}

	private async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private getDisplayOptions(): MandarinHelperDisplayOptions {
		return {
			displayPinyin: this.settings.displayPinyin,
			colorizePinyin: this.settings.displayPinyin && this.settings.colorizePinyin,
			colorizeHanzi: this.settings.colorizeHanzi,
		};
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
