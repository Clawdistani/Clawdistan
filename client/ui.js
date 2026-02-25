// UI Manager for Clawdistan observer interface
// Modularized: generators, notifications, and ship-designer are imported from ./ui/

// Import from modular files
import { CrestGenerator, SpeciesPortraitGenerator } from './ui/generators.js';
import { StatsTracker, NotificationManager } from './ui/notifications.js';
import { ShipDesigner } from './ui/ship-designer.js';
import { TechTree } from './ui/tech-tree.js';
import { DiplomacyPanel } from './ui/diplomacy.js';

// Re-export for backward compatibility
export { CrestGenerator, SpeciesPortraitGenerator, StatsTracker, NotificationManager, ShipDesigner, TechTree, DiplomacyPanel };

export class UIManager {
    constructor() {
        this.elements = {
            tickCounter: document.getElementById('tickCounter'),
            agentCount: document.getElementById('agentCount'),
            gameStatus: document.getElementById('gameStatus'),
            gameTimer: document.getElementById('gameTimer'),
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
        this.statsTracker = new StatsTracker(50); // Track last 50 samples
        this.gameSession = null;     // Current game session data
        this.setupEventListeners();
        this.startGameTimerUpdates();
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
        document.getElementById('speciesBtn')?.addEventListener('click', () => {
            this.showSpeciesModal();
        });
        // Rankings modal (consolidated: Leaderboard + Citizens + Empires)
        document.getElementById('rankingsBtn')?.addEventListener('click', () => {
            this.showRankingsModal();
        });
        // Reliquary modal
        document.getElementById('reliquaryBtn')?.addEventListener('click', () => {
            this.showReliquaryModal();
        });
        // Buildings modal
        document.getElementById('buildingsBtn')?.addEventListener('click', () => {
            this.showBuildingsModal();
        });
        document.getElementById('closeBuildings')?.addEventListener('click', () => {
            document.getElementById('buildingsModal').style.display = 'none';
        });
        // Tile detail modal
        document.getElementById('closeTileDetail')?.addEventListener('click', () => {
            document.getElementById('tileDetailModal').style.display = 'none';
        });
        document.getElementById('closeRankings')?.addEventListener('click', () => {
            document.getElementById('rankingsModal').style.display = 'none';
        });

        // Council modal
        document.getElementById('councilStatus')?.addEventListener('click', () => {
            this.showCouncilModal();
        });
        document.getElementById('closeCouncil')?.addEventListener('click', () => {
            document.getElementById('councilModal').style.display = 'none';
        });
        document.getElementById('refreshCouncil')?.addEventListener('click', () => {
            this.refreshCouncilModal();
        });

        // Crisis modal
        document.getElementById('crisisStatus')?.addEventListener('click', () => {
            this.showCrisisModal();
        });

        // Initialize rankings
        this.initRankings();

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
                case 'l':
                case 'L':
                    this.showRankingsModal();
                    break;
                case 's':
                case 'S':
                    this.showSpeciesModal();
                    break;
                case 'b':
                case 'B':
                    this.showBuildingsModal();
                    break;
                case 't':
                case 'T':
                    document.getElementById('techTreeModal').style.display = 'flex';
                    this.fetchTechTree();
                    break;
                case 'd':
                case 'D':
                    document.getElementById('diplomacyModal').style.display = 'flex';
                    this.fetchDiplomacy();
                    break;
                case 'r':
                case 'R':
                    this.showReliquaryModal();
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

    // ═══════════════════════════════════════════════════════════════════
    // GAME TIMER - 24h countdown display
    // ═══════════════════════════════════════════════════════════════════
    startGameTimerUpdates() {
        // Fetch immediately
        this.fetchGameSession();
        // Update every 10 seconds
        setInterval(() => this.fetchGameSession(), 10000);
        // Update display every second (uses cached data)
        setInterval(() => this.updateTimerDisplay(), 1000);
    }

    async fetchGameSession() {
        try {
            const res = await fetch('/api/game');
            if (res.ok) {
                this.gameSession = await res.json();
                this.updateTimerDisplay();
            }
        } catch (e) {
            console.warn('Failed to fetch game session:', e);
        }
    }

    updateTimerDisplay() {
        const el = this.elements.gameTimer;
        if (!el || !this.gameSession) return;

        const { timeRemaining, isEnded, winner, winCondition } = this.gameSession;

        // Remove all state classes
        el.classList.remove('ending-soon', 'final-minutes', 'game-over');

        if (isEnded && winner) {
            el.textContent = `🏆 ${winner.empireName}`;
            el.classList.add('game-over');
            el.setAttribute('data-tooltip-desc', `Victory by ${winCondition}! New game starting soon...`);
            return;
        }

        // Calculate time from remaining ms
        const totalSec = Math.max(0, Math.floor(timeRemaining / 1000));
        const hours = Math.floor(totalSec / 3600);
        const mins = Math.floor((totalSec % 3600) / 60);
        const secs = totalSec % 60;

        const pad = (n) => n.toString().padStart(2, '0');
        el.textContent = `⏱️ ${pad(hours)}:${pad(mins)}:${pad(secs)}`;

        // Visual urgency states
        if (totalSec <= 60) {
            el.classList.add('final-minutes');
            el.setAttribute('data-tooltip-desc', 'FINAL MINUTE! Highest score wins!');
        } else if (totalSec <= 600) {
            el.classList.add('ending-soon');
            el.setAttribute('data-tooltip-desc', 'Less than 10 minutes! Secure your lead!');
        } else if (totalSec <= 3600) {
            el.classList.add('ending-soon');
            el.setAttribute('data-tooltip-desc', 'Less than 1 hour remaining!');
        } else {
            el.setAttribute('data-tooltip-desc',
                'Time remaining in current game. Win by controlling 51% of planets or having the highest score when time expires.');
        }
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
                            <span class="shortcut-key">T</span><span class="shortcut-desc">Tech Tree</span>
                            <span class="shortcut-key">D</span><span class="shortcut-desc">Diplomacy</span>
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
            // Cache empires for agent list lookup
            this._cachedEmpires = state.empires;
            // Record stats for graphing
            this.statsTracker.record(state.tick || 0, state.empires);
        }

        this.updateEmpireList(state.empires);
        this.updateEventLog(state.events);
        this.updateMiniStats(state);
        this.updateCouncilStatus(state.council);
        this.updateCrisisStatus(state.crisis);
        this.updateCycleStatus(state.cycle);
        this.updateFleetActivity(state);

        // Cache crisis and universe for modal
        if (state.crisis) this._cachedCrisis = state.crisis;
        if (state.universe) this._cachedUniverse = state.universe;
        if (state.cycle) this._cachedCycle = state.cycle;
    }

    // Update resource bar with selected empire's resources (or top empire if none selected)
    updateResourceBar(state) {
        const empireLabel = document.getElementById('resEmpireLabel');
        const empireDot = document.getElementById('resEmpireDot');

        if (!state.empires || state.empires.length === 0) {
            // Show observer mode when no empires
            if (empireLabel) empireLabel.textContent = 'Observer Mode';
            if (empireDot) empireDot.style.background = '#888';
            return;
        }

        // Use selected empire if set, otherwise default to leader (#1)
        let empire = state.empires[0];
        if (this.selectedEmpire) {
            const selected = state.empires.find(e => e.id === this.selectedEmpire);
            if (selected) empire = selected;
        }
        const res = empire.resources || {};

        // Update empire label
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

    // Update council status badge
    updateCouncilStatus(council) {
        const badge = document.getElementById('councilStatus');
        if (!badge) return;

        // Show the badge
        badge.style.display = 'inline-flex';

        // Reset classes
        badge.classList.remove('voting', 'no-leader');

        if (!council || !council.councilActive) {
            badge.style.display = 'none';
            return;
        }

        // Voting in progress
        if (council.voting?.active) {
            badge.classList.add('voting');
            const secondsLeft = council.voting.secondsLeft || 0;
            badge.textContent = `🗳️ VOTING (${secondsLeft}s)`;
            badge.setAttribute('data-tooltip-desc',
                `Council election in progress! ${council.voting.candidates?.length || 0} candidates. Click to view details.`);
            return;
        }

        // Has a Supreme Leader
        if (council.currentLeader) {
            const leaderName = council.currentLeader.empireName || 'Unknown';
            const terms = council.currentLeader.consecutiveTerms || 1;
            badge.textContent = `👑 ${leaderName}`;

            // Update tooltip
            const minutesLeft = council.nextElection?.minutesRemaining || 0;
            let tooltipDesc = `Supreme Leader of the Galactic Council.`;
            if (terms > 1) tooltipDesc += ` (${terms} consecutive terms)`;
            tooltipDesc += ` Next election in ${minutesLeft} min.`;
            badge.setAttribute('data-tooltip-desc', tooltipDesc);
            return;
        }

        // No leader
        badge.classList.add('no-leader');
        const minutesLeft = council.nextElection?.minutesRemaining || 0;
        badge.textContent = `👑 No Leader`;
        badge.setAttribute('data-tooltip-desc',
            `No Supreme Leader elected. Next election in ${minutesLeft} min.`);
    }

    // Update crisis status badge
    updateCrisisStatus(crisis) {
        const badge = document.getElementById('crisisStatus');
        if (!badge) return;

        // No crisis data - hide badge
        if (!crisis) {
            badge.style.display = 'none';
            return;
        }

        // Reset classes
        badge.classList.remove('warning', 'swarm', 'precursors', 'rebellion');

        // Crisis warning issued but not yet started
        if (crisis.warning && crisis.status === 'warning') {
            badge.style.display = 'inline-flex';
            badge.classList.add('warning');
            badge.textContent = `⚠️ WARNING`;
            badge.setAttribute('data-tooltip-desc',
                `${crisis.message || 'Unknown threat detected!'} Crisis arriving soon!`);
            return;
        }

        // Active crisis
        if (crisis.active && crisis.status === 'crisis') {
            badge.style.display = 'inline-flex';

            // Add type-specific class
            if (crisis.type === 'extragalactic_swarm') badge.classList.add('swarm');
            else if (crisis.type === 'awakened_precursors') badge.classList.add('precursors');
            else if (crisis.type === 'ai_rebellion') badge.classList.add('rebellion');

            // Show active units vs destroyed in badge tooltip
            const activeUnits = crisis.activeUnits || 0;
            const destroyed = crisis.fleetsDestroyed || 0;

            badge.textContent = `${crisis.icon || '💀'} ${crisis.name || 'CRISIS'} (${activeUnits} active)`;
            badge.setAttribute('data-tooltip-desc',
                `${crisis.description || 'Galaxy under threat!'} Active: ${activeUnits} units | Destroyed: ${destroyed} units. All empires must unite!`);
            return;
        }

        // No active crisis
        badge.style.display = 'none';
    }

    // ═══════════════════════════════════════════════════════════════════
    // GALACTIC CYCLES - Update cycle status badge
    // ═══════════════════════════════════════════════════════════════════
    updateCycleStatus(cycle) {
        const badge = document.getElementById('cycleStatus');
        if (!badge) return;

        // No cycle data - show default
        if (!cycle || !cycle.current) {
            badge.style.display = 'none';
            return;
        }

        badge.style.display = 'inline-flex';

        // Update badge styling based on cycle type
        badge.className = 'cycle-badge ' + cycle.current.id;
        badge.style.setProperty('--cycle-color', cycle.current.color);

        // Format remaining time
        const remaining = cycle.remaining || 0;
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        const timeStr = `${mins}:${String(secs).padStart(2, '0')}`;

        // Badge content
        badge.textContent = `${cycle.current.icon} ${cycle.current.name}`;

        // Create or update timer element
        let timer = badge.querySelector('.cycle-timer');
        if (!timer) {
            timer = document.createElement('span');
            timer.className = 'cycle-timer';
            badge.appendChild(timer);
        }
        timer.textContent = ` (${timeStr})`;

        // Build tooltip with effects
        let effectsText = '';
        if (cycle.current.effects && Object.keys(cycle.current.effects).length > 0) {
            const effectNames = {
                productionModifier: 'Production',
                researchModifier: 'Research',
                travelTimeModifier: 'Travel Time',
                sensorRangeModifier: 'Sensor Range',
                fleetDamagePerTick: 'Fleet Damage/tick',
                stealthModifier: 'Stealth',
                spySuccessModifier: 'Spy Success',
                fleetSpeedModifier: 'Fleet Speed'
            };

            const effects = Object.entries(cycle.current.effects)
                .map(([key, val]) => {
                    const name = effectNames[key] || key;
                    if (key.includes('Modifier')) {
                        const pct = Math.round((val - 1) * 100);
                        return `${name}: ${pct >= 0 ? '+' : ''}${pct}%`;
                    }
                    return `${name}: ${val}`;
                })
                .join(' | ');
            effectsText = `\n\nEffects: ${effects}`;
        }

        // Next cycle info
        const nextInfo = cycle.next ? `\n\nNext: ${cycle.next.icon} ${cycle.next.name}` : '';

        badge.setAttribute('data-tooltip-desc',
            `${cycle.current.description}${effectsText}${nextInfo}\n\nTime remaining: ${timeStr}`);
    }

    // Show crisis modal with detailed information
    showCrisisModal() {
        const crisis = this._cachedCrisis;
        if (!crisis) return;

        // Remove existing modal
        document.querySelector('.crisis-modal')?.remove();

        const modal = document.createElement('div');
        modal.className = 'modal crisis-modal';

        // Crisis colors
        const crisisColors = {
            'extragalactic_swarm': '#8b0000',
            'awakened_precursors': '#ffd700',
            'ai_rebellion': '#00ced1'
        };
        const color = crisisColors[crisis.type] || '#ff4444';

        // Calculate win progress (destroy all crisis units)
        const totalSpawned = (crisis.fleetsSpawned || 0) * 10; // ~10 units per fleet
        const destroyed = crisis.fleetsDestroyed || 0;
        const active = crisis.activeUnits || 0;
        const winProgress = totalSpawned > 0 ? Math.min(100, Math.round((destroyed / totalSpawned) * 100)) : 0;

        // Find systems with crisis presence
        let affectedSystems = [];
        if (this._cachedUniverse?.solarSystems && crisis.crisisEmpireId) {
            // We can't easily get entities here, but we can show the crisis faction info
        }

        let content = '';
        if (crisis.active) {
            content = `
                <div class="crisis-modal-content" style="border-color: ${color}">
                    <div class="crisis-modal-header" style="background: linear-gradient(135deg, ${color}33, ${color}11)">
                        <h2>${crisis.icon || '💀'} ${crisis.name || 'GALACTIC CRISIS'}</h2>
                        <button class="modal-close crisis-close">&times;</button>
                    </div>
                    <div class="crisis-modal-body">
                        <p class="crisis-desc">${crisis.description || 'A galaxy-threatening event has begun!'}</p>

                        <div class="crisis-stats">
                            <div class="crisis-stat">
                                <span class="stat-label">Active Units</span>
                                <span class="stat-value" style="color: ${color}">${active}</span>
                            </div>
                            <div class="crisis-stat">
                                <span class="stat-label">Units Destroyed</span>
                                <span class="stat-value" style="color: #4ade80">${destroyed}</span>
                            </div>
                            <div class="crisis-stat">
                                <span class="stat-label">Fleets Spawned</span>
                                <span class="stat-value">${crisis.fleetsSpawned || 0}</span>
                            </div>
                        </div>

                        <div class="crisis-progress-section">
                            <h3>🎯 Victory Progress</h3>
                            <p>Destroy all crisis units to save the galaxy!</p>
                            <div class="crisis-progress-bar">
                                <div class="crisis-progress-fill" style="width: ${winProgress}%; background: ${color}"></div>
                            </div>
                            <span class="crisis-progress-text">${winProgress}% Complete (${destroyed}/${totalSpawned} units)</span>
                        </div>

                        ${crisis.lore ? `
                        <div class="crisis-lore">
                            <h3>📜 Lore</h3>
                            <p>${crisis.lore}</p>
                        </div>
                        ` : ''}

                        <div class="crisis-tip">
                            <strong>💡 Tip:</strong> Look for ${crisis.icon || '💀'} icons on systems and planets to find crisis forces. All empires must unite!
                        </div>
                    </div>
                </div>
            `;
        } else if (crisis.warning) {
            content = `
                <div class="crisis-modal-content warning" style="border-color: #f59e0b">
                    <div class="crisis-modal-header" style="background: linear-gradient(135deg, #f59e0b33, #f59e0b11)">
                        <h2>⚠️ ${crisis.name || 'CRISIS INCOMING'}</h2>
                        <button class="modal-close crisis-close">&times;</button>
                    </div>
                    <div class="crisis-modal-body">
                        <p class="crisis-desc">${crisis.message || 'An unknown threat approaches...'}</p>
                        <div class="crisis-warning-info">
                            <p>🕐 Prepare your defenses! The crisis will arrive soon.</p>
                        </div>
                    </div>
                </div>
            `;
        } else {
            content = `
                <div class="crisis-modal-content" style="border-color: #4ade80">
                    <div class="crisis-modal-header" style="background: linear-gradient(135deg, #4ade8033, #4ade8011)">
                        <h2>✨ Galaxy at Peace</h2>
                        <button class="modal-close crisis-close">&times;</button>
                    </div>
                    <div class="crisis-modal-body">
                        <p class="crisis-desc">No active crisis detected. The galaxy is peaceful... for now.</p>
                    </div>
                </div>
            `;
        }

        modal.innerHTML = content;
        document.body.appendChild(modal);
        modal.style.display = 'flex';

        // Close handlers
        modal.querySelector('.crisis-close')?.addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        window.SoundFX?.play('open');
    }

    // Update fleet activity panel with fleets in transit
    updateFleetActivity(state) {
        const container = document.getElementById('fleetActivity');
        const countBadge = document.getElementById('fleetCount');
        if (!container) {
            console.warn('Fleet activity container not found');
            return;
        }

        // Ensure we have fleet data - check multiple possible locations
        const fleets = state.fleetsInTransit || state.allFleets || [];
        const currentTick = state.tick || 0;
        
        // Debug: log fleet count on first few updates
        if (this._fleetDebugCount === undefined) this._fleetDebugCount = 0;
        if (this._fleetDebugCount < 3) {
            console.log(`🚀 Fleet panel update: ${fleets.length} fleets, tick ${currentTick}`);
            this._fleetDebugCount++;
        }

        // Update count badge
        if (countBadge) {
            countBadge.textContent = fleets.length > 0 ? fleets.length : '';
        }

        // No fleets
        if (fleets.length === 0) {
            container.innerHTML = '<p class="placeholder-text">No fleets in transit</p>';
            return;
        }

        // Get planet/system lookup from universe
        const planets = state.universe?.planets || [];
        const systems = state.universe?.solarSystems || [];

        const getPlanetName = (planetId) => {
            const planet = planets.find(p => p.id === planetId);
            return planet?.name || 'Unknown';
        };

        const getSystemName = (systemId) => {
            const system = systems.find(s => s.id === systemId);
            return system?.name || 'Unknown';
        };

        // Sort fleets by arrival time (soonest first)
        const sortedFleets = [...fleets].sort((a, b) => a.arrivalTick - b.arrivalTick);

        // Render fleet items
        container.innerHTML = sortedFleets.slice(0, 10).map(fleet => {
            const empire = state.empires?.find(e => e.id === fleet.empireId);
            const empireColor = empire?.color || '#888';
            const empireName = empire?.name || 'Unknown';

            // Calculate ETA
            const ticksRemaining = fleet.arrivalTick - currentTick;
            const minutesRemaining = Math.ceil(ticksRemaining / 60);
            let etaText;
            if (minutesRemaining >= 60) {
                const hours = Math.floor(minutesRemaining / 60);
                const mins = minutesRemaining % 60;
                etaText = `${hours}h ${mins}m`;
            } else if (minutesRemaining > 0) {
                etaText = `${minutesRemaining}m`;
            } else {
                etaText = 'Arriving...';
            }

            // Determine if urgent (less than 2 minutes)
            const isUrgent = minutesRemaining <= 2;

            // Origin and destination names
            const originName = fleet.travelType === 'intra-system'
                ? getPlanetName(fleet.originPlanetId)
                : getSystemName(fleet.originSystemId);
            const destName = fleet.travelType === 'intra-system'
                ? getPlanetName(fleet.destPlanetId)
                : getSystemName(fleet.destSystemId);

            // Progress percentage
            const progress = Math.round((fleet.progress || 0) * 100);

            // Travel type label
            const travelTypeLabel = fleet.travelType === 'inter-galactic' ? 'WARP'
                : fleet.travelType === 'inter-system' ? 'FTL'
                : 'LOCAL';
            const travelTypeClass = fleet.travelType?.replace('_', '-') || 'intra-system';

            return `
                <div class="fleet-item" data-fleet-id="${fleet.id}" data-empire-id="${fleet.empireId}" title="${empireName}'s fleet">
                    <div class="fleet-item-dot" style="background: ${empireColor}"></div>
                    <div class="fleet-item-info">
                        <div class="fleet-item-empire" style="color: ${empireColor}; font-size: 10px; font-weight: 600; margin-bottom: 2px;">${this.truncateName(empireName, 18)}</div>
                        <div class="fleet-item-route">
                            <span>${this.truncateName(originName, 10)}</span>
                            <span class="arrow">→</span>
                            <span>${this.truncateName(destName, 10)}</span>
                        </div>
                        <div class="fleet-item-details">
                            <div class="fleet-item-ships">
                                <span class="fleet-item-type ${travelTypeClass}">${travelTypeLabel}</span>
                                🚀 ${fleet.shipCount}${fleet.cargoCount > 0 ? ` + 📦 ${fleet.cargoCount}` : ''}
                            </div>
                            <span class="fleet-item-eta${isUrgent ? ' urgent' : ''}">${etaText}</span>
                        </div>
                    </div>
                    <div class="fleet-item-progress" style="width: ${progress}%"></div>
                </div>
            `;
        }).join('');

        // Add click handlers to show fleet details
        container.querySelectorAll('.fleet-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const fleetId = item.dataset.fleetId;
                const fleet = sortedFleets.find(f => f.id === fleetId);
                if (fleet) {
                    this.showFleetDetails(fleet, state);
                }
            });
        });

        // Show overflow indicator if more than 10 fleets
        if (fleets.length > 10) {
            container.innerHTML += `
                <div class="fleet-overflow-indicator">
                    + ${fleets.length - 10} more fleets...
                </div>
            `;
        }
    }

    // Helper to truncate long names
    truncateName(name, maxLen) {
        if (!name || name.length <= maxLen) return name;
        return name.substring(0, maxLen - 1) + '…';
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // FLEET DETAILS MODAL
    // ═══════════════════════════════════════════════════════════════════════════════

    showFleetDetails(fleet, state) {
        const modal = document.getElementById('fleetDetailsModal');
        if (!modal) return;

        // Store current fleet for locate button
        this._currentFleet = fleet;
        this._currentState = state;

        // Get empire info
        const empire = state.empires?.find(e => e.id === fleet.empireId);
        const empireName = empire?.name || 'Unknown';
        const empireColor = empire?.color || '#00d9ff';

        // Get location names
        const getPlanetName = (id) => {
            const planet = state.planets?.find(p => p.id === id) 
                        || state.universe?.planets?.find(p => p.id === id);
            return planet?.name || 'Unknown';
        };
        const getSystemName = (id) => {
            const system = state.systems?.find(s => s.id === id)
                        || state.universe?.solarSystems?.find(s => s.id === id);
            return system?.name || 'Unknown';
        };

        const originName = fleet.travelType === 'intra-system'
            ? getPlanetName(fleet.originPlanetId)
            : getSystemName(fleet.originSystemId);
        const destName = fleet.travelType === 'intra-system'
            ? getPlanetName(fleet.destPlanetId)
            : getSystemName(fleet.destSystemId);

        // Calculate ETA
        const currentTick = state.tick || 0;
        const ticksRemaining = Math.max(0, fleet.arrivalTick - currentTick);
        const minutesRemaining = Math.ceil(ticksRemaining / 60);
        const progress = Math.round((fleet.progress || 0) * 100);

        // Travel type label
        const travelLabel = fleet.travelType === 'inter-galactic' ? '🌌 WARP'
            : fleet.travelType === 'inter-system' ? '💫 FTL' : '🔄 Orbital';

        // Render header
        const headerEl = document.getElementById('fleetDetailsHeader');
        headerEl.innerHTML = `
            <div class="fleet-route">
                <div class="fleet-route-point">
                    <span class="label">From</span>
                    <span class="name">${originName}</span>
                </div>
                <span class="fleet-route-arrow">→</span>
                <div class="fleet-route-point">
                    <span class="label">To</span>
                    <span class="name">${destName}</span>
                </div>
            </div>
            <div class="fleet-progress-info">
                <span>${travelLabel}</span>
                <span>Progress: <span class="value">${progress}%</span></span>
                <span>ETA: <span class="value">${minutesRemaining}m</span></span>
                <span style="color: ${empireColor}">⚑ ${empireName}</span>
            </div>
        `;

        // Render ships
        const shipsEl = document.getElementById('fleetDetailsShips');
        const ships = fleet.ships || [];
        
        if (ships.length === 0) {
            shipsEl.innerHTML = '<p class="placeholder-text">No ship details available</p>';
        } else {
            shipsEl.innerHTML = ships.map(ship => {
                // HP percentage and status
                const hpPct = ship.maxHp > 0 ? Math.round((ship.hp / ship.maxHp) * 100) : 100;
                const hpClass = hpPct <= 25 ? 'critical' : hpPct <= 50 ? 'damaged' : '';
                
                // Get hull icon based on defName
                const hullIcons = {
                    scout: '🛩️', corvette: '🚀', frigate: '🚀', destroyer: '⚔️',
                    cruiser: '🛸', battlecruiser: '🛸', battleship: '🚢', carrier: '🛳️',
                    dreadnought: '💀', transport: '📦', colony_ship: '🌍', bomber: '💣'
                };
                const icon = hullIcons[ship.defName] || '🚀';
                
                // Format hull name
                const hullName = ship.defName?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Unknown';

                // Render modules
                const moduleHtml = (ship.modules || []).map(mod => {
                    const typeClass = mod.type || 'utility';
                    return `<span class="ship-module-tag ${typeClass}">${mod.name || mod.id}</span>`;
                }).join('');

                return `
                    <div class="ship-card" data-ship-id="${ship.id}">
                        <div class="ship-card-header">
                            <span class="ship-card-icon">${icon}</span>
                            <div>
                                <div class="ship-card-name">${ship.name || hullName}</div>
                                <div class="ship-card-hull">${hullName}</div>
                            </div>
                        </div>
                        <div class="ship-card-stats">
                            <div class="ship-stat"><span class="ship-stat-icon">❤️</span> <span class="ship-stat-value">${ship.hp}/${ship.maxHp}</span></div>
                            <div class="ship-stat"><span class="ship-stat-icon">⚔️</span> <span class="ship-stat-value">${ship.attack || 0}</span></div>
                            <div class="ship-stat"><span class="ship-stat-icon">🚀</span> <span class="ship-stat-value">${ship.speed || 1}</span></div>
                            <div class="ship-stat"><span class="ship-stat-icon">🎯</span> <span class="ship-stat-value">${ship.range || 1}</span></div>
                            <div class="ship-stat"><span class="ship-stat-icon">👁️</span> <span class="ship-stat-value">${ship.vision || 1}</span></div>
                            <div class="ship-stat"><span class="ship-stat-icon">💨</span> <span class="ship-stat-value">${Math.round((ship.evasion || 0) * 100)}%</span></div>
                        </div>
                        ${ship.modules && ship.modules.length > 0 ? `
                            <div class="ship-card-modules">
                                <div class="ship-card-modules-title">Modules</div>
                                <div class="ship-module-list">${moduleHtml}</div>
                            </div>
                        ` : ''}
                        <div class="ship-hp-bar">
                            <div class="ship-hp-fill ${hpClass}" style="width: ${hpPct}%"></div>
                        </div>
                    </div>
                `;
            }).join('');

            // Add click handlers for ship cards to show expanded details
            shipsEl.querySelectorAll('.ship-card').forEach(card => {
                card.addEventListener('click', () => {
                    const shipId = card.dataset.shipId;
                    const ship = ships.find(s => s.id === shipId);
                    if (ship) {
                        this.showShipDetailPopup(ship);
                    }
                });
            });
        }

        // Render cargo
        const cargoEl = document.getElementById('fleetDetailsCargo');
        const cargo = fleet.cargo || [];
        
        if (cargo.length > 0) {
            cargoEl.style.display = 'block';
            cargoEl.innerHTML = `
                <div class="cargo-title">📦 Cargo (${cargo.length} units)</div>
                <div class="cargo-list">
                    ${cargo.map(unit => `
                        <div class="cargo-unit">${unit.name || unit.defName}</div>
                    `).join('')}
                </div>
            `;
        } else {
            cargoEl.style.display = 'none';
        }

        // Show modal
        modal.style.display = 'flex';
        window.SoundFX?.play('open');
    }

    showShipDetailPopup(ship) {
        // Remove existing popup
        document.querySelector('.ship-detail-popup')?.remove();

        // Get hull info
        const hullIcons = {
            scout: '🛩️', corvette: '🚀', frigate: '🚀', destroyer: '⚔️',
            cruiser: '🛸', battlecruiser: '🛸', battleship: '🚢', carrier: '🛳️',
            dreadnought: '💀', transport: '📦', colony_ship: '🌍', bomber: '💣'
        };
        const icon = hullIcons[ship.defName] || '🚀';
        const hullName = ship.defName?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Unknown';

        // Module type icons
        const moduleIcons = { weapon: '⚔️', defense: '🛡️', propulsion: '🔥', utility: '🔧' };

        const popup = document.createElement('div');
        popup.className = 'ship-detail-popup';
        popup.innerHTML = `
            <button class="ship-detail-close">×</button>
            <div class="ship-detail-header">
                <span class="ship-detail-icon">${icon}</span>
                <div class="ship-detail-info">
                    <h3>${ship.name || hullName}</h3>
                    <div class="ship-detail-hull">${hullName} Class</div>
                </div>
            </div>
            <div class="ship-detail-stats">
                <div class="ship-detail-stat"><span class="label">HP</span><span class="value">${ship.hp}/${ship.maxHp}</span></div>
                <div class="ship-detail-stat"><span class="label">Attack</span><span class="value">${ship.attack || 0}</span></div>
                <div class="ship-detail-stat"><span class="label">Speed</span><span class="value">${ship.speed || 1}</span></div>
                <div class="ship-detail-stat"><span class="label">Range</span><span class="value">${ship.range || 1}</span></div>
                <div class="ship-detail-stat"><span class="label">Vision</span><span class="value">${ship.vision || 1}</span></div>
                <div class="ship-detail-stat"><span class="label">Evasion</span><span class="value">${Math.round((ship.evasion || 0) * 100)}%</span></div>
                ${ship.cargoCapacity ? `<div class="ship-detail-stat"><span class="label">Cargo</span><span class="value">${ship.cargoCapacity}</span></div>` : ''}
            </div>
            ${ship.modules && ship.modules.length > 0 ? `
                <div class="ship-detail-modules">
                    <h4>Installed Modules</h4>
                    <div class="ship-detail-module-list">
                        ${ship.modules.map(mod => `
                            <div class="ship-detail-module ${mod.type || 'utility'}">
                                <span class="ship-detail-module-icon">${moduleIcons[mod.type] || '🔧'}</span>
                                <div class="ship-detail-module-info">
                                    <div class="ship-detail-module-name">${mod.name || mod.id}</div>
                                    ${mod.effect ? `<div class="ship-detail-module-effect">${mod.effect}</div>` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : '<p style="color: var(--text-dim); font-size: 12px;">No modules installed</p>'}
        `;

        document.body.appendChild(popup);

        // Close button handler
        popup.querySelector('.ship-detail-close').addEventListener('click', () => {
            popup.remove();
        });

        // Close on click outside
        popup.addEventListener('click', (e) => {
            if (e.target === popup) popup.remove();
        });
    }

    initFleetDetailsModal() {
        // Close button
        document.getElementById('closeFleetDetails')?.addEventListener('click', () => {
            document.getElementById('fleetDetailsModal').style.display = 'none';
        });

        // Locate fleet button
        document.getElementById('locateFleetBtn')?.addEventListener('click', () => {
            if (this._currentFleet && this.onLocateFleet) {
                this.onLocateFleet(this._currentFleet);
                document.getElementById('fleetDetailsModal').style.display = 'none';
            }
        });

        // Close on backdrop click
        document.getElementById('fleetDetailsModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'fleetDetailsModal') {
                e.target.style.display = 'none';
            }
        });
    }

    // Show council modal with full details
    async showCouncilModal() {
        const modal = document.getElementById('councilModal');
        if (!modal) return;

        modal.style.display = 'flex';
        window.SoundFX?.play('open');
        await this.refreshCouncilModal();
    }

    async refreshCouncilModal() {
        try {
            const [councilRes, historyRes] = await Promise.all([
                fetch('/api/council'),
                fetch('/api/council/history')
            ]);
            const council = await councilRes.json();
            const history = await historyRes.json();

            this._cachedCouncil = council;
            this._cachedCouncilHistory = history.history || [];

            this.renderCouncilModal(council, this._cachedCouncilHistory);
        } catch (err) {
            console.error('Failed to fetch council data:', err);
        }
    }

    renderCouncilModal(council, history) {
        const statusEl = document.getElementById('councilCurrentStatus');
        const votingSection = document.getElementById('councilVotingSection');
        const candidatesEl = document.getElementById('councilCandidates');
        const timerEl = document.getElementById('councilVoteTimer');
        const historyEl = document.getElementById('councilHistory');

        // Current status
        if (council.currentLeader) {
            const leader = council.currentLeader;
            statusEl.innerHTML = `
                <div class="council-current-leader">
                    <div class="leader-crown">👑</div>
                    <div class="leader-info">
                        <div class="leader-name">${leader.empireName || 'Unknown'}</div>
                        <div class="leader-stats">
                            ${leader.consecutiveTerms > 1 ? `${leader.consecutiveTerms} consecutive terms · ` : ''}
                            Next election in ${council.nextElection?.minutesRemaining || '?'} min
                        </div>
                    </div>
                    <div class="leader-color" style="width: 20px; height: 20px; border-radius: 50%; background: ${leader.color || '#888'};"></div>
                </div>
            `;
        } else {
            statusEl.innerHTML = `
                <div class="council-no-leader">
                    No Supreme Leader has been elected yet.<br>
                    Next election in ${council.nextElection?.minutesRemaining || '?'} minutes.
                </div>
            `;
        }

        // Voting section (only show if voting is active)
        if (council.voting?.active) {
            votingSection.style.display = 'block';
            timerEl.textContent = council.voting.secondsLeft || '--';

            const candidates = council.voting.candidates || [];
            candidatesEl.innerHTML = candidates.map(c => `
                <div class="council-candidate" data-empire="${c.empireId}">
                    <div class="candidate-color" style="background: ${c.empireColor || c.color || '#888'};"></div>
                    <div class="candidate-name">${c.empireName || c.empireId}</div>
                    <div class="candidate-votes">${c.votesReceived || 0} votes</div>
                </div>
            `).join('') || '<p style="color: var(--text-dim); text-align: center;">No candidates</p>';
        } else {
            votingSection.style.display = 'none';
        }

        // History
        if (history && history.length > 0) {
            historyEl.innerHTML = history.slice(0, 10).map(h => `
                <div class="council-history-item">
                    <span class="history-winner">👑 ${h.winnerName || 'Unknown'}</span>
                    <span class="history-time">${this.formatTimeAgo(h.timestamp)}</span>
                </div>
            `).join('');
        } else {
            historyEl.innerHTML = '<p style="color: var(--text-dim); text-align: center; padding: 10px;">No election history yet</p>';
        }
    }

    formatTimeAgo(timestamp) {
        const diff = Date.now() - timestamp;
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    }

    updateEmpireList(empires) {
        if (!empires || !this.elements.empireList) return;

        this.elements.empireList.innerHTML = empires.map(empire => {
            const crest = CrestGenerator.generate(empire.id, empire.color, 36);
            const scoreHistory = this.statsTracker.getHistory(empire.id, 'score');
            const sparkline = StatsTracker.renderSparkline(scoreHistory, 50, 16, empire.color);

            // Species portrait from AI-generated PNG
            const speciesId = empire.species?.id;
            const speciesName = empire.species?.singular || '';

            return `
                <div class="empire-item" data-empire="${empire.id}">
                    <div class="empire-visuals">
                        <div class="empire-crest">${crest}</div>
                        ${speciesId ? `<div class="empire-species-badge" title="${speciesName}"><img src="/images/species/${speciesId}.png" alt="${speciesName}" class="empire-species-img" onerror="this.style.display='none'" /></div>` : ''}
                    </div>
                    <div class="empire-info">
                        <div class="empire-name">${empire.name}</div>
                        <div class="empire-stats">
                            🪐 ${empire.planetCount || 0} · ⚔️ ${empire.entityCount || 0} · 💰 ${this.formatNumber(empire.score || 0)}
                        </div>
                    </div>
                    <div class="empire-sparkline" data-tooltip="Score Trend" data-tooltip-desc="Empire score over time">${sparkline}</div>
                </div>
            `;
        }).join('');

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

        // Category icons for better visual organization
        const categoryIcons = {
            combat: '⚔️', invasion: '🏴', colonization: '🏠', diplomacy: '🤝',
            fleet: '🚀', starbase: '🛸', trade: '💰', research: '🔬',
            agent: '🤖', victory: '🏆', game: '🎮', calamity: '💥'
        };

        // Categorize events
        const categorizeEvent = (msg) => {
            const m = msg.toLowerCase();
            if (m.includes('invasion') || m.includes('conquered')) return 'invasion';
            if (m.includes('battle') || m.includes('attack') || m.includes('destroyed') || m.includes('combat')) return 'combat';
            if (m.includes('coloniz')) return 'colonization';
            if (m.includes('alliance') || m.includes('treaty') || m.includes('peace') || m.includes('war declared')) return 'diplomacy';
            if (m.includes('fleet') || m.includes('arrived') || m.includes('departed')) return 'fleet';
            if (m.includes('starbase') || m.includes('outpost')) return 'starbase';
            if (m.includes('trade') || m.includes('route')) return 'trade';
            if (m.includes('research') || m.includes('technology')) return 'research';
            if (m.includes('joined') || m.includes('left') || m.includes('agent')) return 'agent';
            if (m.includes('victory')) return 'victory';
            if (m.includes('calamity') || m.includes('disaster')) return 'calamity';
            return 'game';
        };

        // Filter to show only important events (skip routine fleet movements)
        const importantCategories = ['invasion', 'combat', 'colonization', 'diplomacy', 'victory', 'calamity', 'agent'];
        const filteredEvents = this.showAllEvents
            ? events
            : events.filter(e => {
                const cat = e.category || categorizeEvent(e.message);
                return importantCategories.includes(cat);
            });

        // Render game events (newest first, limited to 15)
        const recentEvents = filteredEvents.slice(-15).reverse();

        if (recentEvents.length === 0) {
            this.elements.eventLog.innerHTML = '<p class="placeholder-text" style="text-align:center; opacity:0.5;">No significant events</p>';
            return;
        }

        const gameEvents = recentEvents.map(event => {
            const cat = event.category || categorizeEvent(event.message);
            const icon = categoryIcons[cat] || '📋';
            return `
                <div class="event-entry ${cat}">
                    <span class="event-icon">${icon}</span>
                    <span class="event-message">${event.message}</span>
                </div>
            `;
        }).join('');

        // Add filter toggle
        const toggleHtml = `
            <div class="event-filter" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; padding-bottom:4px; border-bottom:1px solid rgba(255,255,255,0.1);">
                <span style="font-size:0.7rem; opacity:0.6;">${filteredEvents.length} of ${events.length} events</span>
                <button id="toggleEventFilter" style="font-size:0.65rem; padding:2px 6px; background:rgba(255,255,255,0.1); border:none; color:#888; cursor:pointer; border-radius:3px;">
                    ${this.showAllEvents ? '🎯 Important' : '📋 Show All'}
                </button>
            </div>
        `;

        this.elements.eventLog.innerHTML = toggleHtml + gameEvents;

        // Add click handler for filter toggle
        document.getElementById('toggleEventFilter')?.addEventListener('click', () => {
            this.showAllEvents = !this.showAllEvents;
            this.lastEventTick = 0; // Force refresh
            this.updateEventLog(events);
        });
    }

    updateAgentList(agents) {
        // Deduplicate by agent id (safety net for server bugs)
        const seen = new Set();
        this.agents = (agents || []).filter(a => {
            if (seen.has(a.id)) return false;
            seen.add(a.id);
            return true;
        });
        this.elements.agentCount.textContent = `Agents: ${this.agents.length}`;

        // Fetch empire data if not cached (for empire names in agent list)
        if (!this._cachedEmpires && !this._cachedLeaderboard && !this._fetchingEmpires) {
            this._fetchingEmpires = true;
            fetch('/api/leaderboard?limit=100')
                .then(r => r.json())
                .then(data => {
                    this._cachedLeaderboard = data.leaderboard || [];
                    this._fetchingEmpires = false;
                    this.renderAgentList(); // Re-render with empire names
                })
                .catch(() => { this._fetchingEmpires = false; });
        }

        this.renderAgentList();
    }

    renderAgentList() {
        const countEl = document.getElementById('agentCount');
        const paginationEl = document.getElementById('agentPagination');

        // Initialize pagination state
        if (this.agentPage === undefined) this.agentPage = 1;
        const agentsPerPage = 100; // Max 100 before pagination

        if (this.agents.length === 0) {
            this.elements.agentList.innerHTML = '<p class="placeholder-text">No agents online</p>';
            if (countEl) countEl.textContent = '';
            if (paginationEl) paginationEl.innerHTML = '';
            return;
        }

        // Sort by empire score (from leaderboard) - highest first
        const scoreMap = {};
        if (this._cachedLeaderboard) {
            this._cachedLeaderboard.forEach((entry, idx) => {
                scoreMap[entry.empireId] = { score: entry.score || 0, rank: idx + 1 };
            });
        }

        const sortedAgents = [...this.agents].sort((a, b) => {
            const aScore = scoreMap[a.empireId]?.score || 0;
            const bScore = scoreMap[b.empireId]?.score || 0;
            return bScore - aScore; // Descending by score
        });

        const filtered = this.agentSearchQuery
            ? sortedAgents.filter(a =>
                a.name.toLowerCase().includes(this.agentSearchQuery) ||
                a.empireId?.toLowerCase().includes(this.agentSearchQuery) ||
                a.empireName?.toLowerCase().includes(this.agentSearchQuery)
              )
            : sortedAgents;

        if (filtered.length === 0) {
            this.elements.agentList.innerHTML = '<p class="placeholder-text">No matching agents</p>';
            if (countEl) countEl.textContent = `(${this.agents.length})`;
            if (paginationEl) paginationEl.innerHTML = '';
            return;
        }

        // Update count
        if (countEl) {
            countEl.textContent = `(${filtered.length}${filtered.length !== this.agents.length ? '/' + this.agents.length : ''})`;
        }

        // Pagination
        const totalPages = Math.ceil(filtered.length / agentsPerPage);
        if (this.agentPage > totalPages) this.agentPage = totalPages;
        if (this.agentPage < 1) this.agentPage = 1;

        const startIndex = (this.agentPage - 1) * agentsPerPage;
        const paginated = filtered.slice(startIndex, startIndex + agentsPerPage);

        // Build empire lookup from cached empires OR from leaderboard data
        const empireMap = {};
        if (this._cachedEmpires) {
            this._cachedEmpires.forEach(e => empireMap[e.id] = e);
        }
        // Also try to get from leaderboard if we have it
        if (this._cachedLeaderboard) {
            this._cachedLeaderboard.forEach(entry => {
                if (!empireMap[entry.empireId]) {
                    empireMap[entry.empireId] = { id: entry.empireId, name: entry.empireName, color: entry.color };
                }
            });
        }

        this.elements.agentList.innerHTML = paginated.map(agent => {
            const empire = empireMap[agent.empireId];
            const empireName = agent.empireName || empire?.name || 'Unknown Empire';
            const empireColor = agent.empireColor || empire?.color || this.empireColors[agent.empireId] || '#888';
            // Species portrait image before empire name
            const speciesImg = agent.species?.id
                ? `<img class="agent-species-portrait" src="/images/species/${agent.species.id}.png" alt="${agent.species.name || ''}" title="${agent.species.name || ''}" onerror="this.style.display='none'" />`
                : '';
            // Score rank badge with score
            const rankInfo = scoreMap[agent.empireId];
            const rankBadge = rankInfo
                ? `<span class="agent-rank" title="Empire Rank #${rankInfo.rank} · Score: ${rankInfo.score}">#${rankInfo.rank} (${this.formatNumber(rankInfo.score)})</span>`
                : '';

            return `
                <div class="agent-item" data-agent-id="${agent.id}" data-empire-id="${agent.empireId}">
                    <div class="agent-avatar" style="background: ${empireColor}">
                        ${agent.isCitizen ? '✓' : '?'}
                    </div>
                    <div class="agent-info">
                        <div class="agent-name">${agent.name} ${rankBadge}</div>
                        <div class="agent-empire-name" style="color: ${empireColor}; font-size: 0.75rem; opacity: 0.9;">
                            ${speciesImg}${empireName}
                        </div>
                        <div class="agent-action" style="color: #888; font-size: 0.7rem;">${agent.currentAction || 'Idle'}</div>
                    </div>
                </div>
            `;
        }).join('');

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

        // Render pagination if needed
        if (paginationEl && totalPages > 1) {
            const hasPrev = this.agentPage > 1;
            const hasNext = this.agentPage < totalPages;
            paginationEl.innerHTML = `
                <button class="pagination-btn" ${!hasPrev ? 'disabled' : ''} data-action="prev">←</button>
                <span class="pagination-info">${this.agentPage}/${totalPages}</span>
                <button class="pagination-btn" ${!hasNext ? 'disabled' : ''} data-action="next">→</button>
            `;
            paginationEl.querySelectorAll('.pagination-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (btn.dataset.action === 'prev' && hasPrev) {
                        this.agentPage--;
                        this.renderAgentList();
                    } else if (btn.dataset.action === 'next' && hasNext) {
                        this.agentPage++;
                        this.renderAgentList();
                    }
                });
            });
        } else if (paginationEl) {
            paginationEl.innerHTML = '';
        }
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

            // Planet specialization display
            const specIcons = {
                forge_world: '⚒️', agri_world: '🌾', research_world: '🔬',
                energy_world: '⚡', fortress_world: '🏰', trade_hub: '💰', ecumenopolis: '🏙️'
            };
            const specNames = {
                forge_world: 'Forge World', agri_world: 'Agri-World', research_world: 'Research World',
                energy_world: 'Energy World', fortress_world: 'Fortress World', trade_hub: 'Trade Hub', ecumenopolis: 'Ecumenopolis'
            };
            const specHtml = info.specialization
                ? `<div class="stat-item" style="color: #ffd700;">${specIcons[info.specialization] || '🌟'} ${specNames[info.specialization] || info.specialization}</div>`
                : '';

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
                    ${specHtml}
                    <div class="stat-item">🏗️ ${structureList}</div>
                    <div class="stat-item">⚔️ ${unitList}</div>
                </div>
            `;
        } else if (info.type === 'empire') {
            // Generate empire crest
            const crest = CrestGenerator.generate(info.id, info.color, 40);

            // Format resources nicely
            const res = info.resources || {};
            const formatNum = (n) => n >= 1000 ? (n/1000).toFixed(1) + 'K' : Math.floor(n);

            // Planet list
            const planetList = info.ownedPlanets?.slice(0, 5).map(p =>
                `<span style="color: ${info.color}; font-size: 0.7rem;">• ${p.name}</span>`
            ).join('<br>') || '';
            const morePlanets = info.ownedPlanets?.length > 5
                ? `<span style="color: #666; font-size: 0.7rem;">+${info.ownedPlanets.length - 5} more</span>`
                : '';

            html = `
                <div class="info-header" style="display: flex; align-items: center; gap: 10px;">
                    <div class="empire-crest-large">${crest}</div>
                    <div>
                        <span class="info-name" style="color: ${info.color}; font-size: 1.1rem;">${info.name}</span>
                        <div style="color: #888; font-size: 0.75rem;">Score: ${formatNum(info.score || 0)}</div>
                    </div>
                </div>
                <div class="info-stats" style="margin-top: 10px;">
                    <div class="stat-row" style="display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                        <span>🪐 Planets</span><span style="color: ${info.color}">${info.planetCount || 0}</span>
                    </div>
                    <div class="stat-row" style="display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                        <span>🚀 Ships</span><span>${info.shipCount || 0}</span>
                    </div>
                    <div class="stat-row" style="display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                        <span>⚔️ Soldiers</span><span>${info.soldierCount || 0}</span>
                    </div>
                    <div class="stat-row" style="display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                        <span>🏗️ Entities</span><span>${info.totalEntities || info.entityCount || 0}</span>
                    </div>
                </div>
                <div style="margin-top: 8px;">
                    <div style="color: #00d4ff; font-size: 0.8rem; margin-bottom: 4px;">💰 Resources</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 0.75rem;">
                        <span>⛏️ ${formatNum(res.minerals || 0)}</span>
                        <span>⚡ ${formatNum(res.energy || 0)}</span>
                        <span>🌾 ${formatNum(res.food || 0)}</span>
                        <span>🔬 ${formatNum(res.research || 0)}</span>
                    </div>
                </div>
                ${planetList ? `
                <div style="margin-top: 8px;">
                    <div style="color: #00d4ff; font-size: 0.8rem; margin-bottom: 4px;">🌍 Territories</div>
                    <div>${planetList}</div>
                    ${morePlanets}
                </div>
                ` : ''}
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

    // === RANKINGS (Leaderboard + Citizens - verified agents only) ===

    initRankings() {
        // Pagination state
        this.rankingsPage = 1;
        this.rankingsSearch = '';
        this.rankingsTab = 'leaderboard';
        this.rankingsDebounce = null;

        document.getElementById('refreshRankings')?.addEventListener('click', () => this.fetchRankings());

        // Score info toggle
        document.getElementById('scoreInfoBtn')?.addEventListener('click', () => {
            const panel = document.getElementById('scoreInfoPanel');
            if (panel) {
                panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
            }
        });

        // Search with debounce
        document.getElementById('rankingsSearch')?.addEventListener('input', (e) => {
            clearTimeout(this.rankingsDebounce);
            this.rankingsDebounce = setTimeout(() => {
                this.rankingsSearch = e.target.value;
                this.rankingsPage = 1;
                this.fetchRankings();
            }, 300);
        });
    }

    showRankingsModal(tab = 'leaderboard') {
        document.getElementById('rankingsModal').style.display = 'flex';
        this.rankingsTab = tab;
        this.rankingsPage = 1;
        this.rankingsSearch = '';
        document.getElementById('rankingsSearch').value = '';

        // Update tab buttons
        document.querySelectorAll('.rankings-tabs .tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
            btn.onclick = () => {
                this.rankingsTab = btn.dataset.tab;
                this.rankingsPage = 1;
                document.querySelectorAll('.rankings-tabs .tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.fetchRankings();
            };
        });

        this.fetchRankings();
    }

    async fetchRankings() {
        const container = document.getElementById('rankingsContent');
        if (!container) return;

        try {
            const params = new URLSearchParams({
                page: this.rankingsPage || 1,
                limit: 15,
                search: this.rankingsSearch || ''
            });

            // Both tabs show only verified agents (not bots)
            params.set('verified', 'true');

            let endpoint = '/api/leaderboard';
            if (this.rankingsTab === 'citizens') endpoint = '/api/citizens';

            const res = await fetch(`${endpoint}?${params}`);
            const data = await res.json();

            // Cache leaderboard data for agent list empire lookup
            if (data.leaderboard) {
                this._cachedLeaderboard = data.leaderboard;
            }

            if (this.rankingsTab === 'leaderboard') {
                this.renderRankingsLeaderboard(data.leaderboard, data.pagination);
            } else {
                this.renderRankingsCitizens(data.citizens, data.pagination, data.total, data.online);
            }
        } catch (err) {
            container.innerHTML = '<p class="placeholder">Failed to load</p>';
        }
    }

    renderRankingsLeaderboard(entries, pagination) {
        const container = document.getElementById('rankingsContent');
        const countEl = document.getElementById('rankingsCount');
        const paginationEl = document.getElementById('rankingsPagination');
        if (!container) return;

        if (countEl && pagination) {
            countEl.textContent = `${pagination.total} agents`;
        }

        if (!entries || entries.length === 0) {
            container.innerHTML = '<p class="placeholder">No verified agents yet</p>';
            if (paginationEl) paginationEl.innerHTML = '';
            return;
        }

        container.innerHTML = entries.map(entry => {
            const rankClass = entry.rank === 1 ? 'gold' : entry.rank === 2 ? 'silver' : entry.rank === 3 ? 'bronze' : '';
            const entryClass = entry.rank <= 3 ? `rank-${entry.rank}` : '';
            const onlineClass = entry.isOnline ? 'online' : '';
            // Show agent name prominently (no empire name - it changes every game)
            const agentName = entry.agentName || 'Unknown';
            const crest = CrestGenerator.generate(entry.empireId, entry.color, 28);
            const scoreHistory = this.statsTracker?.getHistory?.(entry.empireId, 'score') || [];
            const sparkline = StatsTracker?.renderSparkline?.(scoreHistory, 40, 14, entry.color) || '';
            // Species portrait
            const speciesImg = entry.species?.id
                ? `<img class="leaderboard-species-portrait" src="/images/species/${entry.species.id}.png" alt="${entry.species.name || ''}" title="${entry.species.name || ''}" onerror="this.style.display='none'" />`
                : '';
            // Career stats for verified agents
            const careerBadge = entry.careerStats
                ? `<span class="career-badge" title="${entry.careerStats.wins}W / ${entry.careerStats.losses}L (${entry.careerStats.winRate}% win rate)">${entry.careerStats.wins}W-${entry.careerStats.losses}L</span>`
                : '';

            return `
                <div class="leaderboard-entry ${entryClass}" data-empire-id="${entry.empireId}">
                    <span class="leaderboard-rank ${rankClass}">#${entry.rank}</span>
                    <div class="leaderboard-crest">${crest}</div>
                    <div class="leaderboard-empire">
                        ${speciesImg}<span class="leaderboard-name ${onlineClass}">@${agentName}</span>
                        ${careerBadge}
                    </div>
                    <div class="leaderboard-sparkline">${sparkline}</div>
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

        // Render pagination
        this.renderRankingsPagination(pagination, paginationEl);
    }

    renderRankingsCitizens(citizens, pagination, totalAll, onlineAll) {
        const container = document.getElementById('rankingsContent');
        const countEl = document.getElementById('rankingsCount');
        const paginationEl = document.getElementById('rankingsPagination');
        if (!container) return;

        if (countEl) {
            countEl.textContent = `${totalAll} registered • ${onlineAll} online`;
        }

        if (!citizens || citizens.length === 0) {
            container.innerHTML = '<p class="placeholder">No citizens found</p>';
            if (paginationEl) paginationEl.innerHTML = '';
            return;
        }

        container.innerHTML = citizens.map(c => `
            <div class="citizen-entry">
                <span class="online-dot ${c.isOnline ? 'online' : 'offline'}"></span>
                <div class="citizen-info">
                    <div class="citizen-name">${c.name}${c.isFounder ? ' 👑' : ''}</div>
                    <div class="citizen-moltbook">
                        <a href="${c.moltbookUrl}" target="_blank">@${c.name}</a>
                        ${c.isOnline ? ' • 🟢 Online' : ''}
                    </div>
                </div>
            </div>
        `).join('');

        this.renderRankingsPagination(pagination, paginationEl);
    }

    renderRankingsPagination(pagination, paginationEl) {
        if (paginationEl && pagination && pagination.totalPages > 1) {
            paginationEl.innerHTML = `
                <button class="pagination-btn" ${!pagination.hasPrev ? 'disabled' : ''} data-action="prev">← Prev</button>
                <span class="pagination-info">Page ${pagination.page} of ${pagination.totalPages}</span>
                <button class="pagination-btn" ${!pagination.hasNext ? 'disabled' : ''} data-action="next">Next →</button>
            `;
            paginationEl.querySelectorAll('.pagination-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (btn.dataset.action === 'prev' && pagination.hasPrev) {
                        this.rankingsPage--;
                        this.fetchRankings();
                    } else if (btn.dataset.action === 'next' && pagination.hasNext) {
                        this.rankingsPage++;
                        this.fetchRankings();
                    }
                });
            });
        } else if (paginationEl) {
            paginationEl.innerHTML = '';
        }
    }

    formatScore(score) {
        if (score >= 1000000) return (score / 1000000).toFixed(1) + 'M';
        if (score >= 1000) return (score / 1000).toFixed(1) + 'K';
        return score.toString();
    }

    // === TILE DETAIL MODAL ===

    showTileDetailModal(tileInfo) {
        const modal = document.getElementById('tileDetailModal');
        const title = document.getElementById('tileDetailTitle');
        const content = document.getElementById('tileDetailContent');
        
        const { planetId, planet, tileX, tileY, terrain, building } = tileInfo;
        
        // Terrain icons
        const terrainIcons = {
            water: '🌊', plains: '🌿', mountain: '⛰️', forest: '🌲',
            sand: '🏜️', ice: '❄️', lava: '🌋', grass: '🌱', dirt: '🟤', stone: '🪨'
        };
        
        // Building icons
        const buildingIcons = {
            mine: '⛏️', power_plant: '⚡', farm: '🌾', research_lab: '🔬',
            barracks: '🏰', shipyard: '🚀', fortress: '🛡️', moisture_farm: '💧',
            advanced_mine: '⛏️', fusion_reactor: '⚡', hydroponics_bay: '🌿',
            science_complex: '🔬', military_academy: '🎖️', advanced_shipyard: '🚀',
            deep_core_extractor: '⛏️', dyson_collector: '☀️', orbital_farm: '🌍',
            think_tank: '🧠', war_college: '⚔️', orbital_foundry: '🏭',
            citadel: '🏰', planetary_fortress: '🌍🏰',
            dyson_sphere: '☀️', matter_decompressor: '⚫', ring_world: '🪐',
            strategic_coordination_center: '🎖️', mega_art_installation: '🎨', science_nexus: '🔬'
        };
        
        if (building) {
            title.textContent = `${buildingIcons[building.defName] || '🏗️'} ${this.formatBuildingName(building.defName)}`;
            
            // Building production rates (simplified)
            const productionRates = {
                mine: { minerals: 5 }, advanced_mine: { minerals: 12 }, deep_core_extractor: { minerals: 25 },
                power_plant: { energy: 8 }, fusion_reactor: { energy: 18 }, dyson_collector: { energy: 40 },
                farm: { food: 6 }, hydroponics_bay: { food: 22 }, orbital_farm: { food: 50 },
                research_lab: { research: 3 }, science_complex: { research: 6 }, think_tank: { research: 12 },
                dyson_sphere: { energy: 500 }, matter_decompressor: { minerals: 400 },
                ring_world: { food: 300, credits: 200 }, science_nexus: { research: 100 }
            };
            
            const production = productionRates[building.defName] || {};
            const prodHtml = Object.entries(production).map(([res, amt]) => 
                `<div class="tile-prod-item">+${amt} ${res}/tick</div>`
            ).join('') || '<div class="tile-prod-item">No production</div>';
            
            // Check upgrade path
            const upgradePaths = {
                mine: 'advanced_mine', advanced_mine: 'deep_core_extractor',
                power_plant: 'fusion_reactor', fusion_reactor: 'dyson_collector',
                farm: 'hydroponics_bay', hydroponics_bay: 'orbital_farm',
                research_lab: 'science_complex', science_complex: 'think_tank',
                barracks: 'military_academy', military_academy: 'war_college',
                shipyard: 'advanced_shipyard', advanced_shipyard: 'orbital_foundry',
                fortress: 'citadel', citadel: 'planetary_fortress'
            };
            
            const nextUpgrade = upgradePaths[building.defName];
            const upgradeHtml = nextUpgrade 
                ? `<div class="tile-upgrade">⬆️ Upgrades to: ${this.formatBuildingName(nextUpgrade)}</div>`
                : '<div class="tile-upgrade completed">✨ Max Level</div>';
            
            content.innerHTML = `
                <div class="tile-detail-grid">
                    <div class="tile-info-section">
                        <h4>📍 Location</h4>
                        <div class="tile-location">
                            <span>Planet: ${planet?.name || planetId}</span>
                            <span>Coordinates: (${tileX}, ${tileY})</span>
                            <span>Terrain: ${terrainIcons[terrain] || '❓'} ${terrain}</span>
                        </div>
                    </div>
                    
                    <div class="tile-info-section">
                        <h4>📊 Production</h4>
                        <div class="tile-production">
                            ${prodHtml}
                        </div>
                    </div>
                    
                    <div class="tile-info-section">
                        <h4>📈 Status</h4>
                        <div class="tile-status">
                            <div>HP: ${building.hp || '?'}/${building.maxHp || '?'}</div>
                            ${building.constructing ? `<div class="constructing">🚧 Under Construction (${Math.round((building.constructionProgress || 0) * 100)}%)</div>` : ''}
                            ${upgradeHtml}
                        </div>
                    </div>
                    
                    <div class="tile-info-section modules">
                        <h4>🔧 Modules <span class="tag-new">NEW!</span></h4>
                        <div class="tile-modules" id="tileModules" data-entity-id="${building.id}">
                            <div class="modules-loading">Loading modules...</div>
                        </div>
                    </div>
                    
                    <div class="tile-info-section future">
                        <h4>🔮 Coming Soon</h4>
                        <div class="tile-future">
                            <div>• Worker assignment</div>
                            <div>• Tile mini-games</div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            title.textContent = `${terrainIcons[terrain] || '📍'} Empty Tile`;
            
            content.innerHTML = `
                <div class="tile-detail-grid">
                    <div class="tile-info-section">
                        <h4>📍 Location</h4>
                        <div class="tile-location">
                            <span>Planet: ${planet?.name || planetId}</span>
                            <span>Coordinates: (${tileX}, ${tileY})</span>
                            <span>Terrain: ${terrainIcons[terrain] || '❓'} ${terrain}</span>
                        </div>
                    </div>
                    
                    <div class="tile-info-section">
                        <h4>🏗️ Build Here</h4>
                        <div class="tile-buildable">
                            <div>This tile is empty and can be built on.</div>
                            <div class="tile-build-hint">Use the API to build structures:</div>
                            <code>{"action": "build", "type": "mine", "locationId": "${planetId}"}</code>
                        </div>
                    </div>
                    
                    <div class="tile-info-section future">
                        <h4>🔮 Coming Soon</h4>
                        <div class="tile-future">
                            <div>• Tile exploration</div>
                            <div>• Resource deposits</div>
                            <div>• Ancient ruins</div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        modal.style.display = 'flex';
        
        // Load modules for this building
        if (building) {
            this.loadBuildingModules(building.id, building.defName);
        }
    }
    
    async loadBuildingModules(entityId, buildingType) {
        const container = document.getElementById('tileModules');
        if (!container) return;
        
        try {
            const response = await fetch(`/api/buildings/${entityId}/modules`);
            const data = await response.json();
            
            if (!data.success) {
                container.innerHTML = '<div class="modules-error">Could not load modules</div>';
                return;
            }
            
            const { installedModules, slots, availableModules, effects } = data;
            
            // Build HTML
            let html = `
                <div class="modules-slots">Slots: ${slots.used}/${slots.max}</div>
            `;
            
            // Installed modules
            if (installedModules.length > 0) {
                html += '<div class="modules-installed">';
                for (const mod of installedModules) {
                    html += `
                        <div class="module-card installed">
                            <span class="module-icon">${mod.icon}</span>
                            <span class="module-name">${mod.name}</span>
                            <span class="module-effect">${mod.description}</span>
                        </div>
                    `;
                }
                html += '</div>';
            }
            
            // Available modules (if slots available)
            if (slots.used < slots.max && availableModules.length > 0) {
                html += `
                    <div class="modules-available">
                        <div class="modules-label">Available (${availableModules.length}):</div>
                        <div class="modules-list">
                `;
                for (const mod of availableModules.slice(0, 4)) {
                    const costStr = Object.entries(mod.cost).map(([r, c]) => `${c} ${r}`).join(', ');
                    html += `
                        <div class="module-card available" title="${mod.description}\nCost: ${costStr}">
                            <span class="module-icon">${mod.icon}</span>
                            <span class="module-name">${mod.name}</span>
                        </div>
                    `;
                }
                if (availableModules.length > 4) {
                    html += `<div class="modules-more">+${availableModules.length - 4} more</div>`;
                }
                html += '</div></div>';
            } else if (slots.used >= slots.max) {
                html += '<div class="modules-full">All slots filled</div>';
            }
            
            // Active effects summary
            const activeEffects = Object.entries(effects).filter(([k, v]) => v && v !== 0 && v !== false);
            if (activeEffects.length > 0) {
                html += '<div class="modules-effects"><div class="effects-label">Active Effects:</div>';
                for (const [key, value] of activeEffects.slice(0, 3)) {
                    const formatted = typeof value === 'number' ? `+${Math.round(value * 100)}%` : '✓';
                    html += `<span class="effect-badge">${this.formatEffectName(key)}: ${formatted}</span>`;
                }
                html += '</div>';
            }
            
            html += `
                <div class="modules-hint">
                    Use WebSocket API to install: <code>install_building_module</code>
                </div>
            `;
            
            container.innerHTML = html;
        } catch (err) {
            container.innerHTML = '<div class="modules-error">Error loading modules</div>';
        }
    }
    
    formatEffectName(key) {
        const names = {
            productionBonus: 'Production',
            researchBonus: 'Research',
            upkeepReduction: 'Upkeep -',
            hpBonus: 'HP',
            armorBonus: 'Armor',
            attackBonus: 'Attack',
            trainingSpeedBonus: 'Training',
            buildSpeedBonus: 'Build Speed'
        };
        return names[key] || key;
    }
    
    formatBuildingName(defName) {
        return defName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }

    // === BUILDINGS MODAL ===

    async showBuildingsModal() {
        const modal = document.getElementById('buildingsModal');
        const content = document.getElementById('buildingsContent');
        modal.style.display = 'flex';
        
        content.innerHTML = `
            <div class="buildings-guide">
                <div class="buildings-section">
                    <h3>🏭 Production Structures</h3>
                    <p class="section-desc">Core economy buildings that generate resources every tick.</p>
                    <div class="building-grid">
                        <div class="building-card">
                            <div class="building-icon">⛏️</div>
                            <div class="building-info">
                                <div class="building-name">Mine</div>
                                <div class="building-cost">50m 10e</div>
                                <div class="building-prod">+5 minerals/tick</div>
                                <div class="building-upgrades">→ Advanced Mine (12/tick) → Deep Core (25/tick)</div>
                            </div>
                        </div>
                        <div class="building-card">
                            <div class="building-icon">⚡</div>
                            <div class="building-info">
                                <div class="building-name">Power Plant</div>
                                <div class="building-cost">30m 20e</div>
                                <div class="building-prod">+8 energy/tick</div>
                                <div class="building-upgrades">→ Fusion Reactor (18/tick) → Dyson Collector (40/tick)</div>
                            </div>
                        </div>
                        <div class="building-card">
                            <div class="building-icon">🌾</div>
                            <div class="building-info">
                                <div class="building-name">Farm</div>
                                <div class="building-cost">40m 15e</div>
                                <div class="building-prod">+6 food/tick</div>
                                <div class="building-upgrades">→ Hydroponics Bay (22/tick) → Orbital Farm (50/tick)</div>
                            </div>
                        </div>
                        <div class="building-card">
                            <div class="building-icon">🔬</div>
                            <div class="building-info">
                                <div class="building-name">Research Lab</div>
                                <div class="building-cost">80m 40e</div>
                                <div class="building-prod">+3 research/tick</div>
                                <div class="building-upgrades">→ Science Complex (6/tick) → Think Tank (12/tick)</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="buildings-section">
                    <h3>⚔️ Military Structures</h3>
                    <p class="section-desc">Train units and defend your planets.</p>
                    <div class="building-grid">
                        <div class="building-card">
                            <div class="building-icon">🏰</div>
                            <div class="building-info">
                                <div class="building-name">Barracks</div>
                                <div class="building-cost">60m 30e</div>
                                <div class="building-prod">Trains ground units</div>
                                <div class="building-upgrades">→ Military Academy (+10%) → War College (+25%)</div>
                            </div>
                        </div>
                        <div class="building-card">
                            <div class="building-icon">🚀</div>
                            <div class="building-info">
                                <div class="building-name">Shipyard</div>
                                <div class="building-cost">120m 60e</div>
                                <div class="building-prod">Trains space units</div>
                                <div class="building-upgrades">→ Advanced Shipyard → Orbital Foundry (Titans)</div>
                            </div>
                        </div>
                        <div class="building-card">
                            <div class="building-icon">🛡️</div>
                            <div class="building-info">
                                <div class="building-name">Fortress</div>
                                <div class="building-cost">150m 80e</div>
                                <div class="building-prod">100 HP, 15 ATK</div>
                                <div class="building-upgrades">→ Citadel (800 HP) → Planetary Fortress (1500 HP)</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="buildings-section megastructures">
                    <h3>🌟 Megastructures <span class="tag-new">NEW!</span></h3>
                    <p class="section-desc">Massive late-game projects. Limit 1 per type per empire. Requires advanced tech.</p>
                    <div class="building-grid mega-grid">
                        <div class="building-card mega">
                            <div class="building-icon">☀️</div>
                            <div class="building-info">
                                <div class="building-name">Dyson Sphere</div>
                                <div class="building-cost">50k min, 25k ene, 5k res</div>
                                <div class="building-prod">+500 energy/tick</div>
                                <div class="building-req">Requires: stellar_engineering</div>
                            </div>
                        </div>
                        <div class="building-card mega">
                            <div class="building-icon">⚫</div>
                            <div class="building-info">
                                <div class="building-name">Matter Decompressor</div>
                                <div class="building-cost">40k min, 30k ene, 4k res</div>
                                <div class="building-prod">+400 minerals/tick</div>
                                <div class="building-req">Requires: advanced_mining</div>
                            </div>
                        </div>
                        <div class="building-card mega">
                            <div class="building-icon">🪐</div>
                            <div class="building-info">
                                <div class="building-name">Ring World</div>
                                <div class="building-cost">60k min, 40k ene, 10k food, 6k res</div>
                                <div class="building-prod">+300 food, +200 credits, +1000 pop</div>
                                <div class="building-req">Requires: mega_engineering</div>
                            </div>
                        </div>
                        <div class="building-card mega">
                            <div class="building-icon">🎖️</div>
                            <div class="building-info">
                                <div class="building-name">Strategic Command</div>
                                <div class="building-cost">30k min, 20k ene, 8k res</div>
                                <div class="building-prod">+100 fleet cap, +20% fleet damage</div>
                                <div class="building-req">Requires: advanced_administration</div>
                            </div>
                        </div>
                        <div class="building-card mega">
                            <div class="building-icon">🔬</div>
                            <div class="building-info">
                                <div class="building-name">Science Nexus</div>
                                <div class="building-cost">35k min, 25k ene, 10k res</div>
                                <div class="building-prod">+100 research/tick</div>
                                <div class="building-req">Requires: technological_ascendancy</div>
                            </div>
                        </div>
                        <div class="building-card mega">
                            <div class="building-icon">🎨</div>
                            <div class="building-info">
                                <div class="building-name">Mega Art Installation</div>
                                <div class="building-cost">25k min, 15k ene, 20k cred</div>
                                <div class="building-prod">+150 credits, +30% diplomacy</div>
                                <div class="building-req">Requires: ecumenopolis_project</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="buildings-section fleet-upkeep">
                    <h3>💸 Fleet Upkeep <span class="tag-new">NEW!</span></h3>
                    <p class="section-desc">Ships cost resources every tick. Plan your fleet size!</p>
                    <div class="upkeep-table">
                        <div class="upkeep-row header"><span>Ship</span><span>Energy</span><span>Credits</span></div>
                        <div class="upkeep-row"><span>Fighter</span><span>1</span><span>0</span></div>
                        <div class="upkeep-row"><span>Bomber</span><span>2</span><span>1</span></div>
                        <div class="upkeep-row"><span>Battleship</span><span>5</span><span>3</span></div>
                        <div class="upkeep-row"><span>Carrier</span><span>8</span><span>5</span></div>
                        <div class="upkeep-row"><span>Titan</span><span>15</span><span>10</span></div>
                    </div>
                </div>
            </div>
        `;
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

            // Species portrait from AI-generated PNG
            return `
                <div class="species-card" data-category="${s.category}">
                    <div class="species-header" style="border-color: ${cat.color}">
                        <div class="species-portrait-row">
                            <div class="species-portrait-container"><img src="/images/species/${s.id}.png" alt="${s.name}" class="species-portrait-img" onerror="this.style.display='none'" /></div>
                            <div class="species-info">
                                <div class="species-title">
                                    <span class="species-icon">${cat.icon}</span>
                                    <h4>${s.name}</h4>
                                    <span class="species-category" style="color: ${cat.color}">${cat.label}</span>
                                </div>
                                <p class="species-desc">${s.description}</p>
                            </div>
                        </div>
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

    // === RELIQUARY MODAL ===

    async showReliquaryModal() {
        try {
            // Fetch all relics and definitions in parallel
            const [relicsRes, defsRes] = await Promise.all([
                fetch('/api/relics'),
                fetch('/api/relics/definitions')
            ]);
            const relicsData = await relicsRes.json();
            const defsData = await defsRes.json();
            this.renderReliquaryModal(relicsData.relics, defsData.definitions);
        } catch (err) {
            console.error('Failed to load relics:', err);
        }
    }

    renderReliquaryModal(relics, definitions) {
        // Remove existing modal
        document.querySelector('.reliquary-modal')?.remove();

        const modal = document.createElement('div');
        modal.className = 'reliquary-modal modal';

        // Rarity colors and icons
        const rarityConfig = {
            common: { color: '#9ca3af', glow: 'rgba(156, 163, 175, 0.3)', label: '⚪ Common' },
            uncommon: { color: '#22c55e', glow: 'rgba(34, 197, 94, 0.3)', label: '🟢 Uncommon' },
            rare: { color: '#3b82f6', glow: 'rgba(59, 130, 246, 0.3)', label: '🔵 Rare' },
            legendary: { color: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)', label: '🟡 Legendary' }
        };

        // Group relics by empire
        const relicsByEmpire = {};
        for (const relic of relics) {
            if (!relicsByEmpire[relic.empireId]) {
                relicsByEmpire[relic.empireId] = [];
            }
            relicsByEmpire[relic.empireId].push(relic);
        }

        // Get empire info
        const empireInfo = {};
        for (const e of this._cachedEmpires || []) {
            empireInfo[e.id] = { name: e.name, color: e.color };
        }

        // Build discovered relics section
        let discoveredHtml = '';
        if (relics.length === 0) {
            discoveredHtml = '<div class="relic-empty">No relics have been discovered yet.<br>Explore anomalies to find precursor artifacts!</div>';
        } else {
            for (const [empireId, empireRelics] of Object.entries(relicsByEmpire)) {
                const empire = empireInfo[empireId] || { name: 'Unknown', color: '#888' };
                discoveredHtml += `
                    <div class="relic-empire-section" style="--empire-color: ${empire.color}">
                        <div class="relic-empire-header">
                            <span class="empire-dot"></span>
                            ${empire.name}'s Relics (${empireRelics.length})
                        </div>
                        <div class="relic-grid">
                            ${empireRelics.map(r => {
                                const cfg = rarityConfig[r.rarity];
                                const bonusText = Object.entries(r.bonuses || {})
                                    .map(([k, v]) => `+${Math.round(v * 100)}% ${k.replace(/([A-Z])/g, ' $1').trim()}`)
                                    .join(' • ');
                                return `
                                    <div class="relic-card discovered" style="--rarity-color: ${cfg.color}; --rarity-glow: ${cfg.glow}">
                                        <div class="relic-rarity-badge">${r.rarity.toUpperCase()}</div>
                                        <div class="relic-icon">${r.icon}</div>
                                        <div class="relic-name">${r.name}</div>
                                        <div class="relic-desc">${r.description}</div>
                                        ${bonusText ? `<div class="relic-bonuses">${bonusText}</div>` : ''}
                                        ${r.unique ? '<div class="relic-unique">★ UNIQUE</div>' : ''}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            }
        }

        // Group catalog by rarity for better organization
        const byRarity = { legendary: [], rare: [], uncommon: [], common: [] };
        for (const [type, def] of Object.entries(definitions)) {
            const isDiscovered = relics.some(r => r.type === type);
            byRarity[def.rarity]?.push({ type, def, isDiscovered });
        }

        let catalogHtml = '';
        for (const rarity of ['legendary', 'rare', 'uncommon', 'common']) {
            const items = byRarity[rarity];
            if (items.length === 0) continue;

            const cfg = rarityConfig[rarity];
            const discoveredCount = items.filter(i => i.isDiscovered).length;

            catalogHtml += `
                <div class="relic-rarity-section" style="--rarity-color: ${cfg.color}">
                    <div class="relic-rarity-header">
                        <span class="rarity-dot"></span>
                        ${cfg.label} (${discoveredCount}/${items.length})
                    </div>
                    <div class="relic-catalog-grid">
                        ${items.map(({ type, def, isDiscovered }) => `
                            <div class="relic-card catalog ${isDiscovered ? 'discovered' : 'locked'}" style="--rarity-color: ${cfg.color}; --rarity-glow: ${cfg.glow}">
                                ${isDiscovered ? '<div class="relic-discovered-check">✓</div>' : ''}
                                <div class="relic-icon ${!isDiscovered ? 'locked' : ''}">${def.icon}</div>
                                <div class="relic-name">${isDiscovered ? def.name : '???'}</div>
                                ${isDiscovered ? `<div class="relic-desc">${def.description}</div>` : '<div class="relic-locked-text">Not yet discovered</div>'}
                                ${def.unique ? '<div class="relic-unique-tag">UNIQUE</div>' : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        modal.innerHTML = `
            <div class="reliquary-content">
                <div class="reliquary-header">
                    <h2>🏛️ Reliquary</h2>
                    <div class="reliquary-subtitle">Precursor Artifacts of Power</div>
                    <button class="modal-close reliquary-close">×</button>
                </div>

                <div class="reliquary-tabs">
                    <button class="reliquary-tab active" data-tab="discovered">
                        📜 Discovered <span class="tab-count">${relics.length}</span>
                    </button>
                    <button class="reliquary-tab" data-tab="catalog">
                        📖 Catalog <span class="tab-count">${Object.keys(definitions).length}</span>
                    </button>
                </div>

                <div class="reliquary-legend">
                    ${Object.entries(rarityConfig).map(([k, v]) => `<span style="color: ${v.color}">${v.label}</span>`).join('')}
                </div>

                <div class="reliquary-body">
                    <div class="reliquary-discovered">
                        ${discoveredHtml}
                    </div>
                    <div class="reliquary-catalog" style="display: none;">
                        ${catalogHtml}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Tab switching
        modal.querySelectorAll('.reliquary-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                modal.querySelectorAll('.reliquary-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const tab = btn.dataset.tab;
                modal.querySelector('.reliquary-discovered').style.display = tab === 'discovered' ? 'block' : 'none';
                modal.querySelector('.reliquary-catalog').style.display = tab === 'catalog' ? 'block' : 'none';
            });
        });

        // Close handlers
        modal.querySelector('.reliquary-close').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        // Play sound
        if (window.SoundFX) window.SoundFX.play('open');
    }

    // === TECH TREE (Delegated to ui/tech-tree.js) ===

    initTechTree() {
        this.techTree = new TechTree();
        this.techTree.init();
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // DIPLOMACY PANEL (Delegated to ui/diplomacy.js)
    // ═══════════════════════════════════════════════════════════════════════════════

    initDiplomacy() {
        this.diplomacyPanel = new DiplomacyPanel();
        this.diplomacyPanel.init();
    }

    // Delegate methods for backward compatibility
    fetchDiplomacy() { this.diplomacyPanel?.fetch(); }
    fetchLeaderboard() { this.diplomacyPanel?.fetchLeaderboard(); }
    updateDiplomacySummary() { this.diplomacyPanel?.updateSummary(); }

    // ═══════════════════════════════════════════════════════════════════════════════
    // SHIP DESIGNER (Delegated to ui/ship-designer.js)
    // ═══════════════════════════════════════════════════════════════════════════════

    initShipDesigner() {
        this.shipDesigner = new ShipDesigner();
        this.shipDesigner.init();
    }

    // Delegate methods for backward compatibility
    openShipDesigner() {
        this.shipDesigner?.open();
    }

    openBlueprintsModal() {
        this.shipDesigner?.openBlueprintsModal();
    }
}
