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
            // Record stats for graphing
            this.statsTracker.record(state.tick || 0, state.empires);
        }

        this.updateEmpireList(state.empires);
        this.updateEventLog(state.events);
        this.updateMiniStats(state);
        this.updateResourceBar(state);
    }
    
    // Update resource bar with selected empire's resources (or top empire if none selected)
    updateResourceBar(state) {
        if (!state.empires || state.empires.length === 0) return;
        
        // Use selected empire if set, otherwise default to leader (#1)
        let empire = state.empires[0];
        if (this.selectedEmpire) {
            const selected = state.empires.find(e => e.id === this.selectedEmpire);
            if (selected) empire = selected;
        }
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
            const crest = CrestGenerator.generate(entry.empireId, entry.color, 28);
            const scoreHistory = this.statsTracker.getHistory(entry.empireId, 'score');
            const sparkline = StatsTracker.renderSparkline(scoreHistory, 40, 14, entry.color);
            
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
        
        // Get tech icons
        const techIcons = {
            improved_mining: '⛏️', improved_farming: '🌾', basic_weapons: '⚔️', basic_armor: '🛡️',
            advanced_mining: '💎', space_travel: '🚀', advanced_weapons: '🗡️', shields: '🔰',
            warp_drive: '💫', battleship_tech: '🛸', terraforming: '🌍',
            quantum_computing: '🧠', dyson_sphere: '☀️', galactic_domination: '👑',
            ascension: '✨'
        };

        // Group by tier
        const tiers = { 1: [], 2: [], 3: [], 4: [], 5: [] };
        for (const tech of techs) {
            if (tiers[tech.tier]) {
                tiers[tech.tier].push(tech);
            }
        }

        // Render each tier
        for (let tier = 1; tier <= 5; tier++) {
            const container = document.getElementById(`tier${tier}Techs`);
            if (!container) continue;

            container.innerHTML = tiers[tier].map(tech => {
                const isResearched = researched.has(tech.id);
                const canResearch = !isResearched && tech.prerequisites.every(p => researched.has(p));
                const status = isResearched ? 'researched' : canResearch ? 'available' : 'locked';
                const icon = techIcons[tech.id] || '🔬';

                const prereqHtml = tech.prerequisites.length > 0
                    ? `<div class="tech-prereqs">Requires: <span>${tech.prerequisites.join(', ')}</span></div>`
                    : '';

                return `
                    <div class="tech-card ${status}">
                        <div class="tech-header">
                            <span class="tech-icon">${icon}</span>
                            <span class="tech-name">${tech.name}</span>
                            <span class="tech-cost">🔬${tech.cost}</span>
                        </div>
                        <div class="tech-desc">${tech.description}</div>
                        ${prereqHtml}
                        <div class="tech-status ${status}">
                            ${isResearched ? '✓ Researched' : canResearch ? '◉ Available' : '🔒 Locked'}
                        </div>
                    </div>
                `;
            }).join('');
        }
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
}
