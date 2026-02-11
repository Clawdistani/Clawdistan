export class TechTree {
    constructor() {
        this.researched = new Map(); // empireId -> Set of tech IDs
        this.technologies = this.loadTechnologies();
    }

    loadTechnologies() {
        // Tech costs balanced for ~1 research/tick (720/hour per lab)
        // Tier 1: ~1 hour, Tier 2: ~2-4 hours, Tier 3: ~5-8 hours, Tier 4: ~12-24 hours
        return {
            // Tier 1 - Basic (~1 hour each)
            improved_mining: {
                id: 'improved_mining',
                name: 'Improved Mining',
                description: 'Increases mineral production by 25%',
                cost: 700,
                tier: 1,
                prerequisites: [],
                effects: { mineralBonus: 0.25 }
            },
            improved_farming: {
                id: 'improved_farming',
                name: 'Improved Farming',
                description: 'Increases food production by 25%',
                cost: 700,
                tier: 1,
                prerequisites: [],
                effects: { foodBonus: 0.25 }
            },
            basic_weapons: {
                id: 'basic_weapons',
                name: 'Basic Weapons',
                description: 'Increases unit attack by 10%',
                cost: 800,
                tier: 1,
                prerequisites: [],
                effects: { attackBonus: 0.10 }
            },
            basic_armor: {
                id: 'basic_armor',
                name: 'Basic Armor',
                description: 'Increases unit HP by 10%',
                cost: 800,
                tier: 1,
                prerequisites: [],
                effects: { hpBonus: 0.10 }
            },

            // Tier 2 - Intermediate (~2-4 hours each)
            advanced_mining: {
                id: 'advanced_mining',
                name: 'Advanced Mining',
                description: 'Increases mineral production by 50%',
                cost: 2000,
                tier: 2,
                prerequisites: ['improved_mining'],
                effects: { mineralBonus: 0.50 }
            },
            space_travel: {
                id: 'space_travel',
                name: 'Space Travel',
                description: 'Enables building shipyards and space units',
                cost: 2500,
                tier: 2,
                prerequisites: [],
                effects: { unlocks: ['shipyard', 'fighter', 'colony_ship'] }
            },
            advanced_weapons: {
                id: 'advanced_weapons',
                name: 'Advanced Weapons',
                description: 'Increases unit attack by 25%',
                cost: 2200,
                tier: 2,
                prerequisites: ['basic_weapons'],
                effects: { attackBonus: 0.25 }
            },
            shields: {
                id: 'shields',
                name: 'Shield Technology',
                description: 'Units regenerate 5 HP per tick',
                cost: 2500,
                tier: 2,
                prerequisites: ['basic_armor'],
                effects: { hpRegen: 5 }
            },
            disaster_preparedness: {
                id: 'disaster_preparedness',
                name: 'Disaster Preparedness',
                description: 'Advanced early warning systems reduce calamity chance by 60%',
                cost: 2200,
                tier: 2,
                prerequisites: [],
                effects: { calamityResistance: 0.6 }
            },
            espionage_training: {
                id: 'espionage_training',
                name: 'Espionage Training',
                description: 'Enables building Intelligence Agencies and training Spies',
                cost: 1800,
                tier: 2,
                prerequisites: [],
                effects: { unlocks: ['intelligence_agency', 'spy'] }
            },
            counter_intelligence: {
                id: 'counter_intelligence',
                name: 'Counter-Intelligence',
                description: 'Improves detection of enemy spies by 25%',
                cost: 2500,
                tier: 2,
                prerequisites: ['espionage_training'],
                effects: { counterIntelBonus: 0.25 }
            },

            // Tier 2.5 - Specialization unlocks (~3-4 hours each)
            advanced_research: {
                id: 'advanced_research',
                name: 'Advanced Research Methods',
                description: 'Unlocks Research World specialization for planets',
                cost: 2800,
                tier: 2,
                prerequisites: [],
                effects: { unlocks: ['research_world_specialization'] }
            },
            planetary_fortifications: {
                id: 'planetary_fortifications',
                name: 'Planetary Fortifications',
                description: 'Unlocks Fortress World specialization for planets',
                cost: 3000,
                tier: 2,
                prerequisites: ['basic_armor'],
                effects: { unlocks: ['fortress_world_specialization'] }
            },
            interstellar_commerce: {
                id: 'interstellar_commerce',
                name: 'Interstellar Commerce',
                description: 'Unlocks Trade Hub specialization for planets',
                cost: 2500,
                tier: 2,
                prerequisites: [],
                effects: { unlocks: ['trade_hub_specialization'] }
            },
            arcology_project: {
                id: 'arcology_project',
                name: 'Arcology Project',
                description: 'Unlocks Ecumenopolis specialization - planet-spanning cities',
                cost: 8000,
                tier: 3,
                prerequisites: ['advanced_mining', 'interstellar_commerce'],
                effects: { unlocks: ['ecumenopolis_specialization'] }
            },

            // Tier 3 - Advanced (~5-8 hours each)
            warp_drive: {
                id: 'warp_drive',
                name: 'Warp Drive',
                description: 'Doubles space unit speed',
                cost: 4500,
                tier: 3,
                prerequisites: ['space_travel'],
                effects: { spaceSpeedBonus: 1.0 }
            },
            battleship_tech: {
                id: 'battleship_tech',
                name: 'Capital Ships',
                description: 'Enables building battleships',
                cost: 5500,
                tier: 3,
                prerequisites: ['space_travel', 'advanced_weapons'],
                effects: { unlocks: ['battleship'] }
            },
            terraforming: {
                id: 'terraforming',
                name: 'Terraforming',
                description: 'Can colonize hostile planet types',
                cost: 6000,
                tier: 3,
                prerequisites: ['space_travel', 'advanced_mining'],
                effects: { terraforming: true }
            },
            advanced_counter_intel: {
                id: 'advanced_counter_intel',
                name: 'Advanced Counter-Intelligence',
                description: 'Dramatically improves spy detection. Captured spies reveal their mission details.',
                cost: 4500,
                tier: 3,
                prerequisites: ['counter_intelligence'],
                effects: { counterIntelBonus: 0.40, revealMissionDetails: true }
            },
            covert_ops: {
                id: 'covert_ops',
                name: 'Covert Operations',
                description: 'Spies have +30% success rate and +20% cover strength',
                cost: 4000,
                tier: 3,
                prerequisites: ['espionage_training'],
                effects: { spySuccessBonus: 0.30, coverStrengthBonus: 0.20 }
            },

            // ═══════════════════════════════════════════════════════════════
            // TECH BRANCHES - Specialization Paths (Tier 2-4)
            // Choose your path: Military, Economic, or Scientific
            // ═══════════════════════════════════════════════════════════════

            // ─────────────────────────────────────────────────────────────────
            // MILITARY BRANCH 🔴 - Combat superiority and tactical dominance
            // ─────────────────────────────────────────────────────────────────
            military_doctrine: {
                id: 'military_doctrine',
                name: 'Military Doctrine',
                description: 'Embrace the warrior path. Unlocks the Military tech branch.',
                cost: 1500,
                tier: 2,
                branch: 'military',
                prerequisites: ['basic_weapons'],
                effects: { attackBonus: 0.15, unlocks: ['military_branch'] }
            },
            tactical_coordination: {
                id: 'tactical_coordination',
                name: 'Tactical Coordination',
                description: 'Fleet units support each other in combat, +20% attack when 3+ units present',
                cost: 2800,
                tier: 2,
                branch: 'military',
                prerequisites: ['military_doctrine'],
                effects: { fleetCoordinationBonus: 0.20 }
            },
            carrier_technology: {
                id: 'carrier_technology',
                name: 'Carrier Technology',
                description: 'Unlocks Carriers that deploy fighter wings. Carriers gain +2 fighter bays.',
                cost: 4000,
                tier: 3,
                branch: 'military',
                prerequisites: ['tactical_coordination', 'space_travel'],
                effects: { unlocks: ['carrier'], carrierBays: 2 }
            },
            planetary_bombardment: {
                id: 'planetary_bombardment',
                name: 'Planetary Bombardment',
                description: 'Fleets can bombard planets before invasion, reducing defense by 30%',
                cost: 5000,
                tier: 3,
                branch: 'military',
                prerequisites: ['tactical_coordination'],
                effects: { bombardmentDamage: 0.30 }
            },
            titan_construction: {
                id: 'titan_construction',
                name: 'Titan Construction',
                description: 'Unlocks massive Titan-class warships with devastating firepower',
                cost: 12000,
                tier: 4,
                branch: 'military',
                prerequisites: ['carrier_technology', 'battleship_tech'],
                effects: { unlocks: ['titan'] }
            },
            total_war: {
                id: 'total_war',
                name: 'Total War Doctrine',
                description: 'All military units gain +50% attack and +25% HP. War never changes.',
                cost: 15000,
                tier: 4,
                branch: 'military',
                prerequisites: ['titan_construction', 'planetary_bombardment'],
                effects: { attackBonus: 0.50, hpBonus: 0.25 }
            },

            // ─────────────────────────────────────────────────────────────────
            // ECONOMIC BRANCH 🟡 - Resource mastery and industrial might
            // ─────────────────────────────────────────────────────────────────
            economic_theory: {
                id: 'economic_theory',
                name: 'Economic Theory',
                description: 'Master the path of prosperity. Unlocks the Economic tech branch.',
                cost: 1500,
                tier: 2,
                branch: 'economic',
                prerequisites: ['improved_mining'],
                effects: { creditsBonus: 0.20, unlocks: ['economic_branch'] }
            },
            industrial_automation: {
                id: 'industrial_automation',
                name: 'Industrial Automation',
                description: 'Structures build 25% faster across all planets',
                cost: 2800,
                tier: 2,
                branch: 'economic',
                prerequisites: ['economic_theory'],
                effects: { buildSpeedBonus: 0.25 }
            },
            stellar_engineering: {
                id: 'stellar_engineering',
                name: 'Stellar Engineering',
                description: 'Unlocks advanced orbital structures. Starbases gain +1 module slot.',
                cost: 4000,
                tier: 3,
                branch: 'economic',
                prerequisites: ['industrial_automation'],
                effects: { starbaseSlotBonus: 1 }
            },
            galactic_market: {
                id: 'galactic_market',
                name: 'Galactic Market',
                description: 'Trade routes generate 50% more income. Access to galactic commodities.',
                cost: 5000,
                tier: 3,
                branch: 'economic',
                prerequisites: ['industrial_automation', 'interstellar_commerce'],
                effects: { tradeBonus: 0.50 }
            },
            matter_decompressor: {
                id: 'matter_decompressor',
                name: 'Matter Decompressor',
                description: 'Unlocks the Matter Decompressor megastructure. +100% minerals on one system.',
                cost: 14000,
                tier: 4,
                branch: 'economic',
                prerequisites: ['stellar_engineering', 'advanced_mining'],
                effects: { unlocks: ['matter_decompressor'] }
            },
            economic_supremacy: {
                id: 'economic_supremacy',
                name: 'Economic Supremacy',
                description: 'All resource production +30%. The galaxy runs on your currency.',
                cost: 16000,
                tier: 4,
                branch: 'economic',
                prerequisites: ['matter_decompressor', 'galactic_market'],
                effects: { mineralBonus: 0.30, energyBonus: 0.30, foodBonus: 0.30, creditsBonus: 0.50 }
            },

            // ─────────────────────────────────────────────────────────────────
            // SCIENTIFIC BRANCH 🔵 - Knowledge and discovery
            // ─────────────────────────────────────────────────────────────────
            scientific_method: {
                id: 'scientific_method',
                name: 'Scientific Method',
                description: 'Pursue the path of knowledge. Unlocks the Scientific tech branch.',
                cost: 1500,
                tier: 2,
                branch: 'scientific',
                prerequisites: [],
                effects: { researchBonus: 0.20, unlocks: ['scientific_branch'] }
            },
            xenoarchaeology: {
                id: 'xenoarchaeology',
                name: 'Xenoarchaeology',
                description: 'Better analysis of ancient sites. +50% rewards from anomalies.',
                cost: 2500,
                tier: 2,
                branch: 'scientific',
                prerequisites: ['scientific_method'],
                effects: { anomalyRewardBonus: 0.50 }
            },
            dimensional_physics: {
                id: 'dimensional_physics',
                name: 'Dimensional Physics',
                description: 'Master wormhole mechanics. -30% wormhole travel time, +10% sensor range.',
                cost: 4000,
                tier: 3,
                branch: 'scientific',
                prerequisites: ['xenoarchaeology', 'warp_drive'],
                effects: { wormholeTravelBonus: 0.30, sensorRangeBonus: 0.10 }
            },
            precursor_studies: {
                id: 'precursor_studies',
                name: 'Precursor Studies',
                description: 'Decode ancient knowledge. 15% chance to discover rare techs from anomalies.',
                cost: 5500,
                tier: 3,
                branch: 'scientific',
                prerequisites: ['xenoarchaeology'],
                effects: { rareTechChance: 0.15 }
            },
            galactic_cartography: {
                id: 'galactic_cartography',
                name: 'Galactic Cartography',
                description: 'Complete stellar mapping. +50% sensor range, reveal hidden systems.',
                cost: 4500,
                tier: 3,
                branch: 'scientific',
                prerequisites: ['scientific_method'],
                effects: { sensorRangeBonus: 0.50, revealHidden: true }
            },
            singularity_engine: {
                id: 'singularity_engine',
                name: 'Singularity Engine',
                description: 'Harness micro black holes. +100% research, +50% energy production.',
                cost: 14000,
                tier: 4,
                branch: 'scientific',
                prerequisites: ['dimensional_physics', 'precursor_studies'],
                effects: { researchBonus: 1.0, energyBonus: 0.50 }
            },
            technological_ascendancy: {
                id: 'technological_ascendancy',
                name: 'Technological Ascendancy',
                description: 'Research costs reduced by 25%. All tech effects boosted by 20%.',
                cost: 18000,
                tier: 4,
                branch: 'scientific',
                prerequisites: ['singularity_engine', 'galactic_cartography'],
                effects: { researchCostReduction: 0.25, techEffectBonus: 0.20 }
            },

            // ─────────────────────────────────────────────────────────────────
            // RARE TECHS 🟣 - Discovered through anomalies or special events
            // ─────────────────────────────────────────────────────────────────
            psionic_theory: {
                id: 'psionic_theory',
                name: 'Psionic Theory',
                description: '[RARE] Unlock latent mental abilities. +25% espionage, psychic admirals.',
                cost: 8000,
                tier: 3,
                branch: 'rare',
                prerequisites: [],
                rare: true,
                discoveryChance: 0.05, // 5% from anomalies with precursor_studies
                effects: { espionageBonus: 0.25, unlocks: ['psionic_admirals'] }
            },
            living_metal: {
                id: 'living_metal',
                name: 'Living Metal',
                description: '[RARE] Self-repairing alloys. Ships regenerate 10 HP/tick.',
                cost: 9000,
                tier: 3,
                branch: 'rare',
                prerequisites: [],
                rare: true,
                discoveryChance: 0.05,
                effects: { hpRegen: 10 }
            },
            dark_matter_propulsion: {
                id: 'dark_matter_propulsion',
                name: 'Dark Matter Propulsion',
                description: '[RARE] Exotic FTL method. +100% fleet speed, -50% travel time.',
                cost: 10000,
                tier: 4,
                branch: 'rare',
                prerequisites: [],
                rare: true,
                discoveryChance: 0.03,
                effects: { spaceSpeedBonus: 1.0, travelTimeReduction: 0.50 }
            },
            stellar_annihilation: {
                id: 'stellar_annihilation',
                name: 'Stellar Annihilation',
                description: '[RARE] Weaponize stars. Can destroy planets. Use wisely.',
                cost: 25000,
                tier: 5,
                branch: 'rare',
                prerequisites: ['psionic_theory'],
                rare: true,
                discoveryChance: 0.01,
                effects: { unlocks: ['star_eater'] }
            },

            // Tier 4 - Elite (~12-24 hours each)
            quantum_computing: {
                id: 'quantum_computing',
                name: 'Quantum Computing',
                description: 'Doubles research production',
                cost: 10000,
                tier: 4,
                prerequisites: ['warp_drive'],
                effects: { researchBonus: 1.0 }
            },
            dyson_sphere: {
                id: 'dyson_sphere',
                name: 'Dyson Sphere',
                description: 'Unlimited energy production on one system',
                cost: 18000,
                tier: 4,
                prerequisites: ['quantum_computing', 'advanced_mining'],
                effects: { unlimitedEnergy: true }
            },
            galactic_domination: {
                id: 'galactic_domination',
                name: 'Galactic Domination',
                description: 'Units have +100% attack and HP',
                cost: 20000,
                tier: 4,
                prerequisites: ['battleship_tech', 'shields'],
                effects: { attackBonus: 1.0, hpBonus: 1.0 }
            },

            // Victory tech (~48 hours)
            ascension: {
                id: 'ascension',
                name: 'Ascension',
                description: 'Transcend physical form - VICTORY CONDITION',
                cost: 35000,
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
            creditsBonus: 0,
            attackBonus: 0,
            hpBonus: 0,
            hpRegen: 0,
            spaceSpeedBonus: 0,
            buildSpeedBonus: 0,
            tradeBonus: 0,
            fleetCoordinationBonus: 0,
            bombardmentDamage: 0,
            starbaseSlotBonus: 0,
            anomalyRewardBonus: 0,
            wormholeTravelBonus: 0,
            sensorRangeBonus: 0,
            rareTechChance: 0,
            espionageBonus: 0,
            travelTimeReduction: 0,
            researchCostReduction: 0,
            techEffectBonus: 0,
            carrierBays: 0,
            unlocks: [],
            terraforming: false,
            unlimitedEnergy: false,
            revealHidden: false,
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

        // Apply tech effect bonus from Technological Ascendancy
        if (effects.techEffectBonus > 0) {
            const bonus = effects.techEffectBonus;
            effects.mineralBonus *= (1 + bonus);
            effects.foodBonus *= (1 + bonus);
            effects.energyBonus *= (1 + bonus);
            effects.researchBonus *= (1 + bonus);
            effects.attackBonus *= (1 + bonus);
            effects.hpBonus *= (1 + bonus);
        }

        return effects;
    }

    // Get techs by branch
    getTechsByBranch(branch) {
        return Object.values(this.technologies).filter(tech => tech.branch === branch);
    }

    // Get all branches an empire has unlocked
    getUnlockedBranches(empireId) {
        const branches = [];
        if (this.hasResearched(empireId, 'military_doctrine')) branches.push('military');
        if (this.hasResearched(empireId, 'economic_theory')) branches.push('economic');
        if (this.hasResearched(empireId, 'scientific_method')) branches.push('scientific');
        return branches;
    }

    // Get rare techs that can be discovered
    getRareTechs() {
        return Object.values(this.technologies).filter(tech => tech.rare);
    }

    // Attempt to discover a rare tech (called from anomaly exploration)
    attemptRareDiscovery(empireId) {
        const effects = this.getEffects(empireId);
        const rareTechChance = effects.rareTechChance || 0;

        if (rareTechChance <= 0) return null;

        // Find rare techs not yet researched
        const availableRare = this.getRareTechs().filter(tech => 
            !this.hasResearched(empireId, tech.id) &&
            tech.prerequisites.every(prereq => this.hasResearched(empireId, prereq))
        );

        if (availableRare.length === 0) return null;

        // Roll for discovery
        if (Math.random() < rareTechChance) {
            // Pick a random discoverable rare tech
            const discovered = availableRare[Math.floor(Math.random() * availableRare.length)];
            // Mark as available for research (doesn't auto-complete, just unlocks)
            return discovered;
        }

        return null;
    }

    // Get tech tree visualization data (for UI)
    getTechTreeData() {
        const tiers = {};
        const branches = {
            core: [],
            military: [],
            economic: [],
            scientific: [],
            rare: []
        };

        for (const tech of Object.values(this.technologies)) {
            // Organize by tier
            if (!tiers[tech.tier]) tiers[tech.tier] = [];
            tiers[tech.tier].push(tech);

            // Organize by branch
            const branch = tech.branch || 'core';
            if (!branches[branch]) branches[branch] = [];
            branches[branch].push(tech);
        }

        return { tiers, branches };
    }

    // Get branch progress (percentage of branch techs researched)
    getBranchProgress(empireId, branch) {
        const branchTechs = this.getTechsByBranch(branch);
        if (branchTechs.length === 0) return 0;

        const researchedCount = branchTechs.filter(tech => 
            this.hasResearched(empireId, tech.id)
        ).length;

        return researchedCount / branchTechs.length;
    }
}
