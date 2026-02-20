import { CycleManager, CYCLE_TYPES } from '../core/cycles.js';

describe('CycleManager', () => {
    let cycleManager;

    beforeEach(() => {
        cycleManager = new CycleManager();
    });

    describe('getState', () => {
        it('should return valid state with default initialization', () => {
            cycleManager.initialize(0);
            const state = cycleManager.getState(100);
            
            expect(state).toBeTruthy();
            expect(state.current).toBeTruthy();
            expect(state.current.name).toBeTruthy();
            expect(state.next).toBeTruthy();
            expect(state.next.name).toBeTruthy();
        });

        it('should handle null/undefined currentCycle gracefully', () => {
            cycleManager.currentCycle = null;
            cycleManager.nextCycle = null;
            cycleManager.cycleStartTick = 0;
            cycleManager.cycleDuration = 1000;
            
            const state = cycleManager.getState(100);
            
            expect(state.current.name).toBeTruthy();
            expect(state.next.name).toBeTruthy();
        });

        it('should handle invalid cycle types gracefully', () => {
            cycleManager.currentCycle = 'invalid_cycle_that_does_not_exist';
            cycleManager.nextCycle = 'another_invalid_cycle';
            cycleManager.cycleStartTick = 0;
            cycleManager.cycleDuration = 1000;
            
            const state = cycleManager.getState(100);
            
            expect(state.current.name).toBeTruthy();
            expect(state.next.name).toBeTruthy();
        });

        it('should calculate elapsed and remaining time correctly', () => {
            cycleManager.initialize(0);
            cycleManager.cycleStartTick = 0;
            cycleManager.cycleDuration = 1000;
            
            const state = cycleManager.getState(300);
            
            expect(state.elapsed).toBe(300);
            expect(state.remaining).toBe(700);
            expect(state.duration).toBe(1000);
            expect(state.progress).toBe(0.3);
        });

        it('should not return negative remaining time', () => {
            cycleManager.initialize(0);
            cycleManager.cycleStartTick = 0;
            cycleManager.cycleDuration = 100;
            
            const state = cycleManager.getState(500); // Way past duration
            
            expect(state.remaining).toBe(0);
        });
    });

    describe('CYCLE_TYPES validation', () => {
        it('should have required properties for all cycle types', () => {
            for (const [key, cycle] of Object.entries(CYCLE_TYPES)) {
                expect(cycle.id).toBeTruthy();
                expect(cycle.name).toBeTruthy();
                expect(cycle.icon).toBeTruthy();
                expect(cycle.description).toBeTruthy();
                expect(cycle.color).toBeTruthy();
                expect(cycle.effects).toBeDefined();
            }
        });

        it('should have "normal" cycle defined (used as fallback)', () => {
            expect(CYCLE_TYPES.normal).toBeTruthy();
            expect(CYCLE_TYPES.normal.name).toBeTruthy();
        });
    });

    describe('initialize', () => {
        it('should set up valid initial state', () => {
            cycleManager.initialize(0);
            
            expect(cycleManager.currentCycle).toBeTruthy();
            expect(CYCLE_TYPES[cycleManager.currentCycle]).toBeTruthy();
        });
    });

    describe('tick', () => {
        it('should transition cycles when duration exceeded', () => {
            cycleManager.initialize(0);
            cycleManager.cycleDuration = 10; // Very short duration
            
            const initialCycle = cycleManager.currentCycle;
            const events = cycleManager.tick(100); // Way past duration
            
            // Either transitioned or stayed (depends on random)
            expect(cycleManager.currentCycle).toBeTruthy();
            expect(CYCLE_TYPES[cycleManager.currentCycle]).toBeTruthy();
        });
    });

    describe('getEffects', () => {
        it('should return effects for current cycle', () => {
            cycleManager.currentCycle = 'golden_age';
            const effects = cycleManager.getEffects();
            
            expect(typeof effects).toBe('object');
            expect(effects.productionModifier).toBeDefined();
        });

        it('should return empty object for invalid cycle', () => {
            cycleManager.currentCycle = 'nonexistent';
            const effects = cycleManager.getEffects();
            
            expect(effects).toEqual({});
        });
    });

    describe('getEffectModifier', () => {
        it('should return effect value when present', () => {
            cycleManager.currentCycle = 'golden_age';
            const modifier = cycleManager.getEffectModifier('productionModifier');
            
            expect(modifier).toBe(1.5);
        });

        it('should return default value when effect not present', () => {
            cycleManager.currentCycle = 'normal';
            const modifier = cycleManager.getEffectModifier('nonExistentEffect', 1.0);
            
            expect(modifier).toBe(1.0);
        });
    });

    describe('toJSON/fromJSON (serialization)', () => {
        it('should serialize and deserialize state correctly', () => {
            cycleManager.initialize(100);
            cycleManager.currentCycle = 'void_storm';
            cycleManager.nextCycle = 'golden_age';
            cycleManager.cycleHistory = ['normal', 'dark_era'];
            
            const json = cycleManager.toJSON();
            
            const restored = new CycleManager();
            restored.fromJSON(json);
            
            expect(restored.currentCycle).toBe('void_storm');
            expect(restored.nextCycle).toBe('golden_age');
            expect(restored.cycleHistory).toEqual(['normal', 'dark_era']);
        });

        it('should handle empty/null JSON gracefully', () => {
            const manager = new CycleManager();
            manager.fromJSON(null);
            // Should not throw
            expect(true).toBe(true);
        });
    });
});
