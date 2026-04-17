# Mandarin Helper

Mandarin Helper is an [Obsidian](https://obsidian.md) community plugin for reading and looking up Chinese text inside your notes.

It adds pinyin above Hanzi in reading and editing views, colorizes tones, and provides a built-in dictionary lookup popup that works from the keyboard or the sidebar.

## Features

- Render pinyin transliterations above Hanzi in reading mode
- Show pinyin annotations directly in the editor
- Color Hanzi and pinyin by tone
- Adjust the display scale for Hanzi and pinyin
- Download and load a local dictionary from a configurable source
- Look up the current selection or, if nothing is selected, the current line
- Open dictionary results from:
  - the `Dictionary Lookup` command
  - the default hotkey `Ctrl+Shift+D`
  - the sidebar ribbon button with the `book-a` icon
- Copy Hanzi, pinyin, or translations from the popup with one click

## Dictionary Lookup

Dictionary lookup searches against:

- Hanzi
- normalized pinyin
- normalized translation text

Matches are shown in a popup with:

- Hanzi
- pinyin
- translations

Each segment in the popup is clickable. Clicking a segment copies its contents to the clipboard, closes the popup, and shows feedback about what was copied.

If no text is selected when lookup is triggered, the plugin falls back to the current editor line and strips common Markdown syntax such as headings, list markers, checkboxes, and links before searching.

## Settings

Mandarin Helper currently provides these settings:

- `Display Pinyin`
- `Colorize by tone`
- `Dictionary source`
- `Increase font size`
- custom colors for tones 1 through 5

The default dictionary source is:

`https://github.com/gugray/HanDeDict/blob/master/handedict.u8`

Use the `Download` button in settings to fetch the dictionary and store it locally for the plugin.

## Installation

### Manual installation

Copy these files into your vault at:

`.obsidian/plugins/mandarin-helper/`

Files:

- `main.js`
- `manifest.json`
- `styles.css`

Then reload Obsidian and enable **Settings → Community plugins → Mandarin Helper**.

## Development

### Requirements

- Node.js 18+
- npm

### Setup

```bash
npm install
```

### Start watch build

```bash
npm run dev
```

### Production build

```bash
npm run build
```

### Run tests

```bash
npm test
```

### Lint

```bash
npm run lint
```

## Project Structure

```text
src/
  commands/      # command registration and lookup triggering
  editor/        # editor decorations for pinyin and tone coloring
  hanzi/         # Hanzi annotation helpers
  rendering/     # reading-view post processing
  ui/            # modal UI for dictionary lookup
  dictionary.ts  # dictionary parsing, normalization, matching
  main.ts        # plugin lifecycle
  settings.ts    # settings model and settings tab
```

## Notes

- The plugin is intended to work offline after the dictionary has been downloaded.
- Dictionary data is stored in the plugin's data directory inside `.obsidian/plugins/mandarin-helper/data/`.
- The plugin is currently marked as mobile-compatible in `manifest.json`.

## License

`0BSD`
