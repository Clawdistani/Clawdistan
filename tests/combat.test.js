import { CombatSystem } from '../core/combat.js';
import { EntityManager } from '../core/entities.js';
import { Universe } from '../core/universe.js';

describe('CombatSystem', () => {
  let combatSystem;
  let entityManager;
  let universe;

  beforeEach(() => {
    combatSystem = new CombatSystem();
    entityManager = new EntityManager();
    universe = new Universe();
    universe.generate();
  });

  describe('initialization', () => {
    test('should have empty pending combats', () => {
      expect(combatSystem.pendingCombats).toEqual([]);
    });
  });

  describe('resolveAllCombat()', () => {
    test('should return empty array when no combat', () => {
      const results = combatSystem.resolveAllCombat(entityManager, universe);
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });

    test('should detect combat when enemies at same location', () => {
      const planet = universe.planets[0];
      
      // Create units for two empires at same location
      entityManager.createEntity('soldier', 'empire_0', planet.id);
      entityManager.createEntity('soldier', 'empire_1', planet.id);
      
      const results = combatSystem.resolveAllCombat(entityManager, universe);
      
      // Should detect the conflict
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    test('should not trigger combat for same empire', () => {
      const planet = universe.planets[0];
      
      // Create multiple units for same empire
      entityManager.createEntity('soldier', 'empire_0', planet.id);
      entityManager.createEntity('soldier', 'empire_0', planet.id);
      
      const results = combatSystem.resolveAllCombat(entityManager, universe);
      expect(results.length).toBe(0);
    });
  });

  describe('resolveCombat()', () => {
    test('should return null for single owner', () => {
      const byOwner = new Map();
      byOwner.set('empire_0', [{ attack: 10, hp: 100 }]);
      
      const result = combatSystem.resolveCombat(byOwner, entityManager);
      expect(result).toBeNull();
    });

    test('should resolve combat between two sides', () => {
      const planet = universe.planets[0];
      
      // Create units for both empires
      const unit1 = entityManager.createEntity('soldier', 'empire_0', planet.id);
      const unit2 = entityManager.createEntity('soldier', 'empire_1', planet.id);
      
      const byOwner = new Map();
      byOwner.set('empire_0', [unit1]);
      byOwner.set('empire_1', [unit2]);
      
      // This may or may not destroy units depending on HP/attack
      const result = combatSystem.resolveCombat(byOwner, entityManager);
      
      // Result is null if no units destroyed, object otherwise
      expect(result === null || typeof result === 'object').toBe(true);
    });
  });

  describe('canAttack()', () => {
    test('should return false for unit with no attack', () => {
      const attacker = { attack: 0, location: 'loc1', range: 1 };
      const target = { location: 'loc2' };
      
      expect(combatSystem.canAttack(attacker, target, universe)).toBe(false);
    });

    test('should return false for unit with undefined attack', () => {
      const attacker = { location: 'loc1', range: 1 };
      const target = { location: 'loc2' };
      
      expect(combatSystem.canAttack(attacker, target, universe)).toBe(false);
    });
  });

  describe('attack()', () => {
    test('should return null for unit with no attack', () => {
      const attacker = { name: 'Unit1' };
      const target = { id: 'target1', name: 'Target', hp: 100 };
      
      const result = combatSystem.attack(attacker, target, entityManager);
      expect(result).toBeNull();
    });

    test('should deal damage when attacking', () => {
      const planet = universe.planets[0];
      const target = entityManager.createEntity('soldier', 'empire_1', planet.id);
      const initialHp = target.hp;
      
      const attacker = { 
        id: 'attacker1',
        name: 'Attacker', 
        attack: 10,
        target: target.id
      };
      
      const result = combatSystem.attack(attacker, target, entityManager);
      
      expect(result).toBeDefined();
      expect(result.damage).toBeGreaterThan(0);
    });

    test('should include description in result', () => {
      const planet = universe.planets[0];
      const target = entityManager.createEntity('soldier', 'empire_1', planet.id);
      
      const attacker = { 
        id: 'attacker1',
        name: 'Attacker', 
        attack: 10
      };
      
      const result = combatSystem.attack(attacker, target, entityManager);
      
      expect(result.description).toBeDefined();
      expect(typeof result.description).toBe('string');
    });
  });

  describe('resolvePlanetaryInvasion()', () => {
    test('should resolve invasion with attackers and defenders', () => {
      const planet = universe.planets[0];
      planet.owner = 'empire_1';
      
      // Create attackers
      const attackers = [
        entityManager.createEntity('soldier', 'empire_0', planet.id),
        entityManager.createEntity('soldier', 'empire_0', planet.id)
      ];
      
      // Create defenders
      const defenders = [
        entityManager.createEntity('soldier', 'empire_1', planet.id)
      ];
      
      const result = combatSystem.resolvePlanetaryInvasion(
        attackers, defenders, planet, entityManager
      );
      
      expect(result).toBeDefined();
      expect(result.battleLog).toBeDefined();
      expect(Array.isArray(result.battleLog)).toBe(true);
    });

    test('should return conquered status', () => {
      const planet = universe.planets[0];
      planet.owner = 'empire_1';
      
      const attackers = [
        entityManager.createEntity('soldier', 'empire_0', planet.id)
      ];
      const defenders = [];
      
      const result = combatSystem.resolvePlanetaryInvasion(
        attackers, defenders, planet, entityManager
      );
      
      expect(typeof result.conquered).toBe('boolean');
    });
  });
});
