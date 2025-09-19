# Obsidian Minimap Plugin

A plugin for Obsidian that adds a Visual Studio Code-inspired minimap to markdown notes, providing a visual overview of document structure and quick navigation.

## Features
- **Dynamic Minimap**: Displays a compact, scrollable overview of markdown content with customizable scaling and opacity.
- **Content Visualization**: Highlights headers, lists, code blocks, images, tables, and embeds with distinct colors.
- **Interactive Navigation**: Click or drag on the minimap to scroll to specific sections of the document.
- **File-Specific Control**: Toggle the minimap for individual notes via a command.
- **Customizable Settings**: Adjust visibility, colors, line height, text density, and element spacing.

## Installation
1. Open Obsidian and navigate to **Settings > Community Plugins**.
2. Disable **Restricted Mode** if enabled.
3. Click **Browse** and search for "Minimap".
4. Install the plugin and enable it.

Alternatively, manually install by copying the plugin files to your Obsidian vault's `.obsidian/plugins/minimap/` directory.

## Usage
- The minimap appears on the right side of markdown notes by default.
- Use the **Toggle Minimap for Current Note** command to enable/disable the minimap for specific files.
- Click or drag within the minimap to navigate the document.
- Configure settings in **Settings > Minimap Settings** to customize appearance and behavior.

## Settings
- **General**:
  - **Minimap Width**: Set width (50-300px).
  - **Minimap Opacity**: Set overall opacity (0.1-1.0).
  - **Density**: Control element spacing (0.5-2.5).
- **Element Visibility**: Toggle display of headers, lists, and code blocks.
- **Colors**: Customize colors for headers (1-6), text, code blocks, images, tables, embeds, and scroll indicator.

## Development
- Clone the repository: `git clone <repository-url>`.
- Install dependencies: `npm install`.
- Build the plugin: `npm run build`.
- Copy the built files to your Obsidian plugins directory.

## Contributing
- Report issues or suggest features via GitHub Issues.
- Submit pull requests with improvements or bug fixes.

## License
MIT License - but please credit the original repo instead of passing it off as your own plugin.
