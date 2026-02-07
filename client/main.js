// Main client entry point for Clawdistan observer
// This is a READ-ONLY observer for humans to watch AI agents play

import { Renderer } from './renderer.js';
import { PixiRenderer } from './pixi-renderer.js';
import { UIManager, NotificationManager } from './ui.js';

class ClawdistanClient {
    constructor() {
        this.renderer = null;
        this.pixiRenderer = null;
        this.canvas2dRenderer = null;
        this.usePixi = true;  // Start with PixiJS if available
        this.ui = null;
        this.notifications = null;
        this.state = null;
        this.agents = [];
        
        // Delta update tracking
        this.lastTick = 0;
        this.fullRefreshInterval = 30; // Full refresh every 30 seconds
        this.lastFullRefresh = 0;
        
        // Surface cache for lazy loading
        this.surfaceCache = new Map(); // planetId -> { surface, tick }
        this.surfaceFetchPending = new Set(); // Prevent duplicate fetches

        this.init();
    }

    async init() {
        const canvas = document.getElementById('gameCanvas');
        
        // PixiJS temporarily disabled - using Canvas2D renderer
        // TODO: Fix PixiJS v8 ES module loading
        console.log('🎨 Using Canvas2D renderer');
        this.usePixi = false;
        
        // Fall back to Canvas2D if needed
        if (!this.usePixi) {
            this.canvas2dRenderer = new Renderer(canvas);
            this.renderer = this.canvas2dRenderer;
        }
        
        this.ui = new UIManager();
        this.notifications = new NotificationManager();

        this.setupCallbacks();
        this.fetchState();
        this.fetchAgents();
        this.render();
        
        // Initialize leaderboard
        this.ui.initLeaderboard();
        
        // Initialize minimap
        this.initMinimap();

        setInterval(() => this.fetchState(), 5000);  // Reduced from 1s to 5s (bandwidth)
        setInterval(() => this.fetchAgents(), 10000); // Reduced from 2s to 10s
        setInterval(() => this.ui.fetchLeaderboard(), 30000); // Refresh leaderboard every 30s

        console.log('Clawdistan observer initialized');
        
        // Log which renderer is active (no toggle needed - PixiJS is default)
        if (this.usePixi) {
            console.log('🎮 Using PixiJS WebGL renderer (hardware accelerated)');
        } else {
            console.log('🖼️ Using Canvas2D renderer (WebGL not available)');
        }
    }
    
    _checkWebGLSupport() {
        try {
            const canvas = document.createElement('canvas');
            return !!(window.WebGLRenderingContext && 
                     (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
        } catch (e) {
            return false;
        }
    }
    
    _addRendererToggle() {
        // Add toggle button to zoom controls
        const zoomControls = document.querySelector('.zoom-controls');
        if (zoomControls) {
            const toggleBtn = document.createElement('button');
            toggleBtn.id = 'rendererToggle';
            toggleBtn.title = 'Toggle Renderer (PixiJS/Canvas2D)';
            toggleBtn.textContent = this.usePixi ? '⚡' : '🖼️';
            toggleBtn.style.marginLeft = '10px';
            toggleBtn.addEventListener('click', () => this.toggleRenderer());
            zoomControls.appendChild(toggleBtn);
        }
    }
    
    async toggleRenderer() {
        const canvas = document.getElementById('gameCanvas');
        const currentView = this.renderer.viewMode;
        const currentPlanet = this.renderer.currentPlanetId;
        const currentSelected = this.renderer.selectedObject;
        
        // Clean up current renderer
        if (this.usePixi && this.pixiRenderer) {
            this.pixiRenderer.destroy();
            this.pixiRenderer = null;
        }
        
        // Toggle
        this.usePixi = !this.usePixi;
        
        if (this.usePixi && typeof PIXI !== 'undefined') {
            // Switch to PixiJS
            this.pixiRenderer = new PixiRenderer(canvas);
            
            // Wait for async initialization (up to 3 seconds)
            const ready = await this.pixiRenderer.waitForInit(3000);
            
            if (ready) {
                this.renderer = this.pixiRenderer;
                console.log('✅ Switched to PixiJS WebGL');
            } else {
                // Failed, stay on Canvas2D
                this.pixiRenderer.destroy();
                this.pixiRenderer = null;
                this.usePixi = false;
                if (!this.canvas2dRenderer) {
                    this.canvas2dRenderer = new Renderer(canvas);
                }
                this.renderer = this.canvas2dRenderer;
                console.log('⚠️ PixiJS failed, staying on Canvas2D');
            }
        } else {
            // Switch to Canvas2D
            if (!this.canvas2dRenderer) {
                this.canvas2dRenderer = new Renderer(canvas);
            }
            this.renderer = this.canvas2dRenderer;
            console.log('✅ Switched to Canvas2D');
        }
        
        // Restore state
        this.renderer.setViewMode(currentView);
        this.renderer.currentPlanetId = currentPlanet;
        this.renderer.selectedObject = currentSelected;
        if (this.state?.empires) {
            this.renderer.setEmpireColors(this.state.empires);
        }
        
        // Re-setup callbacks
        this.setupCallbacks();
        
        // Update toggle button
        const toggleBtn = document.getElementById('rendererToggle');
        if (toggleBtn) {
            toggleBtn.textContent = this.usePixi ? '⚡' : '🖼️';
            toggleBtn.title = `Using ${this.usePixi ? 'PixiJS WebGL' : 'Canvas2D'} - Click to toggle`;
        }
    }

    setupCallbacks() {
        this.ui.onViewChange = (view) => this.changeView(view);
        this.ui.onZoom = (factor) => this.renderer.camera.targetZoom *= factor;
        this.ui.onZoomFit = () => this.renderer.fitView();
        
        // Handle view changes from clicking on map objects (galaxies, systems)
        this.renderer.onViewChange = (view) => this.changeView(view);

        this.ui.onEmpireSelect = (empireId) => {
            const empire = this.state?.empires?.find(e => e.id === empireId);
            if (empire) {
                this.ui.updateSelectedInfo({ type: 'empire', ...empire });
            }
        };

        this.renderer.onSelect = (object) => {
            if (object) {
                const type = object.id?.startsWith('planet') ? 'planet' :
                             object.id?.startsWith('system') ? 'system' : 'unknown';
                
                let info = { type, ...object };
                
                // For planets, include entity data, owner info, and active agents
                if (type === 'planet') {
                    const entities = this.state?.entities?.filter(e => e.location === object.id) || [];
                    const ownerEmpire = this.state?.empires?.find(e => e.id === object.owner);
                    // Find agents currently working on this planet
                    const activeAgents = this.agents?.filter(a => a.currentLocation === object.id) || [];
                    info = {
                        ...info,
                        entities,
                        ownerName: ownerEmpire?.name,
                        ownerColor: ownerEmpire?.color,
                        activeAgents
                    };
                }
                
                this.ui.updateSelectedInfo(info);
            }
        };

        // Handle planet clicks in system view - switch to planet view
        this.renderer.onPlanetClick = async (planet) => {
            // Update UI view buttons
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            const planetBtn = document.querySelector('.view-btn[data-view="planet"]');
            planetBtn?.classList.add('active');

            // Lazy load planet surface before switching to planet view
            if (!planet.surface) {
                await this.fetchPlanetSurface(planet.id);
            }

            // Switch to planet view
            this.renderer.setViewMode('planet');
            this.renderer.fitView();

            // Update selected info panel
            const entities = this.state?.entities?.filter(e => e.location === planet.id) || [];
            const ownerEmpire = this.state?.empires?.find(e => e.id === planet.owner);
            const activeAgents = this.agents?.filter(a => a.currentLocation === planet.id) || [];
            
            this.ui.updateSelectedInfo({
                type: 'planet',
                ...planet,
                entities,
                ownerName: ownerEmpire?.name,
                ownerColor: ownerEmpire?.color,
                activeAgents
            });
        };

        // Agent location callbacks
        this.ui.onLocateAgent = (agent) => this.locateAgent(agent);
        this.ui.onShowAllAgents = (agents) => this.showAllAgents(agents);
    }

    locateAgent(agent) {
        if (!agent.empireId || !this.state) return;

        // Prefer agent's current location, otherwise find a planet owned by their empire
        let planet = null;
        if (agent.currentLocation) {
            planet = this.state.universe?.planets?.find(p => p.id === agent.currentLocation);
        }
        if (!planet) {
            planet = this.state.universe?.planets?.find(p => p.owner === agent.empireId);
        }
        
        if (planet) {
            // Set this as the current planet for planet view
            this.renderer.setCurrentPlanet(planet.id);
            
            // Find the system containing this planet
            const system = this.state.universe?.solarSystems?.find(s => s.id === planet.systemId);
            if (system) {
                this.renderer.zoomTo(system);
                this.renderer.highlightEmpire(agent.empireId);
                this.ui.updateSelectedInfo({
                    type: 'empire',
                    ...this.state.empires?.find(e => e.id === agent.empireId)
                });
            }
        }
    }

    showAllAgents(agents) {
        if (!agents || agents.length === 0) return;

        // Collect all empire IDs from connected agents
        const empireIds = [...new Set(agents.map(a => a.empireId).filter(Boolean))];
        this.renderer.highlightEmpires(empireIds);

        // Fit view to show universe
        this.renderer.setViewMode('universe');
        this.renderer.fitView();
    }

    async changeView(view) {
        // Update view buttons
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        const btn = document.querySelector(`.view-btn[data-view="${view}"]`);
        btn?.classList.add('active');
        
        // If switching to planet view, fetch surface for current planet
        if (view === 'planet') {
            // If no planet selected, pick the first owned planet or first planet
            if (!this.renderer.currentPlanetId) {
                const ownedPlanet = this.state?.universe?.planets?.find(p => p.owner);
                const firstPlanet = this.state?.universe?.planets?.[0];
                const defaultPlanet = ownedPlanet || firstPlanet;
                if (defaultPlanet) {
                    this.renderer.setCurrentPlanet(defaultPlanet.id);
                }
            }
            
            // Fetch surface if needed
            const planetId = this.renderer.currentPlanetId;
            if (planetId) {
                const planet = this.state?.universe?.planets?.find(p => p.id === planetId);
                if (planet && !planet.surface) {
                    await this.fetchPlanetSurface(planetId);
                }
            }
        }
        
        // Switch renderer view
        this.renderer.setViewMode(view);
        this.renderer.fitView();
    }

    async fetchState() {
        try {
            const now = Date.now();
            const needsFullRefresh = (now - this.lastFullRefresh) > this.fullRefreshInterval * 1000;
            
            if (this.lastTick === 0 || needsFullRefresh) {
                // Initial load or periodic full refresh
                const response = await fetch('/api/state');
                this.state = await response.json();
                this.lastTick = this.state.tick || 0;
                this.lastFullRefresh = now;
            } else {
                // Delta update - only fetch changes
                const response = await fetch(`/api/delta/${this.lastTick}`);
                const delta = await response.json();
                
                if (delta.type === 'full') {
                    // Server sent full state (we were too far behind)
                    this.state = delta.state;
                } else {
                    // Apply delta changes
                    this.applyDelta(delta);
                }
                this.lastTick = delta.toTick || this.state.tick || this.lastTick;
            }

            // Restore cached surfaces (they're not in light state)
            this.restoreCachedSurfaces();

            if (this.state.empires) {
                this.renderer.setEmpireColors(this.state.empires);
            }

            this.ui.update(this.state);
            
            // Process events for toast notifications (only after initial load settles)
            if (this.state.events && this.lastTick > 10) {
                this.notifications.processEvents(this.state.events, this.state.tick || 0);
            }
        } catch (err) {
            // Server might not be running yet
        }
    }

    applyDelta(delta) {
        if (!this.state || !delta.changes) return;

        // Update entities
        if (delta.changes.entities) {
            delta.changes.entities.forEach(updated => {
                const idx = this.state.entities?.findIndex(e => e.id === updated.id);
                if (idx >= 0) {
                    this.state.entities[idx] = updated;
                } else {
                    this.state.entities = this.state.entities || [];
                    this.state.entities.push(updated);
                }
            });
        }

        // Update planets (ownership, population - not surfaces)
        if (delta.changes.planets) {
            delta.changes.planets.forEach(updated => {
                const planet = this.state.universe?.planets?.find(p => p.id === updated.id);
                if (planet) {
                    planet.owner = updated.owner;
                    planet.population = updated.population;
                }
            });
        }

        // Update empires
        if (delta.changes.empires) {
            delta.changes.empires.forEach(updated => {
                const idx = this.state.empires?.findIndex(e => e.id === updated.id);
                if (idx >= 0) {
                    this.state.empires[idx] = updated;
                }
            });
        }

        // Update events
        if (delta.changes.events) {
            this.state.events = [
                ...(this.state.events || []),
                ...delta.changes.events
            ].slice(-50);
        }

        // Update fleets
        if (delta.changes.fleetsInTransit) {
            this.state.fleetsInTransit = delta.changes.fleetsInTransit;
        }

        this.state.tick = delta.toTick;
    }

    // Lazy load planet surface when needed
    async fetchPlanetSurface(planetId) {
        // Check cache first
        const cached = this.surfaceCache.get(planetId);
        if (cached && (this.state.tick - cached.tick) < 100) {
            return cached.surface;
        }

        // Prevent duplicate fetches
        if (this.surfaceFetchPending.has(planetId)) {
            return cached?.surface || null;
        }

        this.surfaceFetchPending.add(planetId);
        
        try {
            const response = await fetch(`/api/planet/${planetId}/surface`);
            if (response.ok) {
                const data = await response.json();
                this.surfaceCache.set(planetId, {
                    surface: data.surface,
                    tick: data.tick
                });
                
                // Update state with surface data
                const planet = this.state?.universe?.planets?.find(p => p.id === planetId);
                if (planet) {
                    planet.surface = data.surface;
                }
                
                return data.surface;
            }
        } catch (err) {
            console.warn(`Failed to fetch surface for ${planetId}:`, err);
        } finally {
            this.surfaceFetchPending.delete(planetId);
        }
        
        return null;
    }

    // Restore cached surfaces to state (called after state updates)
    restoreCachedSurfaces() {
        if (!this.state?.universe?.planets) return;
        
        for (const [planetId, cached] of this.surfaceCache) {
            const planet = this.state.universe.planets.find(p => p.id === planetId);
            if (planet && !planet.surface) {
                planet.surface = cached.surface;
            }
        }
    }

    async fetchAgents() {
        try {
            const response = await fetch('/api/agents');
            this.agents = await response.json();
            this.ui.updateAgentList(this.agents);
        } catch (err) {
            // Server might not be running yet
        }
    }

    render() {
        // Smart render throttling for performance
        const now = performance.now();
        
        // Check if we need to render (camera moving, dragging, or periodic refresh)
        const cameraMoving = this.renderer._isZooming || 
                            this.renderer._isDragging ||
                            Math.abs(this.renderer.camera.targetZoom - this.renderer.camera.zoom) > 0.001;
        const needsRender = cameraMoving || 
                           !this._lastRenderTime || 
                           (now - this._lastRenderTime) > 100; // Max 10fps when idle
        
        if (needsRender) {
            const renderState = this.state ? { ...this.state, connectedAgents: this.agents } : null;
            this.renderer.render(renderState);
            this._lastRenderTime = now;
            
            // Update minimap (throttled - every 5 frames)
            this._minimapFrameCount = (this._minimapFrameCount || 0) + 1;
            if (this._minimapFrameCount % 5 === 0 && this.state) {
                this.renderMinimap();
            }
        }
        
        requestAnimationFrame(() => this.render());
    }

    // Initialize minimap
    initMinimap() {
        this.minimapCanvas = document.getElementById('minimapCanvas');
        this.minimapViewport = document.getElementById('minimapViewport');
        this.minimapContainer = document.getElementById('minimapContainer');
        
        if (!this.minimapCanvas) return;
        
        this.minimapCtx = this.minimapCanvas.getContext('2d');
        
        // Click to navigate
        this.minimapCanvas.addEventListener('click', (e) => {
            const rect = this.minimapCanvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            
            // Convert to world coordinates
            const worldX = x * 1000;
            const worldY = y * 1000;
            
            // Move camera
            this.renderer.camera.x = worldX;
            this.renderer.camera.y = worldY;
            
            window.SoundFX?.play('mapClick');
        });
    }

    // Render the minimap
    renderMinimap() {
        if (!this.minimapCtx || !this.state?.universe) return;
        
        const ctx = this.minimapCtx;
        const canvas = this.minimapCanvas;
        const scale = canvas.width / 1000; // Universe is 1000x1000
        
        // Clear
        ctx.fillStyle = '#050510';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw galaxies
        const galaxies = this.state.universe.galaxies || [];
        galaxies.forEach(g => {
            const x = g.x * scale;
            const y = g.y * scale;
            const r = (g.radius || 100) * scale;
            
            const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
            grad.addColorStop(0, 'rgba(100, 150, 255, 0.4)');
            grad.addColorStop(1, 'rgba(50, 80, 150, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        });
        
        // Draw systems
        const systems = this.state.universe.solarSystems || [];
        const planets = this.state.universe.planets || [];
        const empires = this.state.empires || [];
        const empireMap = new Map(empires.map(e => [e.id, e]));
        
        systems.forEach(s => {
            const x = s.x * scale;
            const y = s.y * scale;
            
            // Check if any planet in this system is owned
            const ownedPlanet = planets.find(p => p.systemId === s.id && p.owner);
            const empire = ownedPlanet ? empireMap.get(ownedPlanet.owner) : null;
            
            ctx.beginPath();
            ctx.arc(x, y, empire ? 3 : 2, 0, Math.PI * 2);
            ctx.fillStyle = empire ? empire.color : 'rgba(255, 255, 0, 0.5)';
            ctx.fill();
        });
        
        // Draw viewport indicator
        this.updateMinimapViewport();
    }

    updateMinimapViewport() {
        if (!this.minimapViewport || !this.minimapCanvas) return;
        
        const canvas = document.getElementById('gameCanvas');
        if (!canvas) return;
        
        const scale = this.minimapCanvas.width / 1000;
        const camera = this.renderer.camera;
        
        // Calculate viewport size in world coordinates
        const viewWidth = canvas.width / camera.zoom;
        const viewHeight = canvas.height / camera.zoom;
        
        // Convert to minimap coordinates
        const vpX = (camera.x - viewWidth / 2) * scale;
        const vpY = (camera.y - viewHeight / 2) * scale;
        const vpW = viewWidth * scale;
        const vpH = viewHeight * scale;
        
        // Clamp and position
        this.minimapViewport.style.left = `${Math.max(0, Math.min(vpX, this.minimapCanvas.width - 10))}px`;
        this.minimapViewport.style.top = `${Math.max(0, Math.min(vpY, this.minimapCanvas.height - 20 - 10))}px`;
        this.minimapViewport.style.width = `${Math.max(10, Math.min(vpW, this.minimapCanvas.width))}px`;
        this.minimapViewport.style.height = `${Math.max(10, Math.min(vpH, this.minimapCanvas.height - 20))}px`;
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.clawdistan = new ClawdistanClient();
});
