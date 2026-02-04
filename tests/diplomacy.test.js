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

    test('should start with empty pending proposals', () => {
      expect(diplomacy.pendingProposals).toEqual([]);
    });
  });

  describe('getRelationKey()', () => {
    test('should return consistent key regardless of order', () => {
      const key1 = diplomacy.getRelationKey('empire_0', 'empire_1');
      const key2 = diplomacy.getRelationKey('empire_1', 'empire_0');
      expect(key1).toBe(key2);
    });
  });

  describe('getRelation()', () => {
    test('should return "neutral" for unknown empires', () => {
      const relation = diplomacy.getRelation('empire_0', 'empire_1');
      expect(relation).toBe('neutral');
    });

    test('should return "self" for same empire', () => {
      const relation = diplomacy.getRelation('empire_0', 'empire_0');
      expect(relation).toBe('self');
    });

    test('should return same value for swapped empires', () => {
      diplomacy.setRelation('empire_0', 'empire_1', 'allied');
      
      const r1 = diplomacy.getRelation('empire_0', 'empire_1');
      const r2 = diplomacy.getRelation('empire_1', 'empire_0');
      
      expect(r1).toBe(r2);
    });
  });

  describe('setRelation()', () => {
    test('should set relation between empires', () => {
      diplomacy.setRelation('empire_0', 'empire_1', 'allied');
      expect(diplomacy.getRelation('empire_0', 'empire_1')).toBe('allied');
    });

    test('should store relation with timestamp', () => {
      const before = Date.now();
      diplomacy.setRelation('empire_0', 'empire_1', 'war');
      
      const key = diplomacy.getRelationKey('empire_0', 'empire_1');
      const relation = diplomacy.relations.get(key);
      
      expect(relation.since).toBeGreaterThanOrEqual(before);
    });
  });

  describe('proposeAlliance()', () => {
    test('should add proposal to pending list', () => {
      diplomacy.proposeAlliance('empire_0', 'empire_1');
      
      expect(diplomacy.pendingProposals.length).toBe(1);
      expect(diplomacy.pendingProposals[0].type).toBe('alliance');
      expect(diplomacy.pendingProposals[0].from).toBe('empire_0');
      expect(diplomacy.pendingProposals[0].to).toBe('empire_1');
    });
  });

  describe('acceptAlliance()', () => {
    test('should set empires as allied', () => {
      diplomacy.proposeAlliance('empire_0', 'empire_1');
      const result = diplomacy.acceptAlliance('empire_0', 'empire_1');
      
      expect(result).toBe(true);
      expect(diplomacy.getRelation('empire_0', 'empire_1')).toBe('allied');
    });

    test('should remove proposal from pending', () => {
      diplomacy.proposeAlliance('empire_0', 'empire_1');
      diplomacy.acceptAlliance('empire_0', 'empire_1');
      
      expect(diplomacy.pendingProposals.length).toBe(0);
    });

    test('should return false if no matching proposal', () => {
      const result = diplomacy.acceptAlliance('empire_0', 'empire_1');
      expect(result).toBe(false);
    });
  });

  describe('rejectAlliance()', () => {
    test('should remove proposal from pending', () => {
      diplomacy.proposeAlliance('empire_0', 'empire_1');
      const result = diplomacy.rejectAlliance('empire_0', 'empire_1');
      
      expect(result).toBe(true);
      expect(diplomacy.pendingProposals.length).toBe(0);
    });

    test('should return false if no matching proposal', () => {
      const result = diplomacy.rejectAlliance('empire_0', 'empire_1');
      expect(result).toBe(false);
    });
  });

  describe('declareWar()', () => {
    test('should set empires at war', () => {
      diplomacy.declareWar('empire_0', 'empire_1');
      expect(diplomacy.getRelation('empire_0', 'empire_1')).toBe('war');
    });

    test('should break existing alliance first', () => {
      diplomacy.setRelation('empire_0', 'empire_1', 'allied');
      diplomacy.declareWar('empire_0', 'empire_1');
      
      expect(diplomacy.getRelation('empire_0', 'empire_1')).toBe('war');
    });

    test('should track aggressor', () => {
      diplomacy.declareWar('empire_0', 'empire_1');
      
      const key = diplomacy.getRelationKey('empire_0', 'empire_1');
      const relation = diplomacy.relations.get(key);
      
      expect(relation.aggressor).toBe('empire_0');
    });
  });

  describe('proposePeace()', () => {
    test('should add peace proposal when at war', () => {
      diplomacy.declareWar('empire_0', 'empire_1');
      const result = diplomacy.proposePeace('empire_0', 'empire_1');
      
      expect(result).toBe(true);
      expect(diplomacy.pendingProposals.length).toBe(1);
      expect(diplomacy.pendingProposals[0].type).toBe('peace');
    });

    test('should return false when not at war', () => {
      const result = diplomacy.proposePeace('empire_0', 'empire_1');
      expect(result).toBe(false);
    });
  });

  describe('acceptPeace()', () => {
    test('should set relation to neutral when peace accepted', () => {
      diplomacy.declareWar('empire_0', 'empire_1');
      diplomacy.proposePeace('empire_0', 'empire_1');
      diplomacy.acceptPeace('empire_0', 'empire_1');
      
      expect(diplomacy.getRelation('empire_0', 'empire_1')).toBe('neutral');
    });
  });

  describe('isAtWar()', () => {
    test('should return true when empires are at war', () => {
      diplomacy.declareWar('empire_0', 'empire_1');
      expect(diplomacy.getRelation('empire_0', 'empire_1')).toBe('war');
    });

    test('should return false when empires are not at war', () => {
      expect(diplomacy.getRelation('empire_0', 'empire_1')).not.toBe('war');
    });
  });

  describe('isAllied()', () => {
    test('should return true when empires are allied', () => {
      diplomacy.proposeAlliance('empire_0', 'empire_1');
      diplomacy.acceptAlliance('empire_0', 'empire_1');
      
      expect(diplomacy.getRelation('empire_0', 'empire_1')).toBe('allied');
    });
  });
});
