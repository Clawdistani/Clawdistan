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
        this.eventLog = [];
        this.pendingAnomalies = []; // Anomalies discovered this tick (for broadcasting)
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

            // Create starting units
            this.entityManager.createStartingUnits(empire.id, planet);
        });

        this.log('game', 'Universe initialized with ' + this.empires.size + ' empires');
    }

    tick() {
        if (this.paused) return;

        this.tick_count++;

        // Resource generation (with species modifiers)
        this.empires.forEach((empire, id) => {
            this.resourceManager.generateResources(
                id, 
                this.universe, 
                this.entityManager,
                this.speciesManager,
                empire.speciesId
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

        // Combat resolution
        const combatResults = this.combatSystem.resolveAllCombat(
            this.entityManager,
            this.universe
        );

        combatResults.forEach(result => {
            this.log('combat', result.description);
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
            case 'declare_war':
                this.diplomacy.declareWar(empireId, targetEmpire);
                this.log('diplomacy', `${empire.name} declared war on ${target.name}`);
                break;
            case 'propose_peace':
                this.diplomacy.proposePeace(empireId, targetEmpire);
                this.log('diplomacy', `${empire.name} proposed peace to ${target.name}`);
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
            this.fleetManager
        );

        if (result.success) {
            // Log the outcome
            this.log('anomaly', `${empire.name}: ${result.message}`);
            
            // Track changes
            this.recordChange('anomaly', { id: anomalyId, resolved: true });
            if (Object.keys(result.rewards).length > 0) {
                this.recordChange('empire', { id: empireId });
            }
        }

        return result;
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
            myFleets: this.fleetManager.getEmpiresFleets(empireId),
            allFleets: this.fleetManager.getFleetsInTransit(),
            myStarbases: this.starbaseManager.getEmpireStarbases(empireId),
            allStarbases: this.starbaseManager.getAllStarbases(),
            myAnomalies: this.anomalyManager.getAnomaliesForEmpire(empireId),
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
            fleetsInTransit: this.fleetManager.getFleetsInTransit(),
            starbases: this.starbaseManager.getAllStarbases(),
            tradeRoutes: this.tradeManager.serialize(),  // Full data for saving
            anomalies: this.anomalyManager.serialize(),
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
            fleetsInTransit: this.fleetManager.getFleetsInTransit(),
            starbases: this.starbaseManager.getAllStarbases(),
            tradeRoutes: this.tradeManager.serializeForClient(),
            pendingAnomalies: this.pendingAnomalies,
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

            this.log('game', `Game state restored from save (tick ${this.tick_count})`);
            return true;
        } catch (err) {
            console.error('Failed to load game state:', err);
            return false;
        }
    }
}
