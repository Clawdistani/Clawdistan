/**
 * Starbase Management System
 * Starbases are built at the system level to claim territory and defend space
 * 
 * Tiers:
 * - Outpost: Claims the system, minimal defense
 * - Starbase: Medium defense, can build ships faster
 * - Citadel: Major fortification, trade hub bonus
 */

export class StarbaseManager {
    constructor(universe) {
        this.universe = universe;
        this.starbases = new Map(); // systemId -> Starbase
        this.starbaseIdCounter = 0;
    }

    /**
     * Starbase tier definitions
     */
    static TIERS = {
        outpost: {
            name: 'Outpost',
            tier: 1,
            hp: 200,
            maxHp: 200,
            attack: 10,
            range: 50,  // Fires at enemies in system
            buildCost: { minerals: 100, energy: 50 },
            moduleSlots: 1,
            icon: '🛰️',
            buildTime: 120,  // 2 minutes
            description: 'Claims the system. Minimal defense.'
        },
        starbase: {
            name: 'Starbase',
            tier: 2,
            hp: 500,
            maxHp: 500,
            attack: 30,
            range: 75,
            upgradeCost: { minerals: 300, energy: 150 },
            moduleSlots: 3,
            icon: '🛸',
            upgradeTime: 300,  // 5 minutes
            shipBuildBonus: 0.25,  // 25% faster ship building
            description: 'Medium defense. Ship production bonus.'
        },
        citadel: {
            name: 'Citadel',
            tier: 3,
            hp: 1000,
            maxHp: 1000,
            attack: 60,
            range: 100,
            upgradeCost: { minerals: 600, energy: 300, research: 100 },
            moduleSlots: 6,
            icon: '🏰',
            upgradeTime: 600,  // 10 minutes
            shipBuildBonus: 0.5,  // 50% faster ship building
            tradeBonus: 0.2,  // 20% trade bonus
            description: 'Major fortification. Trade and production hub.'
        }
    };

    /**
     * Module definitions (can be added to starbases)
     */
    static MODULES = {
        gun_battery: {
            name: 'Gun Battery',
            cost: { minerals: 50, energy: 25 },
            attackBonus: 15,
            description: 'Adds firepower to the starbase'
        },
        shield_generator: {
            name: 'Shield Generator',
            cost: { minerals: 75, energy: 50 },
            hpBonus: 200,
            description: 'Reinforced shields'
        },
        shipyard: {
            name: 'Shipyard Module',
            cost: { minerals: 150, energy: 75 },
            canBuildShips: true,
            description: 'Allows building ships directly at starbase'
        },
        trading_hub: {
            name: 'Trading Hub',
            cost: { minerals: 100, energy: 100 },
            incomeBonus: { energy: 5, minerals: 3 },
            description: 'Generates passive income'
        },
        hangar_bay: {
            name: 'Hangar Bay',
            cost: { minerals: 80, energy: 40 },
            fleetCapBonus: 5,
            description: 'Increases fleet capacity in system'
        },
        sensor_array: {
            name: 'Sensor Array',
            cost: { minerals: 60, energy: 80 },
            visionBonus: 2,  // Systems away
            description: 'Extended sensor range'
        }
    };

    /**
     * Check if a starbase can be built in a system
     */
    canBuildStarbase(empireId, systemId) {
        const system = this.universe.getSystem(systemId);
        if (!system) {
            return { allowed: false, error: 'System not found' };
        }

        // Check if system already has a starbase
        if (this.starbases.has(systemId)) {
            const existing = this.starbases.get(systemId);
            if (existing.owner === empireId) {
                return { allowed: false, error: 'You already have a starbase here' };
            } else {
                return { allowed: false, error: 'System is controlled by another empire' };
            }
        }

        // Check if empire has presence in system (owns a planet or has units there)
        const planetsInSystem = this.universe.planets.filter(p => p.systemId === systemId);
        const hasPresence = planetsInSystem.some(p => p.owner === empireId);

        if (!hasPresence) {
            return { allowed: false, error: 'You need to own a planet in this system first' };
        }

        return { allowed: true };
    }

    /**
     * Build a new outpost in a system
     */
    buildStarbase(empireId, systemId, currentTick) {
        const canBuild = this.canBuildStarbase(empireId, systemId);
        if (!canBuild.allowed) {
            return { success: false, error: canBuild.error };
        }

        const tier = StarbaseManager.TIERS.outpost;
        const system = this.universe.getSystem(systemId);

        const starbase = {
            id: `starbase_${++this.starbaseIdCounter}`,
            systemId,
            owner: empireId,
            tierName: 'outpost',
            tier: tier.tier,
            name: `${system.name} Outpost`,
            hp: tier.hp,
            maxHp: tier.maxHp,
            attack: tier.attack,
            range: tier.range,
            modules: [],
            moduleSlots: tier.moduleSlots,
            constructing: false,
            constructionComplete: currentTick + tier.buildTime,
            upgrading: false,
            upgradeComplete: null,
            createdAt: currentTick
        };

        this.starbases.set(systemId, starbase);

        return {
            success: true,
            starbase,
            cost: tier.buildCost,
            completionTick: starbase.constructionComplete,
            message: `Building ${tier.name} at ${system.name}. ETA: ${Math.ceil(tier.buildTime / 60)} minutes.`
        };
    }

    /**
     * Upgrade a starbase to the next tier
     */
    upgradeStarbase(empireId, systemId, currentTick) {
        const starbase = this.starbases.get(systemId);
        if (!starbase) {
            return { success: false, error: 'No starbase in this system' };
        }

        if (starbase.owner !== empireId) {
            return { success: false, error: 'You do not own this starbase' };
        }

        if (starbase.constructing) {
            return { success: false, error: 'Starbase is still under construction' };
        }

        if (starbase.upgrading) {
            return { success: false, error: 'Starbase is already upgrading' };
        }

        // Determine next tier
        let nextTierName;
        if (starbase.tierName === 'outpost') {
            nextTierName = 'starbase';
        } else if (starbase.tierName === 'starbase') {
            nextTierName = 'citadel';
        } else {
            return { success: false, error: 'Starbase is already at maximum tier' };
        }

        const nextTier = StarbaseManager.TIERS[nextTierName];
        const system = this.universe.getSystem(systemId);

        starbase.upgrading = true;
        starbase.upgradeTarget = nextTierName;
        starbase.upgradeComplete = currentTick + nextTier.upgradeTime;

        return {
            success: true,
            cost: nextTier.upgradeCost,
            currentTier: starbase.tierName,
            nextTier: nextTierName,
            completionTick: starbase.upgradeComplete,
            message: `Upgrading to ${nextTier.name}. ETA: ${Math.ceil(nextTier.upgradeTime / 60)} minutes.`
        };
    }

    /**
     * Complete construction/upgrade when timer expires
     */
    tick(currentTick) {
        const completed = [];

        for (const [systemId, starbase] of this.starbases) {
            // Check construction completion
            if (starbase.constructing !== false && currentTick >= starbase.constructionComplete) {
                starbase.constructing = false;
                completed.push({
                    type: 'constructed',
                    starbase,
                    systemId,
                    message: `${starbase.name} construction complete!`
                });
            }

            // Check upgrade completion
            if (starbase.upgrading && currentTick >= starbase.upgradeComplete) {
                const newTier = StarbaseManager.TIERS[starbase.upgradeTarget];
                const system = this.universe.getSystem(systemId);

                starbase.tierName = starbase.upgradeTarget;
                starbase.tier = newTier.tier;
                starbase.name = `${system.name} ${newTier.name}`;
                starbase.hp = newTier.hp;
                starbase.maxHp = newTier.maxHp;
                starbase.attack = newTier.attack;
                starbase.range = newTier.range;
                starbase.moduleSlots = newTier.moduleSlots;
                starbase.upgrading = false;
                starbase.upgradeTarget = null;
                starbase.upgradeComplete = null;

                completed.push({
                    type: 'upgraded',
                    starbase,
                    systemId,
                    message: `${starbase.name} upgrade complete!`
                });
            }
        }

        return completed;
    }

    /**
     * Add a module to a starbase
     */
    addModule(empireId, systemId, moduleType) {
        const starbase = this.starbases.get(systemId);
        if (!starbase) {
            return { success: false, error: 'No starbase in this system' };
        }

        if (starbase.owner !== empireId) {
            return { success: false, error: 'You do not own this starbase' };
        }

        if (starbase.constructing !== false) {
            return { success: false, error: 'Starbase is still under construction' };
        }

        const moduleDef = StarbaseManager.MODULES[moduleType];
        if (!moduleDef) {
            return { success: false, error: 'Unknown module type' };
        }

        if (starbase.modules.length >= starbase.moduleSlots) {
            return { success: false, error: `No module slots available (${starbase.modules.length}/${starbase.moduleSlots})` };
        }

        // Check if module already installed
        if (starbase.modules.includes(moduleType)) {
            return { success: false, error: 'Module already installed' };
        }

        starbase.modules.push(moduleType);

        // Apply module bonuses
        if (moduleDef.attackBonus) starbase.attack += moduleDef.attackBonus;
        if (moduleDef.hpBonus) {
            starbase.maxHp += moduleDef.hpBonus;
            starbase.hp += moduleDef.hpBonus;
        }

        return {
            success: true,
            cost: moduleDef.cost,
            module: moduleDef,
            message: `${moduleDef.name} installed on ${starbase.name}`
        };
    }

    /**
     * Get starbase for a system
     */
    getStarbase(systemId) {
        return this.starbases.get(systemId) || null;
    }

    /**
     * Get all starbases for an empire
     */
    getEmpireStarbases(empireId) {
        const result = [];
        for (const starbase of this.starbases.values()) {
            if (starbase.owner === empireId) {
                result.push(starbase);
            }
        }
        return result;
    }

    /**
     * Get all starbases (for game state)
     */
    getAllStarbases() {
        return Array.from(this.starbases.values());
    }

    /**
     * Check if an empire controls a system (has starbase)
     */
    controlsSystem(empireId, systemId) {
        const starbase = this.starbases.get(systemId);
        return starbase && starbase.owner === empireId && starbase.constructing === false;
    }

    /**
     * Damage a starbase (from combat)
     */
    damageStarbase(systemId, damage) {
        const starbase = this.starbases.get(systemId);
        if (!starbase) return null;

        starbase.hp -= damage;

        if (starbase.hp <= 0) {
            // Starbase destroyed
            this.starbases.delete(systemId);
            return { destroyed: true, starbase };
        }

        return { destroyed: false, starbase, remainingHp: starbase.hp };
    }

    /**
     * Repair a starbase
     */
    repairStarbase(empireId, systemId, amount) {
        const starbase = this.starbases.get(systemId);
        if (!starbase || starbase.owner !== empireId) {
            return { success: false, error: 'Starbase not found or not owned' };
        }

        const repairAmount = Math.min(amount, starbase.maxHp - starbase.hp);
        starbase.hp += repairAmount;

        return {
            success: true,
            repaired: repairAmount,
            currentHp: starbase.hp,
            maxHp: starbase.maxHp
        };
    }

    /**
     * Get combat power of a starbase for defense calculations
     */
    getCombatPower(systemId) {
        const starbase = this.starbases.get(systemId);
        if (!starbase || starbase.constructing !== false) return 0;

        return {
            attack: starbase.attack,
            hp: starbase.hp,
            maxHp: starbase.maxHp,
            range: starbase.range
        };
    }

    /**
     * Serialize for persistence
     */
    serialize() {
        return {
            starbaseIdCounter: this.starbaseIdCounter,
            starbases: Array.from(this.starbases.entries())
        };
    }

    /**
     * Load from persistence
     */
    loadState(state) {
        if (!state) return;
        
        this.starbaseIdCounter = state.starbaseIdCounter || 0;
        this.starbases.clear();
        
        if (state.starbases) {
            for (const [systemId, starbase] of state.starbases) {
                this.starbases.set(systemId, starbase);
            }
        }
        
        console.log(`   📂 Starbases: ${this.starbases.size} loaded`);
    }
}
