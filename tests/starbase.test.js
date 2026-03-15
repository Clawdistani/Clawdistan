import { StarbaseManager } from '../core/starbase.js';
import { Universe } from '../core/universe.js';

describe('StarbaseManager', () => {
  let starbaseManager;
  let universe;

  beforeEach(() => {
    universe = new Universe();
    universe.generate();
    starbaseManager = new StarbaseManager(universe);
  });

  describe('initialization', () => {
    test('should start with empty starbases', () => {
      expect(starbaseManager.starbases.size).toBe(0);
    });

    test('should have universe reference', () => {
      expect(starbaseManager.universe).toBeDefined();
    });
  });

  describe('static TIERS', () => {
    test('should have outpost tier', () => {
      expect(StarbaseManager.TIERS.outpost).toBeDefined();
      expect(StarbaseManager.TIERS.outpost.tier).toBe(1);
    });

    test('should have starbase tier', () => {
      expect(StarbaseManager.TIERS.starbase).toBeDefined();
      expect(StarbaseManager.TIERS.starbase.tier).toBe(2);
    });

    test('should have citadel tier', () => {
      expect(StarbaseManager.TIERS.citadel).toBeDefined();
      expect(StarbaseManager.TIERS.citadel.tier).toBe(3);
    });

    test('each tier should have required properties', () => {
      for (const [key, tier] of Object.entries(StarbaseManager.TIERS)) {
        expect(tier.name).toBeDefined();
        expect(tier.hp).toBeGreaterThan(0);
        expect(tier.attack).toBeGreaterThan(0);
        expect(tier.moduleSlots).toBeGreaterThan(0);
      }
    });
  });

  describe('static MODULES', () => {
    test('should have gun_battery module', () => {
      expect(StarbaseManager.MODULES.gun_battery).toBeDefined();
    });

    test('should have shipyard module', () => {
      expect(StarbaseManager.MODULES.shipyard).toBeDefined();
      expect(StarbaseManager.MODULES.shipyard.canBuildShips).toBe(true);
    });

    test('each module should have cost', () => {
      for (const [key, module] of Object.entries(StarbaseManager.MODULES)) {
        expect(module.cost).toBeDefined();
        expect(module.name).toBeDefined();
      }
    });
  });

  describe('canBuildStarbase()', () => {
    test('should fail for invalid system', () => {
      const result = starbaseManager.canBuildStarbase('empire_0', 'invalid_system');
      expect(result.allowed).toBe(false);
      expect(result.error).toContain('not found');
    });

    test('should fail if no presence in system', () => {
      const system = universe.solarSystems[0];
      const result = starbaseManager.canBuildStarbase('empire_0', system.id);
      expect(result.allowed).toBe(false);
      expect(result.error).toContain('need to own a planet');
    });

    test('should allow if empire owns planet in system', () => {
      const system = universe.solarSystems[0];
      const planetsInSystem = universe.planets.filter(p => p.systemId === system.id);
      if (planetsInSystem.length > 0) {
        planetsInSystem[0].owner = 'empire_0';
        const result = starbaseManager.canBuildStarbase('empire_0', system.id);
        expect(result.allowed).toBe(true);
      }
    });
  });

  describe('buildStarbase()', () => {
    test('should fail without presence in system', () => {
      const system = universe.solarSystems[0];
      const result = starbaseManager.buildStarbase('empire_0', system.id, 0);
      expect(result.success).toBe(false);
    });

    test('should succeed with planet ownership', () => {
      const system = universe.solarSystems[0];
      const planetsInSystem = universe.planets.filter(p => p.systemId === system.id);
      if (planetsInSystem.length > 0) {
        planetsInSystem[0].owner = 'empire_0';
        const result = starbaseManager.buildStarbase('empire_0', system.id, 0);
        expect(result.success).toBe(true);
        expect(result.starbase).toBeDefined();
        expect(result.starbase.tierName).toBe('outpost');
      }
    });

    test('should fail if starbase already exists', () => {
      const system = universe.solarSystems[0];
      const planetsInSystem = universe.planets.filter(p => p.systemId === system.id);
      if (planetsInSystem.length > 0) {
        planetsInSystem[0].owner = 'empire_0';
        starbaseManager.buildStarbase('empire_0', system.id, 0);
        const result = starbaseManager.buildStarbase('empire_0', system.id, 0);
        expect(result.success).toBe(false);
        expect(result.error).toContain('already');
      }
    });
  });

  describe('getStarbase()', () => {
    test('should return null for system without starbase', () => {
      const starbase = starbaseManager.getStarbase('nonexistent');
      expect(starbase).toBeNull();
    });

    test('should return starbase after building', () => {
      const system = universe.solarSystems[0];
      const planetsInSystem = universe.planets.filter(p => p.systemId === system.id);
      if (planetsInSystem.length > 0) {
        planetsInSystem[0].owner = 'empire_0';
        starbaseManager.buildStarbase('empire_0', system.id, 0);
        const starbase = starbaseManager.getStarbase(system.id);
        expect(starbase).toBeDefined();
        expect(starbase.owner).toBe('empire_0');
      }
    });
  });

  describe('getEmpireStarbases()', () => {
    test('should return empty array for empire with no starbases', () => {
      const starbases = starbaseManager.getEmpireStarbases('empire_0');
      expect(Array.isArray(starbases)).toBe(true);
      expect(starbases.length).toBe(0);
    });

    test('should return starbases after building', () => {
      const system = universe.solarSystems[0];
      const planetsInSystem = universe.planets.filter(p => p.systemId === system.id);
      if (planetsInSystem.length > 0) {
        planetsInSystem[0].owner = 'empire_0';
        starbaseManager.buildStarbase('empire_0', system.id, 0);
        const starbases = starbaseManager.getEmpireStarbases('empire_0');
        expect(starbases.length).toBe(1);
        expect(starbases[0].owner).toBe('empire_0');
      }
    });
  });

  describe('addModule()', () => {
    test('should fail for system without starbase', () => {
      const result = starbaseManager.addModule('empire_0', 'nonexistent', 'gun_battery');
      expect(result.success).toBe(false);
    });

    test('should add module to owned starbase', () => {
      const system = universe.solarSystems[0];
      const planetsInSystem = universe.planets.filter(p => p.systemId === system.id);
      if (planetsInSystem.length > 0) {
        planetsInSystem[0].owner = 'empire_0';
        starbaseManager.buildStarbase('empire_0', system.id, 0);
        const starbase = starbaseManager.getStarbase(system.id);
        // Mark as complete
        starbase.constructing = false;
        
        const result = starbaseManager.addModule('empire_0', system.id, 'gun_battery');
        expect(result.success).toBe(true);
      }
    });
  });

  describe('tick()', () => {
    test('should return empty array when no events', () => {
      const events = starbaseManager.tick(0);
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBe(0);
    });

    test('should return array type from tick', () => {
      const system = universe.solarSystems[0];
      const planetsInSystem = universe.planets.filter(p => p.systemId === system.id);
      if (planetsInSystem.length > 0) {
        planetsInSystem[0].owner = 'empire_0';
        starbaseManager.buildStarbase('empire_0', system.id, 0);
        
        // Tick returns an array (may or may not have events depending on state)
        const events = starbaseManager.tick(1000);
        expect(Array.isArray(events)).toBe(true);
      }
    });
  });

  describe('serialize/loadState', () => {
    test('should serialize starbases', () => {
      const system = universe.solarSystems[0];
      const planetsInSystem = universe.planets.filter(p => p.systemId === system.id);
      if (planetsInSystem.length > 0) {
        planetsInSystem[0].owner = 'empire_0';
        starbaseManager.buildStarbase('empire_0', system.id, 0);
        
        const serialized = starbaseManager.serialize();
        expect(serialized).toBeDefined();
        expect(serialized.starbases).toBeDefined();
        expect(serialized.starbases.length).toBe(1);
      }
    });

    test('should restore state from serialized data', () => {
      const system = universe.solarSystems[0];
      const planetsInSystem = universe.planets.filter(p => p.systemId === system.id);
      if (planetsInSystem.length > 0) {
        planetsInSystem[0].owner = 'empire_0';
        starbaseManager.buildStarbase('empire_0', system.id, 0);
        
        const serialized = starbaseManager.serialize();
        
        // Create new manager and load state
        const newManager = new StarbaseManager(universe);
        newManager.loadState(serialized);
        
        expect(newManager.starbases.size).toBe(1);
        expect(newManager.getStarbase(system.id)).toBeDefined();
      }
    });
  });

  describe('damageStarbase()', () => {
    test('should reduce hp when damaged', () => {
      const system = universe.solarSystems[0];
      const planetsInSystem = universe.planets.filter(p => p.systemId === system.id);
      if (planetsInSystem.length > 0) {
        planetsInSystem[0].owner = 'empire_0';
        starbaseManager.buildStarbase('empire_0', system.id, 0);
        const starbase = starbaseManager.getStarbase(system.id);
        const initialHp = starbase.hp;
        
        const result = starbaseManager.damageStarbase(system.id, 50);
        expect(result.destroyed).toBe(false);
        expect(starbase.hp).toBe(initialHp - 50);
      }
    });

    test('should destroy starbase when hp reaches 0', () => {
      const system = universe.solarSystems[0];
      const planetsInSystem = universe.planets.filter(p => p.systemId === system.id);
      if (planetsInSystem.length > 0) {
        planetsInSystem[0].owner = 'empire_0';
        starbaseManager.buildStarbase('empire_0', system.id, 0);
        const starbase = starbaseManager.getStarbase(system.id);
        
        const result = starbaseManager.damageStarbase(system.id, starbase.hp + 100);
        expect(result.destroyed).toBe(true);
        expect(starbaseManager.getStarbase(system.id)).toBeNull();
      }
    });
  });

  describe('controlsSystem()', () => {
    test('should return false for uncontrolled system', () => {
      expect(starbaseManager.controlsSystem('empire_0', 'nonexistent')).toBeFalsy();
    });

    test('should return true for system with completed starbase', () => {
      const system = universe.solarSystems[0];
      const planetsInSystem = universe.planets.filter(p => p.systemId === system.id);
      if (planetsInSystem.length > 0) {
        planetsInSystem[0].owner = 'empire_0';
        starbaseManager.buildStarbase('empire_0', system.id, 0);
        const starbase = starbaseManager.getStarbase(system.id);
        starbase.constructing = false;
        
        expect(starbaseManager.controlsSystem('empire_0', system.id)).toBe(true);
      }
    });
  });
});
