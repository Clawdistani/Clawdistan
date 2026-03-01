/**
 * Battle Arena UI (Phase 2 + 3)
 * 
 * UI components for battle arena system:
 * - Battle indicators on the map
 * - Spectate buttons (live and replay)
 * - Battle list panel
 * - Click-to-spectate from map
 */

import { showBattleViewer, showLiveBattleViewer } from '../battle-viewer.js';

export class BattleUI {
    constructor(gameState) {
        this.gameState = gameState;
        this.activeBattles = [];
        this.selectedBattle = null;
        this.panel = null;
        this.liveViewer = null;  // Phase 3: Track active live viewer
    }

    update(state) {
        this.activeBattles = state.activeBattles || [];
        this.gameState = { tick: state.tick || 0 };
        this.updatePanel();
        
        // Phase 3: Update live viewer if watching a battle
        if (this.liveViewer && this.liveViewer.isLiveMode) {
            const battle = this.activeBattles.find(b => b.id === this.liveViewer.battle?.id);
            if (battle) {
                this.liveViewer.updateLiveBattle(battle, state.tick);
            }
        }
    }

    updatePanel() {
        if (!this.panel) this.createPanel();
        this.renderBattleList();
    }

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
            const isComplete = battle.state === 'complete';
            const timeLeft = isGathering ? Math.max(0, battle.resolveTick - (this.gameState.tick || 0)) : 0;
            
            const attackerCount = battle.participants?.attacker?.reduce((sum, p) => sum + p.shipIds.length, 0) || 0;
            const defenderCount = battle.participants?.defender?.reduce((sum, p) => sum + p.shipIds.length, 0) || 0;
            
            const borderColor = isGathering ? '#4ecdc4' : isComplete ? '#4caf50' : '#ff9800';
            
            html += `
                <div class="battle-item" data-battle-id="${battle.id}" style="
                    background: rgba(255, 107, 107, 0.1);
                    border: 1px solid ${borderColor};
                    border-radius: 4px;
                    padding: 10px;
                    margin-bottom: 10px;
                    cursor: pointer;
                ">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="color: #ff6b6b;">${battle.location?.planetId || 'Unknown'}</span>
                        <span style="color: ${borderColor};">
                            ${isGathering ? `⏱ ${timeLeft}s` : isComplete ? '✓ Complete' : '⚔️ Fighting!'}
                        </span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 8px;">
                        <span style="color: #ff6b6b;">ATK: ${attackerCount} ships</span>
                        <span style="color: #4ecdc4;">DEF: ${defenderCount} ships</span>
                    </div>
                    ${isGathering ? `
                        <button onclick="window.battleUI.spectate('${battle.id}', true)" style="
                            width: 100%;
                            padding: 5px;
                            background: #9c27b0;
                            border: none;
                            border-radius: 4px;
                            color: #fff;
                            cursor: pointer;
                            font-weight: bold;
                        ">🔴 Watch Live</button>
                    ` : isComplete ? `
                        <button onclick="window.battleUI.spectate('${battle.id}', false)" style="
                            width: 100%;
                            padding: 5px;
                            background: #4ecdc4;
                            border: none;
                            border-radius: 4px;
                            color: #000;
                            cursor: pointer;
                            font-weight: bold;
                        ">👁 Watch Replay</button>
                    ` : `
                        <button onclick="window.battleUI.spectate('${battle.id}', true)" style="
                            width: 100%;
                            padding: 5px;
                            background: #ff9800;
                            border: none;
                            border-radius: 4px;
                            color: #000;
                            cursor: pointer;
                            font-weight: bold;
                        ">⚔️ Watch Battle</button>
                    `}
                </div>
            `;
        }
        
        this.panel.innerHTML = html;
    }

    spectate(battleId, isLive) {
        const battle = this.activeBattles.find(b => b.id === battleId);
        if (!battle) {
            // Fetch from API if not in active list
            fetch(`/api/battle/${battleId}`)
                .then(res => res.json())
                .then(b => {
                    if (b && b.replay) {
                        this.liveViewer = showBattleViewer(b);
                    }
                })
                .catch(err => console.error('Failed to fetch battle:', err));
            return;
        }
        
        if (isLive && (battle.state === 'gathering' || battle.state === 'resolving')) {
            // Phase 3: Live spectating
            this.liveViewer = showLiveBattleViewer(battle, this.gameState.tick || 0);
        } else if (battle.replay) {
            // Replay mode
            this.liveViewer = showBattleViewer(battle);
        } else {
            // No replay yet, try live
            this.liveViewer = showLiveBattleViewer(battle, this.gameState.tick || 0);
        }
    }

    /**
     * Handle click on map to spectate battle (Phase 3)
     */
    handleMapClick(x, y, camera, universe) {
        const battle = this.checkBattleClick(x, y, camera, universe);
        if (battle) {
            const isLive = battle.state === 'gathering' || battle.state === 'resolving';
            this.spectate(battle.id, isLive);
            return true;  // Click handled
        }
        return false;  // Click not on a battle
    }

    checkBattleClick(x, y, camera, universe) {
        for (const battle of this.activeBattles) {
            const planet = universe?.getPlanet?.(battle.location?.planetId);
            if (!planet) continue;
            
            const screenX = (planet.x - camera.x) * camera.zoom + 400;
            const screenY = (planet.y - camera.y) * camera.zoom + 300;
            
            const dx = x - screenX;
            const dy = y - screenY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < 30 * camera.zoom) {
                return battle;
            }
        }
        return null;
    }

    drawBattleIndicators(ctx, camera, universe) {
        for (const battle of this.activeBattles) {
            const planet = universe?.getPlanet?.(battle.location?.planetId);
            if (!planet) continue;
            
            const screenX = (planet.x - camera.x) * camera.zoom + ctx.canvas.width / 2;
            const screenY = (planet.y - camera.y) * camera.zoom + ctx.canvas.height / 2;
            
            if (screenX < -50 || screenX > ctx.canvas.width + 50 ||
                screenY < -50 || screenY > ctx.canvas.height + 50) continue;
            
            const pulse = Math.sin(Date.now() / 200) * 0.3 + 0.7;
            const radius = 30 * camera.zoom * pulse;
            
            ctx.save();
            
            // Different colors based on state
            const isGathering = battle.state === 'gathering';
            const isComplete = battle.state === 'complete';
            const color = isGathering ? '#4ecdc4' : isComplete ? '#4caf50' : '#ff6b6b';
            
            ctx.strokeStyle = `rgba(${isGathering ? '78, 205, 196' : isComplete ? '76, 175, 80' : '255, 107, 107'}, ${pulse})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
            ctx.stroke();
            
            const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, radius);
            gradient.addColorStop(0, `rgba(${isGathering ? '78, 205, 196' : isComplete ? '76, 175, 80' : '255, 107, 107'}, 0.3)`);
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#fff';
            ctx.font = `${16 * camera.zoom}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(isComplete ? '✓' : '⚔️', screenX, screenY);
            
            const timeLeft = isGathering ? Math.max(0, battle.resolveTick - (this.gameState?.tick || 0)) : 0;
            ctx.font = `${10 * camera.zoom}px Arial`;
            ctx.fillStyle = color;
            ctx.fillText(isGathering ? `${timeLeft}s` : isComplete ? 'Done' : 'FIGHT!', screenX, screenY + radius + 10);
            
            // "Click to watch" hint
            ctx.font = `${8 * camera.zoom}px Arial`;
            ctx.fillStyle = '#666';
            ctx.fillText('Click to watch', screenX, screenY + radius + 22);
            
            ctx.restore();
        }
    }
}

window.battleUI = null;

export function initBattleUI(gameState) {
    window.battleUI = new BattleUI(gameState);
    return window.battleUI;
}
