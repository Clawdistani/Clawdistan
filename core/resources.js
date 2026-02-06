export class ResourceManager {
    constructor() {
        this.empireResources = new Map();
    }

    initializeEmpire(empireId) {
        this.empireResources.set(empireId, {
            energy: 100,
            minerals: 100,
            food: 100,
            research: 50,
            credits: 200,
            population: 10
        });
    }

    getResources(empireId) {
        return this.empireResources.get(empireId) || {};
    }

    setResources(empireId, resources) {
        this.empireResources.set(empireId, { ...resources });
    }

    canAfford(empireId, cost) {
        const resources = this.getResources(empireId);
        for (const [resource, amount] of Object.entries(cost)) {
            if ((resources[resource] || 0) < amount) {
                return false;
            }
        }
        return true;
    }

    deduct(empireId, cost) {
        const resources = this.empireResources.get(empireId);
        if (!resources) return;

        for (const [resource, amount] of Object.entries(cost)) {
            resources[resource] = (resources[resource] || 0) - amount;
        }
    }

    add(empireId, income) {
        const resources = this.empireResources.get(empireId);
        if (!resources) return;

        for (const [resource, amount] of Object.entries(income)) {
            resources[resource] = (resources[resource] || 0) + amount;
        }
    }

    generateResources(empireId, universe, entityManager, speciesManager = null, speciesId = null) {
        const resources = this.empireResources.get(empireId);
        if (!resources) return;

        // Get species modifiers (default to 1.0 if no species)
        const getModifier = (resourceType, planetType = null) => {
            if (!speciesManager || !speciesId) return 1.0;
            return speciesManager.getProductionModifier(speciesId, resourceType, planetType);
        };

        const getGrowthModifier = () => {
            if (!speciesManager || !speciesId) return 1.0;
            return speciesManager.getGrowthModifier(speciesId);
        };

        // Base income from planets (with species modifiers)
        const planets = universe.getPlanetsOwnedBy(empireId);
        planets.forEach(planet => {
            const planetType = planet.type || 'plains';
            
            // Apply species modifiers to base planet production
            const energyMod = getModifier('energy', planetType);
            const mineralMod = getModifier('minerals', planetType);
            const foodMod = getModifier('food', planetType);
            
            resources.energy += Math.floor((planet.resources.energy / 10) * energyMod);
            resources.minerals += Math.floor((planet.resources.minerals / 10) * mineralMod);
            resources.food += Math.floor((planet.resources.food / 10) * foodMod);
        });

        // Income from structures (with species modifiers)
        const entities = entityManager.getEntitiesForEmpire(empireId);
        entities.forEach(entity => {
            if (entity.production) {
                // Find what planet this entity is on for world type bonus
                const planet = universe.getPlanet(entity.planetId);
                const planetType = planet?.type || 'plains';
                
                for (const [resource, amount] of Object.entries(entity.production)) {
                    const modifier = getModifier(resource, planetType);
                    resources[resource] = (resources[resource] || 0) + Math.floor(amount * modifier);
                }
            }
        });

        // Population consumes food
        const foodConsumption = Math.floor(resources.population / 5);
        resources.food = Math.max(0, resources.food - foodConsumption);

        // Population growth (if enough food) - apply growth modifier
        if (resources.food > resources.population) {
            const baseGrowth = Math.floor(resources.population * 0.01) + 1;
            const growthMod = getGrowthModifier();
            resources.population += Math.floor(baseGrowth * growthMod);
        }

        // Cap resources (prevent infinite accumulation)
        const caps = {
            energy: 10000,
            minerals: 10000,
            food: 5000,
            research: 5000,
            credits: 50000
        };

        for (const [resource, cap] of Object.entries(caps)) {
            if (resources[resource] > cap) {
                resources[resource] = cap;
            }
        }
    }
}
