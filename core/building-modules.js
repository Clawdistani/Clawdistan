/**
 * Building Modules System
 * Allows customization of structures with installable modules
 * Similar to ship designer but for planetary buildings
 */

export class BuildingModuleManager {
    constructor() {
        // entityId -> array of installed module ids
        this.installedModules = new Map();
        
        // Module definitions
        this.modules = this.loadModuleDefinitions();
        
        // Building slot configurations (based on tier)
        this.slotConfig = {
            // Tier 1 buildings: 1 slot
            mine: 1, power_plant: 1, farm: 1, research_lab: 1, barracks: 1, shipyard: 1, fortress: 1, moisture_farm: 1,
            // Tier 2 buildings: 2 slots
            advanced_mine: 2, fusion_reactor: 2, hydroponics_bay: 2, science_complex: 2, military_academy: 2, advanced_shipyard: 2, citadel: 2,
            // Tier 3 buildings: 3 slots
            deep_core_extractor: 3, dyson_collector: 3, orbital_farm: 3, think_tank: 3, war_college: 3, orbital_foundry: 3, planetary_fortress: 3,
            // Megastructures: 4 slots
            dyson_sphere: 4, matter_decompressor: 4, ring_world: 4, strategic_coordination_center: 4, mega_art_installation: 4, science_nexus: 4
        };
    }

    loadModuleDefinitions() {
        return {
            // === PRODUCTION MODULES ===
            efficiency_core: {
                id: 'efficiency_core',
                name: 'Efficiency Core',
                icon: '⚙️',
                category: 'production',
                cost: { minerals: 200, energy: 100 },
                effects: { productionBonus: 0.15 },  // +15% production
                description: '+15% production output',
                validBuildings: ['mine', 'power_plant', 'farm', 'advanced_mine', 'fusion_reactor', 'hydroponics_bay', 'deep_core_extractor', 'dyson_collector', 'orbital_farm']
            },
            overclock_unit: {
                id: 'overclock_unit',
                name: 'Overclock Unit',
                icon: '🔥',
                category: 'production',
                cost: { minerals: 300, energy: 200, research: 50 },
                effects: { productionBonus: 0.30, upkeepIncrease: 0.20 },  // +30% production, +20% upkeep
                description: '+30% production, +20% energy cost',
                validBuildings: ['mine', 'power_plant', 'advanced_mine', 'fusion_reactor', 'deep_core_extractor', 'dyson_collector']
            },
            recycler_system: {
                id: 'recycler_system',
                name: 'Recycler System',
                icon: '♻️',
                category: 'production',
                cost: { minerals: 150, energy: 80 },
                effects: { upkeepReduction: 0.25 },  // -25% upkeep
                description: '-25% maintenance costs',
                validBuildings: ['mine', 'power_plant', 'farm', 'advanced_mine', 'fusion_reactor', 'hydroponics_bay', 'shipyard', 'advanced_shipyard', 'orbital_foundry']
            },

            // === RESEARCH MODULES ===
            data_core: {
                id: 'data_core',
                name: 'Data Core',
                icon: '💾',
                category: 'research',
                cost: { minerals: 250, energy: 150, research: 100 },
                effects: { researchBonus: 0.20 },  // +20% research
                description: '+20% research output',
                validBuildings: ['research_lab', 'science_complex', 'think_tank', 'science_nexus']
            },
            quantum_processor: {
                id: 'quantum_processor',
                name: 'Quantum Processor',
                icon: '🔮',
                category: 'research',
                cost: { minerals: 500, energy: 300, research: 200 },
                effects: { researchBonus: 0.40, breakthroughChance: 0.05 },  // +40% research, 5% breakthrough chance
                description: '+40% research, 5% breakthrough chance',
                validBuildings: ['science_complex', 'think_tank', 'science_nexus']
            },

            // === DEFENSE MODULES ===
            reinforced_walls: {
                id: 'reinforced_walls',
                name: 'Reinforced Walls',
                icon: '🧱',
                category: 'defense',
                cost: { minerals: 300, energy: 50 },
                effects: { hpBonus: 0.50, armorBonus: 0.20 },  // +50% HP, +20% armor
                description: '+50% HP, +20% damage reduction',
                validBuildings: ['fortress', 'citadel', 'planetary_fortress', 'barracks', 'military_academy', 'war_college']
            },
            shield_generator: {
                id: 'shield_generator',
                name: 'Shield Generator',
                icon: '🛡️',
                category: 'defense',
                cost: { minerals: 400, energy: 200, research: 100 },
                effects: { shieldPoints: 200, shieldRegen: 5 },  // 200 shield HP, 5/tick regen
                description: '+200 shields (regenerates)',
                validBuildings: ['fortress', 'citadel', 'planetary_fortress', 'strategic_coordination_center']
            },
            point_defense_turret: {
                id: 'point_defense_turret',
                name: 'Point Defense Turret',
                icon: '🔫',
                category: 'defense',
                cost: { minerals: 250, energy: 100 },
                effects: { attackBonus: 10, antiAir: true },
                description: '+10 attack, anti-orbital capability',
                validBuildings: ['fortress', 'citadel', 'planetary_fortress', 'barracks', 'military_academy', 'war_college']
            },

            // === MILITARY MODULES ===
            training_simulator: {
                id: 'training_simulator',
                name: 'Training Simulator',
                icon: '🎯',
                category: 'military',
                cost: { minerals: 200, energy: 150 },
                effects: { trainingSpeedBonus: 0.25, unitQualityBonus: 0.10 },
                description: '+25% training speed, +10% unit quality',
                validBuildings: ['barracks', 'military_academy', 'war_college', 'shipyard', 'advanced_shipyard', 'orbital_foundry']
            },
            advanced_fabricator: {
                id: 'advanced_fabricator',
                name: 'Advanced Fabricator',
                icon: '🏭',
                category: 'military',
                cost: { minerals: 350, energy: 200, research: 50 },
                effects: { buildSpeedBonus: 0.30, costReduction: 0.10 },
                description: '+30% build speed, -10% unit costs',
                validBuildings: ['shipyard', 'advanced_shipyard', 'orbital_foundry']
            },

            // === SPECIAL MODULES ===
            automated_systems: {
                id: 'automated_systems',
                name: 'Automated Systems',
                icon: '🤖',
                category: 'special',
                cost: { minerals: 400, energy: 250, research: 150 },
                effects: { workerReduction: 0.50, productionBonus: 0.10 },
                description: '-50% workers needed, +10% production',
                validBuildings: ['mine', 'power_plant', 'farm', 'advanced_mine', 'fusion_reactor', 'hydroponics_bay', 'deep_core_extractor', 'dyson_collector', 'orbital_farm']
            },
            diplomatic_suite: {
                id: 'diplomatic_suite',
                name: 'Diplomatic Suite',
                icon: '🤝',
                category: 'special',
                cost: { minerals: 200, energy: 100, credits: 500 },
                effects: { diplomacyBonus: 0.20, tradeBonus: 0.15 },
                description: '+20% diplomacy, +15% trade income',
                validBuildings: ['mega_art_installation', 'ring_world']
            },
            stellar_lens: {
                id: 'stellar_lens',
                name: 'Stellar Lens',
                icon: '🔭',
                category: 'special',
                cost: { minerals: 500, energy: 300, research: 200 },
                effects: { sensorRange: 2, fleetVisibility: true },
                description: '+2 sensor range, reveals enemy fleets',
                validBuildings: ['strategic_coordination_center', 'science_nexus']
            }
        };
    }

    /**
     * Get available slots for a building type
     */
    getSlotCount(buildingType) {
        return this.slotConfig[buildingType] || 1;
    }

    /**
     * Get installed modules for an entity
     */
    getInstalledModules(entityId) {
        return this.installedModules.get(entityId) || [];
    }

    /**
     * Get module definition
     */
    getModule(moduleId) {
        return this.modules[moduleId] || null;
    }

    /**
     * Get all modules valid for a building type
     */
    getValidModules(buildingType) {
        return Object.values(this.modules).filter(m => 
            m.validBuildings.includes(buildingType)
        );
    }

    /**
     * Check if a module can be installed
     */
    canInstallModule(entityId, moduleId, buildingType, currentResources) {
        const module = this.modules[moduleId];
        if (!module) return { success: false, reason: 'Module not found' };

        // Check if valid for building type
        if (!module.validBuildings.includes(buildingType)) {
            return { success: false, reason: 'Module not compatible with this building' };
        }

        // Check slot availability
        const installed = this.getInstalledModules(entityId);
        const maxSlots = this.getSlotCount(buildingType);
        if (installed.length >= maxSlots) {
            return { success: false, reason: `No slots available (${installed.length}/${maxSlots})` };
        }

        // Check if already installed
        if (installed.includes(moduleId)) {
            return { success: false, reason: 'Module already installed' };
        }

        // Check resources
        for (const [resource, cost] of Object.entries(module.cost)) {
            if ((currentResources[resource] || 0) < cost) {
                return { success: false, reason: `Not enough ${resource} (need ${cost})` };
            }
        }

        return { success: true };
    }

    /**
     * Install a module on a building
     */
    installModule(entityId, moduleId, buildingType, resources) {
        const check = this.canInstallModule(entityId, moduleId, buildingType, resources);
        if (!check.success) return check;

        const module = this.modules[moduleId];

        // Deduct resources
        for (const [resource, cost] of Object.entries(module.cost)) {
            resources[resource] -= cost;
        }

        // Install module
        if (!this.installedModules.has(entityId)) {
            this.installedModules.set(entityId, []);
        }
        this.installedModules.get(entityId).push(moduleId);

        return { success: true, module };
    }

    /**
     * Remove a module from a building (refunds 50%)
     */
    removeModule(entityId, moduleId, resources) {
        const installed = this.installedModules.get(entityId);
        if (!installed || !installed.includes(moduleId)) {
            return { success: false, reason: 'Module not installed' };
        }

        const module = this.modules[moduleId];

        // Refund 50% of resources
        for (const [resource, cost] of Object.entries(module.cost)) {
            resources[resource] = (resources[resource] || 0) + Math.floor(cost * 0.5);
        }

        // Remove module
        const index = installed.indexOf(moduleId);
        installed.splice(index, 1);

        return { success: true, refunded: true };
    }

    /**
     * Calculate combined effects of all modules on a building
     */
    getEffects(entityId) {
        const installed = this.getInstalledModules(entityId);
        const effects = {
            productionBonus: 0,
            researchBonus: 0,
            upkeepReduction: 0,
            upkeepIncrease: 0,
            hpBonus: 0,
            armorBonus: 0,
            shieldPoints: 0,
            shieldRegen: 0,
            attackBonus: 0,
            trainingSpeedBonus: 0,
            unitQualityBonus: 0,
            buildSpeedBonus: 0,
            costReduction: 0,
            workerReduction: 0,
            diplomacyBonus: 0,
            tradeBonus: 0,
            sensorRange: 0,
            breakthroughChance: 0,
            antiAir: false,
            fleetVisibility: false
        };

        for (const moduleId of installed) {
            const module = this.modules[moduleId];
            if (!module) continue;

            for (const [key, value] of Object.entries(module.effects)) {
                if (typeof value === 'boolean') {
                    effects[key] = effects[key] || value;
                } else {
                    effects[key] = (effects[key] || 0) + value;
                }
            }
        }

        return effects;
    }

    /**
     * Serialize for persistence
     */
    serialize() {
        const data = {};
        for (const [entityId, modules] of this.installedModules) {
            data[entityId] = modules;
        }
        return data;
    }

    /**
     * Deserialize from persistence
     */
    deserialize(data) {
        this.installedModules.clear();
        if (data) {
            for (const [entityId, modules] of Object.entries(data)) {
                this.installedModules.set(entityId, modules);
            }
        }
    }

    /**
     * Clean up modules for deleted entities
     */
    cleanupEntity(entityId) {
        this.installedModules.delete(entityId);
    }
}
