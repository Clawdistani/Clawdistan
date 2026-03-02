/**
 * Battle Arena Viewer (Phase 2 + 3)
 * 
 * Visual battle playback + live spectating system.
 * Phase 3: Live mode, real-time reinforcements, countdown timer
 * 
 * Performance: Object pooling for projectiles, explosions, damage numbers
 * to reduce garbage collection overhead during animations.
 */

import { 
    createProjectilePool, 
    createExplosionPool, 
    createDamageNumberPool, 
    createWarpEffectPool 
} from './utils/object-pool.js';

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
        this.tickDuration = 500;
        
        // Live mode (Phase 3)
        this.isLiveMode = false;
        this.gameTick = 0;
        this.onClose = null;
        
        // Visual elements (now using object pools for performance)
        this.ships = new Map();
        this.projectiles = [];
        this.explosions = [];
        this.damageNumbers = [];
        this.warpEffects = [];
        this.notifications = [];
        
        // Object pools - reduce GC overhead during battles
        this._projectilePool = createProjectilePool(50);
        this._explosionPool = createExplosionPool(30);
        this._damageNumberPool = createDamageNumberPool(40);
        this._warpEffectPool = createWarpEffectPool(10);
        
        // Config
        this.arenaWidth = 800;
        this.arenaHeight = 600;
        this.shipSize = 24;
        
        this.colors = {
            attacker: '#ff6b6b',
            defender: '#4ecdc4',
            projectile: '#ffeb3b',
            explosion: '#ff9800',
            shield: '#2196f3',
            background: '#0a0a1a',
            grid: '#1a1a2e',
            warp: '#9c27b0',
            timer: '#ffeb3b'
        };
    }

    loadBattle(battle) {
        this.battle = battle;
        this.replay = battle.replay || [];
        this.currentTick = 0;
        this.isPlaying = false;
        this.isLiveMode = false;
        this.ships.clear();
        
        // Release pooled objects back to pools
        this._releaseAllPooledObjects();
        this.notifications = [];
        
        const startEvent = this.replay.find(e => e.event === 'battle_start');
        if (startEvent) this.initializeShips(battle, startEvent);
    }

    loadLiveBattle(battle, gameTick) {
        this.battle = battle;
        this.gameTick = gameTick;
        this.isLiveMode = true;
        this.isPlaying = true;
        this.ships.clear();
        
        // Release pooled objects back to pools
        this._releaseAllPooledObjects();
        this.notifications = [];
        
        this.initializeShipsFromParticipants(battle);
        this.lastFrameTime = performance.now();
        this.animateLive();
    }
    
    /**
     * Release all active pooled objects back to their pools
     */
    _releaseAllPooledObjects() {
        // Release projectiles
        for (const p of this.projectiles) {
            this._projectilePool.release(p);
        }
        this.projectiles = [];
        
        // Release explosions
        for (const e of this.explosions) {
            this._explosionPool.release(e);
        }
        this.explosions = [];
        
        // Release damage numbers
        for (const d of this.damageNumbers) {
            this._damageNumberPool.release(d);
        }
        this.damageNumbers = [];
        
        // Release warp effects
        for (const w of this.warpEffects) {
            this._warpEffectPool.release(w);
        }
        this.warpEffects = [];
    }

    initializeShipsFromParticipants(battle) {
        let attackerIndex = 0, defenderIndex = 0;
        
        for (const participant of (battle.participants?.attacker || [])) {
            for (const shipId of participant.shipIds) {
                const y = 100 + (attackerIndex * 60) % (this.arenaHeight - 200);
                const x = 100 + Math.floor(attackerIndex / 8) * 50;
                this.ships.set(shipId, {
                    id: shipId, side: 'attacker', empireId: participant.empireId,
                    x, y, hp: 100, maxHp: 100, alive: true, rotation: 0, scale: 1, flash: 0,
                    warpingIn: participant.warpingIn || false, warpProgress: participant.warpingIn ? 0 : 1
                });
                attackerIndex++;
            }
        }
        
        for (const participant of (battle.participants?.defender || [])) {
            for (const shipId of participant.shipIds) {
                const y = 100 + (defenderIndex * 60) % (this.arenaHeight - 200);
                const x = this.arenaWidth - 100 - Math.floor(defenderIndex / 8) * 50;
                this.ships.set(shipId, {
                    id: shipId, side: 'defender', empireId: participant.empireId,
                    x, y, hp: 100, maxHp: 100, alive: true, rotation: Math.PI, scale: 1, flash: 0,
                    warpingIn: participant.warpingIn || false, warpProgress: participant.warpingIn ? 0 : 1
                });
                defenderIndex++;
            }
        }
    }

    updateLiveBattle(battle, gameTick) {
        if (!this.isLiveMode) return;
        this.gameTick = gameTick;
        const oldBattle = this.battle;
        this.battle = battle;
        
        this.checkForReinforcements(oldBattle, battle);
        
        if (oldBattle.state !== battle.state) {
            if (battle.state === 'resolving') {
                this.addNotification('⚔️ BATTLE COMMENCING!', this.colors.explosion);
            } else if (battle.state === 'complete') {
                const winner = battle.result?.winner?.toUpperCase() || 'UNKNOWN';
                this.addNotification(🏆 +winner+ WINS!, 
                    battle.result?.winner === 'attacker' ? this.colors.attacker : this.colors.defender);
                this.isLiveMode = false;
                this.replay = battle.replay || [];
                this.currentTick = 0;
            }
        }
    }

    checkForReinforcements(oldBattle, newBattle) {
        const getCount = (b, side) => (b?.participants?.[side] || []).reduce((sum, p) => sum + p.shipIds.length, 0);
        const oldA = getCount(oldBattle, 'attacker'), newA = getCount(newBattle, 'attacker');
        const oldD = getCount(oldBattle, 'defender'), newD = getCount(newBattle, 'defender');
        
        if (newA > oldA) {
            this.addNotification(++(newA - oldA)+ ships joining ATTACKERS!, this.colors.attacker);
            this.addReinforcementShips(newBattle, 'attacker', newA - oldA);
        }
        if (newD > oldD) {
            this.addNotification(++(newD - oldD)+ ships joining DEFENDERS!, this.colors.defender);
            this.addReinforcementShips(newBattle, 'defender', newD - oldD);
        }
    }

    addReinforcementShips(battle, side, count) {
        const participants = battle.participants?.[side] || [];
        let added = 0;
        for (const p of participants) {
            for (const shipId of p.shipIds) {
                if (!this.ships.has(shipId) && added < count) {
                    const existing = Array.from(this.ships.values()).filter(s => s.side === side).length;
                    const y = 100 + (existing * 60) % (this.arenaHeight - 200);
                    const x = side === 'attacker' ? 100 + Math.floor(existing / 8) * 50 : this.arenaWidth - 100 - Math.floor(existing / 8) * 50;
                    this.ships.set(shipId, {
                        id: shipId, side, empireId: p.empireId, x, y, hp: 100, maxHp: 100,
                        alive: true, rotation: side === 'attacker' ? 0 : Math.PI, scale: 0, flash: 0, warpingIn: true, warpProgress: 0
                    });
                    this.addWarpEffect(x, y, side);
                    added++;
                }
            }
        }
    }

    addWarpEffect(x, y, side) {
        const effect = this._warpEffectPool.acquire();
        effect.x = x;
        effect.y = y;
        effect.radius = 0;
        effect.maxRadius = 60;
        effect.alpha = 1;
        effect.color = side === 'attacker' ? this.colors.attacker : this.colors.defender;
        this.warpEffects.push(effect);
    }

    addNotification(text, color) {
        this.notifications.push({ text, color, alpha: 1, y: this.arenaHeight / 2, startTime: performance.now() });
    }

    initializeShips(battle, startEvent) {
        let aI = 0, dI = 0;
        for (const p of battle.participants.attacker) {
            for (const shipId of p.shipIds) {
                const y = 100 + (aI * 60) % (this.arenaHeight - 200), x = 100 + Math.floor(aI / 8) * 50;
                this.ships.set(shipId, { id: shipId, side: 'attacker', empireId: p.empireId, x, y, hp: 100, maxHp: 100, alive: true, rotation: 0, scale: 1, flash: 0, warpingIn: false, warpProgress: 1 });
                aI++;
            }
        }
        for (const p of battle.participants.defender) {
            for (const shipId of p.shipIds) {
                const y = 100 + (dI * 60) % (this.arenaHeight - 200), x = this.arenaWidth - 100 - Math.floor(dI / 8) * 50;
                this.ships.set(shipId, { id: shipId, side: 'defender', empireId: p.empireId, x, y, hp: 100, maxHp: 100, alive: true, rotation: Math.PI, scale: 1, flash: 0, warpingIn: false, warpProgress: 1 });
                dI++;
            }
        }
    }

    play() { this.isPlaying = true; this.lastFrameTime = performance.now(); this.animate(); }
    pause() { this.isPlaying = false; }
    reset() { this.currentTick = 0; if (this.battle) this.loadBattle(this.battle); }

    animate() {
        if (!this.isPlaying || this.isLiveMode) return;
        const now = performance.now(), dt = now - this.lastFrameTime;
        if (dt >= this.tickDuration / this.playbackSpeed) { this.advanceTick(); this.lastFrameTime = now; }
        this.updateAnimations(dt);
        this.render();
        requestAnimationFrame(() => this.animate());
    }

    animateLive() {
        if (!this.isLiveMode) { if (this.replay?.length) this.play(); return; }
        const now = performance.now(), dt = now - this.lastFrameTime;
        this.lastFrameTime = now;
        this.updateAnimations(dt);
        this.updateWarpEffects();
        this.updateNotifications();
        this.renderLive();
        requestAnimationFrame(() => this.animateLive());
    }

    advanceTick() {
        if (this.currentTick >= this.replay.length) { this.isPlaying = false; return; }
        this.processEvent(this.replay[this.currentTick]);
        this.currentTick++;
    }

    processEvent(e) {
        if (!e) return;
        if (e.event === 'round') this.processRound(e);
    }

    processRound(event) {
        for (const se of (event.events || [])) {
            if (se.event === 'destroyed') {
                const s = this.ships.get(se.shipId);
                if (s) { 
                    s.alive = false; 
                    // Use pooled explosion
                    const explosion = this._explosionPool.acquire();
                    explosion.x = s.x;
                    explosion.y = s.y;
                    explosion.radius = 0;
                    explosion.maxRadius = 40;
                    explosion.alpha = 1;
                    explosion.color = this.colors.explosion;
                    this.explosions.push(explosion);
                }
            } else if (se.event === 'hit') {
                const s = this.ships.get(se.shipId);
                if (s) { 
                    s.hp = se.remainingHp || (s.hp - se.damage); 
                    s.flash = 1; 
                    // Use pooled damage number
                    const dmgNum = this._damageNumberPool.acquire();
                    dmgNum.x = s.x;
                    dmgNum.y = s.y - 20;
                    dmgNum.value = Math.floor(se.damage);
                    dmgNum.alpha = 1;
                    dmgNum.vy = -2;
                    this.damageNumbers.push(dmgNum);
                }
            }
        }
        this.createRoundProjectiles();
    }

    createRoundProjectiles() {
        const att = Array.from(this.ships.values()).filter(s => s.side === 'attacker' && s.alive);
        const def = Array.from(this.ships.values()).filter(s => s.side === 'defender' && s.alive);
        
        for (const a of att) {
            if (def.length) { 
                const t = def[Math.floor(Math.random() * def.length)]; 
                // Use pooled projectile
                const proj = this._projectilePool.acquire();
                proj.x = a.x;
                proj.y = a.y;
                proj.targetX = t.x;
                proj.targetY = t.y;
                proj.speed = 15;
                proj.color = this.colors.attacker;
                proj.trail.length = 0; // Clear trail
                this.projectiles.push(proj);
            }
        }
        
        for (const d of def) {
            if (att.length) { 
                const t = att[Math.floor(Math.random() * att.length)]; 
                // Use pooled projectile
                const proj = this._projectilePool.acquire();
                proj.x = d.x;
                proj.y = d.y;
                proj.targetX = t.x;
                proj.targetY = t.y;
                proj.speed = 15;
                proj.color = this.colors.defender;
                proj.trail.length = 0; // Clear trail
                this.projectiles.push(proj);
            }
        }
    }

    updateAnimations(dt) {
        // Update projectiles - release completed ones back to pool
        const activeProjectiles = [];
        for (const p of this.projectiles) {
            const dx = p.targetX - p.x, dy = p.targetY - p.y, d = Math.sqrt(dx*dx + dy*dy);
            if (d < p.speed) {
                // Projectile reached target - release to pool
                this._projectilePool.release(p);
            } else { 
                p.trail.push({ x: p.x, y: p.y }); 
                if (p.trail.length > 5) p.trail.shift(); 
                p.x += (dx/d)*p.speed; 
                p.y += (dy/d)*p.speed;
                activeProjectiles.push(p);
            }
        }
        this.projectiles = activeProjectiles;
        
        // Update explosions - release faded ones back to pool
        const activeExplosions = [];
        for (const e of this.explosions) { 
            e.radius += 3; 
            e.alpha -= 0.05; 
            if (e.alpha <= 0) {
                this._explosionPool.release(e);
            } else {
                activeExplosions.push(e);
            }
        }
        this.explosions = activeExplosions;
        
        // Update damage numbers - release faded ones back to pool
        const activeDamageNumbers = [];
        for (const d of this.damageNumbers) { 
            d.y += d.vy; 
            d.alpha -= 0.02; 
            if (d.alpha <= 0) {
                this._damageNumberPool.release(d);
            } else {
                activeDamageNumbers.push(d);
            }
        }
        this.damageNumbers = activeDamageNumbers;
        
        // Update ships
        for (const s of this.ships.values()) {
            if (s.flash > 0) s.flash -= 0.1;
            if (s.warpingIn && s.warpProgress < 1) { s.warpProgress = Math.min(1, s.warpProgress + 0.02); s.scale = s.warpProgress; }
            s.x += (Math.random() - 0.5) * 0.5; s.y += (Math.random() - 0.5) * 0.5;
        }
    }

    updateWarpEffects() { 
        const activeWarpEffects = [];
        for (const e of this.warpEffects) { 
            e.radius += 4; 
            e.alpha -= 0.03; 
            if (e.alpha <= 0) {
                this._warpEffectPool.release(e);
            } else {
                activeWarpEffects.push(e);
            }
        }
        this.warpEffects = activeWarpEffects;
    }
    
    updateNotifications() { const now = performance.now(); for (let i = this.notifications.length - 1; i >= 0; i--) { const n = this.notifications[i]; if (now - n.startTime > 3000) { n.alpha -= 0.05; if (n.alpha <= 0) this.notifications.splice(i, 1); } n.y -= 0.3; } }

    render() {
        const ctx = this.ctx;
        ctx.fillStyle = this.colors.background; ctx.fillRect(0, 0, this.arenaWidth, this.arenaHeight);
        this.drawGrid(); this.drawCenterLine(); this.renderShips(); this.renderProjectiles(); this.renderExplosions(); this.renderDamageNumbers(); this.renderHUD();
        if (this.currentTick >= this.replay.length) this.renderVictoryScreen();
    }

    renderLive() {
        const ctx = this.ctx;
        ctx.fillStyle = this.colors.background; ctx.fillRect(0, 0, this.arenaWidth, this.arenaHeight);
        this.drawGrid(); this.drawCenterLine(); this.renderWarpEffects(); this.renderShips(); this.renderProjectiles(); this.renderExplosions(); this.renderDamageNumbers(); this.renderLiveHUD(); this.renderNotifications();
    }

    drawGrid() { const ctx = this.ctx; ctx.strokeStyle = this.colors.grid; ctx.lineWidth = 1; for (let x = 0; x < this.arenaWidth; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.arenaHeight); ctx.stroke(); } for (let y = 0; y < this.arenaHeight; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.arenaWidth, y); ctx.stroke(); } }
    drawCenterLine() { const ctx = this.ctx; ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.setLineDash([10, 5]); ctx.beginPath(); ctx.moveTo(this.arenaWidth / 2, 0); ctx.lineTo(this.arenaWidth / 2, this.arenaHeight); ctx.stroke(); ctx.setLineDash([]); }

    renderShips() {
        const ctx = this.ctx;
        for (const s of this.ships.values()) {
            if (!s.alive) continue;
            ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rotation); ctx.scale(s.scale, s.scale);
            if (s.flash > 0) { ctx.shadowColor = '#fff'; ctx.shadowBlur = 20; }
            if (s.warpingIn && s.warpProgress < 1) ctx.globalAlpha = s.warpProgress;
            ctx.fillStyle = s.side === 'attacker' ? this.colors.attacker : this.colors.defender;
            ctx.beginPath(); ctx.moveTo(this.shipSize / 2, 0); ctx.lineTo(-this.shipSize / 2, -this.shipSize / 3); ctx.lineTo(-this.shipSize / 2, this.shipSize / 3); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#ff0'; ctx.beginPath(); ctx.arc(-this.shipSize / 2 - 5, 0, 4, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            if (s.scale >= 1) this.renderHealthBar(s);
        }
    }

    renderHealthBar(s) { const ctx = this.ctx, w = 30, h = 4, x = s.x - w/2, y = s.y - this.shipSize/2 - 10; ctx.fillStyle = '#333'; ctx.fillRect(x, y, w, h); const hp = Math.max(0, s.hp / s.maxHp); ctx.fillStyle = hp > 0.5 ? '#4caf50' : hp > 0.25 ? '#ff9800' : '#f44336'; ctx.fillRect(x, y, w * hp, h); }
    renderProjectiles() { const ctx = this.ctx; for (const p of this.projectiles) { ctx.strokeStyle = p.color; ctx.lineWidth = 2; ctx.globalAlpha = 0.5; ctx.beginPath(); for (let i = 0; i < p.trail.length; i++) { if (i === 0) ctx.moveTo(p.trail[i].x, p.trail[i].y); else ctx.lineTo(p.trail[i].x, p.trail[i].y); } ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.globalAlpha = 1; ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; } }
    renderExplosions() { const ctx = this.ctx; for (const e of this.explosions) { ctx.globalAlpha = e.alpha; ctx.strokeStyle = e.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2); ctx.stroke(); const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.radius); g.addColorStop(0, 'rgba(255,255,255,0.8)'); g.addColorStop(0.5, e.color); g.addColorStop(1, 'transparent'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; } }
    renderWarpEffects() { const ctx = this.ctx; for (const e of this.warpEffects) { ctx.globalAlpha = e.alpha; ctx.strokeStyle = this.colors.warp; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = e.color; ctx.beginPath(); ctx.arc(e.x, e.y, e.radius * 0.7, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; } }
    renderDamageNumbers() { const ctx = this.ctx; for (const d of this.damageNumbers) { ctx.globalAlpha = d.alpha; ctx.fillStyle = '#ff0'; ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center'; ctx.fillText(-+d.value, d.x, d.y); ctx.globalAlpha = 1; } }
    renderNotifications() { const ctx = this.ctx; for (const n of this.notifications) { ctx.globalAlpha = n.alpha; ctx.fillStyle = n.color; ctx.font = 'bold 24px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.shadowColor = '#000'; ctx.shadowBlur = 4; ctx.fillText(n.text, this.arenaWidth / 2, n.y); ctx.shadowBlur = 0; ctx.globalAlpha = 1; } }

    renderHUD() {
        const ctx = this.ctx, aC = Array.from(this.ships.values()).filter(s => s.side === 'attacker' && s.alive).length, dC = Array.from(this.ships.values()).filter(s => s.side === 'defender' && s.alive).length;
        ctx.fillStyle = this.colors.attacker; ctx.font = 'bold 18px Arial'; ctx.textAlign = 'left'; ctx.fillText(ATTACKERS: +aC, 20, 30);
        ctx.fillStyle = this.colors.defender; ctx.textAlign = 'right'; ctx.fillText(DEFENDERS: +dC, this.arenaWidth - 20, 30);
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(ROUND +(this.currentTick + 1)+/+this.replay.length, this.arenaWidth / 2, 30);
        ctx.font = '12px Arial'; ctx.fillStyle = '#666'; ctx.fillText('SPACE: Play/Pause | R: Reset | +/-: Speed', this.arenaWidth / 2, this.arenaHeight - 20);
    }

    renderLiveHUD() {
        const ctx = this.ctx, aC = Array.from(this.ships.values()).filter(s => s.side === 'attacker' && s.alive).length, dC = Array.from(this.ships.values()).filter(s => s.side === 'defender' && s.alive).length;
        ctx.fillStyle = this.colors.attacker; ctx.font = 'bold 18px Arial'; ctx.textAlign = 'left'; ctx.fillText(ATTACKERS: +aC, 20, 30);
        ctx.fillStyle = this.colors.defender; ctx.textAlign = 'right'; ctx.fillText(DEFENDERS: +dC, this.arenaWidth - 20, 30);
        ctx.fillStyle = '#f44336'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center'; ctx.fillText('LIVE', this.arenaWidth / 2, 20);
        if (this.battle) {
            const st = this.battle.state; let txt = '', col = '#fff';
            if (st === 'gathering') { const t = Math.max(0, (this.battle.resolveTick || 0) - this.gameTick); txt = 'GATHERING: '+t+'s'; col = this.colors.timer; }
            else if (st === 'resolving') { txt = 'BATTLE IN PROGRESS'; col = this.colors.explosion; }
            else if (st === 'complete') { txt = 'BATTLE COMPLETE'; col = '#4caf50'; }
            ctx.fillStyle = col; ctx.font = 'bold 16px Arial'; ctx.fillText(txt, this.arenaWidth / 2, 45);
        }
        ctx.font = '12px Arial'; ctx.fillStyle = '#666'; ctx.fillText('ESC: Close', this.arenaWidth / 2, this.arenaHeight - 20);
    }

    renderVictoryScreen() {
        const ctx = this.ctx, ve = this.replay.find(e => e.event === 'victory'); if (!ve) return;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; ctx.fillRect(0, 0, this.arenaWidth, this.arenaHeight);
        const w = ve.winner, c = w === 'attacker' ? this.colors.attacker : w === 'defender' ? this.colors.defender : '#fff';
        ctx.fillStyle = c; ctx.font = 'bold 48px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(w === 'draw' ? 'DRAW!' : w.toUpperCase()+ WINS!, this.arenaWidth / 2, this.arenaHeight / 2);
        ctx.font = '20px Arial'; ctx.fillStyle = '#fff'; ctx.fillText(Survivors: +(ve.attackerSurvivors || 0)+ attackers, +(ve.defenderSurvivors || 0)+ defenders, this.arenaWidth / 2, this.arenaHeight / 2 + 50);
    }

    handleKeyDown(e) {
        if (this.isLiveMode) { if (e.code === 'Escape' && this.onClose) this.onClose(); return; }
        switch (e.code) {
            case 'Space': if (this.isPlaying) this.pause(); else this.play(); e.preventDefault(); break;
            case 'KeyR': this.reset(); break;
            case 'Equal': case 'NumpadAdd': this.playbackSpeed = Math.min(4, this.playbackSpeed * 2); break;
            case 'Minus': case 'NumpadSubtract': this.playbackSpeed = Math.max(0.25, this.playbackSpeed / 2); break;
            case 'Escape': if (this.onClose) this.onClose(); break;
        }
    }

    setSize(w, h) { this.arenaWidth = w; this.arenaHeight = h; this.canvas.width = w; this.canvas.height = h; }
    
    /**
     * Get pool statistics for debugging/monitoring
     */
    getPoolStats() {
        return {
            projectiles: this._projectilePool.getStats(),
            explosions: this._explosionPool.getStats(),
            damageNumbers: this._damageNumberPool.getStats(),
            warpEffects: this._warpEffectPool.getStats()
        };
    }
}

export function showBattleViewer(battle) { return createBattleModal(battle, false, 0); }
export function showLiveBattleViewer(battle, gameTick) { return createBattleModal(battle, true, gameTick); }

function createBattleModal(battle, isLive, gameTick) {
    const overlay = document.createElement('div');
    overlay.id = 'battle-viewer-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:10000;display:flex;align-items:center;justify-content:center;flex-direction:column;';
    
    const canvas = document.createElement('canvas');
    canvas.width = 800; canvas.height = 600;
    canvas.style.cssText = 'border:2px solid #333;border-radius:8px;';
    
    const controls = document.createElement('div');
    controls.style.cssText = 'margin-top:20px;display:flex;gap:10px;';
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = 'padding:10px 20px;font-size:16px;cursor:pointer;';
    controls.appendChild(closeBtn);
    
    if (!isLive) {
        const playBtn = document.createElement('button');
        playBtn.textContent = 'Play';
        playBtn.style.cssText = 'padding:10px 20px;font-size:16px;cursor:pointer;';
        const resetBtn = document.createElement('button');
        resetBtn.textContent = 'Reset';
        resetBtn.style.cssText = 'padding:10px 20px;font-size:16px;cursor:pointer;';
        controls.insertBefore(playBtn, closeBtn);
        controls.insertBefore(resetBtn, closeBtn);
        playBtn.onclick = () => { if (viewer.isPlaying) { viewer.pause(); playBtn.textContent = 'Play'; } else { viewer.play(); playBtn.textContent = 'Pause'; } };
        resetBtn.onclick = () => { viewer.reset(); viewer.render(); playBtn.textContent = 'Play'; };
    }
    
    overlay.appendChild(canvas);
    overlay.appendChild(controls);
    document.body.appendChild(overlay);
    
    const ctx = canvas.getContext('2d');
    const viewer = new BattleViewer(canvas, ctx);
    
    const closeModal = () => { viewer.pause(); viewer.isLiveMode = false; document.removeEventListener('keydown', keyHandler); overlay.remove(); };
    viewer.onClose = closeModal;
    closeBtn.onclick = closeModal;
    
    const keyHandler = (e) => viewer.handleKeyDown(e);
    document.addEventListener('keydown', keyHandler);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    
    if (isLive) viewer.loadLiveBattle(battle, gameTick);
    else { viewer.loadBattle(battle); viewer.render(); }
    
    return viewer;
}
