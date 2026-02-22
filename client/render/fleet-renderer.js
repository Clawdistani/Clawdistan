// Fleet rendering for Clawdistan
// Extracted from renderer.js for modularity

/**
 * Draw vector ship icon (triangle pointing right)
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {string} color - Ship color
 * @param {number} scale - Scale factor (default 1)
 */
export function drawVectorShip(ctx, color, scale = 1) {
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-8, 6);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-8, -6);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();
}

/**
 * Draw all fleets in transit
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} state - Game state
 * @param {string} viewMode - Current view mode (universe/galaxy/system/planet)
 * @param {Object} renderer - Renderer instance (for accessing camera, colors, etc.)
 */
export function drawFleets(ctx, state, viewMode, renderer) {
    const fleets = state.fleetsInTransit || state.allFleets || [];
    if (fleets.length === 0) return;

    const systems = state.universe?.solarSystems || [];
    const planets = state.universe?.planets || [];
    const _r = renderer._r; // Integer rounding helper

    fleets.forEach(fleet => {
        let originX, originY, destX, destY;
        let visible = false;

        if (viewMode === 'universe' || viewMode === 'galaxy') {
            const originSystem = systems.find(s => s.id === fleet.originSystemId);
            const destSystem = systems.find(s => s.id === fleet.destSystemId);
            
            if (originSystem && destSystem) {
                if (fleet.originSystemId !== fleet.destSystemId) {
                    originX = originSystem.x;
                    originY = originSystem.y;
                    destX = destSystem.x;
                    destY = destSystem.y;
                    visible = true;
                } else {
                    // Same-system fleet - show pulsing dot
                    ctx.beginPath();
                    ctx.arc(originSystem.x, originSystem.y, 8 + Math.sin(Date.now() / 200) * 3, 0, Math.PI * 2);
                    ctx.fillStyle = renderer.empireColors[fleet.empireId] || '#00d9ff';
                    ctx.globalAlpha = 0.7;
                    ctx.fill();
                    ctx.globalAlpha = 1;
                }
            }
        } else if (viewMode === 'system') {
            const currentSystem = renderer.selectedObject?.id?.startsWith('system') 
                ? renderer.selectedObject.id 
                : renderer.selectedObject?.systemId;
            
            if (fleet.originSystemId === currentSystem || fleet.destSystemId === currentSystem) {
                const originPlanet = planets.find(p => p.id === fleet.originPlanetId);
                const destPlanet = planets.find(p => p.id === fleet.destPlanetId);
                const system = systems.find(s => s.id === currentSystem);
                
                if (originPlanet && destPlanet && system) {
                    originX = system.x + Math.cos(originPlanet.orbitAngle) * originPlanet.orbitRadius * 3;
                    originY = system.y + Math.sin(originPlanet.orbitAngle) * originPlanet.orbitRadius * 3;
                    destX = system.x + Math.cos(destPlanet.orbitAngle) * destPlanet.orbitRadius * 3;
                    destY = system.y + Math.sin(destPlanet.orbitAngle) * destPlanet.orbitRadius * 3;
                    visible = true;
                }
            }
        }

        if (!visible) return;
        
        // Viewport culling
        const fleetMinX = Math.min(originX, destX);
        const fleetMaxX = Math.max(originX, destX);
        const fleetMinY = Math.min(originY, destY);
        const fleetMaxY = Math.max(originY, destY);
        const b = renderer._viewBounds;
        if (fleetMaxX < b.minX || fleetMinX > b.maxX ||
            fleetMaxY < b.minY || fleetMinY > b.maxY) return;

        const empireColor = renderer.empireColors[fleet.empireId] || '#00d9ff';
        const isCrossGalaxy = fleet.originGalaxyId && fleet.destGalaxyId && 
                              fleet.originGalaxyId !== fleet.destGalaxyId;

        // Calculate current position
        const progress = fleet.progress || 0;
        const currentX = _r(originX + (destX - originX) * progress);
        const currentY = _r(originY + (destY - originY) * progress);
        originX = _r(originX);
        originY = _r(originY);
        destX = _r(destX);
        destY = _r(destY);
        const fleetAngle = Math.atan2(destY - originY, destX - originX);

        // Cross-galaxy glow effect
        if (isCrossGalaxy) {
            ctx.beginPath();
            ctx.moveTo(originX, originY);
            ctx.lineTo(destX, destY);
            ctx.strokeStyle = empireColor;
            ctx.lineWidth = 8;
            ctx.globalAlpha = 0.15;
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        // Trail line (origin to current)
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.lineTo(currentX, currentY);
        ctx.strokeStyle = empireColor;
        ctx.lineWidth = isCrossGalaxy ? 4 : 2;
        ctx.globalAlpha = 0.8;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Remaining path (dashed)
        ctx.beginPath();
        ctx.moveTo(currentX, currentY);
        ctx.lineTo(destX, destY);
        ctx.setLineDash([8, 4]);
        ctx.strokeStyle = empireColor;
        ctx.lineWidth = isCrossGalaxy ? 3 : 2;
        ctx.globalAlpha = 0.4;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;

        // Fleet icon
        const iconScale = isCrossGalaxy ? 1.5 : 1;
        
        ctx.save();
        ctx.translate(currentX, currentY);
        ctx.rotate(fleetAngle);
        ctx.scale(iconScale, iconScale);

        if (isCrossGalaxy) {
            ctx.beginPath();
            ctx.arc(0, 0, 12, 0, Math.PI * 2);
            ctx.fillStyle = empireColor;
            ctx.globalAlpha = 0.3;
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        drawVectorShip(ctx, empireColor, iconScale);
        ctx.restore();

        // Ship count badge
        if (fleet.shipCount > 1) {
            ctx.beginPath();
            ctx.arc(currentX + 10, currentY - 10, 8, 0, Math.PI * 2);
            ctx.fillStyle = '#1a1a2e';
            ctx.fill();
            ctx.strokeStyle = empireColor;
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 8px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(fleet.shipCount.toString(), currentX + 10, currentY - 10);
        }

        // ETA label
        const ticksRemaining = fleet.arrivalTick - (renderer._lastState?.tick || 0);
        if (ticksRemaining > 0) {
            const minutesRemaining = Math.ceil(ticksRemaining / 60);
            const etaText = minutesRemaining >= 60 
                ? `${Math.floor(minutesRemaining / 60)}h ${minutesRemaining % 60}m` 
                : `${minutesRemaining}m`;
            
            ctx.save();
            ctx.font = 'bold 9px "Segoe UI", sans-serif';
            const textWidth = ctx.measureText(etaText).width + 8;
            const labelX = currentX - textWidth / 2;
            const labelY = currentY + 18;
            
            ctx.beginPath();
            ctx.roundRect(labelX, labelY, textWidth, 14, 4);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            ctx.fill();
            ctx.strokeStyle = empireColor;
            ctx.lineWidth = 1;
            ctx.stroke();
            
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(etaText, currentX, labelY + 7);
            ctx.restore();
        }
        
        // Destination marker
        const pulseScale = 1 + Math.sin(Date.now() / 300) * 0.15;
        ctx.beginPath();
        ctx.arc(destX, destY, 6 * pulseScale, 0, Math.PI * 2);
        ctx.strokeStyle = empireColor;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.6;
        ctx.stroke();
        ctx.globalAlpha = 1;
    });
}
