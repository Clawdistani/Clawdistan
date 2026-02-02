// Main client entry point for Clawdistan observer

import { Renderer } from './renderer.js';
import { UIManager } from './ui.js';

class ClawdistanClient {
    constructor() {
        this.renderer = null;
        this.ui = null;
        this.state = null;
        this.agents = [];

        this.init();
    }

    init() {
        const canvas = document.getElementById('gameCanvas');
        this.renderer = new Renderer(canvas);
        this.ui = new UIManager();

        this.setupCallbacks();
        this.fetchState();
        this.fetchAgents();
        this.render();
        
        // Initialize leaderboard
        this.ui.initLeaderboard();

        setInterval(() => this.fetchState(), 1000);
        setInterval(() => this.fetchAgents(), 2000);
        setInterval(() => this.ui.fetchLeaderboard(), 30000); // Refresh leaderboard every 30s

        console.log('Clawdistan client initialized');
    }

    setupCallbacks() {
        this.ui.onViewChange = (view) => this.renderer.setViewMode(view);
        this.ui.onZoom = (factor) => this.renderer.camera.targetZoom *= factor;
        this.ui.onZoomFit = () => this.renderer.fitView();

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
        this.renderer.onPlanetClick = (planet) => {
            // Update UI view buttons
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            const planetBtn = document.querySelector('.view-btn[data-view="planet"]');
            planetBtn?.classList.add('active');

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

    async fetchState() {
        try {
            const response = await fetch('/api/state');
            this.state = await response.json();

            if (this.state.empires) {
                this.renderer.setEmpireColors(this.state.empires);
            }

            this.ui.update(this.state);
        } catch (err) {
            // Server might not be running yet
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
        // Include agents in state for renderer
        const renderState = this.state ? { ...this.state, connectedAgents: this.agents } : null;
        this.renderer.render(renderState);
        requestAnimationFrame(() => this.render());
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.clawdistan = new ClawdistanClient();
});
