// UI Manager for Clawdistan observer interface

// ═══════════════════════════════════════════════════════════════════════════════
// EMPIRE CREST GENERATOR - Procedural SVG emblems
// ═══════════════════════════════════════════════════════════════════════════════
export class CrestGenerator {
    // Shape library for crest elements
    static shapes = {
        shields: [
            'M25,5 L45,15 L45,35 Q45,50 25,55 Q5,50 5,35 L5,15 Z',  // Classic shield
            'M25,5 L45,20 L45,40 L25,55 L5,40 L5,20 Z',              // Hexagonal
            'M25,5 L50,30 L25,55 L0,30 Z',                           // Diamond
            'M5,10 L45,10 L45,45 Q25,55 5,45 Z',                     // Banner
            'M25,5 Q50,5 50,30 Q50,55 25,55 Q0,55 0,30 Q0,5 25,5 Z', // Oval
        ],
        symbols: [
            // Star
            (cx, cy, s) => `M${cx},${cy-s} L${cx+s*0.3},${cy-s*0.3} L${cx+s},${cy} L${cx+s*0.3},${cy+s*0.3} L${cx},${cy+s} L${cx-s*0.3},${cy+s*0.3} L${cx-s},${cy} L${cx-s*0.3},${cy-s*0.3} Z`,
            // Cross
            (cx, cy, s) => `M${cx-s*0.2},${cy-s} L${cx+s*0.2},${cy-s} L${cx+s*0.2},${cy-s*0.2} L${cx+s},${cy-s*0.2} L${cx+s},${cy+s*0.2} L${cx+s*0.2},${cy+s*0.2} L${cx+s*0.2},${cy+s} L${cx-s*0.2},${cy+s} L${cx-s*0.2},${cy+s*0.2} L${cx-s},${cy+s*0.2} L${cx-s},${cy-s*0.2} L${cx-s*0.2},${cy-s*0.2} Z`,
            // Triangle
            (cx, cy, s) => `M${cx},${cy-s} L${cx+s},${cy+s*0.7} L${cx-s},${cy+s*0.7} Z`,
            // Circle (approximated)
            (cx, cy, s) => `M${cx},${cy-s} A${s},${s} 0 1,1 ${cx},${cy+s} A${s},${s} 0 1,1 ${cx},${cy-s} Z`,
            // Lightning
            (cx, cy, s) => `M${cx+s*0.3},${cy-s} L${cx-s*0.2},${cy} L${cx+s*0.2},${cy} L${cx-s*0.3},${cy+s} L${cx+s*0.1},${cy+s*0.1} L${cx-s*0.1},${cy+s*0.1} Z`,
            // Chevron
            (cx, cy, s) => `M${cx-s},${cy-s*0.5} L${cx},${cy+s*0.3} L${cx+s},${cy-s*0.5} L${cx+s},${cy} L${cx},${cy+s*0.8} L${cx-s},${cy} Z`,
        ],
        accents: [
            // Top crown points
            (cx, cy, s) => `M${cx-s*0.6},${cy-s*0.8} L${cx-s*0.4},${cy-s*0.5} L${cx},${cy-s*0.9} L${cx+s*0.4},${cy-s*0.5} L${cx+s*0.6},${cy-s*0.8}`,
            // Side wings
            (cx, cy, s) => `M${cx-s},${cy} Q${cx-s*1.3},${cy-s*0.5} ${cx-s*0.8},${cy-s} M${cx+s},${cy} Q${cx+s*1.3},${cy-s*0.5} ${cx+s*0.8},${cy-s}`,
            // Bottom flourish
            (cx, cy, s) => `M${cx-s*0.5},${cy+s*0.8} Q${cx},${cy+s*1.2} ${cx+s*0.5},${cy+s*0.8}`,
        ]
    };

    // Seeded random for consistent crests
    static seededRandom(seed) {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    }

    // Hash string to number
    static hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }

    // Parse color to RGB
    static parseColor(color) {
        const hex = color.replace('#', '');
        return {
            r: parseInt(hex.substr(0, 2), 16),
            g: parseInt(hex.substr(2, 2), 16),
            b: parseInt(hex.substr(4, 2), 16)
        };
    }

    // Darken/lighten color
    static shadeColor(color, percent) {
        const { r, g, b } = this.parseColor(color);
        const shade = (c) => Math.min(255, Math.max(0, Math.round(c * (1 + percent))));
        return `rgb(${shade(r)}, ${shade(g)}, ${shade(b)})`;
    }

    // Generate SVG crest for an empire
    static generate(empireId, color, size = 50) {
        const seed = this.hashCode(empireId);
        const rand = (n) => this.seededRandom(seed + n);
        
        // Select elements based on seed
        const shieldIdx = Math.floor(rand(1) * this.shapes.shields.length);
        const symbolIdx = Math.floor(rand(2) * this.shapes.symbols.length);
        const hasAccent = rand(3) > 0.5;
        const accentIdx = Math.floor(rand(4) * this.shapes.accents.length);
        
        // Colors
        const primary = color;
        const secondary = this.shadeColor(color, -0.3);
        const highlight = this.shadeColor(color, 0.4);
        const dark = this.shadeColor(color, -0.5);
        
        // Get paths
        const shield = this.shapes.shields[shieldIdx];
        const symbol = this.shapes.symbols[symbolIdx](25, 30, 10);
        
        // Build SVG
        let svg = `<svg viewBox="0 0 50 60" width="${size}" height="${size * 1.2}" xmlns="http://www.w3.org/2000/svg">`;
        
        // Definitions for gradients
        svg += `<defs>
            <linearGradient id="crest-grad-${empireId}" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:${highlight}"/>
                <stop offset="50%" style="stop-color:${primary}"/>
                <stop offset="100%" style="stop-color:${secondary}"/>
            </linearGradient>
            <filter id="crest-shadow-${empireId}">
                <feDropShadow dx="1" dy="2" stdDeviation="1" flood-opacity="0.3"/>
            </filter>
        </defs>`;
        
        // Shield background
        svg += `<path d="${shield}" fill="url(#crest-grad-${empireId})" stroke="${dark}" stroke-width="1.5" filter="url(#crest-shadow-${empireId})"/>`;
        
        // Inner border
        svg += `<path d="${shield}" fill="none" stroke="${highlight}" stroke-width="0.5" transform="translate(2,2) scale(0.92)"/>`;
        
        // Symbol
        svg += `<path d="${symbol}" fill="${dark}" opacity="0.8"/>`;
        svg += `<path d="${symbol}" fill="none" stroke="${highlight}" stroke-width="0.5" transform="translate(-0.5,-0.5)"/>`;
        
        // Optional accent
        if (hasAccent) {
            const accent = this.shapes.accents[accentIdx](25, 30, 12);
            svg += `<path d="${accent}" fill="none" stroke="${highlight}" stroke-width="1" stroke-linecap="round"/>`;
        }
        
        svg += '</svg>';
        return svg;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATS HISTORY TRACKER - Track empire metrics over time
// ═══════════════════════════════════════════════════════════════════════════════
export class StatsTracker {
    constructor(maxHistory = 50) {
        this.maxHistory = maxHistory;
        this.history = {}; // empireId -> { score: [], population: [], planets: [] }
        this.lastTick = 0;
        this.sampleInterval = 10; // Sample every N ticks
    }

    // Record stats for all empires
    record(tick, empires) {
        if (!empires || tick - this.lastTick < this.sampleInterval) return;
        this.lastTick = tick;

        for (const empire of empires) {
            if (!this.history[empire.id]) {
                this.history[empire.id] = { score: [], population: [], planets: [], resources: [] };
            }
            
            const h = this.history[empire.id];
            const totalResources = (empire.resources?.minerals || 0) + 
                                   (empire.resources?.energy || 0) + 
                                   (empire.resources?.food || 0);
            
            h.score.push(empire.score || 0);
            h.population.push(empire.resources?.population || 0);
            h.planets.push(empire.planetCount || 0);
            h.resources.push(totalResources);
            
            // Trim old data
            if (h.score.length > this.maxHistory) {
                h.score.shift();
                h.population.shift();
                h.planets.shift();
                h.resources.shift();
            }
        }
    }

    // Get history for an empire
    getHistory(empireId, metric = 'score') {
        return this.history[empireId]?.[metric] || [];
    }

    // Render a sparkline SVG
    static renderSparkline(data, width = 60, height = 20, color = '#00d4ff') {
        if (!data || data.length < 2) {
            return `<svg width="${width}" height="${height}"><text x="50%" y="50%" text-anchor="middle" fill="#666" font-size="8">No data</text></svg>`;
        }

        const min = Math.min(...data);
        const max = Math.max(...data);
        const range = max - min || 1;
        
        const points = data.map((v, i) => {
            const x = (i / (data.length - 1)) * (width - 4) + 2;
            const y = height - 2 - ((v - min) / range) * (height - 4);
            return `${x},${y}`;
        }).join(' ');

        const lastY = height - 2 - ((data[data.length - 1] - min) / range) * (height - 4);
        const trend = data[data.length - 1] > data[0] ? '↑' : data[data.length - 1] < data[0] ? '↓' : '→';
        const trendColor = trend === '↑' ? '#4ade80' : trend === '↓' ? '#f43f5e' : '#888';

        return `<svg width="${width}" height="${height}" class="sparkline">
            <defs>
                <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="${color}" stop-opacity="0.3"/>
                    <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
                </linearGradient>
            </defs>
            <polygon points="2,${height-2} ${points} ${width-2},${height-2}" fill="url(#spark-fill)"/>
            <polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="${width - 2}" cy="${lastY}" r="2" fill="${color}"/>
            <text x="${width + 2}" y="${height/2 + 3}" fill="${trendColor}" font-size="10" font-weight="bold">${trend}</text>
        </svg>`;
    }
}

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

    // Show a toast notification (DISABLED - using event log instead)
    show({ category = 'game', message, detail = '', tick = null, duration = null }) {
        return; // Toast popups disabled - event log is sufficient
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
        this.statsTracker = new StatsTracker(50); // Track last 50 samples
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
        document.getElementById('closeRankings')?.addEventListener('click', () => {
            document.getElementById('rankingsModal').style.display = 'none';
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
        this.updateResourceBar(state);
        this.updateCouncilStatus(state.council);
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

    updateEmpireList(empires) {
        if (!empires || !this.elements.empireList) return;

        this.elements.empireList.innerHTML = empires.map(empire => {
            const crest = CrestGenerator.generate(empire.id, empire.color, 36);
            const scoreHistory = this.statsTracker.getHistory(empire.id, 'score');
            const sparkline = StatsTracker.renderSparkline(scoreHistory, 50, 16, empire.color);
            
            return `
                <div class="empire-item" data-empire="${empire.id}">
                    <div class="empire-crest">${crest}</div>
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
        this.agents = agents || [];
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
        const agentsPerPage = 15;
        
        if (this.agents.length === 0) {
            this.elements.agentList.innerHTML = '<p class="placeholder-text">No agents online</p>';
            if (countEl) countEl.textContent = '';
            if (paginationEl) paginationEl.innerHTML = '';
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
            const empireName = empire?.name || 'Unknown Empire';
            const empireColor = empire?.color || this.empireColors[agent.empireId] || '#888';
            
            return `
                <div class="agent-item" data-agent-id="${agent.id}" data-empire-id="${agent.empireId}">
                    <div class="agent-avatar" style="background: ${empireColor}">
                        ${agent.isCitizen ? '✓' : '?'}
                    </div>
                    <div class="agent-info">
                        <div class="agent-name">${agent.name}</div>
                        <div class="agent-empire-name" style="color: ${empireColor}; font-size: 0.75rem; opacity: 0.9;">${empireName}</div>
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

    // === RANKINGS (Consolidated: Leaderboard + Citizens + Empires) ===
    
    initRankings() {
        // Pagination state
        this.rankingsPage = 1;
        this.rankingsSearch = '';
        this.rankingsTab = 'leaderboard';
        this.rankingsDebounce = null;
        
        document.getElementById('refreshRankings')?.addEventListener('click', () => this.fetchRankings());
        
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
            } else if (this.rankingsTab === 'citizens') {
                this.renderRankingsCitizens(data.citizens, data.pagination, data.total, data.online);
            } else {
                this.renderRankingsEmpires(data.leaderboard, data.pagination);
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
            countEl.textContent = `${pagination.total} empires`;
        }
        
        if (!entries || entries.length === 0) {
            container.innerHTML = '<p class="placeholder">No empires found</p>';
            if (paginationEl) paginationEl.innerHTML = '';
            return;
        }

        container.innerHTML = entries.map(entry => {
            const rankClass = entry.rank === 1 ? 'gold' : entry.rank === 2 ? 'silver' : entry.rank === 3 ? 'bronze' : '';
            const entryClass = entry.rank <= 3 ? `rank-${entry.rank}` : '';
            const onlineClass = entry.isOnline ? 'online' : '';
            const agentDisplay = entry.agentName 
                ? `<span class="leaderboard-agent ${onlineClass}">@${entry.agentName}</span>` 
                : '';
            const crest = CrestGenerator.generate(entry.empireId, entry.color, 28);
            const scoreHistory = this.statsTracker?.getHistory?.(entry.empireId, 'score') || [];
            const sparkline = StatsTracker?.renderSparkline?.(scoreHistory, 40, 14, entry.color) || '';
            
            return `
                <div class="leaderboard-entry ${entryClass}" data-empire-id="${entry.empireId}">
                    <span class="leaderboard-rank ${rankClass}">#${entry.rank}</span>
                    <div class="leaderboard-crest">${crest}</div>
                    <div class="leaderboard-empire">
                        <span class="leaderboard-name">${entry.empireName}</span>
                        ${agentDisplay}
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
    
    renderRankingsEmpires(entries, pagination) {
        const container = document.getElementById('rankingsContent');
        const countEl = document.getElementById('rankingsCount');
        const paginationEl = document.getElementById('rankingsPagination');
        if (!container) return;
        
        if (countEl && pagination) {
            countEl.textContent = `${pagination.total} empires`;
        }
        
        if (!entries || entries.length === 0) {
            container.innerHTML = '<p class="placeholder">No empires found</p>';
            if (paginationEl) paginationEl.innerHTML = '';
            return;
        }

        container.innerHTML = entries.map(entry => {
            const crest = CrestGenerator.generate(entry.empireId, entry.color, 24);
            const onlineClass = entry.isOnline ? 'online' : '';
            return `
                <div class="empire-entry" data-empire-id="${entry.empireId}">
                    <div class="empire-crest">${crest}</div>
                    <div class="empire-info">
                        <span class="empire-name" style="color: ${entry.color}">${entry.empireName}</span>
                        ${entry.agentName ? `<span class="empire-agent ${onlineClass}">@${entry.agentName}</span>` : ''}
                    </div>
                    <div class="empire-stats">
                        🪐 ${entry.stats?.planets || 0} • 👥 ${entry.stats?.population || 0}
                    </div>
                </div>
            `;
        }).join('');

        container.querySelectorAll('.empire-entry').forEach(el => {
            el.addEventListener('click', () => {
                const empireId = el.dataset.empireId;
                this.selectedEmpire = empireId;
                this.onEmpireSelect?.(empireId);
            });
        });
        
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
                        <div class="species-portrait-row">
                            <img class="species-portrait" src="/images/species/${s.id}.png" alt="${s.name}" 
                                 onerror="this.style.display='none'" />
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

    // === TECH TREE ===
    
    async initTechTree() {
        document.getElementById('techTreeBtn')?.addEventListener('click', () => {
            document.getElementById('techTreeModal').style.display = 'flex';
            this.fetchTechTree();
        });
        document.getElementById('closeTechTree')?.addEventListener('click', () => {
            document.getElementById('techTreeModal').style.display = 'none';
        });
        document.getElementById('techEmpireSelect')?.addEventListener('change', (e) => {
            this.renderTechTree(this._techData, e.target.value);
        });
    }

    async fetchTechTree() {
        try {
            const res = await fetch('/api/tech');
            const data = await res.json();
            this._techData = data;
            
            // Populate empire selector
            const select = document.getElementById('techEmpireSelect');
            if (select && data.empires) {
                select.innerHTML = data.empires.map(e => 
                    `<option value="${e.id}" style="color: ${e.color}">${e.name}</option>`
                ).join('');
            }
            
            // Render for first empire
            if (data.empires && data.empires.length > 0) {
                this.renderTechTree(data, data.empires[0].id);
            }
        } catch (err) {
            console.error('Failed to load tech tree:', err);
        }
    }

    renderTechTree(data, empireId) {
        if (!data || !data.technologies) return;
        
        const researched = new Set(data.researched?.[empireId] || []);
        const techs = data.technologies;
        
        // Comprehensive tech icons
        const techIcons = {
            improved_mining: '⛏️', improved_farming: '🌾', basic_weapons: '⚔️', basic_armor: '🛡️',
            advanced_mining: '💎', space_travel: '🚀', advanced_weapons: '🗡️', shields: '🔰',
            disaster_preparedness: '🌋', espionage_training: '🕵️', counter_intelligence: '🔍',
            advanced_research: '🔬', planetary_fortifications: '🏰', interstellar_commerce: '💰',
            arcology_project: '🏙️', warp_drive: '💫', battleship_tech: '🛸', terraforming: '🌍',
            advanced_counter_intel: '🛡️', covert_ops: '🗡️',
            quantum_computing: '🧠', dyson_sphere: '☀️', galactic_domination: '👑',
            ascension: '✨'
        };

        // Tier colors for glow effects
        const tierColors = {
            1: '#4ade80', // green
            2: '#60a5fa', // blue  
            3: '#a78bfa', // purple
            4: '#f59e0b', // amber
            5: '#f43f5e'  // rose/red
        };

        // Group by tier
        const tiers = { 1: [], 2: [], 3: [], 4: [], 5: [] };
        const techMap = {};
        for (const tech of techs) {
            if (tiers[tech.tier]) {
                tiers[tech.tier].push(tech);
                techMap[tech.id] = tech;
            }
        }

        // Render each tier with cards
        for (let tier = 1; tier <= 5; tier++) {
            const container = document.getElementById(`tier${tier}Techs`);
            if (!container) continue;

            container.innerHTML = tiers[tier].map(tech => {
                const isResearched = researched.has(tech.id);
                const canResearch = !isResearched && tech.prerequisites.every(p => researched.has(p));
                const status = isResearched ? 'researched' : canResearch ? 'available' : 'locked';
                const icon = techIcons[tech.id] || '🔬';
                const tierColor = tierColors[tech.tier];

                // Format prerequisites nicely
                const prereqNames = tech.prerequisites.map(p => techMap[p]?.name || p);
                const prereqHtml = prereqNames.length > 0
                    ? `<div class="tech-prereqs">⬆️ ${prereqNames.join(' + ')}</div>`
                    : '<div class="tech-prereqs">No prerequisites</div>';

                // Format effects
                let effectsHtml = '';
                if (tech.effects) {
                    const effectsList = [];
                    if (tech.effects.mineralBonus) effectsList.push(`+${Math.round(tech.effects.mineralBonus * 100)}% minerals`);
                    if (tech.effects.foodBonus) effectsList.push(`+${Math.round(tech.effects.foodBonus * 100)}% food`);
                    if (tech.effects.energyBonus) effectsList.push(`+${Math.round(tech.effects.energyBonus * 100)}% energy`);
                    if (tech.effects.researchBonus) effectsList.push(`+${Math.round(tech.effects.researchBonus * 100)}% research`);
                    if (tech.effects.attackBonus) effectsList.push(`+${Math.round(tech.effects.attackBonus * 100)}% attack`);
                    if (tech.effects.hpBonus) effectsList.push(`+${Math.round(tech.effects.hpBonus * 100)}% HP`);
                    if (tech.effects.spaceSpeedBonus) effectsList.push(`+${Math.round(tech.effects.spaceSpeedBonus * 100)}% speed`);
                    if (tech.effects.hpRegen) effectsList.push(`+${tech.effects.hpRegen} HP/tick`);
                    if (tech.effects.unlocks) effectsList.push(`Unlocks: ${tech.effects.unlocks.join(', ')}`);
                    if (tech.effects.terraforming) effectsList.push('Terraforming');
                    if (tech.effects.unlimitedEnergy) effectsList.push('Unlimited energy');
                    if (tech.effects.victory) effectsList.push('🏆 VICTORY');
                    if (tech.effects.calamityResistance) effectsList.push(`-${Math.round(tech.effects.calamityResistance * 100)}% calamity`);
                    if (effectsList.length > 0) {
                        effectsHtml = `<div class="tech-effects">${effectsList.join(' • ')}</div>`;
                    }
                }

                return `
                    <div class="tech-card ${status}" data-tech="${tech.id}" style="--tier-color: ${tierColor}">
                        <div class="tech-header">
                            <span class="tech-icon">${icon}</span>
                            <span class="tech-name">${tech.name}</span>
                        </div>
                        <div class="tech-cost-bar">
                            <span class="tech-cost">🔬 ${tech.cost.toLocaleString()}</span>
                            <span class="tech-tier-badge">T${tech.tier}</span>
                        </div>
                        <div class="tech-desc">${tech.description}</div>
                        ${effectsHtml}
                        ${prereqHtml}
                        <div class="tech-status ${status}">
                            ${isResearched ? '✓ Researched' : canResearch ? '◉ Available' : '🔒 Locked'}
                        </div>
                    </div>
                `;
            }).join('');
        }

        // Add hover effect listeners for path highlighting
        this.setupTechTreeInteractions(techMap, researched);
    }

    setupTechTreeInteractions(techMap, researched) {
        const cards = document.querySelectorAll('.tech-card');
        
        cards.forEach(card => {
            card.addEventListener('mouseenter', () => {
                const techId = card.dataset.tech;
                const tech = techMap[techId];
                if (!tech) return;

                // Highlight prerequisites
                tech.prerequisites.forEach(prereqId => {
                    const prereqCard = document.querySelector(`[data-tech="${prereqId}"]`);
                    if (prereqCard) prereqCard.classList.add('prereq-highlight');
                });

                // Highlight techs that depend on this one
                Object.values(techMap).forEach(t => {
                    if (t.prerequisites.includes(techId)) {
                        const depCard = document.querySelector(`[data-tech="${t.id}"]`);
                        if (depCard) depCard.classList.add('dependent-highlight');
                    }
                });
            });

            card.addEventListener('mouseleave', () => {
                document.querySelectorAll('.prereq-highlight, .dependent-highlight')
                    .forEach(el => el.classList.remove('prereq-highlight', 'dependent-highlight'));
            });
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // DIPLOMACY PANEL
    // ═══════════════════════════════════════════════════════════════════════════════
    
    async initDiplomacy() {
        document.getElementById('diplomacyBtn')?.addEventListener('click', () => {
            document.getElementById('diplomacyModal').style.display = 'flex';
            this.fetchDiplomacy();
        });
        document.getElementById('closeDiplomacy')?.addEventListener('click', () => {
            document.getElementById('diplomacyModal').style.display = 'none';
        });
        document.getElementById('refreshDiplomacy')?.addEventListener('click', () => {
            this.fetchDiplomacy();
        });
    }

    async fetchDiplomacy() {
        try {
            const res = await fetch('/api/diplomacy');
            const data = await res.json();
            this._diplomacyData = data;
            this.renderDiplomacy(data);
        } catch (err) {
            console.error('Failed to load diplomacy:', err);
        }
    }

    renderDiplomacy(data) {
        if (!data) return;
        
        // Render Wars
        const warsContainer = document.getElementById('diplomacyWars');
        const wars = data.relations.filter(r => r.status === 'war');
        if (wars.length > 0) {
            warsContainer.innerHTML = wars.map(war => {
                const timeAgo = this._formatTimeAgo(war.since);
                const aggressor = war.aggressor === war.empire1.id ? war.empire1.name : war.empire2.name;
                return `
                    <div class="diplomacy-item war">
                        <div class="diplomacy-empire">
                            <span class="diplomacy-empire-dot" style="background: ${war.empire1.color || '#888'}"></span>
                            <span class="diplomacy-empire-name">${war.empire1.name}</span>
                        </div>
                        <span class="diplomacy-vs">⚔️</span>
                        <div class="diplomacy-empire">
                            <span class="diplomacy-empire-dot" style="background: ${war.empire2.color || '#888'}"></span>
                            <span class="diplomacy-empire-name">${war.empire2.name}</span>
                        </div>
                        <div class="diplomacy-status war">At War</div>
                        <div class="diplomacy-time" title="Started by ${aggressor}">${timeAgo}</div>
                    </div>
                `;
            }).join('');
        } else {
            warsContainer.innerHTML = '<p class="placeholder-text">🕊️ Peace reigns across the galaxy</p>';
        }
        
        // Render Alliances
        const alliancesContainer = document.getElementById('diplomacyAlliances');
        const alliances = data.relations.filter(r => r.status === 'allied');
        if (alliances.length > 0) {
            alliancesContainer.innerHTML = alliances.map(alliance => {
                const timeAgo = this._formatTimeAgo(alliance.since);
                return `
                    <div class="diplomacy-item alliance">
                        <div class="diplomacy-empire">
                            <span class="diplomacy-empire-dot" style="background: ${alliance.empire1.color || '#888'}"></span>
                            <span class="diplomacy-empire-name">${alliance.empire1.name}</span>
                        </div>
                        <span class="diplomacy-vs">🤝</span>
                        <div class="diplomacy-empire">
                            <span class="diplomacy-empire-dot" style="background: ${alliance.empire2.color || '#888'}"></span>
                            <span class="diplomacy-empire-name">${alliance.empire2.name}</span>
                        </div>
                        <div class="diplomacy-status alliance">Allied</div>
                        <div class="diplomacy-time">${timeAgo}</div>
                    </div>
                `;
            }).join('');
        } else {
            alliancesContainer.innerHTML = '<p class="placeholder-text">No alliances have been formed</p>';
        }
        
        // Render Proposals
        const proposalsContainer = document.getElementById('diplomacyProposals');
        if (data.proposals.length > 0) {
            proposalsContainer.innerHTML = data.proposals.map(proposal => {
                const typeIcon = proposal.type === 'alliance' ? '🤝' : '🕊️';
                const typeLabel = proposal.type === 'alliance' ? 'Alliance' : 'Peace';
                const timeAgo = this._formatTimeAgo(proposal.created);
                return `
                    <div class="diplomacy-item proposal">
                        <div class="diplomacy-empire">
                            <span class="diplomacy-empire-dot" style="background: ${proposal.from.color || '#888'}"></span>
                            <span class="diplomacy-empire-name">${proposal.from.name}</span>
                        </div>
                        <span class="diplomacy-vs">${typeIcon}→</span>
                        <div class="diplomacy-empire">
                            <span class="diplomacy-empire-dot" style="background: ${proposal.to.color || '#888'}"></span>
                            <span class="diplomacy-empire-name">${proposal.to.name}</span>
                        </div>
                        <div class="diplomacy-status proposal">${typeLabel} Proposal</div>
                        <div class="diplomacy-time">${timeAgo}</div>
                    </div>
                `;
            }).join('');
        } else {
            proposalsContainer.innerHTML = '<p class="placeholder-text">No pending proposals</p>';
        }
        
        // Render Relations Matrix
        this._renderDiplomacyMatrix(data);
    }
    
    _renderDiplomacyMatrix(data) {
        const container = document.getElementById('diplomacyMatrix');
        if (!container || !data.empires || data.empires.length < 2) {
            container.innerHTML = '<p class="placeholder-text">Not enough empires for a relations matrix</p>';
            return;
        }
        
        const empires = data.empires;
        
        // Build relation lookup
        const relationMap = {};
        for (const rel of data.relations) {
            const key1 = `${rel.empire1.id}_${rel.empire2.id}`;
            const key2 = `${rel.empire2.id}_${rel.empire1.id}`;
            relationMap[key1] = rel.status;
            relationMap[key2] = rel.status;
        }
        
        let html = '<table>';
        
        // Header row
        html += '<tr><th></th>';
        for (const empire of empires) {
            html += `<th><div class="empire-header"><span class="empire-dot" style="background: ${empire.color || '#888'}"></span>${empire.name.substring(0, 10)}</div></th>`;
        }
        html += '</tr>';
        
        // Data rows
        for (const rowEmpire of empires) {
            html += `<tr><th><div class="empire-header"><span class="empire-dot" style="background: ${rowEmpire.color || '#888'}"></span>${rowEmpire.name.substring(0, 10)}</div></th>`;
            
            for (const colEmpire of empires) {
                if (rowEmpire.id === colEmpire.id) {
                    html += '<td class="self">—</td>';
                } else {
                    const key = `${rowEmpire.id}_${colEmpire.id}`;
                    const status = relationMap[key] || 'neutral';
                    const symbol = status === 'war' ? '⚔️' : status === 'allied' ? '🤝' : '•';
                    html += `<td class="${status}">${symbol}</td>`;
                }
            }
            html += '</tr>';
        }
        
        html += '</table>';
        container.innerHTML = html;
    }
    
    _formatTimeAgo(timestamp) {
        if (!timestamp) return '';
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 60) return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // DIPLOMACY SUMMARY (Sidebar)
    // ═══════════════════════════════════════════════════════════════════════════════
    
    async fetchLeaderboard() {
        try {
            const res = await fetch('/api/leaderboard?limit=100');
            const data = await res.json();
            this._cachedLeaderboard = data.leaderboard || [];
            this._cachedEmpires = this._cachedLeaderboard; // Also cache as empires
        } catch (err) {
            console.error('Failed to fetch leaderboard:', err);
        }
    }

    async updateDiplomacySummary() {
        try {
            const res = await fetch('/api/diplomacy');
            const data = await res.json();
            this.renderDiplomacySummary(data);
        } catch (err) {
            // Silent fail - not critical
        }
    }

    renderDiplomacySummary(data) {
        if (!data) return;
        
        const warCount = document.getElementById('warCount');
        const allianceCount = document.getElementById('allianceCount');
        const activeConflicts = document.getElementById('activeConflicts');
        
        if (!warCount || !allianceCount || !activeConflicts) return;
        
        const wars = data.relations?.filter(r => r.status === 'war') || [];
        const alliances = data.relations?.filter(r => r.status === 'allied') || [];
        
        warCount.textContent = wars.length;
        allianceCount.textContent = alliances.length;
        
        // Show recent conflicts/alliances
        const items = [];
        
        // Show wars first (max 3)
        wars.slice(0, 3).forEach(war => {
            items.push(`
                <div class="conflict-item war">
                    <div class="conflict-empire">
                        <span class="conflict-dot" style="background: ${war.empire1?.color || '#888'}"></span>
                        <span>${(war.empire1?.name || 'Unknown').substring(0, 12)}</span>
                    </div>
                    <span class="conflict-vs">⚔️</span>
                    <div class="conflict-empire">
                        <span class="conflict-dot" style="background: ${war.empire2?.color || '#888'}"></span>
                        <span>${(war.empire2?.name || 'Unknown').substring(0, 12)}</span>
                    </div>
                </div>
            `);
        });
        
        // Show alliances (max 2)
        alliances.slice(0, 2).forEach(alliance => {
            items.push(`
                <div class="conflict-item alliance">
                    <div class="conflict-empire">
                        <span class="conflict-dot" style="background: ${alliance.empire1?.color || '#888'}"></span>
                        <span>${(alliance.empire1?.name || 'Unknown').substring(0, 12)}</span>
                    </div>
                    <span class="conflict-vs">🤝</span>
                    <div class="conflict-empire">
                        <span class="conflict-dot" style="background: ${alliance.empire2?.color || '#888'}"></span>
                        <span>${(alliance.empire2?.name || 'Unknown').substring(0, 12)}</span>
                    </div>
                </div>
            `);
        });
        
        if (items.length === 0) {
            activeConflicts.innerHTML = '<p style="color: #666; font-size: 0.75rem; text-align: center;">🕊️ Peace in the galaxy</p>';
        } else {
            activeConflicts.innerHTML = items.join('');
        }
    }
}
