// Main client entry point for Clawdistan observer
// This is a READ-ONLY observer for humans to watch AI agents play

import { Renderer } from './renderer.js';
import { UIManager, NotificationManager } from './ui.js';

class ClawdistanClient {
    constructor() {
        this.renderer = null;
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
        
        // Use Canvas2D renderer
        console.log('🎮 Initializing Canvas2D renderer...');
        this.renderer = new Renderer(canvas);
        
        this.ui = new UIManager();
        this.notifications = new NotificationManager();

        this.setupCallbacks();
        await this.fetchState();  // Await initial state before rendering
        this.fetchAgents();
        this.render();
        
        // Force UI update after short delay (ensures DOM is ready)
        setTimeout(() => {
            if (this.state) this.ui.update(this.state);
        }, 500);
        
        // Initialize leaderboard
        this.ui.initRankings();
        
        // Initialize tech tree
        this.ui.initTechTree();
        
        // Initialize diplomacy
        this.ui.initDiplomacy();
        
        // Initialize ship designer
        this.ui.initShipDesigner();
        
        // Initialize fleet details modal
        this.ui.initFleetDetailsModal();
        
        setInterval(() => this.fetchState(), 5000);  // Reduced from 1s to 5s (bandwidth)
        setInterval(() => this.fetchAgents(), 10000); // Reduced from 2s to 10s
        setInterval(() => this.ui.fetchLeaderboard(), 30000); // Refresh leaderboard every 30s
        setInterval(() => this.ui.updateDiplomacySummary(), 15000); // Update diplomacy every 15s
        
        // Initial diplomacy summary
        this.ui.updateDiplomacySummary();

        console.log('Clawdistan observer initialized');
        
        // Hide loading screen after initial render
        this.hideLoadingScreen();
    }
    
    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.classList.add('hidden');
            // Remove from DOM after transition
            setTimeout(() => loadingScreen.remove(), 500);
        }
    }
    
    updateLoadingStatus(message) {
        const status = document.getElementById('loadingStatus');
        if (status) status.textContent = message;
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
                // Enrich with additional stats
                const ownedPlanets = this.state?.universe?.planets?.filter(p => p.owner === empireId) || [];
                const entities = this.state?.entities?.filter(e => e.owner === empireId) || [];
                const ships = entities.filter(e => e.spaceUnit === true);
                const soldiers = entities.filter(e => e.defName === 'soldier');
                
                this.ui.updateSelectedInfo({ 
                    type: 'empire', 
                    ...empire,
                    ownedPlanets,
                    shipCount: ships.length,
                    soldierCount: soldiers.length,
                    totalEntities: entities.length
                });
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
                    // Update selected empire for resource bar
                    if (object.owner) {
                        this.ui.selectedEmpire = object.owner;
                    }
                }
                
                this.ui.updateSelectedInfo(info);
            }
        };

        // Handle planet clicks in system view - switch to planet view
        this.renderer.onPlanetClick = async (planet) => {
            // Lazy load planet surface before switching to planet view
            if (!planet.surface) {
                await this.fetchPlanetSurface(planet.id);
            }

            // Switch to planet view using changeView (handles centering properly)
            await this.changeView('planet');

            // Update selected info panel
            const entities = this.state?.entities?.filter(e => e.location === planet.id) || [];
            const ownerEmpire = this.state?.empires?.find(e => e.id === planet.owner);
            const activeAgents = this.agents?.filter(a => a.currentLocation === planet.id) || [];
            
            // Update selected empire for resource bar
            if (planet.owner) {
                this.ui.selectedEmpire = planet.owner;
            }
            
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
        
        // Fleet location callback - navigate to fleet's destination
        this.ui.onLocateFleet = (fleet) => this.locateFleet(fleet);
    }

    locateFleet(fleet) {
        if (!fleet || !this.state) return;
        
        // Navigate to destination system
        let system = null;
        if (fleet.destSystemId) {
            system = this.state.universe?.solarSystems?.find(s => s.id === fleet.destSystemId);
        }
        // Fallback to origin system if no destination
        if (!system && fleet.originSystemId) {
            system = this.state.universe?.solarSystems?.find(s => s.id === fleet.originSystemId);
        }
        
        if (system) {
            this.renderer.zoomTo(system);
            this.renderer.highlightEmpire(fleet.empireId);
            
            // Show empire info
            const empire = this.state.empires?.find(e => e.id === fleet.empireId);
            if (empire) {
                this.ui.updateSelectedInfo({
                    type: 'empire',
                    ...empire
                });
            }
        }
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
        
        // Center camera based on view type
        if (view === 'planet') {
            // Planet view: grid is drawn centered around (0,0) with slight offset for UI
            this.renderer.camera.x = -80;  // Match offsetX in drawPlanet
            this.renderer.camera.y = 30;   // Match offsetY in drawPlanet
            this.renderer.camera.targetZoom = 1;
        } else {
            // Center on selected object if available, otherwise fit view
            const selected = this.renderer.selectedObject;
            if (selected) {
                if (selected.screenX !== undefined && selected.screenY !== undefined) {
                    this.renderer.camera.x = selected.screenX;
                    this.renderer.camera.y = selected.screenY;
                } else if (selected.x !== undefined && selected.y !== undefined) {
                    this.renderer.camera.x = selected.x;
                    this.renderer.camera.y = selected.y;
                } else {
                    this.renderer.fitView();
                }
            } else {
                this.renderer.fitView();
            }
            this.renderer.camera.targetZoom = view === 'universe' ? 0.5 : 1;
        }
    }

    async fetchState() {
        try {
            const now = Date.now();
            const needsFullRefresh = (now - this.lastFullRefresh) > this.fullRefreshInterval * 1000;
            
            const isFirstLoad = this.lastTick === 0;
            if (isFirstLoad || needsFullRefresh) {
                // Initial load or periodic full refresh
                if (isFirstLoad) this.updateLoadingStatus('Loading universe data...');
                const response = await fetch('/api/state');
                if (isFirstLoad) this.updateLoadingStatus('Rendering galaxies...');
                this.state = await response.json();
                this.lastTick = this.state.tick || 0;
                this.lastFullRefresh = now;
                
                // Center on universe on first load
                if (isFirstLoad && this.state.universe?.galaxies?.length > 0) {
                    // Calculate center of all galaxies
                    const galaxies = this.state.universe.galaxies;
                    const centerX = galaxies.reduce((sum, g) => sum + g.x, 0) / galaxies.length;
                    const centerY = galaxies.reduce((sum, g) => sum + g.y, 0) / galaxies.length;
                    this.renderer.camera.x = centerX;
                    this.renderer.camera.y = centerY;
                    console.log(`🎯 Centered camera on universe: (${centerX.toFixed(0)}, ${centerY.toFixed(0)})`);
                }
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
            const data = await response.json();
            // Handle both old format (array) and new format (object with agents + stats)
            this.agents = data.agents || data;
            this.ui.updateAgentList(this.agents);
            
            // Update sidebar counts (agents + observers)
            const sidebarAgentEl = document.getElementById('sidebarAgentCount');
            if (sidebarAgentEl) {
                const agentCount = this.agents.length;
                sidebarAgentEl.textContent = agentCount > 0 ? `(${agentCount})` : '';
            }
            
            if (data.stats) {
                const observerEl = document.getElementById('observerCount');
                if (observerEl) {
                    // Always show observer count (includes human spectators)
                    const count = data.stats.observers || 0;
                    observerEl.textContent = count > 0 ? `👁 ${count}` : '';
                    observerEl.title = `${count} observer${count !== 1 ? 's' : ''} watching`;
                }
            }
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
        
        // PERFORMANCE: Render at 30fps max when camera moving, 10fps when idle
        const minInterval = cameraMoving ? 33 : 100;
        const needsRender = !this._lastRenderTime || (now - this._lastRenderTime) > minInterval;
        
        if (needsRender) {
            const renderState = this.state ? { ...this.state, connectedAgents: this.agents } : null;
            this.renderer.render(renderState);
            this._lastRenderTime = now;
        }
        
        requestAnimationFrame(() => this.render());
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.clawdistan = new ClawdistanClient();
});
