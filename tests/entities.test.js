import { EntityManager } from '../core/entities.js';

describe('EntityManager', () => {
  let entityManager;

  beforeEach(() => {
    entityManager = new EntityManager();
  });

  describe('initialization', () => {
    test('should have entity definitions', () => {
      expect(entityManager.definitions).toBeDefined();
      expect(entityManager.definitions.mine).toBeDefined();
      expect(entityManager.definitions.soldier).toBeDefined();
    });

    test('should start with empty entities', () => {
      expect(entityManager.entities.size).toBe(0);
    });
  });

  describe('definitions', () => {
    test('structures should have required properties', () => {
      const structures = ['mine', 'power_plant', 'farm', 'barracks', 'shipyard'];
      
      structures.forEach(name => {
        const def = entityManager.definitions[name];
        expect(def.type).toBe('structure');
        expect(def.cost).toBeDefined();
        expect(def.hp).toBeGreaterThan(0);
        expect(def.icon).toBeDefined();
        expect(Array.isArray(def.validTerrain)).toBe(true);
      });
    });

    test('units should have required properties', () => {
      const units = ['soldier', 'scout', 'fighter', 'transport'];
      
      units.forEach(name => {
        const def = entityManager.definitions[name];
        expect(def.type).toBe('unit');
        expect(def.cost).toBeDefined();
        expect(def.hp).toBeGreaterThan(0);
      });
    });

    test('space units should be marked', () => {
      const spaceUnits = ['fighter', 'transport', 'colony_ship', 'battleship'];
      
      spaceUnits.forEach(name => {
        const def = entityManager.definitions[name];
        expect(def.spaceUnit).toBe(true);
      });
    });
  });

  describe('createEntity()', () => {
    test('should create entity with correct properties', () => {
      const entity = entityManager.createEntity('mine', 'empire_0', 'planet_0');
      
      expect(entity.id).toBeDefined();
      expect(entity.defName).toBe('mine');
      expect(entity.owner).toBe('empire_0');
      expect(entity.location).toBe('planet_0');
      expect(entity.hp).toBe(100);
    });

    test('should store entity in map', () => {
      const entity = entityManager.createEntity('mine', 'empire_0', 'planet_0');
      expect(entityManager.getEntity(entity.id)).toBe(entity);
    });

    test('should generate unique IDs', () => {
      const entity1 = entityManager.createEntity('mine', 'empire_0', 'planet_0');
      const entity2 = entityManager.createEntity('mine', 'empire_0', 'planet_0');
      
      expect(entity1.id).not.toBe(entity2.id);
    });

    test('should copy production from definition', () => {
      const entity = entityManager.createEntity('mine', 'empire_0', 'planet_0');
      expect(entity.production.minerals).toBe(5);
    });
  });

  describe('createStructure()', () => {
    test('should create structure entity', () => {
      const entity = entityManager.createStructure('mine', 'empire_0', 'planet_0');
      expect(entity.defName).toBe('mine');
    });
  });

  describe('createUnit()', () => {
    test('should create unit entity', () => {
      const entity = entityManager.createUnit('soldier', 'empire_0', 'planet_0');
      expect(entity.defName).toBe('soldier');
    });
  });

  describe('getEntity()', () => {
    test('should return entity by id', () => {
      const entity = entityManager.createEntity('mine', 'empire_0', 'planet_0');
      const retrieved = entityManager.getEntity(entity.id);
      expect(retrieved).toBe(entity);
    });

    test('should return undefined for unknown id', () => {
      const result = entityManager.getEntity('nonexistent');
      expect(result).toBeUndefined();
    });
  });

  describe('removeEntity()', () => {
    test('should remove entity', () => {
      const entity = entityManager.createEntity('mine', 'empire_0', 'planet_0');
      entityManager.removeEntity(entity.id);
      expect(entityManager.getEntity(entity.id)).toBeUndefined();
    });
  });

  describe('getEntitiesForEmpire()', () => {
    beforeEach(() => {
      entityManager.createEntity('mine', 'empire_0', 'planet_0');
      entityManager.createEntity('farm', 'empire_0', 'planet_0');
      entityManager.createEntity('mine', 'empire_1', 'planet_1');
    });

    test('should return entities for specific empire', () => {
      const entities = entityManager.getEntitiesForEmpire('empire_0');
      expect(entities).toHaveLength(2);
      entities.forEach(e => expect(e.owner).toBe('empire_0'));
    });

    test('should return empty array for empire with no entities', () => {
      const entities = entityManager.getEntitiesForEmpire('empire_99');
      expect(entities).toHaveLength(0);
    });
  });

  describe('getEntitiesAtLocation()', () => {
    beforeEach(() => {
      entityManager.createEntity('mine', 'empire_0', 'planet_0');
      entityManager.createEntity('farm', 'empire_0', 'planet_0');
      entityManager.createEntity('mine', 'empire_1', 'planet_1');
    });

    test('should return entities at location', () => {
      const entities = entityManager.getEntitiesAtLocation('planet_0');
      expect(entities).toHaveLength(2);
    });

    test('should return empty array for empty location', () => {
      const entities = entityManager.getEntitiesAtLocation('planet_99');
      expect(entities).toHaveLength(0);
    });
  });

  describe('getAllEntities()', () => {
    test('should return all entities', () => {
      entityManager.createEntity('mine', 'empire_0', 'planet_0');
      entityManager.createEntity('farm', 'empire_1', 'planet_1');
      
      const all = entityManager.getAllEntities();
      expect(all).toHaveLength(2);
    });
  });

  describe('getBuildCost()', () => {
    test('should return cost for structure', () => {
      const cost = entityManager.getBuildCost('mine');
      expect(cost).toBeDefined();
      expect(cost.minerals).toBeGreaterThan(0);
    });

    test('should return empty object for unknown type', () => {
      const cost = entityManager.getBuildCost('unknown');
      expect(cost).toEqual({});
    });
  });

  describe('getTrainCost()', () => {
    test('should return cost for unit', () => {
      const cost = entityManager.getTrainCost('soldier');
      expect(cost).toBeDefined();
    });
  });

  describe('findValidTile()', () => {
    const mockPlanet = {
      id: 'planet_0',
      name: 'Test Planet',
      surface: Array(32).fill(null).map(() => 
        Array(32).fill(null).map(() => ({ type: 'plains', building: null }))
      )
    };

    test('should find valid tile for structure', () => {
      const tile = entityManager.findValidTile(mockPlanet, 'mine');
      
      expect(tile).toBeDefined();
      expect(tile.x).toBeDefined();
      expect(tile.y).toBeDefined();
    });

    test('should return null for structure with no valid terrain', () => {
      // All tiles are plains, fishing_dock needs water
      const tile = entityManager.findValidTile(mockPlanet, 'fishing_dock');
      expect(tile).toBeNull();
    });

    test('should return null for planet without surface', () => {
      const planetNoSurface = { id: 'planet_x' };
      const tile = entityManager.findValidTile(planetNoSurface, 'mine');
      expect(tile).toBeNull();
    });
  });

  describe('placeStructureAt()', () => {
    const mockPlanet = {
      id: 'planet_0',
      name: 'Test Planet',
      surface: Array(32).fill(null).map(() => 
        Array(32).fill(null).map(() => ({ type: 'plains', building: null }))
      )
    };

    test('should place structure at valid position', () => {
      const result = entityManager.placeStructureAt(mockPlanet, 'mine', 'empire_0', 5, 5);
      
      expect(result.success).toBe(true);
      expect(result.structure).toBeDefined();
    });

    test('should mark tile as occupied', () => {
      entityManager.placeStructureAt(mockPlanet, 'mine', 'empire_0', 5, 5);
      
      expect(mockPlanet.surface[5][5].building).toBe('mine');
    });

    test('should reject invalid grid position', () => {
      const result = entityManager.placeStructureAt(mockPlanet, 'mine', 'empire_0', 100, 100);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid');
    });

    test('should reject occupied tile', () => {
      entityManager.placeStructureAt(mockPlanet, 'mine', 'empire_0', 10, 10);
      const result = entityManager.placeStructureAt(mockPlanet, 'farm', 'empire_0', 10, 10);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('occupied');
    });

    test('should reject invalid terrain', () => {
      mockPlanet.surface[15][15].type = 'water';
      const result = entityManager.placeStructureAt(mockPlanet, 'mine', 'empire_0', 15, 15);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('water');
    });
  });

  describe('createStartingUnits()', () => {
    const mockPlanet = {
      id: 'planet_0',
      name: 'Test Planet',
      surface: Array(32).fill(null).map(() => 
        Array(32).fill(null).map(() => ({ type: 'plains', building: null }))
      )
    };

    test('should create starting units for empire', () => {
      entityManager.createStartingUnits('empire_0', mockPlanet);
      const entities = entityManager.getEntitiesForEmpire('empire_0');
      
      expect(entities.length).toBeGreaterThan(0);
    });

    test('should create structures and units', () => {
      entityManager.createStartingUnits('empire_0', mockPlanet);
      const entities = entityManager.getEntitiesForEmpire('empire_0');
      
      const structures = entities.filter(e => entityManager.definitions[e.defName].type === 'structure');
      const units = entities.filter(e => entityManager.definitions[e.defName].type === 'unit');
      
      expect(structures.length).toBeGreaterThan(0);
      expect(units.length).toBeGreaterThan(0);
    });
  });
});
