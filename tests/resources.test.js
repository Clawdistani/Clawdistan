import { jest } from '@jest/globals';
import { ResourceManager } from '../core/resources.js';

describe('ResourceManager', () => {
  let resourceManager;

  beforeEach(() => {
    resourceManager = new ResourceManager();
  });

  describe('initializeEmpire()', () => {
    test('should set starting resources', () => {
      resourceManager.initializeEmpire('empire_0');
      const resources = resourceManager.getResources('empire_0');
      
      expect(resources.energy).toBe(100);
      expect(resources.minerals).toBe(100);
      expect(resources.food).toBe(100);
      expect(resources.research).toBe(50);
      expect(resources.credits).toBe(200);
      expect(resources.population).toBe(10);
    });

    test('should handle multiple empires', () => {
      resourceManager.initializeEmpire('empire_0');
      resourceManager.initializeEmpire('empire_1');
      
      const r0 = resourceManager.getResources('empire_0');
      const r1 = resourceManager.getResources('empire_1');
      
      expect(r0).toBeDefined();
      expect(r1).toBeDefined();
      expect(r0).not.toBe(r1);
    });
  });

  describe('getResources()', () => {
    test('should return empty object for unknown empire', () => {
      const resources = resourceManager.getResources('unknown');
      expect(resources).toEqual({});
    });

    test('should return resources for known empire', () => {
      resourceManager.initializeEmpire('empire_0');
      const resources = resourceManager.getResources('empire_0');
      expect(resources.energy).toBeDefined();
    });
  });

  describe('setResources()', () => {
    test('should update resources', () => {
      resourceManager.initializeEmpire('empire_0');
      resourceManager.setResources('empire_0', { energy: 500, minerals: 300 });
      
      const resources = resourceManager.getResources('empire_0');
      expect(resources.energy).toBe(500);
      expect(resources.minerals).toBe(300);
    });
  });

  describe('canAfford()', () => {
    beforeEach(() => {
      resourceManager.initializeEmpire('empire_0');
    });

    test('should return true when can afford', () => {
      const cost = { minerals: 50, energy: 20 };
      expect(resourceManager.canAfford('empire_0', cost)).toBe(true);
    });

    test('should return false when cannot afford', () => {
      const cost = { minerals: 500, energy: 20 };
      expect(resourceManager.canAfford('empire_0', cost)).toBe(false);
    });

    test('should check all resources', () => {
      const cost = { minerals: 50, energy: 200 };
      expect(resourceManager.canAfford('empire_0', cost)).toBe(false);
    });

    test('should return true for empty cost', () => {
      expect(resourceManager.canAfford('empire_0', {})).toBe(true);
    });
  });

  describe('deduct()', () => {
    beforeEach(() => {
      resourceManager.initializeEmpire('empire_0');
    });

    test('should deduct resources', () => {
      resourceManager.deduct('empire_0', { minerals: 30, energy: 20 });
      const resources = resourceManager.getResources('empire_0');
      
      expect(resources.minerals).toBe(70);
      expect(resources.energy).toBe(80);
    });

    test('should allow negative resources', () => {
      resourceManager.deduct('empire_0', { minerals: 200 });
      const resources = resourceManager.getResources('empire_0');
      
      expect(resources.minerals).toBe(-100);
    });

    test('should handle unknown empire gracefully', () => {
      expect(() => {
        resourceManager.deduct('unknown', { minerals: 50 });
      }).not.toThrow();
    });
  });

  describe('add()', () => {
    beforeEach(() => {
      resourceManager.initializeEmpire('empire_0');
    });

    test('should add resources', () => {
      resourceManager.add('empire_0', { minerals: 50, energy: 30 });
      const resources = resourceManager.getResources('empire_0');
      
      expect(resources.minerals).toBe(150);
      expect(resources.energy).toBe(130);
    });

    test('should handle new resource types', () => {
      resourceManager.add('empire_0', { customResource: 100 });
      const resources = resourceManager.getResources('empire_0');
      
      expect(resources.customResource).toBe(100);
    });
  });

  describe('generateResources()', () => {
    let mockUniverse;
    let mockEntityManager;

    beforeEach(() => {
      resourceManager.initializeEmpire('empire_0');
      
      mockUniverse = {
        getPlanetsOwnedBy: jest.fn().mockReturnValue([
          { resources: { energy: 100, minerals: 50, food: 30 } }
        ]),
        getPlanet: jest.fn().mockReturnValue({ type: 'terran' })
      };
      
      mockEntityManager = {
        getEntitiesForEmpire: jest.fn().mockReturnValue([
          { production: { energy: 5, minerals: 3 }, planetId: 'planet_0' }
        ])
      };
    });

    test('should generate resources from planets', () => {
      const initialEnergy = resourceManager.getResources('empire_0').energy;
      resourceManager.generateResources('empire_0', mockUniverse, mockEntityManager);
      const newEnergy = resourceManager.getResources('empire_0').energy;
      
      expect(newEnergy).toBeGreaterThan(initialEnergy);
    });

    test('should generate resources from structures', () => {
      resourceManager.generateResources('empire_0', mockUniverse, mockEntityManager);
      const resources = resourceManager.getResources('empire_0');
      
      // Structure produces 5 energy
      expect(resources.energy).toBeGreaterThan(100);
    });

    test('should consume food for population', () => {
      resourceManager.setResources('empire_0', {
        ...resourceManager.getResources('empire_0'),
        population: 100
      });
      
      const initialFood = resourceManager.getResources('empire_0').food;
      resourceManager.generateResources('empire_0', mockUniverse, mockEntityManager);
      const newFood = resourceManager.getResources('empire_0').food;
      
      // Food should decrease due to consumption (population 100 consumes 20)
      expect(newFood).toBeLessThan(initialFood + 10); // +10 from planet
    });

    test('should cap resources at maximum', () => {
      resourceManager.setResources('empire_0', {
        energy: 9999,
        minerals: 9999,
        food: 4999,
        research: 4999,
        credits: 49999,
        population: 10
      });
      
      resourceManager.generateResources('empire_0', mockUniverse, mockEntityManager);
      const resources = resourceManager.getResources('empire_0');
      
      expect(resources.energy).toBeLessThanOrEqual(10000);
      expect(resources.minerals).toBeLessThanOrEqual(10000);
      expect(resources.food).toBeLessThanOrEqual(5000);
    });
  });
});
