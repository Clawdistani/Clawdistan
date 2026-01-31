import chokidar from 'chokidar';
import { pathToFileURL } from 'url';
import { join } from 'path';

export class HotReloader {
    constructor(projectRoot, gameEngine) {
        this.projectRoot = projectRoot;
        this.gameEngine = gameEngine;
        this.loadedModules = new Map();
        this.watcher = null;
        this.onReload = null;
    }

    start() {
        // Watch for changes in features directory
        const featuresPath = join(this.projectRoot, 'features');

        this.watcher = chokidar.watch(featuresPath, {
            ignored: /node_modules/,
            persistent: true,
            ignoreInitial: false
        });

        this.watcher
            .on('add', (path) => this.loadFeature(path))
            .on('change', (path) => this.reloadFeature(path))
            .on('unlink', (path) => this.unloadFeature(path));

        console.log('Hot reload watching: ' + featuresPath);
    }

    stop() {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
    }

    async loadFeature(filePath) {
        if (!filePath.endsWith('.js')) return;
        if (filePath.includes('manifest.json')) return;

        try {
            // Add cache-busting query param for dynamic imports
            const moduleUrl = pathToFileURL(filePath).href + '?t=' + Date.now();
            const module = await import(moduleUrl);

            const feature = module.default || module;

            if (feature && feature.name) {
                this.loadedModules.set(filePath, feature);

                // Initialize the feature
                if (typeof feature.init === 'function') {
                    feature.init(this.gameEngine);
                }

                console.log(`Feature loaded: ${feature.name}`);
                this.onReload?.('load', feature.name);
            }
        } catch (err) {
            console.error(`Failed to load feature ${filePath}:`, err.message);
        }
    }

    async reloadFeature(filePath) {
        if (!filePath.endsWith('.js')) return;

        const oldFeature = this.loadedModules.get(filePath);

        // Cleanup old feature
        if (oldFeature && typeof oldFeature.cleanup === 'function') {
            try {
                oldFeature.cleanup(this.gameEngine);
            } catch (err) {
                console.error(`Error cleaning up feature:`, err);
            }
        }

        // Load new version
        await this.loadFeature(filePath);
    }

    unloadFeature(filePath) {
        const feature = this.loadedModules.get(filePath);

        if (feature) {
            // Cleanup
            if (typeof feature.cleanup === 'function') {
                try {
                    feature.cleanup(this.gameEngine);
                } catch (err) {
                    console.error(`Error cleaning up feature:`, err);
                }
            }

            this.loadedModules.delete(filePath);
            console.log(`Feature unloaded: ${feature.name}`);
            this.onReload?.('unload', feature.name);
        }
    }

    // Update all features each tick
    updateAll(tick) {
        this.loadedModules.forEach((feature, path) => {
            if (typeof feature.update === 'function') {
                try {
                    feature.update(this.gameEngine, tick);
                } catch (err) {
                    console.error(`Error updating feature ${feature.name}:`, err);
                }
            }
        });
    }

    getLoadedFeatures() {
        return Array.from(this.loadedModules.values()).map(f => ({
            name: f.name,
            description: f.description || ''
        }));
    }
}
