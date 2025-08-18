import { Plugin, App, MarkdownRenderer, TFile, Notice, FileSystemAdapter, PluginSettingTab, Setting } from 'obsidian';
import * as http from 'http';
import * as path from 'path';
import * as url from 'url';
import * as fs from 'fs';

// Interface for our plugin's settings.
interface LocalServerPluginSettings {
    port: number;
}

// Default settings for the plugin.
const DEFAULT_SETTINGS: LocalServerPluginSettings = {
    port: 8123, // A common port for local development.
};

// A simple map of file extensions to MIME types for serving attachments.
const MIME_TYPES: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.woff2': 'font/woff2',
};

export default class LocalServerPlugin extends Plugin {
    settings: LocalServerPluginSettings;
    server: http.Server | null = null;
    pluginPath: string;
    htmlTemplate: string;

    async onload() {
        await this.loadSettings();
        
        if (this.app.vault.adapter instanceof FileSystemAdapter) {
            this.pluginPath = this.app.vault.adapter.getFullPath(this.app.vault.configDir + '/plugins/' + this.manifest.id);
        } else {
            this.pluginPath = this.app.vault.configDir + '/plugins/' + this.manifest.id;
        }

        // Load the HTML template into memory
        try {
            const templatePath = path.join(this.pluginPath, 'template.html');
            this.htmlTemplate = fs.readFileSync(templatePath, 'utf8');
        } catch (error) {
            console.error("Error loading HTML template:", error);
            new Notice("Could not load HTML template for local server.");
            this.htmlTemplate = "<h1>Template not found</h1><p>{{body}}</p>"; // Fallback
        }

        this.addRibbonIcon('globe', 'Serve current note', () => {
            this.startServerAndOpenPage();
        });

        this.addCommand({
            id: 'serve-current-note',
            name: 'Serve current note and open in browser',
            callback: () => {
                this.startServerAndOpenPage();
            },
        });

        // Add the settings tab
        this.addSettingTab(new LocalServerSettingTab(this.app, this));

        console.log('Local Server Plugin loaded.');
    }

    onunload() {
        this.server?.close();
        console.log('Local Server plugin unloaded and server stopped.');
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    startServerAndOpenPage() {
        if (!this.server) {
            this.createServer();
            try {
                (this.server as any).listen(this.settings.port, () => {
                    new Notice(`Server started on port ${this.settings.port}`);
                    this.openInBrowser();
                });
            } catch (error) {
                 new Notice(`Error starting server. Is port ${this.settings.port} in use?`);
                 console.error("Server start error:", error);
            }
        } else {
            this.openInBrowser();
        }
    }

    openInBrowser() {
         const activeFile = this.app.workspace.getActiveFile();
         if (!activeFile) {
            new Notice('No active file to serve.');
            return;
         }
         this.openFileInBrowser(activeFile);
    }

    public serveFile(file: TFile) {
        if (!this.server) {
            this.startServerAndOpenPage();
            setTimeout(() => {
                if (this.app.workspace.getActiveFile()?.path !== file.path) {
                    this.openFileInBrowser(file);
                }
            }, 500);
        } else {
            this.openFileInBrowser(file);
        }
    }

    public serveMultipleFiles(files: TFile[]) {
        if (!this.server) {
            this.startServerAndOpenPage();
            setTimeout(() => {
                files.forEach(file => {
                    if (this.app.workspace.getActiveFile()?.path !== file.path) {
                        this.openFileInBrowser(file);
                    }
                });
            }, 500);
        } else {
            files.forEach(file => this.openFileInBrowser(file));
        }
    }

    private openFileInBrowser(file: TFile) {
        if (!file) return;
        const fileUrl = `http://localhost:${this.settings.port}/${encodeURI(file.path)}`;
        window.open(fileUrl);
    }
    
    getThemeStyles(): { themeClass: string; cssVars: string } {
        const theme = document.body.classList.contains('theme-dark') ? 'theme-dark' : 'theme-light';
        const computedStyles = getComputedStyle(document.body);
        
        const cssVars = Array.from(computedStyles)
            .filter(prop => prop.startsWith('--'))
            .map(prop => `${prop}: ${computedStyles.getPropertyValue(prop)};`)
            .join('\n');
            
        return { themeClass: theme, cssVars: `body.${theme} {\n${cssVars}\n}` };
    }


    postProcessHtml(filePath: string, html: string): string {
        const dom = new DOMParser().parseFromString(html, 'text/html');
        const vaultName = this.app.vault.getName();

        dom.querySelectorAll('a.internal-link').forEach((link) => {
            const href = link.getAttribute('href');
            if (href) {
                const targetFile = this.app.metadataCache.getFirstLinkpathDest(href, filePath);
                if (targetFile) {
                    link.setAttribute('href', `/${encodeURI(targetFile.path)}`);
                } else {
                    link.addClass('is-unresolved');
                }
            }
        });
        
        dom.querySelectorAll('img, video, audio, source').forEach((el) => {
            const srcAttr = el.tagName === 'SOURCE' ? 'srcset' : 'src';
            const src = el.getAttribute(srcAttr);
            if (src && !src.startsWith('http')) {
                 const file = this.app.metadataCache.getFirstLinkpathDest(decodeURI(src), filePath);
                 if(file) {
                    el.setAttribute(srcAttr, `/${encodeURI(file.path)}`);
                 }
            }
        });

        const openInObsidianLink = dom.createElement('a');
        openInObsidianLink.href = `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(filePath)}`;
        openInObsidianLink.textContent = 'Open in Obsidian';
        openInObsidianLink.style.cssText = 'position: fixed; top: 10px; right: 10px; padding: 8px 12px; background-color: var(--background-secondary-alt); color: var(--text-normal); text-decoration: none; border-radius: 5px; font-family: sans-serif; font-size: 14px; z-index: 9999; border: 1px solid var(--background-modifier-border);';
        dom.body.prepend(openInObsidianLink);

        return dom.body.innerHTML;
    }

    serveAsset(filePath: string, res: http.ServerResponse) {
        const fullPath = path.join(this.pluginPath, filePath);
        try {
            const data = fs.readFileSync(fullPath);
            const fileExtension = path.extname(filePath).toLowerCase() as keyof typeof MIME_TYPES;
            const contentType = MIME_TYPES[fileExtension] || 'application/octet-stream';
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        } catch (error) {
            console.error(`Error serving asset ${filePath} from ${fullPath}:`, error);
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end(`<h1>404 - Asset Not Found</h1><p>${filePath}</p>`);
        }
    }

    createServer() {
        this.server = http.createServer(async (req, res) => {
			const theReqUrl = req.url ?? ""
            const reqUrl = url.parse(theReqUrl).pathname;
            const fileExtension = path.extname(theReqUrl).toLowerCase();

            if (fileExtension === '.js' || fileExtension === '.css' || fileExtension === '.woff2') {
                this.serveAsset(theReqUrl.substring(1), res);
                return;
            }

            if (theReqUrl === '/search-data.json') {
                const notes = this.app.vault.getMarkdownFiles().map(f => ({ path: f.path }));
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(notes));
                return;
            }

            const filePath = decodeURI(theReqUrl.startsWith('/') ? theReqUrl.substring(1) : theReqUrl);
            const file = this.app.vault.getAbstractFileByPath(filePath);

            if (!(file instanceof TFile)) {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end(`<h1>404 - Not Found</h1><p>Could not find file: ${filePath}</p>`);
                return;
            }

            try {
                const fileExtension = path.extname(file.path).toLowerCase();

                if (fileExtension === '.md') {
                    const markdown = await this.app.vault.read(file);
                    const container = document.createElement('div');
                    await MarkdownRenderer.render(this.app, markdown, container, file.path, this);
                    
                    const processedHtmlBody = this.postProcessHtml(file.path, container.innerHTML);
                    const { themeClass, cssVars } = this.getThemeStyles();

                    const html = this.htmlTemplate
                        .replace(/{{title}}/g, file.basename)
                        .replace('{{themeClass}}', themeClass)
                        .replace('{{cssVars}}', cssVars)
                        .replace('{{body}}', processedHtmlBody);

                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(html);
                } 
                else if (MIME_TYPES[fileExtension as keyof typeof MIME_TYPES]) {
                    const data = await this.app.vault.readBinary(file);
                    res.writeHead(200, { 'Content-Type': MIME_TYPES[fileExtension as keyof typeof MIME_TYPES] });
                    res.end(Buffer.from(data));
                } 
                else {
                    res.writeHead(415, { 'Content-Type': 'text/html' });
                    res.end(`<h1>415 - Unsupported Media Type</h1><p>Cannot serve file type: ${fileExtension}</p>`);
                }
            } catch (e) {
                console.error("Error serving page:", e);
                res.writeHead(500, { 'Content-Type': 'text/html' });
                res.end('<h1>500 - Internal Server Error</h1>');
            }
        });

        this.server.on('error', (err: NodeJS.ErrnoException) => {
            if (err.code === 'EADDRINUSE') {
                new Notice(`Port ${this.settings.port} is already in use.`);
                this.server = null;
            } else {
                new Notice('An unknown server error occurred.');
                console.error('Server error:', err);
            }
        });
    }
}

// Settings Tab
class LocalServerSettingTab extends PluginSettingTab {
    plugin: LocalServerPlugin;

    constructor(app: App, plugin: LocalServerPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'Local Server Settings' });

        new Setting(containerEl)
            .setName('Server port')
            .setDesc('The port for the local server. The server will restart on the new port the next time you serve a note.')
            .addText(text => text
                .setPlaceholder('8123')
                .setValue(this.plugin.settings.port.toString())
                .onChange(async (value) => {
                    const port = parseInt(value);
                    if (!isNaN(port) && port > 0 && port < 65536) {
                        if (port !== this.plugin.settings.port) {
                            this.plugin.settings.port = port;
                            await this.plugin.saveSettings();
                            // If server is running, stop it to apply changes on next run.
                            if (this.plugin.server) {
                                this.plugin.server.close();
                                this.plugin.server = null;
                                new Notice('Server stopped. It will restart on the new port next time you serve a note.');
                            }
                        }
                    }
                }));
    }
}
