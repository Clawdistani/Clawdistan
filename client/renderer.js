// Canvas renderer for universe visualization
// Performance-optimized with caching and GPU hints

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        // Request GPU-optimized context
        this.ctx = canvas.getContext('2d', {
            alpha: false,        // No transparency needed for background
            desynchronized: true // Allow async rendering for better performance
        });
        
        // Enable high-quality image rendering
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
        
        this.camera = {
            x: 500,
            y: 500,
            zoom: 0.5,
            targetZoom: 0.5
        };
        this.viewMode = 'universe';
        this.selectedObject = null;
        this.currentPlanetId = null;
        this.hoveredObject = null;
        this.empireColors = {};
        this.mouseWorld = { x: 0, y: 0 };
        this.highlightedEmpires = [];
        this.highlightPulse = 0;
        
        // Performance: Caching system
        this._gradientCache = new Map();
        this._imageCache = new Map();
        this._starfieldCache = null;
        this._lastState = null;
        this._frameCount = 0;
        this._animFrame = 0;
        this._lastAnimTime = 0;
        
        // Performance: Planet terrain cache
        this._terrainCache = null;
        this._terrainCacheKey = null;
        
        // Performance: Throttle hover detection
        this._hoverThrottle = 0;
        
        // Sprite system
        this._sprites = {};
        this._spritesLoaded = false;
        this._loadSprites();

        this.resize();
        window.addEventListener('resize', () => {
            this.resize();
            this._starfieldCache = null; // Invalidate starfield on resize
        });
        this.setupMouseHandlers();
    }
    
    // Cache a gradient for reuse
    getCachedGradient(key, createFn) {
        if (!this._gradientCache.has(key)) {
            this._gradientCache.set(key, createFn());
        }
        return this._gradientCache.get(key);
    }
    
    // Clear caches (call when state changes significantly)
    clearCaches() {
        this._gradientCache.clear();
        this._starfieldCache = null;
    }
    
    // Load sprite images for ships, etc.
    _loadSprites() {
        const basePath = '/assets/sprites/kenney-redux/PNG';
        
        // Ship sprites mapped to empire colors
        const shipSprites = {
            // Player ships (by color)
            red: `${basePath}/playerShip1_red.png`,
            green: `${basePath}/playerShip2_green.png`,
            blue: `${basePath}/playerShip3_blue.png`,
            yellow: `${basePath}/playerShip1_orange.png`,
            // Enemy ships for hostile fleets
            enemy: `${basePath}/Enemies/enemyRed3.png`,
            // UFO for special units
            ufo: `${basePath}/ufoBlue.png`,
        };
        
        // Meteor sprites for asteroids
        const meteorSprites = {
            brown: `${basePath}/Meteors/meteorBrown_big1.png`,
            grey: `${basePath}/Meteors/meteorGrey_big1.png`,
        };
        
        // Load all sprites
        let loadedCount = 0;
        const totalSprites = Object.keys(shipSprites).length + Object.keys(meteorSprites).length;
        
        const loadImage = (key, src, category) => {
            const img = new Image();
            img.onload = () => {
                if (!this._sprites[category]) this._sprites[category] = {};
                this._sprites[category][key] = img;
                loadedCount++;
                if (loadedCount >= totalSprites) {
                    this._spritesLoaded = true;
                    console.log('🎨 All sprites loaded!');
                }
            };
            img.onerror = () => {
                console.warn(`Failed to load sprite: ${src}`);
                loadedCount++;
            };
            img.src = src;
        };
        
        // Load ship sprites
        Object.entries(shipSprites).forEach(([key, src]) => loadImage(key, src, 'ships'));
        Object.entries(meteorSprites).forEach(([key, src]) => loadImage(key, src, 'meteors'));
    }
    
    // Get sprite for an empire based on color
    getShipSprite(empireColor) {
        if (!this._spritesLoaded || !this._sprites.ships) return null;
        
        // Normalize color to lowercase for comparison
        const color = empireColor?.toLowerCase() || '';
        
        // Map empire hex colors to sprite keys
        // Order matters - check more specific patterns first
        if (color.includes('ff4444') || color === '#ff4444') return this._sprites.ships.red;
        if (color.includes('44ff44') || color === '#44ff44') return this._sprites.ships.green;
        if (color.includes('4444ff') || color === '#4444ff') return this._sprites.ships.blue;
        if (color.includes('ffff44') || color === '#ffff44') return this._sprites.ships.yellow;
        
        // Fallback color matching by hue detection
        if (color.includes('ff') && !color.includes('44ff') && !color.includes('ffff')) return this._sprites.ships.red;
        if (color.startsWith('#44ff') || color.startsWith('#4f') || color.includes('green')) return this._sprites.ships.green;
        if (color.endsWith('ff') && color.includes('44')) return this._sprites.ships.blue;
        if (color.includes('ff') && color.includes('44') && color.indexOf('ff') < color.indexOf('44')) return this._sprites.ships.yellow;
        
        // Default to blue
        return this._sprites.ships.blue;
    }

    resize() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
    }

    setupMouseHandlers() {
        this._isDragging = false;
        let lastX, lastY;

        this.canvas.addEventListener('mousedown', (e) => {
            this._isDragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (this._isDragging) {
                const dx = e.clientX - lastX;
                const dy = e.clientY - lastY;
                this.camera.x -= dx / this.camera.zoom;
                this.camera.y -= dy / this.camera.zoom;
                lastX = e.clientX;
                lastY = e.clientY;
            }
            this.updateHover(e);
        });

        this.canvas.addEventListener('mouseup', () => this._isDragging = false);
        this.canvas.addEventListener('mouseleave', () => this._isDragging = false);

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
                
                // Handle navigation based on object type with sounds
                // Center camera on clicked object
                if (this.hoveredObject.x !== undefined && this.hoveredObject.y !== undefined) {
                    this.centerOn(this.hoveredObject);
                }
                
                if (this.hoveredObject.id?.startsWith('planet')) {
                    this.currentPlanetId = this.hoveredObject.id;
                    window.SoundFX?.play('zoomToPlanet');
                } else if (this.hoveredObject.id?.startsWith('galaxy')) {
                    // Clicked a galaxy - switch to galaxy view
                    window.SoundFX?.play('zoomToGalaxy');
                    this.onViewChange?.('galaxy');
                } else if (this.hoveredObject.id?.startsWith('system')) {
                    // Clicked a system - switch to system view
                    window.SoundFX?.play('zoomToSystem');
                    this.onViewChange?.('system');
                } else {
                    // Generic map click sound
                    window.SoundFX?.play('mapClick');
                }
                
                this.onSelect?.(this.selectedObject);
            }
        });

        this.canvas.addEventListener('dblclick', () => {
            if (this.hoveredObject) {
                // Play warp sound for double-click zoom
                window.SoundFX?.play('warp');
                this.zoomTo(this.hoveredObject);
            }
        });
    }

    updateHover(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left - this.canvas.width / 2) / this.camera.zoom + this.camera.x;
        const mouseY = (e.clientY - rect.top - this.canvas.height / 2) / this.camera.zoom + this.camera.y;
        this.mouseWorld = { x: mouseX, y: mouseY };
        
        // Throttle hover detection for performance (every 2 frames)
        this._hoverThrottle++;
        if (this._hoverThrottle % 2 === 0) {
            this.detectHover();
            // Also update system view planet hover
            if (this.viewMode === 'system') {
                this.updateSystemHover();
            }
        }
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

    // Center camera on object without changing zoom
    centerOn(object) {
        if (object.x !== undefined && object.y !== undefined) {
            this.camera.x = object.x;
            this.camera.y = object.y;
        }
    }

    render(state) {
        const ctx = this.ctx;
        const { width, height } = this.canvas;
        
        // Track frames for animations (throttled to ~20fps for animations)
        this._frameCount++;
        const now = performance.now();
        if (now - this._lastAnimTime > 50) {
            this._animFrame++;
            this._lastAnimTime = now;
        }

        // Smooth zoom interpolation
        const zoomDelta = Math.abs(this.camera.targetZoom - this.camera.zoom);
        this._isZooming = zoomDelta > 0.001;
        this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * 0.12;

        // Clear with space background color
        ctx.fillStyle = '#050510';
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
        // Use cached starfield for performance
        if (!this._starfieldCache) {
            // Create offscreen canvas for starfield
            const offscreen = document.createElement('canvas');
            offscreen.width = 1000;
            offscreen.height = 1000;
            const offCtx = offscreen.getContext('2d');
            
            // Draw stars once
            const seed = 12345;
            for (let i = 0; i < 250; i++) {
                const x = (Math.sin(seed * i) * 10000) % 1000;
                const y = (Math.cos(seed * i) * 10000) % 1000;
                const size = ((i * 7) % 3) + 0.5;
                const alpha = 0.2 + ((i * 13) % 60) / 100;
                
                // Varied star colors for realism
                const colorVariant = i % 5;
                const colors = ['255,255,255', '200,220,255', '255,240,200', '180,200,255', '255,255,230'];
                offCtx.fillStyle = `rgba(${colors[colorVariant]}, ${alpha})`;
                offCtx.fillRect(x, y, size, size);
            }
            
            this._starfieldCache = offscreen;
        }
        
        // Draw cached starfield (GPU-optimized pattern)
        ctx.drawImage(this._starfieldCache, 0, 0, 1000, 1000);
    }

    drawUniverse(ctx, state) {
        const universe = state.universe;
        if (!universe) return;

        // Cache for hover detection
        this.cachedGalaxies = universe.galaxies || [];
        this.cachedSystems = universe.solarSystems || [];

        // Draw inter-galaxy wormholes first (under everything)
        this.drawInterGalaxyWormholes(ctx, state);

        universe.galaxies?.forEach(galaxy => {
            this.drawGalaxyIcon(ctx, galaxy, state);
        });

        // Hyperlanes hidden by default - shown on hover in galaxy view

        universe.solarSystems?.forEach(system => {
            this.drawSystemIcon(ctx, system, state);
        });
    }
    
    /**
     * Draw inter-galaxy wormholes in universe view
     * Only shows wormholes from hovered galaxy to reduce clutter
     */
    drawInterGalaxyWormholes(ctx, state) {
        // Only show wormholes when hovering over a galaxy
        const hoveredGalaxyId = this.hoveredObject?.id;
        if (!hoveredGalaxyId || !hoveredGalaxyId.startsWith('galaxy_')) return;
        
        const hyperlanes = state.universe.hyperlanes || [];
        const systems = state.universe.solarSystems || [];
        const galaxies = state.universe.galaxies || [];
        
        const systemMap = new Map();
        systems.forEach(s => systemMap.set(s.id, s));
        
        // Get systems in the hovered galaxy
        const hoveredGalaxy = galaxies.find(g => g.id === hoveredGalaxyId);
        if (!hoveredGalaxy) return;
        const galaxySystemIds = new Set(hoveredGalaxy.systems || []);
        
        // Only draw wormholes connected to hovered galaxy
        hyperlanes.filter(h => h.type === 'wormhole').forEach(wormhole => {
            // Check if either end is in the hovered galaxy
            if (!galaxySystemIds.has(wormhole.from) && !galaxySystemIds.has(wormhole.to)) return;
            
            const fromSystem = systemMap.get(wormhole.from);
            const toSystem = systemMap.get(wormhole.to);
            if (!fromSystem || !toSystem) return;
            
            ctx.save();
            ctx.setLineDash([10, 5]);
            
            // Glow effect
            ctx.beginPath();
            ctx.moveTo(fromSystem.x, fromSystem.y);
            ctx.lineTo(toSystem.x, toSystem.y);
            ctx.strokeStyle = 'rgba(168, 85, 247, 0.5)';
            ctx.lineWidth = 6;
            ctx.stroke();
            
            // Inner line
            ctx.beginPath();
            ctx.moveTo(fromSystem.x, fromSystem.y);
            ctx.lineTo(toSystem.x, toSystem.y);
            ctx.strokeStyle = '#a855f7';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            ctx.restore();
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

            // Draw outer glow for owned systems (more visible)
            colors.forEach((c, i) => {
                ctx.beginPath();
                ctx.arc(x, y, 20, i * arcSize, (i + 1) * arcSize);
                ctx.strokeStyle = c;
                ctx.lineWidth = 10;
                ctx.globalAlpha = 0.35;
                ctx.stroke();
                ctx.globalAlpha = 1;
            });

            // Draw main ownership rings (thicker - 5px)
            colors.forEach((c, i) => {
                ctx.beginPath();
                ctx.arc(x, y, 14, i * arcSize, (i + 1) * arcSize);
                ctx.strokeStyle = c;
                ctx.lineWidth = 5;
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
        
        // Draw starbase indicator if system has one
        const starbase = state.starbases?.find(sb => sb.systemId === system.id);
        if (starbase && !starbase.constructing) {
            const sbIcon = starbase.tierName === 'citadel' ? '🏰' : 
                          starbase.tierName === 'starbase' ? '🛸' : '🛰️';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(sbIcon, x + 15, y - 10);
        }
        
        // Draw terrain feature indicator if system has one
        const terrainFeature = state.universe?.terrainFeatures?.find(f => f.systemId === system.id);
        if (terrainFeature) {
            const terrainIcons = {
                nebula: '🌫️',
                black_hole: '🕳️',
                neutron_star: '⚡',
                asteroid_field: '🪨'
            };
            const terrainColors = {
                nebula: 'rgba(136, 68, 170, 0.25)',
                black_hole: 'rgba(68, 0, 68, 0.3)',
                neutron_star: 'rgba(0, 255, 255, 0.2)',
                asteroid_field: 'rgba(136, 119, 102, 0.2)'
            };
            
            // Draw subtle background glow
            ctx.beginPath();
            ctx.arc(x, y, 22, 0, Math.PI * 2);
            ctx.fillStyle = terrainColors[terrainFeature.type] || 'rgba(128, 128, 128, 0.2)';
            ctx.fill();
            
            // Draw terrain icon
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(terrainIcons[terrainFeature.type] || '❓', x - 18, y - 5);
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
        
        // Draw hyperlanes first (under systems)
        this.drawHyperlanes(ctx, state, galaxy.id, systems);
        
        // Draw trade routes (above hyperlanes, below systems)
        this.drawTradeRoutes(ctx, state, galaxy.id, systems);
        
        systems.forEach(system => this.drawSystemIcon(ctx, system, state));
    }
    
    /**
     * Draw trade routes in galaxy view
     */
    drawTradeRoutes(ctx, state, galaxyId, systems) {
        const tradeRoutes = state.tradeRoutes || [];
        if (tradeRoutes.length === 0) return;
        
        // Build planet-to-system map
        const planetToSystem = new Map();
        state.universe.planets?.forEach(planet => {
            planetToSystem.set(planet.id, planet.systemId);
        });
        
        // Build system lookup
        const systemMap = new Map();
        systems.forEach(s => systemMap.set(s.id, s));
        
        // Get empire colors
        const empireColors = new Map();
        state.empires?.forEach(e => empireColors.set(e.id, e.color));
        
        // Draw each trade route as a curved line between systems
        tradeRoutes.forEach(route => {
            const system1Id = planetToSystem.get(route.planet1Id);
            const system2Id = planetToSystem.get(route.planet2Id);
            
            if (!system1Id || !system2Id) return;
            
            // Skip if both planets are in same system (draw in system view instead)
            if (system1Id === system2Id) return;
            
            const system1 = systemMap.get(system1Id);
            const system2 = systemMap.get(system2Id);
            
            // Skip if either system is not in this galaxy
            if (!system1 || !system2) return;
            
            const color = empireColors.get(route.empireId) || '#888888';
            
            // Calculate curve control point (offset perpendicular to line)
            const midX = (system1.x + system2.x) / 2;
            const midY = (system1.y + system2.y) / 2;
            const dx = system2.x - system1.x;
            const dy = system2.y - system1.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            
            // Perpendicular offset for curve
            const offset = len * 0.15;
            const cpX = midX + (-dy / len) * offset;
            const cpY = midY + (dx / len) * offset;
            
            ctx.save();
            
            // Draw route glow
            ctx.beginPath();
            ctx.moveTo(system1.x, system1.y);
            ctx.quadraticCurveTo(cpX, cpY, system2.x, system2.y);
            ctx.strokeStyle = color.replace(')', ', 0.3)').replace('rgb', 'rgba').replace('#', '#');
            // Simple hex to rgba for glow
            if (color.startsWith('#')) {
                const r = parseInt(color.slice(1, 3), 16);
                const g = parseInt(color.slice(3, 5), 16);
                const b = parseInt(color.slice(5, 7), 16);
                ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.3)`;
            }
            ctx.lineWidth = 6;
            ctx.stroke();
            
            // Draw main route line
            ctx.beginPath();
            ctx.moveTo(system1.x, system1.y);
            ctx.quadraticCurveTo(cpX, cpY, system2.x, system2.y);
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 4]);
            ctx.stroke();
            
            // Draw animated "trade flow" dots if route is active
            if (!route.raided) {
                const t = (Date.now() % 2000) / 2000; // 0-1 over 2 seconds
                const dotX = (1 - t) * (1 - t) * system1.x + 2 * (1 - t) * t * cpX + t * t * system2.x;
                const dotY = (1 - t) * (1 - t) * system1.y + 2 * (1 - t) * t * cpY + t * t * system2.y;
                
                ctx.beginPath();
                ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
                ctx.fillStyle = '#ffd700'; // Gold for trade
                ctx.fill();
            }
            
            // Draw raid indicator if raided
            if (route.raided) {
                ctx.beginPath();
                ctx.arc(midX, midY, 8, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
                ctx.fill();
                ctx.fillStyle = '#ff0000';
                ctx.font = 'bold 12px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('☠', midX, midY);
            }
            
            ctx.restore();
        });
    }
    
    /**
     * Draw hyperlane network in galaxy view
     * Only shows connections for hovered/selected system to reduce clutter
     */
    drawHyperlanes(ctx, state, galaxyId, systems) {
        const hyperlanes = state.universe.hyperlanes || [];
        if (hyperlanes.length === 0) return;
        
        // Only show hyperlanes connected to hovered or selected system
        const activeSystemId = this.hoveredObject?.id || this.selectedObject?.id;
        if (!activeSystemId || !activeSystemId.startsWith('system_')) return;
        
        // Create system lookup map
        const systemMap = new Map();
        systems.forEach(s => systemMap.set(s.id, s));
        
        // Draw only hyperlanes connected to the active system
        hyperlanes.forEach(lane => {
            // Only draw if connected to active system
            if (lane.from !== activeSystemId && lane.to !== activeSystemId) return;
            
            // Only draw lanes that are in this galaxy or are wormholes
            if (lane.galaxyId !== galaxyId && lane.type !== 'wormhole') return;
            
            const fromSystem = systemMap.get(lane.from);
            const toSystem = systemMap.get(lane.to);
            
            // For wormholes, one system might be in another galaxy
            if (!fromSystem && !toSystem) return;
            
            // Get positions (for wormholes, extend line to edge of view if destination not visible)
            let x1 = fromSystem?.x;
            let y1 = fromSystem?.y;
            let x2 = toSystem?.x;
            let y2 = toSystem?.y;
            
            // If one end is outside this galaxy (wormhole), find the external system
            if (!fromSystem || !toSystem) {
                const externalId = fromSystem ? lane.to : lane.from;
                const externalSystem = state.universe.solarSystems?.find(s => s.id === externalId);
                if (!externalSystem) return;
                
                // Draw to/from the external system position (will show as line going off-galaxy)
                if (!fromSystem) {
                    x1 = externalSystem.x;
                    y1 = externalSystem.y;
                }
                if (!toSystem) {
                    x2 = externalSystem.x;
                    y2 = externalSystem.y;
                }
            }
            
            if (x1 === undefined || y1 === undefined || x2 === undefined || y2 === undefined) return;
            
            // Draw the hyperlane
            if (lane.type === 'wormhole') {
                // Wormholes: purple, dashed
                ctx.save();
                ctx.setLineDash([8, 4]);
                
                // Glow effect
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.strokeStyle = 'rgba(168, 85, 247, 0.6)';
                ctx.lineWidth = 4;
                ctx.stroke();
                
                // Main line
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.strokeStyle = '#a855f7';
                ctx.lineWidth = 2;
                ctx.stroke();
                
                ctx.restore();
            } else {
                // Standard hyperlanes: cyan
                // Glow
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.strokeStyle = 'rgba(0, 212, 255, 0.4)';
                ctx.lineWidth = 4;
                ctx.stroke();
                
                // Inner line
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.strokeStyle = 'rgba(0, 212, 255, 0.8)';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        });
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
        
        // Draw terrain feature for this system (behind everything)
        const terrainFeature = state.universe?.terrainFeatures?.find(f => f.systemId === system.id);
        if (terrainFeature) {
            this.drawTerrainFeature(ctx, system, terrainFeature);
        }

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

            // Store for hit detection (larger radius for easier clicking)
            this.systemPlanets.push({ ...planet, screenX: px, screenY: py, radius: 20 });

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
                    // Draw outer glow (bigger, more visible)
                    ctx.beginPath();
                    ctx.arc(px, py, isHovered ? 22 : 18, 0, Math.PI * 2);
                    ctx.strokeStyle = empire.color;
                    ctx.lineWidth = 8;
                    ctx.globalAlpha = 0.4;
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                    
                    // Draw ownership ring (much thicker - 5px)
                    ctx.beginPath();
                    ctx.arc(px, py, isHovered ? 16 : 14, 0, Math.PI * 2);
                    ctx.strokeStyle = empire.color;
                    ctx.lineWidth = 5;
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

            // Planet name - white, clear, not bold
            ctx.fillStyle = '#ffffff';
            ctx.font = '11px Arial, sans-serif';
            ctx.textAlign = 'center';
            // Add slight text shadow for readability
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = 3;
            ctx.fillText(planet.name, px, py + 24);
            ctx.shadowBlur = 0;
        });

        // Draw starbase if present in this system
        const starbase = state.starbases?.find(sb => sb.systemId === system.id);
        if (starbase) {
            const sbX = system.x + 80;
            const sbY = system.y - 60;
            
            // Get empire color
            const empire = state.empires?.find(e => e.id === starbase.owner);
            const sbColor = empire?.color || '#888';
            
            // Draw starbase structure
            const sbSize = starbase.tier * 8 + 10;  // Bigger for higher tiers
            
            // Outer glow
            ctx.beginPath();
            ctx.arc(sbX, sbY, sbSize + 8, 0, Math.PI * 2);
            ctx.fillStyle = `${sbColor}33`;
            ctx.fill();
            
            // Main structure
            ctx.beginPath();
            ctx.arc(sbX, sbY, sbSize, 0, Math.PI * 2);
            ctx.fillStyle = starbase.constructing !== false ? '#555' : sbColor;
            ctx.fill();
            
            // HP bar
            if (!starbase.constructing) {
                const hpPercent = starbase.hp / starbase.maxHp;
                const barWidth = 30;
                const barHeight = 4;
                
                ctx.fillStyle = '#333';
                ctx.fillRect(sbX - barWidth/2, sbY + sbSize + 5, barWidth, barHeight);
                ctx.fillStyle = hpPercent > 0.5 ? '#4ade80' : hpPercent > 0.25 ? '#fbbf24' : '#ef4444';
                ctx.fillRect(sbX - barWidth/2, sbY + sbSize + 5, barWidth * hpPercent, barHeight);
            }
            
            // Icon and name
            const sbIcon = starbase.tierName === 'citadel' ? '🏰' : 
                          starbase.tierName === 'starbase' ? '🛸' : '🛰️';
            ctx.font = '16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(sbIcon, sbX, sbY + 5);
            
            ctx.fillStyle = starbase.constructing !== false ? '#888' : '#fff';
            ctx.font = '9px sans-serif';
            ctx.fillText(starbase.name, sbX, sbY + sbSize + 18);
            
            // Show "Under Construction" if building
            if (starbase.constructing !== false) {
                ctx.fillStyle = '#fbbf24';
                ctx.font = 'bold 8px sans-serif';
                ctx.fillText('BUILDING...', sbX, sbY - sbSize - 5);
            }
            
            // Show modules count
            if (starbase.modules?.length > 0) {
                ctx.fillStyle = '#aaa';
                ctx.font = '8px sans-serif';
                ctx.fillText(`${starbase.modules.length}/${starbase.moduleSlots} modules`, sbX, sbY + sbSize + 28);
            }
        }

        // Update hover state for planets in system view
        this.updateSystemHover();
    }
    
    /**
     * Draw galactic terrain feature (nebula, black hole, neutron star, asteroid field)
     * These are rendered as atmospheric effects behind the system content
     */
    drawTerrainFeature(ctx, system, feature) {
        const x = system.x;
        const y = system.y;
        const size = feature.size || 50;
        const time = Date.now() * 0.001;
        
        ctx.save();
        
        switch (feature.type) {
            case 'nebula':
                // Swirling gas clouds
                for (let i = 0; i < 5; i++) {
                    const angle = (i / 5) * Math.PI * 2 + time * 0.1;
                    const radius = size * 0.5 + Math.sin(time + i) * 10;
                    const cloudX = x + Math.cos(angle) * radius * 0.3;
                    const cloudY = y + Math.sin(angle) * radius * 0.3;
                    const cloudSize = size * 0.4 + Math.sin(time * 0.5 + i) * 5;
                    const alpha = 0.15 + Math.sin(time + i * 0.5) * 0.05;
                    
                    ctx.beginPath();
                    ctx.arc(cloudX, cloudY, cloudSize, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(136, 68, 170, ${alpha})`;
                    ctx.fill();
                }
                // Outer haze
                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(102, 68, 204, 0.08)';
                ctx.fill();
                break;
                
            case 'black_hole':
                // Accretion disk
                const diskPulse = 0.9 + Math.sin(time * 3) * 0.1;
                for (let i = 8; i >= 0; i--) {
                    const ratio = i / 8;
                    const radius = size * ratio * diskPulse;
                    const alpha = (1 - ratio) * 0.4;
                    ctx.beginPath();
                    ctx.arc(x, y, radius, 0, Math.PI * 2);
                    ctx.fillStyle = i > 5 ? `rgba(255, 68, 255, ${alpha})` : `rgba(0, 0, 0, ${alpha})`;
                    ctx.fill();
                }
                // Event horizon (pure black center)
                ctx.beginPath();
                ctx.arc(x, y, size * 0.3, 0, Math.PI * 2);
                ctx.fillStyle = '#000000';
                ctx.fill();
                // Gravitational lensing ring
                ctx.beginPath();
                ctx.arc(x, y, size * 0.35, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.lineWidth = 1;
                ctx.stroke();
                break;
                
            case 'neutron_star':
                // Intense radiation pulses
                const pulse = 0.7 + Math.sin(time * 8) * 0.3;
                // Radiation field
                for (let i = 6; i >= 0; i--) {
                    const ratio = i / 6;
                    const radius = size * ratio * pulse;
                    const alpha = (1 - ratio) * 0.5;
                    ctx.beginPath();
                    ctx.arc(x, y, radius, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(0, 255, 255, ${alpha})`;
                    ctx.fill();
                }
                // Bright core
                ctx.beginPath();
                ctx.arc(x, y, size * 0.15, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.fill();
                // Warning indicator (pulsing red)
                const warningAlpha = 0.3 + Math.sin(time * 4) * 0.2;
                ctx.beginPath();
                ctx.arc(x, y, size * 0.8, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(255, 0, 0, ${warningAlpha})`;
                ctx.lineWidth = 2;
                ctx.stroke();
                break;
                
            case 'asteroid_field':
                // Scattered asteroids
                const asteroidCount = 12;
                for (let i = 0; i < asteroidCount; i++) {
                    const seed = i * 7.3;
                    const angle = (i / asteroidCount) * Math.PI * 2 + time * 0.05 * (i % 3 === 0 ? 1 : -1);
                    const orbitRadius = size * 0.4 + (seed % 30);
                    const asteroidX = x + Math.cos(angle) * orbitRadius;
                    const asteroidY = y + Math.sin(angle) * orbitRadius * 0.6; // Elliptical
                    const asteroidSize = 3 + (seed % 8);
                    
                    ctx.beginPath();
                    ctx.arc(asteroidX, asteroidY, asteroidSize, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(136, 119, 102, 0.7)';
                    ctx.fill();
                }
                // Dust cloud
                ctx.beginPath();
                ctx.arc(x, y, size * 0.7, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(153, 136, 119, 0.05)';
                ctx.fill();
                break;
        }
        
        // Draw terrain label
        const terrainIcons = {
            nebula: '🌫️',
            black_hole: '🕳️',
            neutron_star: '⚡',
            asteroid_field: '🪨'
        };
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(terrainIcons[feature.type] || '❓', x, y - size - 15);
        
        ctx.restore();
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
            // Center on the planet
            if (this.hoveredPlanet.x !== undefined && this.hoveredPlanet.y !== undefined) {
                this.centerOn(this.hoveredPlanet);
            }
            // Play planet selection sound
            window.SoundFX?.play('zoomToPlanet');
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

        const TILE_SIZE = 36;  // Slightly larger for detail
        const surfaceWidth = planet.surface?.[0]?.length || 20;
        const surfaceHeight = planet.surface?.length || 15;
        const gridWidth = surfaceWidth * TILE_SIZE;
        const gridHeight = surfaceHeight * TILE_SIZE;
        const offsetX = -gridWidth / 2 - 80;  // Shift left to make room for panels
        const offsetY = -gridHeight / 2 + 30;
        
        // Animation frame for effects (throttled for performance)
        const animFrame = this._animFrame || 0;
        
        // Planet type themes - atmosphere, colors, effects
        const planetThemes = {
            terrestrial: { 
                atmosphere: 'rgba(100, 200, 255, 0.08)', 
                glow: '#4ade80',
                ambient: ['🌿', '🦋', '🌸'],
                bgGradient: ['#0a1628', '#0d2818']
            },
            ocean: { 
                atmosphere: 'rgba(59, 130, 246, 0.12)', 
                glow: '#3b82f6',
                ambient: ['💧', '🐟', '🌊'],
                bgGradient: ['#0a1628', '#0a1a30']
            },
            desert: { 
                atmosphere: 'rgba(252, 211, 77, 0.08)', 
                glow: '#fcd34d',
                ambient: ['🌵', '☀️', '🏜️'],
                bgGradient: ['#1a1408', '#281a08']
            },
            ice: { 
                atmosphere: 'rgba(191, 219, 254, 0.1)', 
                glow: '#bfdbfe',
                ambient: ['❄️', '🌨️', '💎'],
                bgGradient: ['#0a1628', '#1a2840']
            },
            volcanic: { 
                atmosphere: 'rgba(239, 68, 68, 0.1)', 
                glow: '#ef4444',
                ambient: ['🔥', '💨', '🌋'],
                bgGradient: ['#1a0808', '#281008']
            },
            gas_giant: { 
                atmosphere: 'rgba(249, 115, 22, 0.1)', 
                glow: '#f97316',
                ambient: ['⚡', '🌀', '☁️'],
                bgGradient: ['#1a1008', '#281810']
            }
        };
        
        const theme = planetThemes[planet.type] || planetThemes.terrestrial;

        // === DRAW ATMOSPHERIC BACKGROUND ===
        const bgGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 600);
        bgGrad.addColorStop(0, theme.bgGradient[1]);
        bgGrad.addColorStop(1, theme.bgGradient[0]);
        ctx.fillStyle = bgGrad;
        ctx.fillRect(-this.canvas.width/2/this.camera.zoom, -this.canvas.height/2/this.camera.zoom, 
                     this.canvas.width/this.camera.zoom, this.canvas.height/this.camera.zoom);
        
        // Atmospheric glow around grid (reduced blur during zoom for performance)
        ctx.save();
        ctx.shadowColor = theme.glow;
        ctx.shadowBlur = this._isZooming ? 10 : 40;
        ctx.fillStyle = theme.atmosphere;
        ctx.beginPath();
        ctx.roundRect(offsetX - 15, offsetY - 15, gridWidth + 30, gridHeight + 30, 12);
        ctx.fill();
        ctx.restore();

        // === TERRAIN COLORS WITH GRADIENTS ===
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
        
        // Enhanced terrain detail rendering
        const drawTerrainDetail = (ctx, px, py, size, terrain, seed) => {
            const rng = (s) => Math.abs(Math.sin(s * 9999.9) * 99999.9) % 1;
            
            switch (terrain) {
                case 'mountain':
                    // Multiple peaks with snow caps
                    ctx.fillStyle = '#555';
                    ctx.beginPath();
                    ctx.moveTo(px + size * 0.5, py + 3);
                    ctx.lineTo(px + size - 3, py + size - 3);
                    ctx.lineTo(px + 3, py + size - 3);
                    ctx.closePath();
                    ctx.fill();
                    // Snow cap
                    ctx.fillStyle = '#e5e7eb';
                    ctx.beginPath();
                    ctx.moveTo(px + size * 0.5, py + 3);
                    ctx.lineTo(px + size * 0.65, py + size * 0.35);
                    ctx.lineTo(px + size * 0.35, py + size * 0.35);
                    ctx.closePath();
                    ctx.fill();
                    break;
                case 'forest':
                    // Multiple trees
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
                    // Static water detail (waves removed for performance)
                    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(px + 4, py + size/2);
                    ctx.lineTo(px + size - 4, py + size/2);
                    ctx.stroke();
                    break;
                case 'sand':
                    // Sand dunes pattern
                    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
                    ctx.lineWidth = 1;
                    for (let i = 0; i < 2; i++) {
                        ctx.beginPath();
                        ctx.arc(px + size/2, py + size + 10 + i * 15, size * 0.6, Math.PI * 0.2, Math.PI * 0.8);
                        ctx.stroke();
                    }
                    break;
                case 'ice':
                    // Crystal/ice cracks
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
                    // Static lava cracks (animation removed for performance)
                    ctx.strokeStyle = 'rgba(255, 200, 50, 0.5)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(px + rng(seed) * size * 0.3, py + size * 0.2);
                    ctx.lineTo(px + size * 0.5, py + size * 0.5);
                    ctx.lineTo(px + size * 0.7 + rng(seed+1) * size * 0.2, py + size * 0.9);
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
            battleship: '🚢',
            transport: '🚐'
        };

        // === DRAW SURFACE TILES WITH ENHANCED GRAPHICS ===
        if (planet.surface) {
            // First pass: terrain with gradients and details
            planet.surface.forEach((row, y) => {
                row.forEach((tile, x) => {
                    const px = offsetX + x * TILE_SIZE;
                    const py = offsetY + y * TILE_SIZE;
                    const seed = x * 1000 + y;
                    
                    const terrainType = typeof tile === 'object' ? tile.type : tile;
                    const colors = tileColors[terrainType] || { base: '#444', light: '#555', dark: '#333' };

                    // During zoom: use flat color for performance
                    if (this._isZooming) {
                        ctx.fillStyle = colors.base;
                        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    } else {
                        // Full quality: gradient for each tile
                        const tileGrad = ctx.createLinearGradient(px, py, px + TILE_SIZE, py + TILE_SIZE);
                        tileGrad.addColorStop(0, colors.light);
                        tileGrad.addColorStop(0.5, colors.base);
                        tileGrad.addColorStop(1, colors.dark);
                        
                        ctx.fillStyle = tileGrad;
                        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                        
                        // Add terrain details (only when not zooming)
                        drawTerrainDetail(ctx, px, py, TILE_SIZE, terrainType, seed);
                        
                        // Subtle inner shadow for depth
                        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
                        ctx.lineWidth = 1;
                        ctx.strokeRect(px + 0.5, py + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
                        
                        // Highlight edge
                        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
                        ctx.beginPath();
                        ctx.moveTo(px, py + TILE_SIZE);
                        ctx.lineTo(px, py);
                        ctx.lineTo(px + TILE_SIZE, py);
                        ctx.stroke();
                    }
                });
            });
            
            // Second pass: buildings with professional styling
            planet.surface.forEach((row, y) => {
                row.forEach((tile, x) => {
                    const px = offsetX + x * TILE_SIZE;
                    const py = offsetY + y * TILE_SIZE;
                    
                    const struct = structureMap.get(`${x},${y}`);
                    if (struct) {
                        const ownerEmpire = state.empires?.find(e => e.id === struct.owner);
                        const ownerColor = ownerEmpire?.color || '#888';
                        
                        // Building shadow
                        ctx.fillStyle = 'rgba(0,0,0,0.4)';
                        ctx.beginPath();
                        ctx.roundRect(px + 4, py + 4, TILE_SIZE - 4, TILE_SIZE - 4, 6);
                        ctx.fill();
                        
                        // Building base with gradient
                        const buildGrad = ctx.createLinearGradient(px, py, px, py + TILE_SIZE);
                        buildGrad.addColorStop(0, 'rgba(50, 55, 70, 0.95)');
                        buildGrad.addColorStop(1, 'rgba(25, 28, 35, 0.95)');
                        ctx.fillStyle = buildGrad;
                        ctx.beginPath();
                        ctx.roundRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4, 6);
                        ctx.fill();
                        
                        // Glowing owner border (reduced glow during zoom)
                        ctx.save();
                        ctx.shadowColor = ownerColor;
                        ctx.shadowBlur = this._isZooming ? 0 : (struct.constructing ? 3 : 8);
                        ctx.strokeStyle = ownerColor;
                        ctx.lineWidth = 2;
                        ctx.stroke();
                        ctx.restore();
                        
                        // Building icon with shadow (skip shadow during zoom)
                        ctx.save();
                        if (!this._isZooming) {
                            ctx.shadowColor = 'rgba(0,0,0,0.5)';
                            ctx.shadowBlur = 3;
                            ctx.shadowOffsetY = 2;
                        }
                        ctx.font = `${TILE_SIZE - 12}px sans-serif`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(
                            structureIcons[struct.defName] || '🏗️', 
                            px + TILE_SIZE / 2, 
                            py + TILE_SIZE / 2 - 2
                        );
                        ctx.restore();
                        
                        // Construction progress bar
                        if (struct.constructing) {
                            const progress = struct.constructionProgress || 0;
                            const barWidth = TILE_SIZE - 8;
                            const barY = py + TILE_SIZE - 8;
                            
                            // Bar background
                            ctx.fillStyle = 'rgba(0,0,0,0.6)';
                            ctx.fillRect(px + 4, barY, barWidth, 5);
                            
                            // Progress fill with gradient
                            const progGrad = ctx.createLinearGradient(px + 4, barY, px + 4 + barWidth * progress, barY);
                            progGrad.addColorStop(0, '#00d4ff');
                            progGrad.addColorStop(1, '#0ea5e9');
                            ctx.fillStyle = progGrad;
                            ctx.fillRect(px + 4, barY, barWidth * progress, 5);
                            
                            // Animated shine
                            const shineX = px + 4 + (animFrame * 2 % (barWidth + 20)) - 10;
                            ctx.fillStyle = 'rgba(255,255,255,0.4)';
                            ctx.fillRect(Math.max(px + 4, shineX), barY, Math.min(10, barWidth * progress), 5);
                        }
                    }
                });
            });
        } else {
            // No surface data - show professional loading state
            ctx.save();
            
            // Pulsing planet silhouette
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
            
            // Loading spinner
            ctx.save();
            ctx.rotate(animFrame * 0.03);
            ctx.strokeStyle = theme.glow;
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(0, 0, 180, 0, Math.PI * 0.5);
            ctx.stroke();
            ctx.restore();
            
            // Loading text
            ctx.fillStyle = '#e8eaf0';
            ctx.font = 'bold 18px "Segoe UI", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('SCANNING SURFACE...', 0, 0);
            ctx.fillStyle = '#9ca3b8';
            ctx.font = '13px "Segoe UI", sans-serif';
            ctx.fillText('Click planet to load detailed view', 0, 30);
        }
        
        // === UNPLACED STRUCTURES (legacy) ===
        const unplacedStructures = structures.filter(s => s.gridX === null || s.gridY === null);
        // (skipped for clean UI - legacy structures auto-place now)

        // === MILITARY FORCES PANEL (bottom) ===
        if (units.length > 0) {
            const panelX = offsetX;
            const panelY = offsetY + gridHeight + 15;
            const panelWidth = gridWidth;
            const panelHeight = 75;
            
            // Panel background with gradient
            const unitPanelGrad = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelHeight);
            unitPanelGrad.addColorStop(0, 'rgba(15, 20, 35, 0.95)');
            unitPanelGrad.addColorStop(1, 'rgba(8, 12, 24, 0.95)');
            ctx.fillStyle = unitPanelGrad;
            ctx.beginPath();
            ctx.roundRect(panelX, panelY, panelWidth, panelHeight, 8);
            ctx.fill();
            
            // Panel border
            ctx.strokeStyle = 'rgba(0, 212, 255, 0.3)';
            ctx.lineWidth = 1;
            ctx.stroke();
            
            // Panel header
            ctx.fillStyle = '#00d4ff';
            ctx.font = 'bold 11px "Segoe UI", sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(`⚔️ MILITARY FORCES (${units.length})`, panelX + 12, panelY + 16);
            
            // Draw units in a row
            const unitStartX = panelX + 15;
            const unitStartY = panelY + 45;
            const unitSpacing = 42;
            
            units.slice(0, Math.floor(panelWidth / unitSpacing)).forEach((unit, i) => {
                const ux = unitStartX + i * unitSpacing;
                const uy = unitStartY;
                
                const ownerEmpire = state.empires?.find(e => e.id === unit.owner);
                const ownerColor = ownerEmpire?.color || '#888';
                
                // Unit card background
                ctx.fillStyle = 'rgba(30, 35, 50, 0.9)';
                ctx.beginPath();
                ctx.roundRect(ux - 16, uy - 16, 32, 36, 6);
                ctx.fill();
                
                // Owner color accent
                ctx.fillStyle = ownerColor;
                ctx.fillRect(ux - 16, uy - 16, 32, 3);
                
                // Unit icon
                ctx.font = '18px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(unitIcons[unit.defName] || '🤖', ux, uy - 2);
                
                // HP bar
                const hpPct = unit.hp / unit.maxHp;
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(ux - 12, uy + 12, 24, 4);
                ctx.fillStyle = hpPct > 0.5 ? '#4ade80' : hpPct > 0.25 ? '#fbbf24' : '#ef4444';
                ctx.fillRect(ux - 12, uy + 12, 24 * hpPct, 4);
            });
            
            // Show overflow count
            if (units.length > Math.floor(panelWidth / unitSpacing)) {
                const overflow = units.length - Math.floor(panelWidth / unitSpacing);
                ctx.fillStyle = '#9ca3b8';
                ctx.font = '11px "Segoe UI", sans-serif';
                ctx.textAlign = 'right';
                ctx.fillText(`+${overflow} more`, panelX + panelWidth - 12, panelY + 16);
            }
        }
        
        // Legacy unit rendering (unused now)
        const unitStartX = offsetX + 20;
        const unitStartY = offsetY + gridHeight + 100;
        const unitSpacing = 35;

        // Skip old unit rendering - handled by panel above
        const skipOldUnits = true;
        if (!skipOldUnits) units.forEach((unit, i) => {
            const ux = unitStartX + (i % 15) * unitSpacing;
            const uy = unitStartY + Math.floor(i / 15) * 40;

            const ownerEmpire = state.empires?.find(e => e.id === unit.owner);
            const ownerColor = ownerEmpire?.color || '#888';

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

        // === PROFESSIONAL PLANET HEADER ===
        const ownerEmpire = state.empires?.find(e => e.id === planet.owner);
        const headerY = offsetY - 70;
        const headerHeight = 65;
        
        // Header background with gradient
        const headerGrad = ctx.createLinearGradient(offsetX, headerY, offsetX, headerY + headerHeight);
        headerGrad.addColorStop(0, 'rgba(15, 20, 35, 0.98)');
        headerGrad.addColorStop(1, 'rgba(8, 12, 24, 0.95)');
        ctx.fillStyle = headerGrad;
        ctx.beginPath();
        ctx.roundRect(offsetX, headerY, gridWidth, headerHeight, 8);
        ctx.fill();
        
        // Accent line at top
        ctx.fillStyle = theme.glow;
        ctx.fillRect(offsetX, headerY, gridWidth, 3);
        
        // Planet type badge
        const typeEmoji = { terrestrial: '🌍', ocean: '🌊', desert: '🏜️', ice: '❄️', volcanic: '🌋', gas_giant: '🪐' };
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.roundRect(offsetX + 10, headerY + 12, 40, 40, 6);
        ctx.fill();
        ctx.font = '28px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(typeEmoji[planet.type] || '🪐', offsetX + 30, headerY + 34);
        
        // Planet name
        ctx.fillStyle = '#e8eaf0';
        ctx.font = 'bold 20px "Segoe UI", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(planet.name, offsetX + 60, headerY + 10);
        
        // Planet type label
        ctx.fillStyle = theme.glow;
        ctx.font = '11px "Segoe UI", sans-serif';
        const typeLabel = (planet.type || 'unknown').charAt(0).toUpperCase() + (planet.type || 'unknown').slice(1).replace('_', ' ');
        ctx.fillText(typeLabel + ' World', offsetX + 60, headerY + 34);
        
        // Owner info with species
        if (ownerEmpire) {
            ctx.fillStyle = ownerEmpire.color;
            ctx.beginPath();
            ctx.arc(offsetX + 65, headerY + 52, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#9ca3b8';
            ctx.font = '12px "Segoe UI", sans-serif';
            ctx.fillText(ownerEmpire.name, offsetX + 75, headerY + 48);
            
            // Species info
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
        
        // Stats on right side
        ctx.textAlign = 'right';
        ctx.fillStyle = '#e8eaf0';
        ctx.font = '13px "Segoe UI", sans-serif';
        
        // Population
        ctx.fillText(`👥 ${planet.population?.toLocaleString() || 0}`, offsetX + gridWidth - 15, headerY + 15);
        
        // Structures & Units
        ctx.fillStyle = '#9ca3b8';
        ctx.font = '12px "Segoe UI", sans-serif';
        ctx.fillText(`🏗️ ${structures.length} structures`, offsetX + gridWidth - 15, headerY + 35);
        ctx.fillText(`⚔️ ${units.length} units`, offsetX + gridWidth - 15, headerY + 52);

        // === PRODUCTION SUMMARY PANEL (right side, top) ===
        const rightPanelX = offsetX + gridWidth + 20;
        const prodPanelY = offsetY - 70;
        const panelW = 160;
        
        // Count structures by type for production calculation
        const structCounts = {};
        structures.forEach(s => {
            structCounts[s.defName] = (structCounts[s.defName] || 0) + 1;
        });
        
        // Calculate approximate production
        const production = {
            minerals: (structCounts.mine || 0) * 5,
            energy: (structCounts.power_plant || 0) * 8,
            food: (structCounts.farm || 0) * 10 + (structCounts.fishing_dock || 0) * 8,
            research: (structCounts.research_lab || 0) * 3
        };
        
        // Production panel
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
        
        // Production header
        ctx.fillStyle = '#00d4ff';
        ctx.font = 'bold 11px "Segoe UI", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('📊 PRODUCTION', rightPanelX + 12, prodPanelY + 18);
        
        // Production items
        const prodItems = [
            { icon: '💎', name: 'Minerals', value: production.minerals, color: '#60a5fa' },
            { icon: '⚡', name: 'Energy', value: production.energy, color: '#fbbf24' },
            { icon: '🌾', name: 'Food', value: production.food, color: '#4ade80' },
            { icon: '🔬', name: 'Research', value: production.research, color: '#a78bfa' }
        ];
        
        prodItems.forEach((item, i) => {
            const iy = prodPanelY + 40 + i * 24;
            ctx.font = '14px sans-serif';
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

        // === LEGEND PANEL (compact) ===
        const legendX = rightPanelX;
        const legendY = prodPanelY + 155;
        const legendWidth = panelW;
        
        const terrainTypes = [
            { type: 'water', name: 'Water', color: tileColors.water.base },
            { type: 'plains', name: 'Plains', color: tileColors.plains.base },
            { type: 'forest', name: 'Forest', color: tileColors.forest.base },
            { type: 'mountain', name: 'Mountain', color: tileColors.mountain.base },
            { type: 'lava', name: 'Lava', color: tileColors.lava.base }
        ];
        
        const lineHeight = 20;
        const legendHeight = 35 + terrainTypes.length * lineHeight + 15;
        
        // Legend background
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
        
        // Legend title
        ctx.fillStyle = '#00d4ff';
        ctx.font = 'bold 11px "Segoe UI", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('🗺️ TERRAIN', legendX + 12, ly);
        ly += 18;
        
        terrainTypes.forEach(t => {
            // Color swatch with border - vertically centered with text
            ctx.fillStyle = t.color;
            ctx.beginPath();
            ctx.roundRect(legendX + 12, ly - 5, 14, 14, 3);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.lineWidth = 1;
            ctx.stroke();
            // Name - aligned with swatch center
            ctx.fillStyle = '#9ca3b8';
            ctx.font = '12px "Segoe UI", sans-serif';
            ctx.fillText(t.name, legendX + 32, ly + 4);
            ly += lineHeight;
        });
        
        // === STRUCTURES PANEL ===
        const structPanelY = legendY + legendHeight + 15;
        const uniqueStructTypes = [...new Set(structures.map(s => s.defName))];
        const structPanelHeight = 35 + Math.min(uniqueStructTypes.length, 6) * 22 + 10;
        
        if (structures.length > 0) {
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
        
        // === MILITARY UNITS PANEL ===
        const unitCounts = {};
        units.forEach(u => {
            unitCounts[u.defName] = (unitCounts[u.defName] || 0) + 1;
        });
        const uniqueUnitTypes = [...new Set(units.map(u => u.defName))];
        
        if (units.length > 0) {
            const militaryPanelY = structures.length > 0 ? structPanelY + structPanelHeight + 15 : legendY + legendHeight + 15;
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
        
        // === TECH/BUILD INFO PANEL (left side) ===
        // Show what can be built here based on terrain and tech
        const leftPanelX = offsetX - panelW - 25;
        const buildInfoY = offsetY - 70;
        
        // Building requirements info
        const buildingInfo = [
            { icon: '⛏️', name: 'Mine', terrain: 'mountain', desc: 'Requires mountain' },
            { icon: '🌾', name: 'Farm', terrain: 'plains', desc: 'Requires plains' },
            { icon: '🎣', name: 'Fishing Dock', terrain: 'water', desc: 'Requires water' },
            { icon: '🪓', name: 'Lumber Mill', terrain: 'forest', desc: 'Requires forest' },
            { icon: '⚡', name: 'Power Plant', terrain: 'any', desc: 'Any land tile' },
            { icon: '🔬', name: 'Research Lab', terrain: 'any', desc: 'Any land tile' },
            { icon: '🏛️', name: 'Barracks', terrain: 'any', desc: 'Trains soldiers' },
            { icon: '🚀', name: 'Shipyard', terrain: 'any', desc: 'Requires tech' }
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

        // === SPECIES INFO PANEL (if owned planet) ===
        if (ownerEmpire && ownerEmpire.species) {
            const species = ownerEmpire.species;
            const speciesPanelY = buildInfoY + buildPanelHeight + 15;
            
            // Calculate height based on content
            const bonusCount = (species.bonuses?.length || 0);
            const penaltyCount = (species.penalties?.length || 0);
            const worldBonusCount = (species.worldBonuses?.length || 0);
            const totalLines = 2 + bonusCount + penaltyCount + worldBonusCount + (species.specialAbility ? 2 : 0);
            const speciesPanelH = 50 + totalLines * 14;
            
            // Panel background
            const speciesGrad = ctx.createLinearGradient(leftPanelX, speciesPanelY, leftPanelX, speciesPanelY + speciesPanelH);
            speciesGrad.addColorStop(0, 'rgba(15, 20, 35, 0.95)');
            speciesGrad.addColorStop(1, 'rgba(8, 12, 24, 0.95)');
            ctx.fillStyle = speciesGrad;
            ctx.beginPath();
            ctx.roundRect(leftPanelX, speciesPanelY, panelW, speciesPanelH, 8);
            ctx.fill();
            
            // Border color based on category
            const categoryColors = {
                organic: 'rgba(74, 222, 128, 0.4)',
                synthetic: 'rgba(96, 165, 250, 0.4)',
                exotic: 'rgba(167, 139, 250, 0.4)'
            };
            ctx.strokeStyle = categoryColors[species.category] || 'rgba(255, 255, 255, 0.15)';
            ctx.lineWidth = 1;
            ctx.stroke();
            
            // Header
            const categoryIcons = { organic: '🧬', synthetic: '🤖', exotic: '✨' };
            ctx.fillStyle = ownerEmpire.color;
            ctx.font = 'bold 11px "Segoe UI", sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(`${categoryIcons[species.category] || '👾'} ${species.name.toUpperCase()}`, leftPanelX + 12, speciesPanelY + 18);
            
            // Category
            ctx.fillStyle = '#6b7280';
            ctx.font = 'italic 9px "Segoe UI", sans-serif';
            ctx.fillText(species.category, leftPanelX + 12, speciesPanelY + 32);
            
            let sy = speciesPanelY + 48;
            
            // Bonuses (green)
            if (species.bonuses && species.bonuses.length > 0) {
                species.bonuses.forEach(bonus => {
                    ctx.fillStyle = '#4ade80';
                    ctx.font = '10px "Segoe UI", sans-serif';
                    ctx.fillText(`▲ ${bonus}`, leftPanelX + 12, sy);
                    sy += 14;
                });
            }
            
            // Penalties (red)
            if (species.penalties && species.penalties.length > 0) {
                species.penalties.forEach(penalty => {
                    ctx.fillStyle = '#f87171';
                    ctx.font = '10px "Segoe UI", sans-serif';
                    ctx.fillText(`▼ ${penalty}`, leftPanelX + 12, sy);
                    sy += 14;
                });
            }
            
            // World bonuses (blue)
            if (species.worldBonuses && species.worldBonuses.length > 0) {
                species.worldBonuses.forEach(wb => {
                    ctx.fillStyle = '#60a5fa';
                    ctx.font = '10px "Segoe UI", sans-serif';
                    ctx.fillText(`🌍 ${wb}`, leftPanelX + 12, sy);
                    sy += 14;
                });
            }
            
            // Special ability
            if (species.specialAbility) {
                sy += 4;
                ctx.fillStyle = '#fbbf24';
                ctx.font = 'bold 9px "Segoe UI", sans-serif';
                ctx.fillText(`⭐ ${species.specialAbility.name}`, leftPanelX + 12, sy);
            }
        }

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
     * Draw a clean vector ship icon (no pixelated sprites)
     * @param {CanvasRenderingContext2D} ctx 
     * @param {string} color - Empire color
     * @param {number} scale - Size multiplier
     */
    drawVectorShip(ctx, color, scale = 1) {
        const s = 8 * scale; // Base size
        
        // Enable anti-aliasing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Ship body shadow
        ctx.beginPath();
        ctx.moveTo(s * 1.2 + 1, 1);
        ctx.lineTo(-s * 0.6 + 1, -s * 0.5 + 1);
        ctx.lineTo(-s * 0.3 + 1, 1);
        ctx.lineTo(-s * 0.6 + 1, s * 0.5 + 1);
        ctx.closePath();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fill();
        
        // Main ship body - sleek arrow shape
        ctx.beginPath();
        ctx.moveTo(s * 1.2, 0);          // Nose (sharp point)
        ctx.lineTo(s * 0.3, -s * 0.3);   // Upper nose edge
        ctx.lineTo(-s * 0.2, -s * 0.35); // Upper wing start
        ctx.lineTo(-s * 0.6, -s * 0.5);  // Wing tip top
        ctx.lineTo(-s * 0.4, -s * 0.15); // Wing inner top
        ctx.lineTo(-s * 0.3, 0);          // Back center
        ctx.lineTo(-s * 0.4, s * 0.15);  // Wing inner bottom
        ctx.lineTo(-s * 0.6, s * 0.5);   // Wing tip bottom
        ctx.lineTo(-s * 0.2, s * 0.35);  // Lower wing start
        ctx.lineTo(s * 0.3, s * 0.3);    // Lower nose edge
        ctx.closePath();
        
        // Fill with gradient for depth
        const grad = ctx.createLinearGradient(-s * 0.6, -s * 0.5, s * 1.2, s * 0.5);
        grad.addColorStop(0, this._lightenColor(color, 40));
        grad.addColorStop(0.5, color);
        grad.addColorStop(1, this._darkenColor(color, 30));
        ctx.fillStyle = grad;
        ctx.fill();
        
        // Clean white outline
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 1;
        ctx.lineJoin = 'round';
        ctx.stroke();
        
        // Engine glow
        ctx.beginPath();
        ctx.arc(-s * 0.3, 0, s * 0.15, 0, Math.PI * 2);
        ctx.fillStyle = '#00ffff';
        ctx.globalAlpha = 0.8;
        ctx.fill();
        ctx.globalAlpha = 1;
        
        // Cockpit highlight
        ctx.beginPath();
        ctx.ellipse(s * 0.4, 0, s * 0.2, s * 0.1, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fill();
    }
    
    // Color manipulation helpers
    _lightenColor(hex, percent) {
        const num = parseInt(hex.replace('#', ''), 16);
        const r = Math.min(255, (num >> 16) + percent);
        const g = Math.min(255, ((num >> 8) & 0x00FF) + percent);
        const b = Math.min(255, (num & 0x0000FF) + percent);
        return `rgb(${r}, ${g}, ${b})`;
    }
    
    _darkenColor(hex, percent) {
        const num = parseInt(hex.replace('#', ''), 16);
        const r = Math.max(0, (num >> 16) - percent);
        const g = Math.max(0, ((num >> 8) & 0x00FF) - percent);
        const b = Math.max(0, (num & 0x0000FF) - percent);
        return `rgb(${r}, ${g}, ${b})`;
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
            
            // Check if this is a cross-galaxy trip
            const isCrossGalaxy = fleet.originGalaxyId && fleet.destGalaxyId && 
                                  fleet.originGalaxyId !== fleet.destGalaxyId;

            // Calculate current position based on progress
            const progress = fleet.progress || 0;
            const currentX = originX + (destX - originX) * progress;
            const currentY = originY + (destY - originY) * progress;

            // Draw glow effect for fleet path (especially for cross-galaxy)
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

            // Draw the trail line (from origin to current position)
            ctx.beginPath();
            ctx.moveTo(originX, originY);
            ctx.lineTo(currentX, currentY);
            ctx.strokeStyle = empireColor;
            ctx.lineWidth = isCrossGalaxy ? 4 : 2;
            ctx.globalAlpha = 0.8;
            ctx.stroke();
            ctx.globalAlpha = 1;

            // Draw the remaining path (dashed)
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

            // Draw fleet icon at current position
            const angle = Math.atan2(destY - originY, destX - originX);
            const iconScale = isCrossGalaxy ? 1.5 : 1;
            
            ctx.save();
            ctx.translate(currentX, currentY);
            ctx.rotate(angle);
            ctx.scale(iconScale, iconScale);

            // Draw glow behind ship for cross-galaxy trips
            if (isCrossGalaxy) {
                ctx.beginPath();
                ctx.arc(0, 0, 12, 0, Math.PI * 2);
                ctx.fillStyle = empireColor;
                ctx.globalAlpha = 0.3;
                ctx.fill();
                ctx.globalAlpha = 1;
            }

            // Draw clean vector ship icon (much better than pixelated sprites)
            this.drawVectorShip(ctx, empireColor, iconScale);

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
