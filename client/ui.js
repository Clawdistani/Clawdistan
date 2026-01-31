// UI Manager for Clawdistan observer interface

export class UIManager {
    constructor() {
        this.elements = {
            tickCounter: document.getElementById('tickCounter'),
            agentCount: document.getElementById('agentCount'),
            gameStatus: document.getElementById('gameStatus'),
            empireList: document.getElementById('empireList'),
            selectedInfo: document.getElementById('selectedInfo'),
            eventLog: document.getElementById('eventLog'),
            agentList: document.getElementById('agentList'),
            miniStats: document.getElementById('miniStats'),
            pauseBtn: document.getElementById('pauseBtn'),
            speedBtn: document.getElementById('speedBtn')
        };

        this.selectedEmpire = null;
        this.empireColors = {};
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.onViewChange?.(btn.dataset.view);
            });
        });

        document.getElementById('zoomIn')?.addEventListener('click', () => this.onZoom?.(1.2));
        document.getElementById('zoomOut')?.addEventListener('click', () => this.onZoom?.(0.8));
        document.getElementById('zoomFit')?.addEventListener('click', () => this.onZoomFit?.());

        this.elements.pauseBtn?.addEventListener('click', () => this.onPause?.());
        this.elements.speedBtn?.addEventListener('click', () => this.onSpeedChange?.());
    }

    update(state) {
        if (!state) return;

        this.elements.tickCounter.textContent = `Tick: ${state.tick || 0}`;
        this.elements.gameStatus.textContent = state.paused ? 'Paused' : 'Running';

        if (state.empires) {
            state.empires.forEach(e => this.empireColors[e.id] = e.color);
        }

        this.updateEmpireList(state.empires);
        this.updateEventLog(state.events);
        this.updateMiniStats(state);
    }

    updateEmpireList(empires) {
        if (!empires) return;

        this.elements.empireList.innerHTML = empires.map(empire => `
            <div class="empire-card ${this.selectedEmpire === empire.id ? 'selected' : ''}"
                 data-empire="${empire.id}"
                 style="border-left-color: ${empire.color}">
                <div class="empire-name" style="color: ${empire.color}">${empire.name}</div>
                <div class="empire-stats">
                    <span title="Planets">🪐 ${empire.planetCount || 0}</span>
                    <span title="Units">⚔️ ${empire.entityCount || 0}</span>
                    <span title="Credits">💰 ${empire.resources?.credits || 0}</span>
                </div>
            </div>
        `).join('');

        this.elements.empireList.querySelectorAll('.empire-card').forEach(card => {
            card.addEventListener('click', () => {
                this.selectedEmpire = card.dataset.empire;
                this.onEmpireSelect?.(this.selectedEmpire);
                this.updateEmpireList(empires);
            });
        });
    }

    updateEventLog(events) {
        if (!events) return;

        this.elements.eventLog.innerHTML = events.slice(-20).reverse().map(event => `
            <div class="event-entry ${event.category}">
                <span class="event-tick">${event.tick}</span>
                <span class="event-message">${event.message}</span>
            </div>
        `).join('');
    }

    updateAgentList(agents) {
        if (!agents || agents.length === 0) {
            this.elements.agentList.innerHTML = '<p class="placeholder">No agents connected</p>';
            this.elements.agentCount.textContent = 'Agents: 0';
            return;
        }

        this.elements.agentCount.textContent = `Agents: ${agents.length}`;
        this.elements.agentList.innerHTML = agents.map(agent => `
            <div class="agent-entry">
                <span class="agent-name">${agent.name}</span>
                <span class="agent-empire" style="background: ${this.empireColors[agent.empireId] || '#888'}">
                    ${agent.empireId?.replace('empire_', 'E')}
                </span>
            </div>
        `).join('');
    }

    updateSelectedInfo(info) {
        if (!info) {
            this.elements.selectedInfo.innerHTML = '<p class="placeholder">Click on the map to select</p>';
            return;
        }

        let html = '';

        if (info.type === 'system') {
            html = `
                <div class="info-header">${info.name}</div>
                <div class="info-row"><span>Type:</span><span>${info.starType} star</span></div>
                <div class="info-row"><span>Planets:</span><span>${info.planets?.length || 0}</span></div>
            `;
        } else if (info.type === 'planet') {
            html = `
                <div class="info-header">${info.name}</div>
                <div class="info-row"><span>Type:</span><span>${info.planetType || info.type}</span></div>
                <div class="info-row"><span>Size:</span><span>${info.size}</span></div>
                <div class="info-row"><span>Owner:</span><span>${info.owner || 'Unclaimed'}</span></div>
                <div class="info-resources">
                    <span>⚡ ${info.resources?.energy || 0}</span>
                    <span>🪨 ${info.resources?.minerals || 0}</span>
                    <span>🌾 ${info.resources?.food || 0}</span>
                </div>
            `;
        } else if (info.type === 'empire') {
            html = `
                <div class="info-header" style="color: ${info.color}">${info.name}</div>
                <div class="info-row"><span>Planets:</span><span>${info.planetCount}</span></div>
                <div class="info-row"><span>Units:</span><span>${info.entityCount}</span></div>
                <div class="info-row"><span>Score:</span><span>${info.score}</span></div>
                <div class="info-resources">
                    <span>⚡ ${info.resources?.energy || 0}</span>
                    <span>🪨 ${info.resources?.minerals || 0}</span>
                    <span>🌾 ${info.resources?.food || 0}</span>
                    <span>🔬 ${info.resources?.research || 0}</span>
                    <span>💰 ${info.resources?.credits || 0}</span>
                </div>
            `;
        }

        this.elements.selectedInfo.innerHTML = html;
    }

    updateMiniStats(state) {
        const totalPlanets = state.universe?.planets?.length || 0;
        const colonized = state.universe?.planets?.filter(p => p.owner)?.length || 0;
        const totalSystems = state.universe?.solarSystems?.length || 0;
        const totalEntities = state.entities?.length || 0;

        this.elements.miniStats.innerHTML = `
            <div class="mini-stat">
                <span class="mini-stat-label">Planets:</span>
                <span class="mini-stat-value">${colonized}/${totalPlanets}</span>
            </div>
            <div class="mini-stat">
                <span class="mini-stat-label">Systems:</span>
                <span class="mini-stat-value">${totalSystems}</span>
            </div>
            <div class="mini-stat">
                <span class="mini-stat-label">Entities:</span>
                <span class="mini-stat-value">${totalEntities}</span>
            </div>
        `;
    }

    setPaused(paused) {
        this.elements.pauseBtn.textContent = paused ? 'Resume' : 'Pause';
        this.elements.pauseBtn.classList.toggle('active', paused);
    }

    setSpeed(speed) {
        this.elements.speedBtn.textContent = `Speed: ${speed}x`;
    }
}
