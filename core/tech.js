export class TechTree {
    constructor() {
        this.researched = new Map(); // empireId -> Set of tech IDs
        this.technologies = this.loadTechnologies();
    }

    loadTechnologies() {
        return {
            // Tier 1 - Basic
            improved_mining: {
                id: 'improved_mining',
                name: 'Improved Mining',
                description: 'Increases mineral production by 25%',
                cost: 50,
                tier: 1,
                prerequisites: [],
                effects: { mineralBonus: 0.25 }
            },
            improved_farming: {
                id: 'improved_farming',
                name: 'Improved Farming',
                description: 'Increases food production by 25%',
                cost: 50,
                tier: 1,
                prerequisites: [],
                effects: { foodBonus: 0.25 }
            },
            basic_weapons: {
                id: 'basic_weapons',
                name: 'Basic Weapons',
                description: 'Increases unit attack by 10%',
                cost: 60,
                tier: 1,
                prerequisites: [],
                effects: { attackBonus: 0.10 }
            },
            basic_armor: {
                id: 'basic_armor',
                name: 'Basic Armor',
                description: 'Increases unit HP by 10%',
                cost: 60,
                tier: 1,
                prerequisites: [],
                effects: { hpBonus: 0.10 }
            },

            // Tier 2 - Intermediate
            advanced_mining: {
                id: 'advanced_mining',
                name: 'Advanced Mining',
                description: 'Increases mineral production by 50%',
                cost: 150,
                tier: 2,
                prerequisites: ['improved_mining'],
                effects: { mineralBonus: 0.50 }
            },
            space_travel: {
                id: 'space_travel',
                name: 'Space Travel',
                description: 'Enables building shipyards and space units',
                cost: 200,
                tier: 2,
                prerequisites: [],
                effects: { unlocks: ['shipyard', 'fighter', 'colony_ship'] }
            },
            advanced_weapons: {
                id: 'advanced_weapons',
                name: 'Advanced Weapons',
                description: 'Increases unit attack by 25%',
                cost: 180,
                tier: 2,
                prerequisites: ['basic_weapons'],
                effects: { attackBonus: 0.25 }
            },
            shields: {
                id: 'shields',
                name: 'Shield Technology',
                description: 'Units regenerate 5 HP per tick',
                cost: 200,
                tier: 2,
                prerequisites: ['basic_armor'],
                effects: { hpRegen: 5 }
            },
            disaster_preparedness: {
                id: 'disaster_preparedness',
                name: 'Disaster Preparedness',
                description: 'Advanced early warning systems reduce calamity chance by 60%',
                cost: 180,
                tier: 2,
                prerequisites: [],
                effects: { calamityResistance: 0.6 }
            },
            espionage_training: {
                id: 'espionage_training',
                name: 'Espionage Training',
                description: 'Enables building Intelligence Agencies and training Spies',
                cost: 150,
                tier: 2,
                prerequisites: [],
                effects: { unlocks: ['intelligence_agency', 'spy'] }
            },
            counter_intelligence: {
                id: 'counter_intelligence',
                name: 'Counter-Intelligence',
                description: 'Improves detection of enemy spies by 25%',
                cost: 200,
                tier: 2,
                prerequisites: ['espionage_training'],
                effects: { counterIntelBonus: 0.25 }
            },

            // Tier 3 - Advanced
            warp_drive: {
                id: 'warp_drive',
                name: 'Warp Drive',
                description: 'Doubles space unit speed',
                cost: 400,
                tier: 3,
                prerequisites: ['space_travel'],
                effects: { spaceSpeedBonus: 1.0 }
            },
            battleship_tech: {
                id: 'battleship_tech',
                name: 'Capital Ships',
                description: 'Enables building battleships',
                cost: 500,
                tier: 3,
                prerequisites: ['space_travel', 'advanced_weapons'],
                effects: { unlocks: ['battleship'] }
            },
            terraforming: {
                id: 'terraforming',
                name: 'Terraforming',
                description: 'Can colonize hostile planet types',
                cost: 600,
                tier: 3,
                prerequisites: ['space_travel', 'advanced_mining'],
                effects: { terraforming: true }
            },
            advanced_counter_intel: {
                id: 'advanced_counter_intel',
                name: 'Advanced Counter-Intelligence',
                description: 'Dramatically improves spy detection. Captured spies reveal their mission details.',
                cost: 400,
                tier: 3,
                prerequisites: ['counter_intelligence'],
                effects: { counterIntelBonus: 0.40, revealMissionDetails: true }
            },
            covert_ops: {
                id: 'covert_ops',
                name: 'Covert Operations',
                description: 'Spies have +30% success rate and +20% cover strength',
                cost: 350,
                tier: 3,
                prerequisites: ['espionage_training'],
                effects: { spySuccessBonus: 0.30, coverStrengthBonus: 0.20 }
            },

            // Tier 4 - Elite
            quantum_computing: {
                id: 'quantum_computing',
                name: 'Quantum Computing',
                description: 'Doubles research production',
                cost: 1000,
                tier: 4,
                prerequisites: ['warp_drive'],
                effects: { researchBonus: 1.0 }
            },
            dyson_sphere: {
                id: 'dyson_sphere',
                name: 'Dyson Sphere',
                description: 'Unlimited energy production on one system',
                cost: 2000,
                tier: 4,
                prerequisites: ['quantum_computing', 'advanced_mining'],
                effects: { unlimitedEnergy: true }
            },
            galactic_domination: {
                id: 'galactic_domination',
                name: 'Galactic Domination',
                description: 'Units have +100% attack and HP',
                cost: 3000,
                tier: 4,
                prerequisites: ['battleship_tech', 'shields'],
                effects: { attackBonus: 1.0, hpBonus: 1.0 }
            },

            // Victory tech
            ascension: {
                id: 'ascension',
                name: 'Ascension',
                description: 'Transcend physical form - VICTORY CONDITION',
                cost: 10000,
                tier: 5,
                prerequisites: ['quantum_computing', 'dyson_sphere', 'galactic_domination'],
                effects: { victory: 'technological' }
            }
        };
    }

    getTech(techId) {
        return this.technologies[techId];
    }

    getAllTech() {
        return Object.values(this.technologies);
    }

    getResearched(empireId) {
        const researched = this.researched.get(empireId) || new Set();
        return Array.from(researched).map(id => this.technologies[id]);
    }

    hasResearched(empireId, techId) {
        const researched = this.researched.get(empireId);
        return researched ? researched.has(techId) : false;
    }

    canResearch(empireId, techId) {
        const tech = this.technologies[techId];
        if (!tech) return false;

        // Already researched?
        if (this.hasResearched(empireId, techId)) return false;

        // Check prerequisites
        for (const prereq of tech.prerequisites) {
            if (!this.hasResearched(empireId, prereq)) {
                return false;
            }
        }

        return true;
    }

    complete(empireId, techId) {
        if (!this.researched.has(empireId)) {
            this.researched.set(empireId, new Set());
        }
        this.researched.get(empireId).add(techId);
    }

    getAvailable(empireId) {
        return Object.values(this.technologies).filter(tech =>
            this.canResearch(empireId, tech.id)
        );
    }

    getEffects(empireId) {
        // Combine all effects from researched technologies
        const effects = {
            mineralBonus: 0,
            foodBonus: 0,
            energyBonus: 0,
            researchBonus: 0,
            attackBonus: 0,
            hpBonus: 0,
            hpRegen: 0,
            spaceSpeedBonus: 0,
            unlocks: [],
            terraforming: false,
            unlimitedEnergy: false,
            victory: null
        };

        const researched = this.getResearched(empireId);
        researched.forEach(tech => {
            if (tech.effects) {
                for (const [key, value] of Object.entries(tech.effects)) {
                    if (key === 'unlocks') {
                        effects.unlocks.push(...value);
                    } else if (typeof value === 'boolean') {
                        effects[key] = value;
                    } else if (typeof value === 'number') {
                        effects[key] = (effects[key] || 0) + value;
                    } else {
                        effects[key] = value;
                    }
                }
            }
        });

        return effects;
    }
}
