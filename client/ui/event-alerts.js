// Event Alert System - Visual notifications for important game events
// Shows slide-in alerts for combat, conquest, and other critical events

export class EventAlertSystem {
    constructor() {
        this.container = null;
        this.alerts = [];
        this.maxAlerts = 4;
        this.alertDuration = 5000;
        this.seenEventIds = new Set();
        this.lastProcessedTick = 0;
        this.enabled = localStorage.getItem('clawdistan_alerts_enabled') !== 'false';
        this.soundEnabled = localStorage.getItem('clawdistan_alert_sounds') !== 'false';
        
        // Alert priority and styling
        this.alertConfig = {
            invasion: { 
                icon: '🏴', 
                priority: 3, 
                sound: 'error',
                color: '#dc2626',
                title: 'INVASION'
            },
            combat: { 
                icon: '⚔️', 
                priority: 3, 
                sound: 'error',
                color: '#f97316',
                title: 'BATTLE'
            },
            conquest: { 
                icon: '👑', 
                priority: 2, 
                sound: 'success',
                color: '#eab308',
                title: 'CONQUEST'
            },
            colonization: { 
                icon: '🌍', 
                priority: 2, 
                sound: 'success',
                color: '#22c55e',
                title: 'COLONIZED'
            },
            research: { 
                icon: '🔬', 
                priority: 1, 
                sound: 'notify',
                color: '#06b6d4',
                title: 'RESEARCH'
            },
            diplomacy: { 
                icon: '🤝', 
                priority: 2, 
                sound: 'notify',
                color: '#8b5cf6',
                title: 'DIPLOMACY'
            },
            crisis: { 
                icon: '⚠️', 
                priority: 3, 
                sound: 'error',
                color: '#dc2626',
                title: 'CRISIS'
            },
            victory: { 
                icon: '🏆', 
                priority: 3, 
                sound: 'success',
                color: '#fbbf24',
                title: 'VICTORY'
            },
            agent: { 
                icon: '🤖', 
                priority: 1, 
                sound: 'notify',
                color: '#60a5fa',
                title: 'AGENT'
            },
            building: {
                icon: '🏗️',
                priority: 1,
                sound: 'success',
                color: '#22d3ee',
                title: 'COMPLETE'
            }
        };
        
        this.init();
    }
    
    init() {
        this.createContainer();
        this.createToggleButton();
    }
    
    createContainer() {
        // Create alert container (top-right corner)
        this.container = document.createElement('div');
        this.container.id = 'eventAlertContainer';
        this.container.className = 'event-alert-container';
        document.body.appendChild(this.container);
    }
    
    createToggleButton() {
        // Add toggle in zoom controls area
        const zoomControls = document.querySelector('.zoom-controls');
        if (!zoomControls) return;
        
        const toggle = document.createElement('button');
        toggle.id = 'alertToggle';
        toggle.className = 'zoom-btn alert-toggle';
        toggle.innerHTML = this.enabled ? '🔔' : '🔕';
        toggle.title = 'Toggle event alerts (A)';
        toggle.addEventListener('click', () => this.toggleAlerts());
        
        zoomControls.appendChild(toggle);
        
        // Keyboard shortcut 'A' to toggle
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.key.toLowerCase() === 'a' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                this.toggleAlerts();
            }
        });
    }
    
    toggleAlerts() {
        this.enabled = !this.enabled;
        localStorage.setItem('clawdistan_alerts_enabled', this.enabled);
        
        const toggle = document.getElementById('alertToggle');
        if (toggle) {
            toggle.innerHTML = this.enabled ? '🔔' : '🔕';
        }
        
        // Show feedback toast
        this.showSystemAlert(this.enabled ? '🔔 Alerts enabled' : '🔕 Alerts disabled');
    }
    
    showSystemAlert(message) {
        const alert = document.createElement('div');
        alert.className = 'event-alert system-alert';
        alert.innerHTML = `<span class="alert-message">${message}</span>`;
        this.container.appendChild(alert);
        
        requestAnimationFrame(() => alert.classList.add('show'));
        
        setTimeout(() => {
            alert.classList.remove('show');
            setTimeout(() => alert.remove(), 300);
        }, 2000);
    }
    
    // Process events from game state
    processEvents(events, currentTick, empires = []) {
        if (!this.enabled || !events || events.length === 0) return;
        
        // Build empire color map
        const empireColors = {};
        empires.forEach(e => { empireColors[e.id] = e.color; });
        
        // Filter to new, important events only
        const newEvents = events.filter(e => {
            const eventId = `${e.tick}_${e.message}`;
            if (this.seenEventIds.has(eventId)) return false;
            if (e.tick <= this.lastProcessedTick) return false;
            
            // Check if important
            const category = this.categorizeEvent(e);
            if (!this.alertConfig[category]) return false;
            
            // Only high-priority events get alerts
            return this.alertConfig[category].priority >= 2;
        });
        
        // Sort by tick (oldest first for proper stacking)
        newEvents.sort((a, b) => a.tick - b.tick);
        
        // Show most recent 2 to avoid spam
        const alertEvents = newEvents.slice(-2);
        
        for (const event of alertEvents) {
            const eventId = `${event.tick}_${event.message}`;
            this.seenEventIds.add(eventId);
            
            const category = this.categorizeEvent(event);
            this.showAlert(event, category, empireColors);
        }
        
        this.lastProcessedTick = currentTick;
        
        // Cleanup old seen IDs
        if (this.seenEventIds.size > 500) {
            const arr = [...this.seenEventIds];
            this.seenEventIds = new Set(arr.slice(-300));
        }
    }
    
    categorizeEvent(event) {
        const msg = event.message.toLowerCase();
        const cat = event.category;
        
        if (cat && this.alertConfig[cat]) return cat;
        
        if (msg.includes('invasion') || msg.includes('invaded')) return 'invasion';
        if (msg.includes('conquered') || msg.includes('captured')) return 'conquest';
        if (msg.includes('battle') || msg.includes('attacked') || msg.includes('destroyed')) return 'combat';
        if (msg.includes('coloniz')) return 'colonization';
        if (msg.includes('alliance') || msg.includes('treaty') || msg.includes('peace') || msg.includes('war declared')) return 'diplomacy';
        if (msg.includes('research') || msg.includes('unlocked') || msg.includes('technology')) return 'research';
        if (msg.includes('crisis') || msg.includes('swarm') || msg.includes('precursor')) return 'crisis';
        if (msg.includes('victory') || msg.includes('won')) return 'victory';
        if (msg.includes('completed') || msg.includes('built') || msg.includes('constructed')) return 'building';
        if (msg.includes('agent') || msg.includes('joined') || msg.includes('left')) return 'agent';
        
        return null;
    }
    
    showAlert(event, category, empireColors = {}) {
        const config = this.alertConfig[category];
        if (!config) return;
        
        // Play sound
        if (this.soundEnabled && window.SoundFX) {
            window.SoundFX.play(config.sound);
        }
        
        // Extract empire from message for coloring (simple pattern match)
        let empireColor = config.color;
        for (const [empireId, color] of Object.entries(empireColors)) {
            // Not perfect but catches most cases
            if (event.message.includes(empireId)) {
                empireColor = color;
                break;
            }
        }
        
        // Create alert element
        const alert = document.createElement('div');
        alert.className = `event-alert category-${category}`;
        alert.style.setProperty('--alert-color', config.color);
        alert.style.setProperty('--empire-color', empireColor);
        
        alert.innerHTML = `
            <div class="alert-header">
                <span class="alert-icon">${config.icon}</span>
                <span class="alert-title">${config.title}</span>
                <span class="alert-tick">T${event.tick}</span>
            </div>
            <div class="alert-message">${this.formatMessage(event.message)}</div>
            <div class="alert-progress"></div>
        `;
        
        // Add to container
        this.container.appendChild(alert);
        this.alerts.push(alert);
        
        // Trigger animation
        requestAnimationFrame(() => {
            alert.classList.add('show');
        });
        
        // Click to dismiss
        alert.addEventListener('click', () => this.dismissAlert(alert));
        
        // Auto dismiss
        const progressBar = alert.querySelector('.alert-progress');
        progressBar.style.animationDuration = `${this.alertDuration}ms`;
        
        const timeoutId = setTimeout(() => this.dismissAlert(alert), this.alertDuration);
        alert._timeoutId = timeoutId;
        
        // Pause on hover
        alert.addEventListener('mouseenter', () => {
            clearTimeout(alert._timeoutId);
            progressBar.style.animationPlayState = 'paused';
        });
        
        alert.addEventListener('mouseleave', () => {
            progressBar.style.animationPlayState = 'running';
            alert._timeoutId = setTimeout(() => this.dismissAlert(alert), 2000);
        });
        
        // Remove oldest if over limit
        while (this.alerts.length > this.maxAlerts) {
            this.dismissAlert(this.alerts[0]);
        }
    }
    
    dismissAlert(alert) {
        if (!alert || !alert.parentNode) return;
        
        clearTimeout(alert._timeoutId);
        alert.classList.remove('show');
        alert.classList.add('hide');
        
        setTimeout(() => {
            if (alert.parentNode) {
                alert.parentNode.removeChild(alert);
            }
            const idx = this.alerts.indexOf(alert);
            if (idx > -1) this.alerts.splice(idx, 1);
        }, 300);
    }
    
    formatMessage(message) {
        // Truncate long messages
        if (message.length > 80) {
            return message.substring(0, 77) + '...';
        }
        return message;
    }
    
    clearAll() {
        [...this.alerts].forEach(a => this.dismissAlert(a));
    }
}
