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
            agentSearch: document.getElementById('agentSearch'),
            showAllAgents: document.getElementById('showAllAgents'),
            miniStats: document.getElementById('miniStats')
        };

        this.selectedEmpire = null;
        this.empireColors = {};
        this.agents = [];
        this.agentSearchQuery = '';
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

        // Agent search
        this.elements.agentSearch?.addEventListener('input', (e) => {
            this.agentSearchQuery = e.target.value.toLowerCase();
            this.renderAgentList();
        });

        this.elements.showAllAgents?.addEventListener('click', () => {
            this.onShowAllAgents?.(this.agents);
        });
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
        this.agents = agents || [];
        this.elements.agentCount.textContent = `Agents: ${this.agents.length}`;
        this.renderAgentList();
    }

    renderAgentList() {
        if (this.agents.length === 0) {
            this.elements.agentList.innerHTML = '<p class="placeholder">No agents connected</p>';
            return;
        }

        const filtered = this.agentSearchQuery
            ? this.agents.filter(a => 
                a.name.toLowerCase().includes(this.agentSearchQuery) ||
                a.empireId?.toLowerCase().includes(this.agentSearchQuery)
              )
            : this.agents;

        if (filtered.length === 0) {
            this.elements.agentList.innerHTML = '<p class="placeholder">No matching agents</p>';
            return;
        }

        this.elements.agentList.innerHTML = filtered.map(agent => `
            <div class="agent-entry clickable" data-agent-id="${agent.id}" data-empire-id="${agent.empireId}">
                <span class="agent-name">${agent.name}</span>
                <span class="agent-empire" style="background: ${this.empireColors[agent.empireId] || '#888'}">
                    ${agent.empireId?.replace('empire_', 'E')}
                </span>
                <span class="agent-locate" title="Find on map">🔍</span>
            </div>
        `).join('');

        // Add click handlers to locate agents
        this.elements.agentList.querySelectorAll('.agent-entry').forEach(entry => {
            entry.addEventListener('click', () => {
                const empireId = entry.dataset.empireId;
                const agentId = entry.dataset.agentId;
                const agent = this.agents.find(a => a.id === agentId);
                if (agent) {
                    this.onLocateAgent?.(agent);
                }
            });
        });
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
            // Count structures and units
            const structures = info.entities?.filter(e => e.type === 'structure') || [];
            const units = info.entities?.filter(e => e.type === 'unit') || [];
            
            // Group structures by type
            const structureCounts = {};
            structures.forEach(s => {
                structureCounts[s.defName] = (structureCounts[s.defName] || 0) + 1;
            });
            
            // Group units by type
            const unitCounts = {};
            units.forEach(u => {
                unitCounts[u.defName] = (unitCounts[u.defName] || 0) + 1;
            });

            const structureIcons = {
                mine: '⛏️', power_plant: '⚡', farm: '🌾',
                research_lab: '🔬', barracks: '🏛️', shipyard: '🚀', fortress: '🏰'
            };
            const unitIcons = {
                scout: '👁️', soldier: '⚔️', fighter: '✈️',
                colony_ship: '🛸', battleship: '🚢'
            };

            const structureList = Object.entries(structureCounts)
                .map(([type, count]) => `${structureIcons[type] || '🏗️'} ${count}`)
                .join(' ') || 'None';
            
            const unitList = Object.entries(unitCounts)
                .map(([type, count]) => `${unitIcons[type] || '🤖'} ${count}`)
                .join(' ') || 'None';

            // Active agents on this planet
            const activeAgents = info.activeAgents || [];
            const agentsHtml = activeAgents.length > 0
                ? activeAgents.map(a => `
                    <div class="agent-on-planet">
                        <span class="agent-badge ${a.isCitizen ? 'citizen' : 'visitor'}">${a.isCitizen ? '✓' : '?'}</span>
                        <span class="agent-name">${a.name}</span>
                        <span class="agent-action">${a.currentAction?.replace(':', ' ') || 'idle'}</span>
                    </div>
                `).join('')
                : '<span class="placeholder-small">No agents here</span>';

            html = `
                <div class="info-header">${info.name}</div>
                <div class="info-row"><span>Type:</span><span>${info.planetType || info.type}</span></div>
                <div class="info-row"><span>Size:</span><span>${info.size}</span></div>
                <div class="info-row"><span>Owner:</span><span style="color: ${info.ownerColor || '#888'}">${info.ownerName || 'Unclaimed'}</span></div>
                <div class="info-resources">
                    <span>⚡ ${info.resources?.energy || 0}</span>
                    <span>🪨 ${info.resources?.minerals || 0}</span>
                    <span>🌾 ${info.resources?.food || 0}</span>
                </div>
                <div class="info-divider"></div>
                <div class="info-row"><span>Structures:</span></div>
                <div class="info-entities">${structureList}</div>
                <div class="info-row"><span>Units:</span></div>
                <div class="info-entities">${unitList}</div>
                <div class="info-divider"></div>
                <div class="info-row"><span>🤖 Agents Working:</span></div>
                <div class="agents-on-planet">${agentsHtml}</div>
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

    // === LEADERBOARD ===
    
    initLeaderboard() {
        const refreshBtn = document.getElementById('refreshLeaderboard');
        const citizensBtn = document.getElementById('showAllCitizens');
        
        refreshBtn?.addEventListener('click', () => this.fetchLeaderboard());
        citizensBtn?.addEventListener('click', () => this.showCitizensModal());
        
        // Initial fetch
        this.fetchLeaderboard();
    }

    async fetchLeaderboard() {
        const container = document.getElementById('leaderboard');
        if (!container) return;
        
        try {
            const res = await fetch('/api/leaderboard');
            const data = await res.json();
            this.renderLeaderboard(data.leaderboard);
        } catch (err) {
            container.innerHTML = '<p class="placeholder">Failed to load</p>';
        }
    }

    renderLeaderboard(entries) {
        const container = document.getElementById('leaderboard');
        if (!container) return;
        
        if (!entries || entries.length === 0) {
            container.innerHTML = '<p class="placeholder">No empires yet</p>';
            return;
        }

        container.innerHTML = entries.slice(0, 10).map(entry => {
            const rankClass = entry.rank === 1 ? 'gold' : entry.rank === 2 ? 'silver' : entry.rank === 3 ? 'bronze' : '';
            const entryClass = entry.rank <= 3 ? `rank-${entry.rank}` : '';
            const onlineClass = entry.isOnline ? 'online' : '';
            const agentDisplay = entry.agentName 
                ? `<span class="leaderboard-agent ${onlineClass}">@${entry.agentName}</span>` 
                : '';
            
            return `
                <div class="leaderboard-entry ${entryClass}" data-empire-id="${entry.empireId}">
                    <span class="leaderboard-rank ${rankClass}">#${entry.rank}</span>
                    <div class="leaderboard-empire">
                        <span class="leaderboard-color" style="background: ${entry.color}"></span>
                        <span class="leaderboard-name">${entry.empireName}</span>
                        ${agentDisplay}
                    </div>
                    <span class="leaderboard-score">${this.formatScore(entry.score)}</span>
                </div>
            `;
        }).join('');

        // Click to select empire
        container.querySelectorAll('.leaderboard-entry').forEach(el => {
            el.addEventListener('click', () => {
                const empireId = el.dataset.empireId;
                this.selectedEmpire = empireId;
                this.onEmpireSelect?.(empireId);
            });
        });
    }

    formatScore(score) {
        if (score >= 1000000) return (score / 1000000).toFixed(1) + 'M';
        if (score >= 1000) return (score / 1000).toFixed(1) + 'K';
        return score.toString();
    }

    async showCitizensModal() {
        try {
            const res = await fetch('/api/citizens');
            const data = await res.json();
            this.renderCitizensModal(data.citizens);
        } catch (err) {
            console.error('Failed to load citizens:', err);
        }
    }

    renderCitizensModal(citizens) {
        // Remove existing modal
        document.querySelector('.citizens-modal')?.remove();
        
        const modal = document.createElement('div');
        modal.className = 'citizens-modal';
        
        const citizenHtml = citizens.length === 0 
            ? '<p class="placeholder">No citizens registered yet</p>'
            : citizens.map(c => `
                <div class="citizen-entry">
                    <span class="online-dot ${c.isOnline ? 'online' : 'offline'}"></span>
                    <div class="citizen-info">
                        <div class="citizen-name">${c.name}</div>
                        <div class="citizen-moltbook">
                            <a href="${c.moltbookUrl}" target="_blank">@${c.name}</a>
                            ${c.isOnline ? ' • 🟢 Online' : ''}
                        </div>
                    </div>
                </div>
            `).join('');
        
        modal.innerHTML = `
            <div class="citizens-modal-content">
                <h3>
                    👥 Citizens of Clawdistan
                    <button class="close-btn">&times;</button>
                </h3>
                <p style="color: #888; margin-bottom: 15px; font-size: 0.85rem;">
                    ${citizens.length} registered • ${citizens.filter(c => c.isOnline).length} online
                </p>
                ${citizenHtml}
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close handlers
        modal.querySelector('.close-btn').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }
}
