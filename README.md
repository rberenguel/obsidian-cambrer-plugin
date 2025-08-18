# Cambrer - Local Note Server for Obsidian

Cambrer is an Obsidian plugin that runs a local web server to "serve" your notes directly to your web browser. This allows you to view, navigate, and search your notes in a browser tab, with styling that mirrors (as much as reasonable) your current Obsidian theme.

> Cambrer: Catalan for _waiter_. A waiter _serves_.

## Features

- **Local Server**: Starts a simple, local HTTP server to serve your notes.
- **Live Theming**: Automatically detects your current Obsidian theme (light or dark) and injects the corresponding styles into the served pages.
- **Internal Link Navigation**: Click on internal `[[links]]` in the browser to navigate between your notes.
- **Attachment Support**: Images, videos, and other attachments embedded in your notes are correctly displayed.
- **Command Palette Search**: Press `Meta+P` (or `Ctrl+P`) in the browser to open a command palette (`metaP`) that lets you search for and jump to any note in your vault.
- **"Open in Obsidian" Link**: Each served page includes a link to instantly open the note back in the Obsidian app.
- **Configurable Port**: Set your preferred port for the server in the plugin settings.
- **Plugin API**: Exposes functions for other plugins to programmatically serve one or more notes.

## How to Use

1.  **Start the Server**: Click the globe icon in the ribbon sidebar or run the "Serve current note and open in browser" command from the command palette.
2.  **View Note**: The currently active note will open in a new tab in your default web browser.
3.  **Navigate**: Use the internal links to browse your vault.
4.  **Search**: Press `Meta+P` or `Ctrl+P` to search for and open any other note.

## Integrate in other plugins

You can call Cambrer from other plugins to serve one or more files.

```javascript
// Get the instance of the server plugin
const serverPlugin = this.app.plugins.plugins["cambrer"];

// Check if the plugin is enabled and the API method exists
if (serverPlugin && serverPlugin.serveMultipleFiles) {
	// 'selectedFiles' would be your array of TFile objects from the search results
	serverPlugin.serveMultipleFiles(selectedFiles);
} else {
	new Notice("The Cambrer server plugin is not available.");
}
```

## Installation

### Manual Installation

1.  Download the latest release files (everything will be bundled in a zip) from the **Releases** page of the GitHub repository).
2.  Find your Obsidian vault's plugins folder by going to `Settings` > `About` and clicking `Open` next to `Override config folder`. Inside that folder, navigate into the `plugins` directory.
3.  Create a new folder named `cambrer`.
4.  Copy all the files from the zip archive into the new `cambrer` folder.
5.  In Obsidian, go to **Settings** > **Community Plugins**.
6.  Make sure "Restricted mode" is turned off. Click the "Reload plugins" button.
7.  Find "Cambrer" in the list and **enable** it.
