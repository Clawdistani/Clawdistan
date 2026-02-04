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
      const tech = techTree.getTech('improved_mining');
      
      expect(tech).toBeDefined();
      expect(tech.name).toBe('Improved Mining');
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

  describe('hasResearched()', () => {
    test('should return false for unresearched tech', () => {
      expect(techTree.hasResearched('empire_0', 'improved_mining')).toBe(false);
    });

    test('should return true after completing research', () => {
      techTree.complete('empire_0', 'improved_mining');
      expect(techTree.hasResearched('empire_0', 'improved_mining')).toBe(true);
    });

    test('should track research per empire', () => {
      techTree.complete('empire_0', 'improved_mining');
      
      expect(techTree.hasResearched('empire_0', 'improved_mining')).toBe(true);
      expect(techTree.hasResearched('empire_1', 'improved_mining')).toBe(false);
    });
  });

  describe('canResearch()', () => {
    test('should return true for tier 1 tech with no prereqs', () => {
      expect(techTree.canResearch('empire_0', 'improved_mining')).toBe(true);
    });

    test('should return false for already researched tech', () => {
      techTree.complete('empire_0', 'improved_mining');
      expect(techTree.canResearch('empire_0', 'improved_mining')).toBe(false);
    });

    test('should return false if prerequisites not met', () => {
      // advanced_mining requires improved_mining
      expect(techTree.canResearch('empire_0', 'advanced_mining')).toBe(false);
    });

    test('should return true once prerequisites are met', () => {
      techTree.complete('empire_0', 'improved_mining');
      expect(techTree.canResearch('empire_0', 'advanced_mining')).toBe(true);
    });

    test('should return false for unknown tech', () => {
      expect(techTree.canResearch('empire_0', 'fake_tech')).toBe(false);
    });
  });

  describe('complete()', () => {
    test('should mark tech as researched', () => {
      techTree.complete('empire_0', 'improved_mining');
      expect(techTree.hasResearched('empire_0', 'improved_mining')).toBe(true);
    });

    test('should create empire entry if not exists', () => {
      expect(techTree.researched.has('empire_0')).toBe(false);
      techTree.complete('empire_0', 'improved_mining');
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
      techTree.complete('empire_0', 'improved_mining');
      const available = techTree.getAvailable('empire_0');
      
      const ids = available.map(t => t.id);
      expect(ids).not.toContain('improved_mining');
    });

    test('should include newly available techs after completing prereqs', () => {
      techTree.complete('empire_0', 'improved_mining');
      const available = techTree.getAvailable('empire_0');
      
      const ids = available.map(t => t.id);
      expect(ids).toContain('advanced_mining');
    });
  });

  describe('getResearched()', () => {
    test('should return empty array initially', () => {
      const researched = techTree.getResearched('empire_0');
      expect(researched).toEqual([]);
    });

    test('should return researched tech objects', () => {
      techTree.complete('empire_0', 'improved_mining');
      techTree.complete('empire_0', 'basic_weapons');
      
      const researched = techTree.getResearched('empire_0');
      
      expect(researched.length).toBe(2);
      expect(researched.map(t => t.id)).toContain('improved_mining');
      expect(researched.map(t => t.id)).toContain('basic_weapons');
    });
  });

  describe('getEffects()', () => {
    test('should return combined effects of researched techs', () => {
      const emptyEffects = techTree.getEffects('empire_0');
      expect(emptyEffects.mineralBonus).toBe(0);
      
      techTree.complete('empire_0', 'improved_mining');
      const effects = techTree.getEffects('empire_0');
      
      expect(effects.mineralBonus).toBeGreaterThan(0);
    });
  });

  describe('tech tree structure', () => {
    test('should have multiple tiers', () => {
      const tiers = new Set(techTree.getAllTech().map(t => t.tier));
      expect(tiers.size).toBeGreaterThan(1);
    });

    test('should have ascension as victory tech', () => {
      const ascension = techTree.getTech('ascension');
      expect(ascension).toBeDefined();
      expect(ascension.effects.victory).toBe('technological');
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
  });
});
