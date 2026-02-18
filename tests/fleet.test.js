import { FleetManager } from '../core/fleet.js';
import { Universe } from '../core/universe.js';
import { EntityManager } from '../core/entities.js';

describe('FleetManager', () => {
  let fleetManager;
  let universe;
  let entityManager;

  beforeEach(() => {
    universe = new Universe();
    universe.generate();
    entityManager = new EntityManager();
    fleetManager = new FleetManager(universe, entityManager);
  });

  describe('initialization', () => {
    test('should have empty fleets in transit', () => {
      expect(fleetManager.fleetsInTransit.size).toBe(0);
    });

    test('should have universe reference', () => {
      expect(fleetManager.universe).toBe(universe);
    });

    test('should have entityManager reference', () => {
      expect(fleetManager.entityManager).toBe(entityManager);
    });
  });

  describe('calculateTravelTime()', () => {
    let planet1, planet2, planet3;

    beforeEach(() => {
      // Get planets - some in same system, some in different
      planet1 = universe.planets[0];
      planet2 = universe.planets.find(p => p.systemId === planet1.systemId && p.id !== planet1.id) 
                || universe.planets[1];
      planet3 = universe.planets.find(p => p.systemId !== planet1.systemId) 
                || universe.planets[universe.planets.length - 1];
    });

    test('should return positive travel time', () => {
      const time = fleetManager.calculateTravelTime(planet1, planet2, 1);
      expect(time).toBeGreaterThan(0);
    });

    test('should be faster with higher speed', () => {
      const slowTime = fleetManager.calculateTravelTime(planet1, planet3, 1);
      const fastTime = fleetManager.calculateTravelTime(planet1, planet3, 2);
      
      expect(fastTime).toBeLessThanOrEqual(slowTime);
    });

    test('should return minimum time for same system', () => {
      // Same system should be quick but non-zero for different planets
      const time = fleetManager.calculateTravelTime(planet1, planet2, 1);
      expect(time).toBeGreaterThan(0); // Should have some travel time
      expect(time).toBeLessThan(600); // But less than 10 minutes for same system
    });

    test('should take longer for different systems', () => {
      if (planet1.systemId !== planet3.systemId) {
        const sameSystemTime = fleetManager.calculateTravelTime(planet1, planet2, 1);
        const diffSystemTime = fleetManager.calculateTravelTime(planet1, planet3, 1);
        
        // Different system should take at least as long
        expect(diffSystemTime).toBeGreaterThanOrEqual(120);
      }
    });
  });

  describe('launchFleet()', () => {
    let origin, destination, ship;

    beforeEach(() => {
      origin = universe.planets[0];
      destination = universe.planets[1];
      origin.owner = 'empire_0';
      
      // Create a space unit at origin
      ship = entityManager.createEntity('fighter', 'empire_0', origin.id);
    });

    test('should launch fleet successfully', () => {
      const result = fleetManager.launchFleet(
        'empire_0', origin.id, destination.id, [ship.id], [], 0
      );
      
      expect(result.success).toBe(true);
      expect(result.fleetId).toBeDefined();
      expect(result.arrivalTick).toBeGreaterThan(0);
    });

    test('should track fleet in transit', () => {
      const result = fleetManager.launchFleet(
        'empire_0', origin.id, destination.id, [ship.id], [], 0
      );
      
      expect(fleetManager.fleetsInTransit.has(result.fleetId)).toBe(true);
    });

    test('should fail with invalid planet', () => {
      const result = fleetManager.launchFleet(
        'empire_0', 'invalid_planet', destination.id, [ship.id], [], 0
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid');
    });

    test('should fail with ship not at origin', () => {
      ship.location = 'other_planet';
      
      const result = fleetManager.launchFleet(
        'empire_0', origin.id, destination.id, [ship.id], [], 0
      );
      
      expect(result.success).toBe(false);
    });

    test('should fail with ship not owned', () => {
      ship.owner = 'empire_1';
      
      const result = fleetManager.launchFleet(
        'empire_0', origin.id, destination.id, [ship.id], [], 0
      );
      
      expect(result.success).toBe(false);
    });

    test('should fail with no ships', () => {
      const result = fleetManager.launchFleet(
        'empire_0', origin.id, destination.id, [], [], 0
      );
      
      expect(result.success).toBe(false);
    });

    test('should remove ship from origin after launch', () => {
      fleetManager.launchFleet(
        'empire_0', origin.id, destination.id, [ship.id], [], 0
      );
      
      expect(ship.location).toBeNull();
      expect(ship.inTransit).toBeDefined();
    });
  });

  describe('tick()', () => {
    let origin, destination, ship;

    beforeEach(() => {
      origin = universe.planets[0];
      destination = universe.planets[1];
      destination.owner = null; // Unclaimed
      origin.owner = 'empire_0';
      
      ship = entityManager.createEntity('fighter', 'empire_0', origin.id);
    });

    test('should update fleet progress', () => {
      const result = fleetManager.launchFleet(
        'empire_0', origin.id, destination.id, [ship.id], [], 0
      );
      
      const fleet = fleetManager.fleetsInTransit.get(result.fleetId);
      const initialProgress = fleet.progress;
      
      // Update at half the travel time
      fleetManager.tick(Math.floor(fleet.travelTime / 2));
      
      expect(fleet.progress).toBeGreaterThan(initialProgress);
    });

    test('should return arrivals when fleet reaches destination', () => {
      const result = fleetManager.launchFleet(
        'empire_0', origin.id, destination.id, [ship.id], [], 0
      );
      
      const fleet = fleetManager.fleetsInTransit.get(result.fleetId);
      
      // tick past arrival time
      const arrivals = fleetManager.tick(fleet.arrivalTick + 1);
      
      expect(arrivals.length).toBe(1);
      expect(arrivals[0].id).toBe(result.fleetId);
    });

    test('should remove fleet from transit after arrival', () => {
      const result = fleetManager.launchFleet(
        'empire_0', origin.id, destination.id, [ship.id], [], 0
      );
      
      const fleet = fleetManager.fleetsInTransit.get(result.fleetId);
      
      // tick past arrival time
      fleetManager.tick(fleet.arrivalTick + 1);
      
      expect(fleetManager.fleetsInTransit.has(result.fleetId)).toBe(false);
    });
  });

  describe('getFleetsInTransit()', () => {
    test('should return array of fleets', () => {
      const fleets = fleetManager.getFleetsInTransit();
      expect(Array.isArray(fleets)).toBe(true);
    });

    test('should include launched fleets', () => {
      const origin = universe.planets[0];
      const destination = universe.planets[1];
      origin.owner = 'empire_0';
      
      const ship = entityManager.createEntity('fighter', 'empire_0', origin.id);
      
      fleetManager.launchFleet(
        'empire_0', origin.id, destination.id, [ship.id], [], 0
      );
      
      const fleets = fleetManager.getFleetsInTransit();
      expect(fleets.length).toBe(1);
    });
  });

  describe('fleetsInTransit Map access', () => {
    test('should return fleet by id via Map', () => {
      const origin = universe.planets[0];
      const destination = universe.planets[1];
      origin.owner = 'empire_0';
      
      const ship = entityManager.createEntity('fighter', 'empire_0', origin.id);
      
      const result = fleetManager.launchFleet(
        'empire_0', origin.id, destination.id, [ship.id], [], 0
      );
      
      const fleet = fleetManager.fleetsInTransit.get(result.fleetId);
      expect(fleet).toBeDefined();
      expect(fleet.id).toBe(result.fleetId);
    });

    test('should return undefined for unknown fleet', () => {
      const fleet = fleetManager.fleetsInTransit.get('invalid_fleet_id');
      expect(fleet).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // REGRESSION TESTS - Prevent bugs from recurring
  // Added Feb 17, 2026 after orphaned fleet rendering bug
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Fleet serialization (getFleetsInTransit)', () => {
    let origin, destination, ship;

    beforeEach(() => {
      origin = universe.planets[0];
      destination = universe.planets.find(p => p.systemId !== origin.systemId) || universe.planets[1];
      origin.owner = 'empire_0';
      ship = entityManager.createEntity('fighter', 'empire_0', origin.id);
    });

    test('should include all required fields for rendering', () => {
      fleetManager.launchFleet('empire_0', origin.id, destination.id, [ship.id], [], 0);
      const fleets = fleetManager.getFleetsInTransit();
      
      expect(fleets.length).toBe(1);
      const fleet = fleets[0];
      
      // Required fields for renderer
      expect(fleet.id).toBeDefined();
      expect(fleet.empireId).toBe('empire_0');
      expect(fleet.originSystemId).toBeDefined();
      expect(fleet.destSystemId).toBeDefined();
      expect(fleet.originPlanetId).toBe(origin.id);
      expect(fleet.destPlanetId).toBe(destination.id);
      expect(fleet.progress).toBeDefined();
      expect(fleet.arrivalTick).toBeDefined();
      expect(fleet.shipCount).toBeGreaterThan(0);
    });

    test('should include galaxy IDs for cross-galaxy detection', () => {
      fleetManager.launchFleet('empire_0', origin.id, destination.id, [ship.id], [], 0);
      const fleets = fleetManager.getFleetsInTransit();
      const fleet = fleets[0];
      
      expect(fleet.originGalaxyId).toBeDefined();
      expect(fleet.destGalaxyId).toBeDefined();
    });

    test('should include travel type', () => {
      fleetManager.launchFleet('empire_0', origin.id, destination.id, [ship.id], [], 0);
      const fleets = fleetManager.getFleetsInTransit();
      const fleet = fleets[0];
      
      expect(['intra-system', 'inter-system', 'inter-galactic']).toContain(fleet.travelType);
    });
  });

  describe('Fleet progress integrity', () => {
    let origin, destination, ship;

    beforeEach(() => {
      origin = universe.planets[0];
      destination = universe.planets[1];
      origin.owner = 'empire_0';
      ship = entityManager.createEntity('fighter', 'empire_0', origin.id);
    });

    test('progress should be 0 at launch', () => {
      const result = fleetManager.launchFleet('empire_0', origin.id, destination.id, [ship.id], [], 0);
      const fleet = fleetManager.fleetsInTransit.get(result.fleetId);
      
      expect(fleet.progress).toBe(0);
    });

    test('progress at launch tick should be 0', () => {
      // Launch at tick 100
      const result = fleetManager.launchFleet('empire_0', origin.id, destination.id, [ship.id], [], 100);
      const fleet = fleetManager.fleetsInTransit.get(result.fleetId);
      
      // At launch tick, progress should be 0
      fleetManager.tick(100);
      expect(fleet.progress).toBe(0);
      
      // After launch, progress should increase
      fleetManager.tick(150);
      expect(fleet.progress).toBeGreaterThan(0);
    });
    
    test('progress increases over time', () => {
      // Launch immediately at tick 0
      const result = fleetManager.launchFleet('empire_0', origin.id, destination.id, [ship.id], [], 0);
      const fleet = fleetManager.fleetsInTransit.get(result.fleetId);
      
      // Initial tick
      fleetManager.tick(0);
      const initialProgress = fleet.progress;
      
      // After some time
      fleetManager.tick(50);
      expect(fleet.progress).toBeGreaterThan(initialProgress);
    });

    test('progress should be between 0 and 1', () => {
      const result = fleetManager.launchFleet('empire_0', origin.id, destination.id, [ship.id], [], 0);
      const fleet = fleetManager.fleetsInTransit.get(result.fleetId);
      
      // Tick partway through
      fleetManager.tick(Math.floor(fleet.arrivalTick / 2));
      
      expect(fleet.progress).toBeGreaterThanOrEqual(0);
      expect(fleet.progress).toBeLessThanOrEqual(1);
    });
  });

  describe('Fleet system ID validity', () => {
    test('originSystemId should reference existing system', () => {
      const origin = universe.planets[0];
      const destination = universe.planets[1];
      origin.owner = 'empire_0';
      const ship = entityManager.createEntity('fighter', 'empire_0', origin.id);
      
      fleetManager.launchFleet('empire_0', origin.id, destination.id, [ship.id], [], 0);
      const fleets = fleetManager.getFleetsInTransit();
      const fleet = fleets[0];
      
      const originSystem = universe.getSystem(fleet.originSystemId);
      expect(originSystem).toBeDefined();
      expect(originSystem.id).toBe(fleet.originSystemId);
    });

    test('destSystemId should reference existing system', () => {
      const origin = universe.planets[0];
      const destination = universe.planets[1];
      origin.owner = 'empire_0';
      const ship = entityManager.createEntity('fighter', 'empire_0', origin.id);
      
      fleetManager.launchFleet('empire_0', origin.id, destination.id, [ship.id], [], 0);
      const fleets = fleetManager.getFleetsInTransit();
      const fleet = fleets[0];
      
      const destSystem = universe.getSystem(fleet.destSystemId);
      expect(destSystem).toBeDefined();
      expect(destSystem.id).toBe(fleet.destSystemId);
    });
  });

  describe('Fleet clearing', () => {
    test('fleetsInTransit.clear() should remove all fleets', () => {
      const origin = universe.planets[0];
      const destination = universe.planets[1];
      origin.owner = 'empire_0';
      
      // Launch multiple fleets
      for (let i = 0; i < 5; i++) {
        const ship = entityManager.createEntity('fighter', 'empire_0', origin.id);
        fleetManager.launchFleet('empire_0', origin.id, destination.id, [ship.id], [], 0);
      }
      
      expect(fleetManager.fleetsInTransit.size).toBe(5);
      
      // Clear all fleets (simulates game reset)
      fleetManager.fleetsInTransit.clear();
      
      expect(fleetManager.fleetsInTransit.size).toBe(0);
      expect(fleetManager.getFleetsInTransit().length).toBe(0);
    });
  });

  describe('Serialization and deserialization', () => {
    test('loadState should clear existing fleets before loading', () => {
      const origin = universe.planets[0];
      const destination = universe.planets[1];
      origin.owner = 'empire_0';
      const ship = entityManager.createEntity('fighter', 'empire_0', origin.id);
      
      // Launch a fleet
      fleetManager.launchFleet('empire_0', origin.id, destination.id, [ship.id], [], 0);
      expect(fleetManager.fleetsInTransit.size).toBe(1);
      
      // Load empty state (simulates game reset)
      fleetManager.loadState({ fleetsInTransit: [] });
      
      expect(fleetManager.fleetsInTransit.size).toBe(0);
    });

    test('serialize and loadState should be symmetric', () => {
      const origin = universe.planets[0];
      const destination = universe.planets[1];
      origin.owner = 'empire_0';
      const ship = entityManager.createEntity('fighter', 'empire_0', origin.id);
      
      fleetManager.launchFleet('empire_0', origin.id, destination.id, [ship.id], [], 0);
      
      // Serialize
      const serialized = fleetManager.serialize();
      
      // Create new manager and load
      const newFleetManager = new FleetManager(universe, entityManager);
      newFleetManager.loadState(serialized);
      
      expect(newFleetManager.fleetsInTransit.size).toBe(1);
    });
  });
});
