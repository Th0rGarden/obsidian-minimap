const { Plugin, MarkdownView, PluginSettingTab, Setting } = require('obsidian');

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.webp'];
const DEFAULT_SETTINGS = {
    disabledFiles: [],
    width: 150,
    lineHeight: 4,
    minimapOpacity: 0.5,
    showMinimap: true,
    showHeaders: true,
    showLists: true,
    showCodeBlocks: true,
    headerColor: '#00BADA',
    textColor: '#808080',
    codeBlockColor: '#0000FF',
    indicatorColor: '#4444FF',
    indicatorOpacity: 0.2,
    header1Color: '#FF0000',
    header2Color: '#00FF00',
    header3Color: '#0000FF',
    header4Color: '#FFFF00',
    header5Color: '#FF00FF',
    header6Color: '#00FFFF',
    imageColor: '#A0A0A0',
    tableColor: '#808080',
    minElementWidth: 4,
    minElementHeight: 1,
    embedColor: '#6A9955',
    density: 1,
    minimapScaling: 0.5, // Controls overall minimap size
    lineSpacing: 1.2,    // Controls vertical spacing
    textDensity: 1.5,    // Controls horizontal text density
};
class MinimapPlugin extends Plugin {

    minimapCache = new Map();
    isMinimapEnabledForFile(filePath) {
        if (!this.settings) return false;
        return this.settings.showMinimap && !this.settings.disabledFiles.includes(filePath);
    }

    async loadSettings() {
        
        try {
            const data = await this.loadData();
            this.settings = Object.assign({}, DEFAULT_SETTINGS);
            
            if (data) {
                // Ensure disabledFiles is always an array
                this.settings.disabledFiles = Array.isArray(data.disabledFiles) 
                    ? data.disabledFiles 
                    : [];
                // Load other settings
                Object.keys(data).forEach(key => {
                    if (key !== 'disabledFiles') {
                        this.settings[key] = data[key];
                    }
                });
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
            this.settings = Object.assign({}, DEFAULT_SETTINGS);
        }
        this.registerEvent(
            this.app.workspace.on('layout-ready', () => {
                this.prerenderMinimap();
            })
        );
    }
    isImagePath(path) {
        return IMAGE_EXTENSIONS.some(ext => path.toLowerCase().endsWith(ext));
    }
    
    async prerenderMinimap() {
        if (!this.settings.showMinimap) return;
        
        const activeView = this.app.workspace.getActiveViewOfType('markdown');
        if (!activeView) return;
    
        const content = activeView.getViewData();
        const elements = this.parseContent(content);
        
        // Pre-load images
        const imagePromises = elements
            .filter(el => el.type === 'image')
            .map(async img => {
                const image = new Image();
                image.src = img.src;
                await new Promise((resolve) => {
                    image.onload = resolve;
                    image.onerror = resolve;
                });
                this.minimapCache.set(img.src, image);
            });
    
        await Promise.all(imagePromises);
        this.refreshMinimap();
    }

    
    
    refreshMinimap() {
        const minimapEl = this.minimapContainer;
        if (minimapEl) {
            minimapEl.empty();
            this.renderMinimap(minimapEl);
        }
    }
    
    async onload() {
        await this.loadSettings();
        this.minimaps = new Map();
        this.isDragging = false;

        this.addSettingTab(new MinimapSettingTab(this.app, this));

        this.addCommand({
            id: 'toggle-minimap-for-current-file',
            name: 'Toggle Minimap for Current Note',
            callback: () => {
                console.log("Command triggered");
                const activeFile = this.app.workspace.getActiveFile();
                console.log("Active file:", activeFile);
                if (!activeFile) return;
        
                const path = activeFile.path;
                console.log("File path:", path);
                console.log("Current settings:", this.settings);
                console.log("disabledFiles:", this.settings.disabledFiles);
                
                try {
                    const index = this.settings.disabledFiles.indexOf(path);
                    console.log("Index:", index);
                    
                    if (index === -1) {
                        console.log("Disabling minimap");
                        this.settings.disabledFiles.push(path);
                    } else {
                        console.log("Enabling minimap");
                        this.settings.disabledFiles.splice(index, 1);
                    }
                    
                    console.log("New disabledFiles:", this.settings.disabledFiles);
                    this.saveSettings();
                    this.refreshMinimaps();
                } catch (error) {
                    console.error("Error in toggle command:", error);
                }
            }
        });
        
        this.registerDomEvent(document, 'scroll', (evt) => {
            const activeLeaf = this.app.workspace.activeLeaf;
            if (activeLeaf && activeLeaf.view instanceof MarkdownView && !this.isDragging) {
                this.updateMinimap(activeLeaf);
            }
        }, true);

        this.registerEvent(
            this.app.workspace.on('editor-scroll', () => {
                const activeLeaf = this.app.workspace.activeLeaf;
                if (activeLeaf && activeLeaf.view instanceof MarkdownView && !this.isDragging) {
                    this.updateMinimap(activeLeaf);
                }
            })
        );

        const activeLeaf = this.app.workspace.activeLeaf;
        if (activeLeaf && activeLeaf.view instanceof MarkdownView) {
            this.createMinimap(activeLeaf);
        }

        this.registerEvent(
            this.app.workspace.on('layout-change', () => this.handleLayoutChange())
        );

        this.registerEvent(
            this.app.workspace.on('active-leaf-change', (leaf) => {
                if (leaf && leaf.view instanceof MarkdownView) {
                    this.createMinimap(leaf);
                    this.updateMinimap(leaf);
                }
            })
        );

        this.registerEvent(
            this.app.workspace.on('editor-change', () => {
                const activeLeaf = this.app.workspace.activeLeaf;
                if (activeLeaf && activeLeaf.view instanceof MarkdownView) {
                    this.updateMinimap(activeLeaf);
                }
            })
        );
    }
    handleLayoutChange() {
        const leaves = this.app.workspace.getLeavesOfType('markdown');
        
        for (const [leaf, minimap] of this.minimaps) {
            if (!leaves.includes(leaf)) {
                minimap.remove();
                this.minimaps.delete(leaf);
            }
        }

        leaves.forEach(leaf => {
            if (!this.minimaps.has(leaf)) {
                this.createMinimap(leaf);
            }
        });
    }

    // javascript
createMinimap(leaf) {
    if (!leaf || !(leaf.view instanceof MarkdownView)) return;
    if (this.minimaps.has(leaf)) return;

    const container = leaf.view.containerEl;
    const canvas = document.createElement('canvas');
    canvas.classList.add('minimap');
    canvas.style.setProperty('--minimap-opacity', this.settings.minimapOpacity);
    canvas.style.cssText = `
        position: fixed;
        top: 32px;
        right: 0;
        width: ${this.settings.width}px;
        height: calc(100vh - 32px);
        z-index: 1000;
        background: var(--background-primary);
        cursor: pointer;
        transition: opacity 0.2s ease-in-out;
        border-left: 0px;
    `;

    const handle = document.createElement('div');
    handle.style.cssText = `
        position: fixed;
        top: 32px;
        right: ${this.settings.width}px;
        width: 5px;
        height: calc(100vh - 32px);
        z-index: 1001;
        cursor: ew-resize;
        background: var(--background-primary);
    `;

    let isWidthDragging = false;

    handle.addEventListener('mousedown', (e) => {
        isWidthDragging = true;
        document.body.style.cursor = 'ew-resize';
    });

    document.addEventListener('mousemove', (e) => {
        if (isWidthDragging) {
            const newWidth = window.innerWidth - e.clientX;
            if (newWidth >= 50 && newWidth <= 300) {
                this.settings.width = newWidth;
                canvas.style.width = `${newWidth}px`;
                handle.style.right = `${newWidth}px`;
                this.saveSettings();
                this.refreshMinimaps();
            }
        }
    });

    document.addEventListener('mouseup', () => {
        if (isWidthDragging) {
            isWidthDragging = false;
            document.body.style.cursor = 'default';
        }
    });

    const editorElement = leaf.view.editor.containerEl.querySelector('.cm-scroller');
    if (editorElement) {
        this.registerDomEvent(editorElement, 'scroll', () => {
            if (!this.isDragging) {
                this.updateMinimap(leaf);
            }
        });
    }

    canvas.addEventListener('mousedown', (e) => {
        this.isDragging = true;
        this.scrollToMinimapPosition(e, leaf);
    });

    canvas.addEventListener('mousemove', (e) => {
        if (this.isDragging) {
            this.scrollToMinimapPosition(e, leaf);
        }
    });

    document.addEventListener('mouseup', () => {
        this.isDragging = false;
    });

    document.addEventListener('mouseleave', () => {
        this.isDragging = false;
    });

    canvas.addEventListener('contextmenu', (e) => {
        this.createContextMenu(e, canvas);
    });

    container.appendChild(canvas);
    container.appendChild(handle);
    this.minimaps.set(leaf, canvas);
    this.updateMinimap(leaf);
}
    // Context menu
createContextMenu(e, canvas) {
    e.preventDefault();
    
    // Remove any existing context menus
    const existingMenu = document.querySelector('.minimap-context-menu');
    if (existingMenu) existingMenu.remove();

    // Create menu container
    const menu = document.createElement('div');
    menu.className = 'minimap-context-menu';
    menu.style.cssText = `
        position: fixed;
        z-index: 1001;
        background: var(--background-primary);
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        padding: 4px 0;
        min-width: 150px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;

    // Add menu items
    const scaleOptions = Array.from({ length: 10 }, (_, i) => ({
        label: `Scale: ${(i + 1) * 10}%`,
        value: (i + 1) * 0.1
    }));
    
    const opacityOptions = Array.from({ length: 10 }, (_, i) => ({
        label: `Opacity: ${(i + 1) * 10}%`,
        value: (i + 1) * 0.1
    }));

    // Add scale submenu
    const scaleSection = this.createMenuSection('Scale');
    scaleOptions.forEach(option => {
        this.addMenuItem(scaleSection, option.label, () => {
            this.settings.minimapScaling = option.value;
            this.saveSettings();
            this.refreshMinimaps();
        }, this.settings.minimapScaling === option.value);
    });
    menu.appendChild(scaleSection);

    // Add opacity submenu
    const opacitySection = this.createMenuSection('Opacity');
    opacityOptions.forEach(option => {
        this.addMenuItem(opacitySection, option.label, () => {
            this.settings.minimapOpacity = option.value;
            this.saveSettings();
            this.refreshMinimaps();
        }, this.settings.minimapOpacity === option.value);
    });
    menu.appendChild(opacitySection);

    // Add menu to document and handle closing
    document.body.appendChild(menu);
    const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    };
    document.addEventListener('click', closeMenu);
}

createMenuSection(title) {
    const section = document.createElement('div');
    section.className = 'minimap-menu-section';
    section.style.cssText = `
        padding: 4px 0;
        border-bottom: 1px solid var(--background-modifier-border);
    `;
    
    const titleEl = document.createElement('div');
    titleEl.textContent = title;
    titleEl.style.cssText = `
        padding: 2px 8px;
        color: var(--text-muted);
        font-size: 0.8em;
    `;
    section.appendChild(titleEl);
    return section;
}

addMenuItem(container, label, onClick, isActive = false) {
    const item = document.createElement('div');
    item.className = 'minimap-menu-item';
    item.style.cssText = `
        padding: 4px 8px;
        cursor: pointer;
        color: var(--text-normal);
        ${isActive ? 'background-color: var(--background-modifier-hover);' : ''}
    `;
    item.textContent = label;
    
    item.addEventListener('click', onClick);
    item.addEventListener('mouseenter', () => {
        item.style.backgroundColor = 'var(--background-modifier-hover)';
    });
    item.addEventListener('mouseleave', () => {
        if (!isActive) {
            item.style.backgroundColor = '';
        }
    });
    
    container.appendChild(item);
}

    scrollToMinimapPosition(e, leaf) {
        const canvas = this.minimaps.get(leaf);
        if (!canvas) return;

        const view = leaf.view;
        if (!(view instanceof MarkdownView)) return;

        const editor = view.editor;
        const editorElement = editor.containerEl.querySelector('.cm-scroller');
        if (!editorElement) return;

        const rect = canvas.getBoundingClientRect();
        const clickY = e.clientY - rect.top;
        const canvasHeight = rect.height;
        
        const totalHeight = editorElement.scrollHeight;
        const viewportHeight = editorElement.clientHeight;
        
        const scrollRatio = clickY / canvasHeight;
        const newScrollTop = Math.max(0, Math.min(
            scrollRatio * totalHeight - viewportHeight / 2,
            totalHeight - viewportHeight
        ));
        
        editorElement.scrollTop = newScrollTop;
        this.updateMinimap(leaf);
    }
    updateMinimap(leaf) {
        const canvas = this.minimaps.get(leaf);
        if (!canvas) return;
    
        // Add this line early in the method to update opacity
        canvas.style.setProperty('--minimap-opacity', this.settings.minimapOpacity);
    
        const view = leaf.view;
        if (!view || !(view instanceof MarkdownView)) return;
    
        const editor = view.editor;
        const editorElement = editor.containerEl.querySelector('.cm-scroller');
        if (!editorElement) return;
    
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;
    
        if (!this.settings.showMinimap) {
            canvas.style.display = 'none';
            return;
        }
    
        const dpr = window.devicePixelRatio || 1;
const displayWidth = Math.floor(this.settings.width * this.settings.minimapScaling);
const displayHeight = Math.floor((window.innerHeight - 32) * this.settings.minimapScaling);
        
        canvas.width = displayWidth * dpr;
        canvas.height = displayHeight * dpr;
        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${displayHeight}px`;
        
        ctx.scale(dpr, dpr);
    
        ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--background-primary');
        ctx.fillRect(0, 0, displayWidth, displayHeight);
    
        const cmEditor = editor.cm;
        const totalLines = cmEditor.state.doc.lines;
        
        const editorHeight = editorElement.scrollHeight;
        const scale = displayHeight / editorHeight;
        
        // Apply density to line height
        const baseLineHeight = Math.max(1, Math.floor(this.settings.lineHeight * this.settings.lineSpacing));
const effectiveLineHeight = Math.max(1, baseLineHeight * scale);
    
const getContentWidth = (content, indent = 0) => {
    const textLength = content.trim().length;
    return Math.min(
        textLength * this.settings.textDensity,
        displayWidth - 8 - (indent * this.settings.textDensity)
    );
};
        const batchSize = 50;
        const processLines = (startLine, endLine) => {
            for (let lineNo = startLine; lineNo <= endLine; lineNo++) {
                if (lineNo > totalLines) break;
    
                const line = cmEditor.state.doc.line(lineNo);
                const lineInfo = cmEditor.lineBlockAt(line.from);
                
                const top = lineInfo.top;
                const y = Math.floor(top * scale);
            const height = Math.max(
                effectiveLineHeight,
                Math.floor(lineInfo.height * scale)
            );
                
                if (y < -height || y > displayHeight + height) continue;
    
                const content = line.text;
                
                // Separate handling for embeds and images
                if (content.match(/!\[\[.*?\]\]/)) {
                    ctx.fillStyle = this.settings.embedColor;
                    const embedHeight = height * 2;
                    ctx.fillRect(4, y, displayWidth - 8, embedHeight);
                    // Add distinctive pattern or border
                    ctx.strokeStyle = "#000000";
                    ctx.strokeRect(4, y, displayWidth - 8, embedHeight);
                    continue;
                } 
                if (content.match(/!\[\[.*?\]\]/)) {
                    const embedPath = content.match(/!\[\[(.*?)\]\]/)[1];
                    if (this.isImagePath(embedPath)) {
                        // Handle as image
                        ctx.fillStyle = this.settings.imageColor;
                        const imageHeight = height * 1.5;
                        ctx.fillRect(8, y, displayWidth - 16, imageHeight);
                    } else {
                        // Handle as regular embed
                        ctx.fillStyle = this.settings.embedColor;
                        const embedHeight = height * 2;
                        ctx.fillRect(4, y, displayWidth - 8, embedHeight);
                        ctx.strokeStyle = "#000000";
                        ctx.strokeRect(4, y, displayWidth - 8, embedHeight);
                    }
                    continue;
                }
                
                if (content.startsWith('#') && this.settings.showHeaders) {
                    const headerLevel = content.match(/^#+/)[0].length;
                    ctx.fillStyle = this.settings[`header${headerLevel}Color`] || this.settings.headerColor;
                    
                    const headerText = content.replace(/^#+\s*/, '');
                    const headerWidth = Math.min(
                        ctx.measureText(headerText).width + 16,
                        displayWidth - 8
                    );
                    
                    const headerHeight = Math.max(height * 1.2, 3);
                    ctx.fillRect(4, y, headerWidth, headerHeight);
    
                } else if (content.trim().startsWith('```') && this.settings.showCodeBlocks) {
                    ctx.fillStyle = this.settings.codeBlockColor;
                    ctx.fillRect(4, y, displayWidth - 8, Math.max(1.5, height));
    
                } else if (content.includes('|')) {
                    ctx.fillStyle = this.settings.tableColor;
                    const cells = content.split('|').filter(cell => cell.trim());
                    const tableWidth = Math.min(
                        cells.length * 20,
                        displayWidth - 16
                    );
                    ctx.fillRect(8, y, tableWidth, Math.max(1, height));
    
                } else if (content.trim().length > 0) {
                    const indent = content.search(/\S/) || 0;
                    ctx.fillStyle = this.settings.textColor;
                    
                    if (content.trim().length > 0) {
                        const indent = content.search(/\S/) || 0;
                        const width = getContentWidth(content, indent);
                        const x = Math.floor(4 + (indent * this.settings.textDensity));
                        
                        ctx.fillRect(x, y, width, Math.max(1, height * 0.8));
                    } else {
                        const width = Math.min(
                            content.length * 1.5,
                            displayWidth - 8 - indent
                        );
                        ctx.fillRect(4 + indent, y, width, Math.max(1, height * 0.8));
                    }
                }
            }
        };
    
        for (let i = 1; i <= totalLines; i += batchSize) {
            processLines(i, i + batchSize - 1);
        }
    
        const scrollTop = editorElement.scrollTop;
        const viewportHeight = editorElement.clientHeight;
        
        const indicatorHeight = viewportHeight * scale;
        const indicatorY = scrollTop * scale;
    
        if (this.settings.indicatorOpacity > 0) {
            ctx.fillStyle = this.settings.indicatorColor;
            ctx.globalAlpha = this.settings.indicatorOpacity;
            ctx.fillRect(0, indicatorY, displayWidth, indicatorHeight);
    
            ctx.globalAlpha = 0.8;
            ctx.strokeStyle = this.settings.indicatorColor;
            ctx.lineWidth = 2;
            ctx.strokeRect(0, indicatorY, displayWidth, indicatorHeight);
            
            ctx.globalAlpha = 1;
        }
    }
  refreshMinimaps() {
    this.minimaps.forEach((minimap, leaf) => {
        if (leaf.view instanceof MarkdownView) {
            const currentFile = leaf.view.file;
            if (!currentFile || !this.isMinimapEnabledForFile(currentFile.path)) {
                minimap.style.display = 'none';
            } else {
                minimap.style.display = 'block';
                this.updateMinimap(leaf);
            }
        }
    });
}

    async saveSettings() {
        await this.saveData(this.settings);
    }

    onunload() {
        this.minimaps.forEach(minimap => minimap.remove());
        this.minimaps.clear();
    }
}

class MinimapSettingTab extends PluginSettingTab {
    display() {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Minimap Settings' });

        // Visibility and Size Settings
        containerEl.createEl('h3', { text: 'General Settings' });

        new Setting(containerEl)
    .setName('Minimap Scaling')
    .setDesc('Adjust minimap detail level (lower = more precise)')
    .addSlider(slider => slider
        .setLimits(0.1, 1.0, 0.1)
        .setValue(this.plugin.settings.minimapScaling)
        .onChange(async value => {
            this.plugin.settings.minimapScaling = value;
            await this.plugin.saveSettings();
            this.plugin.refreshMinimaps();
        }));

new Setting(containerEl)
    .setName('Text Density')
    .setDesc('Adjust text representation density')
    .addSlider(slider => slider
        .setLimits(0.5, 3.0, 0.1)
        .setValue(this.plugin.settings.textDensity)
        .onChange(async value => {
            this.plugin.settings.textDensity = value;
            await this.plugin.saveSettings();
            this.plugin.refreshMinimaps();
        }));
        new Setting(containerEl)
            .setName('Show Minimap')
            .setDesc('Toggle minimap visibility')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showMinimap)
                .onChange(async (value) => {
                    this.plugin.settings.showMinimap = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshMinimaps();
                }));

        new Setting(containerEl)
            .setName('Minimap Width')
            .setDesc('Width of the minimap in pixels')
            .addSlider(slider => slider
                .setLimits(50, 300, 10)
                .setValue(this.plugin.settings.width)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.width = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshMinimaps();
                }));

        new Setting(containerEl)
            .setName('Line Height')
            .setDesc('Height of each line in the minimap')
            .addSlider(slider => slider
                .setLimits(1, 10, 0.5)
                .setValue(this.plugin.settings.lineHeight)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.lineHeight = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshMinimaps();
                }));

        new Setting(containerEl)
            .setName('Minimap Opacity')
            .setDesc('Overall opacity of the minimap')
            .addSlider(slider => slider
                .setLimits(0.1, 1, 0.1)
                .setValue(this.plugin.settings.minimapOpacity)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.minimapOpacity = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshMinimaps();
                }));

        // Element Visibility Settings
        containerEl.createEl('h3', { text: 'Element Visibility' });

        new Setting(containerEl)
            .setName('Show Headers')
            .setDesc('Show headers in the minimap')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showHeaders)
                .onChange(async (value) => {
                    this.plugin.settings.showHeaders = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshMinimaps();
                }));

        new Setting(containerEl)
            .setName('Show Lists')
            .setDesc('Show list items in the minimap')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showLists)
                .onChange(async (value) => {
                    this.plugin.settings.showLists = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshMinimaps();
                }));

        new Setting(containerEl)
            .setName('Show Code Blocks')
            .setDesc('Show code blocks in the minimap')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showCodeBlocks)
                .onChange(async (value) => {
                    this.plugin.settings.showCodeBlocks = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshMinimaps();
                }));

        // Color Settings
        containerEl.createEl('h3', { text: 'Color Settings' });

        new Setting(containerEl)
            .setName('Header 1 Color')
            .setDesc('Color for level 1 headers')
            .addColorPicker(color => color
                .setValue(this.plugin.settings.header1Color)
                .onChange(async (value) => {
                    this.plugin.settings.header1Color = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshMinimaps();
                }));

        new Setting(containerEl)
            .setName('Header 2 Color')
            .setDesc('Color for level 2 headers')
            .addColorPicker(color => color
                .setValue(this.plugin.settings.header2Color)
                .onChange(async (value) => {
                    this.plugin.settings.header2Color = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshMinimaps();
                }));

        new Setting(containerEl)
            .setName('Header 3 Color')
            .setDesc('Color for level 3 headers')
            .addColorPicker(color => color
                .setValue(this.plugin.settings.header3Color)
                .onChange(async (value) => {
                    this.plugin.settings.header3Color = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshMinimaps();
                }));

        new Setting(containerEl)
            .setName('Header 4 Color')
            .setDesc('Color for level 4 headers')
            .addColorPicker(color => color
                .setValue(this.plugin.settings.header4Color)
                .onChange(async (value) => {
                    this.plugin.settings.header4Color = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshMinimaps();
                }));

        new Setting(containerEl)
            .setName('Header 5 Color')
            .setDesc('Color for level 5 headers')
            .addColorPicker(color => color
                .setValue(this.plugin.settings.header5Color)
                .onChange(async (value) => {
                    this.plugin.settings.header5Color = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshMinimaps();
                }));

        new Setting(containerEl)
            .setName('Header 6 Color')
            .setDesc('Color for level 6 headers')
            .addColorPicker(color => color
                .setValue(this.plugin.settings.header6Color)
                .onChange(async (value) => {
                    this.plugin.settings.header6Color = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshMinimaps();
                }));

        new Setting(containerEl)
            .setName('Text Color')
            .setDesc('Color for regular text')
            .addColorPicker(color => color
                .setValue(this.plugin.settings.textColor)
                .onChange(async (value) => {
                    this.plugin.settings.textColor = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshMinimaps();
                }));

        new Setting(containerEl)
            .setName('Code Block Color')
            .setDesc('Color for code blocks')
            .addColorPicker(color => color
                .setValue(this.plugin.settings.codeBlockColor)
                .onChange(async (value) => {
                    this.plugin.settings.codeBlockColor = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshMinimaps();
                }));

        new Setting(containerEl)
            .setName('Image Color')
            .setDesc('Color for images')
            .addColorPicker(color => color
                .setValue(this.plugin.settings.imageColor)
                .onChange(async (value) => {
                    this.plugin.settings.imageColor = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshMinimaps();
                }));

        new Setting(containerEl)
            .setName('Table Color')
            .setDesc('Color for tables')
            .addColorPicker(color => color
                .setValue(this.plugin.settings.tableColor)
                .onChange(async (value) => {
                    this.plugin.settings.tableColor = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshMinimaps();
                }));

        new Setting(containerEl)
            .setName('Indicator Color')
            .setDesc('Color for the scroll indicator')
            .addColorPicker(color => color
                .setValue(this.plugin.settings.indicatorColor)
                .onChange(async (value) => {
                    this.plugin.settings.indicatorColor = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshMinimaps();
                }));

        new Setting(containerEl)
            .setName('Indicator Opacity')
            .setDesc('Opacity of the scroll indicator')
            .addSlider(slider => slider
                .setLimits(0.1, 1, 0.1)
                .setValue(this.plugin.settings.indicatorOpacity)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.indicatorOpacity = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshMinimaps();
                }));
                
            new Setting(containerEl)
                .setName('Embed Color')
                .setDesc('Color for Obsidian embeds (![[]])')
                .addColorPicker(color => color
                    .setValue(this.plugin.settings.embedColor)
                    .onChange(async (value) => {
                        this.plugin.settings.embedColor = value;
                        await this.plugin.saveSettings();
                        this.plugin.refreshMinimaps();
                    }));
    
            new Setting(containerEl)
                .setName('Density')
                .setDesc('Controls the spacing between elements (lower = more compact)')
                .addSlider(slider => slider
                    .setLimits(0.5, 2.5, 0.1)
                    .setValue(this.plugin.settings.density)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.density = value;
                        await this.plugin.saveSettings();
                        this.plugin.refreshMinimaps();
                    }));
    }
}


module.exports = MinimapPlugin;