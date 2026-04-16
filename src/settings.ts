import { App, ColorComponent, PluginSettingTab, Setting } from "obsidian";
import type MandarinHelperPlugin from "./main";

export interface MandarinHelperDisplayOptions {
	displayPinyin: boolean;
	colorizePinyin: boolean;
	colorizeHanzi: boolean;
}

export interface MandarinHelperSettings {
	displayPinyin: MandarinHelperDisplayOptions["displayPinyin"];
	colorizeByTone: boolean;
	tone1Color: string;
	tone2Color: string;
	tone3Color: string;
	tone4Color: string;
	tone5Color: string;
}

export const DEFAULT_SETTINGS: MandarinHelperSettings = {
	displayPinyin: true,
	colorizeByTone: true,
	tone1Color: "#008000",
	tone2Color: "#0000ff",
	tone3Color: "#ff0000",
	tone4Color: "#000000",
	tone5Color: "#d2b48c",
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

		const toneColorComponents: ColorComponent[] = [];

		const updateDisabledStates = (): void => {
			for (const component of toneColorComponents) {
				component.setDisabled(!this.plugin.settings.colorizeByTone);
			}
		};

		new Setting(containerEl)
			.setName("Display Pinyin")
			.setDesc("Render pinyin transliterations above Hanzi characters in reading and editing modes.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.displayPinyin)
					.onChange(async (value) => {
						await this.plugin.updateSettings({ displayPinyin: value });
						updateDisabledStates();
					}),
			);

		new Setting(containerEl)
			.setName("Colorize by tone")
			.setDesc("Color pinyin annotations and Hanzi characters based on tone.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.colorizeByTone)
					.onChange(async (value) => {
						await this.plugin.updateSettings({ colorizeByTone: value });
						updateDisabledStates();
					}),
			);

		addToneColorSetting({
			containerEl,
			name: "Tone 1 color",
			description: "Flat tone.",
			value: this.plugin.settings.tone1Color,
			onChange: async (value) => {
				await this.plugin.updateSettings({ tone1Color: value });
			},
			components: toneColorComponents,
		});

		addToneColorSetting({
			containerEl,
			name: "Tone 2 color",
			description: "Rising tone.",
			value: this.plugin.settings.tone2Color,
			onChange: async (value) => {
				await this.plugin.updateSettings({ tone2Color: value });
			},
			components: toneColorComponents,
		});

		addToneColorSetting({
			containerEl,
			name: "Tone 3 color",
			description: "Falling-rising tone.",
			value: this.plugin.settings.tone3Color,
			onChange: async (value) => {
				await this.plugin.updateSettings({ tone3Color: value });
			},
			components: toneColorComponents,
		});

		addToneColorSetting({
			containerEl,
			name: "Tone 4 color",
			description: "Falling tone.",
			value: this.plugin.settings.tone4Color,
			onChange: async (value) => {
				await this.plugin.updateSettings({ tone4Color: value });
			},
			components: toneColorComponents,
		});

		addToneColorSetting({
			containerEl,
			name: "Tone 5 color",
			description: "Neutral tone.",
			value: this.plugin.settings.tone5Color,
			onChange: async (value) => {
				await this.plugin.updateSettings({ tone5Color: value });
			},
			components: toneColorComponents,
		});

		updateDisabledStates();
	}
}

function addToneColorSetting({
	containerEl,
	name,
	description,
	value,
	onChange,
	components,
}: {
	containerEl: HTMLElement;
	name: string;
	description: string;
	value: string;
	onChange: (value: string) => Promise<void>;
	components: ColorComponent[];
}): void {
	new Setting(containerEl)
		.setName(name)
		.setDesc(description)
		.addColorPicker((colorPicker) => {
			components.push(colorPicker);
			return colorPicker
				.setValue(value)
				.onChange(async (newValue) => {
					await onChange(newValue);
				});
		});
}
