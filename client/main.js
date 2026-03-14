// Main client entry point for Clawdistan observer
// This is a READ-ONLY observer for humans to watch AI agents play

import { Renderer } from './renderer.js';
import { UIManager, NotificationManager } from './ui.js';
import { CommandHUD } from './ui/command-hud.js';
import { initBattleUI } from './ui/battle-ui.js';
import { EventAlertSystem } from './ui/event-alerts.js';

class ClawdistanClient {
    constructor() {
        this.renderer = null;
        this.ui = null;
        this.notifications = null;
        this.commandHUD = null;
        this.state = null;
        this.battleUI = null;
        this.agents = [];
        this.eventAlerts = null;
        
        // Delta update tracking
        this.lastTick = 0;
        this.fullRefreshInterval = 30; // Full refresh every 30 seconds
        this.lastFullRefresh = 0;
        
        // Surface cache for lazy loading
        this.surfaceCache = new Map(); // planetId -> { surface, tick }
        this.surfaceFetchPending = new Set(); // Prevent duplicate fetches
        
        // FPS Performance Monitor
        this._fpsHistory = [];
        this._fpsLastTime = performance.now();
        this._fpsFrameCount = 0;
        this._fpsDisplay = null;
        this._fpsEnabled = localStorage.getItem('clawdistan_fps_enabled') === 'true';
        
        // Adaptive Frame Rate Scaling
        this._adaptiveFps = {
            enabled: localStorage.getItem('clawdistan_adaptive_fps') !== 'false', // On by default
            mode: localStorage.getItem('clawdistan_quality_mode') || 'balanced', // performance, balanced, quality
            currentTarget: 30,        // Current target FPS (adapts based on performance)
            avgFps: 60,               // Rolling average FPS
            fpsWindow: [],            // Last N FPS readings for averaging
            windowSize: 10,           // How many readings to average
            lastAdaptTime: 0,         // Last time we adapted
            adaptInterval: 2000,      // Check every 2 seconds
            // Mode-specific settings
            modes: {
                performance: { maxFps: 20, minFps: 10, cameraFps: 20, idleFps: 5 },
                balanced:    { maxFps: 30, minFps: 15, cameraFps: 30, idleFps: 10 },
                quality:     { maxFps: 60, minFps: 30, cameraFps: 60, idleFps: 30 }
            }
        };

        this.init();
    }

    async init() {
        const canvas = document.getElementById('gameCanvas');
        
        // Use Canvas2D renderer
        console.log('🎮 Initializing Canvas2D renderer...');
        this.renderer = new Renderer(canvas);
        
        this.ui = new UIManager();
        this.notifications = new NotificationManager();
        this.eventAlerts = new EventAlertSystem();

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
        
        // Initialize Command HUD (modern floating UI)
        this.commandHUD = new CommandHUD();
        this.commandHUD.init();
        this.setupCommandHUD();
        
        // Enable HUD mode (hides old sidebar)
        document.body.classList.add('hud-mode');
        
        // Expose for debugging
        window.commandHUD = this.commandHUD;

        // Initialize Battle UI (Phase 2)
        this.battleUI = initBattleUI({ tick: 0 });
        
        setInterval(() => this.fetchState(), 5000);  // Reduced from 1s to 5s (bandwidth)
        setInterval(() => this.fetchAgents(), 10000); // Reduced from 2s to 10s
        setInterval(() => this.ui.fetchLeaderboard(), 30000); // Refresh leaderboard every 30s
        setInterval(() => this.ui.updateDiplomacySummary(), 15000); // Update diplomacy every 15s
        
        // Initial diplomacy summary
        this.ui.updateDiplomacySummary();

        console.log('Clawdistan observer initialized');
        
        // Initialize FPS monitor
        this.initFpsMonitor();
        
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


    initFpsMonitor() {
        this._fpsDisplay = document.getElementById('fpsMonitor');
        if (this._fpsDisplay && this._fpsEnabled) {
            this._fpsDisplay.style.display = 'block';
        }
        
        // Toggle with 'P' key (FPS display)
        // Cycle quality modes with 'Q' key
        document.addEventListener('keydown', (e) => {
            // Don't trigger if typing in input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            if (e.key.toLowerCase() === 'p' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                this._fpsEnabled = !this._fpsEnabled;
                localStorage.setItem('clawdistan_fps_enabled', this._fpsEnabled);
                if (this._fpsDisplay) {
                    this._fpsDisplay.style.display = this._fpsEnabled ? 'block' : 'none';
                }
            }
            
            // Q key cycles through quality modes: performance -> balanced -> quality
            if (e.key.toLowerCase() === 'q' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                this.cycleQualityMode();
            }
        });
        
        // Create quality mode indicator
        this.createQualityIndicator();
    }
    
    /**
     * Cycle through quality modes: performance -> balanced -> quality
     */
    cycleQualityMode() {
        const modes = ['performance', 'balanced', 'quality'];
        const currentIndex = modes.indexOf(this._adaptiveFps.mode);
        const nextIndex = (currentIndex + 1) % modes.length;
        const newMode = modes[nextIndex];
        
        this._adaptiveFps.mode = newMode;
        localStorage.setItem('clawdistan_quality_mode', newMode);
        
        // Reset current target to new mode's max
        const modeSettings = this._adaptiveFps.modes[newMode];
        this._adaptiveFps.currentTarget = modeSettings.maxFps;
        
        // Show feedback
        this.showQualityModeToast(newMode);
        this.updateQualityIndicator();
        
        console.log(`🎮 Quality mode: ${newMode} (max ${modeSettings.maxFps} FPS)`);
    }
    
    /**
     * Create quality mode indicator in the FPS monitor area
     */
    createQualityIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'qualityIndicator';
        indicator.className = 'quality-indicator';
        indicator.title = 'Press Q to cycle quality modes';
        indicator.innerHTML = `<span class="quality-label">${this._adaptiveFps.mode.toUpperCase()}</span>`;
        
        // Insert next to FPS monitor
        const fpsMonitor = document.getElementById('fpsMonitor');
        if (fpsMonitor) {
            fpsMonitor.parentNode.insertBefore(indicator, fpsMonitor.nextSibling);
        } else {
            document.body.appendChild(indicator);
        }
        
        // Make it clickable
        indicator.addEventListener('click', () => this.cycleQualityMode());
    }
    
    /**
     * Update quality indicator display
     */
    updateQualityIndicator() {
        const indicator = document.getElementById('qualityIndicator');
        if (indicator) {
            indicator.querySelector('.quality-label').textContent = this._adaptiveFps.mode.toUpperCase();
            indicator.className = `quality-indicator mode-${this._adaptiveFps.mode}`;
        }
    }
    
    /**
     * Show toast notification for quality mode change
     */
    showQualityModeToast(mode) {
        const modeDescriptions = {
            performance: '⚡ Performance Mode: Lower FPS, better battery',
            balanced: '⚖️ Balanced Mode: Good FPS, good battery',
            quality: '✨ Quality Mode: Maximum FPS'
        };
        
        // Create temporary toast
        const toast = document.createElement('div');
        toast.className = 'quality-toast';
        toast.textContent = modeDescriptions[mode];
        document.body.appendChild(toast);
        
        // Animate in
        requestAnimationFrame(() => toast.classList.add('show'));
        
        // Remove after 2 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }
    
    updateFps(now) {
        this._fpsFrameCount++;
        const elapsed = now - this._fpsLastTime;
        
        // Update every 500ms
        if (elapsed >= 500) {
            const fps = Math.round((this._fpsFrameCount * 1000) / elapsed);
            this._fpsFrameCount = 0;
            this._fpsLastTime = now;
            
            // Update adaptive FPS tracking (always, even if display is off)
            this.updateAdaptiveFps(fps, now);
            
            // Update display if enabled
            if (this._fpsEnabled && this._fpsDisplay) {
                const valueEl = this._fpsDisplay.querySelector('.fps-value');
                if (valueEl) {
                    valueEl.textContent = fps;
                    
                    // Color coding based on mode's max FPS
                    const modeSettings = this._adaptiveFps.modes[this._adaptiveFps.mode];
                    const goodThreshold = modeSettings.maxFps * 0.8;
                    const warnThreshold = modeSettings.maxFps * 0.5;
                    
                    this._fpsDisplay.classList.remove('fps-good', 'fps-warning', 'fps-poor');
                    if (fps >= goodThreshold) {
                        this._fpsDisplay.classList.add('fps-good');
                    } else if (fps >= warnThreshold) {
                        this._fpsDisplay.classList.add('fps-warning');
                    } else {
                        this._fpsDisplay.classList.add('fps-poor');
                    }
                }
            }
        }
    }
    
    /**
     * Update adaptive FPS tracking and adjust target if needed
     */
    updateAdaptiveFps(fps, now) {
        const adaptive = this._adaptiveFps;
        if (!adaptive.enabled) return;
        
        // Add to rolling window
        adaptive.fpsWindow.push(fps);
        if (adaptive.fpsWindow.length > adaptive.windowSize) {
            adaptive.fpsWindow.shift();
        }
        
        // Calculate rolling average
        adaptive.avgFps = adaptive.fpsWindow.reduce((a, b) => a + b, 0) / adaptive.fpsWindow.length;
        
        // Check if we should adapt (every adaptInterval ms)
        if (now - adaptive.lastAdaptTime < adaptive.adaptInterval) return;
        adaptive.lastAdaptTime = now;
        
        const modeSettings = adaptive.modes[adaptive.mode];
        
        // If average FPS is significantly below target, lower the target
        if (adaptive.avgFps < adaptive.currentTarget * 0.7 && adaptive.currentTarget > modeSettings.minFps) {
            // Struggling - reduce target
            const newTarget = Math.max(modeSettings.minFps, Math.floor(adaptive.currentTarget * 0.8));
            if (newTarget !== adaptive.currentTarget) {
                console.log(`📉 Adaptive FPS: Reducing target ${adaptive.currentTarget} → ${newTarget} (avg: ${adaptive.avgFps.toFixed(1)})`);
                adaptive.currentTarget = newTarget;
            }
        }
        // If average FPS is consistently good, we can try increasing
        else if (adaptive.avgFps >= adaptive.currentTarget * 0.95 && adaptive.currentTarget < modeSettings.maxFps) {
            // Doing well - try increasing
            const newTarget = Math.min(modeSettings.maxFps, Math.ceil(adaptive.currentTarget * 1.2));
            if (newTarget !== adaptive.currentTarget) {
                console.log(`📈 Adaptive FPS: Increasing target ${adaptive.currentTarget} → ${newTarget} (avg: ${adaptive.avgFps.toFixed(1)})`);
                adaptive.currentTarget = newTarget;
            }
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

        // Handle tile clicks in planet view - show tile detail modal
        this.renderer.onTileClick = (tileInfo) => {
            this.ui.showTileDetailModal(tileInfo);
        };
        
        // Handle surface needed - fetch and re-render
        this.renderer.onSurfaceNeeded = async (planetId) => {
            await this.fetchPlanetSurface(planetId);
            // Re-render to show the loaded surface
            this.renderer.render(this.state);
        };

        // Agent location callbacks
        this.ui.onLocateAgent = (agent) => this.locateAgent(agent);
        this.ui.onShowAllAgents = (agents) => this.showAllAgents(agents);
        
        // Fleet location callback - navigate to fleet's destination
        this.ui.onLocateFleet = (fleet) => this.locateFleet(fleet);
    }
    
    /**
     * Set up the Command HUD with callbacks and data bindings
     */
    setupCommandHUD() {
        if (!this.commandHUD) return;
        
        // Empire hover/select callbacks
        this.commandHUD.onEmpireHover = (empireId) => {
            this.renderer.highlightEmpire(empireId);
        };
        
        this.commandHUD.onEmpireSelect = async (empireId) => {
            this.renderer.highlightEmpire(empireId);
            const empire = this.state?.empires?.find(e => e.id === empireId);
            if (empire) {
                // Focus camera on one of their planets
                const empireplanets = this.state?.universe?.planets?.filter(p => p.owner === empireId);
                if (empireplanets?.length > 0) {
                    const planet = empireplanets[0];
                    const system = this.state?.universe?.solarSystems?.find(s => s.id === planet.systemId);
                    const galaxy = this.state?.universe?.galaxies?.find(g => g.id === system?.galaxyId);
                    
                    if (system) {
                        // If we're zoomed into a different context, zoom out first
                        const currentView = this.renderer.currentView || 'universe';
                        
                        if (currentView === 'planet') {
                            // From planet view, go to universe first
                            await this.changeView('universe');
                        } else if (currentView === 'system') {
                            // From system view, go to universe first
                            await this.changeView('universe');
                        } else if (currentView === 'galaxy') {
                            // From galaxy view, go to universe first
                            await this.changeView('universe');
                        }
                        
                        // Small delay to let view change complete
                        await new Promise(r => setTimeout(r, 100));
                        
                        // Now zoom to the target system
                        this.renderer.zoomTo(system);
                    }
                }
            }
        };
        
        // Wire up renderer click events to show selection card
        const originalOnSelect = this.renderer.onSelect;
        this.renderer.onSelect = (object, event) => {
            // Call original handler
            if (originalOnSelect) originalOnSelect(object);
            
            // Show selection card at click position
            if (object && event) {
                this.commandHUD.showSelectionCard(object, { x: event.clientX, y: event.clientY });
            }
        };
    }
    
    /**
     * Update the Command HUD with current state
     */
    updateCommandHUD() {
        if (!this.commandHUD || !this.state) return;
        
        // Update empires
        const empireColors = {};
        this.state.empires?.forEach(e => {
            empireColors[e.id] = e.color;
        });
        
        // Use server-sent empire data (already includes planets, ships, population, score)
        // Only enrich with local data if server values are missing
        const enrichedEmpires = (this.state.empires || []).map(empire => {
            // Server sends: id, name, color, score, planets, population, ships, species
            // Only calculate locally as fallback if server didn't send values
            if (empire.planets === undefined || empire.ships === undefined) {
                const planets = this.state.universe?.planets?.filter(p => p.owner === empire.id) || [];
                const entities = this.state.entities?.filter(e => e.owner === empire.id) || [];
                const ships = entities.filter(e => e.type === 'unit');
                const totalPop = planets.reduce((sum, p) => sum + (p.population || 0), 0);
                
                return {
                    ...empire,
                    planets: empire.planets ?? planets.length,
                    ships: empire.ships ?? ships.length,
                    population: empire.population ?? totalPop
                };
            }
            return empire; // Server data is complete
        });
        
        this.commandHUD.updateEmpires(enrichedEmpires, empireColors);
        
        // Update fleets
        this.commandHUD.updateFleets(this.state.fleetsInTransit || [], this.state.tick);
        
        // Update agents
        const enrichedAgents = (this.agents || []).map(agent => {
            const empire = this.state.empires?.find(e => e.id === agent.empireId);
            return {
                ...agent,
                empireName: empire?.name || ''
            };
        });
        this.commandHUD.updateAgents(enrichedAgents);
        
        // Update diplomacy stats
        const wars = this.state.diplomacy?.wars?.length || 0;
        const alliances = this.state.diplomacy?.alliances?.length || 0;
        this.commandHUD.updateDiplomacy(wars, alliances);
        
        // Update active battles for the HUD
        this.commandHUD.state.activeBattles = this.state.activeBattles || [];
        this.commandHUD.state.currentTick = this.state.tick || 0;
        this.commandHUD.queueUpdate('quickStats');
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
            this.updateCommandHUD();

            // Update Battle UI with active battles
            if (this.battleUI && this.state) {
                this.battleUI.gameState = { tick: this.state.tick };
                this.battleUI.update(this.state);
            }
            
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

        // Update active battles (BUGFIX: battles weren't being updated from delta)
        if (delta.activeBattles) {
            this.state.activeBattles = delta.activeBattles;
        }
        
        // Update tick
        if (delta.tick) {
            this.state.tick = delta.tick;
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
            this.updateCommandHUD(); // Update HUD with new agents
            
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
    }    render() {
        // Smart render throttling with ADAPTIVE FPS
        const now = performance.now();
        
        // Check if we need to render (camera moving, dragging, or periodic refresh)
        const cameraMoving = this.renderer._isZooming || 
                            this.renderer._isDragging ||
                            Math.abs(this.renderer.camera.targetZoom - this.renderer.camera.zoom) > 0.001;
        
        // ADAPTIVE FPS: Use mode-specific settings with dynamic target
        const adaptive = this._adaptiveFps;
        const modeSettings = adaptive.modes[adaptive.mode];
        
        // Calculate interval based on adaptive target and current state
        let targetFps;
        if (cameraMoving) {
            // When camera moves, use the higher of camera setting or current adaptive target
            targetFps = Math.max(modeSettings.cameraFps, adaptive.currentTarget);
        } else {
            // When idle, use the lower of idle setting or current adaptive target
            targetFps = Math.min(modeSettings.idleFps, adaptive.currentTarget);
        }
        
        const minInterval = 1000 / targetFps;
        const needsRender = !this._lastRenderTime || (now - this._lastRenderTime) > minInterval;
        
        if (needsRender) {
            const renderState = this.state ? { ...this.state, connectedAgents: this.agents } : null;
            this.renderer.render(renderState);
            this._lastRenderTime = now;
        }
        
        // Update FPS monitor
        this.updateFps(now);
        
        requestAnimationFrame(() => this.render());
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.clawdistan = new ClawdistanClient();
});
