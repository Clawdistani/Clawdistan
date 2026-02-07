// PixiJS WebGL Renderer for Clawdistan
// High-performance GPU-accelerated universe visualization

export class PixiRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.viewMode = 'universe';
        this.selectedObject = null;
        this.currentPlanetId = null;
        this.hoveredObject = null;
        this.empireColors = {};
        this.mouseWorld = { x: 0, y: 0 };
        this.highlightedEmpires = [];
        this.highlightPulse = 0;
        
        // Pixi-specific state
        this.app = null;
        this.containers = {};
        this.graphics = {};
        this._initialized = false;
        this._lastState = null;
        
        // Camera state
        this.camera = {
            x: 500,
            y: 500,
            zoom: 0.5,
            targetZoom: 0.5
        };
        
        // Cached positions for hover detection
        this.cachedGalaxies = [];
        this.cachedSystems = [];
        this.systemPlanets = [];
        
        // Animation timing
        this._animFrame = 0;
        this._lastAnimTime = 0;
        
        // Initialize PixiJS
        this._initPixi();
    }
    
    async _initPixi() {
        try {
            // Create Pixi Application with WebGL (v7 API - options in constructor)
            this.app = new PIXI.Application({
                view: this.canvas,
                width: this.canvas.parentElement?.clientWidth || 800,
                height: this.canvas.parentElement?.clientHeight || 600,
                backgroundColor: 0x050510,
                antialias: true,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true,
                powerPreference: 'high-performance'
            });
            
            // Create main container hierarchy
            this._createContainers();
            
            // Setup input handlers
            this._setupInteraction();
            
            // Handle resize
            window.addEventListener('resize', () => this._handleResize());
            
            this._initialized = true;
            console.log('🎮 PixiJS WebGL renderer initialized!');
            
        } catch (error) {
            console.error('❌ PixiJS initialization failed:', error);
            // Signal that we should fall back to Canvas2D
            this._initFailed = true;
        }
    }
    
    _createContainers() {
        // Main world container (for camera transforms)
        this.containers.world = new PIXI.Container();
        this.app.stage.addChild(this.containers.world);
        
        // Layer hierarchy (bottom to top)
        this.containers.starfield = new PIXI.Container();
        this.containers.hyperlanes = new PIXI.Container();
        this.containers.wormholes = new PIXI.Container();
        this.containers.galaxies = new PIXI.Container();
        this.containers.systems = new PIXI.Container();
        this.containers.fleets = new PIXI.Container();
        this.containers.ui = new PIXI.Container();
        
        // Add layers to world
        this.containers.world.addChild(this.containers.starfield);
        this.containers.world.addChild(this.containers.hyperlanes);
        this.containers.world.addChild(this.containers.wormholes);
        this.containers.world.addChild(this.containers.galaxies);
        this.containers.world.addChild(this.containers.systems);
        this.containers.world.addChild(this.containers.fleets);
        
        // UI layer stays fixed (not affected by camera)
        this.app.stage.addChild(this.containers.ui);
        
        // Create reusable graphics objects
        this.graphics.hyperlanes = new PIXI.Graphics();
        this.containers.hyperlanes.addChild(this.graphics.hyperlanes);
        
        this.graphics.wormholes = new PIXI.Graphics();
        this.containers.wormholes.addChild(this.graphics.wormholes);
        
        // Create starfield (particle container for performance)
        this._createStarfield();
    }
    
    _createStarfield() {
        // Generate random stars with multiple layers for parallax effect
        this._starLayers = [];
        
        // Create 3 layers with different speeds (parallax)
        const layerConfigs = [
            { count: 150, size: [0.5, 1.5], alpha: [0.1, 0.3], speed: 0.3 },  // Far background
            { count: 100, size: [1, 2.5], alpha: [0.2, 0.5], speed: 0.6 },    // Mid layer
            { count: 50, size: [2, 4], alpha: [0.4, 0.8], speed: 1.0 }         // Foreground
        ];
        
        const seed = 12345;
        
        layerConfigs.forEach((config, layerIdx) => {
            const layer = new PIXI.Container();
            layer.parallaxSpeed = config.speed;
            
            for (let i = 0; i < config.count; i++) {
                const starSeed = seed * (layerIdx + 1) + i;
                const x = (Math.sin(starSeed) * 10000) % 1000;
                const y = (Math.cos(starSeed * 1.5) * 10000) % 1000;
                const size = config.size[0] + ((i * 7) % 10) / 10 * (config.size[1] - config.size[0]);
                const alpha = config.alpha[0] + ((i * 13) % 60) / 100 * (config.alpha[1] - config.alpha[0]);
                
                const star = new PIXI.Graphics();
                
                // Add glow effect for brighter stars
                if (size > 2 && layerIdx === 2) {
                    // Outer glow
                    star.circle(0, 0, size * 2);
                    star.fill({ color: 0xffffff, alpha: alpha * 0.2 });
                }
                
                star.circle(0, 0, size);
                
                // Varied star colors
                const colors = [0xffffff, 0xc8dcff, 0xfff0c8, 0xb4c8ff, 0xffffe6];
                star.fill({ color: colors[i % 5], alpha: alpha });
                
                star.x = x;
                star.y = y;
                
                // Twinkling animation data
                star._twinklePhase = Math.random() * Math.PI * 2;
                star._twinkleSpeed = 0.01 + Math.random() * 0.02;
                star._baseAlpha = alpha;
                
                layer.addChild(star);
            }
            
            this._starLayers.push(layer);
            this.containers.starfield.addChild(layer);
        });
    }
    
    _updateStarfield() {
        // Animate twinkling stars
        if (!this._starLayers) return;
        
        const time = Date.now() * 0.001;
        
        this._starLayers.forEach((layer, layerIdx) => {
            // Parallax offset based on camera
            const parallaxX = -this.camera.x * (1 - layer.parallaxSpeed) * 0.1;
            const parallaxY = -this.camera.y * (1 - layer.parallaxSpeed) * 0.1;
            layer.x = parallaxX % 1000;
            layer.y = parallaxY % 1000;
            
            // Only animate foreground layer (performance)
            if (layerIdx === 2) {
                layer.children.forEach(star => {
                    star._twinklePhase += star._twinkleSpeed;
                    const twinkle = 0.7 + 0.3 * Math.sin(star._twinklePhase);
                    star.alpha = star._baseAlpha * twinkle;
                });
            }
        });
    }
    
    _setupInteraction() {
        let isDragging = false;
        let lastX = 0, lastY = 0;
        
        // Make stage interactive (v7 API)
        this.app.stage.interactive = true;
        this.app.stage.hitArea = this.app.screen;
        
        this.app.stage.on('pointerdown', (e) => {
            isDragging = true;
            lastX = e.global.x;
            lastY = e.global.y;
        });
        
        this.app.stage.on('pointermove', (e) => {
            // Update mouse world position
            const worldPos = this._screenToWorld(e.global.x, e.global.y);
            this.mouseWorld = worldPos;
            
            if (isDragging) {
                const dx = e.global.x - lastX;
                const dy = e.global.y - lastY;
                this.camera.x -= dx / this.camera.zoom;
                this.camera.y -= dy / this.camera.zoom;
                lastX = e.global.x;
                lastY = e.global.y;
            }
            
            this._detectHover();
        });
        
        this.app.stage.on('pointerup', () => { isDragging = false; });
        this.app.stage.on('pointerupoutside', () => { isDragging = false; });
        
        // Zoom with mouse wheel
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
            this.camera.targetZoom = Math.max(0.1, Math.min(5, this.camera.targetZoom * zoomFactor));
        });
        
        // Click handling
        this.app.stage.on('pointertap', (e) => {
            if (this._handleSystemClick()) return;
            
            if (this.hoveredObject) {
                this.selectedObject = this.hoveredObject;
                
                if (this.hoveredObject.id?.startsWith('planet')) {
                    this.currentPlanetId = this.hoveredObject.id;
                    window.SoundFX?.play('zoomToPlanet');
                } else if (this.hoveredObject.id?.startsWith('galaxy')) {
                    window.SoundFX?.play('zoomToGalaxy');
                    this.onViewChange?.('galaxy');
                } else if (this.hoveredObject.id?.startsWith('system')) {
                    window.SoundFX?.play('zoomToSystem');
                    this.onViewChange?.('system');
                } else {
                    window.SoundFX?.play('mapClick');
                }
                
                this.onSelect?.(this.selectedObject);
            }
        });
    }
    
    _screenToWorld(screenX, screenY) {
        const centerX = this.app.screen.width / 2;
        const centerY = this.app.screen.height / 2;
        return {
            x: (screenX - centerX) / this.camera.zoom + this.camera.x,
            y: (screenY - centerY) / this.camera.zoom + this.camera.y
        };
    }
    
    _handleResize() {
        if (!this.app) return;
        const parent = this.canvas.parentElement;
        if (parent) {
            this.app.renderer.resize(parent.clientWidth, parent.clientHeight);
        }
    }
    
    resize() {
        this._handleResize();
    }
    
    _detectHover() {
        const mx = this.mouseWorld.x;
        const my = this.mouseWorld.y;
        this.hoveredObject = null;
        
        if (this.viewMode === 'universe' || this.viewMode === 'galaxy') {
            // Check systems first
            for (const system of this.cachedSystems) {
                const dist = Math.sqrt(Math.pow(mx - system.x, 2) + Math.pow(my - system.y, 2));
                if (dist <= 15) {
                    this.hoveredObject = system;
                    return;
                }
            }
            // Check galaxies
            for (const galaxy of this.cachedGalaxies) {
                const dist = Math.sqrt(Math.pow(mx - galaxy.x, 2) + Math.pow(my - galaxy.y, 2));
                if (dist <= galaxy.radius) {
                    this.hoveredObject = galaxy;
                    return;
                }
            }
        }
    }
    
    _handleSystemClick() {
        if (this.viewMode === 'system' && this.hoveredPlanet) {
            this.currentPlanetId = this.hoveredPlanet.id;
            this.selectedObject = this.hoveredPlanet;
            window.SoundFX?.play('zoomToPlanet');
            this.onPlanetClick?.(this.hoveredPlanet);
            return true;
        }
        return false;
    }
    
    // Public API (matches Canvas2D renderer)
    setViewMode(mode) {
        this.viewMode = mode;
        this.fitView();
    }
    
    setCurrentPlanet(planetId) {
        this.currentPlanetId = planetId;
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
    
    highlightEmpire(empireId) {
        this.highlightedEmpires = empireId ? [empireId] : [];
        this.highlightPulse = 0;
        setTimeout(() => {
            if (this.highlightedEmpires.includes(empireId)) {
                this.highlightedEmpires = [];
            }
        }, 5000);
    }
    
    highlightEmpires(empireIds) {
        this.highlightedEmpires = empireIds || [];
        this.highlightPulse = 0;
        setTimeout(() => {
            this.highlightedEmpires = [];
        }, 5000);
    }
    
    setEmpireColors(empires) {
        empires?.forEach(empire => {
            this.empireColors[empire.id] = empire.color;
        });
    }
    
    // Main render loop
    render(state) {
        if (!this._initialized || !this.app) return;
        
        // Track animation frames
        const now = performance.now();
        if (now - this._lastAnimTime > 50) {
            this._animFrame++;
            this._lastAnimTime = now;
        }
        
        // Smooth zoom interpolation
        this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * 0.12;
        
        // Update world container transform (camera)
        const centerX = this.app.screen.width / 2;
        const centerY = this.app.screen.height / 2;
        
        this.containers.world.x = centerX - this.camera.x * this.camera.zoom;
        this.containers.world.y = centerY - this.camera.y * this.camera.zoom;
        this.containers.world.scale.set(this.camera.zoom);
        
        // Update starfield parallax and twinkling
        this._updateStarfield();
        
        if (state) {
            switch (this.viewMode) {
                case 'universe':
                    this._drawUniverse(state);
                    break;
                case 'galaxy':
                    this._drawGalaxy(state);
                    break;
                case 'system':
                    this._drawSystem(state);
                    break;
                case 'planet':
                    this._drawPlanet(state);
                    break;
            }
            
            // Draw fleets on top
            if (this.viewMode !== 'planet') {
                this._drawFleets(state);
            }
        }
        
        // Draw UI overlay (fixed position)
        this._drawOverlay(state);
    }
    
    _drawUniverse(state) {
        const universe = state.universe;
        if (!universe) return;
        
        // Cache for hover detection
        this.cachedGalaxies = universe.galaxies || [];
        this.cachedSystems = universe.solarSystems || [];
        
        // Clear and redraw hyperlanes
        this._drawHyperlanes(state, null);
        
        // Draw galaxies
        this._updateGalaxies(universe.galaxies, state);
        
        // Draw systems
        this._updateSystems(universe.solarSystems, state);
    }
    
    _drawGalaxy(state) {
        // Find galaxy to display
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
        this.cachedSystems = systems;
        this.cachedGalaxies = [];
        
        // Draw hyperlanes for this galaxy
        this._drawHyperlanes(state, galaxy.id);
        
        // Draw systems
        this._updateSystems(systems, state);
    }
    
    _drawSystem(state) {
        // Find system to display
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
        
        // Clear hyperlanes for system view
        this.graphics.hyperlanes.clear();
        this.graphics.wormholes.clear();
        
        // Draw central star
        this._drawStar(system);
        
        // Get planets in this system
        const planets = state.universe.planets?.filter(p => p.systemId === system.id) || [];
        this.systemPlanets = [];
        
        // Draw orbits and planets
        planets.forEach(planet => {
            const px = system.x + Math.cos(planet.orbitAngle) * planet.orbitRadius * 3;
            const py = system.y + Math.sin(planet.orbitAngle) * planet.orbitRadius * 3;
            
            this.systemPlanets.push({ ...planet, screenX: px, screenY: py, radius: 12 });
            
            this._drawPlanetInSystem(planet, px, py, system, state);
        });
        
        // Draw starbase if present
        const starbase = state.starbases?.find(sb => sb.systemId === system.id);
        if (starbase) {
            this._drawStarbase(starbase, system, state);
        }
    }
    
    _drawPlanet(state) {
        // Planet view uses more detailed rendering
        // For now, we'll draw a placeholder - full planet view is complex
        const planetId = this.currentPlanetId || 
                        (this.selectedObject?.id?.startsWith('planet') ? this.selectedObject.id : null);
        const planet = planetId 
            ? state.universe.planets?.find(p => p.id === planetId)
            : state.universe.planets?.[0];
        
        if (!planet) return;
        
        // Clear other containers
        this.graphics.hyperlanes.clear();
        this.graphics.wormholes.clear();
        
        // For planet view, we'll render using Canvas2D fallback for now
        // The surface grid rendering is complex and better suited to Canvas2D
        this._drawPlanetSurface(planet, state);
    }
    
    _drawHyperlanes(state, galaxyId) {
        const g = this.graphics.hyperlanes;
        g.clear();
        
        const hyperlanes = state.universe?.hyperlanes || [];
        if (hyperlanes.length === 0) return;
        
        const systems = state.universe?.solarSystems || [];
        const systemMap = new Map();
        systems.forEach(s => systemMap.set(s.id, s));
        
        hyperlanes.forEach(lane => {
            // Skip wormholes (drawn separately)
            if (lane.type === 'wormhole') return;
            
            // Filter by galaxy if specified
            if (galaxyId && lane.galaxyId !== galaxyId) return;
            
            const fromSystem = systemMap.get(lane.from);
            const toSystem = systemMap.get(lane.to);
            if (!fromSystem || !toSystem) return;
            
            // Draw subtle hyperlane
            g.moveTo(fromSystem.x, fromSystem.y);
            g.lineTo(toSystem.x, toSystem.y);
            g.stroke({ color: 0x00d4ff, width: 1.5, alpha: 0.3 });
        });
        
        // Draw wormholes
        this._drawWormholes(state, galaxyId, systemMap);
    }
    
    _drawWormholes(state, galaxyId, systemMap) {
        const g = this.graphics.wormholes;
        g.clear();
        
        const hyperlanes = state.universe?.hyperlanes || [];
        const time = Date.now() / 500;
        const pulse = (Math.sin(time) + 1) / 2;
        
        hyperlanes.filter(h => h.type === 'wormhole').forEach(wormhole => {
            const fromSystem = systemMap.get(wormhole.from);
            const toSystem = systemMap.get(wormhole.to);
            if (!fromSystem || !toSystem) return;
            
            // Animated glow
            const glowAlpha = 0.3 + pulse * 0.2;
            
            // Outer glow
            g.moveTo(fromSystem.x, fromSystem.y);
            g.lineTo(toSystem.x, toSystem.y);
            g.stroke({ color: 0xa855f7, width: 8, alpha: glowAlpha });
            
            // Inner line (dashed effect via multiple segments)
            g.moveTo(fromSystem.x, fromSystem.y);
            g.lineTo(toSystem.x, toSystem.y);
            g.stroke({ color: 0xa855f7, width: 2, alpha: 0.8 });
            
            // Midpoint portal icon
            const midX = (fromSystem.x + toSystem.x) / 2;
            const midY = (fromSystem.y + toSystem.y) / 2;
            
            g.circle(midX, midY, 12);
            g.stroke({ color: 0xa855f7, width: 2 });
            g.circle(midX, midY, 6);
            g.stroke({ color: 0xa855f7, width: 2, alpha: 0.6 });
        });
    }
    
    _updateGalaxies(galaxies, state) {
        // Clear old galaxy graphics
        this.containers.galaxies.removeChildren();
        
        galaxies?.forEach(galaxy => {
            const container = new PIXI.Container();
            container.x = galaxy.x;
            container.y = galaxy.y;
            
            const isHovered = this.hoveredObject?.id === galaxy.id;
            const isSelected = this.selectedObject?.id === galaxy.id;
            
            // Galaxy glow (radial gradient approximation)
            const glow = new PIXI.Graphics();
            const r = galaxy.radius;
            
            // Draw concentric circles for gradient effect
            for (let i = 10; i >= 0; i--) {
                const ratio = i / 10;
                const radius = r * ratio;
                const alpha = isHovered ? 0.4 * (1 - ratio) : 0.3 * (1 - ratio);
                const color = isHovered ? 0x00d9ff : 0x6496ff;
                
                glow.circle(0, 0, radius);
                glow.fill({ color: color, alpha: alpha });
            }
            
            container.addChild(glow);
            
            // Selection ring
            if (isHovered || isSelected) {
                const ring = new PIXI.Graphics();
                ring.circle(0, 0, r + 5);
                ring.stroke({ color: 0x00d9ff, width: 2 });
                container.addChild(ring);
            }
            
            // Galaxy name
            const name = new PIXI.Text({
                text: galaxy.name,
                style: {
                    fontSize: 12,
                    fill: isHovered ? 0x00d9ff : 0x888888,
                    fontFamily: 'sans-serif'
                }
            });
            name.anchor.set(0.5, 0);
            name.y = r + 15;
            container.addChild(name);
            
            this.containers.galaxies.addChild(container);
        });
    }
    
    _updateSystems(systems, state) {
        // Clear old system graphics
        this.containers.systems.removeChildren();
        
        const starColors = {
            yellow: 0xffff00,
            red: 0xff4444,
            blue: 0x4444ff,
            white: 0xffffff,
            orange: 0xff8800
        };
        
        systems?.forEach(system => {
            const container = new PIXI.Container();
            container.x = system.x;
            container.y = system.y;
            
            const isHovered = this.hoveredObject?.id === system.id;
            const isSelected = this.selectedObject?.id === system.id;
            const color = starColors[system.starType] || 0xffff00;
            const glowRadius = isHovered ? 12 : 8;
            
            // Star glow
            const glow = new PIXI.Graphics();
            for (let i = 5; i >= 0; i--) {
                const ratio = i / 5;
                const radius = glowRadius * ratio;
                const alpha = 1 - ratio;
                glow.circle(0, 0, radius);
                glow.fill({ color: color, alpha: alpha * 0.8 });
            }
            container.addChild(glow);
            
            // Star core
            const core = new PIXI.Graphics();
            core.circle(0, 0, isHovered ? 5 : 3);
            core.fill({ color: color });
            container.addChild(core);
            
            // Ownership indicators
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
                
                const ownership = new PIXI.Graphics();
                colors.forEach((c, i) => {
                    const colorHex = parseInt(c.replace('#', ''), 16);
                    const startAngle = i * arcSize - Math.PI / 2;
                    const endAngle = (i + 1) * arcSize - Math.PI / 2;
                    
                    // Draw arc
                    ownership.arc(0, 0, 12, startAngle, endAngle);
                    ownership.stroke({ color: colorHex, width: 3 });
                });
                container.addChild(ownership);
                
                // Highlight pulse for agent locations
                if (hasHighlighted) {
                    this.highlightPulse += 0.1;
                    const pulseRadius = 18 + Math.sin(this.highlightPulse) * 4;
                    const pulseAlpha = 0.5 + Math.sin(this.highlightPulse) * 0.3;
                    
                    const highlight = new PIXI.Graphics();
                    highlight.circle(0, 0, pulseRadius);
                    highlight.stroke({ color: 0x00ff80, width: 3, alpha: pulseAlpha });
                    container.addChild(highlight);
                }
            }
            
            // Selection ring
            if (isHovered || isSelected) {
                const ring = new PIXI.Graphics();
                ring.circle(0, 0, 15);
                ring.stroke({ color: 0x00d9ff, width: 1 });
                container.addChild(ring);
            }
            
            // Starbase indicator
            const starbase = state.starbases?.find(sb => sb.systemId === system.id);
            if (starbase && !starbase.constructing) {
                const sbIcon = starbase.tierName === 'citadel' ? '🏰' : 
                              starbase.tierName === 'starbase' ? '🛸' : '🛰️';
                const sbText = new PIXI.Text({
                    text: sbIcon,
                    style: { fontSize: 12 }
                });
                sbText.x = 15;
                sbText.y = -10;
                container.addChild(sbText);
            }
            
            this.containers.systems.addChild(container);
        });
    }
    
    _drawStar(system) {
        // Clear and draw central star for system view
        this.containers.galaxies.removeChildren();
        
        const starColors = {
            yellow: 0xffff00,
            red: 0xff4444,
            blue: 0x4444ff,
            white: 0xffffff,
            orange: 0xff8800
        };
        
        const container = new PIXI.Container();
        container.x = system.x;
        container.y = system.y;
        
        const color = starColors[system.starType] || 0xffff00;
        
        // Animated corona/flare effect
        const time = Date.now() * 0.001;
        const coronaPulse = 0.9 + 0.1 * Math.sin(time * 2);
        
        // Outer corona (pulsing)
        const corona = new PIXI.Graphics();
        for (let i = 15; i >= 0; i--) {
            const ratio = i / 15;
            const radius = 80 * ratio * coronaPulse;
            const alpha = (1 - ratio) * 0.15;
            corona.circle(0, 0, radius);
            corona.fill({ color: color, alpha: alpha });
        }
        container.addChild(corona);
        
        // Solar flares (animated rays)
        const flares = new PIXI.Graphics();
        const flareCount = 8;
        for (let i = 0; i < flareCount; i++) {
            const angle = (i / flareCount) * Math.PI * 2 + time * 0.1;
            const flareLength = 50 + Math.sin(time * 3 + i) * 15;
            const flareWidth = 3 + Math.sin(time * 2 + i * 0.5) * 2;
            
            flares.moveTo(25, 0);
            flares.lineTo(flareLength, -flareWidth);
            flares.lineTo(flareLength + 5, 0);
            flares.lineTo(flareLength, flareWidth);
            flares.closePath();
            flares.fill({ color: color, alpha: 0.3 });
            
            flares.rotation = angle;
        }
        flares.rotation = 0; // Reset after loop
        container.addChild(flares);
        
        // Large star glow (gradient-like rings)
        const glow = new PIXI.Graphics();
        for (let i = 12; i >= 0; i--) {
            const ratio = i / 12;
            const radius = 50 * ratio;
            const alpha = 1 - ratio;
            glow.circle(0, 0, radius);
            glow.fill({ color: color, alpha: alpha * 0.7 });
        }
        container.addChild(glow);
        
        // Star core (bright center)
        const core = new PIXI.Graphics();
        core.circle(0, 0, 22);
        core.fill({ color: color });
        // White hot center
        core.circle(0, 0, 12);
        core.fill({ color: 0xffffff, alpha: 0.8 });
        container.addChild(core);
        
        // Store reference for animation updates
        this._currentStar = { container, corona, flares, color };
        
        this.containers.galaxies.addChild(container);
    }
    
    _drawPlanetInSystem(planet, px, py, system, state) {
        const container = new PIXI.Container();
        container.x = px;
        container.y = py;
        
        const planetColors = {
            terrestrial: 0x4ade80,
            gas_giant: 0xf97316,
            ice: 0x7dd3fc,
            desert: 0xfcd34d,
            ocean: 0x3b82f6,
            volcanic: 0xef4444
        };
        
        const isHovered = this.hoveredPlanet?.id === planet.id;
        const isSelected = this.selectedObject?.id === planet.id;
        const color = planetColors[planet.type] || 0x888888;
        
        // Draw orbit ring (add to systems container, not this planet container)
        const orbit = new PIXI.Graphics();
        orbit.circle(system.x, system.y, planet.orbitRadius * 3);
        orbit.stroke({ color: 0xffffff, width: 1, alpha: 0.1 });
        this.containers.systems.addChildAt(orbit, 0);
        
        // Planet body
        const body = new PIXI.Graphics();
        body.circle(0, 0, isHovered ? 10 : 8);
        body.fill({ color: color });
        container.addChild(body);
        
        // Owner ring
        if (planet.owner) {
            const empire = state.empires?.find(e => e.id === planet.owner);
            if (empire) {
                const ownerColor = parseInt(empire.color.replace('#', ''), 16);
                
                // Outer glow
                const glow = new PIXI.Graphics();
                glow.circle(0, 0, isHovered ? 18 : 15);
                glow.stroke({ color: ownerColor, width: 4, alpha: 0.3 });
                container.addChildAt(glow, 0);
                
                // Owner ring
                const ring = new PIXI.Graphics();
                ring.circle(0, 0, isHovered ? 14 : 12);
                ring.stroke({ color: ownerColor, width: 3 });
                container.addChild(ring);
            }
        }
        
        // Highlight
        if (isHovered || isSelected) {
            const highlight = new PIXI.Graphics();
            highlight.circle(0, 0, 16);
            highlight.stroke({ color: 0x00d9ff, width: 2 });
            container.addChild(highlight);
        }
        
        // Planet name
        const name = new PIXI.Text({
            text: planet.name,
            style: {
                fontSize: 10,
                fill: 0xaaaaaa,
                fontFamily: 'sans-serif'
            }
        });
        name.anchor.set(0.5, 0);
        name.y = 20;
        container.addChild(name);
        
        this.containers.systems.addChild(container);
    }
    
    _drawStarbase(starbase, system, state) {
        const container = new PIXI.Container();
        container.x = system.x + 80;
        container.y = system.y - 60;
        
        const empire = state.empires?.find(e => e.id === starbase.owner);
        const colorHex = empire ? parseInt(empire.color.replace('#', ''), 16) : 0x888888;
        const sbSize = starbase.tier * 8 + 10;
        
        // Outer glow
        const glow = new PIXI.Graphics();
        glow.circle(0, 0, sbSize + 8);
        glow.fill({ color: colorHex, alpha: 0.2 });
        container.addChild(glow);
        
        // Main structure
        const body = new PIXI.Graphics();
        body.circle(0, 0, sbSize);
        body.fill({ color: starbase.constructing ? 0x555555 : colorHex });
        container.addChild(body);
        
        // Icon
        const sbIcon = starbase.tierName === 'citadel' ? '🏰' : 
                      starbase.tierName === 'starbase' ? '🛸' : '🛰️';
        const icon = new PIXI.Text({
            text: sbIcon,
            style: { fontSize: 16 }
        });
        icon.anchor.set(0.5);
        container.addChild(icon);
        
        // Name
        const name = new PIXI.Text({
            text: starbase.name,
            style: {
                fontSize: 9,
                fill: starbase.constructing ? 0x888888 : 0xffffff,
                fontFamily: 'sans-serif'
            }
        });
        name.anchor.set(0.5, 0);
        name.y = sbSize + 18;
        container.addChild(name);
        
        this.containers.systems.addChild(container);
    }
    
    _drawPlanetSurface(planet, state) {
        // Clear containers
        this.containers.galaxies.removeChildren();
        this.containers.systems.removeChildren();
        
        const container = new PIXI.Container();
        
        // Planet surface is complex - create a simplified view
        const TILE_SIZE = 36;
        const surfaceWidth = planet.surface?.[0]?.length || 20;
        const surfaceHeight = planet.surface?.length || 15;
        const gridWidth = surfaceWidth * TILE_SIZE;
        const gridHeight = surfaceHeight * TILE_SIZE;
        const offsetX = -gridWidth / 2;
        const offsetY = -gridHeight / 2;
        
        const tileColors = {
            water: 0x2563eb,
            plains: 0x22c55e,
            mountain: 0x4b5563,
            forest: 0x15803d,
            sand: 0xeab308,
            ice: 0x93c5fd,
            lava: 0xdc2626,
            empty: 0x60a5fa,
            grass: 0x22c55e,
            dirt: 0x92400e,
            stone: 0x4b5563
        };
        
        // Draw surface grid
        if (planet.surface) {
            const surfaceGraphics = new PIXI.Graphics();
            
            planet.surface.forEach((row, y) => {
                row.forEach((tile, x) => {
                    const px = offsetX + x * TILE_SIZE;
                    const py = offsetY + y * TILE_SIZE;
                    
                    const terrainType = typeof tile === 'object' ? tile.type : tile;
                    const color = tileColors[terrainType] || 0x444444;
                    
                    surfaceGraphics.rect(px, py, TILE_SIZE, TILE_SIZE);
                    surfaceGraphics.fill({ color: color });
                    surfaceGraphics.stroke({ color: 0x000000, width: 0.5, alpha: 0.2 });
                });
            });
            
            container.addChild(surfaceGraphics);
        }
        
        // Get entities on this planet
        const planetEntities = state.entities?.filter(e => e.location === planet.id) || [];
        const structures = planetEntities.filter(e => e.type === 'structure');
        
        // Draw structures
        const structureIcons = {
            mine: '⛏️',
            power_plant: '⚡',
            farm: '🌾',
            research_lab: '🔬',
            barracks: '🏛️',
            shipyard: '🚀',
            fortress: '🏰',
            fishing_dock: '🎣',
            lumbermill: '🪓'
        };
        
        structures.forEach(struct => {
            if (struct.gridX !== null && struct.gridY !== null) {
                const px = offsetX + struct.gridX * TILE_SIZE + TILE_SIZE / 2;
                const py = offsetY + struct.gridY * TILE_SIZE + TILE_SIZE / 2;
                
                const icon = new PIXI.Text({
                    text: structureIcons[struct.defName] || '🏗️',
                    style: { fontSize: TILE_SIZE - 12 }
                });
                icon.anchor.set(0.5);
                icon.x = px;
                icon.y = py;
                container.addChild(icon);
            }
        });
        
        // Planet header
        const ownerEmpire = state.empires?.find(e => e.id === planet.owner);
        const headerText = new PIXI.Text({
            text: `🪐 ${planet.name}`,
            style: {
                fontSize: 20,
                fill: 0xe8eaf0,
                fontFamily: 'Segoe UI, sans-serif',
                fontWeight: 'bold'
            }
        });
        headerText.x = offsetX;
        headerText.y = offsetY - 50;
        container.addChild(headerText);
        
        if (ownerEmpire) {
            const ownerText = new PIXI.Text({
                text: ownerEmpire.name,
                style: {
                    fontSize: 12,
                    fill: parseInt(ownerEmpire.color.replace('#', ''), 16),
                    fontFamily: 'Segoe UI, sans-serif'
                }
            });
            ownerText.x = offsetX;
            ownerText.y = offsetY - 25;
            container.addChild(ownerText);
        }
        
        container.x = 500;  // Center on camera default
        container.y = 500;
        
        this.containers.galaxies.addChild(container);
    }
    
    _drawFleets(state) {
        // Clear fleet container
        this.containers.fleets.removeChildren();
        
        const fleets = state.fleetsInTransit || state.allFleets || [];
        if (fleets.length === 0) return;
        
        const systems = state.universe?.solarSystems || [];
        const planets = state.universe?.planets || [];
        
        fleets.forEach(fleet => {
            let originX, originY, destX, destY;
            let visible = false;
            
            if (this.viewMode === 'universe' || this.viewMode === 'galaxy') {
                const originSystem = systems.find(s => s.id === fleet.originSystemId);
                const destSystem = systems.find(s => s.id === fleet.destSystemId);
                
                if (originSystem && destSystem && fleet.originSystemId !== fleet.destSystemId) {
                    originX = originSystem.x;
                    originY = originSystem.y;
                    destX = destSystem.x;
                    destY = destSystem.y;
                    visible = true;
                }
            } else if (this.viewMode === 'system') {
                const currentSystem = this.selectedObject?.id?.startsWith('system') 
                    ? this.selectedObject.id 
                    : this.selectedObject?.systemId;
                
                if (fleet.originSystemId === currentSystem || fleet.destSystemId === currentSystem) {
                    const originPlanet = planets.find(p => p.id === fleet.originPlanetId);
                    const destPlanet = planets.find(p => p.id === fleet.destPlanetId);
                    const system = systems.find(s => s.id === currentSystem);
                    
                    if (originPlanet && destPlanet && system) {
                        originX = system.x + Math.cos(originPlanet.orbitAngle) * originPlanet.orbitRadius * 3;
                        originY = system.y + Math.sin(originPlanet.orbitAngle) * originPlanet.orbitRadius * 3;
                        destX = system.x + Math.cos(destPlanet.orbitAngle) * destPlanet.orbitRadius * 3;
                        destY = system.y + Math.sin(destPlanet.orbitAngle) * destPlanet.orbitRadius * 3;
                        visible = true;
                    }
                }
            }
            
            if (!visible) return;
            
            const empireColor = this.empireColors[fleet.empireId] || '#00d9ff';
            const colorHex = parseInt(empireColor.replace('#', ''), 16);
            const progress = fleet.progress || 0;
            const currentX = originX + (destX - originX) * progress;
            const currentY = originY + (destY - originY) * progress;
            
            const fleetGraphics = new PIXI.Graphics();
            
            // Trail line
            fleetGraphics.moveTo(originX, originY);
            fleetGraphics.lineTo(currentX, currentY);
            fleetGraphics.stroke({ color: colorHex, width: 2, alpha: 0.8 });
            
            // Remaining path (dashed approximation)
            fleetGraphics.moveTo(currentX, currentY);
            fleetGraphics.lineTo(destX, destY);
            fleetGraphics.stroke({ color: colorHex, width: 2, alpha: 0.4 });
            
            // Fleet icon (triangle)
            const angle = Math.atan2(destY - originY, destX - originX);
            
            // Engine particle trail effect
            const particleCount = 5;
            const time = Date.now() * 0.005;
            for (let i = 0; i < particleCount; i++) {
                const trailOffset = (i / particleCount) * 20;
                const trailX = currentX - Math.cos(angle) * (8 + trailOffset);
                const trailY = currentY - Math.sin(angle) * (8 + trailOffset);
                const particleAlpha = 0.6 - (i / particleCount) * 0.5;
                const particleSize = 3 - (i / particleCount) * 2;
                
                // Animated offset for flickering effect
                const flicker = Math.sin(time + i * 0.5) * 2;
                
                fleetGraphics.circle(
                    trailX + Math.sin(angle) * flicker,
                    trailY - Math.cos(angle) * flicker,
                    particleSize
                );
                fleetGraphics.fill({ color: 0xff6600, alpha: particleAlpha });
            }
            
            // Engine glow
            fleetGraphics.circle(
                currentX - Math.cos(angle) * 6,
                currentY - Math.sin(angle) * 6,
                5
            );
            fleetGraphics.fill({ color: 0xff8800, alpha: 0.6 });
            
            fleetGraphics.moveTo(
                currentX + Math.cos(angle) * 10,
                currentY + Math.sin(angle) * 10
            );
            fleetGraphics.lineTo(
                currentX + Math.cos(angle + 2.5) * 8,
                currentY + Math.sin(angle + 2.5) * 8
            );
            fleetGraphics.lineTo(
                currentX + Math.cos(angle + Math.PI) * 4,
                currentY + Math.sin(angle + Math.PI) * 4
            );
            fleetGraphics.lineTo(
                currentX + Math.cos(angle - 2.5) * 8,
                currentY + Math.sin(angle - 2.5) * 8
            );
            fleetGraphics.closePath();
            fleetGraphics.fill({ color: colorHex });
            fleetGraphics.stroke({ color: 0xffffff, width: 1.5 });
            
            this.containers.fleets.addChild(fleetGraphics);
            
            // Ship count badge
            if (fleet.shipCount > 1) {
                const badge = new PIXI.Graphics();
                badge.circle(currentX + 10, currentY - 10, 8);
                badge.fill({ color: 0x1a1a2e });
                badge.stroke({ color: colorHex, width: 1 });
                this.containers.fleets.addChild(badge);
                
                const count = new PIXI.Text({
                    text: fleet.shipCount.toString(),
                    style: {
                        fontSize: 8,
                        fill: 0xffffff,
                        fontWeight: 'bold'
                    }
                });
                count.anchor.set(0.5);
                count.x = currentX + 10;
                count.y = currentY - 10;
                this.containers.fleets.addChild(count);
            }
        });
    }
    
    _drawOverlay(state) {
        // Clear UI container
        this.containers.ui.removeChildren();
        
        if (!state) return;
        
        // View info text
        const info = new PIXI.Text({
            text: `View: ${this.viewMode}\nZoom: ${(this.camera.zoom * 100).toFixed(0)}%${state.tick ? `\nTick: ${state.tick}` : ''}`,
            style: {
                fontSize: 12,
                fill: 0xaaaaaa,
                fontFamily: 'sans-serif',
                align: 'right'
            }
        });
        info.anchor.set(1, 0);
        info.x = this.app.screen.width - 10;
        info.y = 20;
        this.containers.ui.addChild(info);
        
        // WebGL indicator
        const indicator = new PIXI.Text({
            text: '⚡ WebGL',
            style: {
                fontSize: 10,
                fill: 0x00ff00,
                fontFamily: 'sans-serif'
            }
        });
        indicator.anchor.set(1, 1);
        indicator.x = this.app.screen.width - 10;
        indicator.y = this.app.screen.height - 10;
        this.containers.ui.addChild(indicator);
    }
    
    // Check if PixiJS is ready
    isReady() {
        return this._initialized && !this._initFailed;
    }
    
    // Wait for initialization to complete (with timeout)
    async waitForInit(timeout = 3000) {
        const start = Date.now();
        while (!this._initialized && !this._initFailed) {
            if (Date.now() - start > timeout) {
                console.warn('⏱️ PixiJS init timeout');
                return false;
            }
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        return this._initialized && !this._initFailed;
    }
    
    // Check if initialization failed
    hasFailed() {
        return this._initFailed;
    }
    
    // Cleanup
    destroy() {
        if (this.app) {
            this.app.destroy(true, { children: true });
            this.app = null;
        }
        this._initialized = false;
    }
}
