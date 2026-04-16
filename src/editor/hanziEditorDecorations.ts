import { RangeSetBuilder, type Extension } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { containsHanzi, getHanziRuns, getPinyinSyllables } from "../hanzi/annotation";

const hanziCharacterDecoration = (syllable: string) =>
	Decoration.mark({
		class: "mandarin-helper-editor-char",
		attributes: {
			"data-pinyin": syllable,
		},
	});

const hanziEditorAnnotationExtension = ViewPlugin.fromClass(class {
	decorations: DecorationSet;

	constructor(view: EditorView) {
		this.decorations = buildEditorDecorations(view);
	}

	update(update: ViewUpdate): void {
		if (update.docChanged || update.viewportChanged) {
			this.decorations = buildEditorDecorations(update.view);
		}
	}
}, {
	decorations: (plugin) => plugin.decorations,
});

export function createHanziEditorDecorationsExtension(): Extension {
	return hanziEditorAnnotationExtension;
}

function buildEditorDecorations(view: EditorView): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();

	for (const { from, to } of view.visibleRanges) {
		const text = view.state.doc.sliceString(from, to);
		if (!containsHanzi(text)) {
			continue;
		}

		for (const hanziRun of getHanziRuns(text)) {
			const syllables = getPinyinSyllables(hanziRun.value);
			if (syllables === null) {
				continue;
			}

			let runOffset = 0;
			for (const [index, character] of Array.from(hanziRun.value).entries()) {
				const characterLength = character.length;
				const characterFrom = from + hanziRun.startIndex + runOffset;
				const characterTo = characterFrom + characterLength;
				const syllable = syllables[index];

				if (syllable === undefined) {
					runOffset += characterLength;
					continue;
				}

				builder.add(characterFrom, characterTo, hanziCharacterDecoration(syllable));
				runOffset += characterLength;
			}
		}
	}

	return builder.finish();
}
