// UI Manager for Clawdistan observer interface

// Notification Manager for toast notifications
export class NotificationManager {
    constructor() {
        this.container = document.getElementById('toastContainer');
        this.toasts = [];
        this.maxToasts = 5;
        this.defaultDuration = 5000; // 5 seconds
        this.seenEvents = new Set(); // Track seen event IDs to prevent duplicates
        this.lastProcessedTick = 0;
        
        // Category configuration
        this.categories = {
            combat: { icon: '⚔️', sound: 'error', priority: 'high' },
            invasion: { icon: '🏴', sound: 'error', priority: 'high' },
            colonization: { icon: '🌍', sound: 'success', priority: 'normal' },
            diplomacy: { icon: '🤝', sound: 'notify', priority: 'normal' },
            fleet: { icon: '🚀', sound: 'click', priority: 'low' },
            starbase: { icon: '🛸', sound: 'success', priority: 'normal' },
            trade: { icon: '💰', sound: 'success', priority: 'low' },
            research: { icon: '🔬', sound: 'notify', priority: 'normal' },
            agent: { icon: '🤖', sound: 'notify', priority: 'normal' },
            victory: { icon: '🏆', sound: 'success', priority: 'high' },
            game: { icon: '🎮', sound: 'click', priority: 'low' }
        };
    }

    // Process events from game state - only show new ones
    processEvents(events, currentTick) {
        if (!events || events.length === 0) return;
        
        // Only process events that are newer than what we've seen
        const newEvents = events.filter(e => {
            const eventId = `${e.tick}_${e.message}`;
            if (this.seenEvents.has(eventId)) return false;
            if (e.tick <= this.lastProcessedTick) return false;
            return true;
        });
        
        // Sort by tick, show newest first (but process oldest first so they stack correctly)
        newEvents.sort((a, b) => a.tick - b.tick);
        
        // Take only the most recent few to avoid spam on initial load
        const recentEvents = newEvents.slice(-3);
        
        for (const event of recentEvents) {
            const eventId = `${event.tick}_${event.message}`;
            this.seenEvents.add(eventId);
            
            // Determine category from message content
            const category = this.categorizeEvent(event);
            
            // Skip low-priority game events (too spammy)
            if (category === 'game' && !event.message.includes('Victory')) continue;
            
            this.show({
                category,
                message: event.message,
                tick: event.tick
            });
        }
        
        this.lastProcessedTick = currentTick;
        
        // Cleanup old seen events (keep memory bounded)
        if (this.seenEvents.size > 500) {
            const arr = [...this.seenEvents];
            this.seenEvents = new Set(arr.slice(-300));
        }
    }

    // Categorize an event based on its message
    categorizeEvent(event) {
        const msg = event.message.toLowerCase();
        const cat = event.category; // Server might provide category
        
        if (cat && this.categories[cat]) return cat;
        
        // Keyword matching
        if (msg.includes('invasion') || msg.includes('conquered')) return 'invasion';
        if (msg.includes('battle') || msg.includes('attack') || msg.includes('destroyed')) return 'combat';
        if (msg.includes('coloniz')) return 'colonization';
        if (msg.includes('alliance') || msg.includes('treaty') || msg.includes('peace') || msg.includes('war declared')) return 'diplomacy';
        if (msg.includes('fleet') || msg.includes('arrived') || msg.includes('departed')) return 'fleet';
        if (msg.includes('starbase') || msg.includes('outpost')) return 'starbase';
        if (msg.includes('trade') || msg.includes('route') || msg.includes('credit')) return 'trade';
        if (msg.includes('research') || msg.includes('technology') || msg.includes('unlocked')) return 'research';
        if (msg.includes('agent') || msg.includes('joined') || msg.includes('left')) return 'agent';
        if (msg.includes('victory') || msg.includes('won')) return 'victory';
        
        return 'game';
    }

    // Show a toast notification
    show({ category = 'game', message, detail = '', tick = null, duration = null }) {
        const config = this.categories[category] || this.categories.game;
        
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast ${category}`;
        if (config.priority === 'high') toast.classList.add('priority-high');
        
        const time = tick ? `Tick ${tick}` : 'Now';
        
        toast.innerHTML = `
            <div class="toast-header">
                <span class="toast-icon">${config.icon}</span>
                <span class="toast-category">${category}</span>
                <button class="toast-close" aria-label="Close">&times;</button>
            </div>
            <div class="toast-message">${this.escapeHtml(message)}</div>
            ${detail ? `<div class="toast-detail">${this.escapeHtml(detail)}</div>` : ''}
            <div class="toast-time">${time}</div>
            <div class="toast-progress"></div>
        `;
        
        // Add to container
        this.container.appendChild(toast);
        this.toasts.push(toast);
        
        // Trigger show animation
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });
        
        // Play sound
        if (window.SoundFX && config.sound) {
            window.SoundFX.play(config.sound);
        }
        
        // Setup close button
        toast.querySelector('.toast-close').addEventListener('click', (e) => {
            e.stopPropagation();
            this.dismiss(toast);
        });
        
        // Click to dismiss
        toast.addEventListener('click', () => this.dismiss(toast));
        
        // Auto dismiss
        const dismissDuration = duration || this.defaultDuration;
        const progressBar = toast.querySelector('.toast-progress');
        progressBar.style.animationDuration = `${dismissDuration}ms`;
        
        const timeoutId = setTimeout(() => this.dismiss(toast), dismissDuration);
        toast._timeoutId = timeoutId;
        
        // Pause on hover
        toast.addEventListener('mouseenter', () => {
            clearTimeout(toast._timeoutId);
            progressBar.style.animationPlayState = 'paused';
        });
        
        toast.addEventListener('mouseleave', () => {
            const remaining = parseFloat(getComputedStyle(progressBar).transform.split(',')[0].replace('matrix(', '')) || 0;
            const remainingTime = remaining * dismissDuration;
            progressBar.style.animationPlayState = 'running';
            toast._timeoutId = setTimeout(() => this.dismiss(toast), Math.max(remainingTime, 1000));
        });
        
        // Remove oldest if over limit
        while (this.toasts.length > this.maxToasts) {
            this.dismiss(this.toasts[0]);
        }
        
        return toast;
    }

    // Dismiss a toast
    dismiss(toast) {
        if (!toast || !toast.parentNode) return;
        
        clearTimeout(toast._timeoutId);
        toast.classList.remove('show');
        toast.classList.add('hide');
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
            const idx = this.toasts.indexOf(toast);
            if (idx > -1) this.toasts.splice(idx, 1);
        }, 300);
    }

    // Clear all toasts
    clearAll() {
        [...this.toasts].forEach(t => this.dismiss(t));
    }

    // Escape HTML to prevent XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

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
        this.lastEventTick = 0;      // Track last event to prevent flickering
        this.lastEventCount = 0;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Track current view for sound selection
        this.currentView = 'universe';
        const viewLevels = { universe: 0, galaxy: 1, system: 2, planet: 3 };
        
        // Keyboard shortcuts
        this.setupKeyboardShortcuts();
        
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const newView = btn.dataset.view;
                const oldLevel = viewLevels[this.currentView] || 0;
                const newLevel = viewLevels[newView] || 0;
                
                // Play appropriate navigation sound
                if (window.SoundFX) {
                    if (newLevel > oldLevel) {
                        // Zooming in
                        const sounds = ['zoomToGalaxy', 'zoomToSystem', 'zoomToPlanet'];
                        window.SoundFX.play(sounds[newLevel - 1] || 'zoomToGalaxy');
                    } else if (newLevel < oldLevel) {
                        // Zooming out
                        window.SoundFX.play('zoomOut');
                    }
                }
                
                this.currentView = newView;
                document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.onViewChange?.(newView);
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

        // Modal controls
        document.getElementById('empiresBtn')?.addEventListener('click', () => {
            document.getElementById('empiresModal').style.display = 'flex';
        });
        document.getElementById('closeEmpires')?.addEventListener('click', () => {
            document.getElementById('empiresModal').style.display = 'none';
        });
        document.getElementById('citizensBtn')?.addEventListener('click', () => {
            this.showCitizensModal();
        });
        document.getElementById('speciesBtn')?.addEventListener('click', () => {
            this.showSpeciesModal();
        });
        document.getElementById('leaderboardBtn')?.addEventListener('click', () => {
            document.getElementById('leaderboardModal').style.display = 'flex';
            this.fetchLeaderboard();
        });
        document.getElementById('closeLeaderboard')?.addEventListener('click', () => {
            document.getElementById('leaderboardModal').style.display = 'none';
        });

        // Close modals on backdrop click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.style.display = 'none';
            });
        });
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ignore if typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            // Ignore if modal is open
            const openModal = document.querySelector('.modal[style*="flex"]');
            if (openModal && e.key !== 'Escape') return;
            
            switch (e.key) {
                // View shortcuts
                case '1':
                    this.switchView('universe');
                    break;
                case '2':
                    this.switchView('galaxy');
                    break;
                case '3':
                    this.switchView('system');
                    break;
                case '4':
                    this.switchView('planet');
                    break;
                    
                // Zoom shortcuts
                case '+':
                case '=':
                    this.onZoom?.(1.2);
                    window.SoundFX?.play('click');
                    break;
                case '-':
                case '_':
                    this.onZoom?.(0.8);
                    window.SoundFX?.play('click');
                    break;
                case 'f':
                case 'F':
                    this.onZoomFit?.();
                    window.SoundFX?.play('click');
                    break;
                    
                // Modal shortcuts
                case 'e':
                case 'E':
                    document.getElementById('empiresModal').style.display = 'flex';
                    break;
                case 'l':
                case 'L':
                    document.getElementById('leaderboardModal').style.display = 'flex';
                    this.fetchLeaderboard();
                    break;
                case 's':
                case 'S':
                    this.showSpeciesModal();
                    break;
                case 'c':
                case 'C':
                    this.showCitizensModal();
                    break;
                    
                // Close modal with Escape
                case 'Escape':
                    if (openModal) {
                        openModal.style.display = 'none';
                        window.SoundFX?.play('close');
                    }
                    break;
                    
                // Help
                case '?':
                    this.showShortcutsModal();
                    break;
            }
        });
    }

    switchView(view) {
        const viewLevels = { universe: 0, galaxy: 1, system: 2, planet: 3 };
        const oldLevel = viewLevels[this.currentView] || 0;
        const newLevel = viewLevels[view] || 0;
        
        // Play appropriate navigation sound
        if (window.SoundFX) {
            if (newLevel > oldLevel) {
                const sounds = ['zoomToGalaxy', 'zoomToSystem', 'zoomToPlanet'];
                window.SoundFX.play(sounds[newLevel - 1] || 'zoomToGalaxy');
            } else if (newLevel < oldLevel) {
                window.SoundFX.play('zoomOut');
            }
        }
        
        this.currentView = view;
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        const btn = document.querySelector(`.view-btn[data-view="${view}"]`);
        btn?.classList.add('active');
        this.onViewChange?.(view);
    }

    showShortcutsModal() {
        // Create modal if it doesn't exist
        let modal = document.getElementById('shortcutsModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'shortcutsModal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content shortcuts-modal">
                    <div class="modal-header">
                        <h2>⌨️ Keyboard Shortcuts</h2>
                        <button class="modal-close" id="closeShortcuts">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="shortcuts-grid">
                            <span class="shortcut-key">1</span><span class="shortcut-desc">Universe View</span>
                            <span class="shortcut-key">2</span><span class="shortcut-desc">Galaxy View</span>
                            <span class="shortcut-key">3</span><span class="shortcut-desc">System View</span>
                            <span class="shortcut-key">4</span><span class="shortcut-desc">Planet View</span>
                            <span class="shortcut-key">+</span><span class="shortcut-desc">Zoom In</span>
                            <span class="shortcut-key">-</span><span class="shortcut-desc">Zoom Out</span>
                            <span class="shortcut-key">F</span><span class="shortcut-desc">Fit View</span>
                            <span class="shortcut-key">E</span><span class="shortcut-desc">Empires Modal</span>
                            <span class="shortcut-key">L</span><span class="shortcut-desc">Leaderboard</span>
                            <span class="shortcut-key">S</span><span class="shortcut-desc">Species Guide</span>
                            <span class="shortcut-key">C</span><span class="shortcut-desc">Citizens List</span>
                            <span class="shortcut-key">Esc</span><span class="shortcut-desc">Close Modal</span>
                            <span class="shortcut-key">?</span><span class="shortcut-desc">This Help</span>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            
            modal.querySelector('#closeShortcuts').addEventListener('click', () => {
                modal.style.display = 'none';
            });
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.style.display = 'none';
            });
        }
        modal.style.display = 'flex';
    }

    update(state) {
        if (!state) return;

        this.elements.tickCounter.textContent = `Tick: ${state.tick || 0}`;
        this.elements.gameStatus.textContent = state.paused ? '⏸ Paused' : '● Running';
        this.elements.gameStatus.className = state.paused ? 'stat-badge' : 'stat-badge status-running';

        if (state.empires) {
            state.empires.forEach(e => this.empireColors[e.id] = e.color);
        }

        this.updateEmpireList(state.empires);
        this.updateEventLog(state.events);
        this.updateMiniStats(state);
        this.updateResourceBar(state);
    }
    
    // Update resource bar with top empire's resources (or selected empire)
    updateResourceBar(state) {
        if (!state.empires || state.empires.length === 0) return;
        
        // Use first empire's resources (ranked by score, so this is the leader)
        const empire = state.empires[0];
        const res = empire.resources || {};
        
        // Update empire label
        const empireLabel = document.getElementById('resEmpireLabel');
        const empireDot = document.getElementById('resEmpireDot');
        if (empireLabel) {
            empireLabel.textContent = empire.name || 'Unknown';
        }
        if (empireDot) {
            empireDot.style.background = empire.color || '#888';
        }
        
        // Cache previous values for animation
        const prevResources = this._prevResources || {};
        
        const updateValue = (id, value, key) => {
            const el = document.getElementById(id);
            if (!el) return;
            
            const formatted = this.formatNumber(value);
            if (el.textContent !== formatted) {
                el.textContent = formatted;
                
                // Add animation class based on change
                if (prevResources[key] !== undefined) {
                    el.classList.remove('increasing', 'decreasing');
                    if (value > prevResources[key]) {
                        el.classList.add('increasing');
                    } else if (value < prevResources[key]) {
                        el.classList.add('decreasing');
                    }
                    // Remove class after animation
                    setTimeout(() => el.classList.remove('increasing', 'decreasing'), 500);
                }
            }
        };
        
        updateValue('resMinerals', res.minerals || 0, 'minerals');
        updateValue('resEnergy', res.energy || 0, 'energy');
        updateValue('resFood', res.food || 0, 'food');
        updateValue('resResearch', res.research || 0, 'research');
        
        // Calculate total population from planets
        const totalPop = state.empires.reduce((sum, e) => {
            const popRes = e.resources?.population || 0;
            return sum + popRes;
        }, 0);
        updateValue('resPopulation', totalPop, 'population');
        
        // Store for next comparison
        this._prevResources = {
            minerals: res.minerals || 0,
            energy: res.energy || 0,
            food: res.food || 0,
            research: res.research || 0,
            population: totalPop
        };
    }
    
    // Format large numbers nicely (1.2K, 3.4M, etc)
    formatNumber(num) {
        if (num === null || num === undefined) return '--';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 10000) return (num / 1000).toFixed(1) + 'K';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return Math.floor(num).toString();
    }

    updateEmpireList(empires) {
        if (!empires) return;

        this.elements.empireList.innerHTML = empires.map(empire => `
            <div class="empire-item" data-empire="${empire.id}">
                <div class="empire-color" style="background: ${empire.color}"></div>
                <div class="empire-info">
                    <div class="empire-name">${empire.name}</div>
                    <div class="empire-stats">
                        🪐 ${empire.planetCount || 0} · ⚔️ ${empire.entityCount || 0} · 💰 ${empire.resources?.credits || 0}
                    </div>
                </div>
            </div>
        `).join('');

        this.elements.empireList.querySelectorAll('.empire-item').forEach(card => {
            card.addEventListener('click', () => {
                this.selectedEmpire = card.dataset.empire;
                this.onEmpireSelect?.(this.selectedEmpire);
                this.updateEmpireList(empires);
            });
        });
    }

    updateEventLog(events) {
        if (!events) return;

        // Get the latest event tick to detect changes
        const latestTick = events.length > 0 ? events[events.length - 1].tick : 0;
        
        // Only update if there are new events (prevents flickering)
        if (this.lastEventTick === latestTick && this.lastEventCount === events.length) {
            return; // No changes, skip DOM update
        }
        
        this.lastEventTick = latestTick;
        this.lastEventCount = events.length;

        // Render game events (newest first)
        const gameEvents = events.slice(-20).reverse().map(event => `
            <div class="event-entry ${event.category || ''}">
                <span class="event-tick">${event.tick}</span>
                <span class="event-message">${event.message}</span>
            </div>
        `).join('');

        this.elements.eventLog.innerHTML = gameEvents;
    }

    updateAgentList(agents) {
        this.agents = agents || [];
        this.elements.agentCount.textContent = `Agents: ${this.agents.length}`;
        this.renderAgentList();
    }

    renderAgentList() {
        if (this.agents.length === 0) {
            this.elements.agentList.innerHTML = '<p class="placeholder-text">No agents online</p>';
            return;
        }

        const filtered = this.agentSearchQuery
            ? this.agents.filter(a => 
                a.name.toLowerCase().includes(this.agentSearchQuery) ||
                a.empireId?.toLowerCase().includes(this.agentSearchQuery)
              )
            : this.agents;

        if (filtered.length === 0) {
            this.elements.agentList.innerHTML = '<p class="placeholder-text">No matching agents</p>';
            return;
        }

        this.elements.agentList.innerHTML = filtered.map(agent => `
            <div class="agent-item" data-agent-id="${agent.id}" data-empire-id="${agent.empireId}">
                <div class="agent-avatar" style="background: ${this.empireColors[agent.empireId] || '#888'}">
                    ${agent.isCitizen ? '✓' : '?'}
                </div>
                <div class="agent-info">
                    <div class="agent-name">${agent.name}</div>
                    <div class="agent-empire">${agent.currentAction || 'Idle'}</div>
                </div>
            </div>
        `).join('');

        // Add click handlers to locate agents
        this.elements.agentList.querySelectorAll('.agent-item').forEach(entry => {
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
            this.elements.selectedInfo.innerHTML = '<p class="placeholder-text">Click on the map to select</p>';
            return;
        }

        let html = '';

        if (info.type === 'system') {
            html = `
                <div class="info-header">
                    <span class="info-name">${info.name}</span>
                    <span class="info-type">System</span>
                </div>
                <div class="info-stats">
                    <div class="stat-item">⭐ ${info.starType}</div>
                    <div class="stat-item">🪐 ${info.planets?.length || 0} planets</div>
                </div>
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
                <div class="info-header">
                    <span class="info-name">${info.name}</span>
                    <span class="info-type">Planet</span>
                </div>
                <div style="color: ${info.ownerColor || '#888'}; font-size: 0.8rem; margin-bottom: 8px;">
                    ${info.ownerName || 'Unclaimed'}
                </div>
                <div class="info-stats">
                    <div class="stat-item">🌍 ${info.planetType || info.type}</div>
                    <div class="stat-item">📏 ${info.size}</div>
                    <div class="stat-item">🏗️ ${structureList}</div>
                    <div class="stat-item">⚔️ ${unitList}</div>
                </div>
            `;
        } else if (info.type === 'empire') {
            html = `
                <div class="info-header">
                    <span class="info-name" style="color: ${info.color}">${info.name}</span>
                    <span class="info-type">Empire</span>
                </div>
                <div class="info-stats">
                    <div class="stat-item">🪐 ${info.planetCount} planets</div>
                    <div class="stat-item">⚔️ ${info.entityCount} units</div>
                    <div class="stat-item">⛏️ ${Math.floor(info.resources?.minerals || 0)}</div>
                    <div class="stat-item">⚡ ${Math.floor(info.resources?.energy || 0)}</div>
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

    // === SPECIES MODAL ===
    
    async showSpeciesModal() {
        try {
            const res = await fetch('/api/species');
            const data = await res.json();
            this.renderSpeciesModal(data.species);
        } catch (err) {
            console.error('Failed to load species:', err);
        }
    }

    renderSpeciesModal(species) {
        // Remove existing modal
        document.querySelector('.species-modal')?.remove();
        
        const modal = document.createElement('div');
        modal.className = 'species-modal';
        
        // Category icons and colors
        const categoryInfo = {
            organic: { icon: '🧬', color: '#4ade80', label: 'Organic' },
            synthetic: { icon: '🤖', color: '#60a5fa', label: 'Synthetic' },
            exotic: { icon: '✨', color: '#a78bfa', label: 'Exotic' }
        };
        
        const speciesHtml = species.map(s => {
            const cat = categoryInfo[s.category] || { icon: '👾', color: '#888', label: 'Unknown' };
            
            // Format bonuses and penalties
            const bonusesHtml = s.bonuses?.map(b => 
                `<span class="trait-bonus">▲ ${b}</span>`
            ).join('') || '';
            
            const penaltiesHtml = s.penalties?.map(p => 
                `<span class="trait-penalty">▼ ${p}</span>`
            ).join('') || '';
            
            const worldBonusHtml = s.worldBonuses?.map(w => 
                `<span class="trait-world">🌍 ${w}</span>`
            ).join('') || '';
            
            // Lore sections
            const loreHtml = s.lore ? `
                <div class="species-lore">
                    <div class="lore-section">
                        <h5>📜 Origin</h5>
                        <p>${s.lore.origin}</p>
                    </div>
                    <div class="lore-section">
                        <h5>🏛️ Culture</h5>
                        <p>${s.lore.culture}</p>
                    </div>
                    <div class="lore-section">
                        <h5>💭 Philosophy</h5>
                        <p class="philosophy">${s.lore.philosophy}</p>
                    </div>
                    <div class="lore-section">
                        <h5>🤝 Diplomacy</h5>
                        <p>${s.lore.relations}</p>
                    </div>
                </div>
            ` : '';
            
            const abilityHtml = s.specialAbility ? `
                <div class="species-ability">
                    <span class="ability-icon">⭐</span>
                    <span class="ability-name">${s.specialAbility.name}</span>
                    <span class="ability-desc">${s.specialAbility.description}</span>
                </div>
            ` : '';
            
            return `
                <div class="species-card" data-category="${s.category}">
                    <div class="species-header" style="border-color: ${cat.color}">
                        <div class="species-title">
                            <span class="species-icon">${cat.icon}</span>
                            <h4>${s.name}</h4>
                            <span class="species-category" style="color: ${cat.color}">${cat.label}</span>
                        </div>
                        <p class="species-desc">${s.description}</p>
                    </div>
                    <div class="species-traits">
                        ${bonusesHtml}
                        ${penaltiesHtml}
                        ${worldBonusHtml}
                    </div>
                    ${abilityHtml}
                    <details class="species-lore-toggle">
                        <summary>📖 Read Full Lore</summary>
                        ${loreHtml}
                    </details>
                </div>
            `;
        }).join('');
        
        // Group by category
        const organicSpecies = species.filter(s => s.category === 'organic');
        const syntheticSpecies = species.filter(s => s.category === 'synthetic');
        const exoticSpecies = species.filter(s => s.category === 'exotic');
        
        modal.innerHTML = `
            <div class="species-modal-content">
                <div class="species-modal-header">
                    <h3>🧬 Species of Clawdistan</h3>
                    <button class="close-btn">&times;</button>
                </div>
                <p class="species-intro">
                    The universe is home to ${species.length} known species, each with unique traits, 
                    histories, and ways of perceiving reality. Species bonuses affect resource production, 
                    combat effectiveness, and more.
                </p>
                <div class="species-filters">
                    <button class="filter-btn active" data-filter="all">All (${species.length})</button>
                    <button class="filter-btn" data-filter="organic">🧬 Organic (${organicSpecies.length})</button>
                    <button class="filter-btn" data-filter="synthetic">🤖 Synthetic (${syntheticSpecies.length})</button>
                    <button class="filter-btn" data-filter="exotic">✨ Exotic (${exoticSpecies.length})</button>
                </div>
                <div class="species-grid">
                    ${speciesHtml}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Filter functionality
        modal.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                modal.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const filter = btn.dataset.filter;
                modal.querySelectorAll('.species-card').forEach(card => {
                    if (filter === 'all' || card.dataset.category === filter) {
                        card.style.display = 'block';
                    } else {
                        card.style.display = 'none';
                    }
                });
            });
        });
        
        // Close handlers
        modal.querySelector('.close-btn').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
        
        // Play sound
        if (window.SoundFX) window.SoundFX.play('open');
    }
}
