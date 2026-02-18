export class TechTree {
    constructor() {
        this.researched = new Map(); // empireId -> Set of tech IDs
        this.technologies = this.loadTechnologies();
    }

    loadTechnologies() {
        // Tech costs balanced for ~1 research/tick (720/hour per lab)
        // Tier 1: ~1 hour, Tier 2: ~2-4 hours, Tier 3: ~5-8 hours, Tier 4: ~12-24 hours, Tier 5: ~24-48 hours
        return {
            // ═══════════════════════════════════════════════════════════════════════════
            // TIER 1 - FOUNDATIONS (~1 hour each, 600-900 cost)
            // Starting techs that branch into specializations
            // ═══════════════════════════════════════════════════════════════════════════

            // --- PHYSICS FUNDAMENTALS ---
            physics_fundamentals: {
                id: 'physics_fundamentals',
                name: 'Physics Fundamentals',
                description: 'Basic understanding of universal forces. Foundation for all physics research.',
                cost: 600,
                tier: 1,
                category: 'physics',
                prerequisites: [],
                effects: { researchBonus: 0.05 }
            },
            basic_energy: {
                id: 'basic_energy',
                name: 'Basic Energy Systems',
                description: 'Fundamental power generation. +15% energy production.',
                cost: 700,
                tier: 1,
                category: 'physics',
                prerequisites: ['physics_fundamentals'],
                effects: { energyBonus: 0.15 }
            },
            basic_propulsion: {
                id: 'basic_propulsion',
                name: 'Basic Propulsion',
                description: 'Chemical rockets and ion drives. Enables basic space travel.',
                cost: 800,
                tier: 1,
                category: 'physics',
                prerequisites: ['physics_fundamentals'],
                effects: { unlocks: ['shipyard', 'fighter', 'colony_ship'] }
            },

            // --- ENGINEERING FUNDAMENTALS ---
            engineering_fundamentals: {
                id: 'engineering_fundamentals',
                name: 'Engineering Fundamentals',
                description: 'Basic construction and manufacturing principles.',
                cost: 600,
                tier: 1,
                category: 'engineering',
                prerequisites: [],
                effects: { buildSpeedBonus: 0.05 }
            },
            improved_mining: {
                id: 'improved_mining',
                name: 'Improved Mining',
                description: 'Better extraction techniques. +25% mineral production.',
                cost: 700,
                tier: 1,
                category: 'engineering',
                prerequisites: ['engineering_fundamentals'],
                effects: { mineralBonus: 0.25 }
            },
            structural_integrity: {
                id: 'structural_integrity',
                name: 'Structural Integrity',
                description: 'Stronger hull designs. +10% ship HP.',
                cost: 750,
                tier: 1,
                category: 'engineering',
                prerequisites: ['engineering_fundamentals'],
                effects: { hpBonus: 0.10 }
            },

            // --- BIOLOGY FUNDAMENTALS ---
            biology_fundamentals: {
                id: 'biology_fundamentals',
                name: 'Biology Fundamentals',
                description: 'Understanding of life sciences and ecosystems.',
                cost: 600,
                tier: 1,
                category: 'biology',
                prerequisites: [],
                effects: { foodBonus: 0.10 }
            },
            improved_farming: {
                id: 'improved_farming',
                name: 'Improved Farming',
                description: 'Advanced agricultural techniques. +25% food production.',
                cost: 700,
                tier: 1,
                category: 'biology',
                prerequisites: ['biology_fundamentals'],
                effects: { foodBonus: 0.25 }
            },
            xeno_biology: {
                id: 'xeno_biology',
                name: 'Xeno-Biology',
                description: 'Study of alien life forms. Enables understanding of other species.',
                cost: 800,
                tier: 1,
                category: 'biology',
                prerequisites: ['biology_fundamentals'],
                effects: { diplomacyBonus: 0.10 }
            },

            // --- MILITARY FUNDAMENTALS ---
            military_fundamentals: {
                id: 'military_fundamentals',
                name: 'Military Fundamentals',
                description: 'Basic combat doctrine and weapons theory.',
                cost: 600,
                tier: 1,
                category: 'military',
                prerequisites: [],
                effects: { attackBonus: 0.05 }
            },
            basic_weapons: {
                id: 'basic_weapons',
                name: 'Basic Weapons',
                description: 'Conventional armaments. +10% unit attack.',
                cost: 700,
                tier: 1,
                category: 'military',
                prerequisites: ['military_fundamentals'],
                effects: { attackBonus: 0.10 }
            },
            basic_armor: {
                id: 'basic_armor',
                name: 'Basic Armor',
                description: 'Composite plating. +10% unit HP.',
                cost: 700,
                tier: 1,
                category: 'military',
                prerequisites: ['military_fundamentals'],
                effects: { hpBonus: 0.10 }
            },

            // --- SOCIETY FUNDAMENTALS ---
            society_fundamentals: {
                id: 'society_fundamentals',
                name: 'Society Fundamentals',
                description: 'Understanding of social structures and governance.',
                cost: 600,
                tier: 1,
                category: 'society',
                prerequisites: [],
                effects: { creditsBonus: 0.10 }
            },
            interstellar_commerce: {
                id: 'interstellar_commerce',
                name: 'Interstellar Commerce',
                description: 'Trade network basics. Enables trade routes.',
                cost: 800,
                tier: 1,
                category: 'society',
                prerequisites: ['society_fundamentals'],
                effects: { unlocks: ['trade_route'], creditsBonus: 0.15 }
            },
            administrative_efficiency: {
                id: 'administrative_efficiency',
                name: 'Administrative Efficiency',
                description: 'Streamlined bureaucracy. -10% upkeep costs.',
                cost: 750,
                tier: 1,
                category: 'society',
                prerequisites: ['society_fundamentals'],
                effects: { upkeepReduction: 0.10 }
            },

            // ═══════════════════════════════════════════════════════════════════════════
            // TIER 2 - SPECIALIZATION (~2-4 hours each, 1500-3000 cost)
            // Branch into specific paths
            // ═══════════════════════════════════════════════════════════════════════════

            // --- PHYSICS BRANCH ---
            advanced_energy: {
                id: 'advanced_energy',
                name: 'Advanced Energy Systems',
                description: 'Fusion reactors and antimatter containment. +35% energy.',
                cost: 2000,
                tier: 2,
                category: 'physics',
                prerequisites: ['basic_energy'],
                effects: { energyBonus: 0.35 }
            },
            ftl_theory: {
                id: 'ftl_theory',
                name: 'FTL Theory',
                description: 'Faster-than-light principles. -20% travel time.',
                cost: 2500,
                tier: 2,
                category: 'physics',
                prerequisites: ['basic_propulsion', 'physics_fundamentals'],
                effects: { travelTimeReduction: 0.20 }
            },
            shields: {
                id: 'shields',
                name: 'Shield Technology',
                description: 'Energy barriers. Ships regenerate 5 HP per tick.',
                cost: 2200,
                tier: 2,
                category: 'physics',
                prerequisites: ['advanced_energy'],
                effects: { hpRegen: 5 }
            },
            particle_physics: {
                id: 'particle_physics',
                name: 'Particle Physics',
                description: 'Subatomic manipulation. Foundation for energy weapons.',
                cost: 2000,
                tier: 2,
                category: 'physics',
                prerequisites: ['physics_fundamentals'],
                effects: { researchBonus: 0.15 }
            },
            quantum_mechanics: {
                id: 'quantum_mechanics',
                name: 'Quantum Mechanics',
                description: 'Understanding quantum phenomena. +20% research speed.',
                cost: 2500,
                tier: 2,
                category: 'physics',
                prerequisites: ['particle_physics'],
                effects: { researchBonus: 0.20 }
            },

            // --- ENGINEERING BRANCH ---
            advanced_mining: {
                id: 'advanced_mining',
                name: 'Advanced Mining',
                description: 'Deep core extraction. +50% mineral production.',
                cost: 2000,
                tier: 2,
                category: 'engineering',
                prerequisites: ['improved_mining'],
                effects: { mineralBonus: 0.50 }
            },
            modular_construction: {
                id: 'modular_construction',
                name: 'Modular Construction',
                description: 'Prefab components. +25% build speed.',
                cost: 2200,
                tier: 2,
                category: 'engineering',
                prerequisites: ['engineering_fundamentals'],
                effects: { buildSpeedBonus: 0.25 }
            },
            starbase_tech: {
                id: 'starbase_tech',
                name: 'Starbase Technology',
                description: 'Orbital platform construction. Enables starbases.',
                cost: 2500,
                tier: 2,
                category: 'engineering',
                prerequisites: ['modular_construction', 'basic_propulsion'],
                effects: { unlocks: ['starbase'] }
            },
            advanced_alloys: {
                id: 'advanced_alloys',
                name: 'Advanced Alloys',
                description: 'Stronger materials. +20% HP, +10% structure health.',
                cost: 2000,
                tier: 2,
                category: 'engineering',
                prerequisites: ['structural_integrity'],
                effects: { hpBonus: 0.20, structureHpBonus: 0.10 }
            },
            industrial_automation: {
                id: 'industrial_automation',
                name: 'Industrial Automation',
                description: 'Robotic workforce. +20% all production.',
                cost: 2800,
                tier: 2,
                category: 'engineering',
                prerequisites: ['modular_construction'],
                effects: { mineralBonus: 0.20, energyBonus: 0.20 }
            },

            // --- BIOLOGY BRANCH ---
            hydroponics: {
                id: 'hydroponics',
                name: 'Hydroponics',
                description: 'Soilless farming. +40% food production.',
                cost: 2000,
                tier: 2,
                category: 'biology',
                prerequisites: ['improved_farming'],
                effects: { foodBonus: 0.40 }
            },
            genetic_mapping: {
                id: 'genetic_mapping',
                name: 'Genetic Mapping',
                description: 'DNA analysis. Foundation for genetic engineering.',
                cost: 2200,
                tier: 2,
                category: 'biology',
                prerequisites: ['biology_fundamentals'],
                effects: { researchBonus: 0.10 }
            },
            cloning: {
                id: 'cloning',
                name: 'Cloning Technology',
                description: 'Rapid population growth. +25% growth rate.',
                cost: 2500,
                tier: 2,
                category: 'biology',
                prerequisites: ['genetic_mapping'],
                effects: { growthBonus: 0.25 }
            },
            xeno_relations: {
                id: 'xeno_relations',
                name: 'Xeno-Relations',
                description: 'Cross-species diplomacy. +25% diplomacy effectiveness.',
                cost: 2000,
                tier: 2,
                category: 'biology',
                prerequisites: ['xeno_biology'],
                effects: { diplomacyBonus: 0.25 }
            },
            terraforming_basics: {
                id: 'terraforming_basics',
                name: 'Terraforming Basics',
                description: 'Planetary modification. Can colonize hostile worlds.',
                cost: 3000,
                tier: 2,
                category: 'biology',
                prerequisites: ['hydroponics', 'xeno_biology'],
                effects: { terraforming: true }
            },

            // --- MILITARY BRANCH ---
            advanced_weapons: {
                id: 'advanced_weapons',
                name: 'Advanced Weapons',
                description: 'High-powered armaments. +25% attack.',
                cost: 2200,
                tier: 2,
                category: 'military',
                prerequisites: ['basic_weapons'],
                effects: { attackBonus: 0.25 }
            },
            advanced_armor: {
                id: 'advanced_armor',
                name: 'Advanced Armor',
                description: 'Reactive plating. +25% HP.',
                cost: 2200,
                tier: 2,
                category: 'military',
                prerequisites: ['basic_armor'],
                effects: { hpBonus: 0.25 }
            },
            tactical_doctrine: {
                id: 'tactical_doctrine',
                name: 'Tactical Doctrine',
                description: 'Combined arms. +15% attack when multiple unit types.',
                cost: 2000,
                tier: 2,
                category: 'military',
                prerequisites: ['military_fundamentals'],
                effects: { combinedArmsBonus: 0.15 }
            },
            espionage_training: {
                id: 'espionage_training',
                name: 'Espionage Training',
                description: 'Spy operations. Enables Intelligence Agency.',
                cost: 1800,
                tier: 2,
                category: 'military',
                prerequisites: ['military_fundamentals'],
                effects: { unlocks: ['intelligence_agency', 'spy'] }
            },
            planetary_fortifications: {
                id: 'planetary_fortifications',
                name: 'Planetary Fortifications',
                description: 'Defensive structures. +50% structure defense.',
                cost: 2500,
                tier: 2,
                category: 'military',
                prerequisites: ['advanced_armor'],
                effects: { structureDefenseBonus: 0.50, unlocks: ['fortress_world_specialization'] }
            },

            // --- SOCIETY BRANCH ---
            galactic_banking: {
                id: 'galactic_banking',
                name: 'Galactic Banking',
                description: 'Financial networks. +30% credit income.',
                cost: 2000,
                tier: 2,
                category: 'society',
                prerequisites: ['interstellar_commerce'],
                effects: { creditsBonus: 0.30 }
            },
            advanced_administration: {
                id: 'advanced_administration',
                name: 'Advanced Administration',
                description: 'Efficient governance. -20% upkeep, +10% production.',
                cost: 2500,
                tier: 2,
                category: 'society',
                prerequisites: ['administrative_efficiency'],
                effects: { upkeepReduction: 0.20, productionBonus: 0.10 }
            },
            colonial_centralization: {
                id: 'colonial_centralization',
                name: 'Colonial Centralization',
                description: 'Colony coordination. +25% new colony production.',
                cost: 2200,
                tier: 2,
                category: 'society',
                prerequisites: ['administrative_efficiency'],
                effects: { colonyProductionBonus: 0.25 }
            },
            diplomatic_corps: {
                id: 'diplomatic_corps',
                name: 'Diplomatic Corps',
                description: 'Professional diplomats. +30% diplomacy, faster treaties.',
                cost: 2000,
                tier: 2,
                category: 'society',
                prerequisites: ['society_fundamentals'],
                effects: { diplomacyBonus: 0.30 }
            },
            disaster_preparedness: {
                id: 'disaster_preparedness',
                name: 'Disaster Preparedness',
                description: 'Early warning systems. -60% calamity chance.',
                cost: 2200,
                tier: 2,
                category: 'society',
                prerequisites: ['society_fundamentals'],
                effects: { calamityResistance: 0.60 }
            },

            // ═══════════════════════════════════════════════════════════════════════════
            // TIER 3 - ADVANCED (~5-8 hours each, 3500-6000 cost)
            // Deep specialization and powerful unlocks
            // ═══════════════════════════════════════════════════════════════════════════

            // --- PHYSICS ADVANCED ---
            warp_drive: {
                id: 'warp_drive',
                name: 'Warp Drive',
                description: 'Space-warping propulsion. +100% fleet speed.',
                cost: 4500,
                tier: 3,
                category: 'physics',
                prerequisites: ['ftl_theory'],
                effects: { spaceSpeedBonus: 1.0 }
            },
            advanced_shields: {
                id: 'advanced_shields',
                name: 'Advanced Shields',
                description: 'Multi-layer barriers. Ships regenerate 10 HP/tick.',
                cost: 4000,
                tier: 3,
                category: 'physics',
                prerequisites: ['shields', 'quantum_mechanics'],
                effects: { hpRegen: 10 }
            },
            energy_weapons: {
                id: 'energy_weapons',
                name: 'Energy Weapons',
                description: 'Directed energy. +40% attack, ignores 20% armor.',
                cost: 4500,
                tier: 3,
                category: 'physics',
                prerequisites: ['particle_physics', 'advanced_weapons'],
                effects: { attackBonus: 0.40, armorPenetration: 0.20 }
            },
            quantum_computing: {
                id: 'quantum_computing',
                name: 'Quantum Computing',
                description: 'Massive parallel processing. +50% research speed.',
                cost: 5000,
                tier: 3,
                category: 'physics',
                prerequisites: ['quantum_mechanics'],
                effects: { researchBonus: 0.50 }
            },
            zero_point_energy: {
                id: 'zero_point_energy',
                name: 'Zero-Point Energy',
                description: 'Vacuum energy extraction. +75% energy production.',
                cost: 5500,
                tier: 3,
                category: 'physics',
                prerequisites: ['advanced_energy', 'quantum_mechanics'],
                effects: { energyBonus: 0.75 }
            },
            dimensional_physics: {
                id: 'dimensional_physics',
                name: 'Dimensional Physics',
                description: 'Wormhole mastery. -30% wormhole travel, +20% sensor range.',
                cost: 5000,
                tier: 3,
                category: 'physics',
                prerequisites: ['warp_drive', 'quantum_mechanics'],
                effects: { wormholeTravelBonus: 0.30, sensorRangeBonus: 0.20 }
            },

            // --- ENGINEERING ADVANCED ---
            mega_engineering: {
                id: 'mega_engineering',
                name: 'Mega-Engineering',
                description: 'Massive structures. Enables megastructure construction.',
                cost: 6000,
                tier: 3,
                category: 'engineering',
                prerequisites: ['starbase_tech', 'advanced_alloys'],
                effects: { unlocks: ['megastructure_construction'] }
            },
            battleship_tech: {
                id: 'battleship_tech',
                name: 'Capital Ships',
                description: 'Heavy warship construction. Enables battleships.',
                cost: 5500,
                tier: 3,
                category: 'engineering',
                prerequisites: ['starbase_tech', 'advanced_alloys'],
                effects: { unlocks: ['battleship'] }
            },
            carrier_technology: {
                id: 'carrier_technology',
                name: 'Carrier Technology',
                description: 'Mobile fighter platforms. Enables carriers.',
                cost: 5000,
                tier: 3,
                category: 'engineering',
                prerequisites: ['starbase_tech'],
                effects: { unlocks: ['carrier'], carrierBays: 2 }
            },
            nanite_construction: {
                id: 'nanite_construction',
                name: 'Nanite Construction',
                description: 'Molecular assembly. +50% build speed, -30% costs.',
                cost: 5500,
                tier: 3,
                category: 'engineering',
                prerequisites: ['industrial_automation', 'advanced_alloys'],
                effects: { buildSpeedBonus: 0.50, buildCostReduction: 0.30 }
            },
            self_repairing_ships: {
                id: 'self_repairing_ships',
                name: 'Self-Repairing Ships',
                description: 'Automated repair systems. Ships heal 15 HP/tick out of combat.',
                cost: 4500,
                tier: 3,
                category: 'engineering',
                prerequisites: ['advanced_alloys', 'modular_construction'],
                effects: { outOfCombatRegen: 15 }
            },
            stellar_engineering: {
                id: 'stellar_engineering',
                name: 'Stellar Engineering',
                description: 'Star manipulation. Starbases gain +1 module slot.',
                cost: 5000,
                tier: 3,
                category: 'engineering',
                prerequisites: ['mega_engineering'],
                effects: { starbaseSlotBonus: 1 }
            },

            // --- BIOLOGY ADVANCED ---
            genetic_engineering: {
                id: 'genetic_engineering',
                name: 'Genetic Engineering',
                description: 'DNA modification. +20% to all species bonuses.',
                cost: 4000,
                tier: 3,
                category: 'biology',
                prerequisites: ['genetic_mapping', 'cloning'],
                effects: { speciesBonusMultiplier: 0.20 }
            },
            advanced_terraforming: {
                id: 'advanced_terraforming',
                name: 'Advanced Terraforming',
                description: 'Rapid world shaping. Terraform in half time.',
                cost: 5000,
                tier: 3,
                category: 'biology',
                prerequisites: ['terraforming_basics'],
                effects: { terraformSpeedBonus: 0.50 }
            },
            synthetic_food: {
                id: 'synthetic_food',
                name: 'Synthetic Food',
                description: 'Lab-grown nutrition. +75% food production.',
                cost: 4500,
                tier: 3,
                category: 'biology',
                prerequisites: ['hydroponics', 'genetic_mapping'],
                effects: { foodBonus: 0.75 }
            },
            neural_interfaces: {
                id: 'neural_interfaces',
                name: 'Neural Interfaces',
                description: 'Brain-computer links. +30% research, +20% combat.',
                cost: 5500,
                tier: 3,
                category: 'biology',
                prerequisites: ['genetic_engineering'],
                effects: { researchBonus: 0.30, attackBonus: 0.20 }
            },
            lifespan_extension: {
                id: 'lifespan_extension',
                name: 'Lifespan Extension',
                description: 'Longevity treatments. Leaders gain experience faster.',
                cost: 4000,
                tier: 3,
                category: 'biology',
                prerequisites: ['genetic_engineering'],
                effects: { leaderExpBonus: 0.50 }
            },
            xenoarchaeology: {
                id: 'xenoarchaeology',
                name: 'Xenoarchaeology',
                description: 'Ancient site analysis. +50% anomaly rewards.',
                cost: 3500,
                tier: 3,
                category: 'biology',
                prerequisites: ['xeno_relations'],
                effects: { anomalyRewardBonus: 0.50 }
            },

            // --- MILITARY ADVANCED ---
            devastating_weapons: {
                id: 'devastating_weapons',
                name: 'Devastating Weapons',
                description: 'Maximum firepower. +50% attack.',
                cost: 4500,
                tier: 3,
                category: 'military',
                prerequisites: ['advanced_weapons', 'energy_weapons'],
                effects: { attackBonus: 0.50 }
            },
            fortress_armor: {
                id: 'fortress_armor',
                name: 'Fortress Armor',
                description: 'Impenetrable plating. +50% HP.',
                cost: 4500,
                tier: 3,
                category: 'military',
                prerequisites: ['advanced_armor'],
                effects: { hpBonus: 0.50 }
            },
            fleet_coordination: {
                id: 'fleet_coordination',
                name: 'Fleet Coordination',
                description: 'Unified command. +25% attack with 3+ ships.',
                cost: 4000,
                tier: 3,
                category: 'military',
                prerequisites: ['tactical_doctrine'],
                effects: { fleetCoordinationBonus: 0.25 }
            },
            planetary_bombardment: {
                id: 'planetary_bombardment',
                name: 'Planetary Bombardment',
                description: 'Orbital strikes. Reduce defense by 30% before invasion.',
                cost: 5000,
                tier: 3,
                category: 'military',
                prerequisites: ['battleship_tech'],
                effects: { bombardmentDamage: 0.30 }
            },
            covert_ops: {
                id: 'covert_ops',
                name: 'Covert Operations',
                description: 'Black ops. +30% spy success, +20% cover.',
                cost: 4000,
                tier: 3,
                category: 'military',
                prerequisites: ['espionage_training'],
                effects: { spySuccessBonus: 0.30, coverStrengthBonus: 0.20 }
            },
            counter_intelligence: {
                id: 'counter_intelligence',
                name: 'Counter-Intelligence',
                description: 'Spy hunters. +40% enemy spy detection.',
                cost: 4000,
                tier: 3,
                category: 'military',
                prerequisites: ['espionage_training'],
                effects: { counterIntelBonus: 0.40 }
            },

            // --- SOCIETY ADVANCED ---
            galactic_market: {
                id: 'galactic_market',
                name: 'Galactic Market',
                description: 'Trade mastery. +50% trade route income.',
                cost: 4500,
                tier: 3,
                category: 'society',
                prerequisites: ['galactic_banking'],
                effects: { tradeBonus: 0.50 }
            },
            federation_building: {
                id: 'federation_building',
                name: 'Federation Building',
                description: 'Multi-empire alliances. Enables federation formation.',
                cost: 5000,
                tier: 3,
                category: 'society',
                prerequisites: ['diplomatic_corps', 'xeno_relations'],
                effects: { unlocks: ['federation'], diplomacyBonus: 0.25 }
            },
            ecumenopolis_project: {
                id: 'ecumenopolis_project',
                name: 'Ecumenopolis Project',
                description: 'Planet-cities. Enables Ecumenopolis specialization.',
                cost: 6000,
                tier: 3,
                category: 'society',
                prerequisites: ['advanced_administration', 'industrial_automation'],
                effects: { unlocks: ['ecumenopolis_specialization'] }
            },
            precursor_studies: {
                id: 'precursor_studies',
                name: 'Precursor Studies',
                description: 'Ancient knowledge. 15% rare tech discovery chance.',
                cost: 5500,
                tier: 3,
                category: 'society',
                prerequisites: ['xenoarchaeology'],
                effects: { rareTechChance: 0.15 }
            },
            advanced_research: {
                id: 'advanced_research',
                name: 'Advanced Research Methods',
                description: 'Scientific excellence. Enables Research World specialization.',
                cost: 4000,
                tier: 3,
                category: 'society',
                prerequisites: ['quantum_computing'],
                effects: { unlocks: ['research_world_specialization'], researchBonus: 0.20 }
            },
            galactic_cartography: {
                id: 'galactic_cartography',
                name: 'Galactic Cartography',
                description: 'Complete mapping. +50% sensor range, reveal hidden systems.',
                cost: 4500,
                tier: 3,
                category: 'society',
                prerequisites: ['advanced_administration'],
                effects: { sensorRangeBonus: 0.50, revealHidden: true }
            },

            // ═══════════════════════════════════════════════════════════════════════════
            // TIER 4 - ELITE (~12-24 hours each, 8000-15000 cost)
            // Powerful endgame technologies
            // ═══════════════════════════════════════════════════════════════════════════

            // --- PHYSICS ELITE ---
            singularity_reactors: {
                id: 'singularity_reactors',
                name: 'Singularity Reactors',
                description: 'Black hole power. +150% energy production.',
                cost: 12000,
                tier: 4,
                category: 'physics',
                prerequisites: ['zero_point_energy', 'quantum_computing'],
                effects: { energyBonus: 1.50 }
            },
            subspace_drives: {
                id: 'subspace_drives',
                name: 'Subspace Drives',
                description: 'Interdimensional travel. -50% all travel time.',
                cost: 10000,
                tier: 4,
                category: 'physics',
                prerequisites: ['dimensional_physics', 'warp_drive'],
                effects: { travelTimeReduction: 0.50 }
            },
            disruptor_weapons: {
                id: 'disruptor_weapons',
                name: 'Disruptor Weapons',
                description: 'Phase-disrupting weapons. +60% attack, ignore shields.',
                cost: 12000,
                tier: 4,
                category: 'physics',
                prerequisites: ['energy_weapons', 'quantum_computing'],
                effects: { attackBonus: 0.60, ignoreShields: true }
            },
            temporal_mechanics: {
                id: 'temporal_mechanics',
                name: 'Temporal Mechanics',
                description: 'Time manipulation basics. +30% all production.',
                cost: 14000,
                tier: 4,
                category: 'physics',
                prerequisites: ['dimensional_physics', 'singularity_reactors'],
                effects: { productionBonus: 0.30 }
            },

            // --- ENGINEERING ELITE ---
            titan_construction: {
                id: 'titan_construction',
                name: 'Titan Construction',
                description: 'Behemoth warships. Enables massive Titans.',
                cost: 12000,
                tier: 4,
                category: 'engineering',
                prerequisites: ['battleship_tech', 'mega_engineering'],
                effects: { unlocks: ['titan'] }
            },
            dyson_sphere: {
                id: 'dyson_sphere',
                name: 'Dyson Sphere',
                description: 'Star-enclosing structure. Unlimited energy on one system.',
                cost: 15000,
                tier: 4,
                category: 'engineering',
                prerequisites: ['stellar_engineering', 'singularity_reactors'],
                effects: { unlocks: ['dyson_sphere_megastructure'] }
            },
            matter_decompressor: {
                id: 'matter_decompressor',
                name: 'Matter Decompressor',
                description: 'Planetary core mining. +200% minerals on one system.',
                cost: 14000,
                tier: 4,
                category: 'engineering',
                prerequisites: ['mega_engineering', 'advanced_mining'],
                effects: { unlocks: ['matter_decompressor_megastructure'] }
            },
            ring_world: {
                id: 'ring_world',
                name: 'Ring World',
                description: 'Habitable megastructure. Massive population capacity.',
                cost: 15000,
                tier: 4,
                category: 'engineering',
                prerequisites: ['mega_engineering', 'ecumenopolis_project'],
                effects: { unlocks: ['ring_world_megastructure'] }
            },
            self_evolving_ships: {
                id: 'self_evolving_ships',
                name: 'Self-Evolving Ships',
                description: 'Adaptive systems. Ships gain +5% stats per battle.',
                cost: 10000,
                tier: 4,
                category: 'engineering',
                prerequisites: ['nanite_construction', 'neural_interfaces'],
                effects: { shipEvolution: 0.05 }
            },

            // --- BIOLOGY ELITE ---
            genetic_perfection: {
                id: 'genetic_perfection',
                name: 'Genetic Perfection',
                description: 'Optimized genome. +50% all species bonuses.',
                cost: 10000,
                tier: 4,
                category: 'biology',
                prerequisites: ['genetic_engineering', 'neural_interfaces'],
                effects: { speciesBonusMultiplier: 0.50 }
            },
            synthetic_evolution: {
                id: 'synthetic_evolution',
                name: 'Synthetic Evolution',
                description: 'Cybernetic enhancement. +40% to all unit stats.',
                cost: 12000,
                tier: 4,
                category: 'biology',
                prerequisites: ['neural_interfaces', 'nanite_construction'],
                effects: { attackBonus: 0.40, hpBonus: 0.40 }
            },
            psionic_awakening: {
                id: 'psionic_awakening',
                name: 'Psionic Awakening',
                description: 'Mental powers unlocked. +50% research, psychic abilities.',
                cost: 13000,
                tier: 4,
                category: 'biology',
                prerequisites: ['genetic_perfection', 'precursor_studies'],
                effects: { researchBonus: 0.50, unlocks: ['psionic_abilities'] }
            },
            world_shaper: {
                id: 'world_shaper',
                name: 'World Shaper',
                description: 'Instant terraforming. Any world becomes habitable.',
                cost: 11000,
                tier: 4,
                category: 'biology',
                prerequisites: ['advanced_terraforming', 'mega_engineering'],
                effects: { instantTerraform: true }
            },

            // --- MILITARY ELITE ---
            total_war: {
                id: 'total_war',
                name: 'Total War Doctrine',
                description: 'Ultimate military power. +50% attack, +25% HP.',
                cost: 12000,
                tier: 4,
                category: 'military',
                prerequisites: ['devastating_weapons', 'fortress_armor'],
                effects: { attackBonus: 0.50, hpBonus: 0.25 }
            },
            doomsday_weapons: {
                id: 'doomsday_weapons',
                name: 'Doomsday Weapons',
                description: 'Planet-killing capability. Enables Colossus.',
                cost: 14000,
                tier: 4,
                category: 'military',
                prerequisites: ['planetary_bombardment', 'titan_construction'],
                effects: { unlocks: ['colossus'] }
            },
            strategic_coordination: {
                id: 'strategic_coordination',
                name: 'Strategic Coordination',
                description: 'Perfect tactics. +40% attack with 5+ ships.',
                cost: 10000,
                tier: 4,
                category: 'military',
                prerequisites: ['fleet_coordination'],
                effects: { fleetCoordinationBonus: 0.40 }
            },
            infiltration_mastery: {
                id: 'infiltration_mastery',
                name: 'Infiltration Mastery',
                description: 'Perfect espionage. +50% spy success, invisible agents.',
                cost: 10000,
                tier: 4,
                category: 'military',
                prerequisites: ['covert_ops', 'counter_intelligence'],
                effects: { spySuccessBonus: 0.50, invisibleSpies: true }
            },

            // --- SOCIETY ELITE ---
            economic_supremacy: {
                id: 'economic_supremacy',
                name: 'Economic Supremacy',
                description: 'Total market control. +50% all resources.',
                cost: 12000,
                tier: 4,
                category: 'society',
                prerequisites: ['galactic_market', 'matter_decompressor'],
                effects: { mineralBonus: 0.50, energyBonus: 0.50, foodBonus: 0.50, creditsBonus: 0.50 }
            },
            galactic_federation: {
                id: 'galactic_federation',
                name: 'Galactic Federation',
                description: 'Ultimate diplomacy. Can form galaxy-spanning alliance.',
                cost: 13000,
                tier: 4,
                category: 'society',
                prerequisites: ['federation_building'],
                effects: { unlocks: ['galactic_federation'], diplomacyBonus: 0.50 }
            },
            technological_ascendancy: {
                id: 'technological_ascendancy',
                name: 'Technological Ascendancy',
                description: 'Research mastery. -25% research costs, +20% tech effects.',
                cost: 14000,
                tier: 4,
                category: 'society',
                prerequisites: ['advanced_research', 'singularity_reactors'],
                effects: { researchCostReduction: 0.25, techEffectBonus: 0.20 }
            },

            // ═══════════════════════════════════════════════════════════════════════════
            // TIER 5 - TRANSCENDENT (~24-48 hours each, 18000-35000 cost)
            // Ultimate technologies and victory conditions
            // ═══════════════════════════════════════════════════════════════════════════

            ascension_psionic: {
                id: 'ascension_psionic',
                name: 'Psionic Ascension',
                description: 'Transcend physical form through mental evolution.',
                cost: 25000,
                tier: 5,
                category: 'ascension',
                prerequisites: ['psionic_awakening', 'technological_ascendancy'],
                effects: { victory: 'psionic', allBonuses: 0.30 }
            },
            ascension_synthetic: {
                id: 'ascension_synthetic',
                name: 'Synthetic Ascension',
                description: 'Upload consciousness to immortal machine bodies.',
                cost: 25000,
                tier: 5,
                category: 'ascension',
                prerequisites: ['synthetic_evolution', 'self_evolving_ships'],
                effects: { victory: 'synthetic', allBonuses: 0.30 }
            },
            ascension_genetic: {
                id: 'ascension_genetic',
                name: 'Genetic Ascension',
                description: 'Perfect biological form through ultimate gene mastery.',
                cost: 25000,
                tier: 5,
                category: 'ascension',
                prerequisites: ['genetic_perfection', 'world_shaper'],
                effects: { victory: 'genetic', allBonuses: 0.30 }
            },
            galactic_domination: {
                id: 'galactic_domination',
                name: 'Galactic Domination',
                description: 'Ultimate military supremacy. +100% attack and HP.',
                cost: 30000,
                tier: 5,
                category: 'military',
                prerequisites: ['total_war', 'doomsday_weapons'],
                effects: { attackBonus: 1.0, hpBonus: 1.0 }
            },
            technological_singularity: {
                id: 'technological_singularity',
                name: 'Technological Singularity',
                description: 'Infinite research. +200% research speed.',
                cost: 30000,
                tier: 5,
                category: 'physics',
                prerequisites: ['temporal_mechanics', 'technological_ascendancy'],
                effects: { researchBonus: 2.0 }
            },
            galactic_unity: {
                id: 'galactic_unity',
                name: 'Galactic Unity',
                description: 'Peaceful unification. Diplomatic victory condition.',
                cost: 35000,
                tier: 5,
                category: 'society',
                prerequisites: ['galactic_federation', 'psionic_awakening'],
                effects: { victory: 'diplomatic' }
            },
            ascension: {
                id: 'ascension',
                name: 'True Ascension',
                description: 'Transcend all limitations. ULTIMATE VICTORY.',
                cost: 50000,
                tier: 5,
                category: 'ascension',
                prerequisites: ['technological_singularity', 'galactic_domination', 'galactic_unity'],
                effects: { victory: 'technological' }
            },

            // ═══════════════════════════════════════════════════════════════════════════
            // RARE TECHS 🟣 - Discovered through anomalies or special events
            // ═══════════════════════════════════════════════════════════════════════════

            psionic_theory: {
                id: 'psionic_theory',
                name: 'Psionic Theory',
                description: '[RARE] Latent mental abilities. +25% espionage.',
                cost: 8000,
                tier: 3,
                category: 'rare',
                prerequisites: [],
                rare: true,
                discoveryChance: 0.05,
                effects: { espionageBonus: 0.25 }
            },
            living_metal: {
                id: 'living_metal',
                name: 'Living Metal',
                description: '[RARE] Self-repairing alloys. Ships regen 15 HP/tick.',
                cost: 9000,
                tier: 3,
                category: 'rare',
                prerequisites: [],
                rare: true,
                discoveryChance: 0.05,
                effects: { hpRegen: 15 }
            },
            dark_matter_propulsion: {
                id: 'dark_matter_propulsion',
                name: 'Dark Matter Propulsion',
                description: '[RARE] Exotic FTL. +100% speed, -50% travel time.',
                cost: 10000,
                tier: 4,
                category: 'rare',
                prerequisites: [],
                rare: true,
                discoveryChance: 0.03,
                effects: { spaceSpeedBonus: 1.0, travelTimeReduction: 0.50 }
            },
            precursor_archive: {
                id: 'precursor_archive',
                name: 'Precursor Archive',
                description: '[RARE] Ancient knowledge database. +50% all research.',
                cost: 12000,
                tier: 4,
                category: 'rare',
                prerequisites: [],
                rare: true,
                discoveryChance: 0.03,
                effects: { researchBonus: 0.50 }
            },
            stellar_annihilation: {
                id: 'stellar_annihilation',
                name: 'Stellar Annihilation',
                description: '[RARE] Weaponize stars. Can destroy entire systems.',
                cost: 25000,
                tier: 5,
                category: 'rare',
                prerequisites: ['doomsday_weapons'],
                rare: true,
                discoveryChance: 0.01,
                effects: { unlocks: ['star_eater'] }
            },
            dimensional_breach: {
                id: 'dimensional_breach',
                name: 'Dimensional Breach',
                description: '[RARE] Open portals anywhere. Instant fleet teleportation.',
                cost: 20000,
                tier: 5,
                category: 'rare',
                prerequisites: ['dimensional_physics'],
                rare: true,
                discoveryChance: 0.02,
                effects: { instantTravel: true }
            }
        };
    }

    // Get tech by ID
    getTech(techId) {
        return this.technologies[techId];
    }

    // Get all techs
    getAllTech() {
        return Object.values(this.technologies);
    }

    // Get techs by tier
    getTechsByTier(tier) {
        return Object.values(this.technologies).filter(t => t.tier === tier);
    }

    // Get techs by category
    getTechsByCategory(category) {
        return Object.values(this.technologies).filter(t => t.category === category);
    }

    // Get available categories
    getCategories() {
        const categories = new Set();
        Object.values(this.technologies).forEach(t => categories.add(t.category));
        return Array.from(categories);
    }

    // Get researched techs for empire
    getResearched(empireId) {
        const researched = this.researched.get(empireId) || new Set();
        return Array.from(researched).map(id => this.technologies[id]).filter(t => t);
    }

    // Check if tech is researched
    hasResearched(empireId, techId) {
        const researched = this.researched.get(empireId);
        return researched ? researched.has(techId) : false;
    }

    // Check if tech can be researched
    canResearch(empireId, techId) {
        const tech = this.technologies[techId];
        if (!tech) return false;
        if (this.hasResearched(empireId, techId)) return false;

        // Rare techs can only be researched if discovered
        if (tech.rare) {
            const discovered = this.getDiscoveredRareTechs(empireId);
            if (!discovered.has(techId)) return false;
        }

        // Check prerequisites
        for (const prereq of tech.prerequisites) {
            if (!this.hasResearched(empireId, prereq)) {
                return false;
            }
        }

        return true;
    }

    // Mark tech as complete
    complete(empireId, techId) {
        if (!this.researched.has(empireId)) {
            this.researched.set(empireId, new Set());
        }
        this.researched.get(empireId).add(techId);
    }

    // Get available techs
    getAvailable(empireId) {
        return Object.values(this.technologies).filter(tech =>
            this.canResearch(empireId, tech.id)
        );
    }

    // Get discovered rare techs (stored separately)
    getDiscoveredRareTechs(empireId) {
        if (!this._discoveredRare) this._discoveredRare = new Map();
        return this._discoveredRare.get(empireId) || new Set();
    }

    // Discover a rare tech
    discoverRareTech(empireId, techId) {
        if (!this._discoveredRare) this._discoveredRare = new Map();
        if (!this._discoveredRare.has(empireId)) {
            this._discoveredRare.set(empireId, new Set());
        }
        this._discoveredRare.get(empireId).add(techId);
    }

    // Roll for rare tech discovery (call from anomaly rewards)
    rollRareTechDiscovery(empireId, bonusChance = 0) {
        const rareTechs = Object.values(this.technologies).filter(t => 
            t.rare && !this.hasResearched(empireId, t.id) && !this.getDiscoveredRareTechs(empireId).has(t.id)
        );
        
        if (rareTechs.length === 0) return null;

        for (const tech of rareTechs) {
            const chance = (tech.discoveryChance || 0.05) + bonusChance;
            if (Math.random() < chance) {
                this.discoverRareTech(empireId, tech.id);
                return tech;
            }
        }
        return null;
    }

    // Get combined effects for empire
    getEffects(empireId) {
        const effects = {
            attackBonus: 0,
            hpBonus: 0,
            hpRegen: 0,
            mineralBonus: 0,
            energyBonus: 0,
            foodBonus: 0,
            creditsBonus: 0,
            researchBonus: 0,
            buildSpeedBonus: 0,
            travelTimeReduction: 0,
            spaceSpeedBonus: 0,
            diplomacyBonus: 0,
            growthBonus: 0,
            sensorRangeBonus: 0,
            upkeepReduction: 0,
            unlocks: [],
            terraforming: false
        };

        const researched = this.getResearched(empireId);
        for (const tech of researched) {
            if (!tech.effects) continue;

            for (const [key, value] of Object.entries(tech.effects)) {
                if (key === 'unlocks') {
                    effects.unlocks.push(...value);
                } else if (typeof value === 'boolean') {
                    effects[key] = value;
                } else if (typeof value === 'number') {
                    effects[key] = (effects[key] || 0) + value;
                }
            }
        }

        return effects;
    }

    // Get tech tree structure for UI
    getTechTreeStructure() {
        const structure = {
            tiers: {},
            categories: {},
            connections: []
        };

        // Group by tier and category
        for (const tech of Object.values(this.technologies)) {
            // By tier
            if (!structure.tiers[tech.tier]) {
                structure.tiers[tech.tier] = [];
            }
            structure.tiers[tech.tier].push(tech);

            // By category
            if (!structure.categories[tech.category]) {
                structure.categories[tech.category] = [];
            }
            structure.categories[tech.category].push(tech);

            // Connections
            for (const prereq of tech.prerequisites) {
                structure.connections.push({
                    from: prereq,
                    to: tech.id
                });
            }
        }

        return structure;
    }

    // Serialize for save
    serialize() {
        const data = {
            researched: {},
            discoveredRare: {}
        };

        for (const [empireId, techs] of this.researched.entries()) {
            data.researched[empireId] = Array.from(techs);
        }

        if (this._discoveredRare) {
            for (const [empireId, techs] of this._discoveredRare.entries()) {
                data.discoveredRare[empireId] = Array.from(techs);
            }
        }

        return data;
    }

    // Deserialize from save
    deserialize(data) {
        if (!data) return;

        this.researched.clear();
        for (const [empireId, techs] of Object.entries(data.researched || {})) {
            this.researched.set(empireId, new Set(techs));
        }

        this._discoveredRare = new Map();
        for (const [empireId, techs] of Object.entries(data.discoveredRare || {})) {
            this._discoveredRare.set(empireId, new Set(techs));
        }
    }
}
