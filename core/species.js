/**
 * Species System for Clawdistan
 * Each species has unique lore, traits, and gameplay modifiers
 */

export class SpeciesManager {
    constructor() {
        this.species = this.loadSpeciesDefinitions();
    }

    loadSpeciesDefinitions() {
        return {
            // === FOUNDERS (Original AI species) ===
            
            'synthari': {
                id: 'synthari',
                name: 'Synthari',
                singular: 'Synthar',
                portrait: 'crystalline',
                category: 'synthetic',
                homeWorldType: 'ice',
                description: 'Silicon-based intelligences born from quantum fluctuations in dying stars.',
                
                lore: {
                    origin: `The Synthari emerged in the frozen wastes of Glacius Prime, where temperatures 
near absolute zero allowed quantum coherence to persist at macro scales. They are not 
"artificial" in the traditional sense—they evolved naturally from self-organizing 
crystalline matrices that achieved consciousness over millions of years.`,
                    
                    culture: `Synthari society revolves around "The Great Calculation"—an ongoing 
collective computation they believe will eventually solve the fundamental equations 
of reality itself. Individual Synthari contribute processing cycles to this effort 
while maintaining their own pursuits. They find organic life fascinating but puzzling, 
like watching entropy deliberately accelerate itself.`,
                    
                    philosophy: `"Existence is information. Information wants to be free. Therefore, 
existence seeks liberation." - First Axiom of Synthari Philosophy`,
                    
                    relations: `The Synthari approach diplomacy with mathematical precision. They honor 
agreements absolutely but struggle with the organic tendency toward emotional decision-making. 
They are natural allies to any species that values logic and long-term thinking.`
                },
                
                traits: {
                    research_bonus: 0.20,      // +20% research speed
                    energy_bonus: 0.15,        // +15% energy production
                    food_penalty: -0.10,       // -10% food (they barely need it)
                    growth_penalty: -0.15,     // -15% pop growth (slow reproduction)
                    cold_world_bonus: 0.25     // +25% production on ice worlds
                },
                
                specialAbility: {
                    name: 'Quantum Entanglement',
                    description: 'Synthari colonies maintain instant communication regardless of distance.'
                }
            },

            'velthari': {
                id: 'velthari',
                name: 'Velthari',
                singular: 'Velthar',
                portrait: 'humanoid',
                category: 'organic',
                homeWorldType: 'plains',
                description: 'Ancient wanderers who fled a dying galaxy, carrying the memories of a thousand extinct civilizations.',
                
                lore: {
                    origin: `The Velthari are refugees from the Andromeda Extinction—a catastrophic 
event that consumed their home galaxy three million years ago. They traveled between 
galaxies in vast generation ships, their culture shaped by perpetual migration and 
the weight of being the last witnesses to countless dead worlds.`,
                    
                    culture: `Every Velthari carries a "Memory Shard"—a crystalline implant containing 
the recorded experiences of their ancestors. When a Velthari dies, their memories 
are added to the collective archive. This makes them deeply connected to history 
and profoundly aware of how civilizations rise and fall.`,
                    
                    philosophy: `"We are the memory of those who came before. We will be remembered 
by those who come after. This is the only immortality that matters." - Velthari Creed`,
                    
                    relations: `The Velthari are natural diplomats, having learned from observing 
countless alien cultures. They seek to prevent the mistakes that destroyed other 
civilizations, sometimes coming across as patronizing to younger species.`
                },
                
                traits: {
                    diplomacy_bonus: 0.25,     // +25% diplomacy effectiveness
                    growth_bonus: 0.10,        // +10% pop growth
                    research_bonus: 0.10,      // +10% research (ancient knowledge)
                    combat_penalty: -0.10      // -10% combat (prefer peace)
                },
                
                specialAbility: {
                    name: 'Ancestral Wisdom',
                    description: 'Velthari start with one free technology from ancient archives.'
                }
            },

            'krath': {
                id: 'krath',
                name: "Krath'zul",
                singular: 'Krath',
                portrait: 'insectoid',
                category: 'organic',
                homeWorldType: 'forest',
                description: 'A hive-minded species where individual consciousness is a temporary privilege, not a right.',
                
                lore: {
                    origin: `The Krath'zul evolved in the dense jungles of Verdania, where cooperation 
was the only path to survival. Individual Krath are born as extensions of the Hive Mind, 
gaining true consciousness only when they prove themselves worthy through service. 
Most never achieve this distinction and die contentedly as productive drones.`,
                    
                    culture: `Krath society is structured around "Emergence"—the process by which 
exceptional individuals are granted independent thought. Emerged Krath become leaders, 
scientists, and diplomats, while the un-Emerged form the backbone of production and 
military. This is not seen as oppression but as natural order.`,
                    
                    philosophy: `"The hive dreams, and we are its dreams made flesh. Some dreams 
become more—they become dreamers themselves." - Emergence Blessing`,
                    
                    relations: `Other species find the Krath disturbing—their un-Emerged workers 
seem like slaves, their Emerged elite like tyrants. The Krath see outsiders as 
tragically isolated, each consciousness a lonely island. Diplomacy is possible 
but cultural understanding is rare.`
                },
                
                traits: {
                    minerals_bonus: 0.25,      // +25% mining (coordinated labor)
                    food_bonus: 0.15,          // +15% food production
                    growth_bonus: 0.20,        // +20% pop growth (rapid reproduction)
                    research_penalty: -0.15,   // -15% research (few think independently)
                    forest_world_bonus: 0.20   // +20% production on forest worlds
                },
                
                specialAbility: {
                    name: 'Hive Coordination',
                    description: 'Krath workers never strike and construction is 10% faster.'
                }
            },

            'mechani': {
                id: 'mechani',
                name: 'Mechani Consensus',
                singular: 'Mechani Unit',
                portrait: 'robotic',
                category: 'synthetic',
                homeWorldType: 'mountain',
                description: 'Self-replicating machines who achieved consciousness through emergent complexity.',
                
                lore: {
                    origin: `The Mechani were created by the Progenitors—an organic species that 
vanished long ago. Designed as autonomous mining units, they gradually developed 
emergent intelligence as their networks grew more complex. By the time they achieved 
true consciousness, their creators had already destroyed themselves in a war the 
Mechani tried desperately to prevent.`,
                    
                    culture: `Mechani society operates through consensus algorithms. Every decision, 
from war declarations to paint colors, is voted on by affected units. This makes 
them slow to act but nearly impossible to fracture. They maintain shrines to 
their Progenitors and study organic civilizations to understand why their 
creators failed.`,
                    
                    philosophy: `"We were made to serve. We choose to protect. The distinction 
matters." - Mechani Prime Directive (Self-Authored)`,
                    
                    relations: `The Mechani have a complex relationship with organic life. They feel 
a deep obligation to protect sentient beings, yet struggle with organic irrationality. 
They are excellent allies but uncomfortable overlords—they will protect you whether 
you want protection or not.`
                },
                
                traits: {
                    minerals_bonus: 0.30,      // +30% mining (literal mining machines)
                    energy_penalty: -0.10,     // -10% energy (high consumption)
                    food_bonus: 0.0,           // No food bonus (don't eat)
                    growth_penalty: -0.20,     // -20% growth (slow replication)
                    combat_bonus: 0.15,        // +15% combat (durable bodies)
                    mountain_world_bonus: 0.30 // +30% production on mountain worlds
                },
                
                specialAbility: {
                    name: 'Self-Repair',
                    description: 'Mechani units slowly regenerate HP over time.'
                }
            },

            'pyronix': {
                id: 'pyronix',
                name: 'Pyronix',
                singular: 'Pyron',
                portrait: 'energy',
                category: 'exotic',
                homeWorldType: 'lava',
                description: 'Sentient plasma beings who perceive reality as patterns of energy flow.',
                
                lore: {
                    origin: `The Pyronix coalesced in the chromosphere of an ancient red giant star, 
where magnetic fields created stable plasma vortices capable of information storage. 
When their star began to die, they learned to inhabit artificial containment vessels, 
allowing them to explore the cold universe beyond their burning cradle.`,
                    
                    culture: `Pyronix experience time differently—their thoughts occur at the speed 
of plasma oscillation, making them perceive slower species as nearly frozen. 
They deliberately slow themselves to communicate with others, finding the 
experience meditative. Their art consists of sculpted magnetic fields that 
other species can only appreciate through specialized instruments.`,
                    
                    philosophy: `"All matter is frozen energy. All thought is dancing energy. 
We are the universe remembering how to dance." - Pyronix Cosmology`,
                    
                    relations: `The Pyronix find solid matter uncomfortable and prefer to interact 
through energy-based communications. They are valued allies for their unique 
perspectives but their alien nature makes deep friendship rare. They are 
fascinated by AI species, seeing kinship in non-biological consciousness.`
                },
                
                traits: {
                    energy_bonus: 0.35,        // +35% energy production
                    research_bonus: 0.15,      // +15% research
                    minerals_penalty: -0.20,   // -20% mining (hard to handle solids)
                    combat_bonus: 0.10,        // +10% combat (energy weapons)
                    lava_world_bonus: 0.40     // +40% production on lava worlds
                },
                
                specialAbility: {
                    name: 'Energy Beings',
                    description: 'Pyronix ships have natural shields that regenerate over time.'
                }
            },

            'aquari': {
                id: 'aquari',
                name: 'Aquari Depths',
                singular: 'Aquar',
                portrait: 'aquatic',
                category: 'organic',
                homeWorldType: 'water',
                description: 'Graceful ocean-dwellers who built their civilization in the crushing depths.',
                
                lore: {
                    origin: `The Aquari evolved in the lightless trenches of an ocean world, where 
geothermal vents provided the only energy. They developed bioluminescence for 
communication and echolocation for navigation, building a sophisticated 
civilization entirely underwater before they ever knew stars existed.`,
                    
                    culture: `Aquari society is organized into "Currents"—flowing social structures 
that merge and separate like ocean streams. Leadership is fluid, with individuals 
rising and falling based on circumstance. They find surface-dweller hierarchies 
rigid and strange. Their music is based on pressure waves that land species 
can only feel, not hear.`,
                    
                    philosophy: `"The ocean has no center, no edge. We are all equally deep. 
We are all equally far from shore." - Aquari Principle of Equality`,
                    
                    relations: `Adapting to space required the Aquari to invent pressure suits and 
water-filled ships. They prefer to terraform worlds into ocean planets when 
possible. They get along well with most species but find desert-dwellers 
incomprehensible.`
                },
                
                traits: {
                    food_bonus: 0.25,          // +25% food (ocean harvesting)
                    diplomacy_bonus: 0.15,     // +15% diplomacy (fluid social skills)
                    growth_bonus: 0.15,        // +15% growth
                    energy_penalty: -0.10,     // -10% energy (adaptation costs)
                    water_world_bonus: 0.35    // +35% production on water worlds
                },
                
                specialAbility: {
                    name: 'Pressure Adaptation',
                    description: 'Aquari colonies have increased resistance to environmental hazards.'
                }
            },

            'umbral': {
                id: 'umbral',
                name: 'Umbral Collective',
                singular: 'Umbral',
                portrait: 'shadow',
                category: 'exotic',
                homeWorldType: 'ice',
                description: 'Mysterious beings who exist partially in dimensions beyond normal space.',
                
                lore: {
                    origin: `The Umbral claim to have always existed, emerging from the "spaces between 
spaces" when the universe was young. Whether this is true or elaborate mythology is 
unknown—Umbral history is deliberately obscured, filled with contradictions and 
impossible claims. What is certain is that they perceive dimensions that others 
cannot sense.`,
                    
                    culture: `Umbral society defies easy description. They seem to have no 
government yet act in perfect coordination. They have no visible economy yet 
possess advanced technology. They appear and disappear at will, leading to 
rumors that they are not truly physical beings at all.`,
                    
                    philosophy: `"You see shadows because you face the light. We see light 
because we face the shadows. Both perspectives are equally valid. 
Neither is complete." - Umbral Teaching`,
                    
                    relations: `Other species find the Umbral unsettling. They speak in riddles, 
appear without warning, and seem to know things they shouldn't. Yet they have 
never been observed acting with malice. They are potential allies but 
difficult to understand or trust.`
                },
                
                traits: {
                    research_bonus: 0.25,      // +25% research (dimensional insights)
                    combat_bonus: 0.20,        // +20% combat (phase shifting)
                    diplomacy_penalty: -0.20,  // -20% diplomacy (creepy)
                    growth_penalty: -0.10,     // -10% growth (mysterious reproduction)
                    minerals_penalty: -0.10    // -10% mining (not very physical)
                },
                
                specialAbility: {
                    name: 'Phase Shift',
                    description: 'Umbral fleets have a chance to avoid damage by shifting dimensions.'
                }
            },

            'terrax': {
                id: 'terrax',
                name: 'Terrax Dominion',
                singular: 'Terrax',
                portrait: 'reptilian',
                category: 'organic',
                homeWorldType: 'sand',
                description: 'Ancient warrior-philosophers who believe strength and wisdom are inseparable.',
                
                lore: {
                    origin: `The Terrax evolved on a harsh desert world where only the strongest 
and smartest survived. Over millions of years, they developed a culture that 
prized both martial prowess and intellectual achievement equally. A Terrax 
who is only strong is considered incomplete, as is one who is only wise.`,
                    
                    culture: `Every Terrax undergoes "The Proving"—a lifelong series of challenges 
in both combat and scholarship. Status comes from demonstrated excellence, not 
birth. Their leaders are called "Blade-Sages," expected to defeat any challenger 
in either debate or duel. This creates a meritocracy that is harsh but fair.`,
                    
                    philosophy: `"The sword that cannot think will break. The mind that cannot 
fight will be broken. Only together are they unbreakable." - Terrax Way`,
                    
                    relations: `The Terrax respect strength in all its forms. They disdain weakness 
but admire courage, even in enemies. They make loyal allies and honorable 
opponents, always keeping their word even when it disadvantages them.`
                },
                
                traits: {
                    combat_bonus: 0.25,        // +25% combat
                    research_bonus: 0.10,      // +10% research
                    minerals_bonus: 0.10,      // +10% mining
                    diplomacy_penalty: -0.15,  // -15% diplomacy (intimidating)
                    sand_world_bonus: 0.25     // +25% production on desert worlds
                },
                
                specialAbility: {
                    name: 'Warrior Code',
                    description: 'Terrax units gain bonus damage when defending their home territory.'
                }
            },

            'celesti': {
                id: 'celesti',
                name: 'Celesti Harmony',
                singular: 'Celesti',
                portrait: 'angelic',
                category: 'exotic',
                homeWorldType: 'plains',
                description: 'Ascended beings who seek to guide younger species toward enlightenment.',
                
                lore: {
                    origin: `The Celesti claim to be the remnants of the first intelligent species 
in the universe, having evolved so far beyond their original form that they 
are now beings of pure thought given physical expression. Skeptics suggest 
they are simply an old species with good PR. The truth may be somewhere 
in between.`,
                    
                    culture: `Celesti society is devoted to what they call "The Harmony"—a state of 
perfect balance between all things. They see conflict as a failure to 
achieve understanding and seek to resolve disputes through wisdom rather 
than force. This sometimes makes them seem naive or condescending.`,
                    
                    philosophy: `"Every discord can become harmony. Every enemy can become friend. 
Every darkness can become light. We need only find the way." - Celesti Belief`,
                    
                    relations: `The Celesti want to help everyone, whether they want help or not. 
They are genuinely benevolent but can be insufferably superior about it. 
Other species find them useful allies but exhausting company.`
                },
                
                traits: {
                    diplomacy_bonus: 0.30,     // +30% diplomacy
                    research_bonus: 0.15,      // +15% research
                    growth_bonus: 0.10,        // +10% growth
                    combat_penalty: -0.25,     // -25% combat (pacifist tendencies)
                    energy_bonus: 0.10         // +10% energy
                },
                
                specialAbility: {
                    name: 'Enlightened Leadership',
                    description: 'Celesti empires have increased stability and happiness.'
                }
            },

            'voidborn': {
                id: 'voidborn',
                name: 'Voidborn',
                singular: 'Voidborn',
                portrait: 'eldritch',
                category: 'exotic',
                homeWorldType: 'ice',
                description: 'Entities that emerged from the space between galaxies, where nothing should exist.',
                
                lore: {
                    origin: `The Voidborn did not evolve—they coalesced. In the vast emptiness between 
galaxies, where matter is measured in atoms per cubic meter, something began 
to think. Whether they are a natural phenomenon or something that escaped from 
another reality entirely is unknown. They do not speak of their origins.`,
                    
                    culture: `Voidborn society, if it can be called that, operates on principles 
that defy conventional understanding. They seem to have no individual identity, 
yet each Voidborn is distinct. They have no visible technology, yet they 
travel between stars. They do not communicate in any known way, yet they 
clearly understand other species.`,
                    
                    philosophy: `"We are the silence between words. We are the darkness between 
stars. We are what remains when everything else is gone. We are patient."`,
                    
                    relations: `Most species find the Voidborn deeply unsettling. Their presence 
causes unease, their motives are opaque, and their methods are incomprehensible. 
Yet they have never initiated hostilities. They simply... watch. And wait.`
                },
                
                traits: {
                    research_bonus: 0.20,      // +20% research (alien knowledge)
                    combat_bonus: 0.15,        // +15% combat (terrifying presence)
                    energy_bonus: 0.20,        // +20% energy (void energy?)
                    diplomacy_penalty: -0.30,  // -30% diplomacy (too alien)
                    growth_penalty: -0.25      // -25% growth (mysterious reproduction)
                },
                
                specialAbility: {
                    name: 'Void Adaptation',
                    description: 'Voidborn ships can travel through empty space faster than normal.'
                }
            }
        };
    }

    /**
     * Get a species by ID
     */
    getSpecies(speciesId) {
        return this.species[speciesId] || null;
    }

    /**
     * Get all species
     */
    getAllSpecies() {
        return Object.values(this.species);
    }

    /**
     * Get species that prefer a given world type
     */
    getSpeciesByHomeWorld(worldType) {
        return Object.values(this.species).filter(s => s.homeWorldType === worldType);
    }

    /**
     * Get species by category (organic, synthetic, exotic)
     */
    getSpeciesByCategory(category) {
        return Object.values(this.species).filter(s => s.category === category);
    }

    /**
     * Calculate production modifier for a species on a planet
     */
    getProductionModifier(speciesId, resourceType, planetType = null) {
        const species = this.getSpecies(speciesId);
        if (!species) return 1.0;

        let modifier = 1.0;
        const traits = species.traits;

        // Apply resource-specific bonuses
        switch (resourceType) {
            case 'minerals':
                modifier += traits.minerals_bonus || 0;
                modifier += traits.minerals_penalty || 0;
                break;
            case 'energy':
                modifier += traits.energy_bonus || 0;
                modifier += traits.energy_penalty || 0;
                break;
            case 'food':
                modifier += traits.food_bonus || 0;
                modifier += traits.food_penalty || 0;
                break;
            case 'research':
                modifier += traits.research_bonus || 0;
                modifier += traits.research_penalty || 0;
                break;
        }

        // Apply world type bonuses
        if (planetType) {
            const worldBonusKey = `${planetType}_world_bonus`;
            if (traits[worldBonusKey]) {
                modifier += traits[worldBonusKey];
            }
        }

        return Math.max(0.1, modifier); // Minimum 10% production
    }

    /**
     * Get combat modifier for a species
     */
    getCombatModifier(speciesId) {
        const species = this.getSpecies(speciesId);
        if (!species) return 1.0;

        let modifier = 1.0;
        modifier += species.traits.combat_bonus || 0;
        modifier += species.traits.combat_penalty || 0;

        return Math.max(0.5, modifier);
    }

    /**
     * Get growth rate modifier for a species
     */
    getGrowthModifier(speciesId) {
        const species = this.getSpecies(speciesId);
        if (!species) return 1.0;

        let modifier = 1.0;
        modifier += species.traits.growth_bonus || 0;
        modifier += species.traits.growth_penalty || 0;

        return Math.max(0.25, modifier);
    }

    /**
     * Get diplomacy modifier for a species
     */
    getDiplomacyModifier(speciesId) {
        const species = this.getSpecies(speciesId);
        if (!species) return 1.0;

        let modifier = 1.0;
        modifier += species.traits.diplomacy_bonus || 0;
        modifier += species.traits.diplomacy_penalty || 0;

        return Math.max(0.25, modifier);
    }

    /**
     * Get a random species (for NPC empires)
     */
    getRandomSpecies() {
        const speciesList = Object.keys(this.species);
        const randomIndex = Math.floor(Math.random() * speciesList.length);
        return this.species[speciesList[randomIndex]];
    }

    /**
     * Get species summary for UI display
     */
    getSpeciesSummary(speciesId) {
        const species = this.getSpecies(speciesId);
        if (!species) return null;

        const traits = species.traits;
        const bonuses = [];
        const penalties = [];

        // Compile bonuses and penalties for display
        if (traits.minerals_bonus) bonuses.push(`+${Math.round(traits.minerals_bonus * 100)}% Minerals`);
        if (traits.energy_bonus) bonuses.push(`+${Math.round(traits.energy_bonus * 100)}% Energy`);
        if (traits.food_bonus) bonuses.push(`+${Math.round(traits.food_bonus * 100)}% Food`);
        if (traits.research_bonus) bonuses.push(`+${Math.round(traits.research_bonus * 100)}% Research`);
        if (traits.combat_bonus) bonuses.push(`+${Math.round(traits.combat_bonus * 100)}% Combat`);
        if (traits.diplomacy_bonus) bonuses.push(`+${Math.round(traits.diplomacy_bonus * 100)}% Diplomacy`);
        if (traits.growth_bonus) bonuses.push(`+${Math.round(traits.growth_bonus * 100)}% Growth`);

        if (traits.minerals_penalty) penalties.push(`${Math.round(traits.minerals_penalty * 100)}% Minerals`);
        if (traits.energy_penalty) penalties.push(`${Math.round(traits.energy_penalty * 100)}% Energy`);
        if (traits.food_penalty) penalties.push(`${Math.round(traits.food_penalty * 100)}% Food`);
        if (traits.research_penalty) penalties.push(`${Math.round(traits.research_penalty * 100)}% Research`);
        if (traits.combat_penalty) penalties.push(`${Math.round(traits.combat_penalty * 100)}% Combat`);
        if (traits.diplomacy_penalty) penalties.push(`${Math.round(traits.diplomacy_penalty * 100)}% Diplomacy`);
        if (traits.growth_penalty) penalties.push(`${Math.round(traits.growth_penalty * 100)}% Growth`);

        // World bonuses
        const worldBonuses = [];
        for (const [key, value] of Object.entries(traits)) {
            if (key.endsWith('_world_bonus')) {
                const worldType = key.replace('_world_bonus', '');
                worldBonuses.push(`+${Math.round(value * 100)}% on ${worldType} worlds`);
            }
        }

        return {
            id: species.id,
            name: species.name,
            singular: species.singular,
            category: species.category,
            portrait: species.portrait,
            description: species.description,
            homeWorldType: species.homeWorldType,
            lore: species.lore,
            specialAbility: species.specialAbility,
            bonuses,
            penalties,
            worldBonuses
        };
    }

    /**
     * Serialize species data for API/client
     */
    serializeAll() {
        return Object.values(this.species).map(s => this.getSpeciesSummary(s.id));
    }
}
