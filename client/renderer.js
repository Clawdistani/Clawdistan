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
        this.hoveredObject = null;
        this.empireColors = {};
        this.mouseWorld = { x: 0, y: 0 };

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
            if (this.hoveredObject) {
                this.selectedObject = this.hoveredObject;
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
    }

    setViewMode(mode) {
        this.viewMode = mode;
        this.fitView();
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
                    break;
                case 'galaxy':
                    this.drawGalaxy(ctx, state);
                    break;
                case 'system':
                    this.drawSystem(ctx, state);
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

        ctx.save();
        ctx.translate(x, y);

        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        gradient.addColorStop(0, 'rgba(100, 150, 255, 0.3)');
        gradient.addColorStop(0.5, 'rgba(50, 100, 200, 0.1)');
        gradient.addColorStop(1, 'rgba(0, 50, 150, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#888';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(galaxy.name, 0, r + 15);

        ctx.restore();
    }

    drawSystemIcon(ctx, system, state) {
        const { x, y } = system;

        const starColors = {
            yellow: '#ffff00',
            red: '#ff4444',
            blue: '#4444ff',
            white: '#ffffff',
            orange: '#ff8800'
        };

        const color = starColors[system.starType] || '#ffff00';

        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, 8);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        const ownedPlanets = state.universe.planets?.filter(p =>
            p.systemId === system.id && p.owner
        ) || [];

        if (ownedPlanets.length > 0) {
            const ownerColors = {};
            ownedPlanets.forEach(p => {
                if (!ownerColors[p.owner]) {
                    const empire = state.empires?.find(e => e.id === p.owner);
                    ownerColors[p.owner] = empire?.color || '#888';
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
        const galaxy = this.selectedObject?.galaxyId ?
            state.universe.galaxies?.find(g => g.id === this.selectedObject.galaxyId) :
            state.universe.galaxies?.[0];

        if (!galaxy) return;

        const systems = state.universe.solarSystems?.filter(s => s.galaxyId === galaxy.id) || [];
        systems.forEach(system => this.drawSystemIcon(ctx, system, state));
    }

    drawSystem(ctx, state) {
        const system = this.selectedObject?.systemId ?
            state.universe.solarSystems?.find(s => s.id === this.selectedObject.systemId) :
            state.universe.solarSystems?.[0];

        if (!system) return;

        ctx.beginPath();
        ctx.arc(system.x, system.y, 20, 0, Math.PI * 2);
        ctx.fillStyle = '#ffff00';
        ctx.fill();

        const planets = state.universe.planets?.filter(p => p.systemId === system.id) || [];

        planets.forEach(planet => {
            const px = system.x + Math.cos(planet.orbitAngle) * planet.orbitRadius * 3;
            const py = system.y + Math.sin(planet.orbitAngle) * planet.orbitRadius * 3;

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

            ctx.beginPath();
            ctx.arc(px, py, 8, 0, Math.PI * 2);
            ctx.fillStyle = planetColors[planet.type] || '#888';
            ctx.fill();

            if (planet.owner) {
                const empire = state.empires?.find(e => e.id === planet.owner);
                if (empire) {
                    ctx.beginPath();
                    ctx.arc(px, py, 11, 0, Math.PI * 2);
                    ctx.strokeStyle = empire.color;
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
            }

            ctx.fillStyle = '#aaa';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(planet.name, px, py + 20);
        });
    }

    drawPlanet(ctx, state) {
        const planet = this.selectedObject?.id?.startsWith('planet') ?
            state.universe.planets?.find(p => p.id === this.selectedObject.id) :
            state.universe.planets?.[0];

        if (!planet || !planet.surface) return;

        const TILE_SIZE = 24;
        const offsetX = -((planet.surface[0]?.length || 25) * TILE_SIZE) / 2;
        const offsetY = -((planet.surface.length || 18) * TILE_SIZE) / 2;

        const tileColors = {
            empty: '#87CEEB',
            grass: '#4ade80',
            dirt: '#8B4513',
            stone: '#6b7280',
            water: '#3b82f6'
        };

        planet.surface.forEach((row, y) => {
            row.forEach((tile, x) => {
                const px = offsetX + x * TILE_SIZE;
                const py = offsetY + y * TILE_SIZE;

                ctx.fillStyle = tileColors[tile] || '#444';
                ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                ctx.strokeStyle = 'rgba(0,0,0,0.1)';
                ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
            });
        });
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

    setEmpireColors(empires) {
        empires?.forEach(empire => {
            this.empireColors[empire.id] = empire.color;
        });
    }
}
