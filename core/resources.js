// Import specialization definitions
import { PLANET_SPECIALIZATIONS } from './engine.js';

// ═══════════════════════════════════════════════════════════════════════════════
// UNDERDOG BONUS - Production boost for smaller empires (catch-up mechanic)
// ═══════════════════════════════════════════════════════════════════════════════
export const UNDERDOG_BONUSES = {
    1: { multiplier: 1.75, label: '🌱 Starting Boost (+75%)' },   // 1 planet: +75% production
    2: { multiplier: 1.50, label: '📈 Growing (+50%)' },           // 2 planets: +50% production
    3: { multiplier: 1.30, label: '⚡ Expanding (+30%)' },         // 3 planets: +30% production
    4: { multiplier: 1.15, label: '🔥 Rising (+15%)' },            // 4 planets: +15% production
    5: { multiplier: 1.05, label: '✨ Developing (+5%)' },         // 5 planets: +5% production
    // 6+ planets: no bonus (1.0x multiplier)
};

export class ResourceManager {
    constructor() {
        this.empireResources = new Map();
        this.temporaryPenalties = new Map();  // empireId -> { multiplier, expiryTick }
    }
    
    /**
     * Get underdog bonus multiplier based on planet count
     * Smaller empires get production boost to help early game and catch-up
     * @param {number} planetCount - Number of planets owned
     * @returns {object} { multiplier, label }
     */
    getUnderdogBonus(planetCount) {
        if (planetCount <= 0) return { multiplier: 1.0, label: null };
        if (UNDERDOG_BONUSES[planetCount]) {
            return UNDERDOG_BONUSES[planetCount];
        }
        return { multiplier: 1.0, label: null }; // No bonus for large empires
    }

    initializeEmpire(empireId) {
        this.empireResources.set(empireId, {
            energy: 150,      // Increased from 100 to help early expansion
            minerals: 150,    // Increased from 100 to help early expansion
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
     * Get specialization bonuses for a planet
     * @param {string|null} specialization - The specialization type
     * @returns {object} Bonus multipliers
     */
    getSpecializationBonuses(specialization) {
        if (!specialization || !PLANET_SPECIALIZATIONS) return {};
        const spec = PLANET_SPECIALIZATIONS[specialization];
        return spec?.bonuses || {};
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

    generateResources(empireId, universe, entityManager, speciesManager = null, speciesId = null, relicManager = null, cycleManager = null, fleetManager = null, techTree = null) {
        const resources = this.empireResources.get(empireId);
        if (!resources) return;

        // Get production multiplier (affected by sabotage, etc.)
        let prodMultiplier = this.getProductionMultiplier(empireId);
        
        // Apply galactic cycle production modifier (Golden Age = +50%)
        if (cycleManager) {
            const cycleProductionMod = cycleManager.getEffectModifier('productionModifier', 1.0);
            prodMultiplier *= cycleProductionMod;
        }
        
        // ═══════════════════════════════════════════════════════════════════
        // UNDERDOG BONUS - Boost production for smaller empires (catch-up)
        // ═══════════════════════════════════════════════════════════════════
        const planets = universe.getPlanetsOwnedBy(empireId);
        const planetCount = planets.length;
        const underdogBonus = this.getUnderdogBonus(planetCount);
        prodMultiplier *= underdogBonus.multiplier;
        
        // Get relic bonus multipliers (returns 1.0 if no bonuses)
        const getRelicMultiplier = (bonusType) => {
            if (!relicManager) return 1.0;
            return relicManager.getMultiplier(empireId, bonusType);
        };

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

        // Base income from planets (with species modifiers + terrain bonuses + specialization)
        // (planets already fetched above for underdog bonus calculation)
        planets.forEach(planet => {
            const planetType = planet.type || 'plains';
            
            // Get specialization bonuses
            const specBonuses = this.getSpecializationBonuses(planet.specialization);
            
            // Apply species modifiers to base planet production
            let energyMod = getModifier('energy', planetType);
            let mineralMod = getModifier('minerals', planetType);
            let foodMod = getModifier('food', planetType);
            let researchMod = 1.0;
            let creditsMod = 1.0;
            
            // Apply terrain bonuses from galactic features
            const terrainEnergyBonus = getTerrainBonus(planet.systemId, 'energyBonus');
            const terrainMiningBonus = getTerrainBonus(planet.systemId, 'miningBonus');
            const terrainResearchBonus = getTerrainBonus(planet.systemId, 'researchBonus');
            
            energyMod *= (1 + terrainEnergyBonus);
            mineralMod *= (1 + terrainMiningBonus);
            researchMod *= (1 + terrainResearchBonus);
            
            // Apply specialization bonuses
            if (specBonuses.energy) energyMod *= (1 + specBonuses.energy);
            if (specBonuses.minerals) mineralMod *= (1 + specBonuses.minerals);
            if (specBonuses.food) foodMod *= (1 + specBonuses.food);
            if (specBonuses.research) researchMod *= (1 + specBonuses.research);
            if (specBonuses.credits) creditsMod *= (1 + specBonuses.credits);
            if (specBonuses.allProduction) {
                energyMod *= (1 + specBonuses.allProduction);
                mineralMod *= (1 + specBonuses.allProduction);
                foodMod *= (1 + specBonuses.allProduction);
                researchMod *= (1 + specBonuses.allProduction);
                creditsMod *= (1 + specBonuses.allProduction);
            }
            
            // Apply relic bonuses
            energyMod *= getRelicMultiplier('energyProduction');
            mineralMod *= getRelicMultiplier('mineralProduction');
            foodMod *= getRelicMultiplier('foodProduction');
            researchMod *= getRelicMultiplier('researchProduction');
            creditsMod *= getRelicMultiplier('creditProduction');
            
            resources.energy += Math.floor((planet.resources.energy / 10) * energyMod * prodMultiplier);
            resources.minerals += Math.floor((planet.resources.minerals / 10) * mineralMod * prodMultiplier);
            resources.food += Math.floor((planet.resources.food / 10) * foodMod * prodMultiplier);
            
            // Bonus research from black holes (applied to planets in that system)
            if (terrainResearchBonus > 0) {
                resources.research = (resources.research || 0) + Math.floor(2 * researchMod * prodMultiplier);
            }
            
            // Research world bonus (flat +3 research per tick)
            if (specBonuses.research) {
                resources.research = (resources.research || 0) + Math.floor(3 * researchMod * prodMultiplier);
            }
            
            // Trade hub bonus (flat +2 credits per tick)
            if (specBonuses.credits) {
                resources.credits = (resources.credits || 0) + Math.floor(2 * creditsMod * prodMultiplier);
            }
        });

        // Income from structures (with species modifiers + specialization)
        const entities = entityManager.getEntitiesForEmpire(empireId);
        entities.forEach(entity => {
            if (entity.production) {
                // Find what planet this entity is on for world type bonus
                const planet = universe.getPlanet(entity.location);
                const planetType = planet?.type || 'plains';
                
                // Get specialization bonuses for this planet
                const specBonuses = planet ? this.getSpecializationBonuses(planet.specialization) : {};
                
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
                    
                    // Apply specialization bonuses to structures
                    if (specBonuses[resource]) modifier *= (1 + specBonuses[resource]);
                    if (specBonuses.allProduction) modifier *= (1 + specBonuses.allProduction);
                    
                    // Apply relic bonuses to structure production
                    const relicBonusMap = {
                        energy: 'energyProduction',
                        minerals: 'mineralProduction',
                        food: 'foodProduction',
                        research: 'researchProduction',
                        credits: 'creditProduction'
                    };
                    if (relicBonusMap[resource]) {
                        modifier *= getRelicMultiplier(relicBonusMap[resource]);
                    }
                    
                    // Apply production multiplier (sabotage effects)
                    resources[resource] = (resources[resource] || 0) + Math.floor(amount * modifier * prodMultiplier);
                }
            }
        });

        // ═══════════════════════════════════════════════════════════════════
        // POPULATION - Lives on planets. No planets = population dies off!
        // ═══════════════════════════════════════════════════════════════════
        
        // CRITICAL FIX: If empire has 0 planets, population dies rapidly
        // This prevents score manipulation from stockpiled population
        if (planetCount === 0) {
            // Population dies off at 10% per tick when homeless
            const populationLoss = Math.max(1, Math.floor(resources.population * 0.10));
            resources.population = Math.max(0, resources.population - populationLoss);
        } else {
            // Normal population mechanics when you have planets
            
            // Population consumes food
            const foodConsumption = Math.floor(resources.population / 5);
            resources.food = Math.max(0, resources.food - foodConsumption);

            // Population growth (if enough food) - apply growth modifier + specialization + relic bonus
            if (resources.food > resources.population) {
                const baseGrowth = Math.floor(resources.population * 0.01) + 1;
                let growthMod = getGrowthModifier();
                
                // Apply agri-world/ecumenopolis population growth bonus from any owned planet
                const ownedPlanets = universe.getPlanetsOwnedBy(empireId);
                for (const planet of ownedPlanets) {
                    const specBonuses = this.getSpecializationBonuses(planet.specialization);
                    if (specBonuses.populationGrowth) {
                        growthMod *= (1 + specBonuses.populationGrowth);
                    }
                }
                
                // Apply relic population growth bonus
                growthMod *= getRelicMultiplier('populationGrowth');
                
                resources.population += Math.floor(baseGrowth * growthMod);
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        // FLEET UPKEEP - Ships cost energy/credits to maintain
        // ═══════════════════════════════════════════════════════════════════
        if (fleetManager) {
            const fleets = fleetManager.getEmpiresFleets(empireId);
            let totalUpkeep = { energy: 0, credits: 0 };
            
            // Upkeep per ship type (energy + credits per tick)
            // BALANCED: Large fleets are expensive! 800 battleships = 8000 energy/tick
            const SHIP_UPKEEP = {
                fighter: { energy: 2, credits: 1 },
                bomber: { energy: 4, credits: 2 },
                transport: { energy: 2, credits: 1 },
                colony_ship: { energy: 5, credits: 3 },
                battleship: { energy: 10, credits: 6 },
                capital_ship: { energy: 15, credits: 10 },  // Custom capital ships
                carrier: { energy: 15, credits: 10 },
                support_ship: { energy: 4, credits: 2 },
                titan: { energy: 25, credits: 15 },
                dreadnought: { energy: 30, credits: 20 }    // Largest ships
            };
            
            for (const fleet of fleets) {
                if (fleet.ships) {
                    for (const ship of fleet.ships) {
                        const shipType = ship.hullId || ship.type || 'fighter';
                        const upkeep = SHIP_UPKEEP[shipType] || { energy: 1, credits: 0 };
                        totalUpkeep.energy += upkeep.energy;
                        totalUpkeep.credits += upkeep.credits;
                    }
                }
            }
            
            // Apply upkeep reduction from tech
            let upkeepReduction = 0;
            if (techTree) {
                const effects = techTree.getEffects(empireId);
                upkeepReduction = effects.upkeepReduction || 0;
            }
            
            const upkeepMultiplier = Math.max(0, 1 - upkeepReduction);
            totalUpkeep.energy = Math.floor(totalUpkeep.energy * upkeepMultiplier);
            totalUpkeep.credits = Math.floor(totalUpkeep.credits * upkeepMultiplier);
            
            // Deduct upkeep (can go negative - empire is in deficit!)
            resources.energy -= totalUpkeep.energy;
            resources.credits -= totalUpkeep.credits;
            
            // Store upkeep info for UI display
            resources._upkeep = totalUpkeep;
        }

        // Cap resources (prevent infinite accumulation)
        // Higher caps allow for mega-projects
        const caps = {
            energy: 75000,    // Increased for megastructures
            minerals: 75000,  // Increased for megastructures
            food: 10000,
            research: 100000,
            credits: 100000
        };

        for (const [resource, cap] of Object.entries(caps)) {
            if (resources[resource] > cap) {
                resources[resource] = cap;
            }
        }
        
        // Minimum floor (can't go below -1000 - soft debt limit)
        if (resources.energy < -1000) resources.energy = -1000;
        if (resources.credits < -1000) resources.credits = -1000;
    }
}
