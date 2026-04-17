import { App, ColorComponent, PluginSettingTab, Setting } from "obsidian";
import type MandarinHelperPlugin from "./main";

export const FONT_INCREASE_OPTIONS = ["0", "20", "40", "60", "90"] as const;
export type FontIncreasePercent = typeof FONT_INCREASE_OPTIONS[number];

export interface MandarinHelperDisplayOptions {
	displayPinyin: boolean;
	colorizePinyin: boolean;
	colorizeHanzi: boolean;
}

export interface MandarinHelperSettings {
	displayPinyin: MandarinHelperDisplayOptions["displayPinyin"];
	colorizeByTone: boolean;
	dictionarySource: string;
	fontIncreasePercent: FontIncreasePercent;
	tone1Color: string;
	tone2Color: string;
	tone3Color: string;
	tone4Color: string;
	tone5Color: string;
}

export const DEFAULT_SETTINGS: MandarinHelperSettings = {
	displayPinyin: true,
	colorizeByTone: true,
	dictionarySource: "https://github.com/gugray/HanDeDict/blob/master/handedict.u8",
	fontIncreasePercent: "40",
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
			.setName("Display pinyin")
			.setDesc("Render pinyin transliterations above hanzi characters in reading and editing modes.")
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
			.setDesc("Color pinyin annotations and hanzi characters based on tone.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.colorizeByTone)
					.onChange(async (value) => {
						await this.plugin.updateSettings({ colorizeByTone: value });
						updateDisabledStates();
					}),
			);

		let dictionarySourceValue = this.plugin.settings.dictionarySource;

		new Setting(containerEl)
			.setName("Dictionary source")
			.setDesc("Download dictionary entries from a source file into this plugin.")
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.dictionarySource)
					.setValue(dictionarySourceValue)
					.onChange(async (value) => {
						dictionarySourceValue = value;
						await this.plugin.updateSettings({ dictionarySource: value });
					}),
			)
			.addButton((button) =>
				button
					.setButtonText("Download")
					.onClick(async () => {
						button.setDisabled(true);
						button.setButtonText("Downloading...");

						try {
							await this.plugin.updateSettings({ dictionarySource: dictionarySourceValue });
							await this.plugin.downloadDictionary(dictionarySourceValue);
						} finally {
							button.setDisabled(false);
							button.setButtonText("Download");
						}
					}),
			);

		new Setting(containerEl)
			.setName("Increase font size")
			.setDesc("Scale hanzi and pinyin in reading and editing modes.")
			.addDropdown((dropdown) => {
				for (const value of FONT_INCREASE_OPTIONS) {
					dropdown.addOption(value, `${value}%`);
				}

				return dropdown
					.setValue(this.plugin.settings.fontIncreasePercent)
					.onChange(async (value) => {
						if (isFontIncreasePercent(value)) {
							await this.plugin.updateSettings({ fontIncreasePercent: value });
						}
					});
			});

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

function isFontIncreasePercent(value: string): value is FontIncreasePercent {
	return FONT_INCREASE_OPTIONS.includes(value as FontIncreasePercent);
}
