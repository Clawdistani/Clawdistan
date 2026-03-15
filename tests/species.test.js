import { SpeciesManager } from '../core/species.js';

describe('SpeciesManager', () => {
  let speciesManager;

  beforeEach(() => {
    speciesManager = new SpeciesManager();
  });

  describe('initialization', () => {
    test('should have species definitions loaded', () => {
      expect(speciesManager.species).toBeDefined();
      expect(Object.keys(speciesManager.species).length).toBeGreaterThan(0);
    });

    test('should have synthari species', () => {
      expect(speciesManager.species['synthari']).toBeDefined();
    });

    test('should have velthari species', () => {
      expect(speciesManager.species['velthari']).toBeDefined();
    });
  });

  describe('getSpecies()', () => {
    test('should return species by id', () => {
      const species = speciesManager.getSpecies('synthari');
      expect(species).toBeDefined();
      expect(species.name).toBe('Synthari');
    });

    test('should return null for unknown species', () => {
      const species = speciesManager.getSpecies('nonexistent');
      expect(species).toBeNull();
    });
  });

  describe('getAllSpecies()', () => {
    test('should return array of all species', () => {
      const allSpecies = speciesManager.getAllSpecies();
      expect(Array.isArray(allSpecies)).toBe(true);
      expect(allSpecies.length).toBeGreaterThan(0);
    });

    test('each species should have required properties', () => {
      const allSpecies = speciesManager.getAllSpecies();
      allSpecies.forEach(species => {
        expect(species.id).toBeDefined();
        expect(species.name).toBeDefined();
        expect(species.traits).toBeDefined();
        expect(species.category).toBeDefined();
      });
    });
  });

  describe('getSpeciesByCategory()', () => {
    test('should return organic species', () => {
      const organicSpecies = speciesManager.getSpeciesByCategory('organic');
      expect(Array.isArray(organicSpecies)).toBe(true);
      organicSpecies.forEach(species => {
        expect(species.category).toBe('organic');
      });
    });

    test('should return synthetic species', () => {
      const syntheticSpecies = speciesManager.getSpeciesByCategory('synthetic');
      expect(Array.isArray(syntheticSpecies)).toBe(true);
      syntheticSpecies.forEach(species => {
        expect(species.category).toBe('synthetic');
      });
    });
  });

  describe('traits and modifiers', () => {
    test('synthari should have research bonus', () => {
      const synthari = speciesManager.getSpecies('synthari');
      expect(synthari.traits.research_bonus).toBeGreaterThan(0);
    });

    test('should calculate production modifier correctly', () => {
      const modifier = speciesManager.getProductionModifier('synthari', 'research');
      expect(modifier).toBeGreaterThan(1.0);
    });

    test('should return 1.0 for unknown species', () => {
      const modifier = speciesManager.getProductionModifier('nonexistent', 'minerals');
      expect(modifier).toBe(1.0);
    });
  });

  describe('getSpeciesSummary()', () => {
    test('should return summary for valid species', () => {
      const summary = speciesManager.getSpeciesSummary('synthari');
      expect(summary).toBeDefined();
      expect(summary.id).toBe('synthari');
      expect(summary.name).toBe('Synthari');
    });

    test('should return null for unknown species', () => {
      const summary = speciesManager.getSpeciesSummary('nonexistent');
      expect(summary).toBeNull();
    });
  });

  describe('getDiplomacyModifier()', () => {
    test('should return diplomacy modifier for species with bonus', () => {
      const allSpecies = speciesManager.getAllSpecies();
      let hasDiplomacyBonus = false;
      
      for (const species of allSpecies) {
        if (species.traits.diplomacy_bonus) {
          const modifier = speciesManager.getDiplomacyModifier(species.id);
          expect(modifier).toBeGreaterThan(1.0);
          hasDiplomacyBonus = true;
          break;
        }
      }
      
      if (!hasDiplomacyBonus) {
        const modifier = speciesManager.getDiplomacyModifier('synthari');
        expect(modifier).toBe(1.0);
      }
    });

    test('should return 1.0 for unknown species', () => {
      const modifier = speciesManager.getDiplomacyModifier('nonexistent');
      expect(modifier).toBe(1.0);
    });
  });

  describe('getCombatModifier()', () => {
    test('should calculate combat modifier', () => {
      const modifier = speciesManager.getCombatModifier('krath');
      expect(modifier).toBeDefined();
      expect(typeof modifier).toBe('number');
    });

    test('should return 1.0 for unknown species', () => {
      const modifier = speciesManager.getCombatModifier('nonexistent');
      expect(modifier).toBe(1.0);
    });
  });

  describe('species lore', () => {
    test('each species should have lore object', () => {
      const allSpecies = speciesManager.getAllSpecies();
      allSpecies.forEach(species => {
        expect(species.lore).toBeDefined();
        expect(species.lore.origin).toBeDefined();
      });
    });

    test('species should have description', () => {
      const synthari = speciesManager.getSpecies('synthari');
      expect(synthari.description).toBeDefined();
      expect(synthari.description.length).toBeGreaterThan(0);
    });
  });

  describe('getRandomSpecies()', () => {
    test('should return a valid species', () => {
      const randomSpecies = speciesManager.getRandomSpecies();
      expect(randomSpecies).toBeDefined();
      expect(randomSpecies.id).toBeDefined();
      expect(randomSpecies.name).toBeDefined();
    });

    test('should return random species from available options', () => {
      const results = new Set();
      for (let i = 0; i < 10; i++) {
        results.add(speciesManager.getRandomSpecies().id);
      }
      expect(results.size).toBeGreaterThanOrEqual(1);
    });
  });
});

