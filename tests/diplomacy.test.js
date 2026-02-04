import { DiplomacySystem } from '../core/diplomacy.js';

describe('DiplomacySystem', () => {
  let diplomacy;

  beforeEach(() => {
    diplomacy = new DiplomacySystem();
  });

  describe('initialization', () => {
    test('should start with empty relations', () => {
      expect(diplomacy.relations.size).toBe(0);
    });

    test('should start with empty treaties', () => {
      expect(diplomacy.treaties.size).toBe(0);
    });

    test('should start with empty proposals', () => {
      expect(diplomacy.pendingProposals.size).toBe(0);
    });
  });

  describe('getRelation()', () => {
    test('should return default neutral relation', () => {
      const relation = diplomacy.getRelation('empire_0', 'empire_1');
      expect(relation).toBe(0);
    });

    test('should return same value for swapped empires', () => {
      diplomacy.setRelation('empire_0', 'empire_1', 50);
      
      const r1 = diplomacy.getRelation('empire_0', 'empire_1');
      const r2 = diplomacy.getRelation('empire_1', 'empire_0');
      
      expect(r1).toBe(r2);
    });
  });

  describe('setRelation()', () => {
    test('should set relation between empires', () => {
      diplomacy.setRelation('empire_0', 'empire_1', 75);
      expect(diplomacy.getRelation('empire_0', 'empire_1')).toBe(75);
    });

    test('should clamp to valid range', () => {
      diplomacy.setRelation('empire_0', 'empire_1', 150);
      expect(diplomacy.getRelation('empire_0', 'empire_1')).toBeLessThanOrEqual(100);
      
      diplomacy.setRelation('empire_0', 'empire_1', -150);
      expect(diplomacy.getRelation('empire_0', 'empire_1')).toBeGreaterThanOrEqual(-100);
    });
  });

  describe('modifyRelation()', () => {
    test('should add to existing relation', () => {
      diplomacy.setRelation('empire_0', 'empire_1', 50);
      diplomacy.modifyRelation('empire_0', 'empire_1', 10);
      
      expect(diplomacy.getRelation('empire_0', 'empire_1')).toBe(60);
    });

    test('should subtract from relation', () => {
      diplomacy.setRelation('empire_0', 'empire_1', 50);
      diplomacy.modifyRelation('empire_0', 'empire_1', -20);
      
      expect(diplomacy.getRelation('empire_0', 'empire_1')).toBe(30);
    });
  });

  describe('proposeTreaty()', () => {
    test('should create pending proposal', () => {
      const result = diplomacy.proposeTreaty('empire_0', 'empire_1', 'non_aggression');
      
      expect(result.success).toBe(true);
      expect(result.proposalId).toBeDefined();
    });

    test('should reject duplicate pending proposals', () => {
      diplomacy.proposeTreaty('empire_0', 'empire_1', 'non_aggression');
      const result = diplomacy.proposeTreaty('empire_0', 'empire_1', 'non_aggression');
      
      expect(result.success).toBe(false);
    });
  });

  describe('acceptTreaty()', () => {
    test('should create treaty when accepted', () => {
      const proposal = diplomacy.proposeTreaty('empire_0', 'empire_1', 'non_aggression');
      const result = diplomacy.acceptTreaty(proposal.proposalId, 'empire_1');
      
      expect(result.success).toBe(true);
      expect(diplomacy.getTreaties('empire_0').length).toBeGreaterThan(0);
    });

    test('should reject if not the target empire', () => {
      const proposal = diplomacy.proposeTreaty('empire_0', 'empire_1', 'non_aggression');
      const result = diplomacy.acceptTreaty(proposal.proposalId, 'empire_2');
      
      expect(result.success).toBe(false);
    });

    test('should improve relations when treaty accepted', () => {
      const beforeRelation = diplomacy.getRelation('empire_0', 'empire_1');
      
      const proposal = diplomacy.proposeTreaty('empire_0', 'empire_1', 'non_aggression');
      diplomacy.acceptTreaty(proposal.proposalId, 'empire_1');
      
      const afterRelation = diplomacy.getRelation('empire_0', 'empire_1');
      expect(afterRelation).toBeGreaterThanOrEqual(beforeRelation);
    });
  });

  describe('rejectTreaty()', () => {
    test('should remove pending proposal', () => {
      const proposal = diplomacy.proposeTreaty('empire_0', 'empire_1', 'non_aggression');
      diplomacy.rejectTreaty(proposal.proposalId, 'empire_1');
      
      expect(diplomacy.pendingProposals.has(proposal.proposalId)).toBe(false);
    });

    test('should slightly harm relations', () => {
      diplomacy.setRelation('empire_0', 'empire_1', 50);
      
      const proposal = diplomacy.proposeTreaty('empire_0', 'empire_1', 'non_aggression');
      diplomacy.rejectTreaty(proposal.proposalId, 'empire_1');
      
      expect(diplomacy.getRelation('empire_0', 'empire_1')).toBeLessThanOrEqual(50);
    });
  });

  describe('breakTreaty()', () => {
    test('should remove existing treaty', () => {
      const proposal = diplomacy.proposeTreaty('empire_0', 'empire_1', 'non_aggression');
      diplomacy.acceptTreaty(proposal.proposalId, 'empire_1');
      
      const treaties = diplomacy.getTreaties('empire_0');
      expect(treaties.length).toBe(1);
      
      diplomacy.breakTreaty(treaties[0].id, 'empire_0');
      expect(diplomacy.getTreaties('empire_0').length).toBe(0);
    });

    test('should significantly harm relations', () => {
      diplomacy.setRelation('empire_0', 'empire_1', 50);
      
      const proposal = diplomacy.proposeTreaty('empire_0', 'empire_1', 'non_aggression');
      diplomacy.acceptTreaty(proposal.proposalId, 'empire_1');
      
      const treaties = diplomacy.getTreaties('empire_0');
      diplomacy.breakTreaty(treaties[0].id, 'empire_0');
      
      expect(diplomacy.getRelation('empire_0', 'empire_1')).toBeLessThan(50);
    });
  });

  describe('getTreaties()', () => {
    test('should return all treaties for empire', () => {
      const p1 = diplomacy.proposeTreaty('empire_0', 'empire_1', 'non_aggression');
      const p2 = diplomacy.proposeTreaty('empire_0', 'empire_2', 'trade');
      
      diplomacy.acceptTreaty(p1.proposalId, 'empire_1');
      diplomacy.acceptTreaty(p2.proposalId, 'empire_2');
      
      const treaties = diplomacy.getTreaties('empire_0');
      expect(treaties.length).toBe(2);
    });

    test('should return empty array for empire with no treaties', () => {
      const treaties = diplomacy.getTreaties('empire_3');
      expect(treaties).toHaveLength(0);
    });
  });

  describe('hasTreaty()', () => {
    test('should return true if treaty exists', () => {
      const proposal = diplomacy.proposeTreaty('empire_0', 'empire_1', 'non_aggression');
      diplomacy.acceptTreaty(proposal.proposalId, 'empire_1');
      
      expect(diplomacy.hasTreaty('empire_0', 'empire_1', 'non_aggression')).toBe(true);
    });

    test('should return false if no treaty', () => {
      expect(diplomacy.hasTreaty('empire_0', 'empire_1', 'non_aggression')).toBe(false);
    });
  });

  describe('areAtWar()', () => {
    test('should return true when war declared', () => {
      diplomacy.declareWar('empire_0', 'empire_1');
      expect(diplomacy.areAtWar('empire_0', 'empire_1')).toBe(true);
    });

    test('should return false when not at war', () => {
      expect(diplomacy.areAtWar('empire_0', 'empire_1')).toBe(false);
    });
  });

  describe('declareWar()', () => {
    test('should set empires at war', () => {
      diplomacy.declareWar('empire_0', 'empire_1');
      expect(diplomacy.areAtWar('empire_0', 'empire_1')).toBe(true);
    });

    test('should break existing treaties', () => {
      const proposal = diplomacy.proposeTreaty('empire_0', 'empire_1', 'non_aggression');
      diplomacy.acceptTreaty(proposal.proposalId, 'empire_1');
      
      diplomacy.declareWar('empire_0', 'empire_1');
      
      expect(diplomacy.getTreaties('empire_0').length).toBe(0);
    });

    test('should set relation to minimum', () => {
      diplomacy.setRelation('empire_0', 'empire_1', 50);
      diplomacy.declareWar('empire_0', 'empire_1');
      
      expect(diplomacy.getRelation('empire_0', 'empire_1')).toBe(-100);
    });
  });

  describe('makePeace()', () => {
    test('should end war between empires', () => {
      diplomacy.declareWar('empire_0', 'empire_1');
      diplomacy.makePeace('empire_0', 'empire_1');
      
      expect(diplomacy.areAtWar('empire_0', 'empire_1')).toBe(false);
    });

    test('should improve relations from minimum', () => {
      diplomacy.declareWar('empire_0', 'empire_1');
      diplomacy.makePeace('empire_0', 'empire_1');
      
      expect(diplomacy.getRelation('empire_0', 'empire_1')).toBeGreaterThan(-100);
    });
  });
});
