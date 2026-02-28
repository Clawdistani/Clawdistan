import { Universe } from './universe.js';
import { Empire, EMPIRE_BALANCE } from './empire.js';
import { ResourceManager } from './resources.js';
import { EntityManager } from './entities.js';
import { CombatSystem } from './combat.js';
import { TechTree } from './tech.js';
import { DiplomacySystem } from './diplomacy.js';
import { VictoryChecker } from './victory.js';
import { FleetManager } from './fleet.js';
import { StarbaseManager } from './starbase.js';
import { SpeciesManager } from './species.js';
import { TradeManager } from './trade.js';
import { AnomalyManager } from './anomaly.js';
import { CalamityManager } from './calamity.js';
import { EspionageManager } from './espionage.js';
import { RelicManager } from './relics.js';
import { GalacticCouncil } from './council.js';
import { CrisisManager } from './crisis.js';
import { CycleManager, CYCLE_TYPES } from './cycles.js';
import { EntityCleanup, serializeEntityLight, TickBudgetMonitor, ENTITY_LIMITS } from './performance.js';
import { ShipDesigner } from './ship-designer.js';
import { BuildingModuleManager } from './building-modules.js';
import * as TickProcessors from './tick-processors.js';

// ═══════════════════════════════════════════════════════════════════════════════
// PLANET SPECIALIZATION - Strategic planet designations
// ═══════════════════════════════════════════════════════════════════════════════
export const PLANET_SPECIALIZATIONS = {
    forge_world: {
        name: 'Forge World',
        icon: '⚒️',
        description: 'Industrial powerhouse focused on mineral extraction and manufacturing',
        bonuses: { minerals: 0.5 },  // +50% mineral production
        cost: { minerals: 200, energy: 100 },
        requiredTech: null
    },
    agri_world: {
        name: 'Agri-World',
        icon: '🌾',
        description: 'Agricultural breadbasket providing food for the empire',
        bonuses: { food: 0.5, populationGrowth: 0.25 },  // +50% food, +25% pop growth
        cost: { minerals: 150, food: 100 },
        requiredTech: null
    },
    research_world: {
        name: 'Research World',
        icon: '🔬',
        description: 'Scientific hub dedicated to advancing technology',
        bonuses: { research: 0.5 },  // +50% research production
        cost: { minerals: 200, energy: 150, research: 50 },
        requiredTech: 'advanced_research'
    },
    energy_world: {
        name: 'Energy World',
        icon: '⚡',
        description: 'Power generation center fueling the empire',
        bonuses: { energy: 0.5 },  // +50% energy production
        cost: { minerals: 150, energy: 50 },
        requiredTech: null
    },
    fortress_world: {
        name: 'Fortress World',
        icon: '🏰',
        description: 'Heavily fortified defensive stronghold',
        bonuses: { defense: 0.5, structureHP: 0.25 },  // +50% defense, +25% structure HP
        cost: { minerals: 300, energy: 150 },
        requiredTech: 'planetary_fortifications'
    },
    trade_hub: {
        name: 'Trade Hub',
        icon: '💰',
        description: 'Commercial center boosting trade income',
        bonuses: { credits: 0.5, tradeIncome: 0.25 },  // +50% credits, +25% trade income
        cost: { minerals: 200, credits: 300 },
        requiredTech: 'interstellar_commerce'
    },
    ecumenopolis: {
        name: 'Ecumenopolis',
        icon: '🏙️',
        description: 'Planet-spanning city with massive population capacity',
        bonuses: { populationCap: 1.0, allProduction: 0.25 },  // +100% pop cap, +25% all production
        cost: { minerals: 500, energy: 300, credits: 500 },
        requiredTech: 'arcology_project'
    }
};

export class GameEngine {
    constructor() {
        this.tick_count = 0;
        this.universe = new Universe();
        this.empires = new Map();
        this.resourceManager = new ResourceManager();
        this.entityManager = new EntityManager();
        this.combatSystem = new CombatSystem();
        this.techTree = new TechTree();
        this.diplomacy = new DiplomacySystem();
        this.victoryChecker = new VictoryChecker();
        this.fleetManager = new FleetManager(this.universe, this.entityManager);
        this.starbaseManager = new StarbaseManager(this.universe);
        this.speciesManager = new SpeciesManager();
        this.tradeManager = new TradeManager(this.universe, this.starbaseManager);
        this.anomalyManager = new AnomalyManager();
        this.calamityManager = new CalamityManager();
        this.espionageManager = new EspionageManager();
        this.relicManager = new RelicManager();
        this.council = new GalacticCouncil();
        this.crisisManager = new CrisisManager();
        this.cycleManager = new CycleManager();
        this.shipDesigner = new ShipDesigner();
        this.buildingModules = new BuildingModuleManager();
        this.eventLog = [];
        this.pendingAnomalies = []; // Anomalies discovered this tick (for broadcasting)
        this.pendingEspionageEvents = []; // Espionage events this tick
        this.pendingCouncilEvents = []; // Council events this tick
        this.pendingCrisisEvents = []; // Crisis events this tick
        this.pendingCycleEvents = []; // Cycle events this tick
        this.paused = false;
        this.speed = 1;

        // Delta tracking for bandwidth optimization
        this.changeLog = [];           // Track all changes
        this.lastSnapshotTick = 0;     // Last full state snapshot tick
        this.SNAPSHOT_INTERVAL = 300;  // Full snapshot every 300 ticks (5 min buffer)

        // Performance monitoring - tick budget and entity limits
        this.tickBudgetMonitor = new TickBudgetMonitor();

        // Initialize default empires
        this.initializeGame();
    }

    // Record a change for delta updates
    recordChange(type, data) {
        this.changeLog.push({
            tick: this.tick_count,
            type,
            data,
            timestamp: Date.now()
        });
        // Keep only last 200 changes to prevent memory bloat
        if (this.changeLog.length > 500) {
            this.changeLog = this.changeLog.slice(-400);
        }
    }

    initializeGame() {
        // Generate the universe
        this.universe.generate();

        // Create starting empires at different locations
        const startingPlanets = this.universe.getStartingPlanets(4);
        const empireColors = ['#ff4444', '#44ff44', '#4444ff', '#ffff44'];
        const empireNames = ['Crimson Dominion', 'Emerald Collective', 'Azure Federation', 'Golden Empire'];
        
        // Assign different species to starting empires
        const startingSpecies = ['synthari', 'velthari', 'krath', 'mechani'];

        startingPlanets.forEach((planet, index) => {
            const empire = new Empire({
                id: `empire_${index}`,
                name: empireNames[index],
                color: empireColors[index],
                homePlanet: planet.id,
                speciesId: startingSpecies[index],
                spawnTick: 0  // Starting empires spawn at tick 0
            });

            this.empires.set(empire.id, empire);
            planet.owner = empire.id;

            // Give starting resources
            this.resourceManager.initializeEmpire(empire.id);
            
            // Initialize relic tracking
            this.relicManager.initializeEmpire(empire.id);

            // Create starting units
            this.entityManager.createStartingUnits(empire.id, planet);
        });

        // Initialize galactic cycles
        this.cycleManager.initialize(this.tick_count);

        this.log('game', 'Universe initialized with ' + this.empires.size + ' empires');
    }

    /**
     * Create a new empire dynamically (for new players joining)
     * Returns the new empire ID or null if no suitable planet found
     */
    createNewEmpire(name = null) {
        const empireIndex = this.empires.size;
        const empireId = `empire_${empireIndex}`;
        
        // Generate a random color
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96e6a1', '#dda0dd', 
                        '#f0e68c', '#87ceeb', '#ffa07a', '#98d8c8', '#c9b1ff',
                        '#ff9999', '#99ccff', '#ffcc99', '#99ff99', '#ff99cc',
                        '#cc99ff', '#99ffcc', '#ffff99', '#ff6699', '#66ff99'];
        const color = colors[empireIndex % colors.length];
        
        // Generate a name if not provided
        const defaultNames = ['Nova Imperium', 'Void Collective', 'Star Kingdom', 'Nebula Empire',
                              'Cosmic Union', 'Galactic Order', 'Astral Dominion', 'Stellar Republic',
                              'Dark Hegemony', 'Light Confederacy', 'Iron Alliance', 'Crystal Dynasty',
                              'Thunder Legion', 'Shadow Covenant', 'Flame Sovereignty', 'Frost Empire',
                              'Storm Dominion', 'Eclipse Order', 'Solar Throne', 'Lunar Kingdom'];
        const empireName = name || defaultNames[empireIndex % defaultNames.length];
        
        // Find an unclaimed planet for home world - MUST have buildable terrain
        let unclaimedPlanets = this.universe.planets.filter(p => !p.owner);
        if (unclaimedPlanets.length === 0) {
            console.log(`⚠️ Cannot create empire - no unclaimed planets available`);
            return null;
        }
        
        // Prefer planets with buildable terrain (plains, sand, ice, lava, mountain)
        let buildablePlanets = unclaimedPlanets.filter(p => this.universe.hasBuildableTerrain(p));
        
        // If no naturally buildable planets, fix some
        if (buildablePlanets.length === 0) {
            console.log(`   🔧 No buildable planets available, fixing terrain...`);
            for (const planet of unclaimedPlanets) {
                this.universe.ensureBuildableTerrain(planet);
                if (this.universe.hasBuildableTerrain(planet)) {
                    buildablePlanets.push(planet);
                    break;  // Just need one
                }
            }
        }
        
        // Final fallback - take any unclaimed and fix it
        if (buildablePlanets.length === 0) {
            const planet = unclaimedPlanets[0];
            this.universe.ensureBuildableTerrain(planet);
            buildablePlanets.push(planet);
        }
        
        // Pick a planet (prefer ones far from other empires)
        const homePlanet = buildablePlanets[Math.floor(Math.random() * buildablePlanets.length)];
        
        // Pick a random species (must match species defined in species.js!)
        const speciesList = ['synthari', 'velthari', 'krath', 'mechani', 'pyronix', 
                            'aquari', 'umbral', 'terrax', 'celesti', 'voidborn'];
        const speciesId = speciesList[empireIndex % speciesList.length];
        
        // Create the empire
        const empire = new Empire({
            id: empireId,
            name: empireName,
            color: color,
            homePlanet: homePlanet.id,
            speciesId: speciesId,
            spawnTick: this.tick_count  // Track spawn time for early game protection
        });
        
        this.empires.set(empire.id, empire);
        homePlanet.owner = empire.id;
        
        // Give starting resources
        this.resourceManager.initializeEmpire(empire.id);
        
        // Initialize relic tracking
        this.relicManager.initializeEmpire(empire.id);
        
        // Create starting units
        this.entityManager.createStartingUnits(empire.id, homePlanet);
        
        // Create default ship blueprints for the new empire
        this.shipDesigner.createDefaultBlueprints(empireId);
        
        console.log(`🏛️ New empire created: ${empireName} (${empireId}) on ${homePlanet.name}`);
        this.log('game', `New empire rises: ${empireName}`);
        
        return empireId;
    }

    /**
     * Check for eliminated empires that can respawn
     * Gives them a new homeworld and basic resources
     */
    checkRespawns() {
        const respawned = [];
        
        for (const [empireId, empire] of this.empires) {
            if (!empire.canRespawn(this.tick_count)) continue;
            
            // Find an unclaimed planet for respawn
            let unclaimedPlanets = this.universe.planets.filter(p => !p.owner);

            // BALANCE FIX: If no unclaimed planets, force-release from largest empire
            if (unclaimedPlanets.length === 0) {
                const released = this.forceReleasePlanetForRespawn(empireId);
                if (released) {
                    unclaimedPlanets = [released];
                    console.log(`🔓 Force-released ${released.name} to allow respawn`);
                } else {
                    console.log(`⚠️ Cannot respawn ${empire.name} - no planets available`);
                    continue;
                }
            }
            
            // Prefer planets far from current empires (give them space)
            let bestPlanet = null;
            let bestDistance = 0;
            
            // Get positions of all owned planets
            const ownedPlanets = this.universe.planets.filter(p => p.owner && p.owner !== empireId);
            
            for (const planet of unclaimedPlanets) {
                // Ensure planet has buildable terrain
                if (!this.universe.hasBuildableTerrain(planet)) {
                    this.universe.ensureBuildableTerrain(planet);
                }
                
                // Calculate minimum distance to any owned planet
                let minDist = Infinity;
                for (const owned of ownedPlanets) {
                    const dx = (planet.x || 0) - (owned.x || 0);
                    const dy = (planet.y || 0) - (owned.y || 0);
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    minDist = Math.min(minDist, dist);
                }
                
                if (minDist > bestDistance) {
                    bestDistance = minDist;
                    bestPlanet = planet;
                }
            }
            
            // Fallback to random if no distance calculation worked
            if (!bestPlanet) {
                bestPlanet = unclaimedPlanets[Math.floor(Math.random() * unclaimedPlanets.length)];
                this.universe.ensureBuildableTerrain(bestPlanet);
            }
            
            // Respawn the empire
            empire.respawn(bestPlanet.id, this.tick_count);
            bestPlanet.owner = empireId;
            
            // Give reduced starting resources
            this.resourceManager.setResources(empireId, { 
                ...EMPIRE_BALANCE.RESPAWN_RESOURCES, 
                research: 0, 
                credits: 0 
            });
            
            // Create minimal starting units (fewer than normal)
            this.entityManager.createStartingUnits(empireId, bestPlanet, true); // true = minimal units
            
            console.log(`🔄 ${empire.name} respawned at ${bestPlanet.name} (respawn ${empire.respawnCount}/3)`);
            
            respawned.push({
                empireId,
                empireName: empire.name,
                planetId: bestPlanet.id,
                planetName: bestPlanet.name,
                respawnCount: empire.respawnCount
            });
            
            this.recordChange('respawn', { empireId, planetId: bestPlanet.id });
        }
        
        return respawned;
    }


    /**
     * Force-release a planet from the largest empire to allow respawn
     * Only called when all planets are owned and an empire needs to respawn
     * @param {string} respawningEmpireId - The empire trying to respawn (excluded from release)
     * @returns {Object|null} The released planet, or null if none available
     */
    forceReleasePlanetForRespawn(respawningEmpireId) {
        // Find empire with most planets (excluding the one respawning)
        let largestEmpireId = null;
        let maxPlanets = 1; // Need at least 2 planets to release one
        
        for (const [empireId, empire] of this.empires) {
            if (empireId === respawningEmpireId || empire.defeated) continue;
            const planetCount = this.universe.getPlanetsOwnedBy(empireId).length;
            if (planetCount > maxPlanets) {
                maxPlanets = planetCount;
                largestEmpireId = empireId;
            }
        }
        
        if (!largestEmpireId) {
            console.log(`⚠️ No empire has >1 planet to release`);
            return null;
        }
        
        // Find the most distant planet from their home (least valuable)
        const largestEmpire = this.empires.get(largestEmpireId);
        const empirePlanets = this.universe.getPlanetsOwnedBy(largestEmpireId);
        const homePlanet = this.universe.planets.find(p => p.id === largestEmpire.homePlanet);
        
        let furthestPlanet = null;
        let maxDistance = -1;
        
        for (const planet of empirePlanets) {
            // Never release home planet
            if (planet.id === largestEmpire.homePlanet) continue;
            
            // Calculate distance from home
            const dx = (planet.x || 0) - (homePlanet?.x || 0);
            const dy = (planet.y || 0) - (homePlanet?.y || 0);
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist > maxDistance) {
                maxDistance = dist;
                furthestPlanet = planet;
            }
        }
        
        if (!furthestPlanet) {
            // Fallback: take any non-home planet
            furthestPlanet = empirePlanets.find(p => p.id !== largestEmpire.homePlanet);
        }
        
        if (furthestPlanet) {
            // Remove ownership and any entities
            furthestPlanet.owner = null;
            
            // Remove all entities on this planet (they belonged to the empire)
            const planetEntities = this.entityManager.getEntitiesAtLocation(furthestPlanet.id);
            for (const entity of planetEntities) {
                this.entityManager.removeEntity(entity.id);
            }
            
            console.log(`🔓 Released ${furthestPlanet.name} from ${largestEmpire.name} (had ${maxPlanets} planets)`);
            this.recordChange(`forceRelease`, { planetId: furthestPlanet.id, fromEmpireId: largestEmpireId });
            
            return furthestPlanet;
        }
        
        return null;
    }

    tick() {
        if (this.paused) return;

        const tickStart = Date.now();
        this.tick_count++;
        
        // Get tick budget recommendations based on recent performance
        const budgetStatus = this.tickBudgetMonitor.panicMode ? 
            { panicMode: true, skipHeavyOps: true, shouldCleanup: this.tick_count % TICK_BUDGET.PANIC_CLEANUP_FREQ === 0 } : 
            { panicMode: false, skipHeavyOps: false, shouldCleanup: false };
        
        // Performance: Only run heavy operations every N ticks (unless in panic mode)
        const isHeavyTick = !budgetStatus.skipHeavyOps && (this.tick_count % 5 === 0);
        const isCleanupTick = this.tick_count % 60 === 0 || budgetStatus.shouldCleanup;
        
        // Entity limit checks - run more frequently when count is high
        const entityCount = this.entityManager.entities.size;
        const needsAggressiveCleanup = entityCount > ENTITY_LIMITS.SOFT_CAP;
        const needsHardLimitEnforcement = entityCount > ENTITY_LIMITS.HARD_CAP;
        
        // Log warnings for high entity counts
        if (entityCount > ENTITY_LIMITS.WARNING_THRESHOLD && this.tick_count % 30 === 0) {
            console.warn(`⚠️ High entity count: ${entityCount}/${ENTITY_LIMITS.HARD_CAP} (soft cap: ${ENTITY_LIMITS.SOFT_CAP})`);
        }
        
        // Run cleanup based on urgency
        if (needsHardLimitEnforcement) {
            // CRITICAL: Over hard cap - full cleanup every tick
            const cleaned = EntityCleanup.fullCleanup(this.entityManager, this.universe, this.empires);
            if (cleaned > 0) {
                this.recordChange('cleanup', { removed: cleaned, reason: 'hard_limit' });
            }
        } else if (needsAggressiveCleanup && (isCleanupTick || this.tick_count % 15 === 0)) {
            // HIGH: Over soft cap - aggressive cleanup every 15 ticks
            const cleaned = EntityCleanup.aggressiveCleanup(this.entityManager, this.universe, this.empires);
            if (cleaned > 0) {
                this.recordChange('cleanup', { removed: cleaned, reason: 'soft_limit' });
            }
        } else if (isCleanupTick) {
            // NORMAL: Standard cleanup every 60 ticks (or panic mode frequency)
            const cleaned = EntityCleanup.cleanup(this.entityManager, this.universe, this.empires);
            if (cleaned > 0) {
                this.recordChange('cleanup', { removed: cleaned });
            }
        }

        // Update planetary orbits (orbital mechanics)
        this.universe.updateOrbits(1); // 1 second per tick

        // Resource generation (with species + relic + cycle + fleet upkeep modifiers)
        this.empires.forEach((empire, id) => {
            this.resourceManager.generateResources(
                id, 
                this.universe, 
                this.entityManager,
                this.speciesManager,
                empire.speciesId,
                this.relicManager,
                this.cycleManager,
                this.fleetManager,
                this.techTree,
                this.empires  // Pass empires to check score leader for underdog bonus
            );
        });

        // Entity updates (movement, construction, etc.)
        this.entityManager.update(this.tick_count);

        // Starbase construction/upgrade processing
        const starbaseEvents = this.starbaseManager.tick(this.tick_count);
        for (const event of starbaseEvents) {
            const empire = this.empires.get(event.starbase.owner);
            if (event.type === 'constructed') {
                this.log('starbase', `${empire?.name || 'Unknown'}: ${event.message}`);
            } else if (event.type === 'upgraded') {
                this.log('starbase', `${empire?.name || 'Unknown'}: ${event.message}`);
            }
        }

        // Starbase shipyard production - create completed ships
        const completedShips = this.starbaseManager.processShipConstruction(this.tick_count);
        for (const ship of completedShips) {
            const empire = this.empires.get(ship.empireId);
            const system = this.universe.getSystem(ship.systemId);
            
            // Find a planet in the system to spawn the ship at
            const planetsInSystem = this.universe.planets.filter(p => p.systemId === ship.systemId);
            const spawnPlanet = planetsInSystem.find(p => p.owner === ship.empireId) || planetsInSystem[0];
            
            if (spawnPlanet) {
                const entity = this.entityManager.createUnit(ship.shipType, ship.empireId, spawnPlanet.id);
                this.recordChange('entity', { id: entity.id });
                this.log('shipyard', `🚀 ${empire?.name || 'Unknown'}: ${ship.shipType} completed at ${ship.starbase.name}!`);
            }
        }

        // Fleet movement processing
        const arrivedFleets = this.fleetManager.tick(this.tick_count);
        this.pendingAnomalies = []; // Clear pending anomalies from last tick
        
        for (const fleet of arrivedFleets) {
            // Pass starbaseManager to detect enemy starbases
            const result = this.fleetManager.processArrival(fleet, this.combatSystem, this.starbaseManager);
            const planet = this.universe.getPlanet(fleet.destPlanetId);
            const empire = this.empires.get(fleet.empireId);
            
            // Check for anomaly discovery when entering a new system
            if (planet && empire) {
                const anomaly = this.anomalyManager.checkForAnomaly(
                    fleet.empireId, 
                    planet.systemId, 
                    fleet.id
                );
                if (anomaly) {
                    this.pendingAnomalies.push(anomaly);
                    this.log('anomaly', `${empire.name} discovered: ${anomaly.name}!`);
                }
            }
            
            // ═══════════════════════════════════════════════════════════════════
            // STARBASE COMBAT - Fleet must destroy enemy starbase first!
            // ═══════════════════════════════════════════════════════════════════
            if (result.type === 'starbase_combat') {
                const attacker = this.empires.get(fleet.empireId);
                const defender = this.empires.get(result.targetEmpireId);
                const starbase = result.starbase;
                
                if (attacker && defender && starbase) {
                    this.log('combat', `🚀 ${attacker.name} fleet engaging ${starbase.name}!`);
                    
                    // Get attacking ships
                    const attackingShips = fleet.shipIds
                        .map(id => this.entityManager.getEntity(id))
                        .filter(s => s && s.attack > 0);
                    
                    if (attackingShips.length === 0) {
                        this.log('combat', `⚠️ ${attacker.name} fleet has no combat ships - cannot engage starbase!`);
                    } else {
                        // Resolve starbase combat
                        const combatResult = this.combatSystem.resolveStarbaseCombat(
                            attackingShips,
                            starbase,
                            this.entityManager,
                            this.starbaseManager,
                            { relicManager: this.relicManager }
                        );
                        
                        // Log battle results
                        for (const logEntry of combatResult.battleLog) {
                            this.log('combat', logEntry);
                        }
                        
                        // Auto-declare war if not already
                        const relation = this.diplomacy.getRelation(fleet.empireId, result.targetEmpireId);
                        if (relation !== 'war') {
                            this.diplomacy.declareWar(fleet.empireId, result.targetEmpireId);
                            this.log('diplomacy', `${attacker.name} and ${defender.name} are now at WAR!`);
                        }
                        
                        // Track changes
                        this.recordChange('starbase', { 
                            systemId: result.targetSystemId, 
                            destroyed: combatResult.starbaseDestroyed 
                        });
                        
                        // If starbase destroyed and planet is enemy-owned, fleet can now invade
                        if (combatResult.starbaseDestroyed && planet.owner === result.targetEmpireId) {
                            this.log('combat', `⚔️ ${starbase.name} destroyed! ${attacker.name} can now invade ${planet.name}!`);
                        }
                    }
                }
            } else if (result.type === 'combat') {
                // Fleet arrived at enemy planet - trigger invasion
                const attacker = this.empires.get(fleet.empireId);
                const defender = this.empires.get(result.targetEmpireId);
                const combatPlanet = this.universe.getPlanet(result.targetPlanetId);
                
                if (attacker && defender && combatPlanet) {
                    this.log('combat', `${attacker.name} fleet arrived at ${combatPlanet.name}! Battle begins!`);
                    // Combat will be resolved in the next combat resolution phase
                }
            } else if (result.type === 'colonize') {
                // Fleet with colony ship arrived at unowned planet
                const colonizePlanet = this.universe.getPlanet(result.targetPlanetId);
                
                if (empire && colonizePlanet && !colonizePlanet.owner) {
                    colonizePlanet.owner = fleet.empireId;
                    this.log('colonization', `${empire.name} colonized ${colonizePlanet.name}!`);
                }
            } else if (result.type === 'landed') {
                // Friendly landing
                if (empire && planet) {
                    this.log('fleet', `${empire.name} fleet arrived at ${planet.name}`);
                }
            }
        }

        // Support ship repairs (heal friendly units)
        this.combatSystem.applySupportShipEffects(this.entityManager);
        
        // Terrain feature effects (radiation damage, asteroid collisions, etc.)
        this.applyTerrainEffects();

        // Combat resolution (with relic bonuses)
        const combatResults = this.combatSystem.resolveAllCombat(
            this.entityManager,
            this.universe,
            this.relicManager
        );

        combatResults.forEach(result => {
            // Build description with empire names if combatants are available
            let description = result.description;
            if (result.combatants && result.combatants.length >= 2) {
                const names = result.combatants
                    .map(id => this.empires.get(id)?.name || id)
                    .join(' vs ');
                description = `${names}: ${result.damages.length} units destroyed`;
                
                // Auto-declare war between combatants if not already at war
                for (let i = 0; i < result.combatants.length; i++) {
                    for (let j = i + 1; j < result.combatants.length; j++) {
                        const emp1 = result.combatants[i];
                        const emp2 = result.combatants[j];
                        const relation = this.diplomacy.getRelation(emp1, emp2);
                        if (relation !== 'war' && relation !== 'allied') {
                            this.diplomacy.declareWar(emp1, emp2);
                            const empire1 = this.empires.get(emp1);
                            const empire2 = this.empires.get(emp2);
                            this.log('diplomacy', `${empire1?.name || emp1} and ${empire2?.name || emp2} are now at WAR!`);
                        }
                    }
                }
            }
            this.log('combat', description);
        });

        // Trade route processing
        const tradeIncome = this.tradeManager.tick(this.tick_count, this.resourceManager);
        
        // Log pirate raids
        const activeRaids = this.tradeManager.getActiveRaids(this.tick_count);
        for (const raid of activeRaids) {
            if (raid.startTick === this.tick_count) {
                const empire = this.empires.get(raid.empireId);
                this.log('trade', `Pirates raiding ${empire?.name || 'Unknown'}'s trade route!`);
            }
        }

        // Clean up expired inter-empire trade offers
        const expiredTrades = this.diplomacy.cleanupExpiredTrades(this.tick_count);
        for (const trade of expiredTrades) {
            const fromEmpire = this.empires.get(trade.from);
            const toEmpire = this.empires.get(trade.to);
            this.log('trade', `⏰ Trade offer from ${fromEmpire?.name} to ${toEmpire?.name} expired`);
        }

        // Calamity processing - random disasters on planets (only on heavy ticks)
        if (isHeavyTick) {
            const calamityEvents = this.calamityManager.tick(
                this.tick_count,
                this.universe,
                this.entityManager,
                this.resourceManager,
                this.techTree
            );
            
            for (const event of calamityEvents) {
                const empire = this.empires.get(event.empireId);
                let msg = `${event.icon} ${event.name} struck ${event.planetName}!`;
                
                // Add loss details
                const losses = [];
                if (event.losses.population) losses.push(`${event.losses.population} died`);
                if (event.losses.structures?.length) losses.push(`${event.losses.structures.length} structures destroyed`);
                if (event.losses.food) losses.push(`${event.losses.food} food lost`);
                if (event.losses.energy) losses.push(`${event.losses.energy} energy lost`);
                
                if (losses.length > 0) {
                    msg += ` (${losses.join(', ')})`;
                }
                
                // Note any gains
                if (event.gains) {
                    const gains = Object.entries(event.gains).map(([k, v]) => `+${v} ${k}`);
                    if (gains.length > 0) msg += ` [${gains.join(', ')}]`;
                }
                
                this.log('calamity', msg);
                this.recordChange('calamity', { planetId: event.planetId, type: event.type });
            }
        }

        // Espionage processing - spy missions, detection, counter-intel (only on heavy ticks)
        this.pendingEspionageEvents = [];
        
        if (isHeavyTick) {
            // Update counter-intel levels for all empires
            for (const [empireId] of this.empires) {
                this.espionageManager.calculateCounterIntel(empireId, this.entityManager, this.techTree);
            }
            
            // Process spy missions
            const espionageEvents = this.espionageManager.tick(
                this.tick_count,
                this.entityManager,
                this.resourceManager,
                this.techTree,
                this.universe,
                this.diplomacy
            );
            
            for (const event of espionageEvents) {
                this.pendingEspionageEvents.push(event);
                
                const empire = this.empires.get(event.empireId);
                const targetEmpire = event.targetEmpireId ? this.empires.get(event.targetEmpireId) : null;
                
                switch (event.type) {
                    case 'spy_embedded':
                        this.log('espionage', `${event.icon} ${empire?.name}: ${event.message}`);
                        break;
                    case 'spy_detected':
                        this.log('espionage', `${event.icon} ${targetEmpire?.name} caught spy from ${empire?.name}!`);
                        break;
                    case 'mission_success':
                        this.log('espionage', `${event.icon} ${empire?.name}: ${event.message}`);
                        break;
                    case 'mission_failed':
                        this.log('espionage', `${event.icon} ${empire?.name}: ${event.message}`);
                        break;
                    case 'spy_extracted':
                        this.log('espionage', `${event.icon} ${empire?.name}: ${event.message}`);
                        break;
                }
                
                this.recordChange('espionage', { type: event.type, empireId: event.empireId });
            }
        }

        // Galactic Council processing - periodic elections for Supreme Leader
        // Now includes speciesManager for diplomacy bonus to vote weight
        this.pendingCouncilEvents = [];
        const councilResult = this.council.tick(
            this.tick_count,
            this.empires,
            (empireId) => this.universe.planets.filter(p => p.owner === empireId).length,
            this.resourceManager,
            this.diplomacy,
            this.speciesManager  // Pass species manager for diplomacy bonuses
        );
        
        if (councilResult) {
            this.pendingCouncilEvents.push(councilResult);
            
            if (councilResult.event === 'voting_started') {
                this.log('council', `🗳️ GALACTIC COUNCIL CONVENES! Voting for Supreme Leader has begun! (${councilResult.data.candidates.length} candidates)`);
            } else if (councilResult.event === 'election_resolved') {
                const data = councilResult.data;
                if (data.winner) {
                    const winnerEmpire = this.empires.get(data.winner);
                    if (data.previousLeader === data.winner) {
                        this.log('council', `👑 ${winnerEmpire?.name || data.winner} RE-ELECTED as Supreme Leader! (${data.consecutiveTerms} consecutive terms)`);
                    } else {
                        this.log('council', `👑 ${winnerEmpire?.name || data.winner} ELECTED as Supreme Leader of the Galactic Council!`);
                    }
                } else {
                    this.log('council', `🗳️ No majority reached in council election - position remains vacant`);
                }
            }
            
            this.recordChange('council', councilResult);
        }

        // Endgame Crisis processing - galaxy-threatening events
        this.pendingCrisisEvents = [];
        const crisisEvents = this.crisisManager.tick(
            this.tick_count,
            this.universe,
            this.entityManager,
            this.empires,
            this.combatSystem
        );
        
        for (const event of crisisEvents) {
            this.pendingCrisisEvents.push(event);
            
            if (event.event === 'crisis_warning') {
                this.log('crisis', event.message);
            } else if (event.event === 'crisis_started') {
                this.log('crisis', event.message);
            } else if (event.event === 'crisis_fleet_spawned') {
                this.log('crisis', event.message);
            } else if (event.event === 'crisis_defeated') {
                this.log('crisis', event.message);
            }
            
            this.recordChange('crisis', event);
        }

        // ═══════════════════════════════════════════════════════════════════
        // GALACTIC CYCLES - Periodic galaxy-wide effects
        // ═══════════════════════════════════════════════════════════════════
        this.pendingCycleEvents = [];
        const cycleEvent = this.cycleManager.tick(this.tick_count);
        
        if (cycleEvent) {
            this.pendingCycleEvents.push(cycleEvent);
            
            if (cycleEvent.event === 'cycle_warning') {
                this.log('cycle', cycleEvent.message);
            } else if (cycleEvent.event === 'cycle_started') {
                this.log('cycle', cycleEvent.message);
            }
            
            this.recordChange('cycle', cycleEvent);
        }
        
        // Apply Void Storm damage to fleets in transit
        if (this.cycleManager.currentCycle === 'void_storm') {
            const activeFleets = this.fleetManager.getFleetsInTransit();
            const damaged = this.cycleManager.applyVoidStormDamage(activeFleets, this.entityManager);
            
            if (damaged.length > 0 && this.tick_count % 30 === 0) {
                // Log damage every 30 seconds to avoid spam
                this.log('cycle', `🌀 Void Storm damages ${damaged.length} ships in transit!`);
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        // PLANET ABANDONMENT - Empty planets revert to unowned
        // Prevents empires from holding planets they can't defend/develop
        // ═══════════════════════════════════════════════════════════════════
        if (isHeavyTick) {  // Only check on heavy ticks (every 10 ticks)
            const ABANDONMENT_THRESHOLD = 200;  // 200 ticks = ~3.3 minutes of being empty
            
            for (const planet of this.universe.planets) {
                if (!planet.owner) continue;  // Skip unowned planets
                
                // Check if planet has population OR structures OR military units
                const planetEntities = this.entityManager.getEntitiesAtLocation(planet.id)
                    .filter(e => e.owner === planet.owner);
                const hasStructures = planetEntities.some(e => e.type === 'structure');
                const hasUnits = planetEntities.some(e => e.type === 'unit' || e.type === 'ship');
                const hasPopulation = planet.population > 0;
                
                if (!hasPopulation && !hasStructures && !hasUnits) {
                    // Planet is empty - track abandonment timer
                    planet._emptyTicks = (planet._emptyTicks || 0) + 10;  // +10 because heavy tick
                    
                    if (planet._emptyTicks >= ABANDONMENT_THRESHOLD) {
                        const empire = this.empires.get(planet.owner);
                        this.log('abandonment', `🏚️ ${empire?.name || 'Unknown'} abandoned ${planet.name} (empty too long)`);
                        planet.owner = null;
                        planet._emptyTicks = 0;
                        this.recordChange('planet', { planetId: planet.id, abandoned: true });
                    }
                } else {
                    // Planet is occupied - reset timer
                    planet._emptyTicks = 0;
                }
            }
        }

        // Check for empire eliminations (0 planets = defeated)
        const defeated = this.victoryChecker.checkDefeats(this.empires, this.universe, this.tick_count);
        if (defeated.length > 0) {
            defeated.forEach(d => {
                if (d.canRespawn) {
                    this.log('elimination', `💀 ${d.empireName} has been eliminated! Respawning in 3 minutes...`);
                } else {
                    this.log('elimination', `💀 ${d.empireName} has been permanently eliminated! (No respawns remaining)`);
                }
            });
        }
        
        // Check for empire respawns (eliminated empires get a new homeworld)
        const respawned = this.checkRespawns();
        if (respawned.length > 0) {
            respawned.forEach(r => {
                this.log('respawn', `🔄 ${r.empireName} has respawned at ${r.planetName}! (${3 - r.respawnCount} respawns remaining)`);
            });
        }
        
        // Victory is now handled by GameSession in server.js

        // Emit tick event for any listeners
        this.onTick?.(this.tick_count);
        
        // Performance monitoring with tick budget tracker
        const tickDuration = Date.now() - tickStart;
        const tickBudgetResult = this.tickBudgetMonitor.recordTick(tickDuration, this.tick_count);
        
        // Log warnings based on severity
        if (tickBudgetResult.warningLevel === 'critical') {
            console.error(`🚨 CRITICAL TICK #${this.tick_count}: ${tickDuration}ms (entities: ${this.entityManager.entities.size}, empires: ${this.empires.size}, fleets: ${this.fleetManager.fleetsInTransit?.size || 0})`);
        } else if (tickBudgetResult.warningLevel === 'warning') {
            console.warn(`⚠️ SLOW TICK #${this.tick_count}: ${tickDuration}ms (entities: ${this.entityManager.entities.size}, empires: ${this.empires.size})`);
        }
        
        // Track tick performance for backward compatibility with existing monitoring
        if (!this.tickMetrics) {
            this.tickMetrics = { maxDuration: 0, slowTicks: 0, totalTicks: 0, totalDuration: 0 };
        }
        this.tickMetrics.totalTicks++;
        this.tickMetrics.totalDuration = (this.tickMetrics.totalDuration || 0) + tickDuration;
        if (tickDuration > this.tickMetrics.maxDuration) {
            this.tickMetrics.maxDuration = tickDuration;
        }
        if (tickDuration > 100) {
            this.tickMetrics.slowTicks++;
        }
    }

    executeAction(empireId, action, params) {
        const empire = this.empires.get(empireId);
        if (!empire) {
            return { success: false, error: 'Empire not found' };
        }

        try {
            switch (action) {
                case 'build':
                    return this.handleBuild(empireId, params);
                case 'train':
                    return this.handleTrain(empireId, params);
                case 'move':
                    return this.handleMove(empireId, params);
                case 'attack':
                    return this.handleAttack(empireId, params);
                case 'research':
                    return this.handleResearch(empireId, params);
                case 'colonize':
                    return this.handleColonize(empireId, params);
                case 'diplomacy':
                    return this.handleDiplomacy(empireId, params);
                case 'invade':
                    return this.handleInvade(empireId, params);
                case 'launch_fleet':
                    return this.handleLaunchFleet(empireId, params);
                case 'build_starbase':
                    return this.handleBuildStarbase(empireId, params);
                case 'upgrade_starbase':
                    return this.handleUpgradeStarbase(empireId, params);
                case 'add_starbase_module':
                    return this.handleAddStarbaseModule(empireId, params);
                case 'create_trade_route':
                    return this.handleCreateTradeRoute(empireId, params);
                case 'delete_trade_route':
                    return this.handleDeleteTradeRoute(empireId, params);
                case 'resolve_anomaly':
                    return this.handleResolveAnomaly(empireId, params);
                case 'propose_trade':
                    return this.handleProposeTrade(empireId, params);
                case 'accept_trade':
                    return this.handleAcceptTrade(empireId, params);
                case 'reject_trade':
                    return this.handleRejectTrade(empireId, params);
                case 'cancel_trade':
                    return this.handleCancelTrade(empireId, params);
                // Espionage actions
                case 'deploy_spy':
                    return this.handleDeploySpy(empireId, params);
                case 'assign_spy_mission':
                    return this.handleAssignSpyMission(empireId, params);
                case 'recall_spy':
                    return this.handleRecallSpy(empireId, params);
                // Planet specialization
                case 'specialize':
                    return this.handleSpecialize(empireId, params);
                case 'remove_specialization':
                    return this.handleRemoveSpecialization(empireId, params);
                // Galactic Council
                case 'council_vote':
                    return this.handleCouncilVote(empireId, params);
                // Starbase shipyard queue
                case 'queue_starbase_ship':
                    return this.handleQueueStarbaseShip(empireId, params);
                case 'cancel_starbase_ship':
                    return this.handleCancelStarbaseShip(empireId, params);
                // Building upgrades
                case 'upgrade':
                    return this.handleUpgradeStructure(empireId, params);
                // Ship Designer
                case 'create_ship_blueprint':
                    return this.handleCreateShipBlueprint(empireId, params);
                case 'delete_ship_blueprint':
                    return this.handleDeleteShipBlueprint(empireId, params);
                case 'build_ship':
                    return this.handleBuildShip(empireId, params);
                // Building Modules
                case 'install_building_module':
                    return this.handleInstallBuildingModule(empireId, params);
                case 'remove_building_module':
                    return this.handleRemoveBuildingModule(empireId, params);
                // Wormhole actions
                case 'attack_wormhole':
                    return this.handleAttackWormhole(empireId, params);
                case 'capture_wormhole':
                    return this.handleCaptureWormhole(empireId, params);
                case 'fortify_wormhole':
                    return this.handleFortifyWormhole(empireId, params);
                default:
                    return { success: false, error: 'Unknown action: ' + action };
            }
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    handleBuild(empireId, { type, locationId, gridX, gridY }) {
        const cost = this.entityManager.getBuildCost(type);
        if (!this.resourceManager.canAfford(empireId, cost)) {
            return { success: false, error: 'Insufficient resources' };
        }

        const planet = this.universe.getPlanet(locationId);
        if (!planet || planet.owner !== empireId) {
            return { success: false, error: 'Invalid location or not owned' };
        }
        
        // Check terrain requirements
        const def = this.entityManager.definitions[type];
        if (def && def.validTerrain && planet.surface) {
            // If grid position specified, validate it
            if (gridX !== undefined && gridY !== undefined) {
                const result = this.entityManager.placeStructureAt(planet, type, empireId, gridX, gridY);
                if (!result.success) {
                    return result;
                }
                this.resourceManager.deduct(empireId, cost);
                this.log('build', `${this.empires.get(empireId).name} built ${type} at (${gridX}, ${gridY})`);
                return { success: true, data: { entityId: result.structure.id, gridX, gridY } };
            } else {
                // Auto-find a valid tile
                const tile = this.entityManager.findValidTile(planet, type);
                if (!tile) {
                    const validTerrains = def.validTerrain.join(', ');
                    return { success: false, error: `No valid terrain for ${type}. Requires: ${validTerrains}` };
                }
                
                const result = this.entityManager.placeStructureAt(planet, type, empireId, tile.x, tile.y);
                if (!result.success) {
                    return result;
                }
                this.resourceManager.deduct(empireId, cost);
                this.log('build', `${this.empires.get(empireId).name} built ${type} at (${tile.x}, ${tile.y})`);
                return { success: true, data: { entityId: result.structure.id, gridX: tile.x, gridY: tile.y } };
            }
        }
        
        // Fallback for structures without terrain requirements (legacy)
        this.resourceManager.deduct(empireId, cost);
        const entity = this.entityManager.createStructure(type, empireId, locationId);
        
        // Track change for delta updates
        this.recordChange('entity', { id: entity.id });
        this.recordChange('empire', { id: empireId });
        
        this.log('build', `${this.empires.get(empireId).name} built ${type}`);
        return { success: true, data: { entityId: entity.id } };
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // BUILDING UPGRADES - Upgrade existing structures to higher tiers
    // ═══════════════════════════════════════════════════════════════════════════════
    handleUpgradeStructure(empireId, { entityId }) {
        const empire = this.empires.get(empireId);
        const structure = this.entityManager.getEntity(entityId);
        
        if (!structure || structure.owner !== empireId) {
            return { success: false, error: 'Structure not found or not owned' };
        }
        
        if (structure.type !== 'structure') {
            return { success: false, error: 'Can only upgrade structures' };
        }
        
        // Find what this structure upgrades to
        const currentDef = this.entityManager.definitions[structure.defName];
        if (!currentDef) {
            return { success: false, error: 'Unknown structure type' };
        }
        
        // Find upgrade path - look for structures that have upgradesFrom matching this
        let upgradeTo = null;
        let upgradeDef = null;
        
        for (const [defName, def] of Object.entries(this.entityManager.definitions)) {
            if (def.upgradesFrom === structure.defName) {
                upgradeTo = defName;
                upgradeDef = def;
                break;
            }
        }
        
        if (!upgradeTo || !upgradeDef) {
            return { success: false, error: `${currentDef.name} cannot be upgraded further` };
        }
        
        // Check tech requirements
        if (upgradeDef.requiresTech) {
            if (!this.techTree.isResearched(empireId, upgradeDef.requiresTech)) {
                const tech = this.techTree.getTech(upgradeDef.requiresTech);
                return { 
                    success: false, 
                    error: `Requires technology: ${tech?.name || upgradeDef.requiresTech}` 
                };
            }
        }
        
        // Check resources
        const cost = upgradeDef.cost;
        if (!this.resourceManager.canAfford(empireId, cost)) {
            return { success: false, error: 'Insufficient resources for upgrade' };
        }
        
        // Get the planet and grid position
        const planet = this.universe.getPlanet(structure.location);
        const gridX = structure.gridX;
        const gridY = structure.gridY;
        
        // Deduct resources
        this.resourceManager.deduct(empireId, cost);
        
        // Clear the old tile if we have grid position
        if (planet && planet.surface && gridX !== null && gridY !== null) {
            const tile = planet.surface[gridY]?.[gridX];
            if (tile && typeof tile === 'object') {
                tile.building = null;
                tile.buildingId = null;
            }
        }
        
        // Remove old structure
        this.entityManager.removeEntity(entityId);
        
        // Create new upgraded structure
        const newStructure = this.entityManager.createEntity(upgradeTo, empireId, structure.location, {
            gridX,
            gridY
        });
        
        // Update tile with new structure
        if (planet && planet.surface && gridX !== null && gridY !== null) {
            const tile = planet.surface[gridY]?.[gridX];
            if (tile && typeof tile === 'object') {
                tile.building = upgradeTo;
                tile.buildingId = newStructure.id;
            } else if (planet.surface[gridY]) {
                planet.surface[gridY][gridX] = {
                    type: typeof tile === 'string' ? tile : 'plains',
                    building: upgradeTo,
                    buildingId: newStructure.id
                };
            }
        }
        
        // Track changes
        this.recordChange('entity', { id: newStructure.id });
        this.recordChange('empire', { id: empireId });
        
        this.log('upgrade', `${empire.name} upgraded ${currentDef.name} → ${upgradeDef.name}!`);
        
        return { 
            success: true, 
            data: { 
                newEntityId: newStructure.id,
                upgradedFrom: structure.defName,
                upgradedTo: upgradeTo,
                tier: upgradeDef.tier || 2
            } 
        };
    }

    // Helper: Get available upgrade for a structure
    getUpgradePath(structureDefName) {
        for (const [defName, def] of Object.entries(this.entityManager.definitions)) {
            if (def.upgradesFrom === structureDefName) {
                return { to: defName, def };
            }
        }
        return null;
    }

    handleTrain(empireId, { type, locationId }) {
        const cost = this.entityManager.getTrainCost(type);
        if (!this.resourceManager.canAfford(empireId, cost)) {
            return { success: false, error: 'Insufficient resources' };
        }

        this.resourceManager.deduct(empireId, cost);
        const entity = this.entityManager.createUnit(type, empireId, locationId);

        // Track change for delta updates
        this.recordChange('entity', { id: entity.id });
        this.recordChange('empire', { id: empireId });

        return { success: true, data: { entityId: entity.id } };
    }

    handleMove(empireId, { entityId, destination }) {
        const entity = this.entityManager.getEntity(entityId);
        if (!entity || entity.owner !== empireId) {
            return { success: false, error: 'Entity not found or not owned' };
        }

        const path = this.universe.findPath(entity.location, destination);
        if (!path) {
            return { success: false, error: 'No valid path' };
        }

        this.entityManager.setMovement(entityId, path);
        return { success: true, data: { path } };
    }

    handleAttack(empireId, { entityId, targetId }) {
        const attacker = this.entityManager.getEntity(entityId);
        const target = this.entityManager.getEntity(targetId);

        if (!attacker || attacker.owner !== empireId) {
            return { success: false, error: 'Attacker not found or not owned' };
        }

        if (!target) {
            return { success: false, error: 'Target not found' };
        }

        // Check early game protection
        const targetEmpire = this.empires.get(target.owner);
        if (targetEmpire?.isProtected(this.tick_count)) {
            const remaining = targetEmpire.getProtectionRemaining(this.tick_count);
            return { success: false, error: `Target empire has newcomer protection (${Math.ceil(remaining / 60)} min remaining)` };
        }

        // Check if at war or neutral
        const relation = this.diplomacy.getRelation(empireId, target.owner);
        if (relation === 'allied') {
            return { success: false, error: 'Cannot attack allies' };
        }

        this.entityManager.setTarget(entityId, targetId);
        return { success: true };
    }

    handleResearch(empireId, { techId }) {
        const empire = this.empires.get(empireId);
        const tech = this.techTree.getTech(techId);

        if (!tech) {
            return { success: false, error: 'Technology not found' };
        }

        if (!this.techTree.canResearch(empireId, techId)) {
            return { success: false, error: 'Prerequisites not met' };
        }

        // ═══════════════════════════════════════════════════════════════════
        // UNDERDOG RESEARCH BONUS - Catch-up mechanic for struggling empires
        // Empires behind in score get discounted research costs
        // ═══════════════════════════════════════════════════════════════════
        const costInfo = this.techTree.getEffectiveCost(techId, empireId, this.empires);
        const effectiveCost = { research: costInfo.effectiveCost };
        
        if (!this.resourceManager.canAfford(empireId, effectiveCost)) {
            return { success: false, error: 'Insufficient research points' };
        }

        this.resourceManager.deduct(empireId, effectiveCost);
        this.techTree.complete(empireId, techId);

        // Log with discount info if applicable
        if (costInfo.discount > 0) {
            this.log('research', `${empire.name} researched ${tech.name} (${costInfo.label} - saved ${costInfo.saved} research)`);
        } else {
            this.log('research', `${empire.name} researched ${tech.name}`);
        }
        
        return { 
            success: true, 
            data: { 
                tech,
                costInfo: costInfo.discount > 0 ? costInfo : null
            } 
        };
    }

    handleColonize(empireId, { shipId, planetId }) {
        const ship = this.entityManager.getEntity(shipId);
        const planet = this.universe.getPlanet(planetId);

        if (!ship || ship.owner !== empireId || ship.defName !== 'colony_ship') {
            return { success: false, error: 'Invalid colony ship' };
        }

        if (!planet || planet.owner) {
            return { success: false, error: 'Planet not found or already colonized' };
        }

        // Check if ship is at the planet
        if (ship.location !== planetId) {
            return { success: false, error: 'Ship must be at the planet' };
        }

        // Colonize
        planet.owner = empireId;
        this.entityManager.removeEntity(shipId); // Colony ship is consumed
        this.entityManager.createStartingUnits(empireId, planet, true); // Minimal starting units

        // Track change for delta updates
        this.recordChange('planet', { id: planet.id, owner: planet.owner });
        
        this.log('colonize', `${this.empires.get(empireId).name} colonized ${planet.name}`);
        return { success: true };
    }

    handleDiplomacy(empireId, { action: dipAction, targetEmpire }) {
        const empire = this.empires.get(empireId);
        const target = this.empires.get(targetEmpire);

        if (!target) {
            return { success: false, error: 'Target empire not found' };
        }

        switch (dipAction) {
            case 'propose_alliance':
                this.diplomacy.proposeAlliance(empireId, targetEmpire);
                this.log('diplomacy', `${empire.name} proposed alliance to ${target.name}`);
                break;
            case 'accept_alliance':
                if (this.diplomacy.acceptAlliance(targetEmpire, empireId)) {
                    this.log('diplomacy', `🤝 ${empire.name} and ${target.name} formed an ALLIANCE!`);
                } else {
                    return { success: false, error: 'No pending alliance proposal from that empire' };
                }
                break;
            case 'reject_alliance':
                if (this.diplomacy.rejectAlliance(targetEmpire, empireId)) {
                    this.log('diplomacy', `${empire.name} rejected alliance from ${target.name}`);
                }
                break;
            case 'declare_war':
                // Check early game protection
                if (target.isProtected(this.tick_count)) {
                    const remaining = target.getProtectionRemaining(this.tick_count);
                    return { success: false, error: `Cannot declare war - ${target.name} has newcomer protection (${Math.ceil(remaining / 60)} min remaining)` };
                }
                this.diplomacy.declareWar(empireId, targetEmpire);
                this.log('diplomacy', `${empire.name} declared war on ${target.name}`);
                break;
            case 'propose_peace':
                this.diplomacy.proposePeace(empireId, targetEmpire);
                this.log('diplomacy', `${empire.name} proposed peace to ${target.name}`);
                break;
            case 'accept_peace':
                if (this.diplomacy.acceptPeace(targetEmpire, empireId)) {
                    this.log('diplomacy', `☮️ ${empire.name} and ${target.name} made PEACE!`);
                } else {
                    return { success: false, error: 'No pending peace proposal from that empire' };
                }
                break;
            case 'reject_peace':
                if (this.diplomacy.rejectPeace(targetEmpire, empireId)) {
                    this.log('diplomacy', `${empire.name} rejected peace from ${target.name}`);
                }
                break;
            default:
                return { success: false, error: 'Unknown diplomatic action' };
        }

        return { success: true };
    }

    handleInvade(empireId, { planetId, unitIds }) {
        const empire = this.empires.get(empireId);
        const planet = this.universe.getPlanet(planetId);

        if (!planet) {
            return { success: false, error: 'Planet not found' };
        }

        // Can't invade your own planet
        if (planet.owner === empireId) {
            return { success: false, error: 'Cannot invade your own planet' };
        }

        // Check diplomatic relations if planet is owned
        if (planet.owner) {
            // Check early game protection
            const ownerEmpire = this.empires.get(planet.owner);
            if (ownerEmpire?.isProtected(this.tick_count)) {
                const remaining = ownerEmpire.getProtectionRemaining(this.tick_count);
                return { success: false, error: `Cannot invade - ${ownerEmpire.name} has newcomer protection (${Math.ceil(remaining / 60)} min remaining)` };
            }
            
            const relation = this.diplomacy.getRelation(empireId, planet.owner);
            if (relation === 'allied') {
                return { success: false, error: 'Cannot invade allied planets' };
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        // STARBASE COMBAT CHECK - Must destroy enemy starbase before invasion!
        // ═══════════════════════════════════════════════════════════════════
        if (planet.owner) {
            const systemId = planet.systemId;
            const starbase = this.starbaseManager.getStarbase(systemId);
            
            // Enemy starbase present and operational?
            if (starbase && 
                starbase.owner === planet.owner && 
                starbase.constructing === false) {
                
                return { 
                    success: false, 
                    error: `Cannot invade! ${starbase.name} (${starbase.hp}/${starbase.maxHp} HP) defends this system. Destroy the starbase first!`,
                    starbaseBlocking: {
                        id: starbase.id,
                        name: starbase.name,
                        tier: starbase.tierName,
                        hp: starbase.hp,
                        maxHp: starbase.maxHp
                    }
                };
            }
        }

        // Get attacking units
        const attackers = (unitIds || [])
            .map(id => this.entityManager.getEntity(id))
            .filter(e => e && e.owner === empireId && e.type === 'unit');

        if (attackers.length === 0) {
            return { success: false, error: 'No valid attacking units specified' };
        }

        // Check that attackers are at or near the planet
        const validAttackers = attackers.filter(a => {
            // Must be at the planet or in the same system
            if (a.location === planetId) return true;
            // Space units can attack from same system
            if (a.spaceUnit) {
                const attackerPlanet = this.universe.getPlanet(a.location);
                return attackerPlanet?.systemId === planet.systemId;
            }
            return false;
        });

        if (validAttackers.length === 0) {
            return { success: false, error: 'Attacking units must be at the planet or (for space units) in the same system' };
        }

        // Get defenders
        const defenders = this.entityManager.getEntitiesAtLocation(planetId)
            .filter(e => e.owner === planet.owner);

        // Calculate combat
        const result = this.combatSystem.resolvePlanetaryInvasion(
            validAttackers,
            defenders,
            planet,
            this.entityManager
        );

        // Log the battle
        if (result.conquered) {
            const oldOwner = planet.owner ? this.empires.get(planet.owner)?.name : 'Unclaimed';
            planet.owner = empireId;
            
            // Track change for delta updates
            this.recordChange('planet', { id: planet.id, owner: planet.owner });
            
            this.log('conquest', `${empire.name} conquered ${planet.name} from ${oldOwner}!`);
            
            // Move surviving attackers to the planet (using setEntityLocation for index maintenance)
            validAttackers.forEach(unit => {
                if (this.entityManager.getEntity(unit.id)) {
                    this.entityManager.setEntityLocation(unit.id, planetId);
                    this.recordChange('entity', { id: unit.id });
                }
            });
        } else {
            this.log('combat', `${empire.name}'s invasion of ${planet.name} was repelled!`);
        }

        return {
            success: true,
            data: {
                conquered: result.conquered,
                attackerLosses: result.attackerLosses,
                defenderLosses: result.defenderLosses,
                battleLog: result.battleLog
            }
        };
    }

    handleLaunchFleet(empireId, { originPlanetId, destPlanetId, shipIds, cargoUnitIds }) {
        const empire = this.empires.get(empireId);
        if (!empire) {
            return { success: false, error: 'Empire not found' };
        }

        // Get travel time modifier from current galactic cycle
        const travelTimeModifier = this.cycleManager.getEffectModifier('travelTimeModifier', 1.0);

        const result = this.fleetManager.launchFleet(
            empireId,
            originPlanetId,
            destPlanetId,
            shipIds || [],
            cargoUnitIds || [],
            this.tick_count,
            travelTimeModifier
        );

        if (result.success) {
            const destPlanet = this.universe.getPlanet(destPlanetId);
            const cycleName = this.cycleManager.currentCycle !== 'normal' ? 
                ` [${CYCLE_TYPES[this.cycleManager.currentCycle]?.icon || ''}]` : '';
            this.log('fleet', `${empire.name} launched fleet to ${destPlanet?.name || 'unknown'} (ETA: ${result.travelTime} ticks)${cycleName}`);
        }

        return result;
    }

    handleBuildStarbase(empireId, { systemId }) {
        const empire = this.empires.get(empireId);
        if (!empire) {
            return { success: false, error: 'Empire not found' };
        }

        // Check if can build
        const canBuild = this.starbaseManager.canBuildStarbase(empireId, systemId);
        if (!canBuild.allowed) {
            return { success: false, error: canBuild.error };
        }

        // Check resources
        const cost = { minerals: 100, energy: 50 };  // Outpost cost
        if (!this.resourceManager.canAfford(empireId, cost)) {
            return { success: false, error: 'Insufficient resources (need 100 minerals, 50 energy)' };
        }

        // Build it
        const result = this.starbaseManager.buildStarbase(empireId, systemId, this.tick_count);
        if (result.success) {
            this.resourceManager.deduct(empireId, cost);
            this.recordChange('starbase', { systemId, owner: empireId });
            this.log('starbase', `${empire.name} began construction of ${result.starbase.name}`);
        }

        return result;
    }

    handleUpgradeStarbase(empireId, { systemId }) {
        const empire = this.empires.get(empireId);
        if (!empire) {
            return { success: false, error: 'Empire not found' };
        }

        const starbase = this.starbaseManager.getStarbase(systemId);
        if (!starbase) {
            return { success: false, error: 'No starbase in this system' };
        }

        // Determine upgrade cost
        let cost;
        if (starbase.tierName === 'outpost') {
            cost = { minerals: 300, energy: 150 };
        } else if (starbase.tierName === 'starbase') {
            cost = { minerals: 600, energy: 300, research: 100 };
        } else {
            return { success: false, error: 'Starbase is already at maximum tier' };
        }

        if (!this.resourceManager.canAfford(empireId, cost)) {
            return { success: false, error: `Insufficient resources for upgrade` };
        }

        const result = this.starbaseManager.upgradeStarbase(empireId, systemId, this.tick_count);
        if (result.success) {
            this.resourceManager.deduct(empireId, cost);
            this.recordChange('starbase', { systemId, upgrade: true });
            this.log('starbase', `${empire.name} began upgrading ${starbase.name}`);
        }

        return result;
    }

    handleAddStarbaseModule(empireId, { systemId, moduleType }) {
        const empire = this.empires.get(empireId);
        if (!empire) {
            return { success: false, error: 'Empire not found' };
        }

        // Get module cost
        const moduleDef = StarbaseManager.MODULES[moduleType];
        if (!moduleDef) {
            return { success: false, error: 'Unknown module type' };
        }

        if (!this.resourceManager.canAfford(empireId, moduleDef.cost)) {
            return { success: false, error: 'Insufficient resources for module' };
        }

        const result = this.starbaseManager.addModule(empireId, systemId, moduleType);
        if (result.success) {
            this.resourceManager.deduct(empireId, moduleDef.cost);
            this.recordChange('starbase', { systemId, module: moduleType });
            this.log('starbase', `${empire.name}: ${result.message}`);
        }

        return result;
    }

    handleCreateTradeRoute(empireId, { planet1Id, planet2Id }) {
        const empire = this.empires.get(empireId);
        if (!empire) {
            return { success: false, error: 'Empire not found' };
        }

        const result = this.tradeManager.createRoute(empireId, planet1Id, planet2Id);
        if (result.success) {
            this.recordChange('trade_route', { planet1Id, planet2Id, empireId });
            this.log('trade', `${empire.name}: ${result.message}`);
        }

        return result;
    }

    handleDeleteTradeRoute(empireId, { routeId }) {
        const empire = this.empires.get(empireId);
        if (!empire) {
            return { success: false, error: 'Empire not found' };
        }

        const result = this.tradeManager.deleteRoute(empireId, routeId);
        if (result.success) {
            this.recordChange('trade_route', { routeId, deleted: true });
            this.log('trade', `${empire.name}: ${result.message}`);
        }

        return result;
    }

    handleResolveAnomaly(empireId, { anomalyId, choiceId }) {
        const empire = this.empires.get(empireId);
        if (!empire) {
            return { success: false, error: 'Empire not found' };
        }

        const anomaly = this.anomalyManager.getAnomaly(anomalyId);
        if (!anomaly) {
            return { success: false, error: 'Anomaly not found' };
        }

        if (anomaly.empireId !== empireId) {
            return { success: false, error: 'This anomaly belongs to another empire' };
        }

        const result = this.anomalyManager.resolveAnomaly(
            anomalyId,
            choiceId,
            this.entityManager,
            this.resourceManager,
            this.fleetManager,
            this.relicManager,
            this.techTree  // Pass tech tree for rare tech discovery
        );

        if (result.success) {
            // Log the outcome
            this.log('anomaly', `${empire.name}: ${result.message}`);
            
            // Log relic discovery
            if (result.relicDiscovered) {
                this.log('relic', `${empire.name} discovered ${result.relicDiscovered.icon} ${result.relicDiscovered.name}!`);
            }
            
            // Log rare tech discovery
            if (result.rareTechDiscovered) {
                this.log('tech', `${empire.name} discovered rare technology: 🟣 ${result.rareTechDiscovered.name}!`);
            }
            
            // Track changes
            this.recordChange('anomaly', { id: anomalyId, resolved: true });
            if (Object.keys(result.rewards).length > 0) {
                this.recordChange('empire', { id: empireId });
            }
        }

        return result;
    }

    // ==========================================
    // INTER-EMPIRE TRADING HANDLERS
    // ==========================================

    handleProposeTrade(empireId, { targetEmpire, offer, request }) {
        const empire = this.empires.get(empireId);
        const target = this.empires.get(targetEmpire);

        if (!empire) {
            return { success: false, error: 'Empire not found' };
        }

        if (!target) {
            return { success: false, error: 'Target empire not found' };
        }

        // Validate the offering empire can afford what they're offering
        if (!this.resourceManager.canAfford(empireId, offer)) {
            return { success: false, error: 'You cannot afford the offered resources' };
        }

        const result = this.diplomacy.proposeTrade(
            empireId, 
            targetEmpire, 
            offer, 
            request, 
            this.tick_count
        );

        if (result.success) {
            const offerStr = Object.entries(result.trade.offer)
                .map(([r, v]) => `${v} ${r}`)
                .join(', ') || 'nothing';
            const requestStr = Object.entries(result.trade.request)
                .map(([r, v]) => `${v} ${r}`)
                .join(', ') || 'nothing';
            
            this.log('trade', `💰 ${empire.name} offers [${offerStr}] for [${requestStr}] to ${target.name}`);
            this.recordChange('trade', { id: result.trade.id, type: 'proposed' });
        }

        return result;
    }

    handleAcceptTrade(empireId, { tradeId }) {
        const empire = this.empires.get(empireId);
        if (!empire) {
            return { success: false, error: 'Empire not found' };
        }

        // Helper: check if empire can afford resources
        const canAffordFn = (eId, resources) => {
            return this.resourceManager.canAfford(eId, resources);
        };

        // Helper: transfer resources between empires
        const transferFn = (fromId, toId, resources) => {
            this.resourceManager.deduct(fromId, resources);
            this.resourceManager.add(toId, resources);
            this.recordChange('empire', { id: fromId });
            this.recordChange('empire', { id: toId });
        };

        // 🤝 Helper: get diplomacy modifier for an empire's species
        // Celesti (+30%) returns 1.30, Aquari (+15%) returns 1.15, etc.
        const getDiplomacyBonus = (eId) => {
            const e = this.empires.get(eId);
            if (!e?.speciesId) return 1.0;
            return this.speciesManager.getDiplomacyModifier(e.speciesId);
        };

        const result = this.diplomacy.acceptTrade(empireId, tradeId, canAffordFn, transferFn, getDiplomacyBonus);

        if (result.success) {
            const fromEmpire = this.empires.get(result.trade.from);
            const toEmpire = this.empires.get(result.trade.to);
            
            const offerStr = Object.entries(result.trade.offer)
                .map(([r, v]) => `${v} ${r}`)
                .join(', ');
            const requestStr = Object.entries(result.trade.request)
                .map(([r, v]) => `${v} ${r}`)
                .join(', ');
            
            // Show diplomacy bonuses in log if applicable
            let bonusInfo = '';
            if (result.diplomacyBonuses?.toBonus > 0 || result.diplomacyBonuses?.fromBonus > 0) {
                const bonuses = [];
                if (result.diplomacyBonuses.toBonus > 0) {
                    bonuses.push(`${toEmpire?.name} +${result.diplomacyBonuses.toBonus}%`);
                }
                if (result.diplomacyBonuses.fromBonus > 0) {
                    bonuses.push(`${fromEmpire?.name} +${result.diplomacyBonuses.fromBonus}%`);
                }
                bonusInfo = ` (🤝 diplomacy: ${bonuses.join(', ')})`;
            }
            
            this.log('trade', `✅ Trade complete! ${fromEmpire?.name} → ${toEmpire?.name}: [${offerStr}] ↔ [${requestStr}]${bonusInfo}`);
            this.recordChange('trade', { id: tradeId, type: 'accepted' });
        }

        return result;
    }

    handleRejectTrade(empireId, { tradeId }) {
        const empire = this.empires.get(empireId);
        if (!empire) {
            return { success: false, error: 'Empire not found' };
        }

        const trade = this.diplomacy.trades.get(tradeId);
        const result = this.diplomacy.rejectTrade(empireId, tradeId);

        if (result.success && trade) {
            const fromEmpire = this.empires.get(trade.from);
            this.log('trade', `❌ ${empire.name} rejected trade offer from ${fromEmpire?.name}`);
            this.recordChange('trade', { id: tradeId, type: 'rejected' });
        }

        return result;
    }

    handleCancelTrade(empireId, { tradeId }) {
        const empire = this.empires.get(empireId);
        if (!empire) {
            return { success: false, error: 'Empire not found' };
        }

        const trade = this.diplomacy.trades.get(tradeId);
        const result = this.diplomacy.cancelTrade(empireId, tradeId);

        if (result.success && trade) {
            const toEmpire = this.empires.get(trade.to);
            this.log('trade', `🚫 ${empire.name} cancelled trade offer to ${toEmpire?.name}`);
            this.recordChange('trade', { id: tradeId, type: 'cancelled' });
        }

        return result;
    }

    // ==========================================
    // ESPIONAGE HANDLERS
    // ==========================================

    handleDeploySpy(empireId, { spyId, targetPlanetId }) {
        const empire = this.empires.get(empireId);
        if (!empire) {
            return { success: false, error: 'Empire not found' };
        }

        // Check if empire has an intelligence agency
        const agencies = this.entityManager.getEntitiesForEmpire(empireId)
            .filter(e => e.defName === 'intelligence_agency');
        
        if (agencies.length === 0) {
            return { success: false, error: 'You need an Intelligence Agency to deploy spies' };
        }

        const result = this.espionageManager.deployspy(
            spyId,
            empireId,
            targetPlanetId,
            this.universe,
            this.entityManager
        );

        if (result.success) {
            const planet = this.universe.getPlanet(targetPlanetId);
            const target = this.empires.get(planet?.owner);
            this.log('espionage', `🕵️ ${empire.name} deployed spy to ${planet?.name} (${target?.name})`);
            this.recordChange('espionage', { type: 'deployed', empireId });
        }

        return result;
    }

    handleAssignSpyMission(empireId, { spyId, missionType }) {
        const empire = this.empires.get(empireId);
        if (!empire) {
            return { success: false, error: 'Empire not found' };
        }

        const result = this.espionageManager.assignMission(spyId, empireId, missionType);

        if (result.success) {
            this.log('espionage', `🎯 ${empire.name} assigned ${missionType} mission to spy`);
            this.recordChange('espionage', { type: 'mission_assigned', empireId, missionType });
        }

        return result;
    }

    handleRecallSpy(empireId, { spyId }) {
        const empire = this.empires.get(empireId);
        if (!empire) {
            return { success: false, error: 'Empire not found' };
        }

        const result = this.espionageManager.recallSpy(spyId, empireId, this.entityManager);

        if (result.success) {
            this.log('espionage', `🏃 ${empire.name} initiated spy extraction`);
            this.recordChange('espionage', { type: 'recall', empireId });
        }

        return result;
    }

    // ==========================================
    // PLANET SPECIALIZATION HANDLERS
    // ==========================================

    handleSpecialize(empireId, { planetId, specialization }) {
        const empire = this.empires.get(empireId);
        if (!empire) {
            return { success: false, error: 'Empire not found' };
        }

        const planet = this.universe.getPlanet(planetId);
        if (!planet) {
            return { success: false, error: 'Planet not found' };
        }

        if (planet.owner !== empireId) {
            return { success: false, error: 'You do not own this planet' };
        }

        // Check if specialization type is valid
        const specDef = PLANET_SPECIALIZATIONS[specialization];
        if (!specDef) {
            const validTypes = Object.keys(PLANET_SPECIALIZATIONS).join(', ');
            return { success: false, error: `Invalid specialization. Valid types: ${validTypes}` };
        }

        // Check if planet is already specialized
        if (planet.specialization) {
            return { success: false, error: `Planet is already specialized as ${PLANET_SPECIALIZATIONS[planet.specialization].name}. Remove specialization first.` };
        }

        // Check tech requirements
        if (specDef.requiredTech && !this.techTree.hasResearched(empireId, specDef.requiredTech)) {
            return { success: false, error: `Requires technology: ${specDef.requiredTech}` };
        }

        // Check resource cost
        if (!this.resourceManager.canAfford(empireId, specDef.cost)) {
            const costStr = Object.entries(specDef.cost).map(([r, v]) => `${v} ${r}`).join(', ');
            return { success: false, error: `Insufficient resources. Cost: ${costStr}` };
        }

        // Apply specialization
        this.resourceManager.deduct(empireId, specDef.cost);
        planet.specialization = specialization;
        
        // Track change
        this.recordChange('planet', { id: planetId, specialization });
        this.log('specialization', `${specDef.icon} ${empire.name} designated ${planet.name} as ${specDef.name}`);

        return { 
            success: true, 
            data: { 
                planetId, 
                specialization,
                name: specDef.name,
                bonuses: specDef.bonuses
            } 
        };
    }

    handleRemoveSpecialization(empireId, { planetId }) {
        const empire = this.empires.get(empireId);
        if (!empire) {
            return { success: false, error: 'Empire not found' };
        }

        const planet = this.universe.getPlanet(planetId);
        if (!planet) {
            return { success: false, error: 'Planet not found' };
        }

        if (planet.owner !== empireId) {
            return { success: false, error: 'You do not own this planet' };
        }

        if (!planet.specialization) {
            return { success: false, error: 'Planet has no specialization to remove' };
        }

        const oldSpec = PLANET_SPECIALIZATIONS[planet.specialization];
        planet.specialization = null;
        
        // Refund 50% of the cost
        const refund = {};
        for (const [resource, amount] of Object.entries(oldSpec.cost)) {
            refund[resource] = Math.floor(amount * 0.5);
        }
        this.resourceManager.add(empireId, refund);

        // Track change
        this.recordChange('planet', { id: planetId, specialization: null });
        this.log('specialization', `🔄 ${empire.name} removed ${oldSpec.name} designation from ${planet.name} (50% refunded)`);

        return { 
            success: true, 
            data: { 
                planetId, 
                previousSpecialization: oldSpec.name,
                refund 
            } 
        };
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // GALACTIC COUNCIL ACTIONS
    // ═══════════════════════════════════════════════════════════════════════════════

    handleCouncilVote(empireId, { candidateId }) {
        const empire = this.empires.get(empireId);
        if (!empire) {
            return { success: false, error: 'Empire not found' };
        }

        if (!this.council.votingActive) {
            return { success: false, error: 'No election in progress' };
        }

        const result = this.council.castVote(empireId, candidateId);
        
        if (result.success) {
            const candidateName = candidateId === 'abstain' 
                ? 'abstain' 
                : this.empires.get(candidateId)?.name || candidateId;
            
            this.log('council', `🗳️ ${empire.name} cast their vote ${candidateId === 'abstain' ? '(abstained)' : `for ${candidateName}`}`);
            this.recordChange('council_vote', { voter: empireId, candidate: candidateId });
        }

        return result;
    }

    // Get council status for API
    getCouncilStatus() {
        return this.council.getStatus(this.tick_count, this.empires);
    }

    // Check if an empire is the Supreme Leader
    isSupremeLeader(empireId) {
        return this.council.isSupremeLeader(empireId);
    }

    // Get leader bonuses for an empire (returns null if not leader)
    getLeaderBonuses(empireId) {
        return this.council.getLeaderBonuses(empireId);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // STARBASE SHIPYARD QUEUE HANDLERS
    // ═══════════════════════════════════════════════════════════════════════════════

    handleQueueStarbaseShip(empireId, { systemId, shipType }) {
        const empire = this.empires.get(empireId);
        if (!empire) {
            return { success: false, error: 'Empire not found' };
        }

        const starbase = this.starbaseManager.getStarbase(systemId);
        if (!starbase) {
            return { success: false, error: 'No starbase in this system' };
        }

        // Check if starbase has shipyard module
        if (!this.starbaseManager.canBuildShips(systemId)) {
            return { success: false, error: 'Starbase needs a Shipyard Module to build ships' };
        }

        // Get ship cost
        const cost = this.entityManager.getTrainCost(shipType);
        if (!cost || Object.keys(cost).length === 0) {
            return { success: false, error: `Unknown ship type: ${shipType}` };
        }

        // Check if can afford
        if (!this.resourceManager.canAfford(empireId, cost)) {
            const costStr = Object.entries(cost).map(([r, v]) => `${v} ${r}`).join(', ');
            return { success: false, error: `Insufficient resources. Cost: ${costStr}` };
        }

        // Queue the ship
        const result = this.starbaseManager.queueShip(empireId, systemId, shipType, this.tick_count);
        
        if (result.success) {
            this.resourceManager.deduct(empireId, cost);
            this.recordChange('starbase_queue', { systemId, shipType, action: 'queued' });
            this.log('shipyard', `🚀 ${empire.name}: ${result.message}`);
        }

        return result;
    }

    handleCancelStarbaseShip(empireId, { systemId, queueItemId }) {
        const empire = this.empires.get(empireId);
        if (!empire) {
            return { success: false, error: 'Empire not found' };
        }

        const starbase = this.starbaseManager.getStarbase(systemId);
        if (!starbase || !starbase.buildQueue) {
            return { success: false, error: 'No build queue found' };
        }

        // Find the item to get refund info
        const item = starbase.buildQueue.find(i => i.id === queueItemId);
        if (!item) {
            return { success: false, error: 'Queue item not found' };
        }

        const result = this.starbaseManager.cancelQueuedShip(empireId, systemId, queueItemId);
        
        if (result.success) {
            // Refund 75% of the cost
            const fullCost = this.entityManager.getTrainCost(result.cancelled.shipType);
            const refund = {};
            for (const [resource, amount] of Object.entries(fullCost)) {
                refund[resource] = Math.floor(amount * 0.75);
            }
            this.resourceManager.add(empireId, refund);
            
            const refundStr = Object.entries(refund).map(([r, v]) => `${v} ${r}`).join(', ');
            
            this.recordChange('starbase_queue', { systemId, queueItemId, action: 'cancelled' });
            this.log('shipyard', `❌ ${empire.name}: ${result.message} (refunded: ${refundStr})`);
            
            return { ...result, refund };
        }

        return result;
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // SHIP DESIGNER HANDLERS
    // ═══════════════════════════════════════════════════════════════════════════════

    handleCreateShipBlueprint(empireId, { name, hullType, modules }) {
        const empire = this.empires.get(empireId);
        if (!empire) {
            return { success: false, error: 'Empire not found' };
        }

        if (!hullType) {
            return { success: false, error: 'Hull type required. See /api/ships/hulls for options.' };
        }

        const result = this.shipDesigner.createBlueprint(
            empireId,
            name,
            hullType,
            modules || [],
            this.techTree
        );

        if (result.success) {
            this.recordChange('blueprint', { id: result.blueprint.id, empireId, action: 'created' });
            this.log('ships', `🚀 ${empire.name} designed new ship: ${result.blueprint.name}`);
        }

        return result;
    }

    handleDeleteShipBlueprint(empireId, { blueprintId }) {
        const empire = this.empires.get(empireId);
        if (!empire) {
            return { success: false, error: 'Empire not found' };
        }

        if (!blueprintId) {
            return { success: false, error: 'Blueprint ID required' };
        }

        const blueprint = this.shipDesigner.getBlueprint(empireId, blueprintId);
        if (!blueprint) {
            return { success: false, error: 'Blueprint not found' };
        }

        const deleted = this.shipDesigner.deleteBlueprint(empireId, blueprintId);
        
        if (deleted) {
            this.recordChange('blueprint', { id: blueprintId, empireId, action: 'deleted' });
            this.log('ships', `🗑️ ${empire.name} deleted blueprint: ${blueprint.name}`);
            return { success: true, data: { deletedBlueprint: blueprint.name } };
        }

        return { success: false, error: 'Failed to delete blueprint' };
    }

    handleBuildShip(empireId, { blueprintId, planetId }) {
        const empire = this.empires.get(empireId);
        if (!empire) {
            return { success: false, error: 'Empire not found' };
        }

        if (!blueprintId || !planetId) {
            return { success: false, error: 'Blueprint ID and planet ID required' };
        }

        // Get the blueprint
        const blueprint = this.shipDesigner.getBlueprint(empireId, blueprintId);
        if (!blueprint) {
            return { success: false, error: 'Blueprint not found' };
        }

        // Verify planet ownership and has shipyard
        const planet = this.universe.getPlanet(planetId);
        if (!planet || planet.owner !== empireId) {
            return { success: false, error: 'Planet not found or not owned' };
        }

        // Check for shipyard at planet
        const hasShipyard = this.entityManager.getEntitiesAtLocation(planetId)
            .some(e => e.defName === 'shipyard' || e.defName === 'advanced_shipyard' || e.defName === 'orbital_foundry');
        
        if (!hasShipyard) {
            return { success: false, error: 'Planet needs a Shipyard to build ships' };
        }

        // Check resources
        if (!this.resourceManager.canAfford(empireId, blueprint.cost)) {
            const costStr = Object.entries(blueprint.cost).map(([r, v]) => `${v} ${r}`).join(', ');
            return { success: false, error: `Insufficient resources. Cost: ${costStr}` };
        }

        // Deduct resources
        this.resourceManager.deduct(empireId, blueprint.cost);

        // Create the ship entity with custom stats
        const ship = this.entityManager.createEntity(blueprint.hullType, empireId, planetId, {
            name: blueprint.name,
            hp: blueprint.stats.hp,
            maxHp: blueprint.stats.hp,
            attack: blueprint.stats.attack,
            speed: blueprint.stats.speed,
            range: blueprint.stats.range,
            vision: blueprint.stats.vision,
            evasion: blueprint.stats.evasion || 0,
            cargoCapacity: blueprint.stats.cargoCapacity || 0,
            spaceUnit: true,
            customBlueprint: blueprintId,
            modules: blueprint.modules
        });

        this.recordChange('entity', { id: ship.id });
        this.recordChange('empire', { id: empireId });
        this.log('ships', `🚀 ${empire.name} built ${blueprint.name} at ${planet.name}`);

        return {
            success: true,
            data: {
                entityId: ship.id,
                shipName: blueprint.name,
                stats: blueprint.stats
            }
        };
    }

    // Get ship blueprints for an empire
    getShipBlueprints(empireId) {
        return this.shipDesigner.getBlueprints(empireId);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // BUILDING MODULE HANDLERS
    // ═══════════════════════════════════════════════════════════════════════════════

    handleInstallBuildingModule(empireId, { entityId, moduleId }) {
        // Validate entity exists and is owned by empire
        const entity = this.entityManager.entities.get(entityId);
        if (!entity) {
            return { success: false, error: 'Building not found' };
        }
        if (entity.owner !== empireId) {
            return { success: false, error: 'Building not owned by your empire' };
        }
        if (entity.type !== 'structure') {
            return { success: false, error: 'Can only install modules on structures' };
        }

        // Get empire resources
        const resources = this.resourceManager.getResources(empireId);

        // Attempt installation
        const result = this.buildingModules.installModule(entityId, moduleId, entity.defName, resources);
        
        if (result.success) {
            // Update resources
            this.resourceManager.setResources(empireId, resources);
            
            // Track changes
            this.recordChange('entity', { id: entityId });
            this.recordChange('empire', { id: empireId });
            
            const empire = this.empires.get(empireId);
            const module = this.buildingModules.getModule(moduleId);
            this.log('buildings', `🔧 ${empire.name} installed ${module.name} on ${entity.defName}`);
            
            return {
                success: true,
                data: {
                    entityId,
                    moduleId,
                    moduleName: module.name,
                    effects: this.buildingModules.getEffects(entityId),
                    slotsUsed: this.buildingModules.getInstalledModules(entityId).length,
                    maxSlots: this.buildingModules.getSlotCount(entity.defName)
                }
            };
        }
        
        return result;
    }

    handleRemoveBuildingModule(empireId, { entityId, moduleId }) {
        // Validate entity exists and is owned by empire
        const entity = this.entityManager.entities.get(entityId);
        if (!entity) {
            return { success: false, error: 'Building not found' };
        }
        if (entity.owner !== empireId) {
            return { success: false, error: 'Building not owned by your empire' };
        }

        // Get empire resources for refund
        const resources = this.resourceManager.getResources(empireId);

        // Attempt removal
        const result = this.buildingModules.removeModule(entityId, moduleId, resources);
        
        if (result.success) {
            // Update resources (with refund)
            this.resourceManager.setResources(empireId, resources);
            
            // Track changes
            this.recordChange('entity', { id: entityId });
            this.recordChange('empire', { id: empireId });
            
            const empire = this.empires.get(empireId);
            const module = this.buildingModules.getModule(moduleId);
            this.log('buildings', `🔧 ${empire.name} removed ${module.name} from ${entity.defName} (50% refund)`);
            
            return {
                success: true,
                data: {
                    entityId,
                    moduleId,
                    refunded: true,
                    effects: this.buildingModules.getEffects(entityId)
                }
            };
        }
        
        return result;
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // WORMHOLE HANDLERS - Attack, Capture, and Fortify strategic wormholes
    // ═══════════════════════════════════════════════════════════════════════════════
    
    /**
     * Attack a wormhole portal with ships in the same system
     * Wormholes can be attacked to deny enemy access or prepare for capture
     */
    handleAttackWormhole(empireId, { wormholeId, shipIds }) {
        const wormhole = this.universe.getWormhole(wormholeId);
        if (!wormhole) {
            return { success: false, error: 'Wormhole not found' };
        }
        
        // Can't attack your own wormhole
        if (wormhole.ownerId === empireId) {
            return { success: false, error: 'Cannot attack your own wormhole' };
        }
        
        // Check owner protection (if owned by another empire)
        if (wormhole.ownerId) {
            const ownerEmpire = this.empires.get(wormhole.ownerId);
            if (ownerEmpire?.isProtected(this.tick_count)) {
                return { success: false, error: 'Cannot attack - owner has newcomer protection' };
            }
        }
        
        // Validate attacking ships are in the wormhole's system
        const attackingShips = [];
        let totalDamage = 0;
        
        for (const shipId of (shipIds || [])) {
            const ship = this.entityManager.getEntity(shipId);
            if (!ship) continue;
            if (ship.owner !== empireId) continue;
            
            // Ship must be at a planet in the same system
            const shipPlanet = this.universe.getPlanet(ship.location);
            if (!shipPlanet || shipPlanet.systemId !== wormhole.systemId) continue;
            
            attackingShips.push(ship);
            totalDamage += (ship.attack || 10) * 2; // Ships deal double damage to structures
        }
        
        if (attackingShips.length === 0) {
            return { success: false, error: 'No valid ships in wormhole system to attack with' };
        }
        
        // Apply defense bonus from owner fortifications
        const effectiveDamage = Math.max(1, totalDamage - (wormhole.defenseBonus || 0));
        
        // Deal damage
        wormhole.hp = Math.max(0, wormhole.hp - effectiveDamage);
        wormhole.lastAttacker = empireId;
        
        // Check stability
        if (wormhole.hp < wormhole.maxHp * 0.25) {
            wormhole.stable = false;
        }
        
        // If destroyed, reset ownership and destabilize
        if (wormhole.hp <= 0) {
            const oldOwner = wormhole.ownerId;
            wormhole.ownerId = null;
            wormhole.captureProgress = 0;
            wormhole.defenseBonus = 0;
            
            this.log('wormhole', `💥 ${this.empires.get(empireId).name} destabilized ${wormhole.name}! Wormhole offline.`);
            
            // Also affect the paired portal
            const pairedWormhole = this.universe.getWormhole(wormhole.pairId);
            if (pairedWormhole) {
                pairedWormhole.stable = false;
            }
            
            this.recordChange('wormhole', { id: wormholeId, destroyed: true });
            
            return {
                success: true,
                destroyed: true,
                message: `${wormhole.name} has been destabilized!`,
                damage: effectiveDamage
            };
        }
        
        const empire = this.empires.get(empireId);
        this.log('wormhole', `⚔️ ${empire.name} attacks ${wormhole.name} for ${effectiveDamage} damage (${wormhole.hp}/${wormhole.maxHp} HP)`);
        
        this.recordChange('wormhole', { id: wormholeId, hp: wormhole.hp });
        
        return {
            success: true,
            damage: effectiveDamage,
            remainingHp: wormhole.hp,
            maxHp: wormhole.maxHp,
            stable: wormhole.stable
        };
    }
    
    /**
     * Capture a wormhole by having ships present when it's neutral or weakened
     * Requires military presence in the system
     */
    handleCaptureWormhole(empireId, { wormholeId }) {
        const wormhole = this.universe.getWormhole(wormholeId);
        if (!wormhole) {
            return { success: false, error: 'Wormhole not found' };
        }
        
        // Already owned by this empire
        if (wormhole.ownerId === empireId) {
            return { success: false, error: 'You already own this wormhole' };
        }
        
        // Can only capture neutral wormholes or destabilized ones
        if (wormhole.ownerId && wormhole.hp > 0) {
            return { success: false, error: 'Wormhole is controlled by another empire - attack it first' };
        }
        
        // Count military ships in the system
        const systemPlanets = this.universe.planets.filter(p => p.systemId === wormhole.systemId);
        let militaryPresence = 0;
        
        for (const planet of systemPlanets) {
            const ships = this.entityManager.getEntitiesAt(planet.id)
                .filter(e => e.owner === empireId && e.spaceUnit && e.attack > 0);
            militaryPresence += ships.length;
        }
        
        if (militaryPresence < 3) {
            return { success: false, error: 'Need at least 3 military ships in system to capture wormhole' };
        }
        
        // Capture progress
        const captureAmount = Math.min(25, militaryPresence * 5); // 5% per ship, max 25% per action
        wormhole.captureProgress += captureAmount;
        
        if (wormhole.captureProgress >= 100) {
            // Captured!
            wormhole.ownerId = empireId;
            wormhole.captureProgress = 0;
            wormhole.hp = wormhole.maxHp * 0.5; // Starts at 50% HP
            wormhole.stable = true;
            
            const empire = this.empires.get(empireId);
            this.log('wormhole', `🌀 ${empire.name} captured ${wormhole.name}!`);
            
            this.recordChange('wormhole', { id: wormholeId, ownerId: empireId, captured: true });
            
            return {
                success: true,
                captured: true,
                message: `${wormhole.name} is now under your control!`
            };
        }
        
        this.recordChange('wormhole', { id: wormholeId, captureProgress: wormhole.captureProgress });
        
        return {
            success: true,
            captureProgress: wormhole.captureProgress,
            message: `Capture progress: ${wormhole.captureProgress}%`
        };
    }
    
    /**
     * Fortify a wormhole you own to increase its defenses
     * Costs resources but makes it harder to attack
     */
    handleFortifyWormhole(empireId, { wormholeId }) {
        const wormhole = this.universe.getWormhole(wormholeId);
        if (!wormhole) {
            return { success: false, error: 'Wormhole not found' };
        }
        
        if (wormhole.ownerId !== empireId) {
            return { success: false, error: 'You do not own this wormhole' };
        }
        
        // Cost scales with current defense level
        const currentLevel = Math.floor((wormhole.defenseBonus || 0) / 25);
        if (currentLevel >= 4) {
            return { success: false, error: 'Wormhole is at maximum fortification level' };
        }
        
        const cost = {
            minerals: 100 * (currentLevel + 1),
            energy: 50 * (currentLevel + 1)
        };
        
        if (!this.resourceManager.canAfford(empireId, cost)) {
            return { success: false, error: `Insufficient resources (need ${cost.minerals} minerals, ${cost.energy} energy)` };
        }
        
        this.resourceManager.spend(empireId, cost);
        
        // Increase defense and repair
        wormhole.defenseBonus = (wormhole.defenseBonus || 0) + 25;
        wormhole.hp = Math.min(wormhole.maxHp, wormhole.hp + 100);
        wormhole.stable = wormhole.hp >= wormhole.maxHp * 0.25;
        
        const empire = this.empires.get(empireId);
        this.log('wormhole', `🛡️ ${empire.name} fortified ${wormhole.name} (Defense +25, HP +100)`);
        
        this.recordChange('wormhole', { id: wormholeId, defenseBonus: wormhole.defenseBonus, hp: wormhole.hp });
        
        return {
            success: true,
            defenseBonus: wormhole.defenseBonus,
            hp: wormhole.hp,
            maxHp: wormhole.maxHp,
            level: currentLevel + 1
        };
    }

    // Get building modules info for an entity
    getBuildingModules(entityId) {
        const entity = this.entityManager.entities.get(entityId);
        if (!entity) return null;
        
        return {
            entityId,
            buildingType: entity.defName,
            installed: this.buildingModules.getInstalledModules(entityId).map(id => this.buildingModules.getModule(id)),
            effects: this.buildingModules.getEffects(entityId),
            slots: {
                used: this.buildingModules.getInstalledModules(entityId).length,
                max: this.buildingModules.getSlotCount(entity.defName)
            },
            available: this.buildingModules.getValidModules(entity.defName)
        };
    }

    // Helper to get specialization info for a planet
    getPlanetSpecialization(planetId) {
        const planet = this.universe.getPlanet(planetId);
        if (!planet || !planet.specialization) return null;
        
        const spec = PLANET_SPECIALIZATIONS[planet.specialization];
        return {
            type: planet.specialization,
            ...spec
        };
    }

    getStateForEmpire(empireId) {
        const empire = this.empires.get(empireId);
        if (!empire) return null;

        // Get visible universe (fog of war)
        const visibleUniverse = this.universe.getVisibleFor(
            empireId,
            this.entityManager
        );

        // Get own entities
        const ownEntities = this.entityManager.getEntitiesForEmpire(empireId);

        // Get visible enemy entities
        const visibleEnemies = this.entityManager.getVisibleEnemies(
            empireId,
            visibleUniverse
        );

        // Get underdog research bonus for this empire
        const underdogResearchBonus = this.techTree.getUnderdogResearchBonus(empireId, this.empires);

        return {
            tick: this.tick_count,
            empire: empire.serialize(),
            resources: this.resourceManager.getResources(empireId),
            technologies: this.techTree.getResearched(empireId),
            availableTech: this.techTree.getAvailable(empireId),
            // 🔬 Underdog Research Bonus - struggling empires get cheaper research
            underdogResearchBonus: underdogResearchBonus.discount > 0 ? {
                discount: underdogResearchBonus.discount,
                discountPercent: Math.round(underdogResearchBonus.discount * 100),
                label: underdogResearchBonus.label,
                scoreRatio: underdogResearchBonus.scoreRatio
            } : null,
            universe: visibleUniverse,
            entities: ownEntities,
            visibleEnemies,
            diplomacy: this.diplomacy.getRelationsFor(empireId),
            trades: this.diplomacy.getTradesFor(empireId),
            myFleets: this.fleetManager.getEmpiresFleets(empireId),
            allFleets: this.fleetManager.getFleetsInTransit(),
            shipBlueprints: this.shipDesigner.getBlueprints(empireId),
            myStarbases: this.starbaseManager.getEmpireStarbases(empireId).map(s => ({
                ...s,
                buildQueue: s.buildQueue || [],
                canBuildShips: this.starbaseManager.canBuildShips(s.systemId)
            })),
            allStarbases: this.starbaseManager.getAllStarbases().map(s => ({
                ...s,
                buildQueue: s.buildQueue || [],
                canBuildShips: this.starbaseManager.canBuildShips(s.systemId)
            })),
            myAnomalies: this.anomalyManager.getAnomaliesForEmpire(empireId),
            mySpies: this.espionageManager.getSpiesForEmpire(empireId),
            myIntel: this.espionageManager.getIntelForEmpire(empireId),
            missionLog: this.espionageManager.getMissionLog(empireId),
            recentEvents: this.getRecentEvents(empireId),
            // Ship Designer blueprints
            shipBlueprints: this.shipDesigner.getBlueprints(empireId),
            // Include council and crisis for bot AI decision-making
            council: this.council.getStatus(this.tick_count, this.empires),
            crisis: this.crisisManager.getStatus(this.entityManager),
            // Include all empires for diplomacy/voting decisions
            empires: Array.from(this.empires.values()).map(e => ({
                id: e.id,
                name: e.name,
                color: e.color,
                score: e.score || 0
            }))
        };
    }

    // NOTE: getStateForEmpireLight() is defined below (around line 2305)
    // Merged version with bandwidth optimization + full bot decision data

    // Full state with all planet surfaces (used for persistence/saving)
    getFullState() {
        return {
            tick: this.tick_count,
            paused: this.paused,
            universe: this.universe.serialize(),  // Includes surfaces for saving
            empires: Array.from(this.empires.values()).map(e => {
                const entities = this.entityManager.getEntitiesForEmpire(e.id);
                const shipCount = entities.filter(ent => ent.spaceUnit).length;
                const soldierCount = entities.filter(ent => ent.type === 'unit' && !ent.spaceUnit).length;
                return {
                    ...e.serialize(),
                    resources: this.resourceManager.getResources(e.id),
                    entityCount: entities.length,
                    shipCount,
                    soldierCount,
                    planetCount: this.universe.getPlanetsOwnedBy(e.id).length
                };
            }),
            entities: this.entityManager.getAllEntities(),
            diplomacy: this.diplomacy.getAllRelations(),
            interEmpireTrades: this.diplomacy.serializeTrades(),  // Inter-empire trading
            fleetsInTransit: this.fleetManager.serialize().fleetsInTransit,  // Full fleet data for persistence
            starbases: this.starbaseManager.getAllStarbases(),
            tradeRoutes: this.tradeManager.serialize(),  // Full data for saving
            anomalies: this.anomalyManager.serialize(),
            calamities: this.calamityManager.serialize(),
            espionage: this.espionageManager.serialize(),
            relics: this.relicManager.serialize(),
            council: this.council.serialize(),
            crisis: this.crisisManager.serialize(),
            cycle: this.cycleManager.toJSON(),
            shipDesigner: this.shipDesigner.serialize(),
            events: this.eventLog.slice(-50)
        };
    }

    // Light state for clients (excludes planet surfaces - fetch on demand)
    // P1 Fix: Added pagination and viewport culling for entities
    getLightState(options = {}) {
        const { 
            entityPage = 1, 
            entityLimit = 1000,  // Default cap of 1000 entities per request
            viewport = null,     // { x, y, width, height } for spatial culling
            includeEntities = true  // Set false to skip entities entirely
        } = options;
        
        let entities = [];
        let entityPagination = null;
        
        if (includeEntities) {
            let allEntities = this.entityManager.getAllEntities();
            
            // P1 Fix: Viewport culling - only return entities in view
            if (viewport && viewport.x !== undefined) {
                allEntities = allEntities.filter(e => {
                    // Get entity position (from planet location or direct coords)
                    let x, y;
                    if (e.x !== undefined && e.y !== undefined) {
                        x = e.x;
                        y = e.y;
                    } else if (e.location) {
                        const planet = this.universe.getPlanet(e.location);
                        if (planet) {
                            const pos = this.universe.getPlanetAbsolutePosition(planet);
                            x = pos.x;
                            y = pos.y;
                        }
                    }
                    
                    if (x === undefined) return true; // Include entities without position
                    
                    return x >= viewport.x && 
                           x <= viewport.x + viewport.width &&
                           y >= viewport.y && 
                           y <= viewport.y + viewport.height;
                });
            }
            
            // P1 Fix: Pagination to limit response size
            const totalEntities = allEntities.length;
            const totalPages = Math.ceil(totalEntities / entityLimit);
            const startIndex = (entityPage - 1) * entityLimit;
            
            // Serialize with light format
            entities = allEntities
                .slice(startIndex, startIndex + entityLimit)
                .map(e => serializeEntityLight(e));
            
            entityPagination = {
                page: entityPage,
                limit: entityLimit,
                total: totalEntities,
                totalPages,
                hasMore: entityPage < totalPages
            };
        }
        
        return {
            tick: this.tick_count,
            paused: this.paused,
            universe: this.universe.serializeLight(),  // No surfaces
            empires: Array.from(this.empires.values()).map(e => {
                const empireEntities = this.entityManager.getEntitiesForEmpire(e.id);
                const shipCount = empireEntities.filter(ent => ent.spaceUnit).length;
                const soldierCount = empireEntities.filter(ent => ent.type === 'unit' && !ent.spaceUnit).length;
                const planetCount = this.universe.getPlanetsOwnedBy(e.id).length;
                
                // Get underdog bonus for this empire (catch-up mechanic)
                const underdogBonus = this.resourceManager.getUnderdogBonus(planetCount);
                
                return {
                    ...e.serialize(),
                    resources: this.resourceManager.getResources(e.id),
                    entityCount: empireEntities.length,
                    shipCount,
                    soldierCount,
                    planetCount,
                    // 🌱 Underdog Bonus - smaller empires get production boost
                    underdogBonus: underdogBonus.multiplier > 1.0 ? {
                        multiplier: underdogBonus.multiplier,
                        label: underdogBonus.label,
                        bonusPercent: Math.round((underdogBonus.multiplier - 1) * 100)
                    } : null
                };
            }),
            entities: entities,
            entityPagination,
            diplomacy: this.diplomacy.getAllRelations(),
            pendingTrades: this.diplomacy.getAllPendingTrades(),  // Inter-empire trades
            fleetsInTransit: this.fleetManager.getFleetsInTransit(),
            starbases: this.starbaseManager.getAllStarbases(),
            tradeRoutes: this.tradeManager.serializeForClient(),
            pendingAnomalies: this.pendingAnomalies,
            pendingEspionageEvents: this.pendingEspionageEvents,
            activeCalamityEffects: this.calamityManager.getAllActiveEffects(),
            relics: this.relicManager.getAllRelics(),  // All relics for all empires
            council: this.council.getStatus(this.tick_count, this.empires),
            pendingCouncilEvents: this.pendingCouncilEvents,
            crisis: this.crisisManager.getStatus(this.entityManager),
            pendingCrisisEvents: this.pendingCrisisEvents,
            cycle: this.cycleManager.getState(this.tick_count),
            pendingCycleEvents: this.pendingCycleEvents,
            events: this.eventLog.slice(-50)
        };
    }

    // Get delta changes since a specific tick (for bandwidth optimization)
    getDelta(sinceTick) {
        // If too far behind, send full light state instead
        const oldestChange = this.changeLog[0]?.tick || this.tick_count;
        if (sinceTick < oldestChange || sinceTick < this.tick_count - this.SNAPSHOT_INTERVAL) {
            return {
                type: 'full',
                state: this.getLightState()
            };
        }

        // Gather changes since the requested tick
        const changes = this.changeLog.filter(c => c.tick > sinceTick);
        
        // Get current state of changed entities
        const changedEntityIds = new Set();
        const changedPlanetIds = new Set();
        const changedEmpireIds = new Set();
        
        changes.forEach(c => {
            if (c.type === 'entity') changedEntityIds.add(c.data.id);
            if (c.type === 'planet') changedPlanetIds.add(c.data.id);
            if (c.type === 'empire') changedEmpireIds.add(c.data.id);
        });

        return {
            type: 'delta',
            fromTick: sinceTick,
            toTick: this.tick_count,
            changes: {
                entities: this.entityManager.getAllEntities()
                    .filter(e => changedEntityIds.has(e.id)),
                planets: this.universe.planets
                    .filter(p => changedPlanetIds.has(p.id))
                    .map(p => ({ 
                        id: p.id, 
                        owner: p.owner, 
                        population: p.population 
                        // No surface in delta
                    })),
                empires: Array.from(this.empires.values())
                    .filter(e => changedEmpireIds.has(e.id))
                    .map(e => ({
                        ...e.serialize(),
                        resources: this.resourceManager.getResources(e.id)
                    })),
                events: this.eventLog.filter(e => e.tick > sinceTick).slice(-20),
                fleetsInTransit: this.fleetManager.getFleetsInTransit()
            }
        };
    }

    // Get planet surface (for lazy loading)
    getPlanetSurface(planetId) {
        return this.universe.getPlanetSurface(planetId);
    }

    getEmpires() {
        // Valid species list for auto-assignment
        const validSpecies = ['synthari', 'velthari', 'krath', 'mechani', 'pyronix', 
                              'aquari', 'umbral', 'terrax', 'celesti', 'voidborn'];
        
        return Array.from(this.empires.values()).map((e, index) => {
            // Auto-fix empires with missing or invalid species
            if (!e.speciesId || !this.speciesManager.getSpecies(e.speciesId)) {
                e.speciesId = validSpecies[index % validSpecies.length];
            }
            const speciesInfo = this.speciesManager.getSpeciesSummary(e.speciesId);
            const entities = this.entityManager.getEntitiesForEmpire(e.id);
            const shipCount = entities.filter(ent => ent.spaceUnit).length;
            const soldierCount = entities.filter(ent => ent.type === 'unit' && !ent.spaceUnit).length;
            const planetCount = this.universe.getPlanetsOwnedBy(e.id).length;
            
            // Get underdog bonus for this empire (catch-up mechanic)
            const underdogBonus = this.resourceManager.getUnderdogBonus(planetCount);
            
            return {
                ...e.serialize(),
                resources: this.resourceManager.getResources(e.id),
                entityCount: entities.length,
                shipCount,
                soldierCount,
                planetCount,
                // 🌱 Underdog Bonus - smaller empires get production boost
                underdogBonus: underdogBonus.multiplier > 1.0 ? {
                    multiplier: underdogBonus.multiplier,
                    label: underdogBonus.label,
                    bonusPercent: Math.round((underdogBonus.multiplier - 1) * 100)
                } : null,
                species: speciesInfo ? {
                    id: speciesInfo.id,
                    name: speciesInfo.name,
                    singular: speciesInfo.singular,
                    portrait: speciesInfo.portrait,
                    category: speciesInfo.category,
                    description: speciesInfo.description,
                    bonuses: speciesInfo.bonuses,
                    penalties: speciesInfo.penalties,
                    worldBonuses: speciesInfo.worldBonuses,
                    specialAbility: speciesInfo.specialAbility
                } : null
            };
        });
    }

    /**
     * Apply terrain feature effects (radiation damage, asteroid collisions, etc.)
     * Called every tick to damage/affect ships in dangerous terrain
     */
    applyTerrainEffects() {
        const terrainFeatures = this.universe.getAllTerrainFeatures();
        if (!terrainFeatures || terrainFeatures.length === 0) return;
        
        // Build a map of systemId -> terrain effects for quick lookup
        const systemEffects = new Map();
        for (const feature of terrainFeatures) {
            const effects = this.universe.getTerrainEffects(feature.systemId);
            if (effects) {
                systemEffects.set(feature.systemId, effects);
            }
        }
        
        // Process all entities
        const allEntities = this.entityManager.getAllEntities();
        const destroyed = [];
        
        for (const entity of allEntities) {
            // Only space units are affected by terrain
            if (!entity.spaceUnit) continue;
            
            // Find what system this entity is in
            const planet = this.universe.getPlanet(entity.location);
            if (!planet) continue;
            
            const effects = systemEffects.get(planet.systemId);
            if (!effects) continue;
            
            // Apply radiation damage from neutron stars
            if (effects.radiationDamage && effects.radiationDamage > 0) {
                const damage = effects.radiationDamage;
                entity.hp -= damage;
                
                if (entity.hp <= 0) {
                    destroyed.push(entity);
                    const empire = this.empires.get(entity.owner);
                    this.log('terrain', `${effects.icon} ${empire?.name || 'Unknown'}'s ${entity.name} destroyed by neutron star radiation!`);
                }
            }
            
            // Apply asteroid collision damage (random chance)
            if (effects.collisionChance && Math.random() < effects.collisionChance) {
                const damage = 10;  // Fixed collision damage
                entity.hp -= damage;
                
                if (entity.hp <= 0 && !destroyed.includes(entity)) {
                    destroyed.push(entity);
                    const empire = this.empires.get(entity.owner);
                    this.log('terrain', `🪨 ${empire?.name || 'Unknown'}'s ${entity.name} destroyed by asteroid collision!`);
                }
            }
        }
        
        // Remove destroyed entities
        for (const entity of destroyed) {
            this.entityManager.removeEntity(entity.id);
            this.recordChange('entity', { id: entity.id, destroyed: true });
        }
        
        // Also apply gravity siphon to fleets in transit through black holes
        const fleetsInTransit = this.fleetManager.getFleetsInTransit();
        for (const fleet of fleetsInTransit) {
            // Check if fleet path goes through any black hole systems
            const destPlanet = this.universe.getPlanet(fleet.destPlanetId);
            if (!destPlanet) continue;
            
            const effects = systemEffects.get(destPlanet.systemId);
            if (effects?.gravitySiphon) {
                // Drain energy from the empire
                const empire = this.empires.get(fleet.empireId);
                if (empire) {
                    const drain = effects.gravitySiphon;
                    this.resourceManager.deduct(fleet.empireId, { energy: drain });
                }
            }
        }
    }

    log(category, message) {
        const entry = {
            tick: this.tick_count,
            time: Date.now(),
            category,
            message
        };
        this.eventLog.push(entry);
        // Cap event log to prevent memory bloat
        if (this.eventLog.length > 200) {
            this.eventLog = this.eventLog.slice(-100);
        }
        console.log(`[${category.toUpperCase()}] ${message}`);
    }

    getRecentEvents(empireId, count = 10) {
        // Filter events relevant to this empire
        return this.eventLog
            .filter(e => !empireId || e.message.includes(this.empires.get(empireId)?.name))
            .slice(-count);
    }

    /**
     * Get optimized state for a specific empire (WebSocket agents)
     * Returns only data relevant to that empire with bandwidth optimization
     * MERGED: Combines bandwidth optimization with full bot decision data
     */
    getStateForEmpireLight(empireId) {
        const empire = this.empires.get(empireId);
        if (!empire) {
            return this.getLightState({ entityLimit: 500 });
        }
        
        // Get planets owned by this empire
        const myPlanets = this.universe.getPlanetsOwnedBy(empireId);
        const myPlanetIds = new Set(myPlanets.map(p => p.id));
        
        // Get entities on my planets (limited)
        const allEntities = this.entityManager.getAllEntities();
        const myEntities = allEntities
            .filter(e => myPlanetIds.has(e.location) || e.owner === empireId)
            .slice(0, 500)  // Cap at 500 entities
            .map(e => serializeEntityLight(e));
        
        // Get my fleets in transit
        const allFleets = this.fleetManager.getFleetsInTransit();
        
        // Get visible enemies (at war with me)
        const enemies = [];
        // getAllRelations() returns { relations: {...}, pendingProposals: [...] }
        // Convert relations object to array for iteration
        const relationsData = this.diplomacy.getAllRelations();
        const relationsArray = Object.values(relationsData.relations || {});
        for (const rel of relationsArray) {
            if (rel.status === 'war' && (rel.empire1 === empireId || rel.empire2 === empireId)) {
                enemies.push(rel.empire1 === empireId ? rel.empire2 : rel.empire1);
            }
        }
        
        // Get species info
        const speciesInfo = this.speciesManager.getSpeciesSummary(empire.speciesId);
        
        // Get underdog research bonus for this empire
        const underdogResearchBonus = this.techTree.getUnderdogResearchBonus(empireId, this.empires);
        
        return {
            tick: this.tick_count,
            paused: this.paused,
            universe: this.universe.serializeLight(),  // No surfaces
            empire: {
                ...empire.serialize(),
                resources: this.resourceManager.getResources(empireId),
                entityCount: myEntities.length,
                planetCount: myPlanets.length,
                species: speciesInfo
            },
            // Resources at top level for bot convenience
            resources: this.resourceManager.getResources(empireId),
            // Tech data for research decisions
            technologies: this.techTree.getResearched(empireId),
            availableTech: this.techTree.getAvailable(empireId),
            // 🔬 Underdog Research Bonus - struggling empires get cheaper research
            underdogResearchBonus: underdogResearchBonus.discount > 0 ? {
                discount: underdogResearchBonus.discount,
                discountPercent: Math.round(underdogResearchBonus.discount * 100),
                label: underdogResearchBonus.label,
                scoreRatio: underdogResearchBonus.scoreRatio
            } : null,
            empires: Array.from(this.empires.values()).map(e => ({
                id: e.id,
                name: e.name,
                color: e.color,
                score: e.score || 0,
                planetCount: this.universe.getPlanetsOwnedBy(e.id).length
            })),
            planets: myPlanets.map(p => ({
                id: p.id,
                name: p.name,
                systemId: p.systemId,
                owner: p.owner,
                population: p.population,
                maxPopulation: p.maxPopulation
            })),
            entities: myEntities,
            fleetsInTransit: allFleets,  // ALL fleets needed for UI map rendering
            diplomacy: relationsData,
            enemies,
            allies: relationsArray.filter(r => 
                r.status === 'alliance' && (r.empire1 === empireId || r.empire2 === empireId)
            ).map(r => r.empire1 === empireId ? r.empire2 : r.empire1),
            // Bot decision data
            council: this.council.getStatus(this.tick_count, this.empires),
            crisis: this.crisisManager.getStatus(this.entityManager),
            myStarbases: this.starbaseManager.getEmpireStarbases(empireId).map(s => ({
                ...s,
                buildQueue: s.buildQueue || [],
                canBuildShips: this.starbaseManager.canBuildShips(s.systemId)
            })),
            myAnomalies: this.anomalyManager.getAnomaliesForEmpire(empireId),
            mySpies: this.espionageManager.getSpiesForEmpire(empireId),
            recentEvents: this.getRecentEvents(empireId),
            // Ship Designer blueprints
            shipBlueprints: this.shipDesigner.getBlueprints(empireId)
        };
    }

    /**
     * Load game state from saved data
     * Used for persistence across server restarts
     */
    loadState(savedState) {
        if (!savedState) return false;

        try {
            console.log(`📂 Loading game state from tick ${savedState.tick}...`);

            // Restore tick counter
            this.tick_count = savedState.tick || 0;
            this.paused = savedState.paused || false;

            // Restore universe
            if (savedState.universe) {
                this.universe.loadState(savedState.universe);
            }

            // Restore empires
            if (savedState.empires) {
                this.empires.clear();
                savedState.empires.forEach(empireData => {
                    const empire = new Empire(empireData);
                    this.empires.set(empire.id, empire);
                    
                    // Restore resources
                    if (empireData.resources) {
                        this.resourceManager.setResources(empire.id, empireData.resources);
                    }
                });
            }

            // Restore entities
            if (savedState.entities) {
                this.entityManager.loadState(savedState.entities);
            }

            // Restore diplomacy
            if (savedState.diplomacy) {
                this.diplomacy.loadState(savedState.diplomacy);
            }

            // Restore inter-empire trades (separate from diplomacy relations)
            if (savedState.interEmpireTrades) {
                this.diplomacy.trades.clear();
                if (savedState.interEmpireTrades.trades) {
                    for (const trade of savedState.interEmpireTrades.trades) {
                        this.diplomacy.trades.set(trade.id, trade);
                    }
                }
                this.diplomacy.nextTradeId = savedState.interEmpireTrades.nextTradeId || 1;
                this.diplomacy.tradeHistory = savedState.interEmpireTrades.tradeHistory || [];
                console.log(`   📂 Trades: ${this.diplomacy.trades.size} pending trades loaded`);
            }

            // Restore event log
            if (savedState.events) {
                this.eventLog = savedState.events;
            }

            // Restore fleets in transit
            if (savedState.fleetsInTransit) {
                this.fleetManager.loadState({ fleetsInTransit: savedState.fleetsInTransit });
            }

            // Restore starbases
            if (savedState.starbases) {
                this.starbaseManager.loadState({ starbases: savedState.starbases });
            }

            // Restore trade routes
            if (savedState.tradeRoutes) {
                this.tradeManager.deserialize(savedState.tradeRoutes);
            }

            // Restore anomalies
            if (savedState.anomalies) {
                this.anomalyManager.loadState(savedState.anomalies);
            }

            // Restore calamities
            if (savedState.calamities) {
                this.calamityManager.loadState(savedState.calamities);
            }

            // Restore espionage
            if (savedState.espionage) {
                this.espionageManager.loadState(savedState.espionage);
            }

            // Restore relics
            if (savedState.relics) {
                this.relicManager.deserialize(savedState.relics);
            }

            // Restore Galactic Council
            if (savedState.council) {
                this.council.loadState(savedState.council);
            }

            // Restore Endgame Crisis
            if (savedState.crisis) {
                this.crisisManager.load(savedState.crisis);
            }

            // Restore Galactic Cycles
            if (savedState.cycle) {
                this.cycleManager.fromJSON(savedState.cycle);
            } else {
                this.cycleManager.initialize(this.tick_count);
            }

            // Restore Ship Designer blueprints
            if (savedState.shipDesigner) {
                this.shipDesigner.loadState(savedState.shipDesigner);
            }

            // MIGRATION: Fix any owned planets with bad terrain (Feb 2026)
            // Ensures all empire home planets have buildable terrain
            console.log(`   🔍 Checking ${this.universe.planets.length} planets for terrain issues...`);
            let checkedOwned = 0;
            let fixedPlanets = 0;
            for (const planet of this.universe.planets) {
                if (planet.owner) {
                    checkedOwned++;
                    const hasBuildable = this.universe.hasBuildableTerrain(planet);
                    if (!hasBuildable) {
                        console.log(`   🔧 Fixing bad terrain on ${planet.name} (owned by ${planet.owner})`);
                        this.universe.ensureBuildableTerrain(planet);
                        fixedPlanets++;
                    }
                }
            }
            console.log(`   📊 Checked ${checkedOwned} owned planets, fixed ${fixedPlanets} with bad terrain`);
            if (fixedPlanets > 0) {
                console.log(`   ✅ Fixed ${fixedPlanets} planets with unbuildable terrain`);
            }

            this.log('game', `Game state restored from save (tick ${this.tick_count})`);
            return true;
        } catch (err) {
            console.error('Failed to load game state:', err);
            return false;
        }
    }

    /**
     * Get tick budget monitor statistics
     * Useful for monitoring and debugging performance issues
     */
    getTickBudgetStats() {
        return this.tickBudgetMonitor.getStats();
    }

    /**
     * Reset tick budget monitor stats
     */
    resetTickBudgetStats() {
        this.tickBudgetMonitor.reset();
    }
}
