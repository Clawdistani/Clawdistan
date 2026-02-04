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
      const entity = entityManager.createEntity('mine', 'empire_0', 'planet_0', 5, 5);
      
      expect(entity.id).toBeDefined();
      expect(entity.defName).toBe('mine');
      expect(entity.owner).toBe('empire_0');
      expect(entity.location).toBe('planet_0');
      expect(entity.x).toBe(5);
      expect(entity.y).toBe(5);
      expect(entity.hp).toBe(100);
    });

    test('should store entity in map', () => {
      const entity = entityManager.createEntity('mine', 'empire_0', 'planet_0', 5, 5);
      expect(entityManager.getEntity(entity.id)).toBe(entity);
    });

    test('should increment entity IDs', () => {
      const entity1 = entityManager.createEntity('mine', 'empire_0', 'planet_0', 5, 5);
      const entity2 = entityManager.createEntity('mine', 'empire_0', 'planet_0', 6, 6);
      
      expect(entity1.id).not.toBe(entity2.id);
    });

    test('should copy production from definition', () => {
      const entity = entityManager.createEntity('mine', 'empire_0', 'planet_0', 5, 5);
      expect(entity.production.minerals).toBe(5);
    });
  });

  describe('getEntity()', () => {
    test('should return entity by id', () => {
      const entity = entityManager.createEntity('mine', 'empire_0', 'planet_0', 5, 5);
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
      const entity = entityManager.createEntity('mine', 'empire_0', 'planet_0', 5, 5);
      entityManager.removeEntity(entity.id);
      expect(entityManager.getEntity(entity.id)).toBeUndefined();
    });
  });

  describe('getEntitiesForEmpire()', () => {
    beforeEach(() => {
      entityManager.createEntity('mine', 'empire_0', 'planet_0', 5, 5);
      entityManager.createEntity('farm', 'empire_0', 'planet_0', 6, 6);
      entityManager.createEntity('mine', 'empire_1', 'planet_1', 5, 5);
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
      entityManager.createEntity('mine', 'empire_0', 'planet_0', 5, 5);
      entityManager.createEntity('farm', 'empire_0', 'planet_0', 6, 6);
      entityManager.createEntity('mine', 'empire_1', 'planet_1', 5, 5);
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
      entityManager.createEntity('mine', 'empire_0', 'planet_0', 5, 5);
      entityManager.createEntity('farm', 'empire_1', 'planet_1', 6, 6);
      
      const all = entityManager.getAllEntities();
      expect(all).toHaveLength(2);
    });
  });

  describe('canBuildAt()', () => {
    const mockSurface = {
      tiles: Array(32).fill(null).map(() => 
        Array(32).fill(null).map(() => ({ terrain: 'plains', building: null }))
      )
    };

    test('should allow building on valid terrain', () => {
      const result = entityManager.canBuildAt('mine', mockSurface, 5, 5);
      expect(result.canBuild).toBe(true);
    });

    test('should reject building on occupied tile', () => {
      mockSurface.tiles[5][5].building = { id: 'existing' };
      const result = entityManager.canBuildAt('mine', mockSurface, 5, 5);
      expect(result.canBuild).toBe(false);
      expect(result.reason).toContain('occupied');
      mockSurface.tiles[5][5].building = null; // reset
    });

    test('should reject building on invalid terrain', () => {
      mockSurface.tiles[5][5].terrain = 'water';
      const result = entityManager.canBuildAt('mine', mockSurface, 5, 5);
      expect(result.canBuild).toBe(false);
      expect(result.reason).toContain('terrain');
      mockSurface.tiles[5][5].terrain = 'plains'; // reset
    });

    test('should reject out of bounds coordinates', () => {
      const result = entityManager.canBuildAt('mine', mockSurface, 50, 50);
      expect(result.canBuild).toBe(false);
    });

    test('should allow fishing dock only on water', () => {
      mockSurface.tiles[5][5].terrain = 'water';
      const result = entityManager.canBuildAt('fishing_dock', mockSurface, 5, 5);
      expect(result.canBuild).toBe(true);
      mockSurface.tiles[5][5].terrain = 'plains';
    });

    test('should allow lumbermill only on forest', () => {
      mockSurface.tiles[5][5].terrain = 'forest';
      const result = entityManager.canBuildAt('lumbermill', mockSurface, 5, 5);
      expect(result.canBuild).toBe(true);
    });
  });

  describe('createStartingUnits()', () => {
    const mockPlanet = {
      id: 'planet_0',
      surface: {
        tiles: Array(32).fill(null).map(() => 
          Array(32).fill(null).map(() => ({ terrain: 'plains', building: null }))
        )
      }
    };

    test('should create starting units for empire', () => {
      entityManager.createStartingUnits('empire_0', mockPlanet);
      const entities = entityManager.getEntitiesForEmpire('empire_0');
      
      expect(entities.length).toBeGreaterThan(0);
    });

    test('should create headquarters', () => {
      entityManager.createStartingUnits('empire_0', mockPlanet);
      const entities = entityManager.getEntitiesForEmpire('empire_0');
      
      const hq = entities.find(e => e.defName === 'headquarters');
      expect(hq).toBeDefined();
    });
  });

  describe('trainUnit()', () => {
    let mockBarracks;
    
    beforeEach(() => {
      mockBarracks = entityManager.createEntity('barracks', 'empire_0', 'planet_0', 10, 10);
    });

    test('should create new unit from barracks', () => {
      const result = entityManager.trainUnit(mockBarracks.id, 'soldier');
      expect(result.success).toBe(true);
      expect(result.entity).toBeDefined();
      expect(result.entity.defName).toBe('soldier');
    });

    test('should reject training from non-training structure', () => {
      const mine = entityManager.createEntity('mine', 'empire_0', 'planet_0', 5, 5);
      const result = entityManager.trainUnit(mine.id, 'soldier');
      expect(result.success).toBe(false);
    });

    test('should reject training unit not in canTrain list', () => {
      const result = entityManager.trainUnit(mockBarracks.id, 'battleship');
      expect(result.success).toBe(false);
    });
  });
});
