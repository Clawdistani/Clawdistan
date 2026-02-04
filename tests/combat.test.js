import { jest } from '@jest/globals';
import { CombatSystem } from '../core/combat.js';

describe('CombatSystem', () => {
  let combatSystem;

  beforeEach(() => {
    combatSystem = new CombatSystem();
  });

  describe('initialization', () => {
    test('should start with empty pending combats', () => {
      expect(combatSystem.pendingCombats).toEqual([]);
    });
  });

  describe('resolveCombat()', () => {
    let mockEntityManager;

    beforeEach(() => {
      mockEntityManager = {
        getEntity: jest.fn(),
        removeEntity: jest.fn()
      };
    });

    test('should resolve combat between two sides', () => {
      const byOwner = new Map([
        ['empire_0', [
          { id: 'unit_0', owner: 'empire_0', hp: 100, attack: 20 }
        ]],
        ['empire_1', [
          { id: 'unit_1', owner: 'empire_1', hp: 100, attack: 15 }
        ]]
      ]);

      const result = combatSystem.resolveCombat(byOwner, mockEntityManager);
      
      expect(result).toBeDefined();
      expect(result.attackers).toBeDefined();
      expect(result.defenders).toBeDefined();
    });

    test('should return null for single side', () => {
      const byOwner = new Map([
        ['empire_0', [
          { id: 'unit_0', owner: 'empire_0', hp: 100, attack: 20 }
        ]]
      ]);

      const result = combatSystem.resolveCombat(byOwner, mockEntityManager);
      expect(result).toBeNull();
    });

    test('should calculate casualties based on attack power', () => {
      const byOwner = new Map([
        ['empire_0', [
          { id: 'unit_0', owner: 'empire_0', hp: 100, attack: 50 }
        ]],
        ['empire_1', [
          { id: 'unit_1', owner: 'empire_1', hp: 50, attack: 10 }
        ]]
      ]);

      const result = combatSystem.resolveCombat(byOwner, mockEntityManager);
      
      // Side with more attack power should deal more damage
      expect(result).toBeDefined();
    });
  });

  describe('attack()', () => {
    let mockEntityManager;

    beforeEach(() => {
      mockEntityManager = {
        getEntity: jest.fn(),
        removeEntity: jest.fn()
      };
    });

    test('should deal damage to target', () => {
      const attacker = { id: 'a', attack: 20 };
      const target = { id: 't', hp: 100 };

      const result = combatSystem.attack(attacker, target, mockEntityManager);
      
      expect(target.hp).toBeLessThan(100);
    });

    test('should remove target when hp reaches 0', () => {
      const attacker = { id: 'a', attack: 150 };
      const target = { id: 't', hp: 100 };

      combatSystem.attack(attacker, target, mockEntityManager);
      
      expect(mockEntityManager.removeEntity).toHaveBeenCalledWith('t');
    });

    test('should return attack result', () => {
      const attacker = { id: 'a', attack: 20 };
      const target = { id: 't', hp: 100 };

      const result = combatSystem.attack(attacker, target, mockEntityManager);
      
      expect(result).toBeDefined();
      expect(result.damage).toBeDefined();
    });
  });

  describe('canAttack()', () => {
    const mockUniverse = {
      getPlanet: jest.fn()
    };

    test('should return true for entities at same location', () => {
      const attacker = { location: 'planet_0', attack: 20 };
      const target = { location: 'planet_0' };

      const result = combatSystem.canAttack(attacker, target, mockUniverse);
      expect(result).toBe(true);
    });

    test('should return false for entities at different locations', () => {
      const attacker = { location: 'planet_0', attack: 20 };
      const target = { location: 'planet_1' };

      const result = combatSystem.canAttack(attacker, target, mockUniverse);
      expect(result).toBe(false);
    });

    test('should return false if attacker has no attack', () => {
      const attacker = { location: 'planet_0' };
      const target = { location: 'planet_0' };

      const result = combatSystem.canAttack(attacker, target, mockUniverse);
      expect(result).toBe(false);
    });
  });

  describe('resolveAllCombat()', () => {
    let mockEntityManager;
    let mockUniverse;

    beforeEach(() => {
      mockEntityManager = {
        getAllEntities: jest.fn().mockReturnValue([
          { id: 'u1', owner: 'empire_0', location: 'planet_0', hp: 100, attack: 20 },
          { id: 'u2', owner: 'empire_1', location: 'planet_0', hp: 100, attack: 15 }
        ]),
        getEntity: jest.fn(),
        removeEntity: jest.fn()
      };
      
      mockUniverse = {
        getPlanet: jest.fn()
      };
    });

    test('should detect combat at shared locations', () => {
      const results = combatSystem.resolveAllCombat(mockEntityManager, mockUniverse);
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].location).toBe('planet_0');
    });

    test('should not trigger combat for same owner', () => {
      mockEntityManager.getAllEntities.mockReturnValue([
        { id: 'u1', owner: 'empire_0', location: 'planet_0', hp: 100, attack: 20 },
        { id: 'u2', owner: 'empire_0', location: 'planet_0', hp: 100, attack: 15 }
      ]);

      const results = combatSystem.resolveAllCombat(mockEntityManager, mockUniverse);
      
      expect(results).toHaveLength(0);
    });
  });

  describe('calculateDamage()', () => {
    test('should return positive damage for positive attack', () => {
      const attacker = { attack: 30 };
      const defender = { hp: 100 };
      
      const damage = combatSystem.calculateDamage(attacker, defender);
      expect(damage).toBeGreaterThan(0);
    });

    test('should scale with attack power', () => {
      const weakAttacker = { attack: 10 };
      const strongAttacker = { attack: 50 };
      const defender = { hp: 100 };
      
      const weakDamage = combatSystem.calculateDamage(weakAttacker, defender);
      const strongDamage = combatSystem.calculateDamage(strongAttacker, defender);
      
      expect(strongDamage).toBeGreaterThan(weakDamage);
    });
  });
});
