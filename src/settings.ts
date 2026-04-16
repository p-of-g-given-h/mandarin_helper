import { App, PluginSettingTab, Setting } from "obsidian";
import type MandarinHelperPlugin from "./main";

export interface MandarinHelperSettings {
	displayPinyin: boolean;
}

export const DEFAULT_SETTINGS: MandarinHelperSettings = {
	displayPinyin: true,
};

export class MandarinHelperSettingTab extends PluginSettingTab {
	plugin: MandarinHelperPlugin;

	constructor(app: App, plugin: MandarinHelperPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Display Pinyin")
			.setDesc("Render pinyin transliterations above Hanzi characters in reading and editing modes.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.displayPinyin)
					.onChange(async (value) => {
						await this.plugin.updateDisplayPinyin(value);
					}),
			);
	}
}
