// Stats tracking and toast notifications

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
        if (msg.includes('research') || msg.includes('unlocked')) return 'research';
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
