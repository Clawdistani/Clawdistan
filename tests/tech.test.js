import { TechTree } from '../core/tech.js';

describe('TechTree', () => {
  let techTree;

  beforeEach(() => {
    techTree = new TechTree();
  });

  describe('initialization', () => {
    test('should have technology definitions', () => {
      expect(techTree.technologies).toBeDefined();
      expect(Object.keys(techTree.technologies).length).toBeGreaterThan(0);
    });

    test('should have empty researched map', () => {
      expect(techTree.researched.size).toBe(0);
    });
  });

  describe('getTech()', () => {
    test('should return tech by id', () => {
      const tech = techTree.getTech('physics_fundamentals');
      
      expect(tech).toBeDefined();
      expect(tech.name).toBe('Physics Fundamentals');
      expect(tech.cost).toBeGreaterThan(0);
    });

    test('should return undefined for unknown tech', () => {
      const tech = techTree.getTech('fake_tech');
      expect(tech).toBeUndefined();
    });
  });

  describe('getAllTech()', () => {
    test('should return array of all technologies', () => {
      const allTech = techTree.getAllTech();
      
      expect(Array.isArray(allTech)).toBe(true);
      expect(allTech.length).toBeGreaterThan(0);
    });

    test('should have many technologies (expanded tree)', () => {
      const allTech = techTree.getAllTech();
      expect(allTech.length).toBeGreaterThan(70); // Expanded tree has 80+ techs
    });

    test('each tech should have required properties', () => {
      const allTech = techTree.getAllTech();
      
      allTech.forEach(tech => {
        expect(tech.id).toBeDefined();
        expect(tech.name).toBeDefined();
        expect(tech.cost).toBeGreaterThan(0);
        expect(tech.tier).toBeGreaterThan(0);
        expect(Array.isArray(tech.prerequisites)).toBe(true);
      });
    });
  });

  describe('getTechsByTier()', () => {
    test('should return techs for specified tier', () => {
      const tier1 = techTree.getTechsByTier(1);
      expect(tier1.length).toBeGreaterThan(0);
      tier1.forEach(tech => expect(tech.tier).toBe(1));
    });

    test('should have 5 tiers', () => {
      for (let i = 1; i <= 5; i++) {
        const tierTechs = techTree.getTechsByTier(i);
        expect(tierTechs.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getTechsByCategory()', () => {
    test('should return techs for physics category', () => {
      const physics = techTree.getTechsByCategory('physics');
      expect(physics.length).toBeGreaterThan(0);
      physics.forEach(tech => expect(tech.category).toBe('physics'));
    });

    test('should have multiple categories', () => {
      const categories = techTree.getCategories();
      expect(categories).toContain('physics');
      expect(categories).toContain('engineering');
      expect(categories).toContain('biology');
      expect(categories).toContain('military');
      expect(categories).toContain('society');
    });
  });

  describe('hasResearched()', () => {
    test('should return false for unresearched tech', () => {
      expect(techTree.hasResearched('empire_0', 'physics_fundamentals')).toBe(false);
    });

    test('should return true after completing research', () => {
      techTree.complete('empire_0', 'physics_fundamentals');
      expect(techTree.hasResearched('empire_0', 'physics_fundamentals')).toBe(true);
    });

    test('should track research per empire', () => {
      techTree.complete('empire_0', 'physics_fundamentals');
      
      expect(techTree.hasResearched('empire_0', 'physics_fundamentals')).toBe(true);
      expect(techTree.hasResearched('empire_1', 'physics_fundamentals')).toBe(false);
    });
  });

  describe('canResearch()', () => {
    test('should return true for tier 1 fundamentals with no prereqs', () => {
      // Fundamentals have no prerequisites
      expect(techTree.canResearch('empire_0', 'physics_fundamentals')).toBe(true);
      expect(techTree.canResearch('empire_0', 'engineering_fundamentals')).toBe(true);
      expect(techTree.canResearch('empire_0', 'biology_fundamentals')).toBe(true);
      expect(techTree.canResearch('empire_0', 'military_fundamentals')).toBe(true);
      expect(techTree.canResearch('empire_0', 'society_fundamentals')).toBe(true);
    });

    test('should return false for already researched tech', () => {
      techTree.complete('empire_0', 'physics_fundamentals');
      expect(techTree.canResearch('empire_0', 'physics_fundamentals')).toBe(false);
    });

    test('should return false if prerequisites not met', () => {
      // basic_energy requires physics_fundamentals
      expect(techTree.canResearch('empire_0', 'basic_energy')).toBe(false);
    });

    test('should return true once prerequisites are met', () => {
      techTree.complete('empire_0', 'physics_fundamentals');
      expect(techTree.canResearch('empire_0', 'basic_energy')).toBe(true);
    });

    test('should return false for unknown tech', () => {
      expect(techTree.canResearch('empire_0', 'fake_tech')).toBe(false);
    });
  });

  describe('complete()', () => {
    test('should mark tech as researched', () => {
      techTree.complete('empire_0', 'physics_fundamentals');
      expect(techTree.hasResearched('empire_0', 'physics_fundamentals')).toBe(true);
    });

    test('should create empire entry if not exists', () => {
      expect(techTree.researched.has('empire_0')).toBe(false);
      techTree.complete('empire_0', 'physics_fundamentals');
      expect(techTree.researched.has('empire_0')).toBe(true);
    });
  });

  describe('getAvailable()', () => {
    test('should return techs with no prerequisites initially', () => {
      const available = techTree.getAvailable('empire_0');
      
      expect(available.length).toBeGreaterThan(0);
      available.forEach(tech => {
        expect(tech.prerequisites.length).toBe(0);
      });
    });

    test('should not include researched techs', () => {
      techTree.complete('empire_0', 'physics_fundamentals');
      const available = techTree.getAvailable('empire_0');
      
      const ids = available.map(t => t.id);
      expect(ids).not.toContain('physics_fundamentals');
    });

    test('should include newly available techs after completing prereqs', () => {
      techTree.complete('empire_0', 'physics_fundamentals');
      const available = techTree.getAvailable('empire_0');
      
      const ids = available.map(t => t.id);
      expect(ids).toContain('basic_energy');
      expect(ids).toContain('basic_propulsion');
    });
  });

  describe('getResearched()', () => {
    test('should return empty array initially', () => {
      const researched = techTree.getResearched('empire_0');
      expect(researched).toEqual([]);
    });

    test('should return researched tech objects', () => {
      techTree.complete('empire_0', 'physics_fundamentals');
      techTree.complete('empire_0', 'engineering_fundamentals');
      
      const researched = techTree.getResearched('empire_0');
      
      expect(researched.length).toBe(2);
      expect(researched.map(t => t.id)).toContain('physics_fundamentals');
      expect(researched.map(t => t.id)).toContain('engineering_fundamentals');
    });
  });

  describe('getEffects()', () => {
    test('should return combined effects of researched techs', () => {
      const emptyEffects = techTree.getEffects('empire_0');
      expect(emptyEffects.researchBonus).toBe(0);
      
      techTree.complete('empire_0', 'physics_fundamentals');
      const effects = techTree.getEffects('empire_0');
      
      expect(effects.researchBonus).toBeGreaterThan(0);
    });

    test('should stack effects from multiple techs', () => {
      techTree.complete('empire_0', 'physics_fundamentals');
      techTree.complete('empire_0', 'engineering_fundamentals');
      
      const effects = techTree.getEffects('empire_0');
      
      expect(effects.researchBonus).toBeGreaterThan(0);
      expect(effects.buildSpeedBonus).toBeGreaterThan(0);
    });
  });

  describe('rare techs', () => {
    test('should have rare techs marked', () => {
      const psionic = techTree.getTech('psionic_theory');
      expect(psionic).toBeDefined();
      expect(psionic.rare).toBe(true);
    });

    test('should not be able to research undiscovered rare techs', () => {
      expect(techTree.canResearch('empire_0', 'psionic_theory')).toBe(false);
    });

    test('should be able to research discovered rare techs', () => {
      techTree.discoverRareTech('empire_0', 'psionic_theory');
      expect(techTree.canResearch('empire_0', 'psionic_theory')).toBe(true);
    });
  });

  describe('serialization', () => {
    test('should serialize researched state', () => {
      techTree.complete('empire_0', 'physics_fundamentals');
      techTree.complete('empire_1', 'engineering_fundamentals');
      
      const data = techTree.serialize();
      
      expect(data.researched['empire_0']).toContain('physics_fundamentals');
      expect(data.researched['empire_1']).toContain('engineering_fundamentals');
    });

    test('should deserialize researched state', () => {
      const data = {
        researched: {
          'empire_0': ['physics_fundamentals', 'basic_energy']
        },
        discoveredRare: {}
      };
      
      techTree.deserialize(data);
      
      expect(techTree.hasResearched('empire_0', 'physics_fundamentals')).toBe(true);
      expect(techTree.hasResearched('empire_0', 'basic_energy')).toBe(true);
    });
  });

  describe('tech tree structure', () => {
    test('should have multiple tiers', () => {
      const tiers = new Set(techTree.getAllTech().map(t => t.tier));
      expect(tiers.size).toBe(5);
    });

    test('should have ascension as victory tech', () => {
      const ascension = techTree.getTech('ascension');
      expect(ascension).toBeDefined();
      expect(ascension.effects.victory).toBe('technological');
    });

    test('should have multiple ascension paths', () => {
      const psionic = techTree.getTech('ascension_psionic');
      const synthetic = techTree.getTech('ascension_synthetic');
      const genetic = techTree.getTech('ascension_genetic');
      
      expect(psionic).toBeDefined();
      expect(synthetic).toBeDefined();
      expect(genetic).toBeDefined();
    });

    test('prerequisites should reference existing techs', () => {
      const allTech = techTree.getAllTech();
      const techIds = new Set(allTech.map(t => t.id));
      
      allTech.forEach(tech => {
        tech.prerequisites.forEach(prereq => {
          expect(techIds.has(prereq)).toBe(true);
        });
      });
    });

    test('should have categories', () => {
      const categories = techTree.getCategories();
      expect(categories.length).toBeGreaterThan(3);
    });
  });
});
