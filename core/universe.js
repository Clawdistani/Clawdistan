// Multi-scale universe: Universe → Galaxies → Solar Systems → Planets → Surface

export class Universe {
    constructor() {
        this.galaxies = [];
        this.solarSystems = [];
        this.planets = [];
        this.wormholes = [];  // 5 strategic wormholes connecting distant points
        this.terrainFeatures = [];  // Galactic terrain (nebulae, black holes, etc.)
        this.width = 2400;  // Expanded for stretched spiral layout
        this.height = 2400;
    }
    
    // Terrain feature definitions
    static TERRAIN_TYPES = {
        nebula: {
            name: 'Nebula',
            icon: '🌫️',
            description: 'Dense gas clouds that hide fleets and slow travel',
            effects: {
                sensorBlock: true,      // Hides fleets from outside detection
                travelSpeedMod: 0.7,    // 30% slower travel through
                defenseBonus: 0.2       // +20% defense for ships inside
            },
            colors: ['#8844aa', '#6644cc', '#aa66dd'],  // Purple/violet hues
            chance: 0.15  // 15% chance per system
        },
        black_hole: {
            name: 'Black Hole',
            icon: '🕳️',
            description: 'Gravity wells that slow travel but boost research',
            effects: {
                travelSpeedMod: 0.5,    // 50% slower travel
                researchBonus: 0.5,     // +50% research from planets in system
                gravitySiphon: 2        // Drains 2 energy/tick from ships passing through
            },
            colors: ['#000000', '#220022', '#110011'],
            chance: 0.08  // 8% chance per system
        },
        neutron_star: {
            name: 'Neutron Star',
            icon: '⚡',
            description: 'Intense radiation damages ships but boosts energy',
            effects: {
                radiationDamage: 3,     // 3 damage/tick to ships in system
                energyBonus: 0.3,       // +30% energy from planets in system
                shieldDisrupt: 0.15     // -15% shield effectiveness
            },
            colors: ['#00ffff', '#88ffff', '#ffffff'],
            chance: 0.10  // 10% chance per system
        },
        asteroid_field: {
            name: 'Asteroid Field',
            icon: '🪨',
            description: 'Rich minerals and natural cover for defending fleets',
            effects: {
                miningBonus: 0.4,       // +40% minerals from planets in system
                defenseBonus: 0.25,     // +25% defense for ships
                collisionChance: 0.05   // 5% chance per tick to take 10 damage
            },
            colors: ['#887766', '#665544', '#998877'],
            chance: 0.20  // 20% chance per system
        }
    };

    generate() {
        // Generate galaxies (20 total for a large universe)
        const numGalaxies = 20;
        for (let i = 0; i < numGalaxies; i++) {
            const galaxy = this.createGalaxy(i);
            this.galaxies.push(galaxy);
        }

        // Generate 5 strategic wormholes connecting distant points
        this.generateStrategicWormholes();

        console.log(`Universe generated: ${this.galaxies.length} galaxies, ${this.solarSystems.length} systems, ${this.planets.length} planets, ${this.wormholes.length} wormholes`);
    }
    
    /**
     * Generate 5 strategic wormholes connecting distant points of the universe
     * Each wormhole is a pair of portals that allow instant travel between them
     * Wormholes can be captured and controlled by empires
     */
    generateStrategicWormholes() {
        // Find systems at the edges of the universe for wormhole placement
        const systems = this.solarSystems;
        if (systems.length < 10) return;
        
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        
        // Sort systems by distance from center to find edge systems
        const systemsByDistance = systems
            .map(s => ({
                system: s,
                distance: Math.sqrt((s.x - centerX) ** 2 + (s.y - centerY) ** 2),
                angle: Math.atan2(s.y - centerY, s.x - centerX)
            }))
            .sort((a, b) => b.distance - a.distance);
        
        // Divide the universe into 5 sectors and pick distant pairs
        const wormholeNames = [
            { name: 'Alpha Rift', color: '#ff6b6b' },
            { name: 'Beta Gate', color: '#4ecdc4' },
            { name: 'Gamma Passage', color: '#ffe66d' },
            { name: 'Delta Corridor', color: '#95e1d3' },
            { name: 'Omega Nexus', color: '#dda0dd' }
        ];
        
        // Find 5 pairs of distant systems (opposite sides of universe)
        const usedSystems = new Set();
        
        for (let i = 0; i < 5; i++) {
            // Find a system in one sector
            const sectorAngle = (i / 5) * Math.PI * 2;
            const oppositeAngle = sectorAngle + Math.PI;
            
            // Find best system near this sector angle (outer edge)
            let system1 = null;
            let system2 = null;
            
            for (const entry of systemsByDistance) {
                if (usedSystems.has(entry.system.id)) continue;
                
                const angleDiff1 = Math.abs(this.normalizeAngle(entry.angle - sectorAngle));
                const angleDiff2 = Math.abs(this.normalizeAngle(entry.angle - oppositeAngle));
                
                if (!system1 && angleDiff1 < Math.PI / 5 && entry.distance > centerX * 0.5) {
                    system1 = entry.system;
                }
                if (!system2 && angleDiff2 < Math.PI / 5 && entry.distance > centerX * 0.5) {
                    system2 = entry.system;
                }
                
                if (system1 && system2) break;
            }
            
            // Fallback: just pick any two unused distant systems
            if (!system1 || !system2) {
                for (const entry of systemsByDistance) {
                    if (usedSystems.has(entry.system.id)) continue;
                    if (!system1) { system1 = entry.system; continue; }
                    if (!system2) { system2 = entry.system; break; }
                }
            }
            
            if (system1 && system2) {
                usedSystems.add(system1.id);
                usedSystems.add(system2.id);
                
                const wormholeId = `wormhole_${i}`;
                const { name, color } = wormholeNames[i];
                
                // Create paired wormhole portals
                this.wormholes.push({
                    id: `${wormholeId}_a`,
                    pairId: `${wormholeId}_b`,
                    name: `${name} Alpha`,
                    systemId: system1.id,
                    destSystemId: system2.id,
                    color: color,
                    ownerId: null,  // Neutral by default
                    captureProgress: 0,  // 0-100, capture at 100
                    level: 1  // Can be upgraded
                });
                
                this.wormholes.push({
                    id: `${wormholeId}_b`,
                    pairId: `${wormholeId}_a`,
                    name: `${name} Beta`,
                    systemId: system2.id,
                    destSystemId: system1.id,
                    color: color,
                    ownerId: null,
                    captureProgress: 0,
                    level: 1
                });
            }
        }
    }
    
    /**
     * Normalize angle to [-PI, PI]
     */
    normalizeAngle(angle) {
        while (angle > Math.PI) angle -= Math.PI * 2;
        while (angle < -Math.PI) angle += Math.PI * 2;
        return angle;
    }
    
    /**
     * Get wormhole by ID
     */
    getWormhole(wormholeId) {
        return this.wormholes.find(w => w.id === wormholeId);
    }
    
    /**
     * Get wormhole in a specific system
     */
    getWormholeInSystem(systemId) {
        return this.wormholes.find(w => w.systemId === systemId);
    }
    
    /**
     * Get all wormholes owned by an empire
     */
    getEmpireWormholes(empireId) {
        return this.wormholes.filter(w => w.ownerId === empireId);
    }

    /**
     * Reposition all galaxies to spiral layout
     * Used for migration from grid to spiral
     */
    repositionGalaxiesToSpiral() {
        const centerX = 1200;
        const centerY = 1200;
        const startRadius = 120;
        const spiralSpacing = 140;
        const goldenAngle = 137.5 * (Math.PI / 180);
        
        this.galaxies.forEach((galaxy, index) => {
            const oldX = galaxy.x;
            const oldY = galaxy.y;
            
            const angle = index * goldenAngle;
            const radius = startRadius + spiralSpacing * Math.sqrt(index);
            
            const newX = centerX + Math.cos(angle) * radius;
            const newY = centerY + Math.sin(angle) * radius;
            
            // Calculate offset to move all systems in this galaxy
            const offsetX = newX - oldX;
            const offsetY = newY - oldY;
            
            galaxy.x = newX;
            galaxy.y = newY;
            
            // Move all solar systems in this galaxy
            galaxy.systems.forEach(systemId => {
                const system = this.getSystem(systemId);
                if (system) {
                    system.x += offsetX;
                    system.y += offsetY;
                }
            });
        });
        
        // Update terrain feature positions based on their parent systems
        this.terrainFeatures.forEach(feature => {
            const system = this.getSystem(feature.systemId);
            if (system) {
                // Recalculate relative position
                const angle = Math.random() * Math.PI * 2;
                const dist = 10 + Math.random() * 20;
                feature.x = system.x + Math.cos(angle) * dist;
                feature.y = system.y + Math.sin(angle) * dist;
            }
        });
        
        console.log(`[SPIRAL] Repositioned ${this.galaxies.length} galaxies to spiral layout`);
    }

    /**
     * Expand existing universe with additional galaxies
     * Used to add new galaxies to a running game without reset
     */
    expandUniverse(targetGalaxyCount = 20) {
        const currentCount = this.galaxies.length;
        if (currentCount >= targetGalaxyCount) {
            console.log(`Universe already has ${currentCount} galaxies, no expansion needed`);
            return 0;
        }

        const newGalaxies = [];
        for (let i = currentCount; i < targetGalaxyCount; i++) {
            const galaxy = this.createGalaxy(i);
            this.galaxies.push(galaxy);
            newGalaxies.push(galaxy);
        }

        console.log(`[EXPANSION] Added ${newGalaxies.length} new galaxies (${currentCount} → ${this.galaxies.length})`);
        return newGalaxies.length;
    }

    createGalaxy(index) {
        // Layout: Spiral pattern for a more cosmic look
        // Using Archimedean spiral: r = a + b*θ
        const centerX = 1200;   // Center of the spiral
        const centerY = 1200;
        const startRadius = 120;   // Starting radius from center
        const spiralSpacing = 140; // How much radius increases per revolution (stretched)
        const goldenAngle = 137.5 * (Math.PI / 180); // Golden angle for natural distribution
        
        // Each galaxy placed at golden angle intervals
        const angle = index * goldenAngle;
        const radius = startRadius + spiralSpacing * Math.sqrt(index);
        
        const galaxy = {
            id: `galaxy_${index}`,
            name: this.generateGalaxyName(index),
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius,
            radius: 150,
            systems: []
        };

        // Generate solar systems in this galaxy
        const numSystems = 5 + Math.floor(Math.random() * 5);
        for (let i = 0; i < numSystems; i++) {
            const angle = (i / numSystems) * Math.PI * 2 + Math.random() * 0.5;
            const dist = 30 + Math.random() * (galaxy.radius - 40);

            const system = this.createSolarSystem(galaxy, i, angle, dist);
            galaxy.systems.push(system.id);
        }

        return galaxy;
    }

    createSolarSystem(galaxy, index, angle, dist) {
        const system = {
            id: `system_${galaxy.id}_${index}`,
            name: this.generateSystemName(),
            galaxyId: galaxy.id,
            x: galaxy.x + Math.cos(angle) * dist,
            y: galaxy.y + Math.sin(angle) * dist,
            starType: this.randomStarType(),
            planets: []
        };

        // Generate planets
        const numPlanets = 2 + Math.floor(Math.random() * 5);
        for (let i = 0; i < numPlanets; i++) {
            const planet = this.createPlanet(system, i);
            system.planets.push(planet.id);
        }

        this.solarSystems.push(system);
        
        // Maybe generate a terrain feature for this system
        this.maybeGenerateTerrainFeature(system);
        
        return system;
    }
    
    /**
     * Generate terrain feature for a system based on chance
     */
    maybeGenerateTerrainFeature(system) {
        // Only one terrain feature per system
        const roll = Math.random();
        let cumulative = 0;
        
        for (const [type, def] of Object.entries(Universe.TERRAIN_TYPES)) {
            cumulative += def.chance;
            if (roll < cumulative) {
                this.createTerrainFeature(system.id, type);
                return;
            }
        }
        // No feature generated (53% chance = remaining probability)
    }
    
    /**
     * Create a terrain feature in a system
     */
    createTerrainFeature(systemId, type) {
        const def = Universe.TERRAIN_TYPES[type];
        if (!def) return null;
        
        const system = this.getSystem(systemId);
        if (!system) return null;
        
        // Random offset from system center for visual placement
        const angle = Math.random() * Math.PI * 2;
        const dist = 10 + Math.random() * 20;  // 10-30 units from center
        
        const feature = {
            id: `terrain_${systemId}_${type}`,
            type,
            systemId,
            name: `${system.name} ${def.name}`,
            x: system.x + Math.cos(angle) * dist,
            y: system.y + Math.sin(angle) * dist,
            effects: { ...def.effects },
            // Visual properties
            size: 15 + Math.random() * 15,  // 15-30 radius
            rotation: Math.random() * Math.PI * 2,
            colorIndex: Math.floor(Math.random() * def.colors.length)
        };
        
        this.terrainFeatures.push(feature);
        return feature;
    }
    
    /**
     * Get terrain feature for a system
     */
    getTerrainFeature(systemId) {
        return this.terrainFeatures.find(f => f.systemId === systemId);
    }
    
    /**
     * Get all terrain features
     */
    getAllTerrainFeatures() {
        return this.terrainFeatures;
    }
    
    /**
     * Get terrain feature effects for a system
     */
    getTerrainEffects(systemId) {
        const feature = this.getTerrainFeature(systemId);
        if (!feature) return null;
        
        const def = Universe.TERRAIN_TYPES[feature.type];
        return {
            type: feature.type,
            name: def.name,
            icon: def.icon,
            ...feature.effects
        };
    }

    createPlanet(system, index) {
        const planetType = this.randomPlanetType();
        // Generate unique seed from system and planet index for consistent terrain
        const seed = this.hashString(`${system.id}_planet_${index}`);
        
        const planet = {
            id: `planet_${system.id}_${index}`,
            name: `${system.name} ${this.romanNumeral(index + 1)}`,
            systemId: system.id,
            orbitRadius: 20 + index * 15,
            orbitAngle: Math.random() * Math.PI * 2,
            size: ['small', 'medium', 'large'][Math.floor(Math.random() * 3)],
            type: planetType,
            resources: this.generatePlanetResources(),
            owner: null,
            population: 0,
            structures: [],
            surfaceSeed: seed,  // Store seed for regeneration
            surface: this.generateSurface(planetType, seed)
        };

        this.planets.push(planet);
        return planet;
    }
    
    // Simple hash function for consistent seeding
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }

    generateSurface(planetType = 'terrestrial', seed = null) {
        // 20x15 tile grid
        const width = 20;
        const height = 15;
        const surface = [];
        
        // Use seed for consistent generation
        const rng = this.seededRandom(seed || Math.random() * 1000000);
        
        // Generate height map using simple noise
        const heightMap = this.generateHeightMap(width, height, rng);
        
        // Planet type modifiers (waterLevel = threshold below which terrain is water)
        // Lower values = less water
        const typeConfig = {
            terrestrial: { waterLevel: 0.18, mountainLevel: 0.78, forestChance: 0.35 },
            ocean: { waterLevel: 0.45, mountainLevel: 0.92, forestChance: 0.2 },
            desert: { waterLevel: 0.05, mountainLevel: 0.55, forestChance: 0.02 },
            ice: { waterLevel: 0.20, mountainLevel: 0.72, forestChance: 0.0 },
            volcanic: { waterLevel: 0.08, mountainLevel: 0.45, forestChance: 0.0 },
            gas_giant: { waterLevel: 0.0, mountainLevel: 1.0, forestChance: 0.0 }
        };
        
        const config = typeConfig[planetType] || typeConfig.terrestrial;
        
        for (let y = 0; y < height; y++) {
            surface[y] = [];
            for (let x = 0; x < width; x++) {
                const h = heightMap[y][x];
                let terrain;
                
                if (h < config.waterLevel) {
                    terrain = 'water';
                } else if (h > config.mountainLevel) {
                    terrain = 'mountain';
                } else if (rng() < config.forestChance) {
                    terrain = 'forest';
                } else {
                    terrain = 'plains';
                }
                
                // Special terrain for planet types
                if (planetType === 'ice' && terrain !== 'water') {
                    terrain = rng() < 0.3 ? 'ice' : terrain;
                }
                if (planetType === 'volcanic' && terrain === 'plains') {
                    terrain = rng() < 0.4 ? 'lava' : terrain;
                }
                if (planetType === 'desert' && terrain === 'plains') {
                    terrain = 'sand';
                }
                
                surface[y][x] = { 
                    type: terrain, 
                    building: null,  // Track building placement
                    buildingId: null 
                };
            }
        }
        
        return surface;
    }
    
    // Simple seeded random number generator
    seededRandom(seed) {
        let s = seed;
        return function() {
            s = (s * 9301 + 49297) % 233280;
            return s / 233280;
        };
    }
    
    // Generate height map using diamond-square-like algorithm
    generateHeightMap(width, height, rng) {
        const map = [];
        
        // Initialize with random values
        for (let y = 0; y < height; y++) {
            map[y] = [];
            for (let x = 0; x < width; x++) {
                map[y][x] = rng();
            }
        }
        
        // Smooth the map multiple times for more natural terrain
        for (let pass = 0; pass < 3; pass++) {
            const newMap = [];
            for (let y = 0; y < height; y++) {
                newMap[y] = [];
                for (let x = 0; x < width; x++) {
                    let sum = 0;
                    let count = 0;
                    
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            const ny = y + dy;
                            const nx = x + dx;
                            if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
                                sum += map[ny][nx];
                                count++;
                            }
                        }
                    }
                    
                    newMap[y][x] = sum / count;
                }
            }
            
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    map[y][x] = newMap[y][x];
                }
            }
        }
        
        return map;
    }

    generatePlanetResources() {
        return {
            minerals: Math.floor(Math.random() * 100) + 20,
            energy: Math.floor(Math.random() * 80) + 10,
            food: Math.floor(Math.random() * 60) + 10,
            rare: Math.floor(Math.random() * 20)
        };
    }

    randomStarType() {
        const types = ['yellow', 'red', 'blue', 'white', 'orange'];
        return types[Math.floor(Math.random() * types.length)];
    }

    randomPlanetType() {
        const types = ['terrestrial', 'gas_giant', 'ice', 'desert', 'ocean', 'volcanic'];
        return types[Math.floor(Math.random() * types.length)];
    }

    generateGalaxyName(index) {
        const prefixes = ['Andromeda', 'Centauri', 'Nebula', 'Orion', 'Pegasus'];
        const suffixes = ['Prime', 'Major', 'Minor', 'Alpha', 'Beta'];
        return `${prefixes[index % prefixes.length]} ${suffixes[Math.floor(Math.random() * suffixes.length)]}`;
    }

    generateSystemName() {
        const consonants = 'BCDFGHJKLMNPQRSTVWXZ';
        const vowels = 'AEIOU';
        let name = '';

        for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
            name += consonants[Math.floor(Math.random() * consonants.length)];
            name += vowels[Math.floor(Math.random() * vowels.length)].toLowerCase();
        }

        return name + '-' + Math.floor(Math.random() * 999);
    }

    romanNumeral(num) {
        const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
        return numerals[num - 1] || num.toString();
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // ORBITAL MECHANICS - Planets orbit their stars over time
    // ═══════════════════════════════════════════════════════════════════════════════
    
    /**
     * Update all planet orbital positions
     * Called once per tick to make planets orbit their stars
     * 
     * Uses Kepler-inspired orbital periods:
     * - Inner planets orbit faster than outer planets
     * - Period proportional to orbital radius (simplified Kepler's 3rd law)
     * 
     * @param {number} tickDeltaSeconds - Time since last tick in seconds (default 1)
     */
    updateOrbits(tickDeltaSeconds = 1) {
        // Base orbital speed constant - tune for visual appeal
        // Lower = slower orbits, Higher = faster orbits
        // At 0.05, innermost planet (~20 radius) completes orbit in ~2 min
        // At 0.05, outer planet (~80 radius) completes orbit in ~10 min
        const ORBITAL_SPEED_CONSTANT = 0.05;
        
        for (const planet of this.planets) {
            // Calculate orbital angular velocity (radians per second)
            // ω = k / sqrt(r³)  (Kepler's 3rd law: T² ∝ r³, so ω ∝ 1/sqrt(r³))
            // For gameplay, we use a simplified: ω = k / r (linear, easier to tune)
            const orbitalVelocity = ORBITAL_SPEED_CONSTANT / Math.max(1, planet.orbitRadius);
            
            // Update orbital angle
            planet.orbitAngle += orbitalVelocity * tickDeltaSeconds;
            
            // Keep angle in [0, 2π] range to avoid floating point issues over time
            if (planet.orbitAngle > Math.PI * 2) {
                planet.orbitAngle -= Math.PI * 2;
            }
        }
    }
    
    /**
     * Get the current absolute position of a planet (accounting for orbital motion)
     * @param {Object} planet - Planet object
     * @returns {{x: number, y: number}} Absolute world position
     */
    getPlanetAbsolutePosition(planet) {
        if (!planet) return { x: 0, y: 0 };
        
        const system = this.getSystem(planet.systemId);
        if (!system) return { x: 0, y: 0 };
        
        // Calculate planet position from system center + orbital position
        return {
            x: system.x + Math.cos(planet.orbitAngle) * planet.orbitRadius,
            y: system.y + Math.sin(planet.orbitAngle) * planet.orbitRadius
        };
    }
    
    /**
     * Calculate the distance between two planets accounting for their orbital positions
     * @param {Object} planet1 - First planet
     * @param {Object} planet2 - Second planet
     * @returns {number} Distance in world units
     */
    getPlanetDistance(planet1, planet2) {
        const pos1 = this.getPlanetAbsolutePosition(planet1);
        const pos2 = this.getPlanetAbsolutePosition(planet2);
        
        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    /**
     * Get orbital info for a planet (for UI display)
     * @param {Object} planet - Planet object
     * @returns {{period: number, speed: number, phase: number}} Orbital data
     */
    getOrbitalInfo(planet) {
        if (!planet) return null;
        
        const ORBITAL_SPEED_CONSTANT = 0.05;
        const angularVelocity = ORBITAL_SPEED_CONSTANT / Math.max(1, planet.orbitRadius);
        const period = (Math.PI * 2) / angularVelocity; // Seconds for full orbit
        
        return {
            period: period,
            periodMinutes: Math.round(period / 60),
            angularVelocity: angularVelocity,
            currentPhase: planet.orbitAngle / (Math.PI * 2), // 0-1 fraction of orbit
            orbitRadius: planet.orbitRadius
        };
    }

    getStartingPlanets(count) {
        // Find habitable planets far apart from each other
        const habitable = this.planets.filter(p =>
            p.type === 'terrestrial' || p.type === 'ocean'
        );

        if (habitable.length < count) {
            // Make some planets habitable
            const needed = count - habitable.length;
            for (let i = 0; i < needed && i < this.planets.length; i++) {
                if (this.planets[i].type !== 'terrestrial') {
                    this.planets[i].type = 'terrestrial';
                    habitable.push(this.planets[i]);
                }
            }
        }

        // Try to spread starting positions across different galaxies/systems
        const selected = [];
        const usedSystems = new Set();

        for (const planet of habitable) {
            if (selected.length >= count) break;
            if (!usedSystems.has(planet.systemId)) {
                selected.push(planet);
                usedSystems.add(planet.systemId);
            }
        }

        // If not enough, just take any remaining
        while (selected.length < count && selected.length < habitable.length) {
            const remaining = habitable.filter(p => !selected.includes(p));
            if (remaining.length > 0) {
                selected.push(remaining[0]);
            } else {
                break;
            }
        }

        return selected;
    }

    getPlanet(planetId) {
        return this.planets.find(p => p.id === planetId);
    }

    getSystem(systemId) {
        return this.solarSystems.find(s => s.id === systemId);
    }

    getGalaxy(galaxyId) {
        return this.galaxies.find(g => g.id === galaxyId);
    }

    getLocation(locationId) {
        return this.getPlanet(locationId) ||
               this.getSystem(locationId) ||
               this.getGalaxy(locationId);
    }

    getPlanetsOwnedBy(empireId) {
        return this.planets.filter(p => p.owner === empireId);
    }

    findPath(fromId, toId) {
        // Simple pathfinding - returns list of waypoints
        const from = this.getLocation(fromId);
        const to = this.getLocation(toId);

        if (!from || !to) return null;

        // For now, direct path (can be enhanced with A* later)
        return [fromId, toId];
    }

    getDistance(fromId, toId) {
        const from = this.getLocation(fromId);
        const to = this.getLocation(toId);

        if (!from || !to) return Infinity;

        // Get positions (need to resolve to absolute coords)
        const fromPos = this.getAbsolutePosition(from);
        const toPos = this.getAbsolutePosition(to);

        return Math.sqrt(
            Math.pow(toPos.x - fromPos.x, 2) +
            Math.pow(toPos.y - fromPos.y, 2)
        );
    }

    getAbsolutePosition(location) {
        if (location.x !== undefined && location.y !== undefined) {
            return { x: location.x, y: location.y };
        }

        // For planets, calculate position based on orbit
        if (location.systemId) {
            const system = this.getSystem(location.systemId);
            return {
                x: system.x + Math.cos(location.orbitAngle) * location.orbitRadius,
                y: system.y + Math.sin(location.orbitAngle) * location.orbitRadius
            };
        }

        return { x: 0, y: 0 };
    }

    getVisibleFor(empireId, entityManager) {
        // Get all locations visible to this empire
        const visiblePlanets = new Set();
        const visibleSystems = new Set();
        const visibleGalaxies = new Set();

        // Own planets are visible
        this.planets.filter(p => p.owner === empireId).forEach(p => {
            visiblePlanets.add(p.id);
            visibleSystems.add(p.systemId);
            const system = this.getSystem(p.systemId);
            if (system) visibleGalaxies.add(system.galaxyId);
        });

        // Locations with own units are visible
        const entities = entityManager.getEntitiesForEmpire(empireId);
        entities.forEach(e => {
            if (e.location) {
                const loc = this.getLocation(e.location);
                if (loc) {
                    visiblePlanets.add(e.location);
                    if (loc.systemId) {
                        visibleSystems.add(loc.systemId);
                        const system = this.getSystem(loc.systemId);
                        if (system) visibleGalaxies.add(system.galaxyId);
                    }
                }
            }
        });

        // Add adjacent systems (sensor range)
        visibleSystems.forEach(sysId => {
            const system = this.getSystem(sysId);
            if (system) {
                // Find nearby systems
                this.solarSystems.forEach(other => {
                    const dist = Math.sqrt(
                        Math.pow(other.x - system.x, 2) +
                        Math.pow(other.y - system.y, 2)
                    );
                    if (dist < 100) { // Sensor range
                        visibleSystems.add(other.id);
                        other.planets.forEach(pId => visiblePlanets.add(pId));
                    }
                });
            }
        });

        return {
            galaxies: this.galaxies.filter(g => visibleGalaxies.has(g.id)),
            systems: this.solarSystems.filter(s => visibleSystems.has(s.id)),
            planets: this.planets.filter(p => visiblePlanets.has(p.id))
        };
    }

    // Light version - excludes planet surfaces for WebSocket bandwidth optimization
    getVisibleForLight(empireId, entityManager) {
        const full = this.getVisibleFor(empireId, entityManager);
        
        // Strip surfaces from planets - they can be fetched on demand via /api/planet/:id/surface
        return {
            galaxies: full.galaxies,
            systems: full.systems,
            planets: full.planets.map(p => ({
                id: p.id,
                name: p.name,
                type: p.type,
                systemId: p.systemId,
                galaxyId: p.galaxyId,
                orbitRadius: p.orbitRadius,
                orbitAngle: p.orbitAngle,
                owner: p.owner,
                population: p.population,
                specialization: p.specialization || null
                // surface intentionally excluded - fetch via /api/planet/:id/surface
            }))
        };
    }

    serialize() {
        return {
            width: this.width,
            height: this.height,
            galaxies: this.galaxies,
            solarSystems: this.solarSystems,
            // Only save modified tiles per planet to reduce save file size
            planets: this.planets.map(p => ({
                ...p,
                // Extract only tiles with buildings (modified tiles)
                surface: undefined,  // Don't save full surface
                modifiedTiles: this.getModifiedTiles(p)
            })),
            wormholes: this.wormholes,
            terrainFeatures: this.terrainFeatures
        };
    }
    
    // Extract tiles that have buildings (for compact saving)
    getModifiedTiles(planet) {
        if (!planet.surface) return [];
        const modified = [];
        for (let y = 0; y < planet.surface.length; y++) {
            for (let x = 0; x < planet.surface[y].length; x++) {
                const tile = planet.surface[y][x];
                if (tile.building || tile.buildingId) {
                    modified.push({ x, y, building: tile.building, buildingId: tile.buildingId });
                }
            }
        }
        return modified;
    }

    // Light serialization - excludes planet surfaces for bandwidth optimization
    serializeLight() {
        return {
            width: this.width,
            height: this.height,
            galaxies: this.galaxies,
            solarSystems: this.solarSystems,
            planets: this.planets.map(p => ({
                id: p.id,
                name: p.name,
                type: p.type,
                systemId: p.systemId,
                galaxyId: p.galaxyId,
                orbitRadius: p.orbitRadius,
                orbitAngle: p.orbitAngle,
                owner: p.owner,
                population: p.population,
                specialization: p.specialization || null  // Include planet specialization
                // surface intentionally excluded - fetch via /api/planet/:id/surface
            })),
            wormholes: this.wormholes,  // Strategic wormhole portals
            terrainFeatures: this.terrainFeatures  // Include terrain features
        };
    }

    // Get surface for a specific planet
    getPlanetSurface(planetId) {
        const planet = this.getPlanet(planetId);
        return planet?.surface || null;
    }

    loadState(saved) {
        if (!saved) return;
        
        this.width = saved.width || 1000;
        this.height = saved.height || 1000;
        this.galaxies = saved.galaxies || [];
        this.solarSystems = saved.solarSystems || [];
        this.wormholes = saved.wormholes || [];
        this.terrainFeatures = saved.terrainFeatures || [];
        
        // Load planets and regenerate surfaces from seeds
        this.planets = (saved.planets || []).map(p => {
            // If planet has full surface, use it (old format)
            if (p.surface && Array.isArray(p.surface) && p.surface.length > 0) {
                // Ensure surfaceSeed exists for future saves
                if (!p.surfaceSeed) {
                    p.surfaceSeed = this.hashString(p.id);
                }
                return p;
            }
            
            // New format: regenerate surface from seed, apply modifications
            const seed = p.surfaceSeed || this.hashString(p.id);
            const surface = this.generateSurface(p.type || 'terrestrial', seed);
            
            // Apply saved building placements
            if (p.modifiedTiles && Array.isArray(p.modifiedTiles)) {
                for (const tile of p.modifiedTiles) {
                    if (surface[tile.y] && surface[tile.y][tile.x]) {
                        surface[tile.y][tile.x].building = tile.building;
                        surface[tile.y][tile.x].buildingId = tile.buildingId;
                    }
                }
            }
            
            return {
                ...p,
                surfaceSeed: seed,
                surface,
                modifiedTiles: undefined  // Clean up after applying
            };
        });
        
        // Generate strategic wormholes if they don't exist (migration for existing saves)
        if (this.wormholes.length === 0 && this.galaxies.length > 0) {
            console.log('   🌀 Generating strategic wormholes for existing universe...');
            this.generateStrategicWormholes();
            console.log(`   🌀 Generated ${this.wormholes.length} strategic wormholes`);
        }
        
        // Generate terrain features if they don't exist (migration for existing saves)
        if (this.terrainFeatures.length === 0 && this.solarSystems.length > 0) {
            console.log('   🌌 Generating terrain features for existing universe...');
            this.solarSystems.forEach(system => {
                this.maybeGenerateTerrainFeature(system);
            });
            console.log(`   🌌 Generated ${this.terrainFeatures.length} terrain features`);
        }
        
        // Migrate old surface format to new format
        let migratedCount = 0;
        this.planets.forEach(planet => {
            if (planet.surface && planet.surface.length > 0) {
                // Check if this is old format (strings) or new format (objects)
                const firstTile = planet.surface[0]?.[0];
                if (typeof firstTile === 'string') {
                    // Migrate to new format
                    planet.surface = planet.surface.map(row => 
                        row.map(tile => {
                            // Map old terrain names to new ones
                            const terrainMap = {
                                'empty': 'water',
                                'grass': 'plains',
                                'dirt': 'mountain',
                                'stone': 'mountain'
                            };
                            return {
                                type: terrainMap[tile] || tile,
                                building: null,
                                buildingId: null
                            };
                        })
                    );
                    migratedCount++;
                }
            } else {
                // No surface - regenerate
                const seed = this.hashString(planet.id);
                planet.surface = this.generateSurface(planet.type, seed);
                migratedCount++;
            }
        });
        
        if (migratedCount > 0) {
            console.log(`   🔄 Migrated ${migratedCount} planet surfaces to new format`);
        }
        
        // Check if galaxies need spiral repositioning
        // New spiral centers at (1200, 1200) - reposition if not there
        if (this.galaxies.length >= 2) {
            const g0 = this.galaxies[0];
            // Check if galaxy 0 is at the expected spiral position
            const expectedAngle = 0 * 137.5 * (Math.PI / 180);
            const expectedRadius = 120 + 140 * Math.sqrt(0);
            const expectedX = 1200 + Math.cos(expectedAngle) * expectedRadius;
            const expectedY = 1200 + Math.sin(expectedAngle) * expectedRadius;
            const needsReposition = Math.abs(g0.x - expectedX) > 50 || Math.abs(g0.y - expectedY) > 50;
            console.log(`   🔍 Galaxy 0 position: (${Math.round(g0.x)}, ${Math.round(g0.y)}), expected: (${Math.round(expectedX)}, ${Math.round(expectedY)})`);
            if (needsReposition) {
                console.log('   🌀 Repositioning galaxies to stretched spiral...');
                this.repositionGalaxiesToSpiral();
            }
        }
        
        console.log(`   📂 Universe: ${this.galaxies.length} galaxies, ${this.solarSystems.length} systems, ${this.planets.length} planets`);
    }
}
