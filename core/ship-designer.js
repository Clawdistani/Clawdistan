/**
 * Ship Designer System
 * Allows players to create custom ship blueprints with hulls + modules
 * 
 * Hull Classes:
 * - Scout (2 slots) - Fast reconnaissance
 * - Corvette (3 slots) - Light combat
 * - Frigate (4 slots) - Balanced warfare
 * - Destroyer (5 slots) - Anti-fighter specialist
 * - Cruiser (6 slots) - Heavy combat
 * - Battlecruiser (7 slots) - Line breaker
 * - Battleship (8 slots) - Capital warfare
 * - Carrier (6 slots) - Fleet support
 * - Dreadnought (10 slots) - Ultimate firepower
 * 
 * Module Types:
 * - Weapons: Lasers, Missiles, Railguns, Plasma, Torpedoes
 * - Defense: Shields, Armor, Point Defense
 * - Propulsion: Engines, Afterburners, Warp Drive
 * - Utility: Cargo, Sensors, Repair, Cloak, Hangar
 */

export const HULL_DEFINITIONS = {
    // ═══════════════════════════════════════════════════════════════════
    // LIGHT HULLS (Tier 1)
    // ═══════════════════════════════════════════════════════════════════
    scout: {
        name: 'Scout',
        tier: 1,
        description: 'Fast, lightly armed reconnaissance vessel',
        baseCost: { minerals: 40, energy: 20 },
        buildTime: 30,  // seconds
        baseStats: {
            hp: 40,
            attack: 5,
            speed: 5,
            range: 1,
            vision: 4,
            evasion: 0.15  // 15% chance to dodge
        },
        slots: {
            weapon: 1,
            defense: 0,
            propulsion: 1,
            utility: 1
        },
        totalSlots: 3,
        icon: '🛩️',
        special: ['fast_travel']  // 25% faster warp
    },
    corvette: {
        name: 'Corvette',
        tier: 1,
        description: 'Light attack craft for patrol and escort duty',
        baseCost: { minerals: 60, energy: 30 },
        buildTime: 45,
        baseStats: {
            hp: 60,
            attack: 15,
            speed: 4,
            range: 2,
            vision: 3,
            evasion: 0.10
        },
        slots: {
            weapon: 2,
            defense: 1,
            propulsion: 1,
            utility: 0
        },
        totalSlots: 4,
        icon: '🚀'
    },
    
    // ═══════════════════════════════════════════════════════════════════
    // MEDIUM HULLS (Tier 2)
    // ═══════════════════════════════════════════════════════════════════
    frigate: {
        name: 'Frigate',
        tier: 2,
        description: 'Versatile warship, backbone of any fleet',
        baseCost: { minerals: 100, energy: 50 },
        buildTime: 60,
        baseStats: {
            hp: 100,
            attack: 25,
            speed: 3,
            range: 2,
            vision: 3,
            evasion: 0.05
        },
        slots: {
            weapon: 2,
            defense: 1,
            propulsion: 1,
            utility: 1
        },
        totalSlots: 5,
        icon: '🚀',
        requiresTech: 'frigate_construction'
    },
    destroyer: {
        name: 'Destroyer',
        tier: 2,
        description: 'Anti-fighter specialist with rapid-fire weapons',
        baseCost: { minerals: 120, energy: 60 },
        buildTime: 75,
        baseStats: {
            hp: 90,
            attack: 35,
            speed: 3,
            range: 2,
            vision: 3,
            evasion: 0.08,
            antiSmall: 1.5  // +50% damage vs scouts/corvettes
        },
        slots: {
            weapon: 3,
            defense: 1,
            propulsion: 1,
            utility: 1
        },
        totalSlots: 6,
        icon: '⚡',
        requiresTech: 'destroyer_construction'
    },
    
    // ═══════════════════════════════════════════════════════════════════
    // HEAVY HULLS (Tier 3)
    // ═══════════════════════════════════════════════════════════════════
    cruiser: {
        name: 'Cruiser',
        tier: 3,
        description: 'Heavy combat vessel with excellent staying power',
        baseCost: { minerals: 200, energy: 100 },
        buildTime: 120,
        baseStats: {
            hp: 180,
            attack: 45,
            speed: 2,
            range: 3,
            vision: 4,
            evasion: 0.03
        },
        slots: {
            weapon: 3,
            defense: 2,
            propulsion: 1,
            utility: 1
        },
        totalSlots: 7,
        icon: '🛳️',
        requiresTech: 'cruiser_construction'
    },
    battlecruiser: {
        name: 'Battlecruiser',
        tier: 3,
        description: 'Fast capital ship that trades armor for speed',
        baseCost: { minerals: 280, energy: 140 },
        buildTime: 150,
        baseStats: {
            hp: 220,
            attack: 60,
            speed: 3,
            range: 3,
            vision: 4,
            evasion: 0.05
        },
        slots: {
            weapon: 4,
            defense: 2,
            propulsion: 2,
            utility: 0
        },
        totalSlots: 8,
        icon: '⚔️',
        requiresTech: 'battlecruiser_construction'
    },
    carrier: {
        name: 'Carrier',
        tier: 3,
        description: 'Fleet support vessel with fighter bays',
        baseCost: { minerals: 300, energy: 150 },
        buildTime: 180,
        baseStats: {
            hp: 250,
            attack: 15,
            speed: 2,
            range: 2,
            vision: 5,
            evasion: 0.02
        },
        slots: {
            weapon: 1,
            defense: 2,
            propulsion: 1,
            utility: 3  // Hangars go in utility
        },
        totalSlots: 7,
        icon: '🛸',
        special: ['fleet_bonus'],  // +10% attack to friendly ships
        requiresTech: 'carrier_technology'
    },
    
    // ═══════════════════════════════════════════════════════════════════
    // CAPITAL HULLS (Tier 4)
    // ═══════════════════════════════════════════════════════════════════
    battleship: {
        name: 'Battleship',
        tier: 4,
        description: 'Massive warship bristling with weapons',
        baseCost: { minerals: 400, energy: 200 },
        buildTime: 240,
        baseStats: {
            hp: 350,
            attack: 80,
            speed: 1,
            range: 4,
            vision: 4,
            evasion: 0.01
        },
        slots: {
            weapon: 4,
            defense: 3,
            propulsion: 1,
            utility: 1
        },
        totalSlots: 9,
        icon: '🔱',
        requiresTech: 'battleship_construction'
    },
    dreadnought: {
        name: 'Dreadnought',
        tier: 4,
        description: 'The ultimate expression of naval power',
        baseCost: { minerals: 800, energy: 400, research: 100 },
        buildTime: 360,
        baseStats: {
            hp: 600,
            attack: 120,
            speed: 1,
            range: 5,
            vision: 5,
            evasion: 0
        },
        slots: {
            weapon: 5,
            defense: 3,
            propulsion: 1,
            utility: 2
        },
        totalSlots: 11,
        icon: '👑',
        special: ['fear_aura'],  // -10% enemy attack in system
        requiresTech: 'titan_construction'
    },
    
    // ═══════════════════════════════════════════════════════════════════
    // SPECIALTY HULLS
    // ═══════════════════════════════════════════════════════════════════
    transport: {
        name: 'Transport',
        tier: 1,
        description: 'Unarmed cargo vessel for moving troops and resources',
        baseCost: { minerals: 80, energy: 30 },
        buildTime: 45,
        baseStats: {
            hp: 100,
            attack: 0,
            speed: 3,
            range: 0,
            vision: 2,
            evasion: 0.05,
            cargoCapacity: 20
        },
        slots: {
            weapon: 0,
            defense: 1,
            propulsion: 1,
            utility: 2
        },
        totalSlots: 4,
        icon: '📦'
    },
    colony_ship: {
        name: 'Colony Ship',
        tier: 2,
        description: 'Specialized vessel for establishing new colonies',
        baseCost: { minerals: 150, food: 50, energy: 50 },
        buildTime: 90,
        baseStats: {
            hp: 80,
            attack: 0,
            speed: 2,
            range: 0,
            vision: 2,
            evasion: 0.03
        },
        slots: {
            weapon: 0,
            defense: 1,
            propulsion: 1,
            utility: 1
        },
        totalSlots: 3,
        icon: '🌍',
        special: ['colonize'],
        requiresTech: 'colonization'
    },
    bomber: {
        name: 'Bomber',
        tier: 2,
        description: 'Heavy strike craft for destroying structures',
        baseCost: { minerals: 150, energy: 60 },
        buildTime: 60,
        baseStats: {
            hp: 70,
            attack: 50,
            speed: 2,
            range: 2,
            vision: 2,
            evasion: 0.05,
            structureDamage: 2.0,  // Double damage vs structures
            planetBombard: 15
        },
        slots: {
            weapon: 2,
            defense: 1,
            propulsion: 1,
            utility: 0
        },
        totalSlots: 4,
        icon: '💣',
        requiresTech: 'bomber_doctrine'
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// MODULE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export const MODULE_DEFINITIONS = {
    // ═══════════════════════════════════════════════════════════════════
    // WEAPON MODULES
    // ═══════════════════════════════════════════════════════════════════
    
    // Tier 1 Weapons
    laser_cannon: {
        name: 'Laser Cannon',
        type: 'weapon',
        tier: 1,
        description: 'Basic energy weapon with consistent damage',
        cost: { minerals: 20, energy: 10 },
        stats: { attack: +10 },
        icon: '🔴'
    },
    missile_rack: {
        name: 'Missile Rack',
        type: 'weapon',
        tier: 1,
        description: 'Guided missiles with high burst damage',
        cost: { minerals: 25, energy: 5 },
        stats: { attack: +12, range: +1 },
        icon: '🚀'
    },
    autocannon: {
        name: 'Autocannon',
        type: 'weapon',
        tier: 1,
        description: 'Rapid-fire kinetic weapon, effective vs small ships',
        cost: { minerals: 15, energy: 5 },
        stats: { attack: +8, antiSmall: +0.25 },
        icon: '💥'
    },
    
    // Tier 2 Weapons
    plasma_cannon: {
        name: 'Plasma Cannon',
        type: 'weapon',
        tier: 2,
        description: 'Superheated plasma deals heavy damage',
        cost: { minerals: 40, energy: 25 },
        stats: { attack: +20 },
        icon: '🟣',
        requiresTech: 'plasma_weapons'
    },
    railgun: {
        name: 'Railgun',
        type: 'weapon',
        tier: 2,
        description: 'Electromagnetically accelerated slug, ignores shields',
        cost: { minerals: 50, energy: 20 },
        stats: { attack: +18, shieldPiercing: 0.5 },
        icon: '⚡',
        requiresTech: 'kinetic_weapons'
    },
    torpedo_launcher: {
        name: 'Torpedo Launcher',
        type: 'weapon',
        tier: 2,
        description: 'Heavy anti-capital torpedoes',
        cost: { minerals: 45, energy: 15 },
        stats: { attack: +25, antiLarge: +0.3 },
        icon: '🎯',
        requiresTech: 'torpedo_technology'
    },
    
    // Tier 3 Weapons
    particle_beam: {
        name: 'Particle Beam',
        type: 'weapon',
        tier: 3,
        description: 'Continuous beam weapon with shield bypass',
        cost: { minerals: 80, energy: 50 },
        stats: { attack: +35, shieldPiercing: 0.75 },
        icon: '⚡',
        requiresTech: 'particle_weapons'
    },
    disruptor_array: {
        name: 'Disruptor Array',
        type: 'weapon',
        tier: 3,
        description: 'Destabilizes enemy systems, reducing their attack',
        cost: { minerals: 70, energy: 60 },
        stats: { attack: +20, enemyAttackReduction: -0.1 },
        icon: '🌀',
        requiresTech: 'disruption_technology'
    },
    nova_cannon: {
        name: 'Nova Cannon',
        type: 'weapon',
        tier: 3,
        description: 'Devastating spinal-mount weapon for capital ships',
        cost: { minerals: 150, energy: 100, research: 20 },
        stats: { attack: +60, range: +2 },
        icon: '☀️',
        requiresTech: 'nova_weapons',
        hullRestriction: ['battleship', 'dreadnought']  // Capital ships only
    },
    
    // ═══════════════════════════════════════════════════════════════════
    // DEFENSE MODULES
    // ═══════════════════════════════════════════════════════════════════
    
    // Tier 1 Defense
    basic_shields: {
        name: 'Basic Shields',
        type: 'defense',
        tier: 1,
        description: 'Energy barrier that absorbs incoming damage',
        cost: { minerals: 15, energy: 15 },
        stats: { hp: +20, shieldRegen: 2 },
        icon: '🛡️'
    },
    armor_plating: {
        name: 'Armor Plating',
        type: 'defense',
        tier: 1,
        description: 'Heavy armor increases hull strength',
        cost: { minerals: 25, energy: 5 },
        stats: { hp: +40, speed: -0.5 },
        icon: '🔩'
    },
    
    // Tier 2 Defense
    advanced_shields: {
        name: 'Advanced Shields',
        type: 'defense',
        tier: 2,
        description: 'Stronger shields with faster regeneration',
        cost: { minerals: 35, energy: 35 },
        stats: { hp: +40, shieldRegen: 5, damageReduction: 0.05 },
        icon: '🛡️',
        requiresTech: 'advanced_shields'
    },
    point_defense: {
        name: 'Point Defense',
        type: 'defense',
        tier: 2,
        description: 'Anti-missile/fighter turrets',
        cost: { minerals: 30, energy: 20 },
        stats: { antiSmall: +0.3, missileDefense: 0.5 },
        icon: '🎯',
        requiresTech: 'point_defense_systems'
    },
    reactive_armor: {
        name: 'Reactive Armor',
        type: 'defense',
        tier: 2,
        description: 'Explosive armor that negates incoming kinetic damage',
        cost: { minerals: 45, energy: 10 },
        stats: { hp: +60, kineticResist: 0.25 },
        icon: '💠',
        requiresTech: 'advanced_materials'
    },
    
    // Tier 3 Defense
    adaptive_shields: {
        name: 'Adaptive Shields',
        type: 'defense',
        tier: 3,
        description: 'Shields that adapt to incoming damage types',
        cost: { minerals: 80, energy: 80 },
        stats: { hp: +80, shieldRegen: 10, damageReduction: 0.15 },
        icon: '🔮',
        requiresTech: 'adaptive_shielding'
    },
    nanite_hull: {
        name: 'Nanite Hull',
        type: 'defense',
        tier: 3,
        description: 'Self-repairing nanomachine-infused hull',
        cost: { minerals: 100, energy: 60, research: 15 },
        stats: { hp: +100, hullRegen: 3 },
        icon: '🤖',
        requiresTech: 'nanomachines'
    },
    
    // ═══════════════════════════════════════════════════════════════════
    // PROPULSION MODULES
    // ═══════════════════════════════════════════════════════════════════
    
    // Tier 1 Propulsion
    ion_thrusters: {
        name: 'Ion Thrusters',
        type: 'propulsion',
        tier: 1,
        description: 'Basic efficient sublight engines',
        cost: { minerals: 15, energy: 10 },
        stats: { speed: +1 },
        icon: '🔵'
    },
    afterburners: {
        name: 'Afterburners',
        type: 'propulsion',
        tier: 1,
        description: 'Emergency speed boost, improves evasion',
        cost: { minerals: 20, energy: 15 },
        stats: { speed: +0.5, evasion: +0.05 },
        icon: '🔥'
    },
    
    // Tier 2 Propulsion
    fusion_drives: {
        name: 'Fusion Drives',
        type: 'propulsion',
        tier: 2,
        description: 'Powerful fusion-powered engines',
        cost: { minerals: 40, energy: 30 },
        stats: { speed: +2 },
        icon: '⚛️',
        requiresTech: 'fusion_propulsion'
    },
    warp_stabilizers: {
        name: 'Warp Stabilizers',
        type: 'propulsion',
        tier: 2,
        description: 'Reduces interstellar travel time',
        cost: { minerals: 50, energy: 40 },
        stats: { warpSpeed: +0.25 },  // 25% faster FTL
        icon: '🌀',
        requiresTech: 'warp_technology'
    },
    
    // Tier 3 Propulsion
    antimatter_engines: {
        name: 'Antimatter Engines',
        type: 'propulsion',
        tier: 3,
        description: 'Ultimate sublight propulsion',
        cost: { minerals: 100, energy: 80, research: 20 },
        stats: { speed: +3, evasion: +0.08 },
        icon: '⚡',
        requiresTech: 'antimatter_power'
    },
    hyperspace_drive: {
        name: 'Hyperspace Drive',
        type: 'propulsion',
        tier: 3,
        description: 'Dramatically reduces warp travel time',
        cost: { minerals: 120, energy: 100, research: 30 },
        stats: { warpSpeed: +0.50 },  // 50% faster FTL
        icon: '🌌',
        requiresTech: 'hyperspace_theory'
    },
    
    // ═══════════════════════════════════════════════════════════════════
    // UTILITY MODULES
    // ═══════════════════════════════════════════════════════════════════
    
    // Tier 1 Utility
    cargo_bay: {
        name: 'Cargo Bay',
        type: 'utility',
        tier: 1,
        description: 'Additional cargo storage',
        cost: { minerals: 20, energy: 5 },
        stats: { cargoCapacity: +10 },
        icon: '📦'
    },
    sensor_array: {
        name: 'Sensor Array',
        type: 'utility',
        tier: 1,
        description: 'Improved detection range',
        cost: { minerals: 15, energy: 15 },
        stats: { vision: +2 },
        icon: '📡'
    },
    
    // Tier 2 Utility
    repair_bay: {
        name: 'Repair Bay',
        type: 'utility',
        tier: 2,
        description: 'Repairs nearby friendly ships',
        cost: { minerals: 40, energy: 30 },
        stats: { repairAura: 5, repairRange: 2 },
        icon: '🔧',
        requiresTech: 'field_repair_systems'
    },
    fighter_hangar: {
        name: 'Fighter Hangar',
        type: 'utility',
        tier: 2,
        description: 'Launches fighter craft in combat',
        cost: { minerals: 60, energy: 40 },
        stats: { hangarCapacity: +2, fleetAttackBonus: +0.05 },
        icon: '🛫',
        requiresTech: 'carrier_technology'
    },
    command_center: {
        name: 'Command Center',
        type: 'utility',
        tier: 2,
        description: 'Fleet coordination for attack bonus',
        cost: { minerals: 50, energy: 50 },
        stats: { fleetAttackBonus: +0.10 },
        icon: '🎖️',
        requiresTech: 'fleet_coordination'
    },
    
    // Tier 3 Utility
    cloaking_device: {
        name: 'Cloaking Device',
        type: 'utility',
        tier: 3,
        description: 'Makes ship invisible to enemy sensors',
        cost: { minerals: 100, energy: 100, research: 25 },
        stats: { cloaked: true, speed: -1 },
        icon: '👻',
        requiresTech: 'cloaking_technology'
    },
    quantum_computer: {
        name: 'Quantum Computer',
        type: 'utility',
        tier: 3,
        description: 'Advanced targeting increases accuracy',
        cost: { minerals: 80, energy: 80, research: 20 },
        stats: { accuracy: +0.20, critChance: +0.10 },
        icon: '🧠',
        requiresTech: 'quantum_computing'
    },
    boarding_pods: {
        name: 'Boarding Pods',
        type: 'utility',
        tier: 3,
        description: 'Capture enemy ships instead of destroying them',
        cost: { minerals: 70, energy: 40 },
        stats: { boardingStrength: 20 },
        icon: '🪖',
        requiresTech: 'boarding_tactics'
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// SHIP DESIGNER CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class ShipDesigner {
    constructor() {
        this.blueprints = new Map();  // empireId -> Map<blueprintId, Blueprint>
        this.blueprintIdCounter = 0;
        this.hulls = HULL_DEFINITIONS;
        this.modules = MODULE_DEFINITIONS;
    }
    
    /**
     * Create a new ship blueprint
     * @param {string} empireId - Empire creating the blueprint
     * @param {string} name - Custom name for the design
     * @param {string} hullType - Hull class (scout, frigate, etc.)
     * @param {Array} modules - Array of module names to install
     * @param {Object} techManager - Tech manager to check requirements
     * @returns {Object} Result with success/error and blueprint
     */
    createBlueprint(empireId, name, hullType, modules = [], techManager = null) {
        const hull = this.hulls[hullType];
        if (!hull) {
            return { success: false, error: `Unknown hull type: ${hullType}` };
        }
        
        // Check hull tech requirements
        if (hull.requiresTech && techManager) {
            if (!techManager.hasResearched(empireId, hull.requiresTech)) {
                return { success: false, error: `Requires technology: ${hull.requiresTech}` };
            }
        }
        
        // Validate modules
        const slotUsage = { weapon: 0, defense: 0, propulsion: 0, utility: 0 };
        const moduleList = [];
        
        for (const moduleName of modules) {
            const mod = this.modules[moduleName];
            if (!mod) {
                return { success: false, error: `Unknown module: ${moduleName}` };
            }
            
            // Check module tech requirements
            if (mod.requiresTech && techManager) {
                if (!techManager.hasResearched(empireId, mod.requiresTech)) {
                    return { success: false, error: `Module ${mod.name} requires technology: ${mod.requiresTech}` };
                }
            }
            
            // Check hull restrictions
            if (mod.hullRestriction && !mod.hullRestriction.includes(hullType)) {
                return { success: false, error: `${mod.name} can only be installed on: ${mod.hullRestriction.join(', ')}` };
            }
            
            // Check slot availability
            if (slotUsage[mod.type] >= hull.slots[mod.type]) {
                return { success: false, error: `No more ${mod.type} slots available (max: ${hull.slots[mod.type]})` };
            }
            
            slotUsage[mod.type]++;
            moduleList.push(moduleName);
        }
        
        // Calculate final stats
        const finalStats = this.calculateStats(hull, moduleList);
        
        // Calculate total cost
        const totalCost = this.calculateCost(hull, moduleList);
        
        // Create blueprint
        const blueprintId = `bp_${++this.blueprintIdCounter}`;
        const blueprint = {
            id: blueprintId,
            empireId,
            name: name || `${hull.name} Mk.${this.blueprintIdCounter}`,
            hullType,
            modules: moduleList,
            stats: finalStats,
            cost: totalCost,
            buildTime: this.calculateBuildTime(hull, moduleList),
            icon: hull.icon,
            tier: hull.tier,
            createdAt: Date.now()
        };
        
        // Store blueprint
        if (!this.blueprints.has(empireId)) {
            this.blueprints.set(empireId, new Map());
        }
        this.blueprints.get(empireId).set(blueprintId, blueprint);
        
        return { success: true, blueprint };
    }
    
    /**
     * Calculate final ship stats from hull + modules
     */
    calculateStats(hull, moduleNames) {
        const stats = { ...hull.baseStats };
        
        for (const moduleName of moduleNames) {
            const mod = this.modules[moduleName];
            if (!mod) continue;
            
            for (const [stat, value] of Object.entries(mod.stats)) {
                if (typeof value === 'number') {
                    stats[stat] = (stats[stat] || 0) + value;
                } else {
                    stats[stat] = value;  // Boolean or object
                }
            }
        }
        
        // Ensure minimums
        stats.hp = Math.max(1, stats.hp);
        stats.speed = Math.max(0.5, stats.speed);
        stats.attack = Math.max(0, stats.attack);
        
        return stats;
    }
    
    /**
     * Calculate total cost of hull + modules
     */
    calculateCost(hull, moduleNames) {
        const cost = { ...hull.baseCost };
        
        for (const moduleName of moduleNames) {
            const mod = this.modules[moduleName];
            if (!mod) continue;
            
            for (const [resource, amount] of Object.entries(mod.cost)) {
                cost[resource] = (cost[resource] || 0) + amount;
            }
        }
        
        return cost;
    }
    
    /**
     * Calculate build time (hull base + 10% per module)
     */
    calculateBuildTime(hull, moduleNames) {
        const baseTime = hull.buildTime || 60;
        const moduleBonus = moduleNames.length * 0.1;  // +10% per module
        return Math.floor(baseTime * (1 + moduleBonus));
    }
    
    /**
     * Get all blueprints for an empire
     */
    getBlueprints(empireId) {
        const empireBlueprints = this.blueprints.get(empireId);
        if (!empireBlueprints) return [];
        return Array.from(empireBlueprints.values());
    }
    
    /**
     * Get a specific blueprint
     */
    getBlueprint(empireId, blueprintId) {
        const empireBlueprints = this.blueprints.get(empireId);
        if (!empireBlueprints) return null;
        return empireBlueprints.get(blueprintId) || null;
    }
    
    /**
     * Delete a blueprint
     */
    deleteBlueprint(empireId, blueprintId) {
        const empireBlueprints = this.blueprints.get(empireId);
        if (!empireBlueprints) return false;
        return empireBlueprints.delete(blueprintId);
    }
    
    /**
     * Get available hulls (filtered by tech)
     */
    getAvailableHulls(empireId, techManager = null) {
        const available = [];
        
        for (const [key, hull] of Object.entries(this.hulls)) {
            const hullInfo = {
                id: key,
                ...hull,
                available: true,
                missingTech: null
            };
            
            if (hull.requiresTech && techManager) {
                if (!techManager.hasResearched(empireId, hull.requiresTech)) {
                    hullInfo.available = false;
                    hullInfo.missingTech = hull.requiresTech;
                }
            }
            
            available.push(hullInfo);
        }
        
        return available;
    }
    
    /**
     * Get available modules (filtered by tech)
     */
    getAvailableModules(empireId, techManager = null) {
        const available = [];
        
        for (const [key, mod] of Object.entries(this.modules)) {
            const modInfo = {
                id: key,
                ...mod,
                available: true,
                missingTech: null
            };
            
            if (mod.requiresTech && techManager) {
                if (!techManager.hasResearched(empireId, mod.requiresTech)) {
                    modInfo.available = false;
                    modInfo.missingTech = mod.requiresTech;
                }
            }
            
            available.push(modInfo);
        }
        
        return available;
    }
    
    /**
     * Create default blueprints for new empires
     */
    createDefaultBlueprints(empireId) {
        // Basic Scout
        this.createBlueprint(
            empireId,
            'Scout',
            'scout',
            ['ion_thrusters', 'sensor_array']
        );
        
        // Basic Fighter
        this.createBlueprint(
            empireId,
            'Fighter',
            'corvette',
            ['laser_cannon', 'laser_cannon', 'basic_shields', 'ion_thrusters']
        );
        
        // Basic Transport
        this.createBlueprint(
            empireId,
            'Transport',
            'transport',
            ['basic_shields', 'ion_thrusters', 'cargo_bay', 'cargo_bay']
        );
    }
    
    /**
     * Serialize for persistence
     */
    serialize() {
        const data = {
            blueprintIdCounter: this.blueprintIdCounter,
            blueprints: {}
        };
        
        for (const [empireId, blueprints] of this.blueprints.entries()) {
            data.blueprints[empireId] = Array.from(blueprints.values());
        }
        
        return data;
    }
    
    /**
     * Load from persistence
     */
    loadState(state) {
        if (!state) return;
        
        this.blueprintIdCounter = state.blueprintIdCounter || 0;
        this.blueprints.clear();
        
        if (state.blueprints) {
            for (const [empireId, blueprints] of Object.entries(state.blueprints)) {
                const empireMap = new Map();
                for (const bp of blueprints) {
                    empireMap.set(bp.id, bp);
                }
                this.blueprints.set(empireId, empireMap);
            }
        }
    }
}
