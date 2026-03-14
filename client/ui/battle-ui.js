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
        // Use existing sidebar element
        this.panel = document.getElementById('battleActivity');
        this.countBadge = document.getElementById('battleCount');
    }

    renderBattleList() {
        if (!this.panel) return;
        
        // Update count badge
        if (this.countBadge) {
            this.countBadge.textContent = this.activeBattles.length;
            this.countBadge.style.color = this.activeBattles.length > 0 ? '#ff6b6b' : '';
        }
        
        if (this.activeBattles.length === 0) {
            this.panel.innerHTML = '<p class="placeholder-text">No active battles</p>';
            return;
        }
        
        let html = '';
        for (const battle of this.activeBattles) {
            const isGathering = battle.state === 'gathering';
            const timeLeft = isGathering ? Math.max(0, battle.resolveTick - (this.gameState.tick || 0)) : 0;
            const attackerCount = battle.participants?.attacker?.reduce((sum, p) => sum + p.shipIds.length, 0) || 0;
            const defenderCount = battle.participants?.defender?.reduce((sum, p) => sum + p.shipIds.length, 0) || 0;
            
            html += `
                <div class="battle-item" data-battle-id="${battle.id}" style="
                    background: rgba(255, 107, 107, 0.15);
                    border-left: 3px solid ${isGathering ? '#4ecdc4' : '#ff6b6b'};
                    padding: 8px; margin-bottom: 6px; cursor: pointer; font-size: 11px;
                ">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span style="color: #fff;">${battle.location?.planetId?.split('_').pop() || '?'}</span>
                        <span style="color: ${isGathering ? '#4ecdc4' : '#ff9800'};">
                            ${isGathering ? timeLeft + 's' : 'Fighting!'}
                        </span>
                    </div>
                    <div style="display: flex; justify-content: space-between; color: #888;">
                        <span>ATK: ${attackerCount}</span>
                        <span>DEF: ${defenderCount}</span>
                    </div>
                </div>
            `;
        }
        
        this.panel.innerHTML = html;
        
        // Click handlers for spectating
        this.panel.querySelectorAll('.battle-item').forEach(item => {
            item.addEventListener('click', () => {
                const battleId = item.dataset.battleId;
                const battle = this.activeBattles.find(b => b.id === battleId);
                if (battle) this.spectate(battle.id, true);
            });
        });
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
        // Get canvas dimensions for proper centering
        const canvas = document.getElementById('gameCanvas');
        const canvasWidth = canvas?.width || window.innerWidth || 800;
        const canvasHeight = canvas?.height || window.innerHeight || 600;
        
        for (const battle of this.activeBattles) {
            // Find planet from universe.planets array
            const planet = universe?.planets?.find(p => p.id === battle.location?.planetId);
            if (!planet) continue;
            
            const screenX = (planet.x - camera.x) * camera.zoom + canvasWidth / 2;
            const screenY = (planet.y - camera.y) * camera.zoom + canvasHeight / 2;
            
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
            // Find planet from universe.planets array
            const planet = universe?.planets?.find(p => p.id === battle.location?.planetId);
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
            ctx.fillText(isComplete ? '✅' : '⏳', screenX, screenY);
            
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