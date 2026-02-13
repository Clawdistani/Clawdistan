import { Universe } from '../core/universe.js';

describe('Universe', () => {
  let universe;

  beforeEach(() => {
    universe = new Universe();
  });

  describe('initialization', () => {
    test('should have default dimensions', () => {
      expect(universe.width).toBe(2400);
      expect(universe.height).toBe(2400);
    });

    test('should start with empty arrays', () => {
      expect(universe.galaxies).toHaveLength(0);
      expect(universe.solarSystems).toHaveLength(0);
      expect(universe.planets).toHaveLength(0);
    });
  });

  describe('generate()', () => {
    beforeEach(() => {
      universe.generate();
    });

    test('should create 20 galaxies', () => {
      expect(universe.galaxies).toHaveLength(20);
    });

    test('should create solar systems', () => {
      expect(universe.solarSystems.length).toBeGreaterThan(0);
    });

    test('should create planets', () => {
      expect(universe.planets.length).toBeGreaterThan(0);
    });

    test('galaxies should have valid properties', () => {
      universe.galaxies.forEach(galaxy => {
        expect(galaxy.id).toBeDefined();
        expect(galaxy.name).toBeDefined();
        expect(typeof galaxy.x).toBe('number');
        expect(typeof galaxy.y).toBe('number');
        expect(galaxy.radius).toBeGreaterThan(0);
        expect(Array.isArray(galaxy.systems)).toBe(true);
      });
    });

    test('solar systems should have valid properties', () => {
      universe.solarSystems.forEach(system => {
        expect(system.id).toBeDefined();
        expect(system.name).toBeDefined();
        expect(system.galaxyId).toBeDefined();
        expect(system.starType).toBeDefined();
        expect(Array.isArray(system.planets)).toBe(true);
      });
    });

    test('planets should have valid properties', () => {
      universe.planets.forEach(planet => {
        expect(planet.id).toBeDefined();
        expect(planet.name).toBeDefined();
        expect(planet.systemId).toBeDefined();
        expect(planet.type).toBeDefined();
        expect(planet.owner).toBeNull();
        expect(planet.surface).toBeDefined();
      });
    });
  });

  describe('getPlanet()', () => {
    beforeEach(() => {
      universe.generate();
    });

    test('should return planet by id', () => {
      const firstPlanet = universe.planets[0];
      const result = universe.getPlanet(firstPlanet.id);
      expect(result).toBe(firstPlanet);
    });

    test('should return undefined for invalid id', () => {
      const result = universe.getPlanet('invalid_id');
      expect(result).toBeUndefined();
    });
  });

  describe('getSystem()', () => {
    beforeEach(() => {
      universe.generate();
    });

    test('should return system by id', () => {
      const firstSystem = universe.solarSystems[0];
      const result = universe.getSystem(firstSystem.id);
      expect(result).toBe(firstSystem);
    });

    test('should return undefined for invalid id', () => {
      const result = universe.getSystem('invalid_id');
      expect(result).toBeUndefined();
    });
  });

  describe('getStartingPlanets()', () => {
    beforeEach(() => {
      universe.generate();
    });

    test('should return requested number of planets', () => {
      const planets = universe.getStartingPlanets(4);
      expect(planets).toHaveLength(4);
    });

    test('should return unique planets', () => {
      const planets = universe.getStartingPlanets(4);
      const ids = planets.map(p => p.id);
      const uniqueIds = [...new Set(ids)];
      expect(uniqueIds).toHaveLength(4);
    });

    test('should return planets from different systems when possible', () => {
      const planets = universe.getStartingPlanets(4);
      const systemIds = planets.map(p => p.systemId);
      const uniqueSystems = [...new Set(systemIds)];
      expect(uniqueSystems.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getPlanetsOwnedBy()', () => {
    beforeEach(() => {
      universe.generate();
      universe.planets[0].owner = 'empire_0';
      universe.planets[1].owner = 'empire_0';
      universe.planets[2].owner = 'empire_1';
    });

    test('should return planets owned by empire', () => {
      const owned = universe.getPlanetsOwnedBy('empire_0');
      expect(owned).toHaveLength(2);
      owned.forEach(p => expect(p.owner).toBe('empire_0'));
    });

    test('should return empty array for empire with no planets', () => {
      const owned = universe.getPlanetsOwnedBy('empire_99');
      expect(owned).toHaveLength(0);
    });
  });

  describe('serializeLight()', () => {
    beforeEach(() => {
      universe.generate();
    });

    test('should return universe without surface data', () => {
      const light = universe.serializeLight();
      
      expect(light.galaxies).toBeDefined();
      expect(light.solarSystems).toBeDefined();
      expect(light.planets).toBeDefined();
      
      // Check that planets don't have surface data
      light.planets.forEach(planet => {
        expect(planet.surface).toBeUndefined();
      });
    });

    test('light serialization should be smaller than full', () => {
      const full = JSON.stringify(universe);
      const light = JSON.stringify(universe.serializeLight());
      expect(light.length).toBeLessThan(full.length);
    });
  });

  describe('surface generation', () => {
    beforeEach(() => {
      universe.generate();
    });

    test('surfaces should have 20x15 dimensions', () => {
      universe.planets.forEach(planet => {
        expect(planet.surface.length).toBe(15); // height
        planet.surface.forEach(row => {
          expect(row.length).toBe(20); // width
        });
      });
    });

    test('surface tiles should be objects with type property', () => {
      const validTerrains = ['water', 'plains', 'forest', 'mountain', 'sand', 'ice', 'lava'];
      universe.planets.forEach(planet => {
        planet.surface.forEach(row => {
          row.forEach(tile => {
            expect(typeof tile).toBe('object');
            expect(tile.type).toBeDefined();
            expect(validTerrains).toContain(tile.type);
          });
        });
      });
    });

    test('surface tiles should have building property', () => {
      universe.planets.forEach(planet => {
        planet.surface.forEach(row => {
          row.forEach(tile => {
            expect(tile.building).toBeNull();
          });
        });
      });
    });

    test('same seed should generate same surface', () => {
      const seed = 12345;
      const surface1 = universe.generateSurface('terrestrial', seed);
      const surface2 = universe.generateSurface('terrestrial', seed);
      expect(JSON.stringify(surface1)).toBe(JSON.stringify(surface2));
    });

    test('different planet types should generate different terrain', () => {
      const terrestrial = universe.generateSurface('terrestrial', 1);
      const desert = universe.generateSurface('desert', 1);
      
      // Desert should have more sand
      const countTerrain = (surface, type) => 
        surface.flat().filter(t => t.type === type).length;
      
      expect(countTerrain(desert, 'sand')).toBeGreaterThan(countTerrain(terrestrial, 'sand'));
    });
  });

  describe('name generation', () => {
    test('should generate galaxy names', () => {
      const name = universe.generateGalaxyName(0);
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    });

    test('should generate system names', () => {
      const name = universe.generateSystemName();
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    });

    test('should convert to roman numerals', () => {
      expect(universe.romanNumeral(1)).toBe('I');
      expect(universe.romanNumeral(4)).toBe('IV');
      expect(universe.romanNumeral(5)).toBe('V');
      expect(universe.romanNumeral(9)).toBe('IX');
      expect(universe.romanNumeral(10)).toBe('X');
    });
  });

  describe('getPlanetSurface()', () => {
    beforeEach(() => {
      universe.generate();
    });

    test('should return surface for valid planet', () => {
      const planet = universe.planets[0];
      const surface = universe.getPlanetSurface(planet.id);
      expect(surface).toBeDefined();
      expect(surface.length).toBe(15);
    });

    test('should return null for invalid planet', () => {
      const surface = universe.getPlanetSurface('invalid_id');
      expect(surface).toBeNull();
    });
  });
});
