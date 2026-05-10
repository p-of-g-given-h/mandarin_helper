import { MarkdownView } from "obsidian";
import type MandarinHelperPlugin from "../main";

export function getLookupText(plugin: MandarinHelperPlugin): string {
	const selectedText = getSelectedText(plugin);
	if (selectedText.length > 0) {
		return selectedText;
	}

	return getCurrentLineLookupText(plugin);
}

function getSelectedText(plugin: MandarinHelperPlugin): string {
	const activeMarkdownView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
	const editorSelection = activeMarkdownView?.editor.getSelection().trim();

	if (editorSelection && editorSelection.length > 0) {
		return editorSelection;
	}

	return window.getSelection()?.toString().trim() ?? "";
}

function getCurrentLineLookupText(plugin: MandarinHelperPlugin): string {
	const activeMarkdownView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
	const editor = activeMarkdownView?.editor;

	if (!editor) {
		return "";
	}

	const currentLine = editor.getLine(editor.getCursor().line);
	return stripMarkdownForLookup(currentLine);
}

function stripMarkdownForLookup(value: string): string {
	return value
		.replace(/!\[([^\]]*)\]\([^)]+\)/gu, "$1")
		.replace(/\[([^\]]+)\]\([^)]+\)/gu, "$1")
		.replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/gu, "$2")
		.replace(/\[\[([^\]]+)\]\]/gu, "$1")
		.replace(/^\s{0,3}(?:>\s*)+/gu, "")
		.replace(/^\s{0,3}(?:[-*+]|\d+\.)\s+\[(?: |x|X)\]\s+/gu, "")
		.replace(/^\s{0,3}(?:[-*+]|\d+\.)\s+/gu, "")
		.replace(/^\s{0,3}#{1,6}\s+/gu, "")
		.replace(/[`*_~>#]/gu, "")
		.replace(/[[\]()!]/gu, "")
		.replace(/\s+/gu, " ")
		.trim();
}
