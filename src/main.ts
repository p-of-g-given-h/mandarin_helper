import type { Extension } from "@codemirror/state";
import { MarkdownView, Plugin } from "obsidian";
import { createHanziEditorDecorationsExtension } from "./editor/hanziEditorDecorations";
import { registerHanziRubyPostProcessor } from "./rendering/hanziRubyRenderer";
import { DEFAULT_SETTINGS, type MandarinHelperSettings, MandarinHelperSettingTab } from "./settings";

export default class MandarinHelperPlugin extends Plugin {
	settings: MandarinHelperSettings;
	private readonly editorExtensions: Extension[] = [];

	async onload() {
		await this.loadSettings();

		this.syncEditorExtensions();
		this.registerEditorExtension(this.editorExtensions);
		this.addSettingTab(new MandarinHelperSettingTab(this.app, this));
		registerHanziRubyPostProcessor(this, () => this.settings.displayPinyin);
	}

	async updateDisplayPinyin(displayPinyin: boolean): Promise<void> {
		this.settings.displayPinyin = displayPinyin;
		await this.saveSettings();
		this.syncEditorExtensions();
		this.app.workspace.updateOptions();
		this.rerenderMarkdownViews();
	}

	private syncEditorExtensions(): void {
		this.editorExtensions.length = 0;

		if (this.settings.displayPinyin) {
			this.editorExtensions.push(createHanziEditorDecorationsExtension());
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
}
