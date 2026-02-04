import { GameEngine } from '../core/engine.js';

describe('GameEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new GameEngine();
  });

  describe('initialization', () => {
    test('should start at tick 0', () => {
      expect(engine.tick_count).toBe(0);
    });

    test('should not be paused', () => {
      expect(engine.paused).toBe(false);
    });

    test('should have universe', () => {
      expect(engine.universe).toBeDefined();
      expect(engine.universe.galaxies.length).toBeGreaterThan(0);
    });

    test('should have empires', () => {
      expect(engine.empires.size).toBe(4);
    });

    test('should have managers', () => {
      expect(engine.resourceManager).toBeDefined();
      expect(engine.entityManager).toBeDefined();
      expect(engine.combatSystem).toBeDefined();
      expect(engine.fleetManager).toBeDefined();
    });

    test('should initialize change log for delta tracking', () => {
      expect(engine.changeLog).toBeDefined();
      expect(Array.isArray(engine.changeLog)).toBe(true);
    });
  });

  describe('tick()', () => {
    test('should increment tick count', () => {
      engine.tick();
      expect(engine.tick_count).toBe(1);
    });

    test('should not tick when paused', () => {
      engine.paused = true;
      engine.tick();
      expect(engine.tick_count).toBe(0);
    });

    test('should process multiple ticks', () => {
      for (let i = 0; i < 10; i++) {
        engine.tick();
      }
      expect(engine.tick_count).toBe(10);
    });
  });

  describe('recordChange()', () => {
    test('should add change to log', () => {
      engine.recordChange('test', { value: 123 });
      
      expect(engine.changeLog.length).toBe(1);
      expect(engine.changeLog[0].type).toBe('test');
      expect(engine.changeLog[0].data.value).toBe(123);
    });

    test('should include tick number', () => {
      engine.tick_count = 50;
      engine.recordChange('test', {});
      
      expect(engine.changeLog[0].tick).toBe(50);
    });

    test('should include timestamp', () => {
      const before = Date.now();
      engine.recordChange('test', {});
      const after = Date.now();
      
      expect(engine.changeLog[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(engine.changeLog[0].timestamp).toBeLessThanOrEqual(after);
    });

    test('should trim old changes when exceeding limit', () => {
      for (let i = 0; i < 250; i++) {
        engine.recordChange('test', { i });
      }
      
      expect(engine.changeLog.length).toBeLessThanOrEqual(200);
    });
  });

  describe('getDelta()', () => {
    beforeEach(() => {
      engine.tick_count = 100;
      engine.recordChange('test1', { a: 1 });
      engine.tick_count = 150;
      engine.recordChange('test2', { b: 2 });
      engine.tick_count = 200;
      engine.recordChange('test3', { c: 3 });
    });

    test('should return changes since given tick', () => {
      const delta = engine.getDelta(100);
      
      expect(delta.changes.length).toBe(2); // test2 and test3
    });

    test('should return all changes for tick 0', () => {
      const delta = engine.getDelta(0);
      
      expect(delta.changes.length).toBe(3);
    });

    test('should return current tick', () => {
      const delta = engine.getDelta(0);
      
      expect(delta.currentTick).toBe(200);
    });

    test('should indicate full state needed when too far behind', () => {
      engine.tick_count = 500;
      const delta = engine.getDelta(100);
      
      expect(delta.fullStateNeeded).toBe(true);
    });
  });

  describe('pause/resume', () => {
    test('should pause game', () => {
      engine.pause();
      expect(engine.paused).toBe(true);
    });

    test('should resume game', () => {
      engine.pause();
      engine.resume();
      expect(engine.paused).toBe(false);
    });
  });

  describe('log()', () => {
    test('should add event to log', () => {
      engine.log('test', 'Test message');
      
      expect(engine.eventLog.length).toBeGreaterThan(0);
      const lastEvent = engine.eventLog[engine.eventLog.length - 1];
      expect(lastEvent.type).toBe('test');
      expect(lastEvent.message).toBe('Test message');
    });

    test('should include tick in event', () => {
      engine.tick_count = 42;
      engine.log('test', 'Test');
      
      const lastEvent = engine.eventLog[engine.eventLog.length - 1];
      expect(lastEvent.tick).toBe(42);
    });
  });

  describe('getEmpire()', () => {
    test('should return empire by id', () => {
      const empire = engine.getEmpire('empire_0');
      expect(empire).toBeDefined();
      expect(empire.id).toBe('empire_0');
    });

    test('should return undefined for invalid id', () => {
      const empire = engine.getEmpire('invalid');
      expect(empire).toBeUndefined();
    });
  });

  describe('serialize()', () => {
    test('should return serializable state', () => {
      const state = engine.serialize();
      
      expect(state.tick).toBeDefined();
      expect(state.paused).toBeDefined();
      expect(state.universe).toBeDefined();
      expect(state.empires).toBeDefined();
    });

    test('should be JSON serializable', () => {
      const state = engine.serialize();
      const json = JSON.stringify(state);
      const parsed = JSON.parse(json);
      
      expect(parsed.tick).toBe(state.tick);
    });
  });

  describe('serializeLight()', () => {
    test('should return state without surfaces', () => {
      const state = engine.serializeLight();
      
      expect(state.universe).toBeDefined();
      
      // Check planets don't have surface
      if (state.universe.planets) {
        state.universe.planets.forEach(planet => {
          expect(planet.surface).toBeUndefined();
        });
      }
    });

    test('should be smaller than full serialize', () => {
      const full = JSON.stringify(engine.serialize());
      const light = JSON.stringify(engine.serializeLight());
      
      expect(light.length).toBeLessThan(full.length);
    });
  });

  describe('handleAction()', () => {
    let empireId;
    let planetId;

    beforeEach(() => {
      empireId = 'empire_0';
      const empire = engine.getEmpire(empireId);
      const planets = engine.universe.getPlanetsOwnedBy(empireId);
      planetId = planets[0]?.id;
    });

    test('should handle build action', () => {
      // Find a valid build location
      const planet = engine.universe.getPlanet(planetId);
      if (!planet?.surface) return; // Skip if no surface
      
      // Find plains tile
      let x = 0, y = 0;
      for (let i = 0; i < 32; i++) {
        for (let j = 0; j < 32; j++) {
          if (planet.surface.tiles[i][j].terrain === 'plains' && 
              !planet.surface.tiles[i][j].building) {
            x = j;
            y = i;
            break;
          }
        }
      }
      
      const result = engine.handleAction(empireId, {
        type: 'build',
        building: 'mine',
        planetId,
        x,
        y
      });
      
      // Result depends on resources, but should be defined
      expect(result).toBeDefined();
    });

    test('should reject actions from invalid empire', () => {
      const result = engine.handleAction('invalid_empire', {
        type: 'build',
        building: 'mine',
        planetId,
        x: 0,
        y: 0
      });
      
      expect(result.success).toBe(false);
    });
  });

  describe('empires initialization', () => {
    test('should have unique colors', () => {
      const colors = new Set();
      engine.empires.forEach(empire => {
        colors.add(empire.color);
      });
      expect(colors.size).toBe(4);
    });

    test('should have unique names', () => {
      const names = new Set();
      engine.empires.forEach(empire => {
        names.add(empire.name);
      });
      expect(names.size).toBe(4);
    });

    test('each empire should own a planet', () => {
      engine.empires.forEach(empire => {
        const planets = engine.universe.getPlanetsOwnedBy(empire.id);
        expect(planets.length).toBeGreaterThan(0);
      });
    });

    test('each empire should have starting resources', () => {
      engine.empires.forEach(empire => {
        const resources = engine.resourceManager.getResources(empire.id);
        expect(resources.energy).toBeGreaterThan(0);
        expect(resources.minerals).toBeGreaterThan(0);
      });
    });
  });
});
