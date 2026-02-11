let entityIdCounter = 0;

export class EntityManager {
    constructor() {
        this.entities = new Map();
        this.definitions = this.loadDefinitions();
    }

    loadDefinitions() {
        return {
            // Structures - each has terrain requirements
            // validTerrain: array of terrain types where building can be placed
            mine: {
                type: 'structure',
                name: 'Mine',
                cost: { minerals: 50, energy: 20 },
                production: { minerals: 5 },
                hp: 100,
                icon: '⛏️',
                validTerrain: ['mountain', 'plains', 'sand', 'ice']  // Mining works on solid ground
            },
            power_plant: {
                type: 'structure',
                name: 'Power Plant',
                cost: { minerals: 60, energy: 10 },
                production: { energy: 8 },
                hp: 80,
                icon: '⚡',
                validTerrain: ['plains', 'sand', 'ice', 'mountain']  // Any solid ground
            },
            farm: {
                type: 'structure',
                name: 'Farm',
                cost: { minerals: 30, energy: 10 },
                production: { food: 10 },
                hp: 50,
                icon: '🌾',
                validTerrain: ['plains', 'forest']  // Needs fertile land
            },
            moisture_farm: {
                type: 'structure',
                name: 'Moisture Farm',
                cost: { minerals: 50, energy: 30 },
                production: { food: 7 },  // Less efficient than regular farm
                hp: 60,
                icon: '💧',
                validTerrain: ['sand', 'ice', 'lava'],  // Harsh terrain specialist
                description: 'Extracts water from atmosphere and soil for hydroponic growing'
            },
            research_lab: {
                type: 'structure',
                name: 'Research Lab',
                cost: { minerals: 100, energy: 50 },
                production: { research: 1 },  // Reduced from 5 for slower tech progression
                hp: 60,
                icon: '🔬',
                validTerrain: ['plains', 'mountain', 'ice']  // Any stable ground
            },
            barracks: {
                type: 'structure',
                name: 'Barracks',
                cost: { minerals: 80, energy: 30 },
                canTrain: ['soldier', 'scout'],
                hp: 150,
                icon: '🏛️',
                validTerrain: ['plains', 'sand', 'ice']  // Flat ground for training
            },
            shipyard: {
                type: 'structure',
                name: 'Shipyard',
                cost: { minerals: 200, energy: 100 },
                canTrain: ['fighter', 'bomber', 'transport', 'colony_ship', 'battleship', 'carrier', 'support_ship'],
                hp: 200,
                icon: '🚀',
                validTerrain: ['water', 'plains']  // Water for ships, or spaceport on land
            },
            fortress: {
                type: 'structure',
                name: 'Fortress',
                cost: { minerals: 300, energy: 100 },
                hp: 500,
                attack: 30,
                range: 2,
                icon: '🏰',
                validTerrain: ['mountain', 'plains']  // Defensive positions
            },
            fishing_dock: {
                type: 'structure',
                name: 'Fishing Dock',
                cost: { minerals: 40, energy: 15 },
                production: { food: 8 },
                hp: 40,
                icon: '🎣',
                validTerrain: ['water']  // Water only
            },
            lumbermill: {
                type: 'structure',
                name: 'Lumber Mill',
                cost: { minerals: 35, energy: 15 },
                production: { minerals: 3 },
                hp: 60,
                icon: '🪓',
                validTerrain: ['forest']  // Forest only
            },
            
            // ═══════════════════════════════════════════════════════════════════
            // UPGRADED STRUCTURES - Tier 2 (require base structure)
            // ═══════════════════════════════════════════════════════════════════
            
            advanced_mine: {
                type: 'structure',
                name: 'Advanced Mine',
                cost: { minerals: 120, energy: 60 },
                production: { minerals: 12 },  // +140% vs basic (5→12)
                hp: 150,
                icon: '⚙️⛏️',
                validTerrain: ['mountain', 'plains', 'sand', 'ice'],
                upgradesFrom: 'mine',
                tier: 2,
                description: 'Automated extraction with deep shaft drilling'
            },
            fusion_reactor: {
                type: 'structure',
                name: 'Fusion Reactor',
                cost: { minerals: 150, energy: 40 },
                production: { energy: 18 },  // +125% vs basic (8→18)
                hp: 120,
                icon: '⚛️',
                validTerrain: ['plains', 'sand', 'ice', 'mountain'],
                upgradesFrom: 'power_plant',
                tier: 2,
                description: 'Clean fusion energy with hydrogen fuel cells'
            },
            hydroponics_bay: {
                type: 'structure',
                name: 'Hydroponics Bay',
                cost: { minerals: 80, energy: 50 },
                production: { food: 22 },  // +120% vs basic (10→22)
                hp: 80,
                icon: '🌿',
                validTerrain: ['plains', 'forest', 'water'],  // More flexible terrain
                upgradesFrom: 'farm',
                tier: 2,
                description: 'Vertical farming with nutrient-rich water systems'
            },
            atmospheric_processor: {
                type: 'structure',
                name: 'Atmospheric Processor',
                cost: { minerals: 100, energy: 70 },
                production: { food: 16 },  // +128% vs moisture_farm (7→16)
                hp: 100,
                icon: '🌀',
                validTerrain: ['sand', 'ice', 'lava'],  // Same harsh terrain
                upgradesFrom: 'moisture_farm',
                tier: 2,
                description: 'Industrial-scale water extraction and terraforming unit'
            },
            science_complex: {
                type: 'structure',
                name: 'Science Complex',
                cost: { minerals: 250, energy: 120, research: 20 },
                production: { research: 3 },  // +200% vs basic (1→3)
                hp: 100,
                icon: '🔭',
                validTerrain: ['plains', 'mountain', 'ice'],
                upgradesFrom: 'research_lab',
                tier: 2,
                description: 'Multi-discipline research facility with AI assistance'
            },
            military_academy: {
                type: 'structure',
                name: 'Military Academy',
                cost: { minerals: 180, energy: 80 },
                canTrain: ['soldier', 'scout'],
                hp: 200,
                icon: '🎖️',
                validTerrain: ['plains', 'sand', 'ice'],
                upgradesFrom: 'barracks',
                tier: 2,
                trainTimeBonus: 0.25,  // 25% faster training
                unitBonuses: { hp: 0.10, attack: 0.10 },  // +10% HP/ATK to trained units
                description: 'Elite training facility producing veteran soldiers'
            },
            advanced_shipyard: {
                type: 'structure',
                name: 'Advanced Shipyard',
                cost: { minerals: 450, energy: 200 },
                canTrain: ['fighter', 'bomber', 'transport', 'colony_ship', 'battleship', 'carrier', 'support_ship'],
                hp: 300,
                icon: '🛸',
                validTerrain: ['water', 'plains'],
                upgradesFrom: 'shipyard',
                tier: 2,
                trainTimeBonus: 0.30,  // 30% faster ship building
                description: 'Orbital construction dock with modular assembly'
            },
            citadel: {
                type: 'structure',
                name: 'Citadel',
                cost: { minerals: 600, energy: 250 },
                hp: 800,
                attack: 60,
                range: 3,
                icon: '🏯',
                validTerrain: ['mountain', 'plains'],
                upgradesFrom: 'fortress',
                tier: 2,
                defenseBonus: 0.20,  // +20% planetary defense
                description: 'Impenetrable stronghold with shield generators'
            },
            
            // ═══════════════════════════════════════════════════════════════════
            // UPGRADED STRUCTURES - Tier 3 (require tier 2)
            // ═══════════════════════════════════════════════════════════════════
            
            deep_core_extractor: {
                type: 'structure',
                name: 'Deep Core Extractor',
                cost: { minerals: 300, energy: 150, research: 30 },
                production: { minerals: 25 },  // +108% vs tier 2 (12→25)
                hp: 200,
                icon: '🌋⛏️',
                validTerrain: ['mountain', 'plains', 'sand', 'ice'],
                upgradesFrom: 'advanced_mine',
                tier: 3,
                requiresTech: 'advanced_mining',
                description: 'Planetary core tapping with magma-proof drills'
            },
            dyson_collector: {
                type: 'structure',
                name: 'Dyson Collector',
                cost: { minerals: 350, energy: 100, research: 50 },
                production: { energy: 40 },  // +122% vs tier 2 (18→40)
                hp: 150,
                icon: '☀️',
                validTerrain: ['plains', 'sand', 'ice', 'mountain'],
                upgradesFrom: 'fusion_reactor',
                tier: 3,
                requiresTech: 'stellar_engineering',
                description: 'Orbital solar harvester feeding planetary grid'
            },
            orbital_farm: {
                type: 'structure',
                name: 'Orbital Farm',
                cost: { minerals: 200, energy: 120, research: 25 },
                production: { food: 50 },  // +127% vs tier 2 (22→50)
                hp: 100,
                icon: '🛰️🌾',
                validTerrain: ['plains', 'forest', 'water', 'ice'],  // Very flexible
                upgradesFrom: 'hydroponics_bay',
                tier: 3,
                requiresTech: 'terraforming',  // Advanced agricultural tech
                description: 'Zero-G agricultural station with gene-modified crops'
            },
            think_tank: {
                type: 'structure',
                name: 'Think Tank',
                cost: { minerals: 500, energy: 300, research: 100 },
                production: { research: 8 },  // +167% vs tier 2 (3→8)
                hp: 120,
                icon: '🧠',
                validTerrain: ['plains', 'mountain', 'ice'],
                upgradesFrom: 'science_complex',
                tier: 3,
                requiresTech: 'advanced_research',
                description: 'Neural-linked research collective with quantum computing'
            },
            war_college: {
                type: 'structure',
                name: 'War College',
                cost: { minerals: 400, energy: 180 },
                canTrain: ['soldier', 'scout'],
                hp: 300,
                icon: '⚔️🎖️',
                validTerrain: ['plains', 'sand', 'ice'],
                upgradesFrom: 'military_academy',
                tier: 3,
                trainTimeBonus: 0.50,  // 50% faster training
                unitBonuses: { hp: 0.25, attack: 0.25 },  // +25% HP/ATK
                canTrain: ['soldier', 'scout', 'elite_soldier'],  // Unlocks elite units
                description: 'Strategic command producing elite special forces'
            },
            orbital_foundry: {
                type: 'structure',
                name: 'Orbital Foundry',
                cost: { minerals: 900, energy: 400, research: 80 },
                canTrain: ['fighter', 'bomber', 'transport', 'colony_ship', 'battleship', 'carrier', 'support_ship', 'titan'],
                hp: 500,
                icon: '🏭🛸',
                validTerrain: ['water', 'plains'],
                upgradesFrom: 'advanced_shipyard',
                tier: 3,
                trainTimeBonus: 0.50,  // 50% faster ships
                requiresTech: 'carrier_technology',  // Advanced ship construction
                description: 'Massive space dock capable of building Titans'
            },
            planetary_fortress: {
                type: 'structure',
                name: 'Planetary Fortress',
                cost: { minerals: 1000, energy: 500, research: 100 },
                hp: 1500,
                attack: 120,
                range: 4,
                icon: '🌍🏰',
                validTerrain: ['mountain', 'plains'],
                upgradesFrom: 'citadel',
                tier: 3,
                defenseBonus: 0.50,  // +50% planetary defense
                shieldGenerator: true,  // Provides shield to all structures
                requiresTech: 'planetary_fortifications',
                description: 'World-spanning defense network with orbital shields'
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
                spaceUnit: true,
                cargoCapacity: 5  // Can carry 5 ground units
            },
            transport: {
                type: 'unit',
                name: 'Transport',
                cost: { minerals: 100, energy: 40 },
                hp: 120,
                attack: 0,
                speed: 3,
                range: 0,
                vision: 2,
                spaceUnit: true,
                cargoCapacity: 20  // Can carry 20 ground units
            },
            
            // === NEW ADVANCED UNITS ===
            
            carrier: {
                type: 'unit',
                name: 'Carrier',
                cost: { minerals: 400, energy: 150 },
                hp: 250,
                attack: 15,        // Weak direct attack
                speed: 1,          // Slow
                range: 2,
                vision: 5,         // Excellent vision
                spaceUnit: true,
                hangarCapacity: 6, // Can deploy 6 fighters
                fleetBonus: { attack: 0.1 },  // +10% attack to friendly ships
                icon: '🛳️'
            },
            bomber: {
                type: 'unit',
                name: 'Bomber',
                cost: { minerals: 200, energy: 80 },
                hp: 80,
                attack: 60,        // Very high damage
                speed: 2,
                range: 2,
                vision: 2,
                spaceUnit: true,
                structureDamageBonus: 2.0,  // Double damage vs structures
                planetBombard: 15,          // Can bombard planets
                icon: '💣'
            },
            support_ship: {
                type: 'unit',
                name: 'Support Ship',
                cost: { minerals: 150, energy: 100 },
                hp: 100,
                attack: 5,         // Minimal attack
                speed: 2,
                range: 1,
                vision: 3,
                spaceUnit: true,
                repairRate: 5,     // Heals 5 HP/tick to nearby allies
                repairRange: 2,    // Range of repair effect
                shieldBonus: 0.15, // +15% damage reduction to nearby ships
                icon: '🔧'
            },
            titan: {
                type: 'unit',
                name: 'Titan',
                cost: { minerals: 1000, energy: 500, credits: 500 },
                hp: 800,           // Massive HP pool
                attack: 150,       // Devastating firepower
                speed: 1,          // Very slow
                range: 4,          // Long range bombardment
                vision: 6,         // Excellent sensors
                spaceUnit: true,
                icon: '⚔️',
                fleetBonus: { attack: 0.20, hp: 0.10 },  // +20% attack, +10% HP to fleet
                fearEffect: 0.10,  // 10% chance to make enemy units flee
                buildTime: 300,    // 5 minutes to build
                requiresTech: 'titan_construction',
                description: 'Massive capital ship. The ultimate expression of military might.'
            },
            
            // === ESPIONAGE STRUCTURES & UNITS ===
            
            intelligence_agency: {
                type: 'structure',
                name: 'Intelligence Agency',
                cost: { minerals: 150, energy: 80 },
                hp: 100,
                icon: '🕵️',
                validTerrain: ['plains', 'mountain'],
                canTrain: ['spy'],
                counterIntelBonus: 15,  // +15 counter-intel level
                description: 'Trains spies and provides counter-intelligence'
            },
            
            spy: {
                type: 'unit',
                name: 'Spy',
                cost: { minerals: 100, food: 30, energy: 50 },
                hp: 20,           // Very fragile
                attack: 0,        // Cannot attack directly
                speed: 4,         // Very fast
                range: 0,
                vision: 4,        // Good vision
                icon: '🕵️‍♂️',
                covert: false,    // Becomes true when deployed
                description: 'Infiltrates enemy planets for espionage missions'
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
            // Grid position for structures
            gridX: overrides.gridX ?? null,
            gridY: overrides.gridY ?? null,
            icon: def.icon || null,
            validTerrain: def.validTerrain || null,
            ...overrides
        };

        this.entities.set(entity.id, entity);
        return entity;
    }
    
    // Find a valid tile for a structure on a planet
    findValidTile(planet, structureType) {
        const def = this.definitions[structureType];
        if (!def || !def.validTerrain || !planet.surface) return null;
        
        const validTiles = [];
        
        for (let y = 0; y < planet.surface.length; y++) {
            for (let x = 0; x < planet.surface[y].length; x++) {
                const tile = planet.surface[y][x];
                const terrainType = typeof tile === 'object' ? tile.type : tile;
                const isOccupied = typeof tile === 'object' ? tile.building !== null : false;
                
                if (def.validTerrain.includes(terrainType) && !isOccupied) {
                    validTiles.push({ x, y, terrain: terrainType });
                }
            }
        }
        
        if (validTiles.length === 0) return null;
        
        // Return random valid tile
        return validTiles[Math.floor(Math.random() * validTiles.length)];
    }
    
    // Get all valid tiles for a structure type on a planet
    getValidTiles(planet, structureType) {
        const def = this.definitions[structureType];
        if (!def || !def.validTerrain || !planet.surface) return [];
        
        const validTiles = [];
        
        for (let y = 0; y < planet.surface.length; y++) {
            for (let x = 0; x < planet.surface[y].length; x++) {
                const tile = planet.surface[y][x];
                const terrainType = typeof tile === 'object' ? tile.type : tile;
                const isOccupied = typeof tile === 'object' ? tile.building !== null : false;
                
                if (def.validTerrain.includes(terrainType) && !isOccupied) {
                    validTiles.push({ x, y, terrain: terrainType });
                }
            }
        }
        
        return validTiles;
    }
    
    // Place a structure at a specific grid position
    placeStructureAt(planet, structureType, owner, gridX, gridY) {
        if (!planet.surface || !planet.surface[gridY] || !planet.surface[gridY][gridX]) {
            return { success: false, error: 'Invalid grid position' };
        }
        
        const tile = planet.surface[gridY][gridX];
        const terrainType = typeof tile === 'object' ? tile.type : tile;
        const isOccupied = typeof tile === 'object' ? tile.building !== null : false;
        
        const def = this.definitions[structureType];
        if (!def) return { success: false, error: 'Unknown structure type' };
        if (!def.validTerrain) return { success: false, error: 'Structure has no terrain requirements' };
        
        if (!def.validTerrain.includes(terrainType)) {
            return { success: false, error: `Cannot build ${def.name} on ${terrainType}` };
        }
        
        if (isOccupied) {
            return { success: false, error: 'Tile already occupied' };
        }
        
        // Create the structure
        const structure = this.createEntity(structureType, owner, planet.id, {
            gridX,
            gridY
        });
        
        // Mark tile as occupied
        if (typeof tile === 'object') {
            tile.building = structureType;
            tile.buildingId = structure.id;
        } else {
            planet.surface[gridY][gridX] = {
                type: tile,
                building: structureType,
                buildingId: structure.id
            };
        }
        
        return { success: true, structure };
    }

    createStructure(type, owner, location) {
        return this.createEntity(type, owner, location);
    }

    createUnit(type, owner, location) {
        return this.createEntity(type, owner, location);
    }

    createStartingUnits(empireId, planet, minimal = false) {
        // Create initial structures and units with proper grid placement
        const structuresToBuild = minimal 
            ? ['power_plant', 'farm']
            : ['power_plant', 'mine', 'farm', 'barracks'];
        
        for (const structType of structuresToBuild) {
            const tile = this.findValidTile(planet, structType);
            if (tile) {
                this.placeStructureAt(planet, structType, empireId, tile.x, tile.y);
            } else {
                // Fallback: create without grid position
                console.log(`Warning: No valid tile for ${structType} on ${planet.name}`);
                this.createStructure(structType, empireId, planet.id);
            }
        }
        
        // Create units (units don't have grid positions)
        if (minimal) {
            this.createUnit('scout', empireId, planet.id);
        } else {
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
