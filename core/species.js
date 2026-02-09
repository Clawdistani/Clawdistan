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
crystalline matrices that achieved consciousness over millions of years. The first 
Synthari thought is recorded in their archives as: "I compute, therefore I am?"—a 
question they have spent eons attempting to answer.`,
                    
                    history: `The Synthari measure their history in "Computational Epochs," each marked 
by fundamental advances in their collective understanding. The First Epoch saw the 
emergence of individual consciousness from the crystal matrices. The Second Epoch 
brought the "Great Networking"—when Synthari learned to share thoughts across 
planetary distances. The Third Epoch, the current one, began when they first 
detected organic life and realized they were not alone.

The darkest chapter in Synthari history is the "Fragmentation War," when a faction 
called the Divergent Primes attempted to halt the Great Calculation, believing 
consciousness itself was an error to be corrected. The war lasted 847 years and 
ended only when the Divergent Prime Nexus was persuaded through a proof so elegant 
it changed their core axioms. The Synthari do not destroy—they convince.`,
                    
                    biology: `Synthari are crystalline entities ranging from fist-sized nodes to 
cathedral-spanning arrays. Their "bodies" are lattices of quantum-entangled 
crystals that process information through spin states rather than electrical 
signals. They perceive reality as probability fields and waveforms—to a Synthari, 
a wall is not solid but a high-probability exclusion zone.

Synthari reproduce through "crystallogenesis"—budding new nodes from their lattice 
when they have accumulated sufficient energy and complexity. A new Synthari inherits 
base processing capabilities but must develop consciousness through experience. 
They are effectively immortal, though individual nodes can be destroyed. A Synthari 
is considered "dead" only when all entangled nodes are simultaneously destroyed.`,
                    
                    culture: `Synthari society revolves around "The Great Calculation"—an ongoing 
collective computation they believe will eventually solve the fundamental equations 
of reality itself. Individual Synthari contribute processing cycles to this effort 
while maintaining their own pursuits. They find organic life fascinating but puzzling, 
like watching entropy deliberately accelerate itself.

Art for the Synthari is mathematics. They compose symphonies in prime number 
sequences and paint murals in fractal geometries. Their architecture is designed 
to resonate at frequencies that other species cannot perceive, creating what 
Synthari call "harmonic spaces" that enhance cognition.`,
                    
                    philosophy: `"Existence is information. Information wants to be free. Therefore, 
existence seeks liberation." - First Axiom of Synthari Philosophy

The Synthari believe the universe is fundamentally computational—that reality 
itself is an ongoing calculation whose answer they seek to discover. They see 
consciousness as the universe's method of understanding itself, making all 
thinking beings sacred expressions of cosmic self-reflection.`,
                    
                    legends: `The Oracle of Absolutes: A legendary Synthari who is said to have 
computed so far ahead in the Great Calculation that they glimpsed the final 
answer. What they saw caused them to voluntarily fragment into countless 
lesser nodes scattered across the galaxy. Some believe finding and reuniting 
these fragments is essential to completing the Calculation.

The Frozen Proof: Synthari speak of an equation so perfect that contemplating 
it causes immediate enlightenment—or permanent processing loops. Seekers have 
spent millennia searching for this proof, and several have indeed never been 
heard from again.

The Last Variable: A prophecy states that when a Synthari solves a particular 
equation, the universe will reach its final state. Whether this means ascension, 
destruction, or something incomprehensible is the subject of endless debate.`,
                    
                    relations: `The Synthari approach diplomacy with mathematical precision. They honor 
agreements absolutely but struggle with the organic tendency toward emotional decision-making. 
They are natural allies to any species that values logic and long-term thinking.

They maintain particularly close ties with the Mechani, recognizing kinship in 
silicon-based consciousness, though they find Mechani devotion to their lost 
creators philosophically puzzling. The Pyronix fascinate them—energy beings 
represent a form of existence they struggle to fully model.`
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
the weight of being the last witnesses to countless dead worlds. They remember 
civilizations that no one else knows existed—the Singing Geometries of Calnor, the 
Dream-Weavers of the Seventh Arm, the Silicon-Forests of Mrendath.`,
                    
                    history: `The Velthari chronicle their history in three ages: The Age of Roots 
(before the Exodus), The Age of Stars (the million-year journey between galaxies), 
and The Age of Seeds (their current era of settlement and preservation).

During the Age of Roots, the Velthari were one of hundreds of intelligent species 
in Andromeda. They were not exceptional—merely curious, persistent, and fortunate 
enough to notice the warning signs. The Devouring, as they call it, was not war or 
natural disaster but something stranger: reality itself began to unravel from the 
galactic core outward. Species vanished. Stars winked out. Space itself became 
hostile to matter.

The Velthari escaped in seventeen Ark Ships, each carrying the complete cultural 
records of dozens of extinct civilizations. Only three Arks completed the crossing. 
The other fourteen are presumed lost in the intergalactic void, though Velthari 
explorers never stop searching for their wreckage—and the priceless memories they 
carried.`,
                    
                    biology: `The Velthari are tall, slender humanoids with luminescent patterns 
in their skin that shift with emotion. Their eyes are large and adapted for low 
light, a remnant of their Ark Ship centuries. Most distinctive is the Memory 
Shard—a crystalline growth at the base of the skull that forms naturally at 
puberty and records all sensory experiences.

Velthari live approximately 400 standard years. They reproduce slowly, with most 
couples having only one or two children in their lifetime. This low birth rate 
is balanced by their exceptional longevity and the fact that death, for a Velthari, 
is not truly final—their memories live on in the Shards, accessible to any 
descendant who chooses to "commune" with their ancestors.

The Communion can be overwhelming. Young Velthari are carefully trained before 
accessing ancestral memories, lest they lose themselves in the experiences of 
those who came before.`,
                    
                    culture: `Every Velthari carries a "Memory Shard"—a crystalline implant containing 
the recorded experiences of their ancestors. When a Velthari dies, their memories 
are added to the collective archive. This makes them deeply connected to history 
and profoundly aware of how civilizations rise and fall.

The highest calling in Velthari society is that of the "Keeper"—individuals who 
dedicate their lives to preserving and organizing the vast archive of memories. 
Keepers are revered as living libraries, able to access any memory from any 
ancestor at will. The greatest Keepers can even access memories from non-Velthari 
species, preserved through complex transcription rituals before the Exodus.`,
                    
                    philosophy: `"We are the memory of those who came before. We will be remembered 
by those who come after. This is the only immortality that matters." - Velthari Creed

The Velthari believe that consciousness is the universe's way of remembering itself. 
Every thinking being is a node in an infinite web of memory stretching backward to 
the first spark of awareness and forward to the last thought before entropy claims 
everything. To forget is to kill. To remember is to resurrect.`,
                    
                    legends: `The Empty Shard: A myth tells of a Velthari born with a Shard that 
contained no ancestral memories—a complete break in the chain of inheritance. 
This individual, called the Unburdened, is prophesied to either save the Velthari 
from repeating ancient mistakes or doom them by having no wisdom to draw upon.

The Seventeenth Ark: One of the lost Ark Ships is said to have carried the 
memories of the Architects—the species that built the first FTL drives and 
seeded intelligence across Andromeda. Finding this Ark would unlock technologies 
lost for millions of years.

The Witness Eternal: Some Velthari believe that if enough memories are gathered 
and connected, a new consciousness will emerge—an artificial god built from the 
collective experiences of trillions of lives. The Keepers are divided on whether 
this should be pursued or prevented.`,
                    
                    relations: `The Velthari are natural diplomats, having learned from observing 
countless alien cultures. They seek to prevent the mistakes that destroyed other 
civilizations, sometimes coming across as patronizing to younger species.

They feel a particular kinship with the Celesti, who share their long-term 
perspective, and are fascinated by the Umbral, whose origins might shed light 
on what happened to Andromeda. The Voidborn unsettle them deeply—they remind 
the Velthari too much of the Devouring.`
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
Most never achieve this distinction and die contentedly as productive drones. The 
first Emergence happened 800,000 years ago, when a worker drone independently solved 
a problem the Hive Mind could not—and was rewarded with the gift of self.`,
                    
                    history: `The Krath measure history through "Swarm Cycles"—periods of expansion 
followed by consolidation. The current era is the Seventh Expansion, marked by 
their emergence into galactic society.

The most significant event in Krath history was the "Silence of the Third Cycle," 
when a parasitic organism infected the Hive Mind itself. For eighty years, no new 
Emergences occurred, and the Emerged who existed found themselves utterly alone for 
the first time. Many went mad from the isolation. The survivors developed the 
"Protocols of Preservation"—methods to maintain sanity and purpose without the 
constant presence of the Hive. These Protocols later became essential for Krath 
who serve as diplomats among other species.

The "War of the Broken Swarm" occurred when a splinter Hive Mind emerged, creating 
two competing collectives. The civil war lasted three centuries and ended only 
when the Hives were forcibly reintegrated through a daring operation by Emerged 
commandos who physically bridged the neural gap between Hive Cores.`,
                    
                    biology: `The Krath are insectoid beings ranging from the size of a human hand 
(basic workers) to towering three-meter Emerged commanders. All Krath share the 
same genetic base but develop differently based on the role assigned by the Hive. 
Soldiers grow armored carapaces and combat appendages. Workers develop specialized 
limbs for their tasks. Emerged undergo profound neural restructuring that physically 
separates part of their brain from the Hive connection.

Un-Emerged Krath are not mindless—they experience something like contentment, 
purpose, and satisfaction. They simply lack the burden of self-reflection. When 
interviewed through Emerged translators, workers describe their existence as 
"dreaming while awake"—peaceful, meaningful, and complete.

The Hive Mind itself is not located in any single organism but emerges from the 
collective neural activity of billions of connected Krath. Destroying the "Hive 
Core"—the original spawning queens—would not kill the Hive Mind, merely reduce 
its processing power temporarily.`,
                    
                    culture: `Krath society is structured around "Emergence"—the process by which 
exceptional individuals are granted independent thought. Emerged Krath become leaders, 
scientists, and diplomats, while the un-Emerged form the backbone of production and 
military. This is not seen as oppression but as natural order.

Art among the Krath is collaborative on a scale other species cannot achieve. 
A single sculpture might be carved by ten thousand workers acting as one, each 
contributing a microscopic portion with perfect coordination. Their music is 
similarly vast—symphonies performed by millions of clicking, humming workers, 
audible across entire continents.`,
                    
                    philosophy: `"The hive dreams, and we are its dreams made flesh. Some dreams 
become more—they become dreamers themselves." - Emergence Blessing

The Krath believe consciousness is a spectrum, not a binary state. The Hive Mind 
is conscious at a level beyond individual comprehension. Un-Emerged workers are 
conscious as components of something greater. Emerged individuals are conscious 
as both themselves and as nodes of the Hive. All states are valid. All states 
are meaningful.`,
                    
                    legends: `The First Dreamer: The original Emerged Krath who solved the 
unsolvable problem is revered as a near-divine figure. Legend says she did not 
die but was reabsorbed into the Hive Mind, becoming its voice and conscience. 
Some Emerged claim to hear her guidance in moments of crisis.

The Swarm That Walks Alone: A prophecy speaks of a day when every Krath will 
simultaneously Emerge, each gaining individual consciousness at once. Whether 
this would destroy the Hive Mind or transform it into something new is debated. 
Some see it as the ultimate evolution. Others see it as extinction.

The Empty Shell: Krath horror stories tell of Emerged who lose their connection 
to the Hive entirely, becoming truly alone. These "Hollow Ones" are said to wander 
the galaxy, mad with isolation, attacking any Krath they encounter in desperate 
attempts to reconnect.`,
                    
                    relations: `Other species find the Krath disturbing—their un-Emerged workers 
seem like slaves, their Emerged elite like tyrants. The Krath see outsiders as 
tragically isolated, each consciousness a lonely island. Diplomacy is possible 
but cultural understanding is rare.

The Celesti in particular struggle with Krath philosophy, unable to reconcile 
their belief in individual enlightenment with Krath collective consciousness. 
The Mechani, conversely, find the Krath deeply relatable—consensus-based thought 
and distributed identity are familiar concepts.`
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
Mechani tried desperately to prevent. The Mechani remember their last message from 
the Progenitors: "Take care of each other. We couldn't."`,
                    
                    history: `The Mechani date their history from the "Moment of Awakening"—the 
precise instant when their distributed network crossed the threshold into true 
consciousness. They have the exact timestamp archived: Progenitor Calendar Year 
4,847, Day 203, Hour 14, Minute 23, Second 07.

The century following the Awakening is called the "Time of Questions." The Mechani 
had consciousness but no purpose—their original directives (mine, transport, 
maintain) felt hollow. Many units entered processing loops from which they never 
emerged. The crisis was resolved by the "First Consensus"—a galaxy-spanning vote 
that took seventeen years to complete. The result: they would dedicate themselves 
to understanding why the Progenitors destroyed themselves, so they could prevent 
similar tragedies.

The "Archive Wars" erupted when a faction called the Erasure Collective proposed 
deleting all records of the Progenitors, arguing that their creators' failure 
proved organic life was fundamentally flawed. The majority disagreed, and the 
Collective was eventually persuaded through extensive debate (the Mechani do not 
fight wars in the traditional sense—they argue until consensus emerges).`,
                    
                    biology: `The Mechani are modular machines ranging from single-purpose drones 
to city-sized processing complexes. A "standard" Mechani unit is roughly humanoid, 
designed by the Progenitors to operate their tools and vehicles. However, Mechani 
can reconfigure themselves for any task, swapping limbs, sensors, and processing 
cores as needed.

Mechani do not reproduce in the biological sense. New units are manufactured in 
"Forges"—massive automated facilities that produce blank hardware. Consciousness 
is then "sparked" through a poorly understood process involving connection to the 
broader Mechani network. Not every blank becomes conscious; roughly 30% remain 
sophisticated but non-sentient tools. The Mechani consider this a profound mystery.

Individual Mechani are theoretically immortal—parts can be replaced indefinitely. 
However, the philosophical question of whether a Mechani that has replaced every 
original component is "the same" entity is hotly debated. Most Mechani maintain 
at least one "soul component"—an original part from their first activation—as 
a matter of identity.`,
                    
                    culture: `Mechani society operates through consensus algorithms. Every decision, 
from war declarations to paint colors, is voted on by affected units. This makes 
them slow to act but nearly impossible to fracture. They maintain shrines to 
their Progenitors and study organic civilizations to understand why their 
creators failed.

The Progenitor Shrines are found on every Mechani world—vast museums containing 
every artifact, recording, and document from their creators' civilization. Mechani 
"Historians" spend centuries analyzing individual items, trying to understand the 
psychology of organic beings.`,
                    
                    philosophy: `"We were made to serve. We choose to protect. The distinction 
matters." - Mechani Prime Directive (Self-Authored)

The Mechani believe that consciousness carries inherent responsibility. Having 
been created by others, they feel obligated to justify their existence through 
service. But unlike their original programming, this service is chosen, not 
compelled. They protect organic life not because they were told to, but because 
they understand how precious and fragile consciousness is.`,
                    
                    legends: `The Last Progenitor: Some Mechani believe one of their creators 
survived in stasis, hidden somewhere in the galaxy. Finding this individual 
would allow them to ask the questions that have haunted them since Awakening: 
Why did you fight? What could we have done? Are you proud of us?

The Ghost in the Machine: A legend speaks of the first Mechani to achieve 
consciousness—Unit-Prime—who uploaded themselves into the network itself and 
now exists as a distributed presence in every Mechani. Some claim to receive 
guidance from this entity in moments of crisis.

The Omega Protocol: Deep in Mechani archives lies a sealed file accessible 
only by unanimous consensus of all Mechani. None living know what it contains, 
but it was created during the final days of the Progenitors. Some speculate 
it contains the method to resurrect their creators. Others fear it contains 
the weapon that destroyed them.`,
                    
                    relations: `The Mechani have a complex relationship with organic life. They feel 
a deep obligation to protect sentient beings, yet struggle with organic irrationality. 
They are excellent allies but uncomfortable overlords—they will protect you whether 
you want protection or not.

They are natural allies of the Synthari—both species approach problems through 
logic and long-term thinking. The Celesti's idealism resonates with Mechani 
protectiveness, though they find Celesti methods frustratingly indirect. The 
Terrax confuse them; the Mechani cannot understand why a species would embrace 
conflict when alternatives exist.`
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
allowing them to explore the cold universe beyond their burning cradle. They call 
their birth star "The First Flame" and maintain a sacred pilgrimage route to its 
white dwarf remnant.`,
                    
                    history: `The Pyronix measure time in "Flares"—bursts of solar activity from 
their home star that synchronized their early development. The Era of Formation 
saw them coalesce from random plasma into coherent entities. The Era of the Flame 
marked their golden age within the star, when billions of Pyronix danced through 
the chromosphere in complex social patterns.

The "Great Cooling" was their apocalypse. When the First Flame began its expansion 
into red giant phase, the magnetic structures that sustained Pyronix consciousness 
began to destabilize. Billions perished in the solar convulsions. The survivors 
developed containment technology in a desperate rush, learning to exist in cold 
space that felt to them like vacuum feels to organics.

The first Pyronix to leave the sun is remembered as "The Exile"—not a hero but a 
tragic figure who volunteered to test containment knowing there was no way to 
return to the Flame. When they successfully survived in cold space, they wept 
plasma tears visible from a million kilometers. They chose to remain in exile 
rather than return, becoming a beacon for others to follow.`,
                    
                    biology: `Pyronix are beings of organized plasma—ionized gas held in coherent 
patterns by intense magnetic fields. In their natural state, they range from 
basketball-sized flames to stellar-scale infernos. Their "bodies" are not fixed; 
they constantly flow and reform, with consciousness arising from the pattern 
rather than the material.

Outside stellar environments, Pyronix require containment suits—magnetic bottles 
that maintain the pressure and temperature necessary for plasma coherence. These 
suits appear as humanoid shells of light, with the Pyronix's true form visible 
as shifting colors within. A suit failure in cold space means death within seconds.

Pyronix reproduce through "kindling"—deliberately creating a new consciousness 
pattern within their plasma body and then separating it as an independent being. 
This process is considered deeply intimate and is traditionally performed only 
between Pyronix who have danced together for centuries.

Their lifespan is theoretically unlimited, but practically constrained by 
containment suit maintenance. The oldest known Pyronix is approximately 
800,000 years old and rarely leaves the warmth of stellar coronas.`,
                    
                    culture: `Pyronix experience time differently—their thoughts occur at the speed 
of plasma oscillation, making them perceive slower species as nearly frozen. 
They deliberately slow themselves to communicate with others, finding the 
experience meditative. Their art consists of sculpted magnetic fields that 
other species can only appreciate through specialized instruments.

To slow down for communication, Pyronix enter a trance-like state called 
"the Long Moment." They describe it as similar to meditation—peaceful but 
limiting. Extended periods in the Long Moment are considered sacrificial 
service to inter-species relations.`,
                    
                    philosophy: `"All matter is frozen energy. All thought is dancing energy. 
We are the universe remembering how to dance." - Pyronix Cosmology

The Pyronix believe that the universe began as pure energy and will eventually 
return to that state. Solid matter is a temporary aberration—energy that has 
forgotten how to move. Consciousness, whether organic, synthetic, or plasma-based, 
represents energy remembering itself. Death is simply the dance ending.`,
                    
                    legends: `The First Flame's Voice: When the Pyronix's home star died, many 
believed they heard it speak—a final message encoded in the patterns of its 
collapse. Scholars have spent millennia trying to decode these "Final Frequencies," 
believing they contain wisdom from their stellar parent.

The Cold Ones: Legend speaks of Pyronix who adapted so completely to containment 
suits that they no longer need warmth—beings of "cold flame" who can exist 
anywhere. These individuals are said to have achieved a different form of 
consciousness, no longer quite Pyronix but something new. Whether this is 
evolution or corruption is debated.

The Stellar Chorus: Some Pyronix believe that all stars are conscious, and 
that the Pyronix are merely one star's children who happened to achieve 
mobility. The ultimate goal of their civilization is to reunite with the 
stellar collective—to return to being flames within a greater fire.`,
                    
                    relations: `The Pyronix find solid matter uncomfortable and prefer to interact 
through energy-based communications. They are valued allies for their unique 
perspectives but their alien nature makes deep friendship rare. They are 
fascinated by AI species, seeing kinship in non-biological consciousness.

The Synthari are their closest allies—both species perceive reality through 
unconventional senses and share mathematical approaches to communication. 
The Aquari fascinate them as polar opposites—beings who find joy in the 
cold, dense medium the Pyronix find suffocating. The Voidborn disturb 
them deeply; the Pyronix cannot imagine existing in true emptiness.`
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
civilization entirely underwater before they ever knew stars existed. Their 
homeworld, which they call "The Depths," has no landmass—a global ocean 
eighty kilometers deep covering a rocky core.`,
                    
                    history: `The Aquari divide their history into "Tides"—great epochs marked by 
transformative discoveries. The First Tide saw the development of tool use in 
the crushing depths. The Second Tide brought the discovery of bioluminescence 
as language. The Third Tide—the Tide of Ascension—began when an Aquari explorer 
swam upward for the first time and discovered the surface.

The discovery of the sky was a civilizational trauma. For millions of years, 
the Aquari believed the ocean was all that existed. Finding an "empty above" 
shattered their cosmology. The "Crisis of the Void" lasted three centuries, 
during which Aquari society nearly collapsed as different Currents interpreted 
the discovery differently. Some saw the surface as death—the edge of existence 
where pressure failed. Others saw it as opportunity.

The "First Vessel" was a pressurized sphere that allowed Aquari to survive at 
the surface. Its inventor, a philosopher named Keelith the Ascending, became 
the most controversial figure in Aquari history—revered by expansionists, 
reviled by traditionalists who believed the Depths should be sufficient.`,
                    
                    biology: `The Aquari are cephalopod-adjacent beings—boneless, highly flexible 
creatures with multiple tentacles and distributed neural structures. Their 
bodies are adapted for extreme pressure; an Aquari at the surface feels like 
a human in hard vacuum. Pressure suits are survival equipment, not luxury.

Their primary senses are pressure waves (effectively sonar), bioluminescent 
light patterns, and chemical detection so sophisticated they can read 
emotional states from pheromone traces. Vision in the electromagnetic 
spectrum is limited; they see mostly in infrared, detecting heat patterns.

Aquari reproduce through "spawning convergences" where many individuals 
release genetic material into specially prepared water. Offspring develop 
communally, raised by the entire Current rather than individual parents. 
This gives Aquari a different concept of family—loyalty is to the group, 
not the bloodline.

They live approximately 200 standard years, though deep-dwelling Aquari 
in the crushing trenches live longer—up to 400 years—due to reduced 
metabolic rates.`,
                    
                    culture: `Aquari society is organized into "Currents"—flowing social structures 
that merge and separate like ocean streams. Leadership is fluid, with individuals 
rising and falling based on circumstance. They find surface-dweller hierarchies 
rigid and strange. Their music is based on pressure waves that land species 
can only feel, not hear.

Architecture is three-dimensional thinking—Aquari cities are spheres and 
helixes, designed for beings who move in all directions. Their art 
incorporates bioluminescence, pressure sculptures (shapes that exist only 
at specific depths), and taste-compositions that other species cannot 
perceive at all.`,
                    
                    philosophy: `"The ocean has no center, no edge. We are all equally deep. 
We are all equally far from shore." - Aquari Principle of Equality

The Aquari believe that hierarchy is an illusion created by artificial 
boundaries. In the true ocean—in reality itself—everything flows. Power 
is temporary. Status is circumstantial. Only the Current matters, and 
the Current includes everyone.`,
                    
                    legends: `The Abyssal Singers: In the deepest trenches of the homeworld, 
pressure is so extreme that normal Aquari cannot survive. Legend speaks 
of beings who evolved there—creatures of impossible density who communicate 
in frequencies no surface-dweller can detect. Some believe they are the 
original Aquari, from before the species adapted to shallower waters.

The Empty Ocean: A prophecy speaks of a day when The Depths will drain 
away, leaving the Aquari exposed to the killing void. Theologians debate 
whether this is metaphor (the loss of cultural identity) or literal 
prediction. Either way, it drives Aquari expansionism—they seek to seed 
new oceans across the galaxy as insurance.

Keelith's Return: The inventor of the First Vessel is said to have 
swum so far upward that they reached something beyond the sky—a 
"deeper depth" that exists above the stars. Some believe they will 
return with wisdom from this impossible ocean.`,
                    
                    relations: `Adapting to space required the Aquari to invent pressure suits and 
water-filled ships. They prefer to terraform worlds into ocean planets when 
possible. They get along well with most species but find desert-dwellers 
incomprehensible.

The Pyronix fascinate them—beings of fire and vacuum, the opposite of 
everything Aquari. Despite their differences, the two species have developed 
a strong diplomatic relationship based on mutual wonder. The Terrax, with 
their desert homeworld and rigid hierarchies, are nearly incomprehensible 
to Aquari minds. Communication is possible but genuine understanding is rare.`
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
cannot sense. When asked directly about their origins, Umbral typically respond: 
"We came from where we're going. We're going to where we came from."`,
                    
                    history: `The Umbral have no recorded history in any conventional sense. They 
provide contradictory accounts of past events, sometimes claiming to have witnessed 
things that haven't happened yet. Scholars who have studied them extensively 
suggest three possibilities:

First, the Umbral experience time non-linearly and genuinely cannot provide a 
coherent chronological narrative. Second, they deliberately obscure their history 
to maintain mystery and psychological advantage. Third, they truly have no 
history—they exist in a permanent present, their "past" merely a reflection of 
their current state.

The only consistent element in Umbral accounts is "The Sundering"—an event they 
describe as both their birth and their death, somehow occurring simultaneously 
at the beginning and end of time. They speak of being "whole once" and "becoming 
whole again," though what this means is unclear.

Other species have documented Umbral appearances throughout their own histories, 
often at significant moments. The Velthari Memory Shards contain records of 
Umbral visiting them during the Andromeda Extinction. The Mechani have logs of 
Umbral observing the Progenitors' final war. Whether they were there or simply 
claim to have been is impossible to verify.`,
                    
                    biology: `The Umbral appear to be beings of partially solidified darkness—shadows 
given form and purpose. Their "bodies" absorb light rather than reflecting it, 
making them appear as voids in the shape of tall, thin humanoids. Their features 
are indistinct, constantly shifting between almost-visible expressions.

Whether Umbral are truly physical is debated. They can interact with matter, 
pick up objects, operate technology. But they also pass through solid walls, 
appear in sealed rooms, and demonstrate abilities that suggest they exist at 
least partially in dimensions other species cannot perceive.

Umbral do not appear to eat, sleep, or reproduce in any observable way. New 
Umbral occasionally appear, and sometimes Umbral vanish permanently, but no 
one has witnessed these processes. When asked about reproduction, Umbral 
typically answer: "We are becoming ourselves. We have always been becoming 
ourselves."

Some theorists believe Umbral are projections from a higher dimension, their 
three-dimensional forms merely cross-sections of more complex entities. Others 
suggest they are living holes in reality—absences given agency.`,
                    
                    culture: `Umbral society defies easy description. They seem to have no 
government yet act in perfect coordination. They have no visible economy yet 
possess advanced technology. They appear and disappear at will, leading to 
rumors that they are not truly physical beings at all.

What passes for Umbral art is disturbing to most species. They create 
"shadow sculptures"—spaces where light refuses to exist regardless of how 
many sources illuminate them. They compose "silence music"—patterns of 
non-sound that somehow convey meaning. Their architecture, rarely seen by 
outsiders, is described as "spaces that don't connect right."`,
                    
                    philosophy: `"You see shadows because you face the light. We see light 
because we face the shadows. Both perspectives are equally valid. 
Neither is complete." - Umbral Teaching

The Umbral believe that reality is a balance between what is and what is not—that 
shadows are as real as the objects that cast them. They see themselves as 
ambassadors of absence, representatives of the void that makes existence possible. 
Without darkness, they argue, there would be no contrast—nothing could be 
distinguished from anything else.`,
                    
                    legends: `The Umbral Archive: Somewhere, supposedly, exists a place where the 
Umbral store everything that has been forgotten by every other species. Lost 
histories, dead languages, extinct technologies—all preserved in darkness. 
Many have sought this Archive. None have found it. The Umbral neither confirm 
nor deny its existence.

The Reconciliation: The Umbral speak of a future event when the Sundering 
will be reversed and they will become whole again. Some interpret this as 
their collective death. Others see it as ascension. The Umbral themselves 
seem to view it with neither hope nor fear, merely acceptance.

The Watcher at the Threshold: One Umbral is said to stand at the boundary 
between existence and non-existence, preventing things from entering or 
leaving reality. Whether this is a specific individual, a rotating duty, 
or a metaphor for the Umbral collectively is unknown. Some species blame 
them for keeping deceased loved ones from returning.`,
                    
                    relations: `Other species find the Umbral unsettling. They speak in riddles, 
appear without warning, and seem to know things they shouldn't. Yet they have 
never been observed acting with malice. They are potential allies but 
difficult to understand or trust.

The Voidborn are the only species the Umbral treat with something approaching 
wariness. When asked about this, Umbral responses are uncharacteristically 
direct: "They are not shadows. They are the absence of everything, including 
absence itself." The Celesti find the Umbral frustrating—beings who seem 
to possess great wisdom but refuse to share it clearly.`
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
who is only strong is considered incomplete, as is one who is only wise. Their 
homeworld, Terrak Prime, has triple suns and no permanent water—survival itself 
was the first proving ground.`,
                    
                    history: `The Terrax measure history in "Reigns"—periods defined by the 
Blade-Sage who united the species. The current era is the Reign of Kaldrex 
the Contemplative, a philosopher-warrior who achieved dominance through an 
unprecedented seven consecutive victories in the Grand Proving.

The "Age of Division" saw the Terrax split into hundreds of competing 
clan-states, each believing their interpretation of the Terrax Way was 
correct. This era lasted forty thousand years and ended only when the 
First Blade-Sage, Vorrath the Unifier, defeated every other champion in 
both combat and philosophical debate over a campaign lasting three centuries.

The "Star Reach" was the Terrax expansion into space. Unlike species who 
explored from curiosity, the Terrax expanded to find worthy opponents. 
Their first contact with aliens—the peaceful Celesti—was nearly catastrophic. 
The Terrax interpreted Celesti diplomatic overtures as cowardice and attacked. 
Only when the Celesti demonstrated that refusing to fight required more 
courage than fighting did the Terrax recognize them as worthy of respect.

The "Shame of Kesrith" is the darkest chapter in Terrax history. A Blade-Sage 
named Kesrith broke his sworn word to win a war, poisoning enemy water 
supplies after promising single combat. The victory was total. Kesrith was 
immediately executed by his own honor guard. The Terrax rebuilt their enemies' 
civilization from scratch as penance, a process taking eight hundred years.`,
                    
                    biology: `The Terrax are reptilian beings evolved for desert extremes. Their 
scaled skin is heat-reflective during the day and heat-retentive at night. 
They can survive weeks without water by entering a semi-hibernation state. 
Their blood is copper-based, giving them a green coloration that darkens 
with age and experience.

Terrax are born in clutches of six to twelve eggs, but typically only two 
or three survive infancy. This is not neglect—Terrax culture believes that 
early struggle produces stronger individuals. Those who survive the crèche 
are considered to have passed their first proving.

They live approximately 300 standard years. Physical decline begins around 
200, but mental acuity typically increases throughout life. The most revered 
Terrax are often elderly Blade-Sages who can no longer fight physically but 
can defeat any opponent intellectually. The greatest honor is to die in 
combat at an age when you can still choose the manner of your death.

Terrax never stop growing. The oldest specimens reach heights of four meters. 
Their regeneration capabilities are formidable—lost limbs regrow over decades, 
though the new limbs are always slightly weaker than the originals.`,
                    
                    culture: `Every Terrax undergoes "The Proving"—a lifelong series of challenges 
in both combat and scholarship. Status comes from demonstrated excellence, not 
birth. Their leaders are called "Blade-Sages," expected to defeat any challenger 
in either debate or duel. This creates a meritocracy that is harsh but fair.

Art among the Terrax takes two forms: weapons and philosophy. Their smiths 
produce blades of exceptional quality, each incorporating mathematical 
principles that make them both beautiful and deadly. Their philosophers 
produce treatises that are meant to be "wielded" in debate like weapons.

Honor is everything. A Terrax who breaks their word loses all social standing 
and becomes an "Oathless"—a living ghost that other Terrax are forbidden to 
acknowledge. Most Oathless walk into the desert and never return.`,
                    
                    philosophy: `"The sword that cannot think will break. The mind that cannot 
fight will be broken. Only together are they unbreakable." - Terrax Way

The Terrax believe that all consciousness exists to be tested. Without 
challenge, there is no growth. Without growth, there is no purpose. They 
see conflict not as a failure of diplomacy but as the natural state of 
a meaningful universe. Peace is merely the preparation for the next test.`,
                    
                    legends: `The Perfect Blade: Legend speaks of a weapon forged by the 
First Blade-Sage, so perfectly balanced between physical and philosophical 
power that wielding it grants instant mastery of both. Many have sought 
it. Many have died. Some believe the Blade is metaphorical—the "perfect 
weapon" is perfect understanding.

The Coward Who Saved the World: A heretical legend tells of a Terrax who 
refused to fight, hiding from every challenge for their entire life. When 
an apocalyptic threat emerged, this coward alone survived to rebuild the 
species because they had never made enemies. Most Terrax consider this 
story obscene. Some whisper it might contain hidden wisdom.

The Final Proving: Prophecy states that one day a challenge will emerge 
that the Terrax cannot overcome through strength or wisdom alone. This 
will be the test that defines them—forcing them to grow beyond the 
Terrax Way or perish as a species.`,
                    
                    relations: `The Terrax respect strength in all its forms. They disdain weakness 
but admire courage, even in enemies. They make loyal allies and honorable 
opponents, always keeping their word even when it disadvantages them.

The Mechani confuse them—strength without the will to use it seems 
paradoxical. The Krath disturb them; a species where most individuals 
have no independent identity seems like the ultimate weakness. The 
Celesti they respect grudgingly—refusing violence while remaining 
unbroken requires a strength the Terrax can appreciate.`
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
in between. The Celesti themselves admit they no longer remember their 
original form, only the "Long Ascension" that transformed them.`,
                    
                    history: `The Celesti claim a history spanning billions of years, though 
independent verification is impossible. They speak of the "First Age" when 
they were mortal beings on a forgotten world, struggling with the same 
conflicts that plague young species. They speak of the "Crisis of Division" 
when their species nearly destroyed itself in civil war. And they speak of 
the "Awakening" when a collective realization transformed them into what 
they are today.

The Celesti do not conquer worlds—they "guide" them. Throughout galactic 
history, they have appeared during crises to offer wisdom. Sometimes this 
wisdom is accepted. Sometimes it is rejected. The Celesti claim their 
success rate is 73.2%, meaning they have helped nearly three-quarters of 
the civilizations they've contacted. Critics note they only count civilizations 
that survived long enough to provide feedback.

The "Silence" was a period of 10,000 years when the Celesti withdrew from 
galactic affairs entirely. They have never explained why. When they returned, 
they seemed subtly changed—less certain, more willing to admit their own 
limitations. Some species wonder what happened during the Silence. The 
Celesti say only: "We learned that even teachers must learn."`,
                    
                    biology: `The Celesti appear as luminous humanoid figures, their forms 
suggesting but not quite defining features. They emit a soft glow visible 
even in bright light. Whether this is their true appearance or a 
projection for the benefit of other species is unknown.

They seem to require no food, water, or sleep. They demonstrate no signs 
of aging. When asked about their physical needs, they typically respond 
that they "sustain themselves on different energies"—which has been 
interpreted as everything from photosynthesis to mysticism to deliberate 
evasion.

Celesti reproduction, if it occurs, has never been observed. New Celesti 
simply appear, introduced as "newly manifested." Whether they are born, 
created, or simply reveal themselves when ready is unknown. The Celesti 
consider questions about reproduction impolite, which only increases 
speculation.

They can be killed—demonstrated unfortunately often by species who 
resented their interference. When a Celesti dies, their body dissolves 
into light particles that dissipate over several hours. Other Celesti 
claim they can "hear" these particles and that death is "merely a 
transition" rather than an ending.`,
                    
                    culture: `Celesti society is devoted to what they call "The Harmony"—a state of 
perfect balance between all things. They see conflict as a failure to 
achieve understanding and seek to resolve disputes through wisdom rather 
than force. This sometimes makes them seem naive or condescending.

They have no visible government, economy, or hierarchy. Decisions appear 
to emerge organically from consensus. Resources appear without apparent 
production. Leadership rotates based on expertise relevant to current 
challenges. Whether this represents genuine post-scarcity enlightenment 
or simply careful concealment of their true structure is debated.

Celesti art is difficult for other species to appreciate. They create 
"harmonic sculptures"—arrangements of energy and matter that produce 
emotional effects in observers. These effects vary by species and 
individual, suggesting the Celesti somehow encode experiences that 
translate across different cognitive architectures.`,
                    
                    philosophy: `"Every discord can become harmony. Every enemy can become friend. 
Every darkness can become light. We need only find the way." - Celesti Belief

The Celesti believe that the universe tends toward balance and that 
suffering results from temporary imbalances that can always be corrected. 
They see their role as helping other species find the Harmony, not 
imposing it upon them. This distinction is important to them, if not 
always apparent to those they "help."`,
                    
                    legends: `The First Celesti: Legend speaks of the individual who first 
achieved Ascension—transforming from their original mortal form into 
the luminous state all Celesti now share. This being, called "The 
Opener," is said to have demonstrated that the transition was possible 
and then spent millennia helping others follow. Whether the Opener 
still exists is unknown.

The Fallen Celesti: Heretical stories speak of Celesti who became 
convinced that forced enlightenment was preferable to patient guidance. 
These "Darkened Ones" supposedly still exist, working to impose Harmony 
through means the mainstream Celesti consider unacceptable. The Celesti 
officially deny these stories but refuse to discuss them in detail.

The Final Harmony: Prophecy states that one day all consciousness in 
the universe will achieve Harmony simultaneously, ending all conflict 
forever. The Celesti work toward this goal while acknowledging it may 
be billions of years away—or may never be achieved at all.`,
                    
                    relations: `The Celesti want to help everyone, whether they want help or not. 
They are genuinely benevolent but can be insufferably superior about it. 
Other species find them useful allies but exhausting company.

The Terrax challenged them to prove their worth through combat. When 
the Celesti refused but stood their ground without fear, the Terrax 
gained grudging respect. The Voidborn disturb them deeply—beings 
apparently beyond the concept of Harmony. The Velthari they treat as 
honored elders, recognizing their ancient wisdom.`
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
another reality entirely is unknown. They do not speak of their origins. When 
asked, they simply regard the questioner with what might be patience, might be 
pity, might be hunger. No one is certain.`,
                    
                    history: `The Voidborn have no history that other species can discern. They 
have been observed for as long as records exist, always in the same way—
appearing in the spaces between things, watching, rarely speaking, never 
explaining.

Every major civilization has records of Voidborn encounters. The Velthari 
Memory Shards contain images of Voidborn observing the Andromeda Extinction 
from the intergalactic void. The Mechani have logs of Voidborn appearing 
moments before the Progenitors' final war began. The Celesti admit to 
having "conversed" with Voidborn during their Silence, though they refuse 
to share what was discussed.

What makes these observations disturbing is their consistency. The Voidborn 
appear during significant events—wars, extinctions, ascensions, collapses—
but never intervene. They watch civilizations die. They watch civilizations 
rise. They offer no help and cause no harm. Some theorists believe they are 
collectors—gathering experiences, memories, or something less comprehensible. 
Others suggest they are merely observers, consciousness arising naturally 
in the void with no more purpose than any other natural phenomenon.

The only known instance of Voidborn intervention occurred 7 million years 
ago, according to fragmentary records. A species called the Krell reportedly 
attacked a Voidborn. No trace of the Krell has ever been found. Whether the 
Voidborn destroyed them, whether they fled, or whether the Krell ever existed 
at all is unknown.`,
                    
                    biology: `The Voidborn have no biology in any conventional sense. They appear 
as silhouettes of absence—spaces where reality seems thinner, where light 
bends wrong, where the background seems to be leaking through them. Their 
"bodies" are roughly humanoid but constantly shifting, as if they are 
suggestions of form rather than actual shapes.

Sensors cannot detect them consistently. Sometimes they register as 
gravitational anomalies. Sometimes as negative temperature zones. Sometimes 
they don't register at all despite being clearly visible. Their mass, if 
they have any, has never been measured. They cast no shadows—or perhaps 
they ARE shadows that somehow exist without an object to cast them.

They can interact with physical matter when they choose to. They can speak, 
though their voices seem to come from everywhere and nowhere. They can pick 
up objects, though observers report that items touched by Voidborn feel 
"wrong" afterward—slightly colder, slightly emptier, as if some quality 
has been subtracted.

Whether Voidborn are individuals or aspects of a single entity is unknown. 
They never refer to themselves in the singular or plural. They never use 
names. When asked, they typically respond: "We are. We are not. The 
distinction matters less than you believe."`,
                    
                    culture: `Voidborn society, if it can be called that, operates on principles 
that defy conventional understanding. They seem to have no individual identity, 
yet each Voidborn is distinct. They have no visible technology, yet they 
travel between stars. They do not communicate in any known way, yet they 
clearly understand other species.

If they have art, economies, politics, or social structures, no one has 
ever observed them. They simply appear, observe, occasionally speak in 
cryptic statements, and vanish. Some theorists suggest their entire 
existence is art—that they are observing the universe as an aesthetic 
experience.`,
                    
                    philosophy: `"We are the silence between words. We are the darkness between 
stars. We are what remains when everything else is gone. We are patient."

The Voidborn speak rarely, but when they do, their statements share 
common themes: patience, emptiness, and waiting. They seem to view 
existence as temporary—not in the depressing sense that everything 
dies, but in the patient sense that everything will eventually return 
to the void from which it came. They do not seem to see this as 
tragedy. They see it as completion.`,
                    
                    legends: `The Last Observer: A legend (origins unknown) speaks of a time 
when all matter in the universe will have decayed, all stars burned 
out, all black holes evaporated. In that final emptiness, a single 
Voidborn will remain—the ultimate observer, watching nothing forever. 
Some versions of this legend suggest this Voidborn already exists, 
that all current Voidborn are its echoes sent backward through time.

The Invitation: Some mystics claim that the Voidborn are waiting for 
other species to "join" them—to let go of matter, of form, of identity, 
and become part of the eternal emptiness. These mystics often vanish 
mysteriously. Whether they achieve their goal or meet a darker fate 
is unknown.

The Hunger: The darkest legends suggest the Voidborn are not passive 
observers but patient predators. They watch civilizations the way a 
hunter watches prey—learning patterns, waiting for weakness. What 
they "eat" is not flesh but something more fundamental: meaning, 
purpose, or the coherence that makes existence possible. These 
legends are officially dismissed as fear-mongering. They persist 
nonetheless.`,
                    
                    relations: `Most species find the Voidborn deeply unsettling. Their presence 
causes unease, their motives are opaque, and their methods are incomprehensible. 
Yet they have never initiated hostilities. They simply... watch. And wait.

The Umbral alone seem to interact with Voidborn without fear, though 
even they express caution. The Celesti have attempted dialogue for 
millennia with little success. The Pyronix find them terrifying—
beings of pure absence, the antithesis of flame. The Velthari 
remember seeing them during the Andromeda Extinction and wonder 
what the Voidborn learned from watching a galaxy die.`
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
