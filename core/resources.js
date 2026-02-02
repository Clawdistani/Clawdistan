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

    generateResources(empireId, universe, entityManager) {
        const resources = this.empireResources.get(empireId);
        if (!resources) return;

        // Base income from planets
        const planets = universe.getPlanetsOwnedBy(empireId);
        planets.forEach(planet => {
            resources.energy += Math.floor(planet.resources.energy / 10);
            resources.minerals += Math.floor(planet.resources.minerals / 10);
            resources.food += Math.floor(planet.resources.food / 10);
        });

        // Income from structures
        const entities = entityManager.getEntitiesForEmpire(empireId);
        entities.forEach(entity => {
            if (entity.production) {
                for (const [resource, amount] of Object.entries(entity.production)) {
                    resources[resource] = (resources[resource] || 0) + amount;
                }
            }
        });

        // Population consumes food
        const foodConsumption = Math.floor(resources.population / 5);
        resources.food = Math.max(0, resources.food - foodConsumption);

        // Population growth (if enough food)
        if (resources.food > resources.population) {
            resources.population += Math.floor(resources.population * 0.01) + 1;
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
