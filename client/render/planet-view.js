// Planet surface rendering for Clawdistan
// Extracted from renderer.js for modularity

/**
 * Draw planet surface view with terrain, structures, units, and info panels
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} state - Game state
 * @param {Object} renderer - Renderer instance (for accessing camera, colors, etc.)
 */
export function drawPlanetView(ctx, state, renderer) {
    // Use currentPlanetId (persists when switching views), fall back to selectedObject, then first planet
    const planetId = renderer.currentPlanetId || 
                    (renderer.selectedObject?.id?.startsWith('planet') ? renderer.selectedObject.id : null);
    const planet = planetId 
        ? state.universe.planets?.find(p => p.id === planetId)
        : state.universe.planets?.[0];

    if (!planet) return;

    const TILE_SIZE = 36;
    const surfaceWidth = planet.surface?.[0]?.length || 20;
    const surfaceHeight = planet.surface?.length || 15;
    const gridWidth = surfaceWidth * TILE_SIZE;
    const gridHeight = surfaceHeight * TILE_SIZE;
    const offsetX = -gridWidth / 2 - 80;
    const offsetY = -gridHeight / 2 + 30;
    
    const animFrame = renderer._animFrame || 0;
    
    // Planet type themes
    const planetThemes = {
        terrestrial: { 
            atmosphere: 'rgba(100, 200, 255, 0.08)', 
            glow: '#4ade80',
            bgGradient: ['#0a1628', '#0d2818']
        },
        ocean: { 
            atmosphere: 'rgba(59, 130, 246, 0.12)', 
            glow: '#3b82f6',
            bgGradient: ['#0a1628', '#0a1a30']
        },
        desert: { 
            atmosphere: 'rgba(252, 211, 77, 0.08)', 
            glow: '#fcd34d',
            bgGradient: ['#1a1408', '#281a08']
        },
        ice: { 
            atmosphere: 'rgba(191, 219, 254, 0.1)', 
            glow: '#bfdbfe',
            bgGradient: ['#0a1628', '#1a2840']
        },
        volcanic: { 
            atmosphere: 'rgba(239, 68, 68, 0.1)', 
            glow: '#ef4444',
            bgGradient: ['#1a0808', '#281008']
        },
        gas_giant: { 
            atmosphere: 'rgba(249, 115, 22, 0.1)', 
            glow: '#f97316',
            bgGradient: ['#1a1008', '#281810']
        }
    };
    
    const theme = planetThemes[planet.type] || planetThemes.terrestrial;

    // Draw atmospheric background
    const bgGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 600);
    bgGrad.addColorStop(0, theme.bgGradient[1]);
    bgGrad.addColorStop(1, theme.bgGradient[0]);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(-renderer.canvas.width/2/renderer.camera.zoom, -renderer.canvas.height/2/renderer.camera.zoom, 
                 renderer.canvas.width/renderer.camera.zoom, renderer.canvas.height/renderer.camera.zoom);
    
    // Atmospheric glow
    ctx.save();
    ctx.shadowColor = theme.glow;
    ctx.shadowBlur = renderer._isZooming ? 10 : 40;
    ctx.fillStyle = theme.atmosphere;
    ctx.beginPath();
    ctx.roundRect(offsetX - 15, offsetY - 15, gridWidth + 30, gridHeight + 30, 12);
    ctx.fill();
    ctx.restore();

    // Terrain colors
    const tileColors = {
        water: { base: '#2563eb', light: '#3b82f6', dark: '#1d4ed8' },
        plains: { base: '#22c55e', light: '#4ade80', dark: '#16a34a' },
        mountain: { base: '#4b5563', light: '#6b7280', dark: '#374151' },
        forest: { base: '#15803d', light: '#22c55e', dark: '#166534' },
        sand: { base: '#eab308', light: '#fcd34d', dark: '#ca8a04' },
        ice: { base: '#93c5fd', light: '#bfdbfe', dark: '#60a5fa' },
        lava: { base: '#dc2626', light: '#f87171', dark: '#991b1b' },
        empty: { base: '#60a5fa', light: '#93c5fd', dark: '#3b82f6' },
        grass: { base: '#22c55e', light: '#4ade80', dark: '#16a34a' },
        dirt: { base: '#92400e', light: '#b45309', dark: '#78350f' },
        stone: { base: '#4b5563', light: '#6b7280', dark: '#374151' }
    };
    
    // Get entities on this planet
    const planetEntities = renderer._entitiesByPlanet?.get(planet.id) || [];
    const structures = planetEntities.filter(e => e.type === 'structure');
    const units = planetEntities.filter(e => e.type === 'unit');
    
    // Build structure position map
    const structureMap = new Map();
    structures.forEach(struct => {
        if (struct.gridX !== null && struct.gridY !== null) {
            structureMap.set(`${struct.gridX},${struct.gridY}`, struct);
        }
    });

    // Icons
    const structureIcons = {
        mine: '⛏️', power_plant: '⚡', farm: '🌾', research_lab: '🔬',
        barracks: '🏛️', shipyard: '🚀', fortress: '🏰', fishing_dock: '🎣', lumbermill: '🪓'
    };
    const unitIcons = {
        scout: '👁️', soldier: '⚔️', fighter: '✈️', colony_ship: '🛸', battleship: '🚢', transport: '🚐'
    };

    // Draw surface tiles
    if (planet.surface) {
        const useHighQuality = !renderer._isZooming && renderer.camera.zoom >= 1.5;
        const empireColorMap = new Map();
        state.empires?.forEach(e => empireColorMap.set(e.id, e.color));
        
        // First pass: terrain
        planet.surface.forEach((row, y) => {
            row.forEach((tile, x) => {
                const px = offsetX + x * TILE_SIZE;
                const py = offsetY + y * TILE_SIZE;
                const terrainType = typeof tile === 'object' ? tile.type : tile;
                const colors = tileColors[terrainType] || { base: '#444', light: '#555', dark: '#333' };

                ctx.fillStyle = colors.base;
                ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                
                if (useHighQuality) {
                    drawTerrainDetail(ctx, px, py, TILE_SIZE, terrainType, x * 1000 + y);
                    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(px + 0.5, py + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
                }
            });
        });
        
        // Second pass: buildings
        planet.surface.forEach((row, y) => {
            row.forEach((tile, x) => {
                const struct = structureMap.get(`${x},${y}`);
                if (!struct) return;
                
                const px = offsetX + x * TILE_SIZE;
                const py = offsetY + y * TILE_SIZE;
                const ownerColor = empireColorMap.get(struct.owner) || '#888';
                
                ctx.fillStyle = 'rgba(35, 40, 50, 0.95)';
                ctx.beginPath();
                ctx.roundRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4, 4);
                ctx.fill();
                
                ctx.strokeStyle = ownerColor;
                ctx.lineWidth = 2;
                ctx.stroke();
                
                ctx.font = `${TILE_SIZE - 12}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(structureIcons[struct.defName] || '🏗️', px + TILE_SIZE / 2, py + TILE_SIZE / 2 - 2);
                
                if (struct.constructing) {
                    const progress = struct.constructionProgress || 0;
                    const barWidth = TILE_SIZE - 8;
                    const barY = py + TILE_SIZE - 8;
                    ctx.fillStyle = 'rgba(0,0,0,0.6)';
                    ctx.fillRect(px + 4, barY, barWidth, 4);
                    ctx.fillStyle = '#00d4ff';
                    ctx.fillRect(px + 4, barY, barWidth * progress, 4);
                }
            });
        });
    } else {
        // Loading state
        drawLoadingState(ctx, animFrame, theme);
    }

    // Military forces panel
    if (units.length > 0) {
        drawMilitaryPanel(ctx, units, state, offsetX, offsetY + gridHeight + 15, gridWidth, unitIcons);
    }
    
    // Planet header
    drawPlanetHeader(ctx, planet, state, structures, units, offsetX, offsetY - 70, gridWidth, theme);
    
    // Right side panels
    const rightPanelX = offsetX + gridWidth + 20;
    drawProductionPanel(ctx, structures, rightPanelX, offsetY - 70);
    drawLegendPanel(ctx, tileColors, rightPanelX, offsetY + 85);
    if (structures.length > 0) {
        drawStructuresPanel(ctx, structures, structureIcons, rightPanelX, offsetY + 230);
    }
    if (units.length > 0) {
        const structPanelHeight = structures.length > 0 ? 35 + Math.min([...new Set(structures.map(s => s.defName))].length, 6) * 22 + 25 : 0;
        drawMilitaryUnitsPanel(ctx, units, unitIcons, rightPanelX, offsetY + 230 + structPanelHeight);
    }
    
    // Left side panels
    const leftPanelX = offsetX - 185;
    drawBuildGuidePanel(ctx, leftPanelX, offsetY - 70);
    
    const ownerEmpire = state.empires?.find(e => e.id === planet.owner);
    if (ownerEmpire?.species) {
        drawSpeciesPanel(ctx, ownerEmpire, leftPanelX, offsetY + 130);
    }
    
    // Active agents panel
    const activeAgents = state.connectedAgents?.filter(a => a.currentLocation === planet.id) || [];
    if (activeAgents.length > 0) {
        drawAgentsPanel(ctx, activeAgents, renderer.empireColors, offsetX + surfaceWidth * TILE_SIZE - 150, offsetY + 60);
    }
}

// Helper: Draw terrain details
function drawTerrainDetail(ctx, px, py, size, terrain, seed) {
    const rng = (s) => Math.abs(Math.sin(s * 9999.9) * 99999.9) % 1;
    
    switch (terrain) {
        case 'mountain':
            ctx.fillStyle = '#555';
            ctx.beginPath();
            ctx.moveTo(px + size * 0.5, py + 3);
            ctx.lineTo(px + size - 3, py + size - 3);
            ctx.lineTo(px + 3, py + size - 3);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#e5e7eb';
            ctx.beginPath();
            ctx.moveTo(px + size * 0.5, py + 3);
            ctx.lineTo(px + size * 0.65, py + size * 0.35);
            ctx.lineTo(px + size * 0.35, py + size * 0.35);
            ctx.closePath();
            ctx.fill();
            break;
        case 'forest':
            for (let i = 0; i < 3; i++) {
                const tx = px + 6 + rng(seed + i) * (size - 12);
                const ty = py + 8 + rng(seed + i + 100) * (size - 16);
                ctx.fillStyle = i % 2 ? '#15803d' : '#166534';
                ctx.beginPath();
                ctx.arc(tx, ty, 5 + rng(seed + i) * 3, 0, Math.PI * 2);
                ctx.fill();
            }
            break;
        case 'water':
            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(px + 4, py + size/2);
            ctx.lineTo(px + size - 4, py + size/2);
            ctx.stroke();
            break;
        case 'sand':
            ctx.strokeStyle = 'rgba(0,0,0,0.15)';
            ctx.lineWidth = 1;
            for (let i = 0; i < 2; i++) {
                ctx.beginPath();
                ctx.arc(px + size/2, py + size + 10 + i * 15, size * 0.6, Math.PI * 0.2, Math.PI * 0.8);
                ctx.stroke();
            }
            break;
        case 'ice':
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(px + size * 0.3, py + size * 0.2);
            ctx.lineTo(px + size * 0.5, py + size * 0.5);
            ctx.lineTo(px + size * 0.7, py + size * 0.3);
            ctx.moveTo(px + size * 0.5, py + size * 0.5);
            ctx.lineTo(px + size * 0.4, py + size * 0.8);
            ctx.stroke();
            break;
        case 'lava':
            ctx.strokeStyle = 'rgba(255, 200, 50, 0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(px + rng(seed) * size * 0.3, py + size * 0.2);
            ctx.lineTo(px + size * 0.5, py + size * 0.5);
            ctx.lineTo(px + size * 0.7 + rng(seed+1) * size * 0.2, py + size * 0.9);
            ctx.stroke();
            break;
    }
}

// Helper: Draw loading state
function drawLoadingState(ctx, animFrame, theme) {
    ctx.save();
    const pulse = 0.8 + Math.sin(animFrame * 0.05) * 0.2;
    ctx.shadowColor = theme.glow;
    ctx.shadowBlur = 30 * pulse;
    
    ctx.beginPath();
    ctx.arc(0, 0, 150, 0, Math.PI * 2);
    const loadGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 150);
    loadGrad.addColorStop(0, theme.bgGradient[1]);
    loadGrad.addColorStop(1, theme.bgGradient[0]);
    ctx.fillStyle = loadGrad;
    ctx.fill();
    ctx.strokeStyle = theme.glow;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
    
    ctx.save();
    ctx.rotate(animFrame * 0.03);
    ctx.strokeStyle = theme.glow;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, 180, 0, Math.PI * 0.5);
    ctx.stroke();
    ctx.restore();
    
    ctx.fillStyle = '#e8eaf0';
    ctx.font = 'bold 18px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SCANNING SURFACE...', 0, 0);
    ctx.fillStyle = '#9ca3b8';
    ctx.font = '13px "Segoe UI", sans-serif';
    ctx.fillText('Click planet to load detailed view', 0, 30);
}

// Helper: Draw military forces panel
function drawMilitaryPanel(ctx, units, state, panelX, panelY, panelWidth, unitIcons) {
    const panelHeight = 75;
    
    ctx.fillStyle = 'rgba(12, 16, 28, 0.95)';
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelWidth, panelHeight, 8);
    ctx.fill();
    
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    ctx.fillStyle = '#00d4ff';
    ctx.font = 'bold 11px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`⚔️ MILITARY FORCES (${units.length})`, panelX + 12, panelY + 16);
    
    const unitStartX = panelX + 15;
    const unitStartY = panelY + 45;
    const unitSpacing = 42;
    
    units.slice(0, Math.floor(panelWidth / unitSpacing)).forEach((unit, i) => {
        const ux = unitStartX + i * unitSpacing;
        const uy = unitStartY;
        
        const ownerEmpire = state.empires?.find(e => e.id === unit.owner);
        const ownerColor = ownerEmpire?.color || '#888';
        
        ctx.fillStyle = 'rgba(30, 35, 50, 0.9)';
        ctx.beginPath();
        ctx.roundRect(ux - 16, uy - 16, 32, 36, 6);
        ctx.fill();
        
        ctx.fillStyle = ownerColor;
        ctx.fillRect(ux - 16, uy - 16, 32, 3);
        
        ctx.font = '18px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(unitIcons[unit.defName] || '🤖', ux, uy - 2);
        
        const hpPct = unit.hp / unit.maxHp;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(ux - 12, uy + 12, 24, 4);
        ctx.fillStyle = hpPct > 0.5 ? '#4ade80' : hpPct > 0.25 ? '#fbbf24' : '#ef4444';
        ctx.fillRect(ux - 12, uy + 12, 24 * hpPct, 4);
    });
    
    if (units.length > Math.floor(panelWidth / unitSpacing)) {
        const overflow = units.length - Math.floor(panelWidth / unitSpacing);
        ctx.fillStyle = '#9ca3b8';
        ctx.font = '11px "Segoe UI", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`+${overflow} more`, panelX + panelWidth - 12, panelY + 16);
    }
}

// Helper: Draw planet header
function drawPlanetHeader(ctx, planet, state, structures, units, offsetX, headerY, gridWidth, theme) {
    const headerHeight = 65;
    const ownerEmpire = state.empires?.find(e => e.id === planet.owner);
    
    const headerGrad = ctx.createLinearGradient(offsetX, headerY, offsetX, headerY + headerHeight);
    headerGrad.addColorStop(0, 'rgba(15, 20, 35, 0.98)');
    headerGrad.addColorStop(1, 'rgba(8, 12, 24, 0.95)');
    ctx.fillStyle = headerGrad;
    ctx.beginPath();
    ctx.roundRect(offsetX, headerY, gridWidth, headerHeight, 8);
    ctx.fill();
    
    ctx.fillStyle = theme.glow;
    ctx.fillRect(offsetX, headerY, gridWidth, 3);
    
    const typeEmoji = { terrestrial: '🌍', ocean: '🌊', desert: '🏜️', ice: '❄️', volcanic: '🌋', gas_giant: '🪐' };
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.roundRect(offsetX + 10, headerY + 12, 40, 40, 6);
    ctx.fill();
    ctx.font = '28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(typeEmoji[planet.type] || '🪐', offsetX + 30, headerY + 34);
    
    ctx.fillStyle = '#e8eaf0';
    ctx.font = 'bold 20px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(planet.name, offsetX + 60, headerY + 10);
    
    ctx.fillStyle = theme.glow;
    ctx.font = '11px "Segoe UI", sans-serif';
    const typeLabel = (planet.type || 'unknown').charAt(0).toUpperCase() + (planet.type || 'unknown').slice(1).replace('_', ' ');
    ctx.fillText(typeLabel + ' World', offsetX + 60, headerY + 34);
    
    if (ownerEmpire) {
        ctx.fillStyle = ownerEmpire.color;
        ctx.beginPath();
        ctx.arc(offsetX + 65, headerY + 52, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#9ca3b8';
        ctx.font = '12px "Segoe UI", sans-serif';
        ctx.fillText(ownerEmpire.name, offsetX + 75, headerY + 48);
        
        if (ownerEmpire.species) {
            ctx.fillStyle = '#6b7280';
            ctx.font = 'italic 10px "Segoe UI", sans-serif';
            ctx.fillText(`${ownerEmpire.species.name} (${ownerEmpire.species.category})`, offsetX + 75, headerY + 63);
        }
    } else {
        ctx.fillStyle = '#6b7280';
        ctx.font = 'italic 12px "Segoe UI", sans-serif';
        ctx.fillText('Unclaimed Territory', offsetX + 60, headerY + 48);
    }
    
    ctx.textAlign = 'right';
    ctx.fillStyle = '#e8eaf0';
    ctx.font = '13px "Segoe UI", sans-serif';
    ctx.fillText(`👥 ${planet.population?.toLocaleString() || 0}`, offsetX + gridWidth - 15, headerY + 15);
    
    ctx.fillStyle = '#9ca3b8';
    ctx.font = '12px "Segoe UI", sans-serif';
    ctx.fillText(`🏗️ ${structures.length} structures`, offsetX + gridWidth - 15, headerY + 35);
    ctx.fillText(`⚔️ ${units.length} units`, offsetX + gridWidth - 15, headerY + 52);
}

// Helper: Draw production panel
function drawProductionPanel(ctx, structures, rightPanelX, prodPanelY) {
    const panelW = 160;
    const structCounts = {};
    structures.forEach(s => { structCounts[s.defName] = (structCounts[s.defName] || 0) + 1; });
    
    const production = {
        minerals: (structCounts.mine || 0) * 5,
        energy: (structCounts.power_plant || 0) * 8,
        food: (structCounts.farm || 0) * 10 + (structCounts.fishing_dock || 0) * 8,
        research: (structCounts.research_lab || 0) * 3
    };
    
    const prodPanelGrad = ctx.createLinearGradient(rightPanelX, prodPanelY, rightPanelX, prodPanelY + 140);
    prodPanelGrad.addColorStop(0, 'rgba(15, 20, 35, 0.95)');
    prodPanelGrad.addColorStop(1, 'rgba(8, 12, 24, 0.95)');
    ctx.fillStyle = prodPanelGrad;
    ctx.beginPath();
    ctx.roundRect(rightPanelX, prodPanelY, panelW, 140, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    ctx.fillStyle = '#00d4ff';
    ctx.font = 'bold 11px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('📊 PRODUCTION', rightPanelX + 12, prodPanelY + 18);
    
    const prodItems = [
        { icon: '💎', name: 'Minerals', value: production.minerals, color: '#60a5fa' },
        { icon: '⚡', name: 'Energy', value: production.energy, color: '#fbbf24' },
        { icon: '🌾', name: 'Food', value: production.food, color: '#4ade80' },
        { icon: '🔬', name: 'Research', value: production.research, color: '#a78bfa' }
    ];
    
    prodItems.forEach((item, i) => {
        const iy = prodPanelY + 40 + i * 24;
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(item.icon, rightPanelX + 12, iy);
        ctx.fillStyle = '#9ca3b8';
        ctx.font = '12px "Segoe UI", sans-serif';
        ctx.fillText(item.name, rightPanelX + 32, iy);
        ctx.fillStyle = item.color;
        ctx.font = 'bold 12px "Segoe UI", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`+${item.value}/tick`, rightPanelX + panelW - 12, iy);
        ctx.textAlign = 'left';
    });
}

// Helper: Draw terrain legend
function drawLegendPanel(ctx, tileColors, legendX, legendY) {
    const legendWidth = 160;
    const terrainTypes = [
        { type: 'water', name: 'Water', color: tileColors.water.base },
        { type: 'plains', name: 'Plains', color: tileColors.plains.base },
        { type: 'forest', name: 'Forest', color: tileColors.forest.base },
        { type: 'mountain', name: 'Mountain', color: tileColors.mountain.base },
        { type: 'lava', name: 'Lava', color: tileColors.lava.base }
    ];
    
    const lineHeight = 20;
    const legendHeight = 35 + terrainTypes.length * lineHeight + 15;
    
    const legendGrad = ctx.createLinearGradient(legendX, legendY, legendX, legendY + legendHeight);
    legendGrad.addColorStop(0, 'rgba(15, 20, 35, 0.95)');
    legendGrad.addColorStop(1, 'rgba(8, 12, 24, 0.95)');
    ctx.fillStyle = legendGrad;
    ctx.beginPath();
    ctx.roundRect(legendX, legendY, legendWidth, legendHeight, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    let ly = legendY + 20;
    ctx.fillStyle = '#00d4ff';
    ctx.font = 'bold 11px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🗺️ TERRAIN', legendX + 12, ly);
    ly += 18;
    
    terrainTypes.forEach(t => {
        ctx.fillStyle = t.color;
        ctx.beginPath();
        ctx.roundRect(legendX + 12, ly - 5, 14, 14, 3);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#9ca3b8';
        ctx.font = '12px "Segoe UI", sans-serif';
        ctx.fillText(t.name, legendX + 32, ly + 4);
        ly += lineHeight;
    });
}

// Helper: Draw structures panel
function drawStructuresPanel(ctx, structures, structureIcons, legendX, structPanelY) {
    const panelW = 160;
    const structCounts = {};
    structures.forEach(s => { structCounts[s.defName] = (structCounts[s.defName] || 0) + 1; });
    const uniqueStructTypes = [...new Set(structures.map(s => s.defName))];
    const structPanelHeight = 35 + Math.min(uniqueStructTypes.length, 6) * 22 + 10;
    
    const structGrad = ctx.createLinearGradient(legendX, structPanelY, legendX, structPanelY + structPanelHeight);
    structGrad.addColorStop(0, 'rgba(15, 20, 35, 0.95)');
    structGrad.addColorStop(1, 'rgba(8, 12, 24, 0.95)');
    ctx.fillStyle = structGrad;
    ctx.beginPath();
    ctx.roundRect(legendX, structPanelY, panelW, structPanelHeight, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    ctx.fillStyle = '#00d4ff';
    ctx.font = 'bold 11px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`🏗️ STRUCTURES (${structures.length})`, legendX + 12, structPanelY + 18);
    
    let sy = structPanelY + 38;
    uniqueStructTypes.slice(0, 6).forEach(type => {
        const count = structCounts[type] || 0;
        ctx.font = '14px sans-serif';
        ctx.fillText(structureIcons[type] || '🏗️', legendX + 12, sy);
        ctx.fillStyle = '#9ca3b8';
        ctx.font = '11px "Segoe UI", sans-serif';
        const typeName = type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        ctx.fillText(typeName, legendX + 32, sy);
        ctx.fillStyle = '#e8eaf0';
        ctx.textAlign = 'right';
        ctx.fillText(`×${count}`, legendX + panelW - 12, sy);
        ctx.textAlign = 'left';
        sy += 22;
    });
}

// Helper: Draw military units panel
function drawMilitaryUnitsPanel(ctx, units, unitIcons, legendX, militaryPanelY) {
    const panelW = 160;
    const unitCounts = {};
    units.forEach(u => { unitCounts[u.defName] = (unitCounts[u.defName] || 0) + 1; });
    const uniqueUnitTypes = [...new Set(units.map(u => u.defName))];
    const militaryPanelHeight = 35 + Math.min(uniqueUnitTypes.length, 6) * 22 + 10;
    
    const militaryGrad = ctx.createLinearGradient(legendX, militaryPanelY, legendX, militaryPanelY + militaryPanelHeight);
    militaryGrad.addColorStop(0, 'rgba(25, 15, 35, 0.95)');
    militaryGrad.addColorStop(1, 'rgba(15, 8, 24, 0.95)');
    ctx.fillStyle = militaryGrad;
    ctx.beginPath();
    ctx.roundRect(legendX, militaryPanelY, panelW, militaryPanelHeight, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 11px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`⚔️ MILITARY (${units.length})`, legendX + 12, militaryPanelY + 18);
    
    let my = militaryPanelY + 38;
    uniqueUnitTypes.slice(0, 6).forEach(type => {
        const count = unitCounts[type] || 0;
        ctx.font = '14px sans-serif';
        ctx.fillText(unitIcons[type] || '🤖', legendX + 12, my);
        ctx.fillStyle = '#9ca3b8';
        ctx.font = '11px "Segoe UI", sans-serif';
        const typeName = type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        ctx.fillText(typeName, legendX + 32, my);
        ctx.fillStyle = '#e8eaf0';
        ctx.textAlign = 'right';
        ctx.fillText(`×${count}`, legendX + panelW - 12, my);
        ctx.textAlign = 'left';
        my += 22;
    });
}

// Helper: Draw build guide panel
function drawBuildGuidePanel(ctx, leftPanelX, buildInfoY) {
    const panelW = 160;
    const buildingInfo = [
        { icon: '⛏️', desc: 'Mine - mountain' },
        { icon: '🌾', desc: 'Farm - plains' },
        { icon: '🎣', desc: 'Dock - water' },
        { icon: '🪓', desc: 'Mill - forest' },
        { icon: '⚡', desc: 'Power - any' },
        { icon: '🔬', desc: 'Lab - any' },
        { icon: '🏛️', desc: 'Barracks - any' },
        { icon: '🚀', desc: 'Shipyard - tech' }
    ];
    
    const buildPanelHeight = 35 + buildingInfo.length * 18 + 10;
    
    const buildGrad = ctx.createLinearGradient(leftPanelX, buildInfoY, leftPanelX, buildInfoY + buildPanelHeight);
    buildGrad.addColorStop(0, 'rgba(15, 20, 35, 0.95)');
    buildGrad.addColorStop(1, 'rgba(8, 12, 24, 0.95)');
    ctx.fillStyle = buildGrad;
    ctx.beginPath();
    ctx.roundRect(leftPanelX, buildInfoY, panelW, buildPanelHeight, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 11px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🔨 BUILD GUIDE', leftPanelX + 12, buildInfoY + 18);
    
    let by = buildInfoY + 36;
    buildingInfo.forEach(b => {
        ctx.font = '12px sans-serif';
        ctx.fillText(b.icon, leftPanelX + 10, by);
        ctx.fillStyle = '#9ca3b8';
        ctx.font = '10px "Segoe UI", sans-serif';
        ctx.fillText(b.desc, leftPanelX + 28, by);
        by += 18;
    });
}

// Helper: Draw species info panel
function drawSpeciesPanel(ctx, ownerEmpire, leftPanelX, speciesPanelY) {
    const panelW = 160;
    const species = ownerEmpire.species;
    const bonusCount = (species.bonuses?.length || 0);
    const penaltyCount = (species.penalties?.length || 0);
    const worldBonusCount = (species.worldBonuses?.length || 0);
    const totalLines = 2 + bonusCount + penaltyCount + worldBonusCount + (species.specialAbility ? 2 : 0);
    const speciesPanelH = 50 + totalLines * 14;
    
    const speciesGrad = ctx.createLinearGradient(leftPanelX, speciesPanelY, leftPanelX, speciesPanelY + speciesPanelH);
    speciesGrad.addColorStop(0, 'rgba(15, 20, 35, 0.95)');
    speciesGrad.addColorStop(1, 'rgba(8, 12, 24, 0.95)');
    ctx.fillStyle = speciesGrad;
    ctx.beginPath();
    ctx.roundRect(leftPanelX, speciesPanelY, panelW, speciesPanelH, 8);
    ctx.fill();
    
    const categoryColors = {
        organic: 'rgba(74, 222, 128, 0.4)',
        synthetic: 'rgba(96, 165, 250, 0.4)',
        exotic: 'rgba(167, 139, 250, 0.4)'
    };
    ctx.strokeStyle = categoryColors[species.category] || 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    const categoryIcons = { organic: '🧬', synthetic: '🤖', exotic: '✨' };
    ctx.fillStyle = ownerEmpire.color;
    ctx.font = 'bold 11px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${categoryIcons[species.category] || '👾'} ${species.name.toUpperCase()}`, leftPanelX + 12, speciesPanelY + 18);
    
    ctx.fillStyle = '#6b7280';
    ctx.font = 'italic 9px "Segoe UI", sans-serif';
    ctx.fillText(species.category, leftPanelX + 12, speciesPanelY + 32);
    
    let sy = speciesPanelY + 48;
    
    if (species.bonuses?.length > 0) {
        species.bonuses.forEach(bonus => {
            ctx.fillStyle = '#4ade80';
            ctx.font = '10px "Segoe UI", sans-serif';
            ctx.fillText(`▲ ${bonus}`, leftPanelX + 12, sy);
            sy += 14;
        });
    }
    
    if (species.penalties?.length > 0) {
        species.penalties.forEach(penalty => {
            ctx.fillStyle = '#f87171';
            ctx.font = '10px "Segoe UI", sans-serif';
            ctx.fillText(`▼ ${penalty}`, leftPanelX + 12, sy);
            sy += 14;
        });
    }
    
    if (species.worldBonuses?.length > 0) {
        species.worldBonuses.forEach(wb => {
            ctx.fillStyle = '#60a5fa';
            ctx.font = '10px "Segoe UI", sans-serif';
            ctx.fillText(`🌍 ${wb}`, leftPanelX + 12, sy);
            sy += 14;
        });
    }
    
    if (species.specialAbility) {
        sy += 4;
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 9px "Segoe UI", sans-serif';
        ctx.fillText(`⭐ ${species.specialAbility.name}`, leftPanelX + 12, sy);
    }
}

// Helper: Draw active agents panel
function drawAgentsPanel(ctx, activeAgents, empireColors, panelX, panelY) {
    const panelWidth = 140;
    const panelHeight = 30 + activeAgents.length * 45;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelWidth, panelHeight, 8);
    ctx.fill();

    ctx.fillStyle = '#00d9ff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🤖 AGENTS HERE', panelX + 10, panelY + 18);

    activeAgents.forEach((agent, i) => {
        const ay = panelY + 35 + i * 45;
        const empireColor = empireColors[agent.empireId] || '#888';

        ctx.fillStyle = empireColor;
        ctx.beginPath();
        ctx.arc(panelX + 20, ay + 10, 12, 0, Math.PI * 2);
        ctx.fill();

        if (agent.isCitizen) {
            ctx.fillStyle = '#fcd34d';
            ctx.font = '10px sans-serif';
            ctx.fillText('✓', panelX + 16, ay + 14);
        } else {
            ctx.fillStyle = '#666';
            ctx.font = '10px sans-serif';
            ctx.fillText('?', panelX + 17, ay + 14);
        }

        ctx.fillStyle = '#fff';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'left';
        const displayName = agent.name.length > 12 ? agent.name.slice(0, 11) + '…' : agent.name;
        ctx.fillText(displayName, panelX + 38, ay + 8);

        if (agent.currentAction) {
            ctx.fillStyle = '#aaa';
            ctx.font = '9px sans-serif';
            const actionText = agent.currentAction.replace(':', ' ');
            ctx.fillText(actionText, panelX + 38, ay + 20);
        }
    });
}
