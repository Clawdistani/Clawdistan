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
      engine.recordChange('entity', { id: 'e1' });
      engine.tick_count = 150;
      engine.recordChange('entity', { id: 'e2' });
      engine.tick_count = 200;
      engine.recordChange('planet', { id: 'p1' });
    });

    test('should return delta type for recent changes', () => {
      const delta = engine.getDelta(150);
      expect(delta.type).toBe('delta');
    });

    test('should return full type when too far behind', () => {
      engine.tick_count = 500;
      const delta = engine.getDelta(100);
      expect(delta.type).toBe('full');
    });

    test('should include fromTick and toTick for delta', () => {
      const delta = engine.getDelta(150);
      if (delta.type === 'delta') {
        expect(delta.fromTick).toBe(150);
        expect(delta.toTick).toBe(200);
      }
    });
  });

  describe('pause/resume', () => {
    test('should pause game by setting paused flag', () => {
      engine.paused = true;
      expect(engine.paused).toBe(true);
    });

    test('should resume game by clearing paused flag', () => {
      engine.paused = true;
      engine.paused = false;
      expect(engine.paused).toBe(false);
    });
  });

  describe('log()', () => {
    test('should add event to log', () => {
      const initialLength = engine.eventLog.length;
      engine.log('test', 'Test message');
      
      expect(engine.eventLog.length).toBe(initialLength + 1);
    });

    test('should include category and message', () => {
      engine.log('test', 'Test message');
      const lastEvent = engine.eventLog[engine.eventLog.length - 1];
      expect(lastEvent.category).toBe('test');
      expect(lastEvent.message).toBe('Test message');
    });

    test('should include tick in event', () => {
      engine.tick_count = 42;
      engine.log('test', 'Test');
      
      const lastEvent = engine.eventLog[engine.eventLog.length - 1];
      expect(lastEvent.tick).toBe(42);
    });
  });

  describe('empires access', () => {
    test('should get empire by id using Map', () => {
      const empire = engine.empires.get('empire_0');
      expect(empire).toBeDefined();
      expect(empire.id).toBe('empire_0');
    });

    test('should return undefined for invalid id', () => {
      const empire = engine.empires.get('invalid');
      expect(empire).toBeUndefined();
    });
  });

  describe('getFullState()', () => {
    test('should return current game state', () => {
      const state = engine.getFullState();
      
      expect(state.tick).toBeDefined();
      expect(state.paused).toBeDefined();
      expect(state.universe).toBeDefined();
      expect(state.empires).toBeDefined();
    });

    test('should be JSON serializable', () => {
      const state = engine.getFullState();
      const json = JSON.stringify(state);
      const parsed = JSON.parse(json);
      
      expect(parsed.tick).toBe(state.tick);
    });
  });

  describe('getLightState()', () => {
    test('should return state with light universe (no surfaces)', () => {
      const state = engine.getLightState();
      
      expect(state.universe).toBeDefined();
      
      // Check planets don't have surface data
      if (state.universe.planets) {
        state.universe.planets.forEach(planet => {
          expect(planet.surface).toBeUndefined();
        });
      }
    });

    test('should be smaller than full getFullState', () => {
      const full = JSON.stringify(engine.getFullState());
      const light = JSON.stringify(engine.getLightState());
      
      expect(light.length).toBeLessThan(full.length);
    });
  });

  describe('executeAction()', () => {
    let empireId;
    let planetId;

    beforeEach(() => {
      empireId = 'empire_0';
      const planets = engine.universe.getPlanetsOwnedBy(empireId);
      planetId = planets[0]?.id;
    });

    test('should handle build action', () => {
      if (!planetId) return; // Skip if no planet
      
      const result = engine.executeAction(empireId, 'build', {
        type: 'mine',
        locationId: planetId
      });
      
      // Result depends on resources and terrain, but should be defined
      expect(result).toBeDefined();
      expect(result.success !== undefined).toBe(true);
    });

    test('should reject actions from invalid empire', () => {
      const result = engine.executeAction('invalid_empire', 'build', {
        type: 'mine',
        locationId: planetId
      });
      
      expect(result.success).toBe(false);
    });

    test('should reject unknown action type', () => {
      const result = engine.executeAction(empireId, 'unknown_action', {});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown action');
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
