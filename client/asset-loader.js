// Lazy Asset Loader - Loads sprites on-demand instead of upfront
// Reduces initial page load time and memory usage

export class AssetLoader {
    constructor() {
        // Registry: category -> key -> path (NOT loaded yet)
        this._registry = new Map();
        // Loaded images: category -> key -> Image
        this._loaded = new Map();
        // Pending loads: Set of "category:key" strings
        this._pending = new Set();
        // Failed loads: Set of "category:key" strings (don't retry)
        this._failed = new Set();
        // Callbacks waiting for specific assets
        this._callbacks = new Map();
        // Stats for debugging
        this._stats = { registered: 0, loaded: 0, pending: 0, failed: 0 };
        
        // Initialize the registry with all known sprites
        this._initRegistry();
    }
    
    /**
     * Initialize registry with all sprite paths
     * This is the ONLY place sprite paths are defined
     */
    _initRegistry() {
        const basePath = '/assets/sprites/kenney-redux/PNG';
        
        // Ship sprites (critical - preload these)
        this._registerCategory('ships', {
            red: `${basePath}/playerShip1_red.png`,
            green: `${basePath}/playerShip2_green.png`,
            blue: `${basePath}/playerShip3_blue.png`,
            yellow: `${basePath}/playerShip1_orange.png`,
            enemy: `${basePath}/Enemies/enemyRed3.png`,
            ufo: `${basePath}/ufoBlue.png`,
        });
        
        // Meteor sprites
        this._registerCategory('meteors', {
            brown: `${basePath}/Meteors/meteorBrown_big1.png`,
            grey: `${basePath}/Meteors/meteorGrey_big1.png`,
        });
        
        // Structure sprites (partially critical - preload basic ones)
        this._registerCategory('structures', {
            mine: '/images/icons/structures/mine.png',
            farm: '/images/icons/structures/farm.png',
            power_plant: '/images/icons/structures/power_plant.png',
            research_lab: '/images/icons/structures/research_lab.png',
            shipyard: '/images/icons/structures/shipyard.png',
            barracks: '/images/icons/structures/barracks.png',
            fortress: '/images/icons/structures/fortress.png',
            factory: '/images/icons/structures/factory.png',
            fishing_dock: '/images/icons/structures/fishing_dock.png',
            lumbermill: '/images/icons/structures/lumbermill.png',
            trading_post: '/images/icons/structures/trading_post.png',
            observatory: '/images/icons/structures/observatory.png',
            academy: '/images/icons/structures/academy.png',
            archives: '/images/icons/structures/archives.png',
            orbital_station: '/images/icons/structures/orbital_station.png',
            gateway: '/images/icons/structures/gateway.png',
            monument: '/images/icons/structures/monument.png',
            vault: '/images/icons/structures/vault.png',
            embassy: '/images/icons/structures/embassy.png',
            communications_array: '/images/icons/structures/communications_array.png',
            colosseum: '/images/icons/structures/colosseum.png',
            hydroponics: '/images/icons/structures/hydroponics.png',
            hydroponics_bay: '/images/icons/structures/hydroponics.png',
            refinery: '/images/icons/structures/refinery.png',
            spaceport: '/images/icons/structures/spaceport.png',
            temple: '/images/icons/structures/temple.png',
        });
        
        // Ship type sprites (load on-demand when viewing fleet details)
        this._registerCategory('shipTypes', {
            fighter: '/images/ships/fighter.png',
            bomber: '/images/ships/bomber.png',
            scout: '/images/ships/scout.png',
            corvette: '/images/ships/corvette.png',
        });
        
        // Planet sprites (critical for system view)
        this._registerCategory('planets', {
            terrestrial: '/images/planets/terrestrial.png',
            ocean: '/images/planets/ocean.png',
            desert: '/images/planets/desert.png',
            ice: '/images/planets/ice.png',
            volcanic: '/images/planets/volcanic.png',
            gas_giant: '/images/planets/gas_giant.png',
        });
        
        // Megastructure sprites (rare - load on-demand)
        this._registerCategory('megastructures', {
            dyson_sphere: '/images/megastructures/dyson_sphere.png',
            ring_world: '/images/megastructures/ring_world.png',
            science_nexus: '/images/megastructures/science_nexus.png',
            matter_decompressor: '/images/megastructures/matter_decompressor.png',
            strategic_coordination_center: '/images/megastructures/strategic_coordination_center.png',
            mega_shipyard: '/images/megastructures/mega_shipyard.png',
        });
        
        // Relic sprites (rare - load on-demand)
        this._registerCategory('relics', {
            quantum_compass: '/images/relics/quantum_compass.png',
            crystalline_matrix: '/images/relics/crystalline_matrix.png',
            solar_lens: '/images/relics/solar_lens.png',
            growth_catalyst: '/images/relics/growth_catalyst.png',
            data_archive: '/images/relics/data_archive.png',
            phase_cloak: '/images/relics/phase_cloak.png',
            weapons_cache: '/images/relics/weapons_cache.png',
            trade_cipher: '/images/relics/trade_cipher.png',
            neural_optimizer: '/images/relics/neural_optimizer.png',
            fertility_engine: '/images/relics/fertility_engine.png',
            shield_matrix: '/images/relics/shield_matrix.png',
            wormhole_key: '/images/relics/wormhole_key.png',
            matter_forge: '/images/relics/matter_forge.png',
            war_engine: '/images/relics/war_engine.png',
            heart_of_creation: '/images/relics/heart_of_creation.png',
            void_blade: '/images/relics/void_blade.png',
            eternity_engine: '/images/relics/eternity_engine.png',
            galactic_core: '/images/relics/galactic_core.png',
        });
        
        // Species portraits (load on-demand when viewing species info)
        this._registerCategory('species', {
            aquari: '/images/species/aquari.png',
            celesti: '/images/species/celesti.png',
            krath: '/images/species/krath.png',
            mechani: '/images/species/mechani.png',
            pyronix: '/images/species/pyronix.png',
            synthari: '/images/species/synthari.png',
            terrax: '/images/species/terrax.png',
            umbral: '/images/species/umbral.png',
            velthari: '/images/species/velthari.png',
            voidborn: '/images/species/voidborn.png',
        });
        
        console.log(`\u{1F4E6} AssetLoader: ${this._stats.registered} sprites registered for lazy loading`);
    }
    
    /**
     * Register a category of sprites
     */
    _registerCategory(category, sprites) {
        if (!this._registry.has(category)) {
            this._registry.set(category, new Map());
            this._loaded.set(category, new Map());
        }
        const categoryMap = this._registry.get(category);
        for (const [key, path] of Object.entries(sprites)) {
            categoryMap.set(key, path);
            this._stats.registered++;
        }
    }
    
    /**
     * Get a sprite. Returns Image if loaded, null if pending/not started.
     * Automatically triggers load if not started.
     * @param {string} category - Sprite category (ships, structures, etc.)
     * @param {string} key - Sprite key within category
     * @returns {Image|null}
     */
    get(category, key) {
        // Check if already loaded
        const loadedCategory = this._loaded.get(category);
        if (loadedCategory?.has(key)) {
            return loadedCategory.get(key);
        }
        
        // Check if failed (don't retry)
        const cacheKey = `${category}:${key}`;
        if (this._failed.has(cacheKey)) {
            return null;
        }
        
        // Check if pending
        if (this._pending.has(cacheKey)) {
            return null;
        }
        
        // Not in registry?
        const registryCategory = this._registry.get(category);
        if (!registryCategory?.has(key)) {
            return null;
        }
        
        // Start loading
        this._loadSprite(category, key);
        return null;
    }
    
    /**
     * Start loading a sprite asynchronously
     */
    _loadSprite(category, key) {
        const cacheKey = `${category}:${key}`;
        const path = this._registry.get(category).get(key);
        
        this._pending.add(cacheKey);
        this._stats.pending++;
        
        const img = new Image();
        img.onload = () => {
            this._loaded.get(category).set(key, img);
            this._pending.delete(cacheKey);
            this._stats.pending--;
            this._stats.loaded++;
            
            // Fire any callbacks waiting for this asset
            const callbacks = this._callbacks.get(cacheKey);
            if (callbacks) {
                callbacks.forEach(cb => cb(img));
                this._callbacks.delete(cacheKey);
            }
        };
        img.onerror = () => {
            console.warn(`Failed to load sprite: ${path}`);
            this._pending.delete(cacheKey);
            this._failed.add(cacheKey);
            this._stats.pending--;
            this._stats.failed++;
        };
        img.src = path;
    }
    
    /**
     * Preload a category of sprites (for critical assets)
     * @param {string} category - Category to preload
     * @param {string[]} [keys] - Optional specific keys, or all if not provided
     */
    preloadCategory(category, keys = null) {
        const registryCategory = this._registry.get(category);
        if (!registryCategory) return;
        
        const toLoad = keys || Array.from(registryCategory.keys());
        toLoad.forEach(key => this.get(category, key));
    }
    
    /**
     * Preload specific sprites by full path (category:key pairs)
     * @param {string[]} paths - Array of "category:key" strings
     */
    preload(paths) {
        paths.forEach(path => {
            const [category, key] = path.split(':');
            this.get(category, key);
        });
    }
    
    /**
     * Wait for a specific sprite to load
     * @param {string} category 
     * @param {string} key 
     * @returns {Promise<Image|null>}
     */
    async waitFor(category, key) {
        // If already loaded, return immediately
        const existing = this.get(category, key);
        if (existing) return existing;
        
        // If failed, return null
        const cacheKey = `${category}:${key}`;
        if (this._failed.has(cacheKey)) return null;
        
        // Wait for load
        return new Promise(resolve => {
            if (!this._callbacks.has(cacheKey)) {
                this._callbacks.set(cacheKey, []);
            }
            this._callbacks.get(cacheKey).push(resolve);
        });
    }
    
    /**
     * Get loading stats
     */
    getStats() {
        return { ...this._stats };
    }
    
    /**
     * Check if a sprite is loaded
     */
    isLoaded(category, key) {
        return this._loaded.get(category)?.has(key) || false;
    }
    
    /**
     * Check if a sprite is currently loading
     */
    isPending(category, key) {
        return this._pending.has(`${category}:${key}`);
    }
}

// Singleton instance
export const assetLoader = new AssetLoader();
