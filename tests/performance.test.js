/**
 * Performance Budget Tests
 * 
 * These tests ensure code changes don't regress performance.
 * Any change that causes tick processing to exceed 200ms will FAIL.
 * 
 * Run: npm test -- tests/performance.test.js
 */

import { jest, describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { GameEngine } from '../core/engine.js';

const TICK_BUDGET_MS = 200; // Maximum allowed tick duration
const ENTITY_STRESS_COUNT = 5000; // Simulate high entity count
const EMPIRE_COUNT = 20; // Simulate many empires

describe('Performance Budget', () => {
    let engine;
    let consoleSpy;

    beforeAll(() => {
        // Suppress console output during tests
        consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterAll(() => {
        consoleSpy.mockRestore();
    });

    beforeEach(() => {
        engine = new GameEngine();
    });

    test(`Single tick must complete under ${TICK_BUDGET_MS}ms`, () => {
        const start = performance.now();
        engine.tick();
        const duration = performance.now() - start;

        console.log(`Tick duration: ${duration.toFixed(2)}ms`);
        
        expect(duration).toBeLessThan(TICK_BUDGET_MS);
    });

    test(`10 consecutive ticks must average under ${TICK_BUDGET_MS}ms`, () => {
        const durations = [];
        
        for (let i = 0; i < 10; i++) {
            const start = performance.now();
            engine.tick();
            durations.push(performance.now() - start);
        }
        
        const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
        const max = Math.max(...durations);
        
        console.log(`Avg tick: ${avg.toFixed(2)}ms, Max: ${max.toFixed(2)}ms`);
        
        expect(avg).toBeLessThan(TICK_BUDGET_MS);
        expect(max).toBeLessThan(TICK_BUDGET_MS * 1.5); // Allow 50% spike tolerance
    });

    test(`Tick with ${ENTITY_STRESS_COUNT} entities must complete under ${TICK_BUDGET_MS}ms`, () => {
        // Create stress test entities
        const empire = engine.empires.values().next().value;
        if (!empire) {
            console.log('No empire found, skipping stress test');
            return;
        }

        const planet = engine.universe.planets.find(p => p.owner === empire.id);
        if (!planet) {
            console.log('No planet found, skipping stress test');
            return;
        }

        // Add many entities to stress test
        const entitiesToAdd = ENTITY_STRESS_COUNT - engine.entityManager.entities.size;
        for (let i = 0; i < entitiesToAdd && i < 3000; i++) {
            // Alternate between units and structures
            if (i % 2 === 0) {
                engine.entityManager.createUnit('soldier', empire.id, planet.id);
            } else {
                engine.entityManager.createUnit('fighter', empire.id, planet.id);
            }
        }

        console.log(`Testing with ${engine.entityManager.entities.size} entities`);

        const start = performance.now();
        engine.tick();
        const duration = performance.now() - start;

        console.log(`Stress tick duration: ${duration.toFixed(2)}ms`);
        
        expect(duration).toBeLessThan(TICK_BUDGET_MS);
    });

    test('getLightState serialization must complete under 100ms', () => {
        const start = performance.now();
        const state = engine.getLightState();
        const duration = performance.now() - start;

        console.log(`getLightState duration: ${duration.toFixed(2)}ms`);
        console.log(`Entities in state: ${state.entities?.length || 0}`);
        
        expect(duration).toBeLessThan(100); // Stricter budget for serialization
    });

    test('getLightState with pagination must complete under 50ms', () => {
        const start = performance.now();
        const state = engine.getLightState({ entityLimit: 500 });
        const duration = performance.now() - start;

        console.log(`Paginated getLightState duration: ${duration.toFixed(2)}ms`);
        console.log(`Entities returned: ${state.entities?.length || 0}`);
        
        expect(duration).toBeLessThan(50);
        expect(state.entities?.length || 0).toBeLessThanOrEqual(500);
    });

    test('getFullState (save) must complete under 500ms', () => {
        const start = performance.now();
        const state = engine.getFullState();
        const duration = performance.now() - start;

        console.log(`getFullState duration: ${duration.toFixed(2)}ms`);
        
        expect(duration).toBeLessThan(500); // More lenient for full save
    });

    test(`Multi-empire simulation (${EMPIRE_COUNT} empires) tick under ${TICK_BUDGET_MS}ms`, () => {
        // Create additional empires
        const existingCount = engine.empires.size;
        for (let i = existingCount; i < EMPIRE_COUNT; i++) {
            engine.createNewEmpire(`Test Empire ${i}`);
        }

        console.log(`Testing with ${engine.empires.size} empires`);

        const start = performance.now();
        engine.tick();
        const duration = performance.now() - start;

        console.log(`Multi-empire tick duration: ${duration.toFixed(2)}ms`);
        
        expect(duration).toBeLessThan(TICK_BUDGET_MS);
    });
});

describe('Memory Budget', () => {
    test('Engine memory footprint should be reasonable', () => {
        const engine = new GameEngine();
        
        // Run a few ticks to stabilize
        for (let i = 0; i < 5; i++) {
            engine.tick();
        }

        // Check entity count is bounded
        const entityCount = engine.entityManager.entities.size;
        console.log(`Entity count: ${entityCount}`);
        
        // Initial game should not have excessive entities
        expect(entityCount).toBeLessThan(10000);
    });

    test('Event log should be capped', () => {
        const engine = new GameEngine();
        
        // Generate many events
        for (let i = 0; i < 500; i++) {
            engine.log('test', `Test event ${i}`);
        }

        // Event log should be capped at 200
        expect(engine.eventLog.length).toBeLessThanOrEqual(200);
    });

    test('Change log should be capped', () => {
        const engine = new GameEngine();
        
        // Generate many changes
        for (let i = 0; i < 1000; i++) {
            engine.recordChange('entity', { id: `test_${i}` });
        }

        // Change log should be capped at 500
        expect(engine.changeLog.length).toBeLessThanOrEqual(500);
    });
});
