/**
 * CalamityManager - Random disasters that strike planets
 * Keeps empires on their toes with dynamic challenges
 */

export class CalamityManager {
    constructor() {
        // Calamity types with their effects
        this.calamityTypes = {
            disease: {
                id: 'disease',
                name: 'Plague Outbreak',
                icon: '🦠',
                description: 'A deadly pathogen sweeps across the planet',
                effects: {
                    populationLoss: 0.15,    // Kill 15% of population
                    productionPenalty: 0.20,  // -20% production for 30 ticks
                    structureDamage: 0        // No structure damage
                },
                validPlanets: ['terrestrial', 'ocean'],  // Where it can occur
                baseChance: 0.0002  // Per tick chance (0.02%)
            },
            earthquake: {
                id: 'earthquake',
                name: 'Seismic Event',
                icon: '🌋',
                description: 'Massive tectonic activity devastates the surface',
                effects: {
                    populationLoss: 0.05,
                    productionPenalty: 0.10,
                    structureDamage: 0.25     // Destroy 25% of structures
                },
                validPlanets: ['terrestrial', 'volcanic', 'desert'],
                baseChance: 0.00015
            },
            flood: {
                id: 'flood',
                name: 'Great Flood',
                icon: '🌊',
                description: 'Rising waters engulf low-lying regions',
                effects: {
                    populationLoss: 0.08,
                    productionPenalty: 0.30,  // Major food/energy disruption
                    structureDamage: 0.15,
                    resourceLoss: { food: 0.40 }  // Lose 40% stored food
                },
                validPlanets: ['terrestrial', 'ocean'],
                baseChance: 0.0001
            },
            meteor: {
                id: 'meteor',
                name: 'Meteor Impact',
                icon: '☄️',
                description: 'An asteroid strikes the planet surface',
                effects: {
                    populationLoss: 0.20,
                    productionPenalty: 0.15,
                    structureDamage: 0.35,
                    resourceBonus: { minerals: 50 }  // Meteors bring minerals!
                },
                validPlanets: ['terrestrial', 'desert', 'ice', 'volcanic'],
                baseChance: 0.00005  // Rare but devastating
            },
            volcanic_eruption: {
                id: 'volcanic_eruption',
                name: 'Volcanic Eruption',
                icon: '🔥',
                description: 'Volcanic activity destroys structures but enriches soil',
                effects: {
                    populationLoss: 0.10,
                    productionPenalty: 0.25,
                    structureDamage: 0.40,
                    terraformBonus: true      // Planet becomes more fertile after
                },
                validPlanets: ['volcanic', 'terrestrial'],
                baseChance: 0.00008
            },
            solar_flare: {
                id: 'solar_flare',
                name: 'Solar Flare',
                icon: '☀️',
                description: 'Intense solar radiation disrupts electronics',
                effects: {
                    populationLoss: 0.02,
                    productionPenalty: 0.40,  // Heavy production penalty
                    structureDamage: 0.10,
                    resourceLoss: { energy: 0.50 }  // Lose stored energy
                },
                validPlanets: ['terrestrial', 'desert', 'ocean', 'ice'],
                baseChance: 0.0001
            }
        };

        // Active calamity effects (penalties that decay over time)
        this.activeEffects = new Map();  // planetId -> { type, endTick, penaltyMultiplier }

        // History of calamities for storytelling
        this.calamityHistory = [];
    }

    /**
     * Run calamity check for all owned planets
     * Call this once per tick from engine
     */
    tick(tick, universe, entityManager, resourceManager, techTree) {
        const events = [];

        // Get all owned planets
        const ownedPlanets = universe.planets.filter(p => p.owner);

        for (const planet of ownedPlanets) {
            // Check for new calamity
            const calamity = this.checkForCalamity(planet, techTree);
            
            if (calamity) {
                const result = this.applyCalamity(
                    calamity, 
                    planet, 
                    tick,
                    entityManager, 
                    resourceManager
                );
                events.push(result);
            }
        }

        // Decay active effects
        this.decayEffects(tick);

        return events;
    }

    /**
     * Check if a calamity occurs on this planet
     */
    checkForCalamity(planet, techTree) {
        // Check each calamity type
        for (const [typeId, calamity] of Object.entries(this.calamityTypes)) {
            // Must be valid for this planet type
            if (!calamity.validPlanets.includes(planet.type)) continue;

            // Calculate actual chance
            let chance = calamity.baseChance;

            // Size modifiers - larger planets have more surface area for disasters
            if (planet.size === 'large') chance *= 1.3;
            if (planet.size === 'small') chance *= 0.7;

            // Planet type modifiers
            if (typeId === 'volcanic_eruption' && planet.type === 'volcanic') chance *= 2;
            if (typeId === 'flood' && planet.type === 'ocean') chance *= 1.5;

            // Disaster Preparedness tech reduces chance by 60%
            if (techTree && planet.owner) {
                if (techTree.hasResearched(planet.owner, 'disaster_preparedness')) {
                    chance *= 0.4;
                }
            }

            // Roll the dice
            if (Math.random() < chance) {
                return calamity;
            }
        }

        return null;
    }

    /**
     * Apply calamity effects to a planet
     */
    applyCalamity(calamity, planet, tick, entityManager, resourceManager) {
        const effects = calamity.effects;
        const empireId = planet.owner;
        const result = {
            type: calamity.id,
            name: calamity.name,
            icon: calamity.icon,
            planetId: planet.id,
            planetName: planet.name,
            empireId,
            tick,
            losses: {}
        };

        // Population loss
        if (effects.populationLoss > 0 && planet.population > 0) {
            const lost = Math.floor(planet.population * effects.populationLoss);
            planet.population = Math.max(0, planet.population - lost);
            result.losses.population = lost;
        }

        // Structure damage - destroy random structures
        if (effects.structureDamage > 0) {
            const structures = entityManager.getEntitiesAtLocation(planet.id)
                .filter(e => e.type === 'structure');
            
            const toDestroy = Math.floor(structures.length * effects.structureDamage);
            const destroyed = [];
            
            for (let i = 0; i < toDestroy && structures.length > 0; i++) {
                const idx = Math.floor(Math.random() * structures.length);
                const structure = structures.splice(idx, 1)[0];
                entityManager.removeEntity(structure.id);
                destroyed.push(structure.subtype || structure.structureType);
                
                // Also clear from planet surface grid if present
                if (planet.surface) {
                    for (let y = 0; y < planet.surface.length; y++) {
                        for (let x = 0; x < planet.surface[y].length; x++) {
                            if (planet.surface[y][x].buildingId === structure.id) {
                                planet.surface[y][x].building = null;
                                planet.surface[y][x].buildingId = null;
                            }
                        }
                    }
                }
            }
            
            if (destroyed.length > 0) {
                result.losses.structures = destroyed;
            }
        }

        // Resource loss
        if (effects.resourceLoss && empireId) {
            const currentResources = resourceManager.getResources(empireId);
            for (const [resource, percent] of Object.entries(effects.resourceLoss)) {
                if (currentResources[resource]) {
                    const lost = Math.floor(currentResources[resource] * percent);
                    resourceManager.deduct(empireId, { [resource]: lost });
                    result.losses[resource] = lost;
                }
            }
        }

        // Resource bonus (e.g., meteors bring minerals)
        if (effects.resourceBonus && empireId) {
            for (const [resource, amount] of Object.entries(effects.resourceBonus)) {
                resourceManager.add(empireId, { [resource]: amount });
                result.gains = result.gains || {};
                result.gains[resource] = amount;
            }
        }

        // Apply production penalty (lasts 30 ticks)
        if (effects.productionPenalty > 0) {
            this.activeEffects.set(planet.id, {
                type: calamity.id,
                endTick: tick + 30,
                penaltyMultiplier: 1 - effects.productionPenalty
            });
            result.penaltyDuration = 30;
        }

        // Record in history
        this.calamityHistory.push({
            ...result,
            timestamp: Date.now()
        });

        // Keep history manageable
        if (this.calamityHistory.length > 100) {
            this.calamityHistory = this.calamityHistory.slice(-50);
        }

        return result;
    }

    /**
     * Get production penalty multiplier for a planet
     */
    getProductionMultiplier(planetId) {
        const effect = this.activeEffects.get(planetId);
        if (effect) {
            return effect.penaltyMultiplier;
        }
        return 1.0;  // No penalty
    }

    /**
     * Decay active effects (remove expired ones)
     */
    decayEffects(currentTick) {
        for (const [planetId, effect] of this.activeEffects) {
            if (currentTick >= effect.endTick) {
                this.activeEffects.delete(planetId);
            }
        }
    }

    /**
     * Get active calamity effect on a planet (for UI)
     */
    getActiveEffect(planetId) {
        return this.activeEffects.get(planetId) || null;
    }

    /**
     * Get all active effects (for state serialization)
     */
    getAllActiveEffects() {
        const effects = [];
        for (const [planetId, effect] of this.activeEffects) {
            effects.push({ planetId, ...effect });
        }
        return effects;
    }

    /**
     * Get recent calamity history
     */
    getRecentHistory(count = 10) {
        return this.calamityHistory.slice(-count);
    }

    /**
     * Serialize for persistence
     */
    serialize() {
        return {
            activeEffects: this.getAllActiveEffects(),
            history: this.calamityHistory.slice(-50)
        };
    }

    /**
     * Load from saved state
     */
    loadState(saved) {
        if (!saved) return;

        // Restore active effects
        this.activeEffects.clear();
        if (saved.activeEffects) {
            for (const effect of saved.activeEffects) {
                const { planetId, ...rest } = effect;
                this.activeEffects.set(planetId, rest);
            }
        }

        // Restore history
        if (saved.history) {
            this.calamityHistory = saved.history;
        }
    }
}
