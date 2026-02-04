import { jest } from '@jest/globals';
import { FleetManager } from '../core/fleet.js';

describe('FleetManager', () => {
  let fleetManager;
  let mockUniverse;
  let mockEntityManager;

  beforeEach(() => {
    mockUniverse = {
      getPlanet: jest.fn(),
      getSystem: jest.fn()
    };
    
    mockEntityManager = {
      getEntity: jest.fn(),
      getAllEntities: jest.fn().mockReturnValue([]),
      definitions: {
        fighter: { cargoCapacity: 0 },
        transport: { cargoCapacity: 10 }
      }
    };
    
    fleetManager = new FleetManager(mockUniverse, mockEntityManager);
  });

  describe('initialization', () => {
    test('should start with empty fleets', () => {
      expect(fleetManager.fleetsInTransit.size).toBe(0);
    });
  });

  describe('calculateTravelTime()', () => {
    beforeEach(() => {
      mockUniverse.getSystem.mockImplementation(id => {
        if (id === 'system_0') return { x: 100, y: 100 };
        if (id === 'system_1') return { x: 300, y: 300 };
        return null;
      });
    });

    test('should return minimum time for same system', () => {
      const origin = { systemId: 'system_0' };
      const dest = { systemId: 'system_0' };
      
      const time = fleetManager.calculateTravelTime(origin, dest, 1);
      expect(time).toBeGreaterThanOrEqual(120); // 2 minute minimum
    });

    test('should return longer time for different systems', () => {
      const origin = { systemId: 'system_0' };
      const dest = { systemId: 'system_1' };
      
      const time = fleetManager.calculateTravelTime(origin, dest, 1);
      expect(time).toBeGreaterThanOrEqual(180); // 3+ minute journey
    });

    test('should scale inversely with speed', () => {
      const origin = { systemId: 'system_0' };
      const dest = { systemId: 'system_1' };
      
      const slowTime = fleetManager.calculateTravelTime(origin, dest, 1);
      const fastTime = fleetManager.calculateTravelTime(origin, dest, 2);
      
      expect(fastTime).toBeLessThan(slowTime);
    });
  });

  describe('launchFleet()', () => {
    beforeEach(() => {
      mockUniverse.getPlanet.mockImplementation(id => {
        if (id === 'planet_0') return { id: 'planet_0', systemId: 'system_0' };
        if (id === 'planet_1') return { id: 'planet_1', systemId: 'system_0' };
        return null;
      });
      
      mockUniverse.getSystem.mockReturnValue({ x: 100, y: 100 });
      
      mockEntityManager.getEntity.mockImplementation(id => {
        if (id === 'ship_0') return {
          id: 'ship_0',
          owner: 'empire_0',
          location: 'planet_0',
          spaceUnit: true,
          speed: 1
        };
        return null;
      });
    });

    test('should launch fleet successfully', () => {
      const result = fleetManager.launchFleet(
        'empire_0', 'planet_0', 'planet_1', ['ship_0'], [], 100
      );
      
      expect(result.success).toBe(true);
      expect(result.fleetId).toBeDefined();
    });

    test('should reject invalid origin planet', () => {
      mockUniverse.getPlanet.mockImplementation(id => {
        if (id === 'planet_1') return { id: 'planet_1' };
        return null;
      });
      
      const result = fleetManager.launchFleet(
        'empire_0', 'invalid', 'planet_1', ['ship_0'], [], 100
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid planet');
    });

    test('should reject ship not owned by empire', () => {
      mockEntityManager.getEntity.mockReturnValue({
        id: 'ship_0',
        owner: 'empire_1', // Different owner
        location: 'planet_0',
        spaceUnit: true
      });
      
      const result = fleetManager.launchFleet(
        'empire_0', 'planet_0', 'planet_1', ['ship_0'], [], 100
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not owned');
    });

    test('should reject ship not at origin', () => {
      mockEntityManager.getEntity.mockReturnValue({
        id: 'ship_0',
        owner: 'empire_0',
        location: 'planet_2', // Different location
        spaceUnit: true
      });
      
      const result = fleetManager.launchFleet(
        'empire_0', 'planet_0', 'planet_1', ['ship_0'], [], 100
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not at origin');
    });

    test('should reject non-space unit', () => {
      mockEntityManager.getEntity.mockReturnValue({
        id: 'ship_0',
        owner: 'empire_0',
        location: 'planet_0',
        spaceUnit: false
      });
      
      const result = fleetManager.launchFleet(
        'empire_0', 'planet_0', 'planet_1', ['ship_0'], [], 100
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not a space unit');
    });

    test('should track fleet in transit', () => {
      const result = fleetManager.launchFleet(
        'empire_0', 'planet_0', 'planet_1', ['ship_0'], [], 100
      );
      
      expect(fleetManager.fleetsInTransit.size).toBe(1);
    });
  });

  describe('tick()', () => {
    beforeEach(() => {
      mockUniverse.getPlanet.mockImplementation(id => ({
        id, systemId: 'system_0'
      }));
      mockUniverse.getSystem.mockReturnValue({ x: 100, y: 100 });
      
      mockEntityManager.getEntity.mockReturnValue({
        id: 'ship_0',
        owner: 'empire_0',
        location: 'planet_0',
        spaceUnit: true,
        speed: 1
      });
    });

    test('should return arrived fleets', () => {
      fleetManager.launchFleet('empire_0', 'planet_0', 'planet_1', ['ship_0'], [], 100);
      
      // Tick past arrival time
      const arrived = fleetManager.tick(500);
      
      expect(arrived.length).toBe(1);
    });

    test('should not return fleets still in transit', () => {
      fleetManager.launchFleet('empire_0', 'planet_0', 'planet_1', ['ship_0'], [], 100);
      
      // Tick before arrival
      const arrived = fleetManager.tick(101);
      
      expect(arrived.length).toBe(0);
    });

    test('should remove arrived fleets from transit', () => {
      fleetManager.launchFleet('empire_0', 'planet_0', 'planet_1', ['ship_0'], [], 100);
      
      fleetManager.tick(500);
      
      expect(fleetManager.fleetsInTransit.size).toBe(0);
    });
  });

  describe('getFleetPosition()', () => {
    beforeEach(() => {
      mockUniverse.getPlanet.mockImplementation(id => ({
        id, systemId: 'system_0'
      }));
      mockUniverse.getSystem.mockReturnValue({ x: 100, y: 100 });
      
      mockEntityManager.getEntity.mockReturnValue({
        id: 'ship_0',
        owner: 'empire_0',
        location: 'planet_0',
        spaceUnit: true,
        speed: 1
      });
    });

    test('should return current position of fleet', () => {
      const result = fleetManager.launchFleet(
        'empire_0', 'planet_0', 'planet_1', ['ship_0'], [], 100
      );
      
      const position = fleetManager.getFleetPosition(result.fleetId, 150);
      
      expect(position).toBeDefined();
      expect(position.progress).toBeDefined();
      expect(position.progress).toBeGreaterThan(0);
      expect(position.progress).toBeLessThanOrEqual(1);
    });
  });

  describe('getAllFleetsInTransit()', () => {
    beforeEach(() => {
      mockUniverse.getPlanet.mockReturnValue({ id: 'planet_0', systemId: 'system_0' });
      mockUniverse.getSystem.mockReturnValue({ x: 100, y: 100 });
      
      mockEntityManager.getEntity.mockReturnValue({
        id: 'ship_0',
        owner: 'empire_0',
        location: 'planet_0',
        spaceUnit: true,
        speed: 1
      });
    });

    test('should return all fleets', () => {
      fleetManager.launchFleet('empire_0', 'planet_0', 'planet_0', ['ship_0'], [], 100);
      
      const fleets = fleetManager.getAllFleetsInTransit();
      
      expect(fleets.length).toBe(1);
    });
  });
});
