# NotebookLM Notebook Mindmap Exporter

Export mindmaps from NotebookLLM as Markdown, FreePlane, VYM, or standalone SVG.

## Features

- One-click export to Markdown for easy editing and sharing
- Export to FreePlane `.mm`
- Export to VYM `.vym`
- Export to standalone SVG
- Optional interactive SVG with collapsible nodes (collapse level 2+)
- Choose how many levels are exported as Markdown headings before switching to bullet lists
- Modern, user-friendly popup UI
- File names include root node and timestamp for easy management

## Installation

### Build the Browser Packages

1. **Download or Clone the Repository**
   ```bash
   git clone https://github.com/rootsongjc/notebookllm-mindmap-exporter.git
   cd notebookllm-mindmap-exporter
   ```

2. **Generate the Chrome and Firefox extension folders**
   ```bash
   make chrome firefox
   ```

3. **Use one of the generated folders**
   - Chrome/Chromium: `dist/chrome`
   - Firefox: `dist/firefox`
   - Zip archives: `dist/mindmap-exporter-chrome.zip` and `dist/mindmap-exporter-firefox.zip`

4. **Clean generated files when needed**
   ```bash
   make clean
   ```

### Loading the Extension in Chrome/Chromium

1. **Open Chrome Extensions Page**
   - Open Chrome browser
   - Navigate to `chrome://extensions/`
   - Or go to Menu → More Tools → Extensions

2. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top-right corner

3. **Load the Extension**
   - Click "Load unpacked" button
   - Select the `dist/chrome` folder
   - The extension should now appear in your extensions list

4. **Verify Installation**
   - You should see the extension icon in your Chrome toolbar
   - If not visible, click the puzzle piece icon to pin it to the toolbar

### Loading the Extension in Firefox

1. **Open Firefox Debugging Page**
   - Open Firefox browser
   - Navigate to `about:debugging#/runtime/this-firefox`

2. **Load the Extension**
   - Click "Load Temporary Add-on"
   - Select the `dist/firefox/manifest.json` file

3. **Verify Installation**
   - The extension should now appear in the Firefox toolbar or extensions menu

## Note

This extension is only intended for use with mindmaps on NotebookLM, such as [notebooklm.google.com](https://notebooklm.google.com/notebook/ba86347e-d24c-4387-915f-18e20a2f51fe). To export, simply open a mindmap in a notebook, click the extension, and choose your export format.

**How it works:** The extension exports the current NotebookLM mindmap as Markdown, FreePlane `.mm`, VYM `.vym`, or standalone SVG, with an optional interactive mode for collapsible SVG nodes.

## Usage

1. Open a NotebookLM notebook and display the mindmap artifact you want to export.
2. Click the Mindmap Exporter extension icon.
3. Choose your export format in the popup to download the file.

For Markdown exports, the `Use headings through depth` setting controls how many tree levels are rendered as headings before deeper levels switch to bullet lists.

For SVG exports, enable `Interactive SVG (collapse level 2+)` to export a collapsible SVG. Leave it unchecked for the static SVG export.

## File Naming

Exported files are named as `notebookllm-{root-node-name}-{timestamp}.md`, `.mm`, `.vym`, or `.svg`.
