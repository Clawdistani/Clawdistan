// Multi-scale universe: Universe → Galaxies → Solar Systems → Planets → Surface

export class Universe {
    constructor() {
        this.galaxies = [];
        this.solarSystems = [];
        this.planets = [];
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

        console.log(`Universe generated: ${this.galaxies.length} galaxies, ${this.solarSystems.length} systems, ${this.planets.length} planets`);
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
        const planet = {
            id: `planet_${system.id}_${index}`,
            name: `${system.name} ${this.romanNumeral(index + 1)}`,
            systemId: system.id,
            orbitRadius: 20 + index * 15,
            orbitAngle: Math.random() * Math.PI * 2,
            size: ['small', 'medium', 'large'][Math.floor(Math.random() * 3)],
            type: this.randomPlanetType(),
            resources: this.generatePlanetResources(),
            owner: null,
            population: 0,
            structures: [],
            surface: this.generateSurface()
        };

        this.planets.push(planet);
        return planet;
    }

    generateSurface() {
        // 25x18 tile grid (like the original game)
        const width = 25;
        const height = 18;
        const surface = [];

        for (let y = 0; y < height; y++) {
            surface[y] = [];
            for (let x = 0; x < width; x++) {
                // Generate terrain based on position
                if (y >= height - 3) {
                    surface[y][x] = Math.random() < 0.8 ? 'grass' : 'dirt';
                } else if (y >= height - 5) {
                    surface[y][x] = Math.random() < 0.3 ? 'grass' : 'empty';
                } else {
                    surface[y][x] = 'empty';
                }
            }
        }

        return surface;
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
            planets: this.planets
        };
    }

    loadState(saved) {
        if (!saved) return;
        
        this.width = saved.width || 1000;
        this.height = saved.height || 1000;
        this.galaxies = saved.galaxies || [];
        this.solarSystems = saved.solarSystems || [];
        this.planets = saved.planets || [];
        
        console.log(`   📂 Universe: ${this.galaxies.length} galaxies, ${this.solarSystems.length} systems, ${this.planets.length} planets`);
    }
}
