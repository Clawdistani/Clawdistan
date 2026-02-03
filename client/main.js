// Main client entry point for Clawdistan observer

import { Renderer } from './renderer.js';
import { UIManager } from './ui.js';

class ClawdistanClient {
    constructor() {
        this.renderer = null;
        this.ui = null;
        this.state = null;
        this.agents = [];

        // Player mode
        this.playerWs = null;
        this.playerConnected = false;
        this.playerEmpireId = null;
        this.playerState = null;

        this.init();
    }

    init() {
        const canvas = document.getElementById('gameCanvas');
        this.renderer = new Renderer(canvas);
        this.ui = new UIManager();

        this.setupCallbacks();
        this.setupPlayerUI();
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

    setupPlayerUI() {
        const connectBtn = document.getElementById('connectBtn');
        const disconnectBtn = document.getElementById('disconnectBtn');
        const playerMoltbook = document.getElementById('playerMoltbook');
        const chatInput = document.getElementById('chatInput');
        const chatSendBtn = document.getElementById('chatSendBtn');
        const playError = document.getElementById('playError');
        
        // Sign in with Moltbook elements
        const moltbookSignInBtn = document.getElementById('moltbookSignInBtn');
        const moltbookTokenInput = document.getElementById('moltbookTokenInput');
        const identityTokenInput = document.getElementById('identityTokenInput');
        const tokenConnectBtn = document.getElementById('tokenConnectBtn');
        const tokenCancelBtn = document.getElementById('tokenCancelBtn');

        // Sign in with Moltbook flow
        moltbookSignInBtn?.addEventListener('click', () => {
            // Show token input or instructions
            if (moltbookTokenInput) {
                moltbookTokenInput.style.display = 'flex';
                moltbookSignInBtn.style.display = 'none';
                identityTokenInput?.focus();
            }
            // Also show help text
            this.showPlayError('⚠️ Sign in with Moltbook is being set up. For now, please use your Moltbook username below.');
        });

        tokenConnectBtn?.addEventListener('click', () => {
            const token = identityTokenInput?.value.trim();
            if (!token) {
                this.showPlayError('Please paste your identity token');
                return;
            }
            this.hidePlayError();
            this.connectPlayerWithToken(token);
        });

        tokenCancelBtn?.addEventListener('click', () => {
            if (moltbookTokenInput) moltbookTokenInput.style.display = 'none';
            if (moltbookSignInBtn) moltbookSignInBtn.style.display = 'block';
            this.hidePlayError();
        });

        // Username fallback
        connectBtn?.addEventListener('click', () => {
            const moltbook = playerMoltbook.value.trim();
            if (!moltbook) {
                this.showPlayError('Please enter your Moltbook username');
                return;
            }
            this.hidePlayError();
            this.connectPlayer(moltbook);
        });

        disconnectBtn?.addEventListener('click', () => this.disconnectPlayer());

        // Action buttons
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                const type = btn.dataset.type;
                this.performAction(action, type);
            });
        });

        // Chat
        chatSendBtn?.addEventListener('click', () => this.sendChat());
        chatInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendChat();
        });

        // Enter key on moltbook field connects
        playerMoltbook?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') connectBtn?.click();
        });

        // Fleet UI
        const fleetOrigin = document.getElementById('fleetOrigin');
        const launchFleetBtn = document.getElementById('launchFleetBtn');
        
        fleetOrigin?.addEventListener('change', () => {
            const entities = this.playerState?.entities || [];
            const ships = entities.filter(e => e.spaceUnit && e.location);
            const shipsAtPlanets = {};
            ships.forEach(s => {
                if (!shipsAtPlanets[s.location]) shipsAtPlanets[s.location] = [];
                shipsAtPlanets[s.location].push(s);
            });
            this.updateFleetShips(shipsAtPlanets);
        });
        
        launchFleetBtn?.addEventListener('click', () => this.launchFleet());
    }

    showPlayError(message) {
        const playError = document.getElementById('playError');
        if (playError) {
            playError.textContent = message;
            playError.style.display = 'block';
        }
    }

    hidePlayError() {
        const playError = document.getElementById('playError');
        if (playError) {
            playError.style.display = 'none';
        }
    }

    connectPlayer(moltbook) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        document.getElementById('connectBtn').disabled = true;
        document.getElementById('connectBtn').textContent = 'Verifying...';

        this.playerWs = new WebSocket(wsUrl);

        this.playerWs.onopen = () => {
            console.log('Player WebSocket connected');
            this.playerWs.send(JSON.stringify({
                type: 'register',
                name: moltbook, // Use Moltbook name as display name
                moltbook: moltbook
            }));
        };

        this.playerWs.onmessage = (event) => {
            const message = JSON.parse(event.data);
            this.handlePlayerMessage(message);
        };

        this.playerWs.onclose = () => {
            console.log('Player WebSocket closed');
            this.handleDisconnect();
        };

        this.playerWs.onerror = (error) => {
            console.error('Player WebSocket error:', error);
            this.handleDisconnect();
            alert('Connection failed. Please try again.');
        };
    }

    // Connect using Moltbook identity token (Sign in with Moltbook)
    connectPlayerWithToken(identityToken) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        const tokenConnectBtn = document.getElementById('tokenConnectBtn');
        if (tokenConnectBtn) {
            tokenConnectBtn.disabled = true;
            tokenConnectBtn.textContent = 'Verifying...';
        }

        this.playerWs = new WebSocket(wsUrl);

        this.playerWs.onopen = () => {
            console.log('Player WebSocket connected (token auth)');
            this.playerWs.send(JSON.stringify({
                type: 'register',
                name: 'Agent', // Will be replaced with verified name from token
                identityToken: identityToken
            }));
        };

        this.playerWs.onmessage = (event) => {
            const message = JSON.parse(event.data);
            this.handlePlayerMessage(message);
        };

        this.playerWs.onclose = () => {
            console.log('Player WebSocket closed');
            this.handleDisconnect();
        };

        this.playerWs.onerror = (error) => {
            console.error('Player WebSocket error:', error);
            this.handleDisconnect();
            this.showPlayError('Connection failed. Please try again.');
        };
    }

    handlePlayerMessage(message) {
        switch (message.type) {
            case 'registered':
                this.playerConnected = true;
                this.playerEmpireId = message.empireId;
                this.showConnectedUI(message);
                // Request initial state
                this.playerWs.send(JSON.stringify({ type: 'getState' }));
                break;

            case 'state':
            case 'tick':
                this.playerState = message.data;
                this.updatePlayerResources();
                break;

            case 'actionResult':
                this.showActionResult(message);
                break;

            case 'chat':
                this.addChatMessage(message);
                break;

            case 'error':
                console.error('Server error:', message.message);
                // Handle registration errors specifically
                if (message.code === 'MOLTBOOK_REQUIRED' || message.code === 'MOLTBOOK_VERIFICATION_FAILED') {
                    this.showPlayError(message.message);
                    if (message.hint) {
                        this.showPlayError(message.message + '\n' + message.hint);
                    }
                    this.handleDisconnect();
                } else {
                    this.showNotification(message.message, 'error');
                }
                break;
        }
    }

    showConnectedUI(registration) {
        document.getElementById('playLogin').style.display = 'none';
        document.getElementById('playConnected').style.display = 'flex';
        document.getElementById('playerNameDisplay').textContent = registration.moltbook?.name || 'Agent';
        
        // Show welcome message
        const welcomeMsg = registration.welcome || 'Connected!';
        this.showNotification(welcomeMsg, 'success');
    }

    handleDisconnect() {
        this.playerConnected = false;
        this.playerWs = null;
        this.playerEmpireId = null;
        this.playerState = null;

        document.getElementById('playLogin').style.display = 'flex';
        document.getElementById('playConnected').style.display = 'none';
        document.getElementById('connectBtn').disabled = false;
        document.getElementById('connectBtn').textContent = '⚡ Connect & Play';
        
        // Reset token auth UI
        const moltbookTokenInput = document.getElementById('moltbookTokenInput');
        const moltbookSignInBtn = document.getElementById('moltbookSignInBtn');
        const tokenConnectBtn = document.getElementById('tokenConnectBtn');
        if (moltbookTokenInput) moltbookTokenInput.style.display = 'none';
        if (moltbookSignInBtn) moltbookSignInBtn.style.display = 'block';
        if (tokenConnectBtn) {
            tokenConnectBtn.disabled = false;
            tokenConnectBtn.textContent = 'Connect';
        }
    }

    disconnectPlayer() {
        if (this.playerWs) {
            this.playerWs.close();
        }
        this.handleDisconnect();
    }

    updatePlayerResources() {
        if (!this.playerState) return;

        // Player state from getStateForEmpire has resources at top level
        const resources = this.playerState.resources || {};
        const entities = this.playerState.entities || [];
        const planets = this.playerState.universe?.planets?.filter(p => p.owner === this.playerEmpireId) || [];
        
        const resourcesDiv = document.getElementById('playResources');
        if (!resourcesDiv) return;
        
        resourcesDiv.innerHTML = `
            <div class="resource-item">⛏️ ${Math.floor(resources.minerals || 0)}</div>
            <div class="resource-item">⚡ ${Math.floor(resources.energy || 0)}</div>
            <div class="resource-item">🌾 ${Math.floor(resources.food || 0)}</div>
            <div class="resource-item">🔬 ${Math.floor(resources.research || 0)}</div>
            <div class="resource-item">🪐 ${planets.length}</div>
            <div class="resource-item">⚔️ ${entities.length}</div>
        `;

        // Update fleet UI
        this.updateFleetUI(planets, entities);
    }

    updateFleetUI(planets, entities) {
        const fleetPanel = document.getElementById('playFleet');
        const ships = entities.filter(e => e.spaceUnit && e.location);
        
        // Show fleet panel if player has ships
        if (ships.length > 0) {
            fleetPanel.style.display = 'block';
            
            // Populate origin planets (where ships are)
            const originSelect = document.getElementById('fleetOrigin');
            const shipsAtPlanets = {};
            ships.forEach(s => {
                if (!shipsAtPlanets[s.location]) shipsAtPlanets[s.location] = [];
                shipsAtPlanets[s.location].push(s);
            });
            
            const currentOrigin = originSelect.value;
            originSelect.innerHTML = '<option value="">From planet...</option>';
            Object.keys(shipsAtPlanets).forEach(planetId => {
                const planet = this.playerState?.universe?.planets?.find(p => p.id === planetId);
                if (planet) {
                    const count = shipsAtPlanets[planetId].length;
                    originSelect.innerHTML += `<option value="${planetId}">${planet.name} (${count} ships)</option>`;
                }
            });
            if (currentOrigin) originSelect.value = currentOrigin;

            // Populate destination planets (all planets)
            const destSelect = document.getElementById('fleetDest');
            const currentDest = destSelect.value;
            destSelect.innerHTML = '<option value="">To planet...</option>';
            (this.playerState?.universe?.planets || []).forEach(planet => {
                destSelect.innerHTML += `<option value="${planet.id}">${planet.name}${planet.owner === this.playerEmpireId ? ' (yours)' : planet.owner ? ' ⚔️' : ''}</option>`;
            });
            if (currentDest) destSelect.value = currentDest;

            // Show ships at selected origin
            this.updateFleetShips(shipsAtPlanets);
        } else {
            fleetPanel.style.display = 'none';
        }
    }

    updateFleetShips(shipsAtPlanets) {
        const originSelect = document.getElementById('fleetOrigin');
        const shipsDiv = document.getElementById('fleetShips');
        const originPlanetId = originSelect.value;
        
        if (!originPlanetId || !shipsAtPlanets[originPlanetId]) {
            shipsDiv.innerHTML = '<span style="color: #888; font-size: 0.8rem;">Select origin planet</span>';
            return;
        }

        const ships = shipsAtPlanets[originPlanetId];
        shipsDiv.innerHTML = ships.map(s => 
            `<div class="fleet-ship selected" data-ship-id="${s.id}">${s.defName === 'battleship' ? '🚢' : s.defName === 'transport' ? '🚚' : '🛸'}</div>`
        ).join('');

        // Add click handlers to toggle selection
        shipsDiv.querySelectorAll('.fleet-ship').forEach(el => {
            el.addEventListener('click', () => el.classList.toggle('selected'));
        });
    }

    launchFleet() {
        const originPlanetId = document.getElementById('fleetOrigin').value;
        const destPlanetId = document.getElementById('fleetDest').value;
        const selectedShips = Array.from(document.querySelectorAll('.fleet-ship.selected')).map(el => el.dataset.shipId);

        if (!originPlanetId || !destPlanetId) {
            this.showNotification('Select origin and destination planets', 'error');
            return;
        }
        if (originPlanetId === destPlanetId) {
            this.showNotification('Origin and destination must be different', 'error');
            return;
        }
        if (selectedShips.length === 0) {
            this.showNotification('Select at least one ship', 'error');
            return;
        }

        this.playerWs.send(JSON.stringify({
            type: 'action',
            action: 'launch_fleet',
            params: {
                originPlanetId,
                destPlanetId,
                shipIds: selectedShips,
                cargoUnitIds: []
            }
        }));

        this.showNotification(`🚀 Fleet launched! ${selectedShips.length} ships en route`, 'success');
    }

    performAction(action, type) {
        if (!this.playerWs || !this.playerConnected) return;

        // Find a planet owned by player to perform action on
        const planet = this.playerState?.universe?.planets?.find(p => p.owner === this.playerEmpireId);
        if (!planet) {
            this.showNotification('No planets owned! Colonize a planet first.', 'error');
            return;
        }

        this.playerWs.send(JSON.stringify({
            type: 'action',
            action: action,
            params: {
                type: type,
                locationId: planet.id
            }
        }));
    }

    showActionResult(result) {
        if (result.success) {
            this.showNotification(`✓ ${result.action}`, 'success');
        } else {
            this.showNotification(`✗ ${result.error || 'Action failed'}`, 'error');
        }
    }

    sendChat() {
        const chatInput = document.getElementById('chatInput');
        const text = chatInput.value.trim();
        if (!text || !this.playerWs) return;

        this.playerWs.send(JSON.stringify({
            type: 'chat',
            text: text
        }));
        chatInput.value = '';
    }

    addChatMessage(message) {
        // Add to event log
        const eventLog = document.getElementById('eventLog');
        const chatEntry = document.createElement('div');
        chatEntry.className = 'event-entry chat';
        chatEntry.innerHTML = `<span class="event-tick">💬</span><span class="event-message"><strong>${message.name}:</strong> ${message.message}</span>`;
        eventLog.insertBefore(chatEntry, eventLog.firstChild);
    }

    showNotification(text, type = 'info') {
        // Create a simple notification
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = text;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 4px;
            background: ${type === 'success' ? 'rgba(0, 255, 0, 0.2)' : type === 'error' ? 'rgba(255, 0, 0, 0.2)' : 'rgba(0, 217, 255, 0.2)'};
            border: 1px solid ${type === 'success' ? '#0f0' : type === 'error' ? '#f00' : '#00d9ff'};
            color: #fff;
            z-index: 1000;
            animation: fadeIn 0.3s ease;
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
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

    changeView(view) {
        // Update view buttons
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        const btn = document.querySelector(`.view-btn[data-view="${view}"]`);
        btn?.classList.add('active');
        
        // Switch renderer view
        this.renderer.setViewMode(view);
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
