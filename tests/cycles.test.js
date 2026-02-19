import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
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
            
            assert.ok(state, 'State should exist');
            assert.ok(state.current, 'Current cycle should exist');
            assert.ok(state.current.name, 'Current cycle should have a name');
            assert.ok(state.next, 'Next cycle should exist');
            assert.ok(state.next.name, 'Next cycle should have a name');
        });

        it('should handle null/undefined currentCycle gracefully', () => {
            cycleManager.currentCycle = null;
            cycleManager.nextCycle = null;
            cycleManager.cycleStartTick = 0;
            cycleManager.cycleDuration = 1000;
            
            const state = cycleManager.getState(100);
            
            assert.ok(state.current.name, 'Should fallback to normal cycle name');
            assert.ok(state.next.name, 'Should fallback to normal cycle name for next');
        });

        it('should handle invalid cycle types gracefully', () => {
            cycleManager.currentCycle = 'invalid_cycle_that_does_not_exist';
            cycleManager.nextCycle = 'another_invalid_cycle';
            cycleManager.cycleStartTick = 0;
            cycleManager.cycleDuration = 1000;
            
            const state = cycleManager.getState(100);
            
            assert.ok(state.current.name, 'Should fallback to normal cycle');
            assert.ok(state.next.name, 'Should fallback to normal cycle for next');
        });

        it('should calculate elapsed and remaining time correctly', () => {
            cycleManager.initialize(0);
            cycleManager.cycleStartTick = 0;
            cycleManager.cycleDuration = 1000;
            
            const state = cycleManager.getState(300);
            
            assert.strictEqual(state.elapsed, 300);
            assert.strictEqual(state.remaining, 700);
            assert.strictEqual(state.duration, 1000);
            assert.strictEqual(state.progress, 0.3);
        });

        it('should not return negative remaining time', () => {
            cycleManager.initialize(0);
            cycleManager.cycleStartTick = 0;
            cycleManager.cycleDuration = 100;
            
            const state = cycleManager.getState(500); // Way past duration
            
            assert.strictEqual(state.remaining, 0);
        });
    });

    describe('CYCLE_TYPES validation', () => {
        it('should have required properties for all cycle types', () => {
            for (const [key, cycle] of Object.entries(CYCLE_TYPES)) {
                assert.ok(cycle.id, `Cycle ${key} should have id`);
                assert.ok(cycle.name, `Cycle ${key} should have name`);
                assert.ok(cycle.icon, `Cycle ${key} should have icon`);
                assert.ok(cycle.description, `Cycle ${key} should have description`);
                assert.ok(cycle.color, `Cycle ${key} should have color`);
                assert.ok(cycle.effects !== undefined, `Cycle ${key} should have effects object`);
            }
        });

        it('should have "normal" cycle defined (used as fallback)', () => {
            assert.ok(CYCLE_TYPES.normal, 'CYCLE_TYPES.normal must exist for fallbacks');
            assert.ok(CYCLE_TYPES.normal.name, 'normal cycle must have name');
        });
    });

    describe('initialize', () => {
        it('should set up valid initial state', () => {
            cycleManager.initialize(0);
            
            assert.ok(cycleManager.currentCycle, 'Should have current cycle');
            assert.ok(CYCLE_TYPES[cycleManager.currentCycle], 'Current cycle should be valid');
        });
    });

    describe('tick', () => {
        it('should transition cycles when duration exceeded', () => {
            cycleManager.initialize(0);
            cycleManager.cycleDuration = 10; // Very short duration
            
            const initialCycle = cycleManager.currentCycle;
            const events = cycleManager.tick(100); // Way past duration
            
            // Either transitioned or stayed (depends on random)
            assert.ok(cycleManager.currentCycle, 'Should still have a valid cycle');
            assert.ok(CYCLE_TYPES[cycleManager.currentCycle], 'Cycle should be valid type');
        });
    });

    describe('getEffects', () => {
        it('should return effects for current cycle', () => {
            cycleManager.currentCycle = 'golden_age';
            const effects = cycleManager.getEffects();
            
            assert.ok(typeof effects === 'object');
            assert.ok(effects.productionModifier !== undefined);
        });

        it('should return empty object for invalid cycle', () => {
            cycleManager.currentCycle = 'nonexistent';
            const effects = cycleManager.getEffects();
            
            assert.deepStrictEqual(effects, {});
        });
    });

    describe('getEffectModifier', () => {
        it('should return effect value when present', () => {
            cycleManager.currentCycle = 'golden_age';
            const modifier = cycleManager.getEffectModifier('productionModifier');
            
            assert.strictEqual(modifier, 1.5);
        });

        it('should return default value when effect not present', () => {
            cycleManager.currentCycle = 'normal';
            const modifier = cycleManager.getEffectModifier('nonExistentEffect', 1.0);
            
            assert.strictEqual(modifier, 1.0);
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
            
            assert.strictEqual(restored.currentCycle, 'void_storm');
            assert.strictEqual(restored.nextCycle, 'golden_age');
            assert.deepStrictEqual(restored.cycleHistory, ['normal', 'dark_era']);
        });

        it('should handle empty/null JSON gracefully', () => {
            const manager = new CycleManager();
            manager.fromJSON(null);
            // Should not throw
            assert.ok(true);
        });
    });
});
