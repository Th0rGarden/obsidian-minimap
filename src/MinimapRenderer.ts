import { MarkdownView, WorkspaceLeaf } from 'obsidian';
import type { MinimapSettings } from './types';

export class MinimapRenderer {
  private minimaps: Map<WorkspaceLeaf, HTMLCanvasElement> = new Map();
  
  constructor(private settings: MinimapSettings) {}

  createMinimap(leaf: WorkspaceLeaf) {
    const view = leaf.view as MarkdownView;
    if (!view || !(view instanceof MarkdownView)) return;

    const container = view.containerEl;
    const canvas = document.createElement('canvas');
    canvas.addClass('minimap');
    canvas.style.cssText = `
      position: absolute;
      top: 0;
      right: 0;
      width: ${this.settings.width}px;
      height: 100%;
      z-index: 10;
      background: var(--background-secondary);
      opacity: 0.8;
    `;

    container.appendChild(canvas);
    this.minimaps.set(leaf, canvas);
    this.updateMinimap(leaf);
  }

  updateMinimap(leaf: WorkspaceLeaf) {
    const canvas = this.minimaps.get(leaf);
    if (!canvas) return;

    const view = leaf.view as MarkdownView;
    if (!view || !(view instanceof MarkdownView)) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const editor = view.editor;
    const content = editor.getValue();
    const lines = content.split('\n');

    // Clear canvas
    canvas.width = this.settings.width;
    canvas.height = canvas.parentElement?.clientHeight || 0;
    ctx.fillStyle = 'var(--background-secondary)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw minimap content
    ctx.fillStyle = 'var(--text-normal)';
    ctx.font = `${Math.floor(12 * this.settings.scale)}px monospace`;

    lines.forEach((line, index) => {
      const y = index * (12 * this.settings.scale);
      if (y > canvas.height) return;
      
      const width = Math.min(line.length * 5 * this.settings.scale, canvas.width - 4);
      ctx.fillRect(2, y, width, 2);
    });
  }

  removeMinimap(leaf: WorkspaceLeaf) {
    const minimap = this.minimaps.get(leaf);
    if (minimap) {
      minimap.remove();
      this.minimaps.delete(leaf);
    }
  }

  cleanup() {
    this.minimaps.forEach(minimap => minimap.remove());
    this.minimaps.clear();
  }

  getMinimap(leaf: WorkspaceLeaf) {
    return this.minimaps.get(leaf);
  }

  hasMinimap(leaf: WorkspaceLeaf) {
    return this.minimaps.has(leaf);
  }
}