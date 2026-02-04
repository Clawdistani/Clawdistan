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

    test('should have empty empire research', () => {
      expect(techTree.empireResearch.size).toBe(0);
    });
  });

  describe('initializeEmpire()', () => {
    test('should set up research state for empire', () => {
      techTree.initializeEmpire('empire_0');
      
      const state = techTree.getResearchState('empire_0');
      expect(state).toBeDefined();
      expect(state.researched).toBeDefined();
      expect(state.currentResearch).toBeNull();
    });
  });

  describe('getAvailableTechs()', () => {
    beforeEach(() => {
      techTree.initializeEmpire('empire_0');
    });

    test('should return techs with no prerequisites', () => {
      const available = techTree.getAvailableTechs('empire_0');
      
      expect(available.length).toBeGreaterThan(0);
      // All should have no prerequisites or met prerequisites
      available.forEach(tech => {
        const def = techTree.technologies[tech.id];
        if (def.prerequisites) {
          def.prerequisites.forEach(prereq => {
            expect(techTree.hasResearched('empire_0', prereq)).toBe(true);
          });
        }
      });
    });

    test('should not include already researched techs', () => {
      const initial = techTree.getAvailableTechs('empire_0');
      if (initial.length === 0) return;
      
      // Research first available tech
      const firstTech = initial[0];
      techTree.startResearch('empire_0', firstTech.id);
      techTree.completeResearch('empire_0');
      
      const after = techTree.getAvailableTechs('empire_0');
      const ids = after.map(t => t.id);
      expect(ids).not.toContain(firstTech.id);
    });
  });

  describe('startResearch()', () => {
    beforeEach(() => {
      techTree.initializeEmpire('empire_0');
    });

    test('should set current research', () => {
      const available = techTree.getAvailableTechs('empire_0');
      if (available.length === 0) return;
      
      const result = techTree.startResearch('empire_0', available[0].id);
      
      expect(result.success).toBe(true);
      expect(techTree.getResearchState('empire_0').currentResearch).toBe(available[0].id);
    });

    test('should reject unavailable tech', () => {
      const result = techTree.startResearch('empire_0', 'fake_tech');
      expect(result.success).toBe(false);
    });

    test('should reject already researched tech', () => {
      const available = techTree.getAvailableTechs('empire_0');
      if (available.length === 0) return;
      
      techTree.startResearch('empire_0', available[0].id);
      techTree.completeResearch('empire_0');
      
      const result = techTree.startResearch('empire_0', available[0].id);
      expect(result.success).toBe(false);
    });
  });

  describe('addResearchProgress()', () => {
    beforeEach(() => {
      techTree.initializeEmpire('empire_0');
      const available = techTree.getAvailableTechs('empire_0');
      if (available.length > 0) {
        techTree.startResearch('empire_0', available[0].id);
      }
    });

    test('should add progress to current research', () => {
      const stateBefore = techTree.getResearchState('empire_0');
      if (!stateBefore.currentResearch) return;
      
      const progressBefore = stateBefore.progress || 0;
      techTree.addResearchProgress('empire_0', 10);
      
      const stateAfter = techTree.getResearchState('empire_0');
      expect(stateAfter.progress).toBe(progressBefore + 10);
    });

    test('should return completion status', () => {
      const state = techTree.getResearchState('empire_0');
      if (!state.currentResearch) return;
      
      // Add enough progress to complete
      const result = techTree.addResearchProgress('empire_0', 10000);
      expect(result.completed !== undefined || result === true || result === false).toBe(true);
    });
  });

  describe('completeResearch()', () => {
    beforeEach(() => {
      techTree.initializeEmpire('empire_0');
      const available = techTree.getAvailableTechs('empire_0');
      if (available.length > 0) {
        techTree.startResearch('empire_0', available[0].id);
      }
    });

    test('should mark tech as researched', () => {
      const state = techTree.getResearchState('empire_0');
      if (!state.currentResearch) return;
      
      const techId = state.currentResearch;
      techTree.completeResearch('empire_0');
      
      expect(techTree.hasResearched('empire_0', techId)).toBe(true);
    });

    test('should clear current research', () => {
      techTree.completeResearch('empire_0');
      
      const state = techTree.getResearchState('empire_0');
      expect(state.currentResearch).toBeNull();
    });
  });

  describe('hasResearched()', () => {
    beforeEach(() => {
      techTree.initializeEmpire('empire_0');
    });

    test('should return false for unresearched tech', () => {
      const available = techTree.getAvailableTechs('empire_0');
      if (available.length === 0) return;
      
      expect(techTree.hasResearched('empire_0', available[0].id)).toBe(false);
    });

    test('should return true for researched tech', () => {
      const available = techTree.getAvailableTechs('empire_0');
      if (available.length === 0) return;
      
      techTree.startResearch('empire_0', available[0].id);
      techTree.completeResearch('empire_0');
      
      expect(techTree.hasResearched('empire_0', available[0].id)).toBe(true);
    });
  });

  describe('getTechInfo()', () => {
    test('should return tech definition', () => {
      const techs = Object.keys(techTree.technologies);
      if (techs.length === 0) return;
      
      const info = techTree.getTechInfo(techs[0]);
      
      expect(info).toBeDefined();
      expect(info.name).toBeDefined();
      expect(info.cost).toBeDefined();
    });

    test('should return null for unknown tech', () => {
      const info = techTree.getTechInfo('fake_tech');
      expect(info).toBeNull();
    });
  });

  describe('getResearchedTechs()', () => {
    beforeEach(() => {
      techTree.initializeEmpire('empire_0');
    });

    test('should return empty array initially', () => {
      const researched = techTree.getResearchedTechs('empire_0');
      expect(researched).toHaveLength(0);
    });

    test('should return researched techs', () => {
      const available = techTree.getAvailableTechs('empire_0');
      if (available.length === 0) return;
      
      techTree.startResearch('empire_0', available[0].id);
      techTree.completeResearch('empire_0');
      
      const researched = techTree.getResearchedTechs('empire_0');
      expect(researched.length).toBeGreaterThan(0);
    });
  });

  describe('tech benefits', () => {
    beforeEach(() => {
      techTree.initializeEmpire('empire_0');
    });

    test('technologies should have defined benefits', () => {
      Object.values(techTree.technologies).forEach(tech => {
        expect(tech.name).toBeDefined();
        expect(tech.cost).toBeGreaterThan(0);
        expect(tech.description || tech.effect || tech.unlocks).toBeDefined();
      });
    });
  });

  describe('cancelResearch()', () => {
    beforeEach(() => {
      techTree.initializeEmpire('empire_0');
      const available = techTree.getAvailableTechs('empire_0');
      if (available.length > 0) {
        techTree.startResearch('empire_0', available[0].id);
      }
    });

    test('should clear current research', () => {
      techTree.cancelResearch('empire_0');
      
      const state = techTree.getResearchState('empire_0');
      expect(state.currentResearch).toBeNull();
    });

    test('should reset progress', () => {
      techTree.addResearchProgress('empire_0', 50);
      techTree.cancelResearch('empire_0');
      
      const state = techTree.getResearchState('empire_0');
      expect(state.progress || 0).toBe(0);
    });
  });
});
