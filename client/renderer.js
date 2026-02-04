// Canvas renderer for universe visualization

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.camera = {
            x: 500,
            y: 500,
            zoom: 0.5,
            targetZoom: 0.5
        };
        this.viewMode = 'universe';
        this.selectedObject = null;
        this.currentPlanetId = null; // Track which planet to show in planet view
        this.hoveredObject = null;
        this.empireColors = {};
        this.mouseWorld = { x: 0, y: 0 };
        this.highlightedEmpires = [];
        this.highlightPulse = 0;

        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.setupMouseHandlers();
    }

    resize() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
    }

    setupMouseHandlers() {
        let isDragging = false;
        let lastX, lastY;

        this.canvas.addEventListener('mousedown', (e) => {
            isDragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const dx = e.clientX - lastX;
                const dy = e.clientY - lastY;
                this.camera.x -= dx / this.camera.zoom;
                this.camera.y -= dy / this.camera.zoom;
                lastX = e.clientX;
                lastY = e.clientY;
            }
            this.updateHover(e);
        });

        this.canvas.addEventListener('mouseup', () => isDragging = false);
        this.canvas.addEventListener('mouseleave', () => isDragging = false);

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
            this.camera.targetZoom = Math.max(0.1, Math.min(5, this.camera.targetZoom * zoomFactor));
        });

        this.canvas.addEventListener('click', () => {
            // Check for planet clicks in system view first
            if (this.handleSystemClick()) {
                return;
            }

            if (this.hoveredObject) {
                this.selectedObject = this.hoveredObject;
                
                // Handle navigation based on object type
                if (this.hoveredObject.id?.startsWith('planet')) {
                    this.currentPlanetId = this.hoveredObject.id;
                } else if (this.hoveredObject.id?.startsWith('galaxy')) {
                    // Clicked a galaxy - switch to galaxy view
                    this.onViewChange?.('galaxy');
                } else if (this.hoveredObject.id?.startsWith('system')) {
                    // Clicked a system - switch to system view
                    this.onViewChange?.('system');
                }
                
                this.onSelect?.(this.selectedObject);
            }
        });

        this.canvas.addEventListener('dblclick', () => {
            if (this.hoveredObject) {
                this.zoomTo(this.hoveredObject);
            }
        });
    }

    updateHover(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left - this.canvas.width / 2) / this.camera.zoom + this.camera.x;
        const mouseY = (e.clientY - rect.top - this.canvas.height / 2) / this.camera.zoom + this.camera.y;
        this.mouseWorld = { x: mouseX, y: mouseY };
        
        // Update hover detection based on current view
        this.detectHover();
    }

    detectHover() {
        const mx = this.mouseWorld.x;
        const my = this.mouseWorld.y;
        this.hoveredObject = null;

        if (this.viewMode === 'universe') {
            // Check systems first (smaller, more precise)
            if (this.cachedSystems) {
                for (const system of this.cachedSystems) {
                    const dist = Math.sqrt(Math.pow(mx - system.x, 2) + Math.pow(my - system.y, 2));
                    if (dist <= 15) {
                        this.hoveredObject = system;
                        return;
                    }
                }
            }
            // Check galaxies
            if (this.cachedGalaxies) {
                for (const galaxy of this.cachedGalaxies) {
                    const dist = Math.sqrt(Math.pow(mx - galaxy.x, 2) + Math.pow(my - galaxy.y, 2));
                    if (dist <= galaxy.radius) {
                        this.hoveredObject = galaxy;
                        return;
                    }
                }
            }
        } else if (this.viewMode === 'galaxy') {
            // Check systems in galaxy view
            if (this.cachedSystems) {
                for (const system of this.cachedSystems) {
                    const dist = Math.sqrt(Math.pow(mx - system.x, 2) + Math.pow(my - system.y, 2));
                    if (dist <= 15) {
                        this.hoveredObject = system;
                        return;
                    }
                }
            }
        }
        // System view hover is handled by updateSystemHover
    }

    setViewMode(mode) {
        this.viewMode = mode;
        this.fitView();
    }

    setCurrentPlanet(planetId) {
        this.currentPlanetId = planetId;
    }

    fitView() {
        this.camera.x = 500;
        this.camera.y = 500;
        this.camera.targetZoom = this.viewMode === 'universe' ? 0.5 : 1;
    }

    zoomTo(object) {
        if (object.x !== undefined && object.y !== undefined) {
            this.camera.x = object.x;
            this.camera.y = object.y;
            this.camera.targetZoom = 2;
        }
    }

    render(state) {
        const ctx = this.ctx;
        const { width, height } = this.canvas;

        this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * 0.1;

        ctx.fillStyle = '#0a0a15';
        ctx.fillRect(0, 0, width, height);

        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.scale(this.camera.zoom, this.camera.zoom);
        ctx.translate(-this.camera.x, -this.camera.y);

        if (state) {
            this.drawStarfield(ctx);

            switch (this.viewMode) {
                case 'universe':
                    this.drawUniverse(ctx, state);
                    this.drawFleets(ctx, state, 'universe');
                    break;
                case 'galaxy':
                    this.drawGalaxy(ctx, state);
                    this.drawFleets(ctx, state, 'galaxy');
                    break;
                case 'system':
                    this.drawSystem(ctx, state);
                    this.drawFleets(ctx, state, 'system');
                    break;
                case 'planet':
                    this.drawPlanet(ctx, state);
                    break;
            }
        }

        ctx.restore();
        this.drawOverlay(ctx, state);
    }

    drawStarfield(ctx) {
        ctx.fillStyle = '#ffffff';
        const seed = 12345;
        for (let i = 0; i < 200; i++) {
            const x = (Math.sin(seed * i) * 10000) % 1000;
            const y = (Math.cos(seed * i) * 10000) % 1000;
            const size = ((i * 7) % 3) + 1;
            const alpha = 0.3 + ((i * 13) % 70) / 100;
            ctx.globalAlpha = alpha;
            ctx.fillRect(x, y, size, size);
        }
        ctx.globalAlpha = 1;
    }

    drawUniverse(ctx, state) {
        const universe = state.universe;
        if (!universe) return;

        // Cache for hover detection
        this.cachedGalaxies = universe.galaxies || [];
        this.cachedSystems = universe.solarSystems || [];

        universe.galaxies?.forEach(galaxy => {
            this.drawGalaxyIcon(ctx, galaxy, state);
        });

        if (universe.solarSystems) {
            ctx.strokeStyle = 'rgba(0, 217, 255, 0.1)';
            ctx.lineWidth = 1;

            universe.solarSystems.forEach(sys1 => {
                universe.solarSystems.forEach(sys2 => {
                    if (sys1.id < sys2.id) {
                        const dist = Math.sqrt(
                            Math.pow(sys2.x - sys1.x, 2) + Math.pow(sys2.y - sys1.y, 2)
                        );
                        if (dist < 100) {
                            ctx.beginPath();
                            ctx.moveTo(sys1.x, sys1.y);
                            ctx.lineTo(sys2.x, sys2.y);
                            ctx.stroke();
                        }
                    }
                });
            });
        }

        universe.solarSystems?.forEach(system => {
            this.drawSystemIcon(ctx, system, state);
        });
    }

    drawGalaxyIcon(ctx, galaxy, state) {
        const { x, y, radius: r } = galaxy;
        const isHovered = this.hoveredObject?.id === galaxy.id;
        const isSelected = this.selectedObject?.id === galaxy.id;

        ctx.save();
        ctx.translate(x, y);

        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        gradient.addColorStop(0, isHovered ? 'rgba(0, 217, 255, 0.4)' : 'rgba(100, 150, 255, 0.3)');
        gradient.addColorStop(0.5, isHovered ? 'rgba(0, 150, 200, 0.2)' : 'rgba(50, 100, 200, 0.1)');
        gradient.addColorStop(1, 'rgba(0, 50, 150, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();

        // Hover/selection ring
        if (isHovered || isSelected) {
            ctx.beginPath();
            ctx.arc(0, 0, r + 5, 0, Math.PI * 2);
            ctx.strokeStyle = '#00d9ff';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Click hint
            ctx.fillStyle = '#00d9ff';
            ctx.font = 'bold 10px sans-serif';
            ctx.fillText('Click to view', 0, r + 30);
        }

        ctx.fillStyle = isHovered ? '#00d9ff' : '#888';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(galaxy.name, 0, r + 15);

        ctx.restore();
    }

    drawSystemIcon(ctx, system, state) {
        const { x, y } = system;
        const isHovered = this.hoveredObject?.id === system.id;
        const isSelected = this.selectedObject?.id === system.id;

        const starColors = {
            yellow: '#ffff00',
            red: '#ff4444',
            blue: '#4444ff',
            white: '#ffffff',
            orange: '#ff8800'
        };

        const color = starColors[system.starType] || '#ffff00';
        const glowRadius = isHovered ? 12 : 8;

        ctx.beginPath();
        ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, isHovered ? 5 : 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Hover hint
        if (isHovered && !isSelected) {
            ctx.fillStyle = '#00d9ff';
            ctx.font = 'bold 9px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Click to view', x, y + 25);
        }

        const ownedPlanets = state.universe.planets?.filter(p =>
            p.systemId === system.id && p.owner
        ) || [];

        if (ownedPlanets.length > 0) {
            const ownerColors = {};
            let hasHighlighted = false;
            ownedPlanets.forEach(p => {
                if (!ownerColors[p.owner]) {
                    const empire = state.empires?.find(e => e.id === p.owner);
                    ownerColors[p.owner] = empire?.color || '#888';
                    if (this.highlightedEmpires.includes(p.owner)) {
                        hasHighlighted = true;
                    }
                }
            });

            const colors = Object.values(ownerColors);
            const arcSize = (Math.PI * 2) / colors.length;

            colors.forEach((c, i) => {
                ctx.beginPath();
                ctx.arc(x, y, 12, i * arcSize, (i + 1) * arcSize);
                ctx.strokeStyle = c;
                ctx.lineWidth = 2;
                ctx.stroke();
            });

            // Draw pulsing highlight for agent locations
            if (hasHighlighted) {
                this.highlightPulse += 0.1;
                const pulseRadius = 18 + Math.sin(this.highlightPulse) * 4;
                const pulseAlpha = 0.5 + Math.sin(this.highlightPulse) * 0.3;

                ctx.beginPath();
                ctx.arc(x, y, pulseRadius, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(0, 255, 128, ${pulseAlpha})`;
                ctx.lineWidth = 3;
                ctx.stroke();

                // Draw agent marker
                ctx.fillStyle = `rgba(0, 255, 128, ${pulseAlpha})`;
                ctx.font = 'bold 14px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('🤖', x, y - 22);
            }
        }

        if (this.hoveredObject?.id === system.id || this.selectedObject?.id === system.id) {
            ctx.beginPath();
            ctx.arc(x, y, 15, 0, Math.PI * 2);
            ctx.strokeStyle = '#00d9ff';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }

    drawGalaxy(ctx, state) {
        // Find the galaxy to display:
        // 1. If selectedObject IS a galaxy (clicked directly), use its id
        // 2. If selectedObject has a galaxyId (it's a system or planet inside), use that
        // 3. Fallback to first galaxy
        let galaxy = null;
        if (this.selectedObject?.id?.startsWith('galaxy')) {
            galaxy = state.universe.galaxies?.find(g => g.id === this.selectedObject.id);
        } else if (this.selectedObject?.galaxyId) {
            galaxy = state.universe.galaxies?.find(g => g.id === this.selectedObject.galaxyId);
        }
        if (!galaxy) {
            galaxy = state.universe.galaxies?.[0];
        }

        if (!galaxy) return;

        const systems = state.universe.solarSystems?.filter(s => s.galaxyId === galaxy.id) || [];
        // Cache for hover detection
        this.cachedSystems = systems;
        systems.forEach(system => this.drawSystemIcon(ctx, system, state));
    }

    drawSystem(ctx, state) {
        // Find the system to display:
        // 1. If selectedObject IS a system (clicked directly), use its id
        // 2. If selectedObject has a systemId (it's a planet inside), use that
        // 3. Fallback to first system
        let system = null;
        if (this.selectedObject?.id?.startsWith('system')) {
            system = state.universe.solarSystems?.find(s => s.id === this.selectedObject.id);
        } else if (this.selectedObject?.systemId) {
            system = state.universe.solarSystems?.find(s => s.id === this.selectedObject.systemId);
        }
        if (!system) {
            system = state.universe.solarSystems?.[0];
        }

        if (!system) return;

        ctx.beginPath();
        ctx.arc(system.x, system.y, 20, 0, Math.PI * 2);
        ctx.fillStyle = '#ffff00';
        ctx.fill();

        const planets = state.universe.planets?.filter(p => p.systemId === system.id) || [];

        // Store planet positions for click detection
        this.systemPlanets = [];

        planets.forEach(planet => {
            const px = system.x + Math.cos(planet.orbitAngle) * planet.orbitRadius * 3;
            const py = system.y + Math.sin(planet.orbitAngle) * planet.orbitRadius * 3;

            // Store for hit detection
            this.systemPlanets.push({ ...planet, screenX: px, screenY: py, radius: 12 });

            ctx.beginPath();
            ctx.arc(system.x, system.y, planet.orbitRadius * 3, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.stroke();

            const planetColors = {
                terrestrial: '#4ade80',
                gas_giant: '#f97316',
                ice: '#7dd3fc',
                desert: '#fcd34d',
                ocean: '#3b82f6',
                volcanic: '#ef4444'
            };

            // Check if this planet is hovered
            const isHovered = this.hoveredPlanet?.id === planet.id;
            const isSelected = this.selectedObject?.id === planet.id;

            ctx.beginPath();
            ctx.arc(px, py, isHovered ? 10 : 8, 0, Math.PI * 2);
            ctx.fillStyle = planetColors[planet.type] || '#888';
            ctx.fill();

            if (planet.owner) {
                const empire = state.empires?.find(e => e.id === planet.owner);
                if (empire) {
                    ctx.beginPath();
                    ctx.arc(px, py, isHovered ? 14 : 11, 0, Math.PI * 2);
                    ctx.strokeStyle = empire.color;
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
            }

            // Highlight hovered/selected planet
            if (isHovered || isSelected) {
                ctx.beginPath();
                ctx.arc(px, py, 16, 0, Math.PI * 2);
                ctx.strokeStyle = '#00d9ff';
                ctx.lineWidth = 2;
                ctx.stroke();

                // Draw "Click to view" hint
                ctx.fillStyle = '#00d9ff';
                ctx.font = 'bold 9px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('Click to view', px, py + 32);
            }

            ctx.fillStyle = '#aaa';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(planet.name, px, py + 20);
        });

        // Update hover state for planets in system view
        this.updateSystemHover();
    }

    updateSystemHover() {
        if (this.viewMode !== 'system' || !this.systemPlanets) {
            this.hoveredPlanet = null;
            return;
        }

        const mx = this.mouseWorld.x;
        const my = this.mouseWorld.y;

        this.hoveredPlanet = null;
        for (const planet of this.systemPlanets) {
            const dist = Math.sqrt(Math.pow(mx - planet.screenX, 2) + Math.pow(my - planet.screenY, 2));
            if (dist <= planet.radius) {
                this.hoveredPlanet = planet;
                break;
            }
        }
    }

    // Called when clicking in system view to check for planet clicks
    handleSystemClick() {
        if (this.viewMode === 'system' && this.hoveredPlanet) {
            this.currentPlanetId = this.hoveredPlanet.id;
            this.selectedObject = this.hoveredPlanet;
            this.onPlanetClick?.(this.hoveredPlanet);
            return true;
        }
        return false;
    }

    drawPlanet(ctx, state) {
        // Use currentPlanetId (persists when switching views), fall back to selectedObject, then first planet
        const planetId = this.currentPlanetId || 
                        (this.selectedObject?.id?.startsWith('planet') ? this.selectedObject.id : null);
        const planet = planetId 
            ? state.universe.planets?.find(p => p.id === planetId)
            : state.universe.planets?.[0];

        if (!planet) return;

        const TILE_SIZE = 32;  // Larger tiles for better building visibility
        const surfaceWidth = planet.surface?.[0]?.length || 20;
        const surfaceHeight = planet.surface?.length || 15;
        const offsetX = -(surfaceWidth * TILE_SIZE) / 2;
        const offsetY = -(surfaceHeight * TILE_SIZE) / 2;

        // Expanded terrain colors
        const tileColors = {
            water: '#3b82f6',
            plains: '#4ade80',
            mountain: '#6b7280',
            forest: '#166534',
            sand: '#fcd34d',
            ice: '#bfdbfe',
            lava: '#dc2626',
            // Legacy terrain types for backwards compatibility
            empty: '#87CEEB',
            grass: '#4ade80',
            dirt: '#8B4513',
            stone: '#6b7280'
        };
        
        // Terrain patterns/textures
        const drawTerrainDetail = (ctx, px, py, size, terrain) => {
            switch (terrain) {
                case 'mountain':
                    ctx.fillStyle = '#555';
                    ctx.beginPath();
                    ctx.moveTo(px + size/2, py + 4);
                    ctx.lineTo(px + size - 4, py + size - 4);
                    ctx.lineTo(px + 4, py + size - 4);
                    ctx.closePath();
                    ctx.fill();
                    break;
                case 'forest':
                    ctx.fillStyle = '#15803d';
                    ctx.beginPath();
                    ctx.arc(px + size/2, py + size/2, size/4, 0, Math.PI * 2);
                    ctx.fill();
                    break;
                case 'water':
                    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
                    ctx.beginPath();
                    ctx.moveTo(px + 4, py + size/2);
                    ctx.quadraticCurveTo(px + size/2, py + size/3, px + size - 4, py + size/2);
                    ctx.stroke();
                    break;
            }
        };

        // Get entities on this planet
        const planetEntities = state.entities?.filter(e => e.location === planet.id) || [];
        const structures = planetEntities.filter(e => e.type === 'structure');
        const units = planetEntities.filter(e => e.type === 'unit');
        
        // Build a map of structure positions
        const structureMap = new Map();
        structures.forEach(struct => {
            if (struct.gridX !== null && struct.gridY !== null) {
                structureMap.set(`${struct.gridX},${struct.gridY}`, struct);
            }
        });

        // Structure icons
        const structureIcons = {
            mine: '⛏️',
            power_plant: '⚡',
            farm: '🌾',
            research_lab: '🔬',
            barracks: '🏛️',
            shipyard: '🚀',
            fortress: '🏰',
            fishing_dock: '🎣',
            lumbermill: '🪓'
        };

        // Unit icons
        const unitIcons = {
            scout: '👁️',
            soldier: '⚔️',
            fighter: '✈️',
            colony_ship: '🛸',
            battleship: '🚢'
        };

        // Draw surface tiles with buildings
        if (planet.surface) {
            planet.surface.forEach((row, y) => {
                row.forEach((tile, x) => {
                    const px = offsetX + x * TILE_SIZE;
                    const py = offsetY + y * TILE_SIZE;
                    
                    // Handle both old (string) and new (object) tile formats
                    const terrainType = typeof tile === 'object' ? tile.type : tile;
                    const hasBuilding = typeof tile === 'object' ? tile.building !== null : false;

                    // Draw terrain
                    ctx.fillStyle = tileColors[terrainType] || '#444';
                    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    
                    // Add terrain details
                    drawTerrainDetail(ctx, px, py, TILE_SIZE, terrainType);
                    
                    // Draw grid lines
                    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
                    ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
                    
                    // Draw building in this tile
                    const struct = structureMap.get(`${x},${y}`);
                    if (struct) {
                        // Get owner color
                        const ownerEmpire = state.empires?.find(e => e.id === struct.owner);
                        const ownerColor = ownerEmpire?.color || '#888';
                        
                        // Draw building background
                        ctx.fillStyle = 'rgba(30, 30, 40, 0.85)';
                        ctx.beginPath();
                        ctx.roundRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4, 4);
                        ctx.fill();
                        
                        // Draw owner border
                        ctx.strokeStyle = ownerColor;
                        ctx.lineWidth = 2;
                        ctx.stroke();
                        
                        // Draw building icon
                        ctx.font = `${TILE_SIZE - 10}px sans-serif`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(
                            structureIcons[struct.defName] || '🏗️', 
                            px + TILE_SIZE / 2, 
                            py + TILE_SIZE / 2
                        );
                        
                        // Draw construction progress if building
                        if (struct.constructing) {
                            ctx.fillStyle = '#00d9ff';
                            ctx.font = '8px sans-serif';
                            ctx.fillText(`${Math.floor(struct.constructionProgress * 100)}%`, px + TILE_SIZE/2, py + TILE_SIZE - 4);
                        }
                    }
                });
            });
        } else {
            // No surface data - show loading placeholder
            ctx.beginPath();
            ctx.arc(0, 0, 150, 0, Math.PI * 2);
            ctx.fillStyle = '#2a2a3a';
            ctx.fill();
            ctx.strokeStyle = '#4ade80';
            ctx.lineWidth = 3;
            ctx.stroke();
            
            // Loading text
            ctx.fillStyle = '#888';
            ctx.font = '16px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Loading surface...', 0, 0);
            ctx.font = '12px sans-serif';
            ctx.fillText('Click planet to load details', 0, 25);
        }
        
        // Draw structures without grid positions (legacy) in a side panel
        const unplacedStructures = structures.filter(s => s.gridX === null || s.gridY === null);
        if (unplacedStructures.length > 0) {
            const panelX = offsetX - 60;
            const panelY = offsetY + 10;
            
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(panelX - 25, panelY - 25, 50, unplacedStructures.length * 40 + 30);
            
            ctx.fillStyle = '#888';
            ctx.font = '8px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Unplaced', panelX, panelY - 10);
            
            unplacedStructures.forEach((struct, i) => {
                const sx = panelX;
                const sy = panelY + 15 + i * 40;
                
                const ownerEmpire = state.empires?.find(e => e.id === struct.owner);
                const ownerColor = ownerEmpire?.color || '#888';
                
                ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                ctx.beginPath();
                ctx.roundRect(sx - 15, sy - 15, 30, 30, 4);
                ctx.fill();
                ctx.strokeStyle = ownerColor;
                ctx.lineWidth = 2;
                ctx.stroke();
                
                ctx.font = '18px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(structureIcons[struct.defName] || '🏗️', sx, sy);
            });
        }

        // Draw units along the bottom (not on grid - they move around)
        const unitStartX = offsetX + 20;
        const unitStartY = offsetY + surfaceHeight * TILE_SIZE + 20;
        const unitSpacing = 35;

        units.forEach((unit, i) => {
            const ux = unitStartX + (i % 15) * unitSpacing;
            const uy = unitStartY + Math.floor(i / 15) * 40;

            // Get owner color
            const ownerEmpire = state.empires?.find(e => e.id === unit.owner);
            const ownerColor = ownerEmpire?.color || '#888';

            // Draw unit background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.beginPath();
            ctx.arc(ux, uy, 14, 0, Math.PI * 2);
            ctx.fill();

            // Draw owner ring
            ctx.strokeStyle = ownerColor;
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw icon
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(unitIcons[unit.defName] || '🤖', ux, uy);

            // Draw HP bar if damaged
            if (unit.hp < unit.maxHp) {
                const hpPct = unit.hp / unit.maxHp;
                ctx.fillStyle = '#333';
                ctx.fillRect(ux - 12, uy + 16, 24, 3);
                ctx.fillStyle = hpPct > 0.5 ? '#4ade80' : hpPct > 0.25 ? '#fcd34d' : '#ef4444';
                ctx.fillRect(ux - 12, uy + 16, 24 * hpPct, 3);
            }
        });

        // Draw planet info header
        const ownerEmpire = state.empires?.find(e => e.id === planet.owner);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(offsetX, offsetY - 50, surfaceWidth * TILE_SIZE, 45);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(planet.name, offsetX + 10, offsetY - 45);

        ctx.font = '12px sans-serif';
        ctx.fillStyle = ownerEmpire?.color || '#888';
        ctx.fillText(ownerEmpire?.name || 'Unclaimed', offsetX + 10, offsetY - 25);

        // Stats
        ctx.fillStyle = '#aaa';
        ctx.textAlign = 'right';
        ctx.fillText(`🏗️ ${structures.length}  ⚔️ ${units.length}`, offsetX + surfaceWidth * TILE_SIZE - 10, offsetY - 35);

        // Draw active agents working on this planet
        const activeAgents = state.connectedAgents?.filter(a => a.currentLocation === planet.id) || [];
        if (activeAgents.length > 0) {
            // Agent panel on the right side
            const panelX = offsetX + surfaceWidth * TILE_SIZE - 150;
            const panelY = offsetY + 60;
            const panelWidth = 140;
            const panelHeight = 30 + activeAgents.length * 45;

            // Panel background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.beginPath();
            ctx.roundRect(panelX, panelY, panelWidth, panelHeight, 8);
            ctx.fill();

            // Panel title
            ctx.fillStyle = '#00d9ff';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText('🤖 AGENTS HERE', panelX + 10, panelY + 18);

            // Draw each agent
            activeAgents.forEach((agent, i) => {
                const ay = panelY + 35 + i * 45;
                const empireColor = this.empireColors[agent.empireId] || '#888';

                // Agent avatar circle
                ctx.fillStyle = empireColor;
                ctx.beginPath();
                ctx.arc(panelX + 20, ay + 10, 12, 0, Math.PI * 2);
                ctx.fill();

                // Verified badge
                if (agent.isCitizen) {
                    ctx.fillStyle = '#fcd34d';
                    ctx.font = '10px sans-serif';
                    ctx.fillText('✓', panelX + 16, ay + 14);
                } else {
                    ctx.fillStyle = '#666';
                    ctx.font = '10px sans-serif';
                    ctx.fillText('?', panelX + 17, ay + 14);
                }

                // Agent name
                ctx.fillStyle = '#fff';
                ctx.font = '11px sans-serif';
                ctx.textAlign = 'left';
                const displayName = agent.name.length > 12 ? agent.name.slice(0, 11) + '…' : agent.name;
                ctx.fillText(displayName, panelX + 38, ay + 8);

                // Current action
                if (agent.currentAction) {
                    ctx.fillStyle = '#aaa';
                    ctx.font = '9px sans-serif';
                    const actionText = agent.currentAction.replace(':', ' ');
                    ctx.fillText(actionText, panelX + 38, ay + 20);
                }
            });
        }
    }

    drawOverlay(ctx, state) {
        if (!state) return;

        ctx.fillStyle = '#aaa';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'right';

        const info = [
            `View: ${this.viewMode}`,
            `Zoom: ${(this.camera.zoom * 100).toFixed(0)}%`,
            state.tick ? `Tick: ${state.tick}` : ''
        ];

        info.forEach((text, i) => {
            ctx.fillText(text, this.canvas.width - 10, 20 + i * 15);
        });
    }

    highlightEmpire(empireId) {
        this.highlightedEmpires = empireId ? [empireId] : [];
        this.highlightPulse = 0;
        // Auto-clear after 5 seconds
        setTimeout(() => {
            if (this.highlightedEmpires.includes(empireId)) {
                this.highlightedEmpires = [];
            }
        }, 5000);
    }

    highlightEmpires(empireIds) {
        this.highlightedEmpires = empireIds || [];
        this.highlightPulse = 0;
        // Auto-clear after 5 seconds
        setTimeout(() => {
            this.highlightedEmpires = [];
        }, 5000);
    }

    setEmpireColors(empires) {
        empires?.forEach(empire => {
            this.empireColors[empire.id] = empire.color;
        });
    }

    /**
     * Draw fleet movement arrows
     * Shows ships in transit between planets
     */
    drawFleets(ctx, state, viewMode) {
        const fleets = state.fleetsInTransit || state.allFleets || [];
        if (fleets.length === 0) return;

        const systems = state.universe?.solarSystems || [];
        const planets = state.universe?.planets || [];

        fleets.forEach(fleet => {
            // Get origin and destination positions based on view mode
            let originX, originY, destX, destY;
            let visible = false;

            if (viewMode === 'universe' || viewMode === 'galaxy') {
                // In universe/galaxy view, show arrows between systems
                const originSystem = systems.find(s => s.id === fleet.originSystemId);
                const destSystem = systems.find(s => s.id === fleet.destSystemId);
                
                if (originSystem && destSystem) {
                    // Only show if different systems (same-system = zero-length arrow)
                    if (fleet.originSystemId !== fleet.destSystemId) {
                        originX = originSystem.x;
                        originY = originSystem.y;
                        destX = destSystem.x;
                        destY = destSystem.y;
                        visible = true;
                    }
                    // For same-system, show a small indicator at the system
                    else {
                        // Draw a pulsing dot to indicate fleet activity
                        ctx.beginPath();
                        ctx.arc(originSystem.x, originSystem.y, 8 + Math.sin(Date.now() / 200) * 3, 0, Math.PI * 2);
                        ctx.fillStyle = this.empireColors[fleet.empireId] || '#00d9ff';
                        ctx.globalAlpha = 0.7;
                        ctx.fill();
                        ctx.globalAlpha = 1;
                    }
                }
            } else if (viewMode === 'system') {
                // In system view, show arrows between planets if in same system
                const currentSystem = this.selectedObject?.id?.startsWith('system') 
                    ? this.selectedObject.id 
                    : this.selectedObject?.systemId;
                
                if (fleet.originSystemId === currentSystem || fleet.destSystemId === currentSystem) {
                    const originPlanet = planets.find(p => p.id === fleet.originPlanetId);
                    const destPlanet = planets.find(p => p.id === fleet.destPlanetId);
                    const system = systems.find(s => s.id === currentSystem);
                    
                    if (originPlanet && destPlanet && system) {
                        // Calculate planet screen positions
                        originX = system.x + Math.cos(originPlanet.orbitAngle) * originPlanet.orbitRadius * 3;
                        originY = system.y + Math.sin(originPlanet.orbitAngle) * originPlanet.orbitRadius * 3;
                        destX = system.x + Math.cos(destPlanet.orbitAngle) * destPlanet.orbitRadius * 3;
                        destY = system.y + Math.sin(destPlanet.orbitAngle) * destPlanet.orbitRadius * 3;
                        visible = true;
                    }
                }
            }

            if (!visible) return;

            // Get empire color
            const empireColor = this.empireColors[fleet.empireId] || '#00d9ff';

            // Calculate current position based on progress
            const progress = fleet.progress || 0;
            const currentX = originX + (destX - originX) * progress;
            const currentY = originY + (destY - originY) * progress;

            // Draw the trail line (from origin to current position)
            ctx.beginPath();
            ctx.moveTo(originX, originY);
            ctx.lineTo(currentX, currentY);
            ctx.strokeStyle = empireColor;
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.6;
            ctx.stroke();
            ctx.globalAlpha = 1;

            // Draw the remaining path (dashed)
            ctx.beginPath();
            ctx.moveTo(currentX, currentY);
            ctx.lineTo(destX, destY);
            ctx.setLineDash([5, 5]);
            ctx.strokeStyle = empireColor;
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.3;
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;

            // Draw fleet icon at current position
            const angle = Math.atan2(destY - originY, destX - originX);
            
            ctx.save();
            ctx.translate(currentX, currentY);
            ctx.rotate(angle);

            // Draw ship icon (triangle pointing forward)
            ctx.beginPath();
            ctx.moveTo(10, 0);      // Nose
            ctx.lineTo(-6, -6);     // Left wing
            ctx.lineTo(-3, 0);      // Back center
            ctx.lineTo(-6, 6);      // Right wing
            ctx.closePath();
            ctx.fillStyle = empireColor;
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.restore();

            // Draw ship count badge
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
        });
    }
}
