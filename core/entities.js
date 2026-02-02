let entityIdCounter = 0;

export class EntityManager {
    constructor() {
        this.entities = new Map();
        this.definitions = this.loadDefinitions();
    }

    loadDefinitions() {
        return {
            // Structures
            mine: {
                type: 'structure',
                name: 'Mine',
                cost: { minerals: 50, energy: 20 },
                production: { minerals: 5 },
                hp: 100
            },
            power_plant: {
                type: 'structure',
                name: 'Power Plant',
                cost: { minerals: 60, energy: 10 },
                production: { energy: 8 },
                hp: 80
            },
            farm: {
                type: 'structure',
                name: 'Farm',
                cost: { minerals: 30, energy: 10 },
                production: { food: 10 },
                hp: 50
            },
            research_lab: {
                type: 'structure',
                name: 'Research Lab',
                cost: { minerals: 100, energy: 50 },
                production: { research: 5 },
                hp: 60
            },
            barracks: {
                type: 'structure',
                name: 'Barracks',
                cost: { minerals: 80, energy: 30 },
                canTrain: ['soldier', 'scout'],
                hp: 150
            },
            shipyard: {
                type: 'structure',
                name: 'Shipyard',
                cost: { minerals: 200, energy: 100 },
                canTrain: ['fighter', 'colony_ship', 'battleship'],
                hp: 200
            },
            fortress: {
                type: 'structure',
                name: 'Fortress',
                cost: { minerals: 300, energy: 100 },
                hp: 500,
                attack: 30,
                range: 2
            },

            // Units
            scout: {
                type: 'unit',
                name: 'Scout',
                cost: { minerals: 20, food: 5 },
                hp: 30,
                attack: 5,
                speed: 3,
                range: 1,
                vision: 3
            },
            soldier: {
                type: 'unit',
                name: 'Soldier',
                cost: { minerals: 30, food: 10 },
                hp: 50,
                attack: 15,
                speed: 2,
                range: 1,
                vision: 2
            },
            fighter: {
                type: 'unit',
                name: 'Fighter',
                cost: { minerals: 80, energy: 30 },
                hp: 60,
                attack: 25,
                speed: 5,
                range: 2,
                vision: 3,
                spaceUnit: true
            },
            colony_ship: {
                type: 'unit',
                name: 'Colony Ship',
                cost: { minerals: 150, food: 50, energy: 50 },
                hp: 80,
                attack: 0,
                speed: 2,
                range: 0,
                vision: 2,
                spaceUnit: true,
                canColonize: true
            },
            battleship: {
                type: 'unit',
                name: 'Battleship',
                cost: { minerals: 300, energy: 100 },
                hp: 200,
                attack: 50,
                speed: 2,
                range: 3,
                vision: 4,
                spaceUnit: true
            }
        };
    }

    createEntity(defName, owner, location, overrides = {}) {
        const def = this.definitions[defName];
        if (!def) throw new Error(`Unknown entity type: ${defName}`);

        const entity = {
            id: `entity_${++entityIdCounter}`,
            defName,
            type: def.type,
            name: def.name,
            owner,
            location,
            hp: def.hp,
            maxHp: def.hp,
            attack: def.attack || 0,
            speed: def.speed || 0,
            range: def.range || 0,
            vision: def.vision || 1,
            production: def.production || null,
            canTrain: def.canTrain || null,
            spaceUnit: def.spaceUnit || false,
            canColonize: def.canColonize || false,
            movement: null, // Current movement path
            target: null,   // Current attack target
            constructing: null, // What's being built
            constructionProgress: 0,
            ...overrides
        };

        this.entities.set(entity.id, entity);
        return entity;
    }

    createStructure(type, owner, location) {
        return this.createEntity(type, owner, location);
    }

    createUnit(type, owner, location) {
        return this.createEntity(type, owner, location);
    }

    createStartingUnits(empireId, planet, minimal = false) {
        // Create initial structures and units
        if (minimal) {
            // Just a basic colony
            this.createStructure('power_plant', empireId, planet.id);
            this.createStructure('farm', empireId, planet.id);
            this.createUnit('scout', empireId, planet.id);
        } else {
            // Full starting base
            this.createStructure('power_plant', empireId, planet.id);
            this.createStructure('mine', empireId, planet.id);
            this.createStructure('farm', empireId, planet.id);
            this.createStructure('barracks', empireId, planet.id);
            this.createUnit('scout', empireId, planet.id);
            this.createUnit('scout', empireId, planet.id);
            this.createUnit('soldier', empireId, planet.id);
        }
    }

    getEntity(entityId) {
        return this.entities.get(entityId);
    }

    removeEntity(entityId) {
        this.entities.delete(entityId);
    }

    getEntitiesForEmpire(empireId) {
        return Array.from(this.entities.values()).filter(e => e.owner === empireId);
    }

    getEntitiesAtLocation(locationId) {
        return Array.from(this.entities.values()).filter(e => e.location === locationId);
    }

    getAllEntities() {
        return Array.from(this.entities.values());
    }

    getBuildCost(type) {
        const def = this.definitions[type];
        return def ? def.cost : {};
    }

    getTrainCost(type) {
        return this.getBuildCost(type);
    }

    setMovement(entityId, path) {
        const entity = this.entities.get(entityId);
        if (entity) {
            entity.movement = {
                path,
                currentIndex: 0,
                progress: 0
            };
        }
    }

    setTarget(entityId, targetId) {
        const entity = this.entities.get(entityId);
        if (entity) {
            entity.target = targetId;
        }
    }

    update(tick) {
        // Update all entities
        this.entities.forEach(entity => {
            // Handle movement
            if (entity.movement && entity.movement.path) {
                entity.movement.progress += entity.speed * 0.1;
                if (entity.movement.progress >= 1) {
                    entity.movement.currentIndex++;
                    entity.movement.progress = 0;

                    if (entity.movement.currentIndex >= entity.movement.path.length) {
                        // Movement complete
                        entity.location = entity.movement.path[entity.movement.path.length - 1];
                        entity.movement = null;
                    } else {
                        entity.location = entity.movement.path[entity.movement.currentIndex];
                    }
                }
            }

            // Handle construction progress
            if (entity.constructing) {
                entity.constructionProgress += 0.1;
                if (entity.constructionProgress >= 1) {
                    // Construction complete - create the new entity
                    this.createEntity(entity.constructing, entity.owner, entity.location);
                    entity.constructing = null;
                    entity.constructionProgress = 0;
                }
            }
        });
    }

    getVisibleEnemies(empireId, visibleUniverse) {
        const visibleLocations = new Set([
            ...visibleUniverse.planets.map(p => p.id),
            ...visibleUniverse.systems.map(s => s.id)
        ]);

        return Array.from(this.entities.values()).filter(e =>
            e.owner !== empireId &&
            e.location &&
            visibleLocations.has(e.location)
        );
    }

    damageEntity(entityId, damage) {
        const entity = this.entities.get(entityId);
        if (entity) {
            entity.hp -= damage;
            if (entity.hp <= 0) {
                this.removeEntity(entityId);
                return true; // Destroyed
            }
        }
        return false;
    }

    loadState(savedEntities) {
        if (!savedEntities) return;
        
        this.entities.clear();
        
        let maxId = 0;
        savedEntities.forEach(entity => {
            this.entities.set(entity.id, entity);
            
            // Track highest ID for counter
            const idNum = parseInt(entity.id.replace('entity_', ''));
            if (!isNaN(idNum) && idNum > maxId) {
                maxId = idNum;
            }
        });
        
        // Update counter to avoid ID collisions
        entityIdCounter = maxId;
        
        console.log(`   📂 Entities: ${this.entities.size} loaded`);
    }
}
