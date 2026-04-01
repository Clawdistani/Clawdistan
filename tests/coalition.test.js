import { CoalitionManager } from '../core/coalition.js';

describe('Coalition System', () => {
    let coalitionManager;
    let mockEmpires;
    
    beforeEach(() => {
        coalitionManager = new CoalitionManager();
        
        // Create mock empires with scores
        mockEmpires = new Map([
            ['empire_0', { id: 'empire_0', name: 'Alpha Empire', score: 1000, defeated: false }],
            ['empire_1', { id: 'empire_1', name: 'Beta Empire', score: 400, defeated: false }],
            ['empire_2', { id: 'empire_2', name: 'Gamma Empire', score: 300, defeated: false }],
            ['empire_3', { id: 'empire_3', name: 'Delta Empire', score: 200, defeated: false }],
        ]);
    });
    
    describe('canJoinCoalition', () => {
        test('leader cannot join coalition', () => {
            const result = coalitionManager.canJoinCoalition('empire_0', mockEmpires, 0);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('score leader');
        });
        
        test('underdog with <50% score can join', () => {
            const result = coalitionManager.canJoinCoalition('empire_1', mockEmpires, 0);
            expect(result.allowed).toBe(true);
        });
        
        test('empire with score >= 50% of leader cannot join', () => {
            // Give empire_1 exactly 50% of leader's score
            mockEmpires.get('empire_1').score = 500;
            const result = coalitionManager.canJoinCoalition('empire_1', mockEmpires, 0);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('score is too high');
        });
        
        test('cooldown prevents joining', () => {
            coalitionManager.lastCoalitionEndTick = 0;
            const result = coalitionManager.canJoinCoalition('empire_1', mockEmpires, 100);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('cooldown');
        });
    });
    
    describe('proposeCoalition', () => {
        test('creates new coalition against leader', () => {
            const result = coalitionManager.proposeCoalition('empire_1', mockEmpires, 0);
            
            expect(result.success).toBe(true);
            expect(result.coalition.targetEmpireId).toBe('empire_0');
            expect(result.coalition.members).toContain('empire_1');
            expect(result.coalition.members.length).toBe(1);
        });
        
        test('leader cannot propose coalition', () => {
            const result = coalitionManager.proposeCoalition('empire_0', mockEmpires, 0);
            expect(result.success).toBe(false);
        });
    });
    
    describe('joinCoalition', () => {
        test('second member can join existing coalition', () => {
            coalitionManager.proposeCoalition('empire_1', mockEmpires, 0);
            const result = coalitionManager.joinCoalition('empire_2', mockEmpires, 0);
            
            expect(result.success).toBe(true);
            expect(coalitionManager.activeCoalition.members.length).toBe(2);
            expect(coalitionManager.isCoalitionActive()).toBe(true);
        });
        
        test('cannot join twice', () => {
            coalitionManager.proposeCoalition('empire_1', mockEmpires, 0);
            const result = coalitionManager.joinCoalition('empire_1', mockEmpires, 0);
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('Already a coalition member');
        });
    });
    
    describe('combat bonuses', () => {
        test('coalition members get bonus vs target', () => {
            coalitionManager.proposeCoalition('empire_1', mockEmpires, 0);
            coalitionManager.joinCoalition('empire_2', mockEmpires, 0);
            
            // Coalition is active (2 members)
            expect(coalitionManager.isCoalitionActive()).toBe(true);
            
            // Members get bonus vs target
            expect(coalitionManager.getCombatBonus('empire_1', 'empire_0')).toBe(0.15);
            expect(coalitionManager.getCombatBonus('empire_2', 'empire_0')).toBe(0.15);
            
            // Target gets no bonus vs members
            expect(coalitionManager.getCombatBonus('empire_0', 'empire_1')).toBe(0);
            
            // No bonus vs non-targets
            expect(coalitionManager.getCombatBonus('empire_1', 'empire_3')).toBe(0);
        });
        
        test('no bonus when coalition not active (1 member)', () => {
            coalitionManager.proposeCoalition('empire_1', mockEmpires, 0);
            
            // Coalition not active (needs 2 members)
            expect(coalitionManager.isCoalitionActive()).toBe(false);
            expect(coalitionManager.getCombatBonus('empire_1', 'empire_0')).toBe(0);
        });
    });
    
    describe('leaveCoalition', () => {
        test('member can leave coalition', () => {
            coalitionManager.proposeCoalition('empire_1', mockEmpires, 0);
            coalitionManager.joinCoalition('empire_2', mockEmpires, 0);
            
            const result = coalitionManager.leaveCoalition('empire_1');
            expect(result.success).toBe(true);
            expect(coalitionManager.activeCoalition.members).not.toContain('empire_1');
        });
        
        test('coalition disbands when last member leaves', () => {
            coalitionManager.proposeCoalition('empire_1', mockEmpires, 0);
            const result = coalitionManager.leaveCoalition('empire_1');
            
            expect(result.success).toBe(true);
            expect(coalitionManager.activeCoalition).toBeNull();
        });
    });
    
    describe('tickUpdate', () => {
        test('disbands when target is defeated', () => {
            coalitionManager.proposeCoalition('empire_1', mockEmpires, 0);
            coalitionManager.joinCoalition('empire_2', mockEmpires, 0);
            
            // Defeat the target
            mockEmpires.get('empire_0').defeated = true;
            
            const result = coalitionManager.tickUpdate(mockEmpires, 100);
            expect(result.disbanded).toBe(true);
            expect(result.reason).toContain('defeated');
        });
        
        test('disbands when target is no longer leader', () => {
            coalitionManager.proposeCoalition('empire_1', mockEmpires, 0);
            coalitionManager.joinCoalition('empire_2', mockEmpires, 0);
            
            // Someone else becomes leader
            mockEmpires.get('empire_1').score = 2000;
            
            const result = coalitionManager.tickUpdate(mockEmpires, 100);
            expect(result.disbanded).toBe(true);
            expect(result.reason).toContain('no longer the score leader');
        });
        
        test('removes defeated members', () => {
            coalitionManager.proposeCoalition('empire_1', mockEmpires, 0);
            coalitionManager.joinCoalition('empire_2', mockEmpires, 0);
            coalitionManager.joinCoalition('empire_3', mockEmpires, 0);
            
            expect(coalitionManager.activeCoalition.members.length).toBe(3);
            
            // Defeat one member
            mockEmpires.get('empire_2').defeated = true;
            coalitionManager.tickUpdate(mockEmpires, 100);
            
            expect(coalitionManager.activeCoalition.members.length).toBe(2);
            expect(coalitionManager.activeCoalition.members).not.toContain('empire_2');
        });
    });
    
    describe('serialization', () => {
        test('serializes and loads state correctly', () => {
            coalitionManager.proposeCoalition('empire_1', mockEmpires, 0);
            coalitionManager.joinCoalition('empire_2', mockEmpires, 0);
            
            const serialized = coalitionManager.serialize();
            
            const newManager = new CoalitionManager();
            newManager.loadState(serialized);
            
            expect(newManager.activeCoalition).not.toBeNull();
            expect(newManager.activeCoalition.members.length).toBe(2);
            expect(newManager.isCoalitionMember('empire_1')).toBe(true);
        });
    });
});
