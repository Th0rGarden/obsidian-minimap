import { Plugin, MarkdownView, WorkspaceLeaf } from 'obsidian';
import { MinimapRenderer } from './MinimapRenderer';
import { MinimapSettings, DEFAULT_SETTINGS } from './types';

export default class MinimapPlugin extends Plugin {
  settings: MinimapSettings;
  private renderer: MinimapRenderer;

  async onload() {
    await this.loadSettings();
    this.renderer = new MinimapRenderer(this.settings);

    this.registerEvent(
      this.app.workspace.on('layout-change', () => this.handleLayoutChange())
    );

    this.registerEvent(
      this.app.workspace.on('active-leaf-change', (leaf) => {
        if (leaf) {
          this.renderer.updateMinimap(leaf);
        }
      })
    );

    this.registerEvent(
      this.app.workspace.on('editor-change', () => {
        const activeLeaf = this.app.workspace.activeLeaf;
        if (activeLeaf) {
          this.renderer.updateMinimap(activeLeaf);
        }
      })
    );
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private handleLayoutChange() {
    const leaves = this.app.workspace.getLeavesOfType('markdown');
    
    // Remove minimaps for closed leaves
    leaves.forEach(leaf => {
      if (!this.renderer.hasMinimap(leaf)) {
        this.renderer.createMinimap(leaf);
      }
    });
  }

  onunload() {
    this.renderer.cleanup();
  }
}