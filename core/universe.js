// Multi-scale universe: Universe → Galaxies → Solar Systems → Planets → Surface

export class Universe {
    constructor() {
        this.galaxies = [];
        this.solarSystems = [];
        this.planets = [];
        this.hyperlanes = [];  // Connections between systems
        this.width = 1000;
        this.height = 1000;
    }

    generate() {
        // Generate galaxies
        const numGalaxies = 3;
        for (let i = 0; i < numGalaxies; i++) {
            const galaxy = this.createGalaxy(i);
            this.galaxies.push(galaxy);
        }

        // Generate hyperlanes within each galaxy
        this.galaxies.forEach(galaxy => {
            this.generateHyperlanes(galaxy);
        });
        
        // Generate inter-galaxy hyperlanes (wormholes)
        this.generateInterGalaxyHyperlanes();

        console.log(`Universe generated: ${this.galaxies.length} galaxies, ${this.solarSystems.length} systems, ${this.planets.length} planets, ${this.hyperlanes.length} hyperlanes`);
    }
    
    /**
     * Generate hyperlane network within a galaxy
     * Uses minimum spanning tree + extra connections for variety
     */
    generateHyperlanes(galaxy) {
        const systems = galaxy.systems.map(id => this.getSystem(id)).filter(s => s);
        if (systems.length < 2) return;
        
        // Calculate distances between all system pairs
        const edges = [];
        for (let i = 0; i < systems.length; i++) {
            for (let j = i + 1; j < systems.length; j++) {
                const dx = systems[j].x - systems[i].x;
                const dy = systems[j].y - systems[i].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                edges.push({
                    from: systems[i].id,
                    to: systems[j].id,
                    distance: dist
                });
            }
        }
        
        // Sort by distance
        edges.sort((a, b) => a.distance - b.distance);
        
        // Build minimum spanning tree using Kruskal's algorithm
        const parent = {};
        systems.forEach(s => parent[s.id] = s.id);
        
        const find = (id) => {
            if (parent[id] !== id) parent[id] = find(parent[id]);
            return parent[id];
        };
        
        const union = (a, b) => {
            parent[find(a)] = find(b);
        };
        
        const mstEdges = [];
        for (const edge of edges) {
            if (find(edge.from) !== find(edge.to)) {
                mstEdges.push(edge);
                union(edge.from, edge.to);
                if (mstEdges.length === systems.length - 1) break;
            }
        }
        
        // Add MST edges as hyperlanes
        mstEdges.forEach(edge => {
            this.hyperlanes.push({
                id: `hyperlane_${edge.from}_${edge.to}`,
                from: edge.from,
                to: edge.to,
                galaxyId: galaxy.id,
                type: 'standard',  // standard, wormhole, gateway
                distance: edge.distance
            });
        });
        
        // Add 1-2 extra connections for strategic variety (not just a tree)
        const extraConnections = Math.min(2, Math.floor(systems.length / 4));
        const existingPairs = new Set(mstEdges.map(e => `${e.from}-${e.to}`));
        
        let added = 0;
        for (const edge of edges) {
            if (added >= extraConnections) break;
            const key1 = `${edge.from}-${edge.to}`;
            const key2 = `${edge.to}-${edge.from}`;
            if (!existingPairs.has(key1) && !existingPairs.has(key2)) {
                // Only add if it's a relatively short connection (< 1.5x average MST edge)
                const avgMstDist = mstEdges.reduce((s, e) => s + e.distance, 0) / mstEdges.length;
                if (edge.distance < avgMstDist * 1.5) {
                    this.hyperlanes.push({
                        id: `hyperlane_${edge.from}_${edge.to}`,
                        from: edge.from,
                        to: edge.to,
                        galaxyId: galaxy.id,
                        type: 'standard',
                        distance: edge.distance
                    });
                    existingPairs.add(key1);
                    added++;
                }
            }
        }
    }
    
    /**
     * Generate wormholes connecting galaxies
     * Each galaxy gets one connection to another galaxy via closest systems
     */
    generateInterGalaxyHyperlanes() {
        if (this.galaxies.length < 2) return;
        
        // Connect galaxies in a chain (0-1, 1-2, 0-2 for 3 galaxies)
        const connections = [];
        for (let i = 0; i < this.galaxies.length; i++) {
            for (let j = i + 1; j < this.galaxies.length; j++) {
                connections.push([i, j]);
            }
        }
        
        for (const [gi, gj] of connections) {
            const g1 = this.galaxies[gi];
            const g2 = this.galaxies[gj];
            
            // Find closest pair of systems between the two galaxies
            let minDist = Infinity;
            let closest = null;
            
            for (const s1Id of g1.systems) {
                const s1 = this.getSystem(s1Id);
                if (!s1) continue;
                
                for (const s2Id of g2.systems) {
                    const s2 = this.getSystem(s2Id);
                    if (!s2) continue;
                    
                    const dx = s2.x - s1.x;
                    const dy = s2.y - s1.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist < minDist) {
                        minDist = dist;
                        closest = { from: s1.id, to: s2.id };
                    }
                }
            }
            
            if (closest) {
                this.hyperlanes.push({
                    id: `wormhole_${closest.from}_${closest.to}`,
                    from: closest.from,
                    to: closest.to,
                    galaxyId: null,  // Inter-galactic
                    type: 'wormhole',
                    distance: minDist
                });
            }
        }
    }
    
    /**
     * Get all hyperlanes for a galaxy (or all if galaxyId is null)
     */
    getHyperlanes(galaxyId = null) {
        if (galaxyId === null) {
            return this.hyperlanes;
        }
        return this.hyperlanes.filter(h => h.galaxyId === galaxyId || h.galaxyId === null);
    }
    
    /**
     * Get hyperlanes connected to a specific system
     */
    getSystemHyperlanes(systemId) {
        return this.hyperlanes.filter(h => h.from === systemId || h.to === systemId);
    }
    
    /**
     * Check if two systems are directly connected by a hyperlane
     */
    areSystemsConnected(systemId1, systemId2) {
        return this.hyperlanes.some(h => 
            (h.from === systemId1 && h.to === systemId2) ||
            (h.from === systemId2 && h.to === systemId1)
        );
    }

    createGalaxy(index) {
        const galaxy = {
            id: `galaxy_${index}`,
            name: this.generateGalaxyName(index),
            x: 200 + (index % 2) * 600,
            y: 200 + Math.floor(index / 2) * 600,
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
        return system;
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

    serialize() {
        return {
            width: this.width,
            height: this.height,
            galaxies: this.galaxies,
            solarSystems: this.solarSystems,
            planets: this.planets,
            hyperlanes: this.hyperlanes
        };
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
                population: p.population
                // surface intentionally excluded - fetch via /api/planet/:id/surface
            })),
            hyperlanes: this.hyperlanes  // Include hyperlane network
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
        this.planets = saved.planets || [];
        this.hyperlanes = saved.hyperlanes || [];
        
        // Generate hyperlanes if they don't exist (migration for existing saves)
        if (this.hyperlanes.length === 0 && this.galaxies.length > 0) {
            console.log('   🛤️ Generating hyperlanes for existing universe...');
            this.galaxies.forEach(galaxy => {
                this.generateHyperlanes(galaxy);
            });
            this.generateInterGalaxyHyperlanes();
            console.log(`   🛤️ Generated ${this.hyperlanes.length} hyperlanes`);
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
        
        console.log(`   📂 Universe: ${this.galaxies.length} galaxies, ${this.solarSystems.length} systems, ${this.planets.length} planets`);
    }
}
