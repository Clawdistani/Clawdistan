/**
 * Battle Arena Viewer (Phase 2)
 * 
 * Visual battle playback system - renders the arena combat
 * with animated ships, projectiles, explosions, and effects.
 */

export class BattleViewer {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.battle = null;
        this.replay = [];
        this.currentTick = 0;
        this.isPlaying = false;
        this.playbackSpeed = 1;
        this.lastFrameTime = 0;
        this.tickDuration = 500; // ms per battle tick
        
        // Ship positions and states
        this.ships = new Map();
        this.projectiles = [];
        this.explosions = [];
        this.damageNumbers = [];
        
        // Visual config
        this.arenaWidth = 800;
        this.arenaHeight = 600;
        this.shipSize = 24;
        
        // Colors
        this.colors = {
            attacker: '#ff6b6b',
            defender: '#4ecdc4',
            projectile: '#ffeb3b',
            explosion: '#ff9800',
            shield: '#2196f3',
            background: '#0a0a1a',
            grid: '#1a1a2e'
        };
    }

    /**
     * Load a battle for playback
     */
    loadBattle(battle) {
        this.battle = battle;
        this.replay = battle.replay || [];
        this.currentTick = 0;
        this.isPlaying = false;
        this.ships.clear();
        this.projectiles = [];
        this.explosions = [];
        this.damageNumbers = [];
        
        // Initialize ship positions from battle_start event
        const startEvent = this.replay.find(e => e.event === 'battle_start');
        if (startEvent) {
            this.initializeShips(battle, startEvent);
        }
    }

    /**
     * Initialize ship positions for visualization
     */
    initializeShips(battle, startEvent) {
        let attackerIndex = 0;
        let defenderIndex = 0;
        
        // Position attackers on left side
        for (const participant of battle.participants.attacker) {
            for (const shipId of participant.shipIds) {
                const y = 100 + (attackerIndex * 60) % (this.arenaHeight - 200);
                const x = 100 + Math.floor(attackerIndex / 8) * 50;
                
                this.ships.set(shipId, {
                    id: shipId,
                    side: 'attacker',
                    empireId: participant.empireId,
                    x: x,
                    y: y,
                    targetX: x,
                    targetY: y,
                    hp: 100,
                    maxHp: 100,
                    attack: 10,
                    alive: true,
                    rotation: 0,
                    scale: 1,
                    flash: 0
                });
                attackerIndex++;
            }
        }
        
        // Position defenders on right side
        for (const participant of battle.participants.defender) {
            for (const shipId of participant.shipIds) {
                const y = 100 + (defenderIndex * 60) % (this.arenaHeight - 200);
                const x = this.arenaWidth - 100 - Math.floor(defenderIndex / 8) * 50;
                
                this.ships.set(shipId, {
                    id: shipId,
                    side: 'defender',
                    empireId: participant.empireId,
                    x: x,
                    y: y,
                    targetX: x,
                    targetY: y,
                    hp: 100,
                    maxHp: 100,
                    attack: 10,
                    alive: true,
                    rotation: Math.PI,
                    scale: 1,
                    flash: 0
                });
                defenderIndex++;
            }
        }
    }

    /**
     * Start playback
     */
    play() {
        this.isPlaying = true;
        this.lastFrameTime = performance.now();
        this.animate();
    }

    /**
     * Pause playback
     */
    pause() {
        this.isPlaying = false;
    }

    /**
     * Reset to beginning
     */
    reset() {
        this.currentTick = 0;
        if (this.battle) {
            this.loadBattle(this.battle);
        }
    }

    /**
     * Main animation loop
     */
    animate() {
        if (!this.isPlaying) return;
        
        const now = performance.now();
        const deltaTime = now - this.lastFrameTime;
        
        // Advance tick based on playback speed
        if (deltaTime >= this.tickDuration / this.playbackSpeed) {
            this.advanceTick();
            this.lastFrameTime = now;
        }
        
        // Update animations
        this.updateProjectiles(deltaTime);
        this.updateExplosions(deltaTime);
        this.updateDamageNumbers(deltaTime);
        this.updateShips(deltaTime);
        
        // Render
        this.render();
        
        // Continue loop
        requestAnimationFrame(() => this.animate());
    }

    /**
     * Advance to next battle tick
     */
    advanceTick() {
        if (this.currentTick >= this.replay.length) {
            this.isPlaying = false;
            return;
        }
        
        const event = this.replay[this.currentTick];
        this.processEvent(event);
        this.currentTick++;
    }

    /**
     * Process a replay event
     */
    processEvent(event) {
        if (!event) return;
        
        switch (event.event) {
            case 'battle_start':
                // Already handled in loadBattle
                break;
                
            case 'round':
                this.processRound(event);
                break;
                
            case 'victory':
                this.processVictory(event);
                break;
                
            case 'draw':
                // Handle draw
                break;
        }
    }

    /**
     * Process a combat round
     */
    processRound(event) {
        if (!event.events) return;
        
        for (const subEvent of event.events) {
            if (subEvent.event === 'destroyed') {
                const ship = this.ships.get(subEvent.shipId);
                if (ship) {
                    ship.alive = false;
                    // Create explosion
                    this.explosions.push({
                        x: ship.x,
                        y: ship.y,
                        radius: 0,
                        maxRadius: 40,
                        alpha: 1,
                        color: this.colors.explosion
                    });
                }
            } else if (subEvent.event === 'hit') {
                const ship = this.ships.get(subEvent.shipId);
                if (ship) {
                    ship.hp = subEvent.remainingHp || (ship.hp - subEvent.damage);
                    ship.flash = 1;
                    
                    // Create damage number
                    this.damageNumbers.push({
                        x: ship.x,
                        y: ship.y - 20,
                        value: Math.floor(subEvent.damage),
                        alpha: 1,
                        vy: -2
                    });
                }
            }
        }
        
        // Create projectiles between ships
        this.createRoundProjectiles(event);
    }

    /**
     * Create projectile effects for a round
     */
    createRoundProjectiles(event) {
        const attackers = Array.from(this.ships.values()).filter(s => s.side === 'attacker' && s.alive);
        const defenders = Array.from(this.ships.values()).filter(s => s.side === 'defender' && s.alive);
        
        // Attackers fire at defenders
        for (const attacker of attackers) {
            if (defenders.length > 0) {
                const target = defenders[Math.floor(Math.random() * defenders.length)];
                this.projectiles.push({
                    x: attacker.x,
                    y: attacker.y,
                    targetX: target.x,
                    targetY: target.y,
                    speed: 15,
                    color: this.colors.attacker,
                    trail: []
                });
            }
        }
        
        // Defenders fire at attackers
        for (const defender of defenders) {
            if (attackers.length > 0) {
                const target = attackers[Math.floor(Math.random() * attackers.length)];
                this.projectiles.push({
                    x: defender.x,
                    y: defender.y,
                    targetX: target.x,
                    targetY: target.y,
                    speed: 15,
                    color: this.colors.defender,
                    trail: []
                });
            }
        }
    }

    /**
     * Process victory event
     */
    processVictory(event) {
        // Victory handled in render
    }

    /**
     * Update projectile positions
     */
    updateProjectiles(deltaTime) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            
            const dx = p.targetX - p.x;
            const dy = p.targetY - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < p.speed) {
                this.projectiles.splice(i, 1);
            } else {
                // Add to trail
                p.trail.push({ x: p.x, y: p.y });
                if (p.trail.length > 5) p.trail.shift();
                
                // Move toward target
                p.x += (dx / dist) * p.speed;
                p.y += (dy / dist) * p.speed;
            }
        }
    }

    /**
     * Update explosion animations
     */
    updateExplosions(deltaTime) {
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const e = this.explosions[i];
            e.radius += 3;
            e.alpha -= 0.05;
            
            if (e.alpha <= 0) {
                this.explosions.splice(i, 1);
            }
        }
    }

    /**
     * Update damage number animations
     */
    updateDamageNumbers(deltaTime) {
        for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
            const d = this.damageNumbers[i];
            d.y += d.vy;
            d.alpha -= 0.02;
            
            if (d.alpha <= 0) {
                this.damageNumbers.splice(i, 1);
            }
        }
    }

    /**
     * Update ship animations
     */
    updateShips(deltaTime) {
        for (const ship of this.ships.values()) {
            // Decay flash effect
            if (ship.flash > 0) {
                ship.flash -= 0.1;
            }
            
            // Slight movement animation
            ship.x += (Math.random() - 0.5) * 0.5;
            ship.y += (Math.random() - 0.5) * 0.5;
        }
    }

    /**
     * Main render function
     */
    render() {
        const ctx = this.ctx;
        
        // Clear and draw background
        ctx.fillStyle = this.colors.background;
        ctx.fillRect(0, 0, this.arenaWidth, this.arenaHeight);
        
        // Draw grid
        this.drawGrid();
        
        // Draw center line
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 5]);
        ctx.beginPath();
        ctx.moveTo(this.arenaWidth / 2, 0);
        ctx.lineTo(this.arenaWidth / 2, this.arenaHeight);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Draw ships
        this.renderShips();
        
        // Draw projectiles
        this.renderProjectiles();
        
        // Draw explosions
        this.renderExplosions();
        
        // Draw damage numbers
        this.renderDamageNumbers();
        
        // Draw HUD
        this.renderHUD();
        
        // Draw victory screen if battle complete
        if (this.currentTick >= this.replay.length) {
            this.renderVictoryScreen();
        }
    }

    /**
     * Draw background grid
     */
    drawGrid() {
        const ctx = this.ctx;
        ctx.strokeStyle = this.colors.grid;
        ctx.lineWidth = 1;
        
        const gridSize = 50;
        for (let x = 0; x < this.arenaWidth; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.arenaHeight);
            ctx.stroke();
        }
        for (let y = 0; y < this.arenaHeight; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.arenaWidth, y);
            ctx.stroke();
        }
    }

    /**
     * Render all ships
     */
    renderShips() {
        const ctx = this.ctx;
        
        for (const ship of this.ships.values()) {
            if (!ship.alive) continue;
            
            ctx.save();
            ctx.translate(ship.x, ship.y);
            ctx.rotate(ship.rotation);
            
            // Flash effect when hit
            if (ship.flash > 0) {
                ctx.shadowColor = '#fff';
                ctx.shadowBlur = 20;
            }
            
            // Ship body (triangle)
            const color = ship.side === 'attacker' ? this.colors.attacker : this.colors.defender;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(this.shipSize / 2, 0);
            ctx.lineTo(-this.shipSize / 2, -this.shipSize / 3);
            ctx.lineTo(-this.shipSize / 2, this.shipSize / 3);
            ctx.closePath();
            ctx.fill();
            
            // Engine glow
            ctx.fillStyle = '#ff0';
            ctx.beginPath();
            ctx.arc(-this.shipSize / 2 - 5, 0, 4, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.restore();
            
            // Health bar
            this.renderHealthBar(ship);
        }
    }

    /**
     * Render ship health bar
     */
    renderHealthBar(ship) {
        const ctx = this.ctx;
        const barWidth = 30;
        const barHeight = 4;
        const x = ship.x - barWidth / 2;
        const y = ship.y - this.shipSize / 2 - 10;
        
        // Background
        ctx.fillStyle = '#333';
        ctx.fillRect(x, y, barWidth, barHeight);
        
        // Health
        const healthPercent = Math.max(0, ship.hp / ship.maxHp);
        const healthColor = healthPercent > 0.5 ? '#4caf50' : healthPercent > 0.25 ? '#ff9800' : '#f44336';
        ctx.fillStyle = healthColor;
        ctx.fillRect(x, y, barWidth * healthPercent, barHeight);
    }

    /**
     * Render projectiles
     */
    renderProjectiles() {
        const ctx = this.ctx;
        
        for (const p of this.projectiles) {
            // Draw trail
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            for (let i = 0; i < p.trail.length; i++) {
                const t = p.trail[i];
                if (i === 0) ctx.moveTo(t.x, t.y);
                else ctx.lineTo(t.x, t.y);
            }
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
            ctx.globalAlpha = 1;
            
            // Draw projectile
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }
    }

    /**
     * Render explosions
     */
    renderExplosions() {
        const ctx = this.ctx;
        
        for (const e of this.explosions) {
            ctx.globalAlpha = e.alpha;
            
            // Outer ring
            ctx.strokeStyle = e.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
            ctx.stroke();
            
            // Inner glow
            const gradient = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.radius);
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
            gradient.addColorStop(0.5, e.color);
            gradient.addColorStop(1, 'transparent');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.globalAlpha = 1;
        }
    }

    /**
     * Render floating damage numbers
     */
    renderDamageNumbers() {
        const ctx = this.ctx;
        
        for (const d of this.damageNumbers) {
            ctx.globalAlpha = d.alpha;
            ctx.fillStyle = '#ff0';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`-${d.value}`, d.x, d.y);
            ctx.globalAlpha = 1;
        }
    }

    /**
     * Render battle HUD
     */
    renderHUD() {
        const ctx = this.ctx;
        
        // Count surviving ships
        const attackerCount = Array.from(this.ships.values()).filter(s => s.side === 'attacker' && s.alive).length;
        const defenderCount = Array.from(this.ships.values()).filter(s => s.side === 'defender' && s.alive).length;
        
        // Left side - Attackers
        ctx.fillStyle = this.colors.attacker;
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`ATTACKERS: ${attackerCount}`, 20, 30);
        
        // Right side - Defenders
        ctx.fillStyle = this.colors.defender;
        ctx.textAlign = 'right';
        ctx.fillText(`DEFENDERS: ${defenderCount}`, this.arenaWidth - 20, 30);
        
        // Center - Round info
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(`ROUND ${this.currentTick + 1}/${this.replay.length}`, this.arenaWidth / 2, 30);
        
        // Playback controls hint
        ctx.font = '12px Arial';
        ctx.fillStyle = '#666';
        ctx.fillText('SPACE: Play/Pause | R: Reset | +/-: Speed', this.arenaWidth / 2, this.arenaHeight - 20);
    }

    /**
     * Render victory screen
     */
    renderVictoryScreen() {
        const ctx = this.ctx;
        const victoryEvent = this.replay.find(e => e.event === 'victory');
        
        if (!victoryEvent) return;
        
        // Darken background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, this.arenaWidth, this.arenaHeight);
        
        // Victory text
        const winner = victoryEvent.winner;
        const color = winner === 'attacker' ? this.colors.attacker : 
                      winner === 'defender' ? this.colors.defender : '#fff';
        
        ctx.fillStyle = color;
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const text = winner === 'draw' ? 'DRAW!' : `${winner.toUpperCase()} WINS!`;
        ctx.fillText(text, this.arenaWidth / 2, this.arenaHeight / 2);
        
        // Stats
        ctx.font = '20px Arial';
        ctx.fillStyle = '#fff';
        const stats = `Survivors: ${victoryEvent.attackerSurvivors || 0} attackers, ${victoryEvent.defenderSurvivors || 0} defenders`;
        ctx.fillText(stats, this.arenaWidth / 2, this.arenaHeight / 2 + 50);
    }

    /**
     * Handle keyboard input
     */
    handleKeyDown(e) {
        switch (e.code) {
            case 'Space':
                if (this.isPlaying) this.pause();
                else this.play();
                e.preventDefault();
                break;
            case 'KeyR':
                this.reset();
                break;
            case 'Equal':
            case 'NumpadAdd':
                this.playbackSpeed = Math.min(4, this.playbackSpeed * 2);
                break;
            case 'Minus':
            case 'NumpadSubtract':
                this.playbackSpeed = Math.max(0.25, this.playbackSpeed / 2);
                break;
        }
    }

    /**
     * Set canvas size
     */
    setSize(width, height) {
        this.arenaWidth = width;
        this.arenaHeight = height;
        this.canvas.width = width;
        this.canvas.height = height;
    }
}

/**
 * Create and show battle viewer modal
 */
export function showBattleViewer(battle) {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.id = 'battle-viewer-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
    `;
    
    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    canvas.style.cssText = `
        border: 2px solid #333;
        border-radius: 8px;
    `;
    
    // Create controls
    const controls = document.createElement('div');
    controls.style.cssText = `
        margin-top: 20px;
        display: flex;
        gap: 10px;
    `;
    
    const playBtn = document.createElement('button');
    playBtn.textContent = '▶ Play';
    playBtn.style.cssText = 'padding: 10px 20px; font-size: 16px; cursor: pointer;';
    
    const resetBtn = document.createElement('button');
    resetBtn.textContent = '↺ Reset';
    resetBtn.style.cssText = 'padding: 10px 20px; font-size: 16px; cursor: pointer;';
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕ Close';
    closeBtn.style.cssText = 'padding: 10px 20px; font-size: 16px; cursor: pointer;';
    
    controls.appendChild(playBtn);
    controls.appendChild(resetBtn);
    controls.appendChild(closeBtn);
    
    overlay.appendChild(canvas);
    overlay.appendChild(controls);
    document.body.appendChild(overlay);
    
    // Initialize viewer
    const ctx = canvas.getContext('2d');
    const viewer = new BattleViewer(canvas, ctx);
    viewer.loadBattle(battle);
    viewer.render();
    
    // Event handlers
    playBtn.onclick = () => {
        if (viewer.isPlaying) {
            viewer.pause();
            playBtn.textContent = '▶ Play';
        } else {
            viewer.play();
            playBtn.textContent = '⏸ Pause';
        }
    };
    
    resetBtn.onclick = () => {
        viewer.reset();
        viewer.render();
        playBtn.textContent = '▶ Play';
    };
    
    closeBtn.onclick = () => {
        viewer.pause();
        overlay.remove();
    };
    
    // Keyboard handler
    const keyHandler = (e) => viewer.handleKeyDown(e);
    document.addEventListener('keydown', keyHandler);
    
    // Clean up on close
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            viewer.pause();
            document.removeEventListener('keydown', keyHandler);
            overlay.remove();
        }
    });
    
    return viewer;
}
