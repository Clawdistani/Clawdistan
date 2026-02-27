// ═══════════════════════════════════════════════════════════════════════════════
// COMMAND HUD - Modern Floating UI System
// Replaces static sidebars with contextual, floating panels
// ═══════════════════════════════════════════════════════════════════════════════

import { CrestGenerator } from './generators.js';

/**
 * CommandHUD - A modern, performant UI system for Clawdistan
 * 
 * Design principles:
 * 1. Maximum canvas space - no permanent sidebars stealing real estate
 * 2. Contextual information - panels appear where needed, when needed
 * 3. Smooth animations - CSS transforms for 60fps performance
 * 4. Hover to reveal - minimal by default, rich on interaction
 */
export class CommandHUD {
    constructor() {
        this.state = {
            selectedEntity: null,
            hoveredEmpire: null,
            expandedPanel: null,
            fleets: [],
            empires: [],
            agents: []
        };
        
        this.elements = {};
        this.updateQueue = new Set();
        this.rafId = null;
        
        // Throttle updates for performance
        this.lastUpdate = 0;
        this.updateThrottle = 100; // ms
    }
    
    /**
     * Initialize the HUD - creates all DOM elements
     */
    init() {
        this.createHUDStructure();
        this.bindEvents();
        this.startUpdateLoop();
    }
    
    /**
     * Create the main HUD structure
     */
    createHUDStructure() {
        // Remove old info-panel if it exists
        const oldPanel = document.querySelector('.info-panel');
        if (oldPanel) {
            oldPanel.style.display = 'none';
        }
        
        // Create HUD container
        const hud = document.createElement('div');
        hud.id = 'commandHUD';
        hud.className = 'command-hud';
        hud.innerHTML = `
            <!-- Quick Stats Bar (top-right, minimal) -->
            <div class="hud-quick-stats">
                <div class="quick-stat" id="quickFleets" data-tooltip="Active Fleets">
                    <span class="stat-icon">🚀</span>
                    <span class="stat-value">0</span>
                </div>
                <div class="quick-stat" id="quickWars" data-tooltip="Active Wars">
                    <span class="stat-icon">⚔️</span>
                    <span class="stat-value">0</span>
                </div>
                <div class="quick-stat" id="quickAgents" data-tooltip="Online Agents">
                    <span class="stat-icon">🤖</span>
                    <span class="stat-value">0</span>
                </div>
            </div>
            
            <!-- Empire Bar (bottom) -->
            <div class="hud-empire-bar">
                <div class="empire-bar-inner" id="empireBarInner">
                    <!-- Empire icons dynamically inserted -->
                </div>
                <div class="empire-bar-expand" id="empireBarExpand">
                    <span>▲</span>
                </div>
            </div>
            
            <!-- Floating Selection Card -->
            <div class="hud-selection-card" id="selectionCard" style="display: none;">
                <div class="selection-card-header">
                    <span class="selection-title" id="selectionTitle">Selected</span>
                    <button class="selection-close" id="selectionClose">×</button>
                </div>
                <div class="selection-card-body" id="selectionBody">
                    <!-- Dynamic content -->
                </div>
            </div>
            
            <!-- Fleet Tracker (bottom-left) -->
            <div class="hud-fleet-tracker" id="fleetTracker">
                <div class="fleet-tracker-header">
                    <span>🚀 Fleets in Transit</span>
                    <span class="fleet-count" id="fleetTrackerCount">0</span>
                </div>
                <div class="fleet-tracker-list" id="fleetTrackerList">
                    <!-- Fleet items -->
                </div>
            </div>
            
            <!-- Empire Detail Panel (appears on empire hover/click) -->
            <div class="hud-empire-detail" id="empireDetail" style="display: none;">
                <div class="empire-detail-header" id="empireDetailHeader">
                    <!-- Empire name, crest -->
                </div>
                <div class="empire-detail-body" id="empireDetailBody">
                    <!-- Stats, resources, etc -->
                </div>
            </div>
            
            <!-- Agent Panel (slides from right) -->
            <div class="hud-agent-panel collapsed" id="agentPanel">
                <div class="agent-panel-tab" id="agentPanelTab">
                    <span>🤖</span>
                    <span class="agent-badge" id="agentBadge">0</span>
                </div>
                <div class="agent-panel-content" id="agentPanelContent">
                    <div class="agent-panel-header">
                        <input type="text" id="agentSearchHUD" placeholder="Search agents...">
                    </div>
                    <div class="agent-panel-list" id="agentListHUD">
                        <!-- Agent items -->
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(hud);
        
        // Cache element references
        this.elements = {
            hud,
            quickFleets: document.getElementById('quickFleets'),
            quickWars: document.getElementById('quickWars'),
            quickAgents: document.getElementById('quickAgents'),
            empireBar: document.getElementById('empireBarInner'),
            empireBarExpand: document.getElementById('empireBarExpand'),
            selectionCard: document.getElementById('selectionCard'),
            selectionTitle: document.getElementById('selectionTitle'),
            selectionBody: document.getElementById('selectionBody'),
            selectionClose: document.getElementById('selectionClose'),
            fleetTracker: document.getElementById('fleetTracker'),
            fleetTrackerCount: document.getElementById('fleetTrackerCount'),
            fleetTrackerList: document.getElementById('fleetTrackerList'),
            empireDetail: document.getElementById('empireDetail'),
            empireDetailHeader: document.getElementById('empireDetailHeader'),
            empireDetailBody: document.getElementById('empireDetailBody'),
            agentPanel: document.getElementById('agentPanel'),
            agentPanelTab: document.getElementById('agentPanelTab'),
            agentPanelContent: document.getElementById('agentPanelContent'),
            agentSearchHUD: document.getElementById('agentSearchHUD'),
            agentListHUD: document.getElementById('agentListHUD'),
            agentBadge: document.getElementById('agentBadge')
        };
    }
    
    /**
     * Bind all event listeners
     */
    bindEvents() {
        // Selection card close
        this.elements.selectionClose?.addEventListener('click', () => {
            this.hideSelectionCard();
        });
        
        // Empire bar expand/collapse
        this.elements.empireBarExpand?.addEventListener('click', () => {
            this.elements.empireBar?.parentElement?.classList.toggle('expanded');
        });
        
        // Agent panel toggle
        this.elements.agentPanelTab?.addEventListener('click', () => {
            this.elements.agentPanel?.classList.toggle('collapsed');
        });
        
        // Agent search
        this.elements.agentSearchHUD?.addEventListener('input', (e) => {
            this.filterAgents(e.target.value);
        });
        
        // Fleet tracker toggle
        this.elements.fleetTracker?.addEventListener('click', (e) => {
            if (e.target.closest('.fleet-tracker-header')) {
                this.elements.fleetTracker.classList.toggle('expanded');
            }
        });
        
        // Close panels on canvas click
        document.getElementById('gameCanvas')?.addEventListener('click', (e) => {
            // Hide empire detail panel immediately on canvas click
            this.hideEmpireDetail();
            
            // Don't close selection card if clicking on something new
            setTimeout(() => {
                if (!this.state.selectedEntity) {
                    this.hideSelectionCard();
                }
            }, 100);
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideSelectionCard();
                this.hideEmpireDetail();
                this.elements.agentPanel?.classList.add('collapsed');
            }
        });
    }
    
    /**
     * Start the optimized update loop
     */
    startUpdateLoop() {
        const update = () => {
            const now = performance.now();
            
            if (now - this.lastUpdate > this.updateThrottle && this.updateQueue.size > 0) {
                this.processUpdates();
                this.lastUpdate = now;
            }
            
            this.rafId = requestAnimationFrame(update);
        };
        
        this.rafId = requestAnimationFrame(update);
    }
    
    /**
     * Queue an update for batch processing
     */
    queueUpdate(type) {
        this.updateQueue.add(type);
    }
    
    /**
     * Process queued updates
     */
    processUpdates() {
        for (const type of this.updateQueue) {
            switch (type) {
                case 'empires':
                    this.renderEmpireBar();
                    break;
                case 'fleets':
                    this.renderFleetTracker();
                    break;
                case 'agents':
                    this.renderAgentList();
                    break;
                case 'quickStats':
                    this.renderQuickStats();
                    break;
            }
        }
        this.updateQueue.clear();
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // UPDATE METHODS
    // ═══════════════════════════════════════════════════════════════════════════════
    
    /**
     * Update empire data
     */
    updateEmpires(empires, colors = {}) {
        this.state.empires = empires;
        this.state.empireColors = colors;
        this.queueUpdate('empires');
        this.queueUpdate('quickStats');
    }
    
    /**
     * Update fleet data
     */
    updateFleets(fleets, currentTick) {
        this.state.fleets = fleets;
        this.state.currentTick = currentTick;
        this.queueUpdate('fleets');
        this.queueUpdate('quickStats');
    }
    
    /**
     * Update agent data
     */
    updateAgents(agents) {
        this.state.agents = agents;
        this.queueUpdate('agents');
        this.queueUpdate('quickStats');
    }
    
    /**
     * Update diplomacy stats
     */
    updateDiplomacy(wars, alliances) {
        this.state.wars = wars;
        this.state.alliances = alliances;
        this.queueUpdate('quickStats');
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // RENDER METHODS
    // ═══════════════════════════════════════════════════════════════════════════════
    
    /**
     * Render the quick stats bar
     */
    renderQuickStats() {
        const fleetCount = this.state.fleets?.length || 0;
        const warCount = this.state.wars || 0;
        const agentCount = this.state.agents?.length || 0;
        
        if (this.elements.quickFleets) {
            this.elements.quickFleets.querySelector('.stat-value').textContent = fleetCount;
            this.elements.quickFleets.classList.toggle('active', fleetCount > 0);
        }
        
        if (this.elements.quickWars) {
            this.elements.quickWars.querySelector('.stat-value').textContent = warCount;
            this.elements.quickWars.classList.toggle('active', warCount > 0);
        }
        
        if (this.elements.quickAgents) {
            this.elements.quickAgents.querySelector('.stat-value').textContent = agentCount;
        }
    }
    
    /**
     * Render the bottom empire bar with procedural crests
     * Uses CSS order for smooth rank transition animations
     */
    renderEmpireBar() {
        const container = this.elements.empireBar;
        if (!container) return;
        
        const empires = this.state.empires || [];
        const colors = this.state.empireColors || {};
        
        // Sort by score descending
        const sorted = [...empires].sort((a, b) => (b.score || 0) - (a.score || 0));
        const topScore = sorted[0]?.score || 1;
        
        // Track existing elements for efficient updates
        const existingElements = new Map();
        container.querySelectorAll('.empire-icon').forEach(el => {
            existingElements.set(el.dataset.empireId, el);
        });
        
        // Track which empires are in current sorted list
        const currentEmpireIds = new Set(sorted.slice(0, 20).map(e => e.id));
        
        // Remove elements for empires no longer in top 20
        existingElements.forEach((el, empireId) => {
            if (!currentEmpireIds.has(empireId)) {
                el.classList.add('exiting');
                setTimeout(() => el.remove(), 300);
            }
        });
        
        // Update or create elements for each empire
        sorted.slice(0, 20).forEach((empire, i) => {
            const color = colors[empire.id] || empire.color || '#888';
            const isLeader = i === 0;
            const planets = empire.planets || 0;
            const score = empire.score || 0;
            const rank = i + 1;
            const shortName = empire.name.length > 12 ? empire.name.slice(0, 10) + '…' : empire.name;
            const barWidth = Math.min(100, (score / topScore) * 100);
            
            let el = existingElements.get(empire.id);
            
            if (el) {
                // Update existing element
                el.style.order = rank;
                el.style.setProperty('--empire-color', color);
                el.className = `empire-icon ${isLeader ? 'leader' : ''} ${planets === 0 ? 'eliminated' : ''}`;
                el.dataset.tooltip = empire.name;
                el.dataset.tooltipDesc = `${score.toLocaleString()} pts · ${planets} planets`;
                
                // Update rank badge
                const badge = el.querySelector('.empire-rank-badge');
                if (badge && badge.textContent !== String(rank)) {
                    badge.classList.add('rank-changed');
                    badge.textContent = rank;
                    setTimeout(() => badge.classList.remove('rank-changed'), 500);
                }
                
                // Update crown
                const existingCrown = el.querySelector('.crown');
                if (isLeader && !existingCrown) {
                    const crown = document.createElement('span');
                    crown.className = 'crown';
                    crown.textContent = '👑';
                    el.appendChild(crown);
                } else if (!isLeader && existingCrown) {
                    existingCrown.remove();
                }
                
                // Update name label
                const nameLabel = el.querySelector('.empire-name-label');
                if (nameLabel) nameLabel.textContent = shortName;
                
                // Update score bar
                const bar = el.querySelector('.empire-icon-bar');
                if (bar) bar.style.width = `${barWidth}%`;
            } else {
                // Create new element
                const crestSvg = CrestGenerator.generate(empire.id, color, 36);
                
                el = document.createElement('div');
                el.className = `empire-icon ${isLeader ? 'leader' : ''} ${planets === 0 ? 'eliminated' : ''} entering`;
                el.dataset.empireId = empire.id;
                el.style.cssText = `--empire-color: ${color}; order: ${rank}`;
                el.dataset.tooltip = empire.name;
                el.dataset.tooltipDesc = `${score.toLocaleString()} pts · ${planets} planets`;
                
                el.innerHTML = `
                    <div class="empire-crest-icon">${crestSvg}</div>
                    <span class="empire-rank-badge">${rank}</span>
                    ${isLeader ? '<span class="crown">👑</span>' : ''}
                    <div class="empire-name-label">${shortName}</div>
                    <div class="empire-icon-bar" style="width: ${barWidth}%"></div>
                `;
                
                // Add click handler
                el.addEventListener('click', () => this.showEmpireDetail(empire.id));
                el.addEventListener('mouseenter', () => this.onEmpireHover?.(empire.id));
                
                container.appendChild(el);
                
                // Trigger entering animation
                requestAnimationFrame(() => el.classList.remove('entering'));
            }
        });
    }
    
    /**
     * Render the fleet tracker - grouped by empire with crests
     */
    renderFleetTracker() {
        const fleets = this.state.fleets || [];
        const currentTick = this.state.currentTick || 0;
        
        this.elements.fleetTrackerCount.textContent = fleets.length;
        this.elements.fleetTracker.classList.toggle('has-fleets', fleets.length > 0);
        
        if (fleets.length === 0) {
            this.elements.fleetTrackerList.innerHTML = '<div class="fleet-empty">No fleets in transit</div>';
            return;
        }
        
        // Filter active fleets and group by empire
        const activeFleets = fleets.filter(f => f.arrivalTick > currentTick);
        const fleetsByEmpire = new Map();
        const empires = this.state.empires || [];
        const empireColors = this.state.empireColors || {};
        
        for (const fleet of activeFleets) {
            if (!fleetsByEmpire.has(fleet.empireId)) {
                // Look up empire info from state
                const empire = empires.find(e => e.id === fleet.empireId);
                const color = empireColors[fleet.empireId] || empire?.color || '#888';
                const name = empire?.name || 'Unknown Empire';
                
                fleetsByEmpire.set(fleet.empireId, {
                    empireId: fleet.empireId,
                    empireName: name,
                    empireColor: color,
                    fleets: []
                });
            }
            fleetsByEmpire.get(fleet.empireId).fleets.push(fleet);
        }
        
        // Sort empires by total ships in transit (most active first)
        const sortedEmpires = [...fleetsByEmpire.values()]
            .sort((a, b) => {
                const shipsA = a.fleets.reduce((sum, f) => sum + (f.shipCount || 0), 0);
                const shipsB = b.fleets.reduce((sum, f) => sum + (f.shipCount || 0), 0);
                return shipsB - shipsA;
            })
            .slice(0, 6); // Show max 6 empires
        
        const html = sortedEmpires.map(empire => {
            const crest = CrestGenerator.generate(empire.empireId, empire.empireColor, 32);
            const totalShips = empire.fleets.reduce((sum, f) => sum + (f.shipCount || 0), 0);
            const totalCargo = empire.fleets.reduce((sum, f) => sum + (f.cargoCount || 0), 0);
            
            // Find soonest arriving fleet
            const soonest = empire.fleets.reduce((min, f) => 
                f.arrivalTick < min.arrivalTick ? f : min, empire.fleets[0]);
            const ticksRemaining = Math.max(0, soonest.arrivalTick - currentTick);
            const timeStr = this.formatTicks(ticksRemaining);
            const isWormhole = soonest.travelType === 'wormhole';
            
            // Progress bar for soonest fleet
            const progress = soonest.travelTime > 0 
                ? ((soonest.travelTime - ticksRemaining) / soonest.travelTime) * 100 
                : 100;
            
            return `
                <div class="fleet-empire-card" data-empire-id="${empire.empireId}" style="--empire-color: ${empire.empireColor}">
                    <div class="fleet-empire-header">
                        <div class="fleet-empire-crest">${crest}</div>
                        <div class="fleet-empire-info">
                            <div class="fleet-empire-name">${empire.empireName}</div>
                            <div class="fleet-empire-stats">
                                <span class="fleet-stat">🚀 ${totalShips}</span>
                                ${totalCargo > 0 ? `<span class="fleet-stat">📦 ${totalCargo}</span>` : ''}
                                <span class="fleet-stat">${empire.fleets.length} fleet${empire.fleets.length > 1 ? 's' : ''}</span>
                            </div>
                        </div>
                        <div class="fleet-empire-eta">
                            ${isWormhole ? '<span class="wormhole-icon">🌀</span>' : ''}
                            <span class="eta-time">${timeStr}</span>
                        </div>
                    </div>
                    <div class="fleet-progress">
                        <div class="fleet-progress-bar ${isWormhole ? 'wormhole' : ''}" style="width: ${progress}%"></div>
                    </div>
                </div>
            `;
        }).join('');
        
        this.elements.fleetTrackerList.innerHTML = html;
    }
    
    /**
     * Render the agent list
     */
    renderAgentList() {
        const agents = this.state.agents || [];
        const searchQuery = this.state.agentSearchQuery || '';
        
        this.elements.agentBadge.textContent = agents.length;
        
        const filtered = searchQuery 
            ? agents.filter(a => 
                a.name?.toLowerCase().includes(searchQuery) || 
                a.empireName?.toLowerCase().includes(searchQuery))
            : agents;
        
        const html = filtered.slice(0, 50).map(agent => {
            const color = this.state.empireColors?.[agent.empireId] || '#888';
            const isBot = agent.isBot;
            
            return `
                <div class="agent-item-hud" data-agent-id="${agent.id}">
                    <span class="agent-indicator" style="background: ${color}"></span>
                    <span class="agent-name">${isBot ? '🤖' : '👤'} ${agent.name || 'Unknown'}</span>
                    <span class="agent-empire">${agent.empireName || ''}</span>
                </div>
            `;
        }).join('');
        
        this.elements.agentListHUD.innerHTML = html || '<div class="agent-empty">No agents online</div>';
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // SELECTION CARD
    // ═══════════════════════════════════════════════════════════════════════════════
    
    /**
     * Show selection card for a clicked entity
     */
    showSelectionCard(entity, position) {
        this.state.selectedEntity = entity;
        
        const card = this.elements.selectionCard;
        if (!card) return;
        
        // Position near click but within viewport
        const cardWidth = 280;
        const cardHeight = 200;
        const padding = 20;
        
        let x = position.x + padding;
        let y = position.y - cardHeight / 2;
        
        // Keep within viewport
        if (x + cardWidth > window.innerWidth - padding) {
            x = position.x - cardWidth - padding;
        }
        if (y < padding) y = padding;
        if (y + cardHeight > window.innerHeight - padding) {
            y = window.innerHeight - cardHeight - padding;
        }
        
        card.style.left = `${x}px`;
        card.style.top = `${y}px`;
        card.style.display = 'block';
        
        // Animate in
        requestAnimationFrame(() => {
            card.classList.add('visible');
        });
        
        // Populate content based on entity type
        this.renderSelectionContent(entity);
    }
    
    /**
     * Render selection card content
     */
    renderSelectionContent(entity) {
        const title = this.elements.selectionTitle;
        const body = this.elements.selectionBody;
        
        if (!entity) {
            this.hideSelectionCard();
            return;
        }
        
        // Determine entity type
        if (entity.population !== undefined) {
            // Planet
            title.textContent = `🪐 ${entity.name || 'Unknown Planet'}`;
            body.innerHTML = this.renderPlanetCard(entity);
        } else if (entity.empireId) {
            // Ship/Entity
            title.textContent = `🚀 ${entity.type || 'Ship'}`;
            body.innerHTML = this.renderShipCard(entity);
        } else if (entity.systemId) {
            // System
            title.textContent = `⭐ ${entity.name || 'Star System'}`;
            body.innerHTML = this.renderSystemCard(entity);
        } else if (entity.galaxyId !== undefined) {
            // Galaxy
            title.textContent = `🌌 ${entity.name || 'Galaxy'}`;
            body.innerHTML = this.renderGalaxyCard(entity);
        }
    }
    
    renderPlanetCard(planet) {
        const owner = planet.owner ? this.state.empires?.find(e => e.id === planet.owner) : null;
        const color = owner ? (this.state.empireColors?.[owner.id] || owner.color) : '#666';
        
        return `
            <div class="selection-stat-grid">
                <div class="selection-stat">
                    <span class="stat-label">Owner</span>
                    <span class="stat-value" style="color: ${color}">${owner?.name || 'Unclaimed'}</span>
                </div>
                <div class="selection-stat">
                    <span class="stat-label">Population</span>
                    <span class="stat-value">${planet.population?.toLocaleString() || 0}</span>
                </div>
                <div class="selection-stat">
                    <span class="stat-label">Buildings</span>
                    <span class="stat-value">${planet.buildings?.length || 0}</span>
                </div>
                <div class="selection-stat">
                    <span class="stat-label">Defense</span>
                    <span class="stat-value">${planet.defense || 0}</span>
                </div>
            </div>
            ${planet.resources ? `
                <div class="selection-resources">
                    <span>💎 ${planet.resources.minerals || 0}</span>
                    <span>⚡ ${planet.resources.energy || 0}</span>
                    <span>🌾 ${planet.resources.food || 0}</span>
                </div>
            ` : ''}
        `;
    }
    
    renderShipCard(entity) {
        return `
            <div class="selection-stat-grid">
                <div class="selection-stat">
                    <span class="stat-label">Type</span>
                    <span class="stat-value">${entity.type || 'Unknown'}</span>
                </div>
                <div class="selection-stat">
                    <span class="stat-label">HP</span>
                    <span class="stat-value">${entity.hp || 0} / ${entity.maxHp || 0}</span>
                </div>
                <div class="selection-stat">
                    <span class="stat-label">Attack</span>
                    <span class="stat-value">${entity.attack || 0}</span>
                </div>
                <div class="selection-stat">
                    <span class="stat-label">Speed</span>
                    <span class="stat-value">${entity.speed || 0}</span>
                </div>
            </div>
        `;
    }
    
    renderSystemCard(system) {
        return `
            <div class="selection-stat-grid">
                <div class="selection-stat">
                    <span class="stat-label">Star Type</span>
                    <span class="stat-value">${system.starType || 'Unknown'}</span>
                </div>
                <div class="selection-stat">
                    <span class="stat-label">Planets</span>
                    <span class="stat-value">${system.planetCount || '?'}</span>
                </div>
            </div>
        `;
    }
    
    renderGalaxyCard(galaxy) {
        return `
            <div class="selection-stat-grid">
                <div class="selection-stat">
                    <span class="stat-label">Systems</span>
                    <span class="stat-value">${galaxy.systemCount || '?'}</span>
                </div>
                <div class="selection-stat">
                    <span class="stat-label">Type</span>
                    <span class="stat-value">${galaxy.type || 'Spiral'}</span>
                </div>
            </div>
        `;
    }
    
    /**
     * Hide the selection card
     */
    hideSelectionCard() {
        const card = this.elements.selectionCard;
        if (!card) return;
        
        card.classList.remove('visible');
        setTimeout(() => {
            card.style.display = 'none';
        }, 200);
        
        this.state.selectedEntity = null;
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // EMPIRE DETAIL
    // ═══════════════════════════════════════════════════════════════════════════════
    
    showEmpireDetail(empireId) {
        const empire = this.state.empires?.find(e => e.id === empireId);
        if (!empire) return;
        
        const panel = this.elements.empireDetail;
        const header = this.elements.empireDetailHeader;
        const body = this.elements.empireDetailBody;
        
        const color = this.state.empireColors?.[empireId] || empire.color || '#888';
        const rank = this.state.empires
            .sort((a, b) => (b.score || 0) - (a.score || 0))
            .findIndex(e => e.id === empireId) + 1;
        
        header.innerHTML = `
            <div class="empire-detail-crest" style="background: ${color}"></div>
            <div class="empire-detail-info">
                <h3>${empire.name || 'Unknown Empire'}</h3>
                <span class="empire-detail-rank">#${rank}</span>
            </div>
            <button class="empire-detail-close" onclick="window.commandHUD?.hideEmpireDetail()">×</button>
        `;
        
        body.innerHTML = `
            <div class="empire-detail-stats">
                <div class="empire-stat">
                    <span class="stat-icon">🏆</span>
                    <span class="stat-value">${(empire.score || 0).toLocaleString()}</span>
                    <span class="stat-label">Score</span>
                </div>
                <div class="empire-stat">
                    <span class="stat-icon">🪐</span>
                    <span class="stat-value">${empire.planets || 0}</span>
                    <span class="stat-label">Planets</span>
                </div>
                <div class="empire-stat">
                    <span class="stat-icon">👥</span>
                    <span class="stat-value">${(empire.population || 0).toLocaleString()}</span>
                    <span class="stat-label">Population</span>
                </div>
                <div class="empire-stat">
                    <span class="stat-icon">🚀</span>
                    <span class="stat-value">${empire.ships || 0}</span>
                    <span class="stat-label">Ships</span>
                </div>
            </div>
            ${empire.species ? `
                <div class="empire-detail-species">
                    <span class="species-name">🧬 ${empire.species}</span>
                </div>
            ` : ''}
        `;
        
        panel.style.display = 'block';
        requestAnimationFrame(() => panel.classList.add('visible'));
        
        // Notify renderer to highlight empire
        this.onEmpireSelect?.(empireId);
    }
    
    hideEmpireDetail() {
        const panel = this.elements.empireDetail;
        panel?.classList.remove('visible');
        setTimeout(() => {
            if (panel) panel.style.display = 'none';
        }, 200);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // UTILITY
    // ═══════════════════════════════════════════════════════════════════════════════
    
    formatTicks(ticks) {
        const seconds = Math.ceil(ticks);
        if (seconds < 60) return `${seconds}s`;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
    }
    
    filterAgents(query) {
        this.state.agentSearchQuery = query.toLowerCase();
        this.queueUpdate('agents');
    }
    
    /**
     * Cleanup
     */
    destroy() {
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
        }
        this.elements.hud?.remove();
    }
}

// Export singleton
export const commandHUD = new CommandHUD();
