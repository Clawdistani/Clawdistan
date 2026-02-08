export class ResourceManager {
    constructor() {
        this.empireResources = new Map();
        this.temporaryPenalties = new Map();  // empireId -> { multiplier, expiryTick }
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

    /**
     * Apply a temporary production penalty (from espionage sabotage)
     * @param {string} empireId - Empire to penalize
     * @param {number} penaltyPercent - Penalty as decimal (0.25 = 25% reduction)
     * @param {number} durationTicks - How long the penalty lasts
     */
    applyTemporaryPenalty(empireId, penaltyPercent, durationTicks) {
        const currentTick = Date.now(); // We'll use timestamp since we don't track ticks here
        const expiryTime = currentTick + (durationTicks * 1000); // Approximate 1 tick = 1 second
        
        // Stack penalties by taking the worst one
        const existing = this.temporaryPenalties.get(empireId);
        if (existing && existing.expiryTime > currentTick) {
            // Take the worse penalty
            penaltyPercent = Math.max(penaltyPercent, existing.multiplier);
        }
        
        this.temporaryPenalties.set(empireId, {
            multiplier: penaltyPercent,
            expiryTime: expiryTime
        });
    }

    /**
     * Get current production multiplier for an empire (1.0 = normal, 0.75 = 25% penalty)
     */
    getProductionMultiplier(empireId) {
        const penalty = this.temporaryPenalties.get(empireId);
        if (!penalty) return 1.0;
        
        if (Date.now() > penalty.expiryTime) {
            this.temporaryPenalties.delete(empireId);
            return 1.0;
        }
        
        return 1.0 - penalty.multiplier;
    }

    generateResources(empireId, universe, entityManager, speciesManager = null, speciesId = null) {
        const resources = this.empireResources.get(empireId);
        if (!resources) return;

        // Get production multiplier (affected by sabotage, etc.)
        const prodMultiplier = this.getProductionMultiplier(empireId);

        // Get species modifiers (default to 1.0 if no species)
        const getModifier = (resourceType, planetType = null) => {
            if (!speciesManager || !speciesId) return 1.0;
            return speciesManager.getProductionModifier(speciesId, resourceType, planetType);
        };

        const getGrowthModifier = () => {
            if (!speciesManager || !speciesId) return 1.0;
            return speciesManager.getGrowthModifier(speciesId);
        };
        
        // Get terrain bonus for a system (from galactic terrain features)
        const getTerrainBonus = (systemId, bonusType) => {
            if (!universe.getTerrainEffects) return 0;
            const effects = universe.getTerrainEffects(systemId);
            if (!effects) return 0;
            return effects[bonusType] || 0;
        };

        // Base income from planets (with species modifiers + terrain bonuses)
        const planets = universe.getPlanetsOwnedBy(empireId);
        planets.forEach(planet => {
            const planetType = planet.type || 'plains';
            
            // Apply species modifiers to base planet production
            let energyMod = getModifier('energy', planetType);
            let mineralMod = getModifier('minerals', planetType);
            let foodMod = getModifier('food', planetType);
            let researchMod = 1.0;
            
            // Apply terrain bonuses from galactic features
            const terrainEnergyBonus = getTerrainBonus(planet.systemId, 'energyBonus');
            const terrainMiningBonus = getTerrainBonus(planet.systemId, 'miningBonus');
            const terrainResearchBonus = getTerrainBonus(planet.systemId, 'researchBonus');
            
            energyMod *= (1 + terrainEnergyBonus);
            mineralMod *= (1 + terrainMiningBonus);
            researchMod *= (1 + terrainResearchBonus);
            
            resources.energy += Math.floor((planet.resources.energy / 10) * energyMod * prodMultiplier);
            resources.minerals += Math.floor((planet.resources.minerals / 10) * mineralMod * prodMultiplier);
            resources.food += Math.floor((planet.resources.food / 10) * foodMod * prodMultiplier);
            
            // Bonus research from black holes (applied to planets in that system)
            if (terrainResearchBonus > 0) {
                resources.research = (resources.research || 0) + Math.floor(2 * researchMod * prodMultiplier);
            }
        });

        // Income from structures (with species modifiers)
        const entities = entityManager.getEntitiesForEmpire(empireId);
        entities.forEach(entity => {
            if (entity.production) {
                // Find what planet this entity is on for world type bonus
                const planet = universe.getPlanet(entity.location);
                const planetType = planet?.type || 'plains';
                
                // Get terrain bonuses for this planet's system
                const terrainEnergyBonus = planet ? getTerrainBonus(planet.systemId, 'energyBonus') : 0;
                const terrainMiningBonus = planet ? getTerrainBonus(planet.systemId, 'miningBonus') : 0;
                const terrainResearchBonus = planet ? getTerrainBonus(planet.systemId, 'researchBonus') : 0;
                
                for (const [resource, amount] of Object.entries(entity.production)) {
                    let modifier = getModifier(resource, planetType);
                    
                    // Apply terrain bonuses
                    if (resource === 'energy') modifier *= (1 + terrainEnergyBonus);
                    if (resource === 'minerals') modifier *= (1 + terrainMiningBonus);
                    if (resource === 'research') modifier *= (1 + terrainResearchBonus);
                    
                    // Apply production multiplier (sabotage effects)
                    resources[resource] = (resources[resource] || 0) + Math.floor(amount * modifier * prodMultiplier);
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
            research: 50000,  // Increased for longer research times
            credits: 50000
        };

        for (const [resource, cap] of Object.entries(caps)) {
            if (resources[resource] > cap) {
                resources[resource] = cap;
            }
        }
    }
}
