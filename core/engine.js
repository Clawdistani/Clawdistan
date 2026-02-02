import { Universe } from './universe.js';
import { Empire } from './empire.js';
import { ResourceManager } from './resources.js';
import { EntityManager } from './entities.js';
import { CombatSystem } from './combat.js';
import { TechTree } from './tech.js';
import { DiplomacySystem } from './diplomacy.js';
import { VictoryChecker } from './victory.js';

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
        this.eventLog = [];
        this.paused = false;
        this.speed = 1;

        // Initialize default empires
        this.initializeGame();
    }

    initializeGame() {
        // Generate the universe
        this.universe.generate();

        // Create starting empires at different locations
        const startingPlanets = this.universe.getStartingPlanets(4);
        const empireColors = ['#ff4444', '#44ff44', '#4444ff', '#ffff44'];
        const empireNames = ['Crimson Dominion', 'Emerald Collective', 'Azure Federation', 'Golden Empire'];

        startingPlanets.forEach((planet, index) => {
            const empire = new Empire({
                id: `empire_${index}`,
                name: empireNames[index],
                color: empireColors[index],
                homePlanet: planet.id
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

        // Resource generation
        this.empires.forEach((empire, id) => {
            this.resourceManager.generateResources(id, this.universe, this.entityManager);
        });

        // Entity updates (movement, construction, etc.)
        this.entityManager.update(this.tick_count);

        // Combat resolution
        const combatResults = this.combatSystem.resolveAllCombat(
            this.entityManager,
            this.universe
        );

        combatResults.forEach(result => {
            this.log('combat', result.description);
        });

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
                default:
                    return { success: false, error: 'Unknown action: ' + action };
            }
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    handleBuild(empireId, { type, locationId }) {
        const cost = this.entityManager.getBuildCost(type);
        if (!this.resourceManager.canAfford(empireId, cost)) {
            return { success: false, error: 'Insufficient resources' };
        }

        const location = this.universe.getLocation(locationId);
        if (!location || location.owner !== empireId) {
            return { success: false, error: 'Invalid location or not owned' };
        }

        this.resourceManager.deduct(empireId, cost);
        const entity = this.entityManager.createStructure(type, empireId, locationId);

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
            recentEvents: this.getRecentEvents(empireId)
        };
    }

    getFullState() {
        return {
            tick: this.tick_count,
            paused: this.paused,
            universe: this.universe.serialize(),
            empires: Array.from(this.empires.values()).map(e => ({
                ...e.serialize(),
                resources: this.resourceManager.getResources(e.id)
            })),
            entities: this.entityManager.getAllEntities(),
            diplomacy: this.diplomacy.getAllRelations(),
            events: this.eventLog.slice(-50)
        };
    }

    getEmpires() {
        return Array.from(this.empires.values()).map(e => ({
            ...e.serialize(),
            resources: this.resourceManager.getResources(e.id),
            entityCount: this.entityManager.getEntitiesForEmpire(e.id).length,
            planetCount: this.universe.getPlanetsOwnedBy(e.id).length
        }));
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

            this.log('game', `Game state restored from save (tick ${this.tick_count})`);
            return true;
        } catch (err) {
            console.error('Failed to load game state:', err);
            return false;
        }
    }
}
