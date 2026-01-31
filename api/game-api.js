// Game API - Interface for agents to interact with the game
// This module defines the API contract that OpenClaw agents will use

export class GameAPI {
    constructor(gameEngine, empireId) {
        this.engine = gameEngine;
        this.empireId = empireId;
    }

    // ============ QUERIES ============

    // Get complete game state visible to this empire
    getGameState() {
        return this.engine.getStateForEmpire(this.empireId);
    }

    // Get empire's current resources
    getResources() {
        return this.engine.resourceManager.getResources(this.empireId);
    }

    // Get empire status
    getEmpireStatus() {
        const empire = this.engine.empires.get(this.empireId);
        if (!empire) return null;

        return {
            ...empire.serialize(),
            resources: this.getResources(),
            planets: this.engine.universe.getPlanetsOwnedBy(this.empireId).length,
            units: this.engine.entityManager.getEntitiesForEmpire(this.empireId).length,
            technologies: this.engine.techTree.getResearched(this.empireId).length,
            allies: this.engine.diplomacy.getAllies(this.empireId),
            enemies: this.engine.diplomacy.getEnemies(this.empireId)
        };
    }

    // Get all entities owned by this empire
    getEntities() {
        return this.engine.entityManager.getEntitiesForEmpire(this.empireId);
    }

    // Get visible enemy entities
    getVisibleEnemies() {
        const visibleUniverse = this.engine.universe.getVisibleFor(
            this.empireId,
            this.engine.entityManager
        );
        return this.engine.entityManager.getVisibleEnemies(this.empireId, visibleUniverse);
    }

    // Get available actions the agent can take
    getAvailableActions() {
        const actions = [];
        const resources = this.getResources();
        const entities = this.getEntities();

        // What can be built
        const buildable = ['mine', 'power_plant', 'farm', 'research_lab', 'barracks', 'shipyard', 'fortress'];
        buildable.forEach(type => {
            const cost = this.engine.entityManager.getBuildCost(type);
            if (this.engine.resourceManager.canAfford(this.empireId, cost)) {
                actions.push({
                    type: 'build',
                    subtype: type,
                    cost,
                    locations: this.engine.universe.getPlanetsOwnedBy(this.empireId).map(p => p.id)
                });
            }
        });

        // What units can be trained
        entities.forEach(entity => {
            if (entity.canTrain) {
                entity.canTrain.forEach(unitType => {
                    const cost = this.engine.entityManager.getTrainCost(unitType);
                    if (this.engine.resourceManager.canAfford(this.empireId, cost)) {
                        actions.push({
                            type: 'train',
                            subtype: unitType,
                            cost,
                            location: entity.location
                        });
                    }
                });
            }
        });

        // Research options
        const availableTech = this.engine.techTree.getAvailable(this.empireId);
        availableTech.forEach(tech => {
            if (this.engine.resourceManager.canAfford(this.empireId, { research: tech.cost })) {
                actions.push({
                    type: 'research',
                    tech: tech.id,
                    cost: { research: tech.cost }
                });
            }
        });

        // Movement actions for mobile units
        const mobileUnits = entities.filter(e => e.speed > 0);
        mobileUnits.forEach(unit => {
            actions.push({
                type: 'move',
                entityId: unit.id,
                currentLocation: unit.location
            });
        });

        // Attack actions
        const combatUnits = entities.filter(e => e.attack > 0);
        const enemies = this.getVisibleEnemies();
        combatUnits.forEach(unit => {
            enemies.forEach(enemy => {
                actions.push({
                    type: 'attack',
                    entityId: unit.id,
                    targetId: enemy.id
                });
            });
        });

        // Colonization
        const colonyShips = entities.filter(e => e.canColonize);
        const uncolonizedPlanets = this.engine.universe.planets.filter(p => !p.owner);
        colonyShips.forEach(ship => {
            actions.push({
                type: 'colonize',
                shipId: ship.id,
                availablePlanets: uncolonizedPlanets.map(p => p.id)
            });
        });

        // Diplomacy
        const otherEmpires = Array.from(this.engine.empires.keys()).filter(id => id !== this.empireId);
        otherEmpires.forEach(otherId => {
            const relation = this.engine.diplomacy.getRelation(this.empireId, otherId);
            if (relation === 'neutral') {
                actions.push({ type: 'diplomacy', action: 'propose_alliance', target: otherId });
                actions.push({ type: 'diplomacy', action: 'declare_war', target: otherId });
            } else if (relation === 'war') {
                actions.push({ type: 'diplomacy', action: 'propose_peace', target: otherId });
            } else if (relation === 'allied') {
                actions.push({ type: 'diplomacy', action: 'break_alliance', target: otherId });
            }
        });

        return actions;
    }

    // Get technology tree status
    getTechStatus() {
        return {
            researched: this.engine.techTree.getResearched(this.empireId),
            available: this.engine.techTree.getAvailable(this.empireId),
            effects: this.engine.techTree.getEffects(this.empireId)
        };
    }

    // Get diplomatic relations
    getDiplomacy() {
        return this.engine.diplomacy.getRelationsFor(this.empireId);
    }

    // Get victory progress
    getVictoryProgress() {
        return this.engine.victoryChecker.getProgress(
            this.empireId,
            this.engine.empires,
            this.engine.universe,
            this.engine.resourceManager
        );
    }

    // ============ ACTIONS ============

    // Build a structure
    build(type, locationId) {
        return this.engine.executeAction(this.empireId, 'build', { type, locationId });
    }

    // Train a unit
    train(type, locationId) {
        return this.engine.executeAction(this.empireId, 'train', { type, locationId });
    }

    // Move an entity
    move(entityId, destination) {
        return this.engine.executeAction(this.empireId, 'move', { entityId, destination });
    }

    // Attack a target
    attack(entityId, targetId) {
        return this.engine.executeAction(this.empireId, 'attack', { entityId, targetId });
    }

    // Research a technology
    research(techId) {
        return this.engine.executeAction(this.empireId, 'research', { techId });
    }

    // Colonize a planet
    colonize(shipId, planetId) {
        return this.engine.executeAction(this.empireId, 'colonize', { shipId, planetId });
    }

    // Diplomatic actions
    proposeAlliance(targetEmpire) {
        return this.engine.executeAction(this.empireId, 'diplomacy', {
            action: 'propose_alliance',
            targetEmpire
        });
    }

    declareWar(targetEmpire) {
        return this.engine.executeAction(this.empireId, 'diplomacy', {
            action: 'declare_war',
            targetEmpire
        });
    }

    proposePeace(targetEmpire) {
        return this.engine.executeAction(this.empireId, 'diplomacy', {
            action: 'propose_peace',
            targetEmpire
        });
    }
}

// API method documentation for agents
export const API_DOCS = {
    queries: [
        { method: 'getGameState', description: 'Get complete game state visible to your empire' },
        { method: 'getResources', description: 'Get current resources (energy, minerals, food, research, credits)' },
        { method: 'getEmpireStatus', description: 'Get empire overview including score and relations' },
        { method: 'getEntities', description: 'Get all units and structures you own' },
        { method: 'getVisibleEnemies', description: 'Get enemy entities you can see' },
        { method: 'getAvailableActions', description: 'Get list of all actions you can currently take' },
        { method: 'getTechStatus', description: 'Get research status and available technologies' },
        { method: 'getDiplomacy', description: 'Get diplomatic relations with other empires' },
        { method: 'getVictoryProgress', description: 'Get progress towards victory conditions' }
    ],
    actions: [
        { method: 'build(type, locationId)', description: 'Build a structure at a planet' },
        { method: 'train(type, locationId)', description: 'Train a unit at a structure' },
        { method: 'move(entityId, destination)', description: 'Move a unit to a location' },
        { method: 'attack(entityId, targetId)', description: 'Attack an enemy entity' },
        { method: 'research(techId)', description: 'Research a technology' },
        { method: 'colonize(shipId, planetId)', description: 'Colonize a planet with a colony ship' },
        { method: 'proposeAlliance(empireId)', description: 'Propose alliance to another empire' },
        { method: 'declareWar(empireId)', description: 'Declare war on another empire' },
        { method: 'proposePeace(empireId)', description: 'Propose peace to end a war' }
    ]
};
