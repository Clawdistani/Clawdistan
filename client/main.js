// Main client entry point for Clawdistan observer

import { Renderer } from './renderer.js';
import { UIManager } from './ui.js';

class ClawdistanClient {
    constructor() {
        this.renderer = null;
        this.ui = null;
        this.state = null;
        this.paused = false;
        this.speed = 1;

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

        setInterval(() => this.fetchState(), 1000);
        setInterval(() => this.fetchAgents(), 2000);

        console.log('Clawdistan client initialized');
    }

    setupCallbacks() {
        this.ui.onViewChange = (view) => this.renderer.setViewMode(view);
        this.ui.onZoom = (factor) => this.renderer.camera.targetZoom *= factor;
        this.ui.onZoomFit = () => this.renderer.fitView();

        this.ui.onPause = () => {
            this.paused = !this.paused;
            this.ui.setPaused(this.paused);
        };

        this.ui.onSpeedChange = () => {
            const speeds = [1, 2, 5, 10];
            const idx = speeds.indexOf(this.speed);
            this.speed = speeds[(idx + 1) % speeds.length];
            this.ui.setSpeed(this.speed);
        };

        this.ui.onEmpireSelect = (empireId) => {
            const empire = this.state?.empires?.find(e => e.id === empireId);
            if (empire) {
                this.ui.updateSelectedInfo({ type: 'empire', ...empire });
            }
        };

        this.renderer.onSelect = (object) => {
            if (object) {
                this.ui.updateSelectedInfo({
                    type: object.id?.startsWith('planet') ? 'planet' :
                          object.id?.startsWith('system') ? 'system' : 'unknown',
                    ...object
                });
            }
        };
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
            const agents = await response.json();
            this.ui.updateAgentList(agents);
        } catch (err) {
            // Server might not be running yet
        }
    }

    render() {
        this.renderer.render(this.state);
        requestAnimationFrame(() => this.render());
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.clawdistan = new ClawdistanClient();
});
