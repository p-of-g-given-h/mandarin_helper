import { RangeSetBuilder, type Extension } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { containsHanzi, getHanziCharacterAnnotations, getHanziRuns } from "../hanzi/annotation";
import type { MandarinHelperDisplayOptions } from "../settings";

const hanziCharacterDecoration = (syllable: string, tone: number, options: MandarinHelperDisplayOptions) =>
	Decoration.mark({
		class: [
			"mandarin-helper-editor-char",
			options.displayPinyin ? "mandarin-helper-editor-pinyin-visible" : "",
			options.colorizePinyin ? "mandarin-helper-colorize-pinyin" : "",
			options.colorizeHanzi ? "mandarin-helper-colorize-hanzi" : "",
		].filter(Boolean).join(" "),
		attributes: {
			...(options.displayPinyin ? { "data-pinyin": syllable } : {}),
			"data-tone": String(tone),
		},
	});

function createHanziEditorAnnotationExtension(options: MandarinHelperDisplayOptions): Extension {
	return ViewPlugin.fromClass(class {
	decorations: DecorationSet;

	constructor(view: EditorView) {
		this.decorations = buildEditorDecorations(view, options);
	}

	update(update: ViewUpdate): void {
		if (update.docChanged || update.viewportChanged) {
			this.decorations = buildEditorDecorations(update.view, options);
		}
	}
}, {
	decorations: (plugin) => plugin.decorations,
});
}

export function createHanziEditorDecorationsExtension(options: MandarinHelperDisplayOptions): Extension {
	return createHanziEditorAnnotationExtension(options);
}

function buildEditorDecorations(view: EditorView, options: MandarinHelperDisplayOptions): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();

	for (const { from, to } of view.visibleRanges) {
		const text = view.state.doc.sliceString(from, to);
		if (!containsHanzi(text)) {
			continue;
		}

		for (const hanziRun of getHanziRuns(text)) {
			const annotations = getHanziCharacterAnnotations(hanziRun.value);
			if (annotations === null) {
				continue;
			}

			let runOffset = 0;
			for (const annotation of annotations) {
				const characterLength = annotation.character.length;
				const characterFrom = from + hanziRun.startIndex + runOffset;
				const characterTo = characterFrom + characterLength;

				builder.add(characterFrom, characterTo, hanziCharacterDecoration(annotation.syllable, annotation.tone, options));
				runOffset += characterLength;
			}
		}
	}

	return builder.finish();
}
