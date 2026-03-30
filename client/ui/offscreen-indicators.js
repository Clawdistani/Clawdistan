// Off-Screen Event Indicators
// Renders edge-of-screen arrows pointing to important events outside viewport
// Events: battles, invasions, crisis attacks, building completions

export class OffscreenIndicatorSystem {
    constructor(renderer) {
        this.renderer = renderer;
        this.indicators = [];
        this.enabled = localStorage.getItem('clawdistan_offscreen_indicators') !== 'false';
        this.pulsePhase = 0;
        
        // Indicator types with icons and colors
        this.indicatorConfig = {
            battle: {
                icon: '⚔️',
                color: '#f97316',  // Orange
                priority: 3,
                pulse: true
            },
            invasion: {
                icon: '🏴',
                color: '#dc2626',  // Red
                priority: 4,
                pulse: true
            },
            crisis: {
                icon: '⚠️',
                color: '#ef4444',  // Bright red
                priority: 5,
                pulse: true
            },
            colonization: {
                icon: '🌍',
                color: '#22c55e',  // Green
                priority: 2,
                pulse: false
            },
            construction: {
                icon: '🔨',
                color: '#06b6d4',  // Cyan
                priority: 1,
                pulse: false
            },
            fleet: {
                icon: '🚀',
                color: '#8b5cf6',  // Purple
                priority: 1,
                pulse: false
            }
        };
        
        // Edge padding from screen borders
        this.edgePadding = 50;
        this.indicatorSize = 32;
        this.maxIndicators = 8;  // Limit to prevent clutter
        
        // Initialize toggle button after DOM ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this._createToggleButton());
        } else {
            setTimeout(() => this._createToggleButton(), 100);
        }
    }
    
    /**
     * Update indicators based on current game state
     * @param {Object} state - Current game state
     * @param {Object} viewBounds - Current viewport bounds {minX, minY, maxX, maxY}
     * @param {Object} camera - Camera position {x, y, zoom}
     */
    update(state, viewBounds, camera) {
        if (!this.enabled || !state) return;
        
        this.indicators = [];
        this.pulsePhase = (this.pulsePhase + 0.05) % (Math.PI * 2);
        
        // Collect off-screen events
        this._collectBattleIndicators(state, viewBounds, camera);
        this._collectCrisisIndicators(state, viewBounds, camera);
        this._collectFleetIndicators(state, viewBounds, camera);
        
        // Sort by priority (highest first) and limit
        this.indicators.sort((a, b) => b.priority - a.priority);
        this.indicators = this.indicators.slice(0, this.maxIndicators);
    }
    
    /**
     * Collect active battle indicators
     */
    _collectBattleIndicators(state, viewBounds, camera) {
        const battles = state.activeBattles || [];
        
        battles.forEach(battle => {
            if (!battle.location) return;
            
            // Get world position of battle
            const worldX = battle.location.x || 0;
            const worldY = battle.location.y || 0;
            
            // Check if off-screen
            if (this._isOffScreen(worldX, worldY, viewBounds)) {
                const edgePos = this._calculateEdgePosition(worldX, worldY, camera, viewBounds);
                
                this.indicators.push({
                    type: battle.state === 'gathering' ? 'battle' : 'battle',
                    worldX,
                    worldY,
                    edgeX: edgePos.x,
                    edgeY: edgePos.y,
                    angle: edgePos.angle,
                    label: `Battle (${battle.participants?.length || 2} fleets)`,
                    priority: this.indicatorConfig.battle.priority,
                    data: battle
                });
            }
        });
    }
    
    /**
     * Collect crisis attack indicators (planets under attack)
     */
    _collectCrisisIndicators(state, viewBounds, camera) {
        if (!state.crisis?.active) return;
        
        // Find planets with crisis units
        const crisisLocations = new Map();  // systemId -> {x, y, count}
        
        (state.entities || []).forEach(entity => {
            if (entity.owner?.startsWith('crisis_') && entity.locationId) {
                // Get planet's system position
                const planet = state.universe?.planets?.find(p => p.id === entity.locationId);
                const system = planet ? state.universe?.solarSystems?.find(s => s.id === planet.systemId) : null;
                
                if (system) {
                    const existing = crisisLocations.get(system.id) || { x: system.x, y: system.y, count: 0, systemName: system.name };
                    existing.count++;
                    crisisLocations.set(system.id, existing);
                }
            }
        });
        
        // Create indicators for off-screen crisis attacks
        crisisLocations.forEach((loc, systemId) => {
            if (this._isOffScreen(loc.x, loc.y, viewBounds)) {
                const edgePos = this._calculateEdgePosition(loc.x, loc.y, camera, viewBounds);
                
                this.indicators.push({
                    type: 'crisis',
                    worldX: loc.x,
                    worldY: loc.y,
                    edgeX: edgePos.x,
                    edgeY: edgePos.y,
                    angle: edgePos.angle,
                    label: `Crisis: ${loc.systemName} (${loc.count})`,
                    priority: this.indicatorConfig.crisis.priority,
                    data: { systemId, count: loc.count }
                });
            }
        });
    }
    
    /**
     * Collect fleet movement indicators (own fleets in transit)
     */
    _collectFleetIndicators(state, viewBounds, camera) {
        const fleets = state.fleetsInTransit || [];
        const playerEmpireId = state.playerEmpireId;
        
        // Group by destination system
        const fleetDestinations = new Map();
        
        fleets.forEach(fleet => {
            // Only show own fleets (if player-specific) or all fleets
            const dest = fleet.destSystemId || fleet.destinationId;
            if (!dest) return;
            
            const system = state.universe?.solarSystems?.find(s => s.id === dest);
            if (!system) return;
            
            const existing = fleetDestinations.get(dest) || { x: system.x, y: system.y, count: 0, systemName: system.name };
            existing.count++;
            fleetDestinations.set(dest, existing);
        });
        
        // Create indicators for off-screen fleet destinations
        fleetDestinations.forEach((loc, destId) => {
            if (this._isOffScreen(loc.x, loc.y, viewBounds)) {
                const edgePos = this._calculateEdgePosition(loc.x, loc.y, camera, viewBounds);
                
                this.indicators.push({
                    type: 'fleet',
                    worldX: loc.x,
                    worldY: loc.y,
                    edgeX: edgePos.x,
                    edgeY: edgePos.y,
                    angle: edgePos.angle,
                    label: `${loc.count} fleet(s) → ${loc.systemName}`,
                    priority: this.indicatorConfig.fleet.priority,
                    data: { systemId: destId, count: loc.count }
                });
            }
        });
    }
    
    /**
     * Check if world coordinates are outside viewport
     */
    _isOffScreen(worldX, worldY, viewBounds) {
        return worldX < viewBounds.minX || worldX > viewBounds.maxX ||
               worldY < viewBounds.minY || worldY > viewBounds.maxY;
    }
    
    /**
     * Calculate edge position and angle for indicator
     * @returns {{x: number, y: number, angle: number}}
     */
    _calculateEdgePosition(worldX, worldY, camera, viewBounds) {
        // Get screen center in world coords
        const centerX = (viewBounds.minX + viewBounds.maxX) / 2;
        const centerY = (viewBounds.minY + viewBounds.maxY) / 2;
        
        // Direction vector from center to target
        const dx = worldX - centerX;
        const dy = worldY - centerY;
        const angle = Math.atan2(dy, dx);
        
        // Canvas dimensions
        const canvas = this.renderer.canvas;
        const screenW = canvas.width;
        const screenH = canvas.height;
        const padding = this.edgePadding;
        
        // Screen center
        const screenCX = screenW / 2;
        const screenCY = screenH / 2;
        
        // Calculate intersection with screen edge
        // Using parametric line intersection with rectangle
        const halfW = screenW / 2 - padding;
        const halfH = screenH / 2 - padding;
        
        // t values for intersection with each edge
        let t = 1;
        
        // Right edge
        if (dx > 0) t = Math.min(t, halfW / Math.abs(dx * (screenW / (viewBounds.maxX - viewBounds.minX))));
        // Left edge
        if (dx < 0) t = Math.min(t, halfW / Math.abs(dx * (screenW / (viewBounds.maxX - viewBounds.minX))));
        // Bottom edge
        if (dy > 0) t = Math.min(t, halfH / Math.abs(dy * (screenH / (viewBounds.maxY - viewBounds.minY))));
        // Top edge
        if (dy < 0) t = Math.min(t, halfH / Math.abs(dy * (screenH / (viewBounds.maxY - viewBounds.minY))));
        
        // Calculate edge position
        const scale = Math.min(screenW / (viewBounds.maxX - viewBounds.minX), screenH / (viewBounds.maxY - viewBounds.minY));
        const screenX = screenCX + dx * scale * t * 0.85;  // 0.85 to keep slightly inside
        const screenY = screenCY + dy * scale * t * 0.85;
        
        // Clamp to screen bounds with padding
        const clampedX = Math.max(padding, Math.min(screenW - padding, screenX));
        const clampedY = Math.max(padding, Math.min(screenH - padding, screenY));
        
        return { x: clampedX, y: clampedY, angle };
    }
    
    /**
     * Render all off-screen indicators
     * @param {CanvasRenderingContext2D} ctx
     */
    render(ctx) {
        if (!this.enabled || this.indicators.length === 0) return;
        
        const pulse = Math.sin(this.pulsePhase) * 0.3 + 0.7;  // 0.4 to 1.0
        
        this.indicators.forEach(indicator => {
            this._renderIndicator(ctx, indicator, pulse);
        });
    }
    
    /**
     * Render a single off-screen indicator
     */
    _renderIndicator(ctx, indicator, pulse) {
        const config = this.indicatorConfig[indicator.type];
        if (!config) return;
        
        const x = indicator.edgeX;
        const y = indicator.edgeY;
        const size = this.indicatorSize;
        const alpha = config.pulse ? pulse : 0.9;
        
        ctx.save();
        ctx.translate(x, y);
        
        // Pulsing glow effect
        if (config.pulse) {
            const glowSize = size * (1 + pulse * 0.3);
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, glowSize);
            gradient.addColorStop(0, config.color + '66');
            gradient.addColorStop(1, 'transparent');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 0, glowSize, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Arrow pointing toward event
        ctx.save();
        ctx.rotate(indicator.angle);
        
        // Arrow shape
        ctx.beginPath();
        ctx.moveTo(size * 0.6, 0);  // Tip
        ctx.lineTo(-size * 0.3, -size * 0.3);  // Top wing
        ctx.lineTo(-size * 0.1, 0);  // Indent
        ctx.lineTo(-size * 0.3, size * 0.3);  // Bottom wing
        ctx.closePath();
        
        ctx.fillStyle = config.color;
        ctx.globalAlpha = alpha;
        ctx.fill();
        
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.restore();
        
        // Icon in center
        ctx.globalAlpha = 1;
        ctx.font = `${size * 0.5}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(config.icon, 0, 0);
        
        // Label below (truncated)
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 3;
        const label = indicator.label.length > 20 ? indicator.label.slice(0, 17) + '...' : indicator.label;
        ctx.fillText(label, 0, size * 0.7);
        ctx.shadowBlur = 0;
        
        ctx.restore();
    }
    
    /**
     * Check if click hits an indicator and navigate to it
     * @param {number} screenX - Screen X coordinate
     * @param {number} screenY - Screen Y coordinate
     * @returns {Object|null} - Clicked indicator data or null
     */
    handleClick(screenX, screenY) {
        if (!this.enabled) return null;
        
        const hitRadius = this.indicatorSize * 0.8;
        
        for (const indicator of this.indicators) {
            const dx = screenX - indicator.edgeX;
            const dy = screenY - indicator.edgeY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist <= hitRadius) {
                return {
                    type: indicator.type,
                    worldX: indicator.worldX,
                    worldY: indicator.worldY,
                    data: indicator.data
                };
            }
        }
        
        return null;
    }
    
    /**
     * Toggle indicator visibility
     */
    toggle() {
        this.enabled = !this.enabled;
        localStorage.setItem('clawdistan_offscreen_indicators', this.enabled);
        return this.enabled;
    }
    
    /**
     * Set enabled state
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        localStorage.setItem('clawdistan_offscreen_indicators', enabled);
    }
    
    /**
     * Create toggle button in UI
     */
    _createToggleButton() {
        const zoomControls = document.querySelector('.zoom-controls');
        if (!zoomControls) return;
        
        // Check if button already exists
        if (document.getElementById('offscreenIndicatorToggle')) return;
        
        const toggle = document.createElement('button');
        toggle.id = 'offscreenIndicatorToggle';
        toggle.className = 'zoom-btn indicator-toggle';
        toggle.innerHTML = this.enabled ? '📍' : '🔘';
        toggle.title = 'Toggle off-screen indicators (I)';
        toggle.addEventListener('click', () => {
            const nowEnabled = this.toggle();
            toggle.innerHTML = nowEnabled ? '📍' : '🔘';
            this._showSystemAlert(nowEnabled ? '📍 Off-screen indicators enabled' : '🔘 Off-screen indicators disabled');
        });
        
        zoomControls.appendChild(toggle);
        
        // Keyboard shortcut 'I' to toggle
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.key.toLowerCase() === 'i' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                const nowEnabled = this.toggle();
                toggle.innerHTML = nowEnabled ? '📍' : '🔘';
                this._showSystemAlert(nowEnabled ? '📍 Off-screen indicators enabled' : '🔘 Off-screen indicators disabled');
            }
        });
    }
    
    /**
     * Show a brief system alert toast
     */
    _showSystemAlert(message) {
        const alertContainer = document.getElementById('eventAlertContainer');
        if (!alertContainer) return;
        
        const alert = document.createElement('div');
        alert.className = 'event-alert system-alert';
        alert.innerHTML = `<span class="alert-message">${message}</span>`;
        alertContainer.appendChild(alert);
        
        requestAnimationFrame(() => alert.classList.add('show'));
        
        setTimeout(() => {
            alert.classList.remove('show');
            setTimeout(() => alert.remove(), 300);
        }, 2000);
    }
}
