/**
 * Battle Arena UI (Phase 2)
 * 
 * UI components for battle arena system:
 * - Battle indicators on the map
 * - Spectate buttons
 * - Battle list panel
 */

import { showBattleViewer } from '../battle-viewer.js';

export class BattleUI {
    constructor(gameState) {
        this.gameState = gameState;
        this.activeBattles = [];
        this.selectedBattle = null;
        this.panel = null;
    }

    /**
     * Update with current game state
     */
    update(state) {
        this.activeBattles = state.activeBattles || [];
        this.updatePanel();
    }

    /**
     * Create or update the battle list panel
     */
    updatePanel() {
        if (!this.panel) {
            this.createPanel();
        }
        
        this.renderBattleList();
    }

    /**
     * Create the battle panel
     */
    createPanel() {
        this.panel = document.createElement('div');
        this.panel.id = 'battle-panel';
        this.panel.style.cssText = `
            position: fixed;
            top: 60px;
            right: 10px;
            width: 280px;
            background: rgba(10, 10, 26, 0.95);
            border: 1px solid #333;
            border-radius: 8px;
            padding: 15px;
            color: #fff;
            font-family: 'Courier New', monospace;
            z-index: 1000;
            max-height: 400px;
            overflow-y: auto;
            display: none;
        `;
        
        document.body.appendChild(this.panel);
    }

    /**
     * Render the list of active battles
     */
    renderBattleList() {
        if (!this.panel) return;
        
        if (this.activeBattles.length === 0) {
            this.panel.style.display = 'none';
            return;
        }
        
        this.panel.style.display = 'block';
        
        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h3 style="margin: 0; color: #ff6b6b;">⚔️ Active Battles</h3>
                <span style="color: #666;">${this.activeBattles.length}</span>
            </div>
        `;
        
        for (const battle of this.activeBattles) {
            const isGathering = battle.state === 'gathering';
            const timeLeft = isGathering ? Math.max(0, battle.resolveTick - (this.gameState.tick || 0)) : 0;
            
            const attackerCount = battle.participants?.attacker?.reduce((sum, p) => sum + p.shipIds.length, 0) || 0;
            const defenderCount = battle.participants?.defender?.reduce((sum, p) => sum + p.shipIds.length, 0) || 0;
            
            html += `
                <div class="battle-item" data-battle-id="${battle.id}" style="
                    background: rgba(255, 107, 107, 0.1);
                    border: 1px solid #333;
                    border-radius: 4px;
                    padding: 10px;
                    margin-bottom: 10px;
                    cursor: pointer;
                " onmouseover="this.style.borderColor='#ff6b6b'" onmouseout="this.style.borderColor='#333'">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="color: #ff6b6b;">${battle.location?.planetId || 'Unknown'}</span>
                        <span style="color: ${isGathering ? '#4ecdc4' : '#ff9800'};">
                            ${isGathering ? `⏱ ${timeLeft}s` : '⚔️ Fighting!'}
                        </span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 12px;">
                        <span style="color: #ff6b6b;">ATK: ${attackerCount} ships</span>
                        <span style="color: #4ecdc4;">DEF: ${defenderCount} ships</span>
                    </div>
                    ${battle.state === 'complete' ? `
                        <button onclick="window.battleUI.spectate('${battle.id}')" style="
                            width: 100%;
                            margin-top: 8px;
                            padding: 5px;
                            background: #4ecdc4;
                            border: none;
                            border-radius: 4px;
                            color: #000;
                            cursor: pointer;
                            font-weight: bold;
                        ">👁 Watch Replay</button>
                    ` : ''}
                </div>
            `;
        }
        
        this.panel.innerHTML = html;
    }

    /**
     * Spectate a battle (show replay viewer)
     */
    spectate(battleId) {
        const battle = this.activeBattles.find(b => b.id === battleId);
        if (battle && battle.replay) {
            showBattleViewer(battle);
        } else {
            // Fetch battle data from API
            fetch(`/api/battle/${battleId}`)
                .then(res => res.json())
                .then(battle => {
                    if (battle && battle.replay) {
                        showBattleViewer(battle);
                    } else {
                        console.error('Battle has no replay data');
                    }
                })
                .catch(err => console.error('Failed to fetch battle:', err));
        }
    }

    /**
     * Draw battle indicators on the map
     */
    drawBattleIndicators(ctx, camera, universe) {
        for (const battle of this.activeBattles) {
            const planet = universe?.getPlanet?.(battle.location?.planetId);
            if (!planet) continue;
            
            // Calculate screen position
            const screenX = (planet.x - camera.x) * camera.zoom + ctx.canvas.width / 2;
            const screenY = (planet.y - camera.y) * camera.zoom + ctx.canvas.height / 2;
            
            // Skip if off screen
            if (screenX < -50 || screenX > ctx.canvas.width + 50 ||
                screenY < -50 || screenY > ctx.canvas.height + 50) {
                continue;
            }
            
            // Pulsing effect
            const pulse = Math.sin(Date.now() / 200) * 0.3 + 0.7;
            const radius = 30 * camera.zoom * pulse;
            
            // Draw battle indicator
            ctx.save();
            
            // Outer ring
            ctx.strokeStyle = `rgba(255, 107, 107, ${pulse})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
            ctx.stroke();
            
            // Inner glow
            const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, radius);
            gradient.addColorStop(0, 'rgba(255, 107, 107, 0.3)');
            gradient.addColorStop(1, 'rgba(255, 107, 107, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
            ctx.fill();
            
            // Crossed swords icon
            ctx.fillStyle = '#fff';
            ctx.font = `${16 * camera.zoom}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('⚔️', screenX, screenY);
            
            // Timer or status
            const isGathering = battle.state === 'gathering';
            const timeLeft = isGathering ? Math.max(0, battle.resolveTick - (this.gameState?.tick || 0)) : 0;
            
            ctx.font = `${10 * camera.zoom}px Arial`;
            ctx.fillStyle = isGathering ? '#4ecdc4' : '#ff9800';
            ctx.fillText(isGathering ? `${timeLeft}s` : 'FIGHT!', screenX, screenY + radius + 10);
            
            ctx.restore();
        }
    }

    /**
     * Check if a click hit a battle indicator
     */
    checkBattleClick(x, y, camera, universe) {
        for (const battle of this.activeBattles) {
            const planet = universe?.getPlanet?.(battle.location?.planetId);
            if (!planet) continue;
            
            const screenX = (planet.x - camera.x) * camera.zoom + 400; // Assuming 800 width
            const screenY = (planet.y - camera.y) * camera.zoom + 300; // Assuming 600 height
            
            const dx = x - screenX;
            const dy = y - screenY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < 30 * camera.zoom) {
                return battle;
            }
        }
        return null;
    }
}

// Global instance for onclick handlers
window.battleUI = null;

export function initBattleUI(gameState) {
    window.battleUI = new BattleUI(gameState);
    return window.battleUI;
}
