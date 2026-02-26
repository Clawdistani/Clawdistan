// Canvas renderer for universe visualization
// Performance-optimized with MULTI-LAYER CANVAS ARCHITECTURE
// Layers: Background (static) → Game Objects (tick-based) → UI (interactive)
// Modularized: planet-view and fleet-renderer extracted to ./render/

import { drawPlanetView } from './render/planet-view.js';
import { drawFleets as drawFleetsModule, drawVectorShip as drawVectorShipModule } from './render/fleet-renderer.js';

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        // Request GPU-optimized context
        this.ctx = canvas.getContext('2d', {
            alpha: false,        // No transparency needed for background
            desynchronized: true // Allow async rendering for better performance
        });
        
        // PERFORMANCE: Bind integer rounding helper for sub-pixel anti-aliasing avoidance
        // Using bitwise OR is faster than Math.floor for positive numbers
        this._r = (n) => (n + 0.5) | 0; // Round to nearest integer
        
        // Enable high-quality image rendering
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
        
        this.camera = {
            x: 500,
            y: 500,
            zoom: 0.5,
            targetZoom: 0.5
        };
        this.viewMode = 'universe';
        this.selectedObject = null;
        this.currentPlanetId = null;
        this.hoveredObject = null;
        this.empireColors = {};
        this.mouseWorld = { x: 0, y: 0 };
        this.highlightedEmpires = [];
        this.highlightPulse = 0;
        
        // Performance: Caching system
        this._gradientCache = new Map();
        this._imageCache = new Map();
        this._starfieldCache = null;
        this._lastState = null;
        this._frameCount = 0;
        this._animFrame = 0;
        this._lastAnimTime = 0;
        
        // Performance: Planet terrain cache
        this._terrainCache = null;
        this._terrainCacheKey = null;
        
        // Performance: Throttle hover detection
        this._hoverThrottle = 0;
        
        // Performance: Viewport culling bounds (updated each frame)
        this._viewBounds = { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };
        this._cullStats = { total: 0, culled: 0 }; // For debugging
        
        // ===== OFFSCREEN SPRITE CACHE =====
        // Pre-rendered sprites for common elements (stars, wormholes, UI panels)
        this._spriteCache = new Map();
        this._initSpriteCache();
        
        // ===== MULTI-LAYER CANVAS ARCHITECTURE =====
        // Layer 1: Background (starfield) - only redraws on resize
        // Layer 2: Game objects (systems, planets, fleets) - redraws on tick/camera change
        // Layer 3: UI overlay (hover, tooltips) - redraws every frame
        this._initLayers();
        
        // Sprite system
        this._sprites = {};
        this._spritesLoaded = false;
        this._loadSprites();

        this.resize();
        window.addEventListener('resize', () => {
            this.resize();
            this._invalidateAllLayers();
        });
        this.setupMouseHandlers();
    }
    
    /**
     * MULTI-LAYER: Initialize offscreen canvas layers
     * Each layer only redraws when its content changes
     */
    _initLayers() {
        // Game layer: systems, planets, fleets, trade routes
        // Redraws when: tick changes, camera moves, view mode changes
        this._gameLayer = document.createElement('canvas');
        this._gameLayerCtx = this._gameLayer.getContext('2d', { alpha: true });
        this._gameLayerDirty = true;
        
        // Track state for dirty detection
        this._lastTick = -1;
        this._lastCameraX = -1;
        this._lastCameraY = -1;
        this._lastCameraZoom = -1;
        this._lastViewMode = null;
        this._lastSelectedId = null;
        
        // Animation layer: for animated elements (crisis, cycles, fleets)
        // Redraws every few frames for smooth animations
        this._animationLayerDirty = true;
        this._lastAnimTick = 0;
    }
    
    /**
     * OFFSCREEN SPRITE CACHE: Pre-render common graphical elements
     * Creates offscreen canvases for star glows, wormholes, UI panels
     * Called once at startup, sprites are reused via drawImage (much faster than gradients)
     */
    _initSpriteCache() {
        // Star glow sprites (one per star color)
        const starColors = {
            yellow: '#ffff00',
            red: '#ff4444',
            blue: '#4444ff',
            white: '#ffffff',
            orange: '#ff8800'
        };
        
        // Create star glow sprites at different sizes for normal/hover states
        Object.entries(starColors).forEach(([name, color]) => {
            // Normal size (glowRadius=8, core=3)
            this._spriteCache.set(`star_${name}`, this._createStarGlowSprite(color, 8, 3));
            // Hover size (glowRadius=12, core=5)
            this._spriteCache.set(`star_${name}_hover`, this._createStarGlowSprite(color, 12, 5));
        });
        
        // Wormhole portal sprite (base pattern without animation)
        this._spriteCache.set('wormhole_base', this._createWormholeSprite('#a855f7'));
        
        // Pre-render common UI panel backgrounds
        this._spriteCache.set('panel_dark_small', this._createPanelSprite(160, 140, 'rgba(15, 20, 35, 0.95)'));
        this._spriteCache.set('panel_dark_med', this._createPanelSprite(200, 200, 'rgba(15, 20, 35, 0.95)'));
        
        console.log(`🎨 Sprite cache initialized: ${this._spriteCache.size} sprites`);
    }
    
    /**
     * Create a pre-rendered star glow sprite
     * @param {string} color - Star color (hex)
     * @param {number} glowRadius - Outer glow radius
     * @param {number} coreRadius - Inner solid radius
     * @returns {HTMLCanvasElement} Offscreen canvas with star glow
     */
    _createStarGlowSprite(color, glowRadius, coreRadius) {
        const size = (glowRadius + 2) * 2; // Add padding
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        const cx = size / 2;
        const cy = size / 2;
        
        // Outer glow gradient
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Solid core
        ctx.beginPath();
        ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        
        return canvas;
    }
    
    /**
     * Create a pre-rendered wormhole portal sprite (base pattern)
     * @param {string} color - Portal color (hex)
     * @returns {HTMLCanvasElement} Offscreen canvas with wormhole base
     */
    _createWormholeSprite(color) {
        const size = 90; // Large enough for universe view
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        const cx = size / 2;
        const cy = size / 2;
        
        // Outer glow
        ctx.beginPath();
        ctx.arc(cx, cy, 35, 0, Math.PI * 2);
        ctx.fillStyle = `${color}25`;
        ctx.fill();
        
        // Middle ring
        ctx.beginPath();
        ctx.arc(cx, cy, 20, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Inner portal
        ctx.beginPath();
        ctx.arc(cx, cy, 12, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        
        // Center void (black hole effect)
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#000';
        ctx.fill();
        
        return canvas;
    }
    
    /**
     * Create a pre-rendered UI panel background sprite
     * @param {number} width - Panel width
     * @param {number} height - Panel height
     * @param {string} color - Background color
     * @returns {HTMLCanvasElement} Offscreen canvas with panel
     */
    _createPanelSprite(width, height, color) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        // Gradient background
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, 'rgba(8, 12, 24, 0.95)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(0, 0, width, height, 8);
        ctx.fill();
        
        // Border
        ctx.strokeStyle = 'rgba(0, 212, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        return canvas;
    }
    
    /**
     * Get a cached star sprite by color and hover state
     * @param {string} starType - Star type (yellow, red, blue, white, orange)
     * @param {boolean} isHovered - Whether star is hovered
     * @returns {HTMLCanvasElement|null} Cached sprite or null
     */
    _getStarSprite(starType, isHovered = false) {
        const key = `star_${starType}${isHovered ? '_hover' : ''}`;
        return this._spriteCache.get(key) || this._spriteCache.get('star_yellow');
    }
    
    /**
     * MULTI-LAYER: Resize all layer canvases
     */
    _resizeLayers() {
        const { width, height } = this.canvas;
        
        if (this._gameLayer) {
            this._gameLayer.width = width;
            this._gameLayer.height = height;
            this._gameLayerDirty = true;
        }
    }
    
    /**
     * MULTI-LAYER: Invalidate all layers (e.g., on resize)
     */
    _invalidateAllLayers() {
        this._starfieldCache = null;
        this._gameLayerDirty = true;
        this._animationLayerDirty = true;
        this._terrainCache = null;
    }
    
    /**
     * MULTI-LAYER: Check if game layer needs redraw
     * Returns true if tick changed, camera moved significantly, or view changed
     */
    _isGameLayerDirty(state) {
        if (this._gameLayerDirty) return true;
        
        // Tick changed = game state updated
        if (state.tick !== this._lastTick) return true;
        
        // Camera moved significantly (more than 1 pixel)
        const cameraMoved = Math.abs(this.camera.x - this._lastCameraX) > 1 ||
                          Math.abs(this.camera.y - this._lastCameraY) > 1 ||
                          Math.abs(this.camera.zoom - this._lastCameraZoom) > 0.01;
        if (cameraMoved) return true;
        
        // View mode changed
        if (this.viewMode !== this._lastViewMode) return true;
        
        // Selection changed (affects highlighting)
        const selectedId = this.selectedObject?.id || null;
        if (selectedId !== this._lastSelectedId) return true;
        
        return false;
    }
    
    /**
     * MULTI-LAYER: Update dirty tracking after render
     */
    _updateLayerState(state) {
        this._lastTick = state.tick;
        this._lastCameraX = this.camera.x;
        this._lastCameraY = this.camera.y;
        this._lastCameraZoom = this.camera.zoom;
        this._lastViewMode = this.viewMode;
        this._lastSelectedId = this.selectedObject?.id || null;
        this._gameLayerDirty = false;
    }
    
    // Cache a gradient for reuse
    getCachedGradient(key, createFn) {
        if (!this._gradientCache.has(key)) {
            this._gradientCache.set(key, createFn());
        }
        return this._gradientCache.get(key);
    }
    
    // Clear caches (call when state changes significantly)
    // Note: _spriteCache is NOT cleared - these are static pre-rendered sprites
    clearCaches() {
        this._gradientCache.clear();
        this._starfieldCache = null;
    }
    
    // Force regenerate sprite cache (call if theme changes)
    regenerateSpriteCache() {
        this._spriteCache.clear();
        this._initSpriteCache();
    }
    
    /**
     * PERFORMANCE: Update viewport bounds for culling
     * Call once per frame before drawing objects
     */
    updateViewBounds() {
        const { width, height } = this.canvas;
        const zoom = this.camera.zoom;
        const cx = this.camera.x;
        const cy = this.camera.y;
        
        // Calculate world-space viewport bounds with padding for objects near edges
        const padding = 50; // Extra padding for large objects (galaxies, systems with rings)
        this._viewBounds = {
            minX: cx - (width / 2 / zoom) - padding,
            maxX: cx + (width / 2 / zoom) + padding,
            minY: cy - (height / 2 / zoom) - padding,
            maxY: cy + (height / 2 / zoom) + padding
        };
        
        // Reset culling stats for this frame
        this._cullStats = { total: 0, culled: 0 };
    }
    
    /**
     * PERFORMANCE: Check if a point/object is visible in viewport
     * @param {number} x - World X coordinate
     * @param {number} y - World Y coordinate  
     * @param {number} radius - Object radius (default 0 for points)
     * @returns {boolean} - True if object is at least partially visible
     */
    isInViewport(x, y, radius = 0) {
        const b = this._viewBounds;
        this._cullStats.total++;
        
        // Fast AABB check with radius
        if (x + radius < b.minX || x - radius > b.maxX ||
            y + radius < b.minY || y - radius > b.maxY) {
            this._cullStats.culled++;
            return false;
        }
        return true;
    }
    
    // Load sprite images for ships, etc.
    _loadSprites() {
        const basePath = '/assets/sprites/kenney-redux/PNG';
        
        // Ship sprites mapped to empire colors
        const shipSprites = {
            // Player ships (by color)
            red: `${basePath}/playerShip1_red.png`,
            green: `${basePath}/playerShip2_green.png`,
            blue: `${basePath}/playerShip3_blue.png`,
            yellow: `${basePath}/playerShip1_orange.png`,
            // Enemy ships for hostile fleets
            enemy: `${basePath}/Enemies/enemyRed3.png`,
            // UFO for special units
            ufo: `${basePath}/ufoBlue.png`,
        };
        
        // Meteor sprites for asteroids
        const meteorSprites = {
            brown: `${basePath}/Meteors/meteorBrown_big1.png`,
            grey: `${basePath}/Meteors/meteorGrey_big1.png`,
        };
        
        // Load all sprites
        let loadedCount = 0;
        const totalSprites = Object.keys(shipSprites).length + Object.keys(meteorSprites).length;
        
        const loadImage = (key, src, category) => {
            const img = new Image();
            img.onload = () => {
                if (!this._sprites[category]) this._sprites[category] = {};
                this._sprites[category][key] = img;
                loadedCount++;
                if (loadedCount >= totalSprites) {
                    this._spritesLoaded = true;
                    console.log('🎨 All sprites loaded!');
                }
            };
            img.onerror = () => {
                console.warn(`Failed to load sprite: ${src}`);
                loadedCount++;
            };
            img.src = src;
        };
        
        // Load ship sprites
        Object.entries(shipSprites).forEach(([key, src]) => loadImage(key, src, 'ships'));
        Object.entries(meteorSprites).forEach(([key, src]) => loadImage(key, src, 'meteors'));
    }
    
    // Get sprite for an empire based on color
    getShipSprite(empireColor) {
        if (!this._spritesLoaded || !this._sprites.ships) return null;
        
        // Normalize color to lowercase for comparison
        const color = empireColor?.toLowerCase() || '';
        
        // Map empire hex colors to sprite keys
        // Order matters - check more specific patterns first
        if (color.includes('ff4444') || color === '#ff4444') return this._sprites.ships.red;
        if (color.includes('44ff44') || color === '#44ff44') return this._sprites.ships.green;
        if (color.includes('4444ff') || color === '#4444ff') return this._sprites.ships.blue;
        if (color.includes('ffff44') || color === '#ffff44') return this._sprites.ships.yellow;
        
        // Fallback color matching by hue detection
        if (color.includes('ff') && !color.includes('44ff') && !color.includes('ffff')) return this._sprites.ships.red;
        if (color.startsWith('#44ff') || color.startsWith('#4f') || color.includes('green')) return this._sprites.ships.green;
        if (color.endsWith('ff') && color.includes('44')) return this._sprites.ships.blue;
        if (color.includes('ff') && color.includes('44') && color.indexOf('ff') < color.indexOf('44')) return this._sprites.ships.yellow;
        
        // Default to blue
        return this._sprites.ships.blue;
    }

    resize() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        
        // MULTI-LAYER: Resize all offscreen layers
        this._resizeLayers();
    }

    setupMouseHandlers() {
        this._isDragging = false;
        let lastX, lastY;

        this.canvas.addEventListener('mousedown', (e) => {
            this._isDragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (this._isDragging) {
                const dx = e.clientX - lastX;
                const dy = e.clientY - lastY;
                this.camera.x -= dx / this.camera.zoom;
                this.camera.y -= dy / this.camera.zoom;
                lastX = e.clientX;
                lastY = e.clientY;
            }
            this.updateHover(e);
        });

        this.canvas.addEventListener('mouseup', () => this._isDragging = false);
        this.canvas.addEventListener('mouseleave', () => this._isDragging = false);

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
            this.camera.targetZoom = Math.max(0.1, Math.min(5, this.camera.targetZoom * zoomFactor));
        });

        this.canvas.addEventListener('click', (e) => {
            // Check for tile clicks in planet view first
            if (this.handleTileClick(e)) {
                return;
            }
            
            // Check for planet clicks in system view first
            if (this.handleSystemClick()) {
                return;
            }

            if (this.hoveredObject) {
                this.selectedObject = this.hoveredObject;
                
                // Center camera on clicked object (supports x/y or screenX/screenY)
                this.centerOn(this.hoveredObject);
                
                if (this.hoveredObject.id?.startsWith('planet')) {
                    this.currentPlanetId = this.hoveredObject.id;
                    window.SoundFX?.play('zoomToPlanet');
                } else if (this.hoveredObject.id?.startsWith('galaxy')) {
                    // Clicked a galaxy - switch to galaxy view
                    window.SoundFX?.play('zoomToGalaxy');
                    this.onViewChange?.('galaxy');
                } else if (this.hoveredObject.id?.startsWith('system')) {
                    // Clicked a system - switch to system view
                    window.SoundFX?.play('zoomToSystem');
                    this.onViewChange?.('system');
                } else if (this.hoveredObject.id?.startsWith('wormhole')) {
                    // Clicked a wormhole - zoom to its system
                    window.SoundFX?.play('warp');
                    // Find the system this wormhole is in and select it
                    const wormholeSystem = this.cachedSystems?.find(s => s.id === this.hoveredObject.systemId);
                    if (wormholeSystem) {
                        this.selectedObject = wormholeSystem;
                        this.centerOn(wormholeSystem);
                        this.onViewChange?.('system');
                        this.onSelect?.(wormholeSystem);
                    }
                    return; // Early return to avoid double onSelect
                } else {
                    // Generic map click sound
                    window.SoundFX?.play('mapClick');
                }
                
                this.onSelect?.(this.selectedObject);
            }
        });

        this.canvas.addEventListener('dblclick', () => {
            if (this.hoveredObject) {
                // Double-click on wormhole: teleport to destination!
                if (this.hoveredObject.pairId && this.cachedWormholes) {
                    const destWormhole = this.cachedWormholes.find(w => w.id === this.hoveredObject.pairId);
                    if (destWormhole) {
                        window.SoundFX?.play('warp');
                        const destSystem = this.cachedSystems?.find(s => s.id === destWormhole.systemId);
                        if (destSystem) {
                            this.selectedObject = destSystem;
                            this.centerOn(destSystem);
                            this.onViewChange?.('system');
                            this.onSelect?.(destSystem);
                            return;
                        }
                    }
                }
                // Play warp sound for double-click zoom
                window.SoundFX?.play('warp');
                this.zoomTo(this.hoveredObject);
            }
        });
    }

    updateHover(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left - this.canvas.width / 2) / this.camera.zoom + this.camera.x;
        const mouseY = (e.clientY - rect.top - this.canvas.height / 2) / this.camera.zoom + this.camera.y;
        this.mouseWorld = { x: mouseX, y: mouseY };
        this.mouseScreen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        
        // Throttle hover detection for performance (every 2 frames)
        this._hoverThrottle++;
        if (this._hoverThrottle % 2 === 0) {
            this.detectHover();
            // Also update system view planet hover
            if (this.viewMode === 'system') {
                this.updateSystemHover();
            }
        }
    }

    detectHover() {
        const mx = this.mouseWorld.x;
        const my = this.mouseWorld.y;
        this.hoveredObject = null;

        if (this.viewMode === 'universe' || this.viewMode === 'galaxy') {
            // Check wormholes first (they render on top)
            if (this.cachedWormholes) {
                for (const wormhole of this.cachedWormholes) {
                    const dist = Math.sqrt(Math.pow(mx - wormhole.x, 2) + Math.pow(my - wormhole.y, 2));
                    if (dist <= 20) { // Wormhole markers are larger
                        this.hoveredObject = wormhole;
                        return;
                    }
                }
            }
            
            // Check systems
            if (this.cachedSystems) {
                for (const system of this.cachedSystems) {
                    const dist = Math.sqrt(Math.pow(mx - system.x, 2) + Math.pow(my - system.y, 2));
                    if (dist <= 15) {
                        this.hoveredObject = system;
                        return;
                    }
                }
            }
            
            // Check galaxies (universe view only)
            if (this.viewMode === 'universe' && this.cachedGalaxies) {
                for (const galaxy of this.cachedGalaxies) {
                    const dist = Math.sqrt(Math.pow(mx - galaxy.x, 2) + Math.pow(my - galaxy.y, 2));
                    if (dist <= galaxy.radius) {
                        this.hoveredObject = galaxy;
                        return;
                    }
                }
            }
        }
        // System view hover is handled by updateSystemHover
    }

    setViewMode(mode) {
        this.viewMode = mode;
        this._gameLayerDirty = true; // MULTI-LAYER: Force redraw on view change
        this.fitView();
    }

    setCurrentPlanet(planetId) {
        this.currentPlanetId = planetId;
        this._gameLayerDirty = true; // MULTI-LAYER: Force redraw on planet change
    }

    fitView() {
        this.camera.x = 500;
        this.camera.y = 500;
        this.camera.targetZoom = this.viewMode === 'universe' ? 0.5 : 1;
    }

    zoomTo(object) {
        if (object.x !== undefined && object.y !== undefined) {
            this.camera.x = object.x;
            this.camera.y = object.y;
            this.camera.targetZoom = 2;
        }
    }

    // Center camera on object without changing zoom
    // Supports x/y (systems, galaxies) or screenX/screenY (planets in system view)
    centerOn(object) {
        if (object.screenX !== undefined && object.screenY !== undefined) {
            this.camera.x = object.screenX;
            this.camera.y = object.screenY;
        } else if (object.x !== undefined && object.y !== undefined) {
            this.camera.x = object.x;
            this.camera.y = object.y;
        }
    }

    render(state) {
        const ctx = this.ctx;
        const { width, height } = this.canvas;
        
        // Track frames for animations (throttled to ~20fps for animations)
        this._frameCount++;
        const now = performance.now();
        if (now - this._lastAnimTime > 50) {
            this._animFrame++;
            this._lastAnimTime = now;
        }
        // Cache animation time for consistent use (avoid multiple Date.now() calls)
        this._animTime = now;

        // Smooth zoom interpolation with snap-to-target
        const zoomDelta = Math.abs(this.camera.targetZoom - this.camera.zoom);
        this._isZooming = zoomDelta > 0.01; // Higher threshold for smoother UX
        if (zoomDelta < 0.005) {
            // Snap to target when very close (avoids floating point precision issues)
            this.camera.zoom = this.camera.targetZoom;
        } else {
            this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * 0.12;
        }

        // ===== MULTI-LAYER CANVAS ARCHITECTURE =====
        // Only redraw layers that have changed for significant performance gains
        
        if (!state) {
            // No state - just clear and return
            ctx.fillStyle = '#050510';
            ctx.fillRect(0, 0, width, height);
            return;
        }
        
        // Cache state for fleet ETA calculations
        this._lastState = state;
        
        // PERFORMANCE: Pre-compute entity location maps once per frame
        this._precomputeEntityLocations(state);
        
        // PERFORMANCE: Update viewport bounds for frustum culling
        this.updateViewBounds();
        
        // Check if game layer needs redraw
        const gameLayerDirty = this._isGameLayerDirty(state);
        
        // Animated elements check (fleets, crisis effects, cycles)
        // Animate every 3 frames (~20fps) for smooth visuals without full redraw cost
        const needsAnimation = (this._frameCount - this._lastAnimTick) >= 3 || gameLayerDirty;
        
        if (gameLayerDirty || needsAnimation) {
            // Redraw game layer to offscreen canvas
            this._renderGameLayer(state);
            this._updateLayerState(state);
            if (needsAnimation) this._lastAnimTick = this._frameCount;
        }
        
        // === COMPOSITE LAYERS TO MAIN CANVAS ===
        
        // Layer 1: Background (space color + starfield)
        ctx.fillStyle = '#050510';
        ctx.fillRect(0, 0, width, height);
        
        // Draw starfield directly (already cached internally)
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.scale(this.camera.zoom, this.camera.zoom);
        ctx.translate(-this.camera.x, -this.camera.y);
        this.drawStarfield(ctx);
        ctx.restore();
        
        // Layer 2: Game objects (from cached game layer)
        if (this._gameLayer && this._gameLayer.width > 0) {
            ctx.drawImage(this._gameLayer, 0, 0);
        }
        
        // Layer 3: UI overlay (hover effects, tooltips - always fresh)
        this._renderUILayer(ctx, state);
    }
    
    /**
     * MULTI-LAYER: Render game objects to offscreen canvas
     * Only called when state changes (tick, camera, view mode)
     */
    _renderGameLayer(state) {
        const gctx = this._gameLayerCtx;
        const { width, height } = this._gameLayer;
        
        // Clear with transparency (we composite over background)
        gctx.clearRect(0, 0, width, height);
        
        // Apply camera transform
        gctx.save();
        gctx.translate(width / 2, height / 2);
        gctx.scale(this.camera.zoom, this.camera.zoom);
        gctx.translate(-this.camera.x, -this.camera.y);
        
        // Draw game objects based on view mode
        switch (this.viewMode) {
            case 'universe':
                this.drawUniverse(gctx, state);
                this.drawFleets(gctx, state, 'universe');
                break;
            case 'galaxy':
                this.drawGalaxy(gctx, state);
                this.drawFleets(gctx, state, 'galaxy');
                break;
            case 'system':
                this.drawSystem(gctx, state);
                this.drawFleets(gctx, state, 'system');
                break;
            case 'planet':
                this.drawPlanet(gctx, state);
                break;
        }
        
        gctx.restore();
    }
    
    /**
     * MULTI-LAYER: Render UI overlay (hover effects, tooltips)
     * Always renders fresh for responsive interaction
     */
    _renderUILayer(ctx, state) {
        const { width, height } = this.canvas;
        
        // Transform for world-space UI elements
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.scale(this.camera.zoom, this.camera.zoom);
        ctx.translate(-this.camera.x, -this.camera.y);
        
        // Draw wormhole tunnel effect in world space
        if (this.hoveredObject?.pairId && state) {
            this.drawWormholeTunnel(ctx, state);
        }
        
        ctx.restore();
        
        // Screen-space UI overlay
        this.drawOverlay(ctx, state);
        
        // Draw wormhole tooltip on top of everything
        if (this.hoveredObject?.pairId && state) {
            this.drawWormholeTooltip(ctx, state);
        }
    }
    
    /**
     * Draw a dim wiggly tunnel connecting hovered wormhole to its destination
     * Performance: Simple bezier with animated offset, no per-pixel calculations
     */
    drawWormholeTunnel(ctx, state) {
        const wormhole = this.hoveredObject;
        const systems = state.universe?.solarSystems || [];
        const wormholes = state.universe?.wormholes || [];
        
        // Find source and destination systems
        const sourceSystem = systems.find(s => s.id === wormhole.systemId);
        const pairedWormhole = wormholes.find(w => w.id === wormhole.pairId);
        if (!sourceSystem || !pairedWormhole) return;
        
        const destSystem = systems.find(s => s.id === pairedWormhole.systemId);
        if (!destSystem) return;
        
        const x1 = sourceSystem.x;
        const y1 = sourceSystem.y;
        const x2 = destSystem.x;
        const y2 = destSystem.y;
        
        // Animation time for wiggle
        const time = (this._animTime || Date.now()) / 1000;
        const wiggleAmp = 20; // Wiggle amplitude
        const wiggleFreq = 3; // Number of waves
        
        ctx.save();
        
        // Draw multiple slightly offset paths for a "tunnel" effect
        const color = wormhole.color || '#a855f7';
        
        for (let layer = 2; layer >= 0; layer--) {
            const alpha = 0.15 - layer * 0.04;
            const width = 8 - layer * 2;
            
            ctx.strokeStyle = color;
            ctx.globalAlpha = alpha;
            ctx.lineWidth = width;
            ctx.lineCap = 'round';
            
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            
            // Draw wiggly bezier curve
            const segments = 20;
            for (let i = 1; i <= segments; i++) {
                const t = i / segments;
                const px = x1 + (x2 - x1) * t;
                const py = y1 + (y2 - y1) * t;
                
                // Perpendicular offset for wiggle
                const dx = x2 - x1;
                const dy = y2 - y1;
                const len = Math.sqrt(dx * dx + dy * dy);
                const nx = -dy / len; // Normal x
                const ny = dx / len;  // Normal y
                
                // Sine wave wiggle with animation
                const wiggle = Math.sin(t * Math.PI * wiggleFreq + time * 2 + layer) * wiggleAmp * Math.sin(t * Math.PI);
                
                ctx.lineTo(px + nx * wiggle, py + ny * wiggle);
            }
            
            ctx.stroke();
        }
        
        // Draw flowing particles along the tunnel (just a few dots)
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#fff';
        for (let i = 0; i < 5; i++) {
            const t = ((time * 0.3 + i * 0.2) % 1);
            const px = x1 + (x2 - x1) * t;
            const py = y1 + (y2 - y1) * t;
            
            // Same wiggle calculation
            const dx = x2 - x1;
            const dy = y2 - y1;
            const len = Math.sqrt(dx * dx + dy * dy);
            const nx = -dy / len;
            const ny = dx / len;
            const wiggle = Math.sin(t * Math.PI * wiggleFreq + time * 2) * wiggleAmp * Math.sin(t * Math.PI);
            
            ctx.beginPath();
            ctx.arc(px + nx * wiggle, py + ny * wiggle, 2, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }
    
    /**
     * Draw tooltip showing wormhole destination
     */
    drawWormholeTooltip(ctx, state) {
        const wormhole = this.hoveredObject;
        const wormholes = state.universe?.wormholes || [];
        const systems = state.universe?.solarSystems || [];
        
        // Find the paired wormhole
        const pairedWormhole = wormholes.find(w => w.id === wormhole.pairId);
        if (!pairedWormhole) return;
        
        // Find destination system
        const destSystem = systems.find(s => s.id === pairedWormhole.systemId);
        if (!destSystem) return;
        
        // Find destination galaxy
        const destGalaxy = state.universe?.galaxies?.find(g => g.id === destSystem.galaxyId);
        
        // Get owner info
        const owner = wormhole.ownerId ? state.empires?.find(e => e.id === wormhole.ownerId) : null;
        
        // Build tooltip text
        const lines = [
            `🌀 ${wormhole.name}`,
            `→ ${destSystem.name}`,
            destGalaxy ? `   (${destGalaxy.name})` : null,
            owner ? `👑 ${owner.name}` : '⚪ Unclaimed',
            '✨ Instant Travel'
        ].filter(Boolean);
        
        // Calculate position (use screen coordinates near mouse)
        const padding = 10;
        const lineHeight = 18;
        const tooltipWidth = 160;
        const tooltipHeight = lines.length * lineHeight + padding * 2;
        
        // Position tooltip near mouse but keep on screen
        let tx = this.mouseScreen?.x ?? this.canvas.width / 2;
        let ty = this.mouseScreen?.y ?? this.canvas.height / 2;
        tx += 20; // Offset from cursor
        ty -= tooltipHeight / 2;
        
        // Keep on screen
        if (tx + tooltipWidth > this.canvas.width - 10) {
            tx = this.mouseScreen.x - tooltipWidth - 20;
        }
        if (ty < 10) ty = 10;
        if (ty + tooltipHeight > this.canvas.height - 10) {
            ty = this.canvas.height - tooltipHeight - 10;
        }
        
        // Draw tooltip background
        ctx.save();
        ctx.fillStyle = 'rgba(20, 10, 40, 0.95)';
        ctx.strokeStyle = wormhole.color || '#a855f7';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(tx, ty, tooltipWidth, tooltipHeight, 8);
        ctx.fill();
        ctx.stroke();
        
        // Draw text
        ctx.font = '12px "Segoe UI", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        
        lines.forEach((line, i) => {
            ctx.fillStyle = i === 0 ? (wormhole.color || '#a855f7') : 
                           line.startsWith('→') ? '#00d9ff' :
                           line.startsWith('👑') ? (owner?.color || '#ffd700') :
                           '#e0e0e0';
            ctx.fillText(line, tx + padding, ty + padding + i * lineHeight);
        });
        
        ctx.restore();
    }
    
    /**
     * PERFORMANCE: Pre-compute entity locations to avoid O(n²) lookups
     * Call once per frame, then use cached Maps for fast lookups
     */
    _precomputeEntityLocations(state) {
        // Only recompute if tick changed (entities changed)
        if (this._cachedTick === state.tick) return;
        this._cachedTick = state.tick;
        
        // Combine entities + visibleEnemies
        const allEntities = [...(state.entities || []), ...(state.visibleEnemies || [])];
        
        // Map: planetId -> array of entities
        this._entitiesByPlanet = new Map();
        // Map: systemId -> array of crisis entities (for system icons)
        this._crisisBySystem = new Map();
        
        // Build planet-to-system map
        const planetToSystem = new Map();
        state.universe?.planets?.forEach(p => planetToSystem.set(p.id, p.systemId));
        
        for (const entity of allEntities) {
            const planetId = entity.location;
            if (!planetId) continue;
            
            // Add to planet map
            if (!this._entitiesByPlanet.has(planetId)) {
                this._entitiesByPlanet.set(planetId, []);
            }
            this._entitiesByPlanet.get(planetId).push(entity);
            
            // Track crisis units by system for system icons
            if (entity.owner?.startsWith('crisis_')) {
                const systemId = planetToSystem.get(planetId);
                if (systemId) {
                    if (!this._crisisBySystem.has(systemId)) {
                        this._crisisBySystem.set(systemId, []);
                    }
                    this._crisisBySystem.get(systemId).push(entity);
                }
            }
        }
    }

    drawStarfield(ctx) {
        // Use cached starfield for performance
        if (!this._starfieldCache) {
            // Create offscreen canvas for starfield
            const offscreen = document.createElement('canvas');
            offscreen.width = 1000;
            offscreen.height = 1000;
            const offCtx = offscreen.getContext('2d');
            
            // Draw stars once
            const seed = 12345;
            for (let i = 0; i < 250; i++) {
                const x = (Math.sin(seed * i) * 10000) % 1000;
                const y = (Math.cos(seed * i) * 10000) % 1000;
                const size = ((i * 7) % 3) + 0.5;
                const alpha = 0.2 + ((i * 13) % 60) / 100;
                
                // Varied star colors for realism
                const colorVariant = i % 5;
                const colors = ['255,255,255', '200,220,255', '255,240,200', '180,200,255', '255,255,230'];
                offCtx.fillStyle = `rgba(${colors[colorVariant]}, ${alpha})`;
                offCtx.fillRect(x, y, size, size);
            }
            
            this._starfieldCache = offscreen;
        }
        
        // Draw cached starfield (GPU-optimized pattern)
        ctx.drawImage(this._starfieldCache, 0, 0, 1000, 1000);
    }

    drawUniverse(ctx, state) {
        const universe = state.universe;
        if (!universe) return;

        // Cache for hover detection
        this.cachedGalaxies = universe.galaxies || [];
        this.cachedSystems = universe.solarSystems || [];
        this.cachedPlanets = universe.planets || [];
        this.cachedEntities = state.entities || [];
        
        // Cache wormholes with their positions for hover detection
        const systemMap = new Map();
        this.cachedSystems.forEach(s => systemMap.set(s.id, s));
        this.cachedWormholes = (universe.wormholes || []).map(w => {
            const system = systemMap.get(w.systemId);
            return system ? { ...w, x: system.x, y: system.y } : null;
        }).filter(Boolean);

        universe.galaxies?.forEach(galaxy => {
            this.drawGalaxyIcon(ctx, galaxy, state);
        });

        universe.solarSystems?.forEach(system => {
            this.drawSystemIcon(ctx, system, state);
        });
        
        // Draw strategic wormhole markers on universe view
        this.drawStrategicWormholes(ctx, state);
    }
    
    /**
     * Draw strategic wormhole markers in universe view
     * Shows the 5 wormhole pairs with their owner colors
     * PERFORMANCE: Uses cached wormhole sprite as base, adds animated pulse on top
     */
    drawStrategicWormholes(ctx, state) {
        const wormholes = state.universe?.wormholes || [];
        if (wormholes.length === 0) return;
        
        const systems = state.universe.solarSystems || [];
        const systemMap = new Map();
        systems.forEach(s => systemMap.set(s.id, s));
        
        // Get empire colors
        const empireColors = new Map();
        state.empires?.forEach(e => empireColors.set(e.id, e.color));
        
        // Pulsing animation
        const pulse = 0.8 + 0.2 * Math.sin((this._animTime || Date.now()) / 400);
        
        // Get cached wormhole sprite
        const wormholeSprite = this._spriteCache.get('wormhole_base');
        
        // Draw each wormhole with LARGE visible markers
        wormholes.forEach(wormhole => {
            const system = systemMap.get(wormhole.systemId);
            if (!system) return;
            
            // PERFORMANCE: Round coordinates to avoid sub-pixel anti-aliasing
            const sx = this._r(system.x);
            const sy = this._r(system.y);
            
            // PERFORMANCE: Viewport culling - skip if off-screen
            if (!this.isInViewport(sx, sy, 40)) return;
            
            const ownerColor = wormhole.ownerId ? empireColors.get(wormhole.ownerId) : null;
            const hasCustomColor = ownerColor && ownerColor !== '#a855f7';
            
            ctx.save();
            
            // Animated pulsing outer glow (always draw - this is the animation)
            const color = ownerColor || wormhole.color || '#a855f7';
            ctx.beginPath();
            ctx.arc(sx, sy, 35 * pulse, 0, Math.PI * 2);
            ctx.fillStyle = `${color}25`;
            ctx.fill();
            
            // PERFORMANCE: Use cached sprite for base pattern if default color
            if (wormholeSprite && !hasCustomColor) {
                const spriteSize = wormholeSprite.width;
                ctx.drawImage(wormholeSprite, sx - spriteSize / 2, sy - spriteSize / 2);
            } else {
                // Draw custom-colored wormhole (owner has different color)
                // Middle ring
                ctx.beginPath();
                ctx.arc(sx, sy, 20, 0, Math.PI * 2);
                ctx.strokeStyle = color;
                ctx.lineWidth = 3;
                ctx.stroke();
                
                // Inner portal
                ctx.beginPath();
                ctx.arc(sx, sy, 12, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
                
                // Center void (black hole effect)
                ctx.beginPath();
                ctx.arc(sx, sy, 6, 0, Math.PI * 2);
                ctx.fillStyle = '#000';
                ctx.fill();
            }
            
            // Wormhole icon (always on top)
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#fff';
            ctx.fillText('🌀', sx, sy + 5);
            
            ctx.restore();
        });
    }

    drawGalaxyIcon(ctx, galaxy, state) {
        // PERFORMANCE: Round coordinates to avoid sub-pixel anti-aliasing
        const x = this._r(galaxy.x);
        const y = this._r(galaxy.y);
        const r = galaxy.radius;
        
        // PERFORMANCE: Viewport culling - skip if off-screen
        if (!this.isInViewport(x, y, r + 30)) return;
        
        const isHovered = this.hoveredObject?.id === galaxy.id;
        const isSelected = this.selectedObject?.id === galaxy.id;

        ctx.save();
        ctx.translate(x, y);

        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        gradient.addColorStop(0, isHovered ? 'rgba(0, 217, 255, 0.4)' : 'rgba(100, 150, 255, 0.3)');
        gradient.addColorStop(0.5, isHovered ? 'rgba(0, 150, 200, 0.2)' : 'rgba(50, 100, 200, 0.1)');
        gradient.addColorStop(1, 'rgba(0, 50, 150, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();

        // Hover/selection ring
        if (isHovered || isSelected) {
            ctx.beginPath();
            ctx.arc(0, 0, r + 5, 0, Math.PI * 2);
            ctx.strokeStyle = '#00d9ff';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Click hint
            ctx.fillStyle = '#00d9ff';
            ctx.font = 'bold 10px sans-serif';
            ctx.fillText('Click to view', 0, r + 30);
        }

        ctx.fillStyle = isHovered ? '#00d9ff' : '#888';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(galaxy.name, 0, r + 15);

        ctx.restore();
    }

    drawSystemIcon(ctx, system, state) {
        // PERFORMANCE: Round coordinates to avoid sub-pixel anti-aliasing
        const x = this._r(system.x);
        const y = this._r(system.y);
        
        // PERFORMANCE: Viewport culling - skip if off-screen
        // Use radius of 40 to account for ownership rings, starbases, etc.
        if (!this.isInViewport(x, y, 40)) return;
        
        const isHovered = this.hoveredObject?.id === system.id;
        const isSelected = this.selectedObject?.id === system.id;

        // PERFORMANCE: Use pre-rendered star sprites instead of creating gradients
        const starType = system.starType || 'yellow';
        const starSprite = this._getStarSprite(starType, isHovered);
        
        if (starSprite) {
            // Draw cached star sprite centered on position
            const spriteSize = starSprite.width;
            ctx.drawImage(starSprite, x - spriteSize / 2, y - spriteSize / 2);
        } else {
            // Fallback to direct drawing if sprite not cached
            const starColors = {
                yellow: '#ffff00',
                red: '#ff4444',
                blue: '#4444ff',
                white: '#ffffff',
                orange: '#ff8800'
            };
            const color = starColors[starType] || '#ffff00';
            const glowRadius = isHovered ? 12 : 8;

            ctx.beginPath();
            ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
            gradient.addColorStop(0, color);
            gradient.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = gradient;
            ctx.fill();

            ctx.beginPath();
            ctx.arc(x, y, isHovered ? 5 : 3, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
        }

        // Hover hint
        if (isHovered && !isSelected) {
            ctx.fillStyle = '#00d9ff';
            ctx.font = 'bold 9px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Click to view', x, y + 25);
        }

        const ownedPlanets = state.universe.planets?.filter(p =>
            p.systemId === system.id && p.owner
        ) || [];

        if (ownedPlanets.length > 0) {
            const ownerColors = {};
            let hasHighlighted = false;
            ownedPlanets.forEach(p => {
                if (!ownerColors[p.owner]) {
                    const empire = state.empires?.find(e => e.id === p.owner);
                    ownerColors[p.owner] = empire?.color || '#888';
                    if (this.highlightedEmpires.includes(p.owner)) {
                        hasHighlighted = true;
                    }
                }
            });

            const colors = Object.values(ownerColors);
            const arcSize = (Math.PI * 2) / colors.length;

            // Draw outer glow for owned systems (more visible)
            colors.forEach((c, i) => {
                ctx.beginPath();
                ctx.arc(x, y, 20, i * arcSize, (i + 1) * arcSize);
                ctx.strokeStyle = c;
                ctx.lineWidth = 10;
                ctx.globalAlpha = 0.35;
                ctx.stroke();
                ctx.globalAlpha = 1;
            });

            // Draw main ownership rings (thicker - 5px)
            colors.forEach((c, i) => {
                ctx.beginPath();
                ctx.arc(x, y, 14, i * arcSize, (i + 1) * arcSize);
                ctx.strokeStyle = c;
                ctx.lineWidth = 5;
                ctx.stroke();
            });

            // Draw pulsing highlight for agent locations
            if (hasHighlighted) {
                this.highlightPulse += 0.1;
                const pulseRadius = 18 + Math.sin(this.highlightPulse) * 4;
                const pulseAlpha = 0.5 + Math.sin(this.highlightPulse) * 0.3;

                ctx.beginPath();
                ctx.arc(x, y, pulseRadius, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(0, 255, 128, ${pulseAlpha})`;
                ctx.lineWidth = 3;
                ctx.stroke();

                // Draw agent marker
                ctx.fillStyle = `rgba(0, 255, 128, ${pulseAlpha})`;
                ctx.font = 'bold 14px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('🤖', x, y - 22);
            }
        }
        
        // Draw CRISIS PRESENCE indicator (pulsing danger ring)
        // PERFORMANCE: Use pre-computed _crisisBySystem map instead of filtering all entities
        if (state.crisis?.active && this._crisisBySystem?.has(system.id)) {
            const crisisUnitsHere = this._crisisBySystem.get(system.id);
            
            // Get crisis color
            const crisisColors = {
                'extragalactic_swarm': { r: 139, g: 0, b: 0 },
                'awakened_precursors': { r: 255, g: 215, b: 0 },
                'ai_rebellion': { r: 0, g: 206, b: 209 }
            };
            const crisisColor = crisisColors[state.crisis.type] || { r: 255, g: 0, b: 0 };
            
            // Pulsing danger ring (use cached _animTime instead of Date.now())
            const dangerPulse = Math.sin(this._animTime / 150) * 0.4 + 0.6;
            ctx.beginPath();
            ctx.arc(x, y, 22 + Math.sin(this._animTime / 200) * 3, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(${crisisColor.r}, ${crisisColor.g}, ${crisisColor.b}, ${dangerPulse})`;
            ctx.lineWidth = 3;
            ctx.stroke();
            
            // Crisis icon
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = `rgba(${crisisColor.r}, ${crisisColor.g}, ${crisisColor.b}, ${dangerPulse})`;
            ctx.fillText(state.crisis.icon || '⚠️', x, y + 32);
            
            // Unit count badge
            ctx.font = 'bold 9px sans-serif';
            ctx.fillStyle = '#fff';
            ctx.fillText(`${crisisUnitsHere.length}`, x + 18, y + 32);
        }

        if (this.hoveredObject?.id === system.id || this.selectedObject?.id === system.id) {
            ctx.beginPath();
            ctx.arc(x, y, 15, 0, Math.PI * 2);
            ctx.strokeStyle = '#00d9ff';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        
        // Draw starbase indicator if system has one
        const starbase = state.starbases?.find(sb => sb.systemId === system.id);
        if (starbase && !starbase.constructing) {
            const sbIcon = starbase.tierName === 'citadel' ? '🏰' : 
                          starbase.tierName === 'starbase' ? '🛸' : '🛰️';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(sbIcon, x + 15, y - 10);
        }
        
        // Draw terrain feature indicator if system has one
        const terrainFeature = state.universe?.terrainFeatures?.find(f => f.systemId === system.id);
        if (terrainFeature) {
            const terrainIcons = {
                nebula: '🌫️',
                black_hole: '🕳️',
                neutron_star: '⚡',
                asteroid_field: '🪨'
            };
            const terrainColors = {
                nebula: 'rgba(136, 68, 170, 0.25)',
                black_hole: 'rgba(68, 0, 68, 0.3)',
                neutron_star: 'rgba(0, 255, 255, 0.2)',
                asteroid_field: 'rgba(136, 119, 102, 0.2)'
            };
            
            // Draw subtle background glow
            ctx.beginPath();
            ctx.arc(x, y, 22, 0, Math.PI * 2);
            ctx.fillStyle = terrainColors[terrainFeature.type] || 'rgba(128, 128, 128, 0.2)';
            ctx.fill();
            
            // Draw terrain icon
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(terrainIcons[terrainFeature.type] || '❓', x - 18, y - 5);
        }
    }

    drawGalaxy(ctx, state) {
        // Find the galaxy to display:
        // 1. If selectedObject IS a galaxy (clicked directly), use its id
        // 2. If selectedObject has a galaxyId (it's a system or planet inside), use that
        // 3. Fallback to first galaxy
        let galaxy = null;
        if (this.selectedObject?.id?.startsWith('galaxy')) {
            galaxy = state.universe.galaxies?.find(g => g.id === this.selectedObject.id);
        } else if (this.selectedObject?.galaxyId) {
            galaxy = state.universe.galaxies?.find(g => g.id === this.selectedObject.galaxyId);
        }
        if (!galaxy) {
            galaxy = state.universe.galaxies?.[0];
        }

        if (!galaxy) return;

        const systems = state.universe.solarSystems?.filter(s => s.galaxyId === galaxy.id) || [];
        // Cache for hover detection
        this.cachedSystems = systems;
        
        // Cache wormholes in this galaxy with positions
        const systemMap = new Map();
        systems.forEach(s => systemMap.set(s.id, s));
        this.cachedWormholes = (state.universe?.wormholes || []).map(w => {
            const system = systemMap.get(w.systemId);
            return system ? { ...w, x: system.x, y: system.y } : null;
        }).filter(Boolean);
        
        // Draw territory overlay (gentle hue for empire-controlled areas)
        this.drawTerritoryOverlay(ctx, state, systems);
        
        // Draw trade routes
        this.drawTradeRoutes(ctx, state, galaxy.id, systems);
        
        systems.forEach(system => this.drawSystemIcon(ctx, system, state));
        
        // Draw wormhole portals in this galaxy
        this.drawGalaxyWormholes(ctx, state, galaxy.id, systems);
    }
    
    /**
     * Draw gentle territory overlay for empire-controlled areas
     * Creates a subtle hue behind systems owned by each empire
     * PERFORMANCE: Only draw when not zooming, use simpler rendering
     */
    drawTerritoryOverlay(ctx, state, systems) {
        // PERFORMANCE: Skip during zoom for smoother camera movement
        if (this._isZooming) return;
        if (!state.empires || state.empires.length === 0) return;
        
        // PERFORMANCE: Cache ownership data, only rebuild when tick changes
        if (this._territoryTick !== state.tick) {
            this._territoryTick = state.tick;
            this._systemOwnership = new Map();
            this._empireRgbColors = new Map();
            
            const planets = state.universe.planets || [];
            planets.forEach(planet => {
                if (planet.owner && planet.systemId && !this._systemOwnership.has(planet.systemId)) {
                    this._systemOwnership.set(planet.systemId, planet.owner);
                }
            });
            
            state.empires.forEach(e => {
                const rgb = this.hexToRgb(e.color);
                if (rgb) this._empireRgbColors.set(e.id, rgb);
            });
        }
        
        // Draw simple circles with moderate alpha (visible but not distracting)
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        
        // Get scale for radius calculation
        const scale = this.camera?.zoom || 1;
        const baseRadius = 80 / Math.max(0.3, scale); // Larger radius when zoomed out
        
        systems.forEach(system => {
            const empireId = this._systemOwnership.get(system.id);
            if (!empireId) return;
            
            const rgb = this._empireRgbColors.get(empireId);
            if (!rgb) return;
            
            // PERFORMANCE: Viewport culling - skip if off-screen
            if (!this.isInViewport(system.x, system.y, baseRadius)) return;
            
            // Draw radial gradient for softer edge (only when not zooming)
            if (!this._isZooming && scale > 0.4) {
                const gradient = ctx.createRadialGradient(
                    system.x, system.y, 0,
                    system.x, system.y, baseRadius
                );
                gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`);
                gradient.addColorStop(0.7, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.08)`);
                gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
                ctx.fillStyle = gradient;
            } else {
                // Simple circle for performance during zoom or far out
                ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`;
            }
            
            ctx.beginPath();
            ctx.arc(system.x, system.y, baseRadius, 0, Math.PI * 2);
            ctx.fill();
        });
        
        ctx.restore();
    }
    
    /**
     * Helper: Convert hex color to RGB
     */
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }
    
    /**
     * Draw trade routes in galaxy view
     */
    drawTradeRoutes(ctx, state, galaxyId, systems) {
        const tradeRoutes = state.tradeRoutes || [];
        if (tradeRoutes.length === 0) return;
        
        // Build planet-to-system map
        const planetToSystem = new Map();
        state.universe.planets?.forEach(planet => {
            planetToSystem.set(planet.id, planet.systemId);
        });
        
        // Build system lookup
        const systemMap = new Map();
        systems.forEach(s => systemMap.set(s.id, s));
        
        // Get empire colors
        const empireColors = new Map();
        state.empires?.forEach(e => empireColors.set(e.id, e.color));
        
        // Draw each trade route as a curved line between systems
        tradeRoutes.forEach(route => {
            const system1Id = planetToSystem.get(route.planet1Id);
            const system2Id = planetToSystem.get(route.planet2Id);
            
            if (!system1Id || !system2Id) return;
            
            // Skip if both planets are in same system (draw in system view instead)
            if (system1Id === system2Id) return;
            
            const system1 = systemMap.get(system1Id);
            const system2 = systemMap.get(system2Id);
            
            // Skip if either system is not in this galaxy
            if (!system1 || !system2) return;
            
            // PERFORMANCE: Viewport culling - skip if route line entirely off-screen
            // Check if either endpoint is visible, or if line crosses viewport
            const routeMinX = Math.min(system1.x, system2.x);
            const routeMaxX = Math.max(system1.x, system2.x);
            const routeMinY = Math.min(system1.y, system2.y);
            const routeMaxY = Math.max(system1.y, system2.y);
            const b = this._viewBounds;
            if (routeMaxX < b.minX || routeMinX > b.maxX ||
                routeMaxY < b.minY || routeMinY > b.maxY) return;
            
            const color = empireColors.get(route.empireId) || '#888888';
            
            // Calculate curve control point (offset perpendicular to line)
            const midX = (system1.x + system2.x) / 2;
            const midY = (system1.y + system2.y) / 2;
            const dx = system2.x - system1.x;
            const dy = system2.y - system1.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            
            // Perpendicular offset for curve
            const offset = len * 0.15;
            const cpX = midX + (-dy / len) * offset;
            const cpY = midY + (dx / len) * offset;
            
            ctx.save();
            
            // Draw route glow
            ctx.beginPath();
            ctx.moveTo(system1.x, system1.y);
            ctx.quadraticCurveTo(cpX, cpY, system2.x, system2.y);
            ctx.strokeStyle = color.replace(')', ', 0.3)').replace('rgb', 'rgba').replace('#', '#');
            // Simple hex to rgba for glow
            if (color.startsWith('#')) {
                const r = parseInt(color.slice(1, 3), 16);
                const g = parseInt(color.slice(3, 5), 16);
                const b = parseInt(color.slice(5, 7), 16);
                ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.3)`;
            }
            ctx.lineWidth = 6;
            ctx.stroke();
            
            // Draw main route line
            ctx.beginPath();
            ctx.moveTo(system1.x, system1.y);
            ctx.quadraticCurveTo(cpX, cpY, system2.x, system2.y);
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 4]);
            ctx.stroke();
            
            // Draw animated "trade flow" dots if route is active
            // PERFORMANCE: Use cached _animTime instead of Date.now()
            if (!route.raided) {
                const t = (this._animTime % 2000) / 2000; // 0-1 over 2 seconds
                const dotX = (1 - t) * (1 - t) * system1.x + 2 * (1 - t) * t * cpX + t * t * system2.x;
                const dotY = (1 - t) * (1 - t) * system1.y + 2 * (1 - t) * t * cpY + t * t * system2.y;
                
                ctx.beginPath();
                ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
                ctx.fillStyle = '#ffd700'; // Gold for trade
                ctx.fill();
            }
            
            // Draw raid indicator if raided
            if (route.raided) {
                ctx.beginPath();
                ctx.arc(midX, midY, 8, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
                ctx.fill();
                ctx.fillStyle = '#ff0000';
                ctx.font = 'bold 12px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('☠', midX, midY);
            }
            
            ctx.restore();
        });
    }
    
    /**
     * Draw strategic wormhole portals in galaxy view
     * Shows portals with owner colors and pulsing animation
     * PERFORMANCE: Uses cached wormhole sprite as base, adds animated pulse
     */
    drawGalaxyWormholes(ctx, state, galaxyId, systems) {
        const wormholes = state.universe?.wormholes || [];
        if (wormholes.length === 0) return;
        
        const systemMap = new Map();
        systems.forEach(s => systemMap.set(s.id, s));
        
        // Get empire colors
        const empireColors = new Map();
        state.empires?.forEach(e => empireColors.set(e.id, e.color));
        
        // Get cached wormhole sprite
        const wormholeSprite = this._spriteCache.get('wormhole_base');
        
        // Draw wormholes in this galaxy
        wormholes.forEach(wormhole => {
            const system = systemMap.get(wormhole.systemId);
            if (!system) return; // Not in this galaxy
            
            // PERFORMANCE: Viewport culling - skip if off-screen
            if (!this.isInViewport(system.x, system.y, 45)) return;
            
            const ownerColor = wormhole.ownerId ? empireColors.get(wormhole.ownerId) : null;
            const hasCustomColor = ownerColor && ownerColor !== '#a855f7';
            const color = ownerColor || wormhole.color || '#a855f7';
            
            // Pulsing animation
            const pulse = 0.8 + 0.2 * Math.sin((this._animTime || Date.now()) / 400);
            
            ctx.save();
            
            // Animated outer glow (pulsing)
            ctx.beginPath();
            ctx.arc(system.x, system.y, 40 * pulse, 0, Math.PI * 2);
            ctx.fillStyle = `${color}20`;
            ctx.fill();
            
            // PERFORMANCE: Use cached sprite for base pattern if default color
            if (wormholeSprite && !hasCustomColor) {
                const spriteSize = wormholeSprite.width;
                ctx.drawImage(wormholeSprite, system.x - spriteSize / 2, system.y - spriteSize / 2);
            } else {
                // Draw custom-colored wormhole (owner has different color)
                // Middle ring
                ctx.beginPath();
                ctx.arc(system.x, system.y, 22, 0, Math.PI * 2);
                ctx.strokeStyle = color;
                ctx.lineWidth = 3;
                ctx.stroke();
                
                // Inner portal
                ctx.beginPath();
                ctx.arc(system.x, system.y, 14, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
                
                // Center void (black hole effect)
                ctx.beginPath();
                ctx.arc(system.x, system.y, 7, 0, Math.PI * 2);
                ctx.fillStyle = '#000';
                ctx.fill();
            }
            
            // Wormhole icon (always on top)
            ctx.font = 'bold 18px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#fff';
            ctx.fillText('🌀', system.x, system.y + 6);
            
            // Wormhole name label
            ctx.font = 'bold 10px sans-serif';
            ctx.fillStyle = color;
            ctx.fillText(wormhole.name.split(' ')[0], system.x, system.y - 28);
            
            ctx.restore();
        });
    }

    drawSystem(ctx, state) {
        // Find the system to display:
        // 1. If selectedObject IS a system (clicked directly), use its id
        // 2. If selectedObject has a systemId (it's a planet inside), use that
        // 3. Fallback to first system
        let system = null;
        if (this.selectedObject?.id?.startsWith('system')) {
            system = state.universe.solarSystems?.find(s => s.id === this.selectedObject.id);
        } else if (this.selectedObject?.systemId) {
            system = state.universe.solarSystems?.find(s => s.id === this.selectedObject.systemId);
        }
        if (!system) {
            system = state.universe.solarSystems?.[0];
        }

        if (!system) return;
        
        // Draw terrain feature for this system (behind everything)
        const terrainFeature = state.universe?.terrainFeatures?.find(f => f.systemId === system.id);
        if (terrainFeature) {
            this.drawTerrainFeature(ctx, system, terrainFeature);
        }

        ctx.beginPath();
        ctx.arc(system.x, system.y, 20, 0, Math.PI * 2);
        ctx.fillStyle = '#ffff00';
        ctx.fill();

        const planets = state.universe.planets?.filter(p => p.systemId === system.id) || [];

        // Store planet positions for click detection
        this.systemPlanets = [];

        planets.forEach(planet => {
            const px = system.x + Math.cos(planet.orbitAngle) * planet.orbitRadius * 3;
            const py = system.y + Math.sin(planet.orbitAngle) * planet.orbitRadius * 3;

            // Store for hit detection (larger radius for easier clicking)
            this.systemPlanets.push({ ...planet, screenX: px, screenY: py, radius: 20 });

            ctx.beginPath();
            ctx.arc(system.x, system.y, planet.orbitRadius * 3, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.stroke();

            const planetColors = {
                terrestrial: '#4ade80',
                gas_giant: '#f97316',
                ice: '#7dd3fc',
                desert: '#fcd34d',
                ocean: '#3b82f6',
                volcanic: '#ef4444'
            };

            // Check if this planet is hovered
            const isHovered = this.hoveredPlanet?.id === planet.id;
            const isSelected = this.selectedObject?.id === planet.id;

            ctx.beginPath();
            ctx.arc(px, py, isHovered ? 10 : 8, 0, Math.PI * 2);
            ctx.fillStyle = planetColors[planet.type] || '#888';
            ctx.fill();

            if (planet.owner) {
                const empire = state.empires?.find(e => e.id === planet.owner);
                if (empire) {
                    // Draw outer glow (bigger, more visible)
                    ctx.beginPath();
                    ctx.arc(px, py, isHovered ? 22 : 18, 0, Math.PI * 2);
                    ctx.strokeStyle = empire.color;
                    ctx.lineWidth = 8;
                    ctx.globalAlpha = 0.4;
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                    
                    // Draw ownership ring (much thicker - 5px)
                    ctx.beginPath();
                    ctx.arc(px, py, isHovered ? 16 : 14, 0, Math.PI * 2);
                    ctx.strokeStyle = empire.color;
                    ctx.lineWidth = 5;
                    ctx.stroke();
                }
            }

            // Highlight hovered/selected planet
            if (isHovered || isSelected) {
                ctx.beginPath();
                ctx.arc(px, py, 16, 0, Math.PI * 2);
                ctx.strokeStyle = '#00d9ff';
                ctx.lineWidth = 2;
                ctx.stroke();

                // Draw "Click to view" hint
                ctx.fillStyle = '#00d9ff';
                ctx.font = 'bold 9px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('Click to view', px, py + 32);
            }

            // Planet name - white, clear, not bold
            ctx.fillStyle = '#ffffff';
            ctx.font = '11px Arial, sans-serif';
            ctx.textAlign = 'center';
            // Add slight text shadow for readability
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = 3;
            ctx.fillText(planet.name, px, py + 24);
            ctx.shadowBlur = 0;
            
            // CRISIS ATTACK INDICATOR - pulsing danger ring on planets under attack
            // PERFORMANCE: Use pre-computed _entitiesByPlanet map
            if (state.crisis?.active) {
                const planetEntities = this._entitiesByPlanet?.get(planet.id) || [];
                const crisisUnitsHere = planetEntities.filter(e => e.owner?.startsWith('crisis_'));
                
                if (crisisUnitsHere.length > 0) {
                    const crisisColors = {
                        'extragalactic_swarm': { r: 139, g: 0, b: 0 },
                        'awakened_precursors': { r: 255, g: 215, b: 0 },
                        'ai_rebellion': { r: 0, g: 206, b: 209 }
                    };
                    const crisisColor = crisisColors[state.crisis.type] || { r: 255, g: 0, b: 0 };
                    const dangerPulse = Math.sin(this._animTime / 150) * 0.4 + 0.6;
                    
                    // Pulsing danger ring
                    ctx.beginPath();
                    ctx.arc(px, py, 24 + Math.sin(this._animTime / 200) * 4, 0, Math.PI * 2);
                    ctx.strokeStyle = `rgba(${crisisColor.r}, ${crisisColor.g}, ${crisisColor.b}, ${dangerPulse})`;
                    ctx.lineWidth = 3;
                    ctx.stroke();
                    
                    // Warning icon above planet
                    ctx.font = '14px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillStyle = `rgba(${crisisColor.r}, ${crisisColor.g}, ${crisisColor.b}, ${dangerPulse})`;
                    ctx.fillText(`${state.crisis.icon || '⚠️'} ${crisisUnitsHere.length}`, px, py - 18);
                }
            }
        });

        // Draw starbase if present in this system
        const starbase = state.starbases?.find(sb => sb.systemId === system.id);
        if (starbase) {
            const sbX = system.x + 80;
            const sbY = system.y - 60;
            
            // Get empire color
            const empire = state.empires?.find(e => e.id === starbase.owner);
            const sbColor = empire?.color || '#888';
            
            // Draw starbase structure
            const sbSize = starbase.tier * 8 + 10;  // Bigger for higher tiers
            
            // Outer glow
            ctx.beginPath();
            ctx.arc(sbX, sbY, sbSize + 8, 0, Math.PI * 2);
            ctx.fillStyle = `${sbColor}33`;
            ctx.fill();
            
            // Main structure
            ctx.beginPath();
            ctx.arc(sbX, sbY, sbSize, 0, Math.PI * 2);
            ctx.fillStyle = starbase.constructing !== false ? '#555' : sbColor;
            ctx.fill();
            
            // HP bar
            if (!starbase.constructing) {
                const hpPercent = starbase.hp / starbase.maxHp;
                const barWidth = 30;
                const barHeight = 4;
                
                ctx.fillStyle = '#333';
                ctx.fillRect(sbX - barWidth/2, sbY + sbSize + 5, barWidth, barHeight);
                ctx.fillStyle = hpPercent > 0.5 ? '#4ade80' : hpPercent > 0.25 ? '#fbbf24' : '#ef4444';
                ctx.fillRect(sbX - barWidth/2, sbY + sbSize + 5, barWidth * hpPercent, barHeight);
            }
            
            // Icon and name
            const sbIcon = starbase.tierName === 'citadel' ? '🏰' : 
                          starbase.tierName === 'starbase' ? '🛸' : '🛰️';
            ctx.font = '16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(sbIcon, sbX, sbY + 5);
            
            ctx.fillStyle = starbase.constructing !== false ? '#888' : '#fff';
            ctx.font = '9px sans-serif';
            ctx.fillText(starbase.name, sbX, sbY + sbSize + 18);
            
            // Show "Under Construction" if building
            if (starbase.constructing !== false) {
                ctx.fillStyle = '#fbbf24';
                ctx.font = 'bold 8px sans-serif';
                ctx.fillText('BUILDING...', sbX, sbY - sbSize - 5);
            }
            
            // Show modules count
            if (starbase.modules?.length > 0) {
                ctx.fillStyle = '#aaa';
                ctx.font = '8px sans-serif';
                ctx.fillText(`${starbase.modules.length}/${starbase.moduleSlots} modules`, sbX, sbY + sbSize + 28);
            }
            
            // Show shipyard build queue
            if (starbase.canBuildShips && starbase.buildQueue?.length > 0) {
                const queueY = sbY + sbSize + 38;
                
                // Background panel
                ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                ctx.fillRect(sbX - 40, queueY - 2, 80, 24);
                ctx.strokeStyle = '#4ade80';
                ctx.lineWidth = 1;
                ctx.strokeRect(sbX - 40, queueY - 2, 80, 24);
                
                // Building indicator
                ctx.fillStyle = '#4ade80';
                ctx.font = 'bold 8px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('🔧 SHIPYARD', sbX, queueY + 6);
                
                // Show what's building
                const building = starbase.buildQueue[0];
                const shipIcons = {
                    fighter: '✈️', bomber: '💣', transport: '🚚', 
                    colony_ship: '🚀', battleship: '⚔️', carrier: '🛳️', support_ship: '🔧'
                };
                const icon = shipIcons[building.shipType] || '🚀';
                ctx.fillStyle = '#fff';
                ctx.font = '8px sans-serif';
                ctx.fillText(`${icon} ${building.shipType} +${starbase.buildQueue.length - 1} more`, sbX, queueY + 17);
            }
        }

        // Draw wormhole if present in this system
        const wormhole = state.universe?.wormholes?.find(w => w.systemId === system.id);
        if (wormhole) {
            this.drawSystemWormhole(ctx, system, wormhole, state);
        }

        // Update hover state for planets in system view
        this.updateSystemHover();
    }
    
    /**
     * Draw a wormhole portal in the system view
     * Shows the swirling portal with destination info
     */
    drawSystemWormhole(ctx, system, wormhole, state) {
        // Position wormhole at edge of system
        const whX = system.x - 100;
        const whY = system.y + 80;
        const whSize = 35;
        
        // Animated rotation
        const rotation = (this._animTime || 0) / 1000;
        const pulse = Math.sin(rotation * 2) * 0.2 + 0.8;
        
        // Get owner info
        const owner = wormhole.ownerId ? state.empires?.find(e => e.id === wormhole.ownerId) : null;
        const ownerColor = owner?.color || '#a855f7'; // Purple default
        
        // Find destination system
        const destSystem = state.universe?.solarSystems?.find(s => s.id === wormhole.destSystemId);
        
        ctx.save();
        ctx.translate(whX, whY);
        
        // Outer glow (pulsing)
        const gradient = ctx.createRadialGradient(0, 0, whSize * 0.5, 0, 0, whSize * 1.5);
        gradient.addColorStop(0, `${ownerColor}99`);
        gradient.addColorStop(0.5, `${ownerColor}44`);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, whSize * 1.5 * pulse, 0, Math.PI * 2);
        ctx.fill();
        
        // Portal ring (outer)
        ctx.beginPath();
        ctx.arc(0, 0, whSize, 0, Math.PI * 2);
        ctx.strokeStyle = ownerColor;
        ctx.lineWidth = 4;
        ctx.stroke();
        
        // Swirl effect (rotating arcs)
        ctx.save();
        ctx.rotate(rotation);
        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.arc(0, 0, whSize * 0.7, i * Math.PI / 2, i * Math.PI / 2 + Math.PI / 3);
            ctx.strokeStyle = `rgba(168, 85, 247, ${0.6 - i * 0.1})`;
            ctx.lineWidth = 3;
            ctx.stroke();
        }
        ctx.restore();
        
        // Inner vortex
        const innerGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, whSize * 0.6);
        innerGradient.addColorStop(0, '#000033');
        innerGradient.addColorStop(0.5, '#1a0033');
        innerGradient.addColorStop(1, `${ownerColor}88`);
        ctx.fillStyle = innerGradient;
        ctx.beginPath();
        ctx.arc(0, 0, whSize * 0.6, 0, Math.PI * 2);
        ctx.fill();
        
        // Center star effect
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
        
        // Wormhole icon
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🌀', whX, whY + 6);
        
        // Label and destination
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 4;
        ctx.fillText(wormhole.name, whX, whY + whSize + 16);
        
        // Destination info
        if (destSystem) {
            ctx.fillStyle = '#a855f7';
            ctx.font = '9px sans-serif';
            ctx.fillText(`→ ${destSystem.name}`, whX, whY + whSize + 28);
        }
        
        // Owner indicator
        if (owner) {
            ctx.fillStyle = owner.color;
            ctx.font = '8px sans-serif';
            ctx.fillText(`⚑ ${owner.name}`, whX, whY + whSize + 40);
        } else {
            ctx.fillStyle = '#888';
            ctx.font = '8px sans-serif';
            ctx.fillText('Neutral', whX, whY + whSize + 40);
        }
        
        // HP bar if damaged
        if (wormhole.hp !== undefined && wormhole.hp < wormhole.maxHp) {
            const hpPercent = wormhole.hp / wormhole.maxHp;
            const barWidth = 40;
            const barHeight = 4;
            const barY = whY + whSize + 48;
            
            ctx.fillStyle = '#333';
            ctx.fillRect(whX - barWidth/2, barY, barWidth, barHeight);
            ctx.fillStyle = hpPercent > 0.5 ? '#4ade80' : hpPercent > 0.25 ? '#fbbf24' : '#ef4444';
            ctx.fillRect(whX - barWidth/2, barY, barWidth * hpPercent, barHeight);
            
            // Unstable warning
            if (!wormhole.stable) {
                ctx.fillStyle = '#ef4444';
                ctx.font = 'bold 8px sans-serif';
                ctx.fillText('⚠️ UNSTABLE', whX, barY + 14);
            }
        }
        
        ctx.shadowBlur = 0;
    }
    
    /**
     * Draw galactic terrain feature (nebula, black hole, neutron star, asteroid field)
     * These are rendered as atmospheric effects behind the system content
     * PERFORMANCE: Use cached _animTime instead of Date.now()
     */
    drawTerrainFeature(ctx, system, feature) {
        const x = system.x;
        const y = system.y;
        const size = feature.size || 50;
        const time = (this._animTime || performance.now()) * 0.001;
        
        ctx.save();
        
        switch (feature.type) {
            case 'nebula':
                // Swirling gas clouds
                for (let i = 0; i < 5; i++) {
                    const angle = (i / 5) * Math.PI * 2 + time * 0.1;
                    const radius = size * 0.5 + Math.sin(time + i) * 10;
                    const cloudX = x + Math.cos(angle) * radius * 0.3;
                    const cloudY = y + Math.sin(angle) * radius * 0.3;
                    const cloudSize = size * 0.4 + Math.sin(time * 0.5 + i) * 5;
                    const alpha = 0.15 + Math.sin(time + i * 0.5) * 0.05;
                    
                    ctx.beginPath();
                    ctx.arc(cloudX, cloudY, cloudSize, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(136, 68, 170, ${alpha})`;
                    ctx.fill();
                }
                // Outer haze
                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(102, 68, 204, 0.08)';
                ctx.fill();
                break;
                
            case 'black_hole':
                // Accretion disk
                const diskPulse = 0.9 + Math.sin(time * 3) * 0.1;
                for (let i = 8; i >= 0; i--) {
                    const ratio = i / 8;
                    const radius = size * ratio * diskPulse;
                    const alpha = (1 - ratio) * 0.4;
                    ctx.beginPath();
                    ctx.arc(x, y, radius, 0, Math.PI * 2);
                    ctx.fillStyle = i > 5 ? `rgba(255, 68, 255, ${alpha})` : `rgba(0, 0, 0, ${alpha})`;
                    ctx.fill();
                }
                // Event horizon (pure black center)
                ctx.beginPath();
                ctx.arc(x, y, size * 0.3, 0, Math.PI * 2);
                ctx.fillStyle = '#000000';
                ctx.fill();
                // Gravitational lensing ring
                ctx.beginPath();
                ctx.arc(x, y, size * 0.35, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.lineWidth = 1;
                ctx.stroke();
                break;
                
            case 'neutron_star':
                // Intense radiation pulses
                const pulse = 0.7 + Math.sin(time * 8) * 0.3;
                // Radiation field
                for (let i = 6; i >= 0; i--) {
                    const ratio = i / 6;
                    const radius = size * ratio * pulse;
                    const alpha = (1 - ratio) * 0.5;
                    ctx.beginPath();
                    ctx.arc(x, y, radius, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(0, 255, 255, ${alpha})`;
                    ctx.fill();
                }
                // Bright core
                ctx.beginPath();
                ctx.arc(x, y, size * 0.15, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.fill();
                // Warning indicator (pulsing red)
                const warningAlpha = 0.3 + Math.sin(time * 4) * 0.2;
                ctx.beginPath();
                ctx.arc(x, y, size * 0.8, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(255, 0, 0, ${warningAlpha})`;
                ctx.lineWidth = 2;
                ctx.stroke();
                break;
                
            case 'asteroid_field':
                // Scattered asteroids
                const asteroidCount = 12;
                for (let i = 0; i < asteroidCount; i++) {
                    const seed = i * 7.3;
                    const angle = (i / asteroidCount) * Math.PI * 2 + time * 0.05 * (i % 3 === 0 ? 1 : -1);
                    const orbitRadius = size * 0.4 + (seed % 30);
                    const asteroidX = x + Math.cos(angle) * orbitRadius;
                    const asteroidY = y + Math.sin(angle) * orbitRadius * 0.6; // Elliptical
                    const asteroidSize = 3 + (seed % 8);
                    
                    ctx.beginPath();
                    ctx.arc(asteroidX, asteroidY, asteroidSize, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(136, 119, 102, 0.7)';
                    ctx.fill();
                }
                // Dust cloud
                ctx.beginPath();
                ctx.arc(x, y, size * 0.7, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(153, 136, 119, 0.05)';
                ctx.fill();
                break;
        }
        
        // Draw terrain label
        const terrainIcons = {
            nebula: '🌫️',
            black_hole: '🕳️',
            neutron_star: '⚡',
            asteroid_field: '🪨'
        };
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(terrainIcons[feature.type] || '❓', x, y - size - 15);
        
        ctx.restore();
    }

    updateSystemHover() {
        if (this.viewMode !== 'system' || !this.systemPlanets) {
            this.hoveredPlanet = null;
            return;
        }

        const mx = this.mouseWorld.x;
        const my = this.mouseWorld.y;

        this.hoveredPlanet = null;
        for (const planet of this.systemPlanets) {
            const dist = Math.sqrt(Math.pow(mx - planet.screenX, 2) + Math.pow(my - planet.screenY, 2));
            if (dist <= planet.radius) {
                this.hoveredPlanet = planet;
                break;
            }
        }
    }

    // Called when clicking in planet view to check for tile/building clicks
    handleTileClick(e) {
        if (this.viewMode !== 'planet' || !this.currentPlanetId) return false;
        
        const planet = this.cachedPlanets?.find(p => p.id === this.currentPlanetId);
        if (!planet) return false;
        
        // If surface not loaded yet, trigger a fetch callback (async load)
        if (!planet.surface) {
            console.log('[Renderer] Surface not loaded for', this.currentPlanetId, '- triggering fetch');
            this.onSurfaceNeeded?.(this.currentPlanetId);
            return false;
        }
        
        // Get canvas-relative mouse position
        const rect = this.canvas.getBoundingClientRect();
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;
        
        // Convert to world coordinates
        const worldX = (canvasX - this.canvas.width / 2) / this.camera.zoom + this.camera.x;
        const worldY = (canvasY - this.canvas.height / 2) / this.camera.zoom + this.camera.y;
        
        // Calculate grid dimensions (must match drawPlanet)
        const TILE_SIZE = 36;
        const surfaceWidth = planet.surface[0]?.length || 20;
        const surfaceHeight = planet.surface.length || 15;
        const gridWidth = surfaceWidth * TILE_SIZE;
        const gridHeight = surfaceHeight * TILE_SIZE;
        const offsetX = -gridWidth / 2 - 80;
        const offsetY = -gridHeight / 2 + 30;
        
        // Calculate tile coordinates
        const tileX = Math.floor((worldX - offsetX) / TILE_SIZE);
        const tileY = Math.floor((worldY - offsetY) / TILE_SIZE);
        
        // Check bounds
        if (tileX < 0 || tileX >= surfaceWidth || tileY < 0 || tileY >= surfaceHeight) {
            return false;
        }
        
        // Find building at this tile
        const building = this.cachedEntities?.find(e => 
            e.location === this.currentPlanetId && 
            e.gridX === tileX && 
            e.gridY === tileY
        );
        
        const tile = planet.surface[tileY]?.[tileX];
        
        // Trigger tile click callback with tile info
        if (this.onTileClick) {
            this.onTileClick({
                planetId: this.currentPlanetId,
                planet: planet,
                tileX: tileX,
                tileY: tileY,
                terrain: tile?.type || tile || 'unknown',
                building: building
            });
            window.SoundFX?.play('mapClick');
            return true;
        }
        
        return false;
    }

    // Called when clicking in system view to check for planet clicks
    handleSystemClick() {
        if (this.viewMode === 'system' && this.hoveredPlanet) {
            this.currentPlanetId = this.hoveredPlanet.id;
            this.selectedObject = this.hoveredPlanet;
            // Center on the planet (uses screenX/screenY)
            this.centerOn(this.hoveredPlanet);
            // Play planet selection sound
            window.SoundFX?.play('zoomToPlanet');
            this.onPlanetClick?.(this.hoveredPlanet);
            return true;
        }
        return false;
    }

    drawPlanet(ctx, state) {
        // Delegated to modular planet-view.js
        drawPlanetView(ctx, state, this);
    }
    drawOverlay(ctx, state) {
        if (!state) return;

        ctx.fillStyle = '#aaa';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'right';

        const info = [
            `View: ${this.viewMode}`,
            `Zoom: ${(this.camera.zoom * 100).toFixed(0)}%`,
            state.tick ? `Tick: ${state.tick}` : ''
        ];

        info.forEach((text, i) => {
            ctx.fillText(text, this.canvas.width - 10, 20 + i * 15);
        });

        // Crisis overlay removed - info shown in crisis modal instead
    }

    /**
     * Draw crisis warning overlay (before crisis arrives)
     */
    drawCrisisWarning(ctx, crisis) {
        const pulse = Math.sin(Date.now() / 300) * 0.3 + 0.7;
        const width = this.canvas.width;
        
        // Warning banner at top
        ctx.fillStyle = `rgba(255, 165, 0, ${0.15 * pulse})`;
        ctx.fillRect(0, 0, width, 50);
        
        // Warning border
        ctx.strokeStyle = `rgba(255, 165, 0, ${0.8 * pulse})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 50);
        ctx.lineTo(width, 50);
        ctx.stroke();
        
        // Warning text
        ctx.textAlign = 'center';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillStyle = `rgba(255, 200, 50, ${pulse})`;
        ctx.fillText(`⚠️ ${crisis.icon || '🚨'} WARNING: ${crisis.name || 'CRISIS INCOMING'} ⚠️`, width / 2, 32);
    }

    /**
     * Draw active crisis overlay with dramatic visuals
     */
    drawCrisisOverlay(ctx, crisis) {
        const pulse = Math.sin(Date.now() / 200) * 0.4 + 0.6;
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Crisis color based on type
        const crisisColors = {
            'extragalactic_swarm': { r: 139, g: 0, b: 0 },      // Dark red
            'awakened_precursors': { r: 255, g: 215, b: 0 },    // Gold
            'ai_rebellion': { r: 0, g: 206, b: 209 }            // Cyan
        };
        const color = crisisColors[crisis.type] || { r: 255, g: 0, b: 0 };
        
        // Pulsing vignette effect (screen edges)
        const gradient = ctx.createRadialGradient(
            width / 2, height / 2, height * 0.3,
            width / 2, height / 2, height * 0.8
        );
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, ${0.25 * pulse})`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        
        // Crisis banner at top
        ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${0.3 * pulse})`;
        ctx.fillRect(0, 0, width, 60);
        
        // Danger border (pulsing)
        ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${pulse})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 60);
        ctx.lineTo(width, 60);
        ctx.stroke();
        
        // Crisis title
        ctx.textAlign = 'center';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`;
        ctx.fillText(`${crisis.icon || '🚨'} ${crisis.name || 'GALACTIC CRISIS'} ${crisis.icon || '🚨'}`, width / 2, 28);
        
        // Crisis stats
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#fff';
        const statsText = `Active Fleets: ${crisis.activeFleets || 0} | Destroyed: ${crisis.fleetsDestroyed || 0}`;
        ctx.fillText(statsText, width / 2, 48);
        
        // Animated corner warnings
        ctx.font = 'bold 24px sans-serif';
        ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${pulse})`;
        ctx.textAlign = 'left';
        ctx.fillText('⚠️', 10, height - 10);
        ctx.textAlign = 'right';
        ctx.fillText('⚠️', width - 10, height - 10);
    }

    highlightEmpire(empireId) {
        this.highlightedEmpires = empireId ? [empireId] : [];
        this.highlightPulse = 0;
        this._gameLayerDirty = true; // MULTI-LAYER: Force redraw on highlight
        // Auto-clear after 5 seconds
        setTimeout(() => {
            if (this.highlightedEmpires.includes(empireId)) {
                this.highlightedEmpires = [];
                this._gameLayerDirty = true;
            }
        }, 5000);
    }

    highlightEmpires(empireIds) {
        this.highlightedEmpires = empireIds || [];
        this.highlightPulse = 0;
        this._gameLayerDirty = true; // MULTI-LAYER: Force redraw on highlight
        // Auto-clear after 5 seconds
        setTimeout(() => {
            this.highlightedEmpires = [];
            this._gameLayerDirty = true;
        }, 5000);
    }

    setEmpireColors(empires) {
        empires?.forEach(empire => {
            this.empireColors[empire.id] = empire.color;
        });
    }

    /**
     * Draw a clean vector ship icon (no pixelated sprites)
     * @param {CanvasRenderingContext2D} ctx 
     * @param {string} color - Empire color
     * @param {number} scale - Size multiplier
     */
    drawVectorShip(ctx, color, scale = 1) {
        // Delegated to modular fleet-renderer.js
        drawVectorShipModule(ctx, color, scale);
    }
    drawFleets(ctx, state, viewMode) {
        // Delegated to modular fleet-renderer.js
        drawFleetsModule(ctx, state, viewMode, this);
    }
    
    /**
     * Get all fleets currently in transit (for UI panel)
     */
    getFleetsForPanel() {
        return this._lastState?.fleetsInTransit || [];
    }
}