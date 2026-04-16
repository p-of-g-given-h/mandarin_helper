import { Plugin } from "obsidian";
import { registerHanziRubyPostProcessor } from "./rendering/hanziRubyRenderer";

export default class MandarinHelperPlugin extends Plugin {
	onload() {
		registerHanziRubyPostProcessor(this);
	}
}
