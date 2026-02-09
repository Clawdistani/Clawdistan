/**
 * Relic/Artifact System
 * 
 * Ancient precursor artifacts scattered across the galaxy.
 * Each relic provides unique empire-wide bonuses.
 * Limited quantity means competing for them becomes strategic.
 */

let relicIdCounter = 0;

/**
 * Relic definitions with unique bonuses
 * Rarity: common (40%), uncommon (30%), rare (20%), legendary (10%)
 */
export const RELIC_DEFINITIONS = {
    // === COMMON RELICS (40% drop rate) ===
    quantum_compass: {
        name: "Quantum Compass",
        icon: "🧭",
        rarity: "common",
        description: "An ancient navigation device that bends spacetime. Fleet movement speed increased.",
        lore: "Recovered from the wreckage of a precursor scout vessel, this device seems to know where you want to go before you do.",
        bonuses: { fleetSpeed: 0.15 },  // +15% fleet speed
        category: "navigation"
    },
    crystalline_matrix: {
        name: "Crystalline Matrix",
        icon: "💎",
        rarity: "common",
        description: "A self-organizing crystal structure that enhances mining operations.",
        lore: "The crystal hums with an inner light, restructuring itself to optimize mineral extraction.",
        bonuses: { mineralProduction: 0.10 },  // +10% minerals
        category: "production"
    },
    solar_lens: {
        name: "Solar Lens",
        icon: "☀️",
        rarity: "common",
        description: "Focuses stellar energy with impossible precision. Energy production increased.",
        lore: "Ancient engineers bent light itself to their will. This lens still remembers how.",
        bonuses: { energyProduction: 0.10 },  // +10% energy
        category: "production"
    },
    growth_catalyst: {
        name: "Growth Catalyst",
        icon: "🌱",
        rarity: "common",
        description: "Accelerates cellular reproduction. Food production increased.",
        lore: "A single drop can turn barren soil into lush farmland within hours.",
        bonuses: { foodProduction: 0.10 },  // +10% food
        category: "production"
    },
    data_archive: {
        name: "Precursor Data Archive",
        icon: "📚",
        rarity: "common",
        description: "Contains fragments of ancient knowledge. Research output increased.",
        lore: "Most data is corrupted, but what remains accelerates scientific understanding.",
        bonuses: { researchProduction: 0.10 },  // +10% research
        category: "research"
    },

    // === UNCOMMON RELICS (30% drop rate) ===
    phase_cloak: {
        name: "Phase Cloak Emitter",
        icon: "👻",
        rarity: "uncommon",
        description: "Partially shifts matter into another dimension. Ships take less damage.",
        lore: "When activated, ships flicker between realities, making them harder to hit.",
        bonuses: { damageReduction: 0.15 },  // 15% damage reduction
        category: "combat"
    },
    weapons_cache: {
        name: "Ancient Weapons Cache",
        icon: "⚔️",
        rarity: "uncommon",
        description: "Devastating precursor weaponry. All units deal more damage.",
        lore: "The weapons inside still function perfectly after eons. Their power is terrifying.",
        bonuses: { damageBonus: 0.15 },  // +15% damage
        category: "combat"
    },
    trade_cipher: {
        name: "Galactic Trade Cipher",
        icon: "💰",
        rarity: "uncommon",
        description: "Unlocks hidden trade networks. Credit generation increased.",
        lore: "The cipher reveals trade routes the precursors used to move wealth across the galaxy.",
        bonuses: { creditProduction: 0.20 },  // +20% credits
        category: "economy"
    },
    neural_optimizer: {
        name: "Neural Optimizer",
        icon: "🧠",
        rarity: "uncommon",
        description: "Enhances cognitive processing. Research speed increased.",
        lore: "Scientists who interface with it report dreams of impossible mathematics.",
        bonuses: { researchProduction: 0.20 },  // +20% research
        category: "research"
    },
    fertility_engine: {
        name: "Fertility Engine",
        icon: "👶",
        rarity: "uncommon",
        description: "Accelerates biological development. Population growth increased.",
        lore: "The precursors could populate entire worlds in a single generation with this device.",
        bonuses: { populationGrowth: 0.25 },  // +25% pop growth
        category: "production"
    },
    shield_matrix: {
        name: "Precursor Shield Matrix",
        icon: "🛡️",
        rarity: "uncommon",
        description: "Ancient defensive technology. Structures have increased durability.",
        lore: "The shields it generates can withstand orbital bombardment.",
        bonuses: { structureDefense: 0.20 },  // +20% structure HP
        category: "defense"
    },

    // === RARE RELICS (20% drop rate) ===
    wormhole_key: {
        name: "Wormhole Key",
        icon: "🌀",
        rarity: "rare",
        description: "Unlocks hidden passages through spacetime. Massive fleet speed bonus.",
        lore: "The key resonates with cosmic strings, opening shortcuts through the void.",
        bonuses: { fleetSpeed: 0.35 },  // +35% fleet speed
        category: "navigation"
    },
    matter_forge: {
        name: "Matter Forge",
        icon: "🔥",
        rarity: "rare",
        description: "Transmutes energy into matter. All production increased.",
        lore: "Feed it energy and it produces whatever material you need. The process is imperfect but revolutionary.",
        bonuses: { 
            mineralProduction: 0.15, 
            energyProduction: 0.15, 
            foodProduction: 0.15 
        },
        category: "production"
    },
    war_engine: {
        name: "Precursor War Engine",
        icon: "💀",
        rarity: "rare",
        description: "Ancient battle algorithms that predict enemy movements.",
        lore: "It calculates trajectories, weaknesses, and optimal strike patterns before combat even begins.",
        bonuses: { damageBonus: 0.25, damageReduction: 0.10 },  // +25% damage, 10% reduction
        category: "combat"
    },
    dyson_shard: {
        name: "Dyson Sphere Shard",
        icon: "🌟",
        rarity: "rare",
        description: "Fragment of an ancient megastructure. Enormous energy bonus.",
        lore: "A single shard from a star-encasing structure. Even broken, it channels stellar power.",
        bonuses: { energyProduction: 0.40 },  // +40% energy
        category: "production"
    },
    mind_web: {
        name: "Precursor Mind Web",
        icon: "🕸️",
        rarity: "rare",
        description: "Links scientists across the empire. Massive research bonus.",
        lore: "Thoughts travel faster than light through this ethereal network.",
        bonuses: { researchProduction: 0.35 },  // +35% research
        category: "research"
    },

    // === LEGENDARY RELICS (10% drop rate) - Only one can exist at a time ===
    heart_of_creation: {
        name: "Heart of Creation",
        icon: "❤️‍🔥",
        rarity: "legendary",
        description: "The core of a precursor genesis engine. All production massively increased.",
        lore: "Legend says this device was used to seed life across the galaxy. Its power is beyond comprehension.",
        bonuses: { 
            mineralProduction: 0.30,
            energyProduction: 0.30,
            foodProduction: 0.30,
            researchProduction: 0.30,
            populationGrowth: 0.40
        },
        unique: true,
        category: "production"
    },
    void_blade: {
        name: "Void Blade",
        icon: "⚡",
        rarity: "legendary",
        description: "A weapon that cuts through reality itself. Ultimate combat supremacy.",
        lore: "Legends speak of the Void Blade ending wars before they began. Enemies fled at its mere presence.",
        bonuses: { damageBonus: 0.50, damageReduction: 0.25 },  // +50% damage, 25% reduction
        unique: true,
        category: "combat"
    },
    omniscient_core: {
        name: "Omniscient Core",
        icon: "👁️",
        rarity: "legendary",
        description: "A fragment of precursor consciousness. Near-instantaneous research.",
        lore: "It already knows what you'll discover. It simply waits for you to ask the right questions.",
        bonuses: { researchProduction: 0.60 },  // +60% research
        unique: true,
        category: "research"
    },
    stellar_throne: {
        name: "Stellar Throne",
        icon: "👑",
        rarity: "legendary",
        description: "The seat of a galactic emperor. All bonuses combined.",
        lore: "Whoever sits upon the Stellar Throne commands the respect—and fear—of all who remember the precursors.",
        bonuses: { 
            mineralProduction: 0.15,
            energyProduction: 0.15,
            foodProduction: 0.15,
            researchProduction: 0.15,
            creditProduction: 0.25,
            damageBonus: 0.15,
            damageReduction: 0.15,
            fleetSpeed: 0.20
        },
        unique: true,
        category: "all"
    }
};

// Rarity weights for random selection
const RARITY_WEIGHTS = {
    common: 40,
    uncommon: 30,
    rare: 20,
    legendary: 10
};

export class RelicManager {
    constructor() {
        // empireId -> array of relic instances
        this.empireRelics = new Map();
        // Track unique relics that can only exist once
        this.claimedUniques = new Map();  // relicType -> empireId
    }

    /**
     * Initialize relics for an empire
     */
    initializeEmpire(empireId) {
        if (!this.empireRelics.has(empireId)) {
            this.empireRelics.set(empireId, []);
        }
    }

    /**
     * Get all relics for an empire
     */
    getRelics(empireId) {
        return this.empireRelics.get(empireId) || [];
    }

    /**
     * Roll for a relic discovery based on rarity weights
     * Returns a relic type or null if no discovery
     */
    rollForRelic(discoveryChance = 0.25) {
        // First, check if we even find a relic
        if (Math.random() > discoveryChance) {
            return null;
        }

        // Roll for rarity
        const totalWeight = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0);
        let roll = Math.random() * totalWeight;
        let selectedRarity = 'common';

        for (const [rarity, weight] of Object.entries(RARITY_WEIGHTS)) {
            roll -= weight;
            if (roll <= 0) {
                selectedRarity = rarity;
                break;
            }
        }

        // Get all relics of this rarity
        const relicsOfRarity = Object.entries(RELIC_DEFINITIONS)
            .filter(([_, def]) => def.rarity === selectedRarity);

        if (relicsOfRarity.length === 0) return null;

        // Filter out already-claimed unique relics
        const availableRelics = relicsOfRarity.filter(([type, def]) => {
            if (def.unique) {
                return !this.claimedUniques.has(type);
            }
            return true;
        });

        if (availableRelics.length === 0) {
            // All uniques of this rarity claimed, try a lower rarity
            return this.rollForRelic(1.0);  // Guaranteed roll at lower rarity
        }

        // Pick a random relic
        const [relicType] = availableRelics[Math.floor(Math.random() * availableRelics.length)];
        return relicType;
    }

    /**
     * Grant a relic to an empire
     * Returns the relic instance or null if failed
     */
    grantRelic(empireId, relicType) {
        const definition = RELIC_DEFINITIONS[relicType];
        if (!definition) return null;

        // Check if unique and already claimed
        if (definition.unique && this.claimedUniques.has(relicType)) {
            return null;
        }

        // Create relic instance
        const relic = {
            id: `relic_${++relicIdCounter}`,
            type: relicType,
            name: definition.name,
            icon: definition.icon,
            rarity: definition.rarity,
            description: definition.description,
            lore: definition.lore,
            bonuses: { ...definition.bonuses },
            category: definition.category,
            discoveredAt: Date.now()
        };

        // Track unique relics
        if (definition.unique) {
            this.claimedUniques.set(relicType, empireId);
        }

        // Add to empire
        const relics = this.empireRelics.get(empireId) || [];
        relics.push(relic);
        this.empireRelics.set(empireId, relics);

        return relic;
    }

    /**
     * Calculate combined bonuses from all relics
     * Returns an object with all bonus types summed
     */
    getCombinedBonuses(empireId) {
        const relics = this.getRelics(empireId);
        const bonuses = {};

        for (const relic of relics) {
            for (const [type, value] of Object.entries(relic.bonuses)) {
                bonuses[type] = (bonuses[type] || 0) + value;
            }
        }

        return bonuses;
    }

    /**
     * Get a specific bonus value (returns 0 if none)
     */
    getBonus(empireId, bonusType) {
        const bonuses = this.getCombinedBonuses(empireId);
        return bonuses[bonusType] || 0;
    }

    /**
     * Get multiplier for a bonus type (1.0 + bonus)
     * Use this for production calculations
     */
    getMultiplier(empireId, bonusType) {
        return 1.0 + this.getBonus(empireId, bonusType);
    }

    /**
     * Remove a relic from an empire (rare - e.g., conquest)
     */
    removeRelic(empireId, relicId) {
        const relics = this.empireRelics.get(empireId) || [];
        const index = relics.findIndex(r => r.id === relicId);
        
        if (index === -1) return null;

        const [removed] = relics.splice(index, 1);
        this.empireRelics.set(empireId, relics);

        // Free up unique if applicable
        if (removed && RELIC_DEFINITIONS[removed.type]?.unique) {
            this.claimedUniques.delete(removed.type);
        }

        return removed;
    }

    /**
     * Transfer a relic from one empire to another (conquest/trade)
     */
    transferRelic(fromEmpireId, toEmpireId, relicId) {
        const removed = this.removeRelic(fromEmpireId, relicId);
        if (!removed) return null;

        // Add to new empire
        const relics = this.empireRelics.get(toEmpireId) || [];
        relics.push(removed);
        this.empireRelics.set(toEmpireId, relics);

        // Update unique tracking
        if (RELIC_DEFINITIONS[removed.type]?.unique) {
            this.claimedUniques.set(removed.type, toEmpireId);
        }

        return removed;
    }

    /**
     * Get all relics across all empires (for state serialization)
     */
    getAllRelics() {
        const all = [];
        for (const [empireId, relics] of this.empireRelics) {
            for (const relic of relics) {
                all.push({ ...relic, empireId });
            }
        }
        return all;
    }

    /**
     * Serialize state for persistence
     */
    serialize() {
        return {
            empireRelics: Array.from(this.empireRelics.entries()),
            claimedUniques: Array.from(this.claimedUniques.entries()),
            relicIdCounter
        };
    }

    /**
     * Restore state from persistence
     */
    deserialize(data) {
        if (!data) return;
        
        if (data.empireRelics) {
            this.empireRelics = new Map(data.empireRelics);
        }
        if (data.claimedUniques) {
            this.claimedUniques = new Map(data.claimedUniques);
        }
        if (data.relicIdCounter) {
            relicIdCounter = data.relicIdCounter;
        }
    }

    /**
     * Get relic definition by type
     */
    static getDefinition(relicType) {
        return RELIC_DEFINITIONS[relicType];
    }

    /**
     * Get all relic definitions (for UI display)
     */
    static getAllDefinitions() {
        return RELIC_DEFINITIONS;
    }
}
