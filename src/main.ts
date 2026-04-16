import { Plugin } from "obsidian";
import { registerHanziEditorDecorations } from "./editor/hanziEditorDecorations";
import { registerHanziRubyPostProcessor } from "./rendering/hanziRubyRenderer";

export default class MandarinHelperPlugin extends Plugin {
	onload() {
		registerHanziEditorDecorations(this);
		registerHanziRubyPostProcessor(this);
	}
}
