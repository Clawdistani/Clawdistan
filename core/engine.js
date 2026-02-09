import { Universe } from './universe.js';
import { Empire } from './empire.js';
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
import { RelicManager, RELIC_DEFINITIONS } from './relics.js';
import { GalacticCouncil } from './council.js';

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
        this.eventLog = [];
        this.pendingAnomalies = []; // Anomalies discovered this tick (for broadcasting)
        this.pendingEspionageEvents = []; // Espionage events this tick
        this.pendingCouncilEvents = []; // Council events this tick
        this.paused = false;
        this.speed = 1;

        // Delta tracking for bandwidth optimization
        this.changeLog = [];           // Track all changes
        this.lastSnapshotTick = 0;     // Last full state snapshot tick
        this.SNAPSHOT_INTERVAL = 300;  // Full snapshot every 300 ticks (5 min buffer)

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
                speciesId: startingSpecies[index]
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
        const empireName = name || defaultNames[empireIndex % defaultNames.length] + ` ${empireIndex}`;
        
        // Find an unclaimed planet for home world
        const unclaimedPlanets = this.universe.planets.filter(p => !p.owner);
        if (unclaimedPlanets.length === 0) {
            console.log(`⚠️ Cannot create empire - no unclaimed planets available`);
            return null;
        }
        
        // Pick a planet (prefer ones far from other empires)
        const homePlanet = unclaimedPlanets[Math.floor(Math.random() * unclaimedPlanets.length)];
        
        // Pick a random species
        const speciesList = ['synthari', 'velthari', 'krath', 'mechani', 'aetheri', 
                            'drakonid', 'florani', 'lithoid', 'psykari', 'quantari'];
        const speciesId = speciesList[empireIndex % speciesList.length];
        
        // Create the empire
        const empire = new Empire({
            id: empireId,
            name: empireName,
            color: color,
            homePlanet: homePlanet.id,
            speciesId: speciesId
        });
        
        this.empires.set(empire.id, empire);
        homePlanet.owner = empire.id;
        
        // Give starting resources
        this.resourceManager.initializeEmpire(empire.id);
        
        // Initialize relic tracking
        this.relicManager.initializeEmpire(empire.id);
        
        // Create starting units
        this.entityManager.createStartingUnits(empire.id, homePlanet);
        
        console.log(`🏛️ New empire created: ${empireName} (${empireId}) on ${homePlanet.name}`);
        this.log('game', `New empire rises: ${empireName}`);
        
        return empireId;
    }

    tick() {
        if (this.paused) return;

        this.tick_count++;

        // Update planetary orbits (orbital mechanics)
        this.universe.updateOrbits(1); // 1 second per tick

        // Resource generation (with species + relic modifiers)
        this.empires.forEach((empire, id) => {
            this.resourceManager.generateResources(
                id, 
                this.universe, 
                this.entityManager,
                this.speciesManager,
                empire.speciesId,
                this.relicManager
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

        // Fleet movement processing
        const arrivedFleets = this.fleetManager.tick(this.tick_count);
        this.pendingAnomalies = []; // Clear pending anomalies from last tick
        
        for (const fleet of arrivedFleets) {
            const result = this.fleetManager.processArrival(fleet, this.combatSystem);
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
            
            if (result.type === 'combat') {
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

        // Calamity processing - random disasters on planets
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

        // Espionage processing - spy missions, detection, counter-intel
        this.pendingEspionageEvents = [];
        
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

        // Galactic Council processing - periodic elections for Supreme Leader
        this.pendingCouncilEvents = [];
        const councilResult = this.council.tick(
            this.tick_count,
            this.empires,
            (empireId) => this.universe.planets.filter(p => p.owner === empireId).length,
            this.resourceManager,
            this.diplomacy
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

        // Check victory conditions
        const victor = this.victoryChecker.check(this.empires, this.universe);
        if (victor) {
            this.log('victory', `${victor.name} has achieved victory!`);
            this.paused = true;
        }

        // Emit tick event for any listeners
        this.onTick?.(this.tick_count);
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

        const cost = { research: tech.cost };
        if (!this.resourceManager.canAfford(empireId, cost)) {
            return { success: false, error: 'Insufficient research points' };
        }

        this.resourceManager.deduct(empireId, cost);
        this.techTree.complete(empireId, techId);

        this.log('research', `${empire.name} researched ${tech.name}`);
        return { success: true, data: { tech } };
    }

    handleColonize(empireId, { shipId, planetId }) {
        const ship = this.entityManager.getEntity(shipId);
        const planet = this.universe.getPlanet(planetId);

        if (!ship || ship.owner !== empireId || ship.type !== 'colony_ship') {
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
            const relation = this.diplomacy.getRelation(empireId, planet.owner);
            if (relation === 'allied') {
                return { success: false, error: 'Cannot invade allied planets' };
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
            
            // Move surviving attackers to the planet
            validAttackers.forEach(unit => {
                if (this.entityManager.getEntity(unit.id)) {
                    unit.location = planetId;
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

        const result = this.fleetManager.launchFleet(
            empireId,
            originPlanetId,
            destPlanetId,
            shipIds || [],
            cargoUnitIds || [],
            this.tick_count
        );

        if (result.success) {
            const destPlanet = this.universe.getPlanet(destPlanetId);
            this.log('fleet', `${empire.name} launched fleet to ${destPlanet?.name || 'unknown'} (ETA: ${result.travelTime} ticks)`);
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
            this.relicManager
        );

        if (result.success) {
            // Log the outcome
            this.log('anomaly', `${empire.name}: ${result.message}`);
            
            // Log relic discovery
            if (result.relicDiscovered) {
                this.log('relic', `${empire.name} discovered ${result.relicDiscovered.icon} ${result.relicDiscovered.name}!`);
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

        const result = this.diplomacy.acceptTrade(empireId, tradeId, canAffordFn, transferFn);

        if (result.success) {
            const fromEmpire = this.empires.get(result.trade.from);
            const toEmpire = this.empires.get(result.trade.to);
            
            const offerStr = Object.entries(result.trade.offer)
                .map(([r, v]) => `${v} ${r}`)
                .join(', ');
            const requestStr = Object.entries(result.trade.request)
                .map(([r, v]) => `${v} ${r}`)
                .join(', ');
            
            this.log('trade', `✅ Trade complete! ${fromEmpire?.name} → ${toEmpire?.name}: [${offerStr}] ↔ [${requestStr}]`);
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

        return {
            tick: this.tick_count,
            empire: empire.serialize(),
            resources: this.resourceManager.getResources(empireId),
            technologies: this.techTree.getResearched(empireId),
            availableTech: this.techTree.getAvailable(empireId),
            universe: visibleUniverse,
            entities: ownEntities,
            visibleEnemies,
            diplomacy: this.diplomacy.getRelationsFor(empireId),
            trades: this.diplomacy.getTradesFor(empireId),
            myFleets: this.fleetManager.getEmpiresFleets(empireId),
            allFleets: this.fleetManager.getFleetsInTransit(),
            myStarbases: this.starbaseManager.getEmpireStarbases(empireId),
            allStarbases: this.starbaseManager.getAllStarbases(),
            myAnomalies: this.anomalyManager.getAnomaliesForEmpire(empireId),
            mySpies: this.espionageManager.getSpiesForEmpire(empireId),
            myIntel: this.espionageManager.getIntelForEmpire(empireId),
            missionLog: this.espionageManager.getMissionLog(empireId),
            recentEvents: this.getRecentEvents(empireId)
        };
    }

    // Full state with all planet surfaces (used for persistence/saving)
    getFullState() {
        return {
            tick: this.tick_count,
            paused: this.paused,
            universe: this.universe.serialize(),  // Includes surfaces for saving
            empires: Array.from(this.empires.values()).map(e => ({
                ...e.serialize(),
                resources: this.resourceManager.getResources(e.id),
                entityCount: this.entityManager.getEntitiesForEmpire(e.id).length,
                planetCount: this.universe.getPlanetsOwnedBy(e.id).length
            })),
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
            events: this.eventLog.slice(-50)
        };
    }

    // Light state for clients (excludes planet surfaces - fetch on demand)
    getLightState() {
        return {
            tick: this.tick_count,
            paused: this.paused,
            universe: this.universe.serializeLight(),  // No surfaces
            empires: Array.from(this.empires.values()).map(e => ({
                ...e.serialize(),
                resources: this.resourceManager.getResources(e.id),
                entityCount: this.entityManager.getEntitiesForEmpire(e.id).length,
                planetCount: this.universe.getPlanetsOwnedBy(e.id).length
            })),
            entities: this.entityManager.getAllEntities(),
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
        return Array.from(this.empires.values()).map(e => {
            const speciesInfo = e.speciesId 
                ? this.speciesManager.getSpeciesSummary(e.speciesId) 
                : null;
            return {
                ...e.serialize(),
                resources: this.resourceManager.getResources(e.id),
                entityCount: this.entityManager.getEntitiesForEmpire(e.id).length,
                planetCount: this.universe.getPlanetsOwnedBy(e.id).length,
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
        console.log(`[${category.toUpperCase()}] ${message}`);
    }

    getRecentEvents(empireId, count = 10) {
        // Filter events relevant to this empire
        return this.eventLog
            .filter(e => !empireId || e.message.includes(this.empires.get(empireId)?.name))
            .slice(-count);
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

            this.log('game', `Game state restored from save (tick ${this.tick_count})`);
            return true;
        } catch (err) {
            console.error('Failed to load game state:', err);
            return false;
        }
    }
}
