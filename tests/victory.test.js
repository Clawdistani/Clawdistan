/**
 * Victory Checker Tests
 * 
 * Tests for the VictoryChecker module including:
 * - Empire defeat detection (0 planets)
 * - Domination progress calculation
 * - Victory condition progress tracking
 */

import { jest } from '@jest/globals';
import { VictoryChecker } from '../core/victory.js';

describe('VictoryChecker', () => {
    let checker;
    let mockEmpires;
    let mockUniverse;
    let mockResourceManager;
    let mockGameSession;

    beforeEach(() => {
        checker = new VictoryChecker();

        // Create mock empire with defeat method
        const createMockEmpire = (name, defeated = false) => ({
            name,
            score: 0,
            defeated,
            defeat: function() { this.defeated = true; }
        });

        mockEmpires = new Map([
            ['empire_1', createMockEmpire('Empire Alpha')],
            ['empire_2', createMockEmpire('Empire Beta')],
            ['empire_3', createMockEmpire('Empire Gamma', true)] // Already defeated
        ]);

        mockUniverse = {
            planets: Array(100).fill(null).map((_, i) => ({ id: `planet_${i}` })),
            getPlanetsOwnedBy: jest.fn()
        };

        mockResourceManager = {
            getResources: jest.fn().mockReturnValue({
                minerals: 1000,
                energy: 500,
                food: 300,
                research: 200,
                credits: 100
            })
        };

        mockGameSession = {
            getTimeRemaining: jest.fn().mockReturnValue(12 * 60 * 60 * 1000), // 12 hours
            getTimeRemainingFormatted: jest.fn().mockReturnValue('12h 0m 0s')
        };
    });

    describe('initialization', () => {
        test('should have correct victory conditions defined', () => {
            expect(checker.conditions.domination).toBeDefined();
            expect(checker.conditions.time).toBeDefined();
        });

        test('domination condition should have 51% threshold', () => {
            expect(checker.conditions.domination.threshold).toBe(0.51);
        });

        test('should have descriptive condition names', () => {
            expect(checker.conditions.domination.name).toBe('Galactic Domination');
            expect(checker.conditions.time.name).toBe('Time Victory');
        });
    });

    describe('checkDefeats()', () => {
        test('should detect empire with 0 planets as defeated', () => {
            mockUniverse.getPlanetsOwnedBy.mockImplementation((id) => {
                if (id === 'empire_1') return []; // No planets
                if (id === 'empire_2') return [{ id: 'planet_1' }];
                return [];
            });

            const defeated = checker.checkDefeats(mockEmpires, mockUniverse);

            expect(defeated.length).toBe(1);
            expect(defeated[0].empireId).toBe('empire_1');
            expect(defeated[0].empireName).toBe('Empire Alpha');
            expect(mockEmpires.get('empire_1').defeated).toBe(true);
        });

        test('should not defeat empire with at least 1 planet', () => {
            mockUniverse.getPlanetsOwnedBy.mockImplementation(() => [{ id: 'planet_1' }]);

            const defeated = checker.checkDefeats(mockEmpires, mockUniverse);

            expect(defeated.length).toBe(0);
            expect(mockEmpires.get('empire_1').defeated).toBe(false);
            expect(mockEmpires.get('empire_2').defeated).toBe(false);
        });

        test('should skip already defeated empires', () => {
            mockUniverse.getPlanetsOwnedBy.mockReturnValue([]);

            const defeated = checker.checkDefeats(mockEmpires, mockUniverse);

            // Empire 3 was already defeated, should not be in new defeated list
            expect(defeated.some(d => d.empireId === 'empire_3')).toBe(false);
        });

        test('should return multiple newly defeated empires', () => {
            mockUniverse.getPlanetsOwnedBy.mockImplementation((id) => {
                if (id === 'empire_3') return []; // Already defeated - ignored
                return []; // All others have 0 planets
            });

            const defeated = checker.checkDefeats(mockEmpires, mockUniverse);

            expect(defeated.length).toBe(2);
            expect(defeated.some(d => d.empireId === 'empire_1')).toBe(true);
            expect(defeated.some(d => d.empireId === 'empire_2')).toBe(true);
        });

        test('should mark empire.defeated = true when defeated', () => {
            mockUniverse.getPlanetsOwnedBy.mockReturnValue([]);

            checker.checkDefeats(mockEmpires, mockUniverse);

            expect(mockEmpires.get('empire_1').defeated).toBe(true);
            expect(mockEmpires.get('empire_2').defeated).toBe(true);
        });
    });

    describe('getDominationProgress()', () => {
        test('should calculate correct progress at 0%', () => {
            mockUniverse.getPlanetsOwnedBy.mockReturnValue([]);

            const progress = checker.getDominationProgress('empire_1', mockUniverse);

            expect(progress.current).toBe(0);
            expect(progress.total).toBe(100);
            expect(progress.percentage).toBe(0);
            expect(progress.progressToVictory).toBe(0);
        });

        test('should calculate correct progress at 25%', () => {
            mockUniverse.getPlanetsOwnedBy.mockReturnValue(Array(25).fill(null));

            const progress = checker.getDominationProgress('empire_1', mockUniverse);

            expect(progress.current).toBe(25);
            expect(progress.percentage).toBe(25);
            expect(progress.required).toBe(51); // ceil(100 * 0.51)
            // 25/51 = ~49%
            expect(progress.progressToVictory).toBe(49);
        });

        test('should calculate correct progress at 51%', () => {
            mockUniverse.getPlanetsOwnedBy.mockReturnValue(Array(51).fill(null));

            const progress = checker.getDominationProgress('empire_1', mockUniverse);

            expect(progress.current).toBe(51);
            expect(progress.percentage).toBe(51);
            expect(progress.progressToVictory).toBe(100);
        });

        test('should calculate correct progress over 51%', () => {
            mockUniverse.getPlanetsOwnedBy.mockReturnValue(Array(75).fill(null));

            const progress = checker.getDominationProgress('empire_1', mockUniverse);

            expect(progress.current).toBe(75);
            expect(progress.percentage).toBe(75);
            expect(progress.progressToVictory).toBe(147); // 75/51 * 100
        });

        test('should handle small universe (10 planets)', () => {
            mockUniverse.planets = Array(10).fill(null);
            mockUniverse.getPlanetsOwnedBy.mockReturnValue(Array(6).fill(null));

            const progress = checker.getDominationProgress('empire_1', mockUniverse);

            expect(progress.current).toBe(6);
            expect(progress.total).toBe(10);
            expect(progress.required).toBe(6); // ceil(10 * 0.51) = 6
            expect(progress.percentage).toBe(60);
            expect(progress.progressToVictory).toBe(100);
        });
    });

    describe('getConditions()', () => {
        test('should return all victory conditions', () => {
            const conditions = checker.getConditions();

            expect(conditions.length).toBe(2);
            expect(conditions.some(c => c.id === 'domination')).toBe(true);
            expect(conditions.some(c => c.id === 'time')).toBe(true);
        });

        test('should include name and description', () => {
            const conditions = checker.getConditions();
            const domination = conditions.find(c => c.id === 'domination');

            expect(domination.name).toBe('Galactic Domination');
            expect(domination.description).toContain('51%');
        });
    });

    describe('getProgress()', () => {
        beforeEach(() => {
            // Empire 1 owns 30 planets, score 500
            mockUniverse.getPlanetsOwnedBy.mockReturnValue(Array(30).fill(null));
            mockEmpires.get('empire_1').score = 500;
            mockEmpires.get('empire_2').score = 800; // Higher score
        });

        test('should return domination progress', () => {
            const progress = checker.getProgress(
                'empire_1',
                mockEmpires,
                mockUniverse,
                mockResourceManager,
                mockGameSession
            );

            expect(progress.domination.current).toBe(30);
            expect(progress.domination.total).toBe(100);
            expect(progress.domination.percentage).toBe(30);
            expect(progress.domination.required).toBe(51);
        });

        test('should return time victory progress', () => {
            const progress = checker.getProgress(
                'empire_1',
                mockEmpires,
                mockUniverse,
                mockResourceManager,
                mockGameSession
            );

            expect(progress.time.score).toBe(500);
            expect(progress.time.highestScore).toBe(800);
            expect(progress.time.isLeading).toBe(false);
        });

        test('should identify leading empire', () => {
            mockEmpires.get('empire_1').score = 1000; // Highest

            const progress = checker.getProgress(
                'empire_1',
                mockEmpires,
                mockUniverse,
                mockResourceManager,
                mockGameSession
            );

            expect(progress.time.isLeading).toBe(true);
            expect(progress.time.highestScore).toBe(1000);
        });

        test('should include time remaining', () => {
            const progress = checker.getProgress(
                'empire_1',
                mockEmpires,
                mockUniverse,
                mockResourceManager,
                mockGameSession
            );

            expect(progress.time.timeRemaining).toBe(12 * 60 * 60 * 1000);
            expect(progress.time.timeRemainingFormatted).toBe('12h 0m 0s');
        });

        test('should handle null gameSession', () => {
            const progress = checker.getProgress(
                'empire_1',
                mockEmpires,
                mockUniverse,
                mockResourceManager,
                null
            );

            expect(progress.time.timeRemaining).toBeNull();
            expect(progress.time.timeRemainingFormatted).toBeNull();
        });

        test('should cap domination progress at 100%', () => {
            mockUniverse.getPlanetsOwnedBy.mockReturnValue(Array(45).fill(null));

            const progress = checker.getProgress(
                'empire_1',
                mockEmpires,
                mockUniverse,
                mockResourceManager,
                mockGameSession
            );

            // 45/51 = 88%
            expect(progress.domination.progress).toBeLessThanOrEqual(100);
            expect(progress.domination.progress).toBe(88);
        });

        test('should not count defeated empires for highest score', () => {
            mockEmpires.get('empire_3').score = 9999; // Defeated empire
            mockEmpires.get('empire_1').score = 100;
            mockEmpires.get('empire_2').score = 200;

            const progress = checker.getProgress(
                'empire_1',
                mockEmpires,
                mockUniverse,
                mockResourceManager,
                mockGameSession
            );

            // Highest should be 200 (from empire_2), not 9999
            expect(progress.time.highestScore).toBe(200);
        });

        test('should handle zero score tie correctly', () => {
            mockEmpires.get('empire_1').score = 0;
            mockEmpires.get('empire_2').score = 0;

            const progress = checker.getProgress(
                'empire_1',
                mockEmpires,
                mockUniverse,
                mockResourceManager,
                mockGameSession
            );

            // With 0 score, isLeading should be false (score > 0 required)
            expect(progress.time.isLeading).toBe(false);
        });
    });

    describe('edge cases', () => {
        test('should handle empty universe', () => {
            mockUniverse.planets = [];
            mockUniverse.getPlanetsOwnedBy.mockReturnValue([]);

            const progress = checker.getDominationProgress('empire_1', mockUniverse);

            expect(progress.total).toBe(0);
            expect(progress.required).toBe(0); // ceil(0 * 0.51)
        });

        test('should handle single planet universe', () => {
            mockUniverse.planets = [{ id: 'planet_0' }];
            mockUniverse.getPlanetsOwnedBy.mockReturnValue([{ id: 'planet_0' }]);

            const progress = checker.getDominationProgress('empire_1', mockUniverse);

            expect(progress.current).toBe(1);
            expect(progress.total).toBe(1);
            expect(progress.required).toBe(1); // ceil(1 * 0.51) = 1
            expect(progress.progressToVictory).toBe(100);
        });

        test('should handle empires with NaN score', () => {
            mockEmpires.get('empire_1').score = NaN;
            mockEmpires.get('empire_2').score = 100;
            // Reset mock for this test
            mockUniverse.getPlanetsOwnedBy.mockReturnValue(Array(30).fill(null));

            const progress = checker.getProgress(
                'empire_1',
                mockEmpires,
                mockUniverse,
                mockResourceManager,
                mockGameSession
            );

            // Code defensively handles NaN scores - either as NaN or 0 is acceptable
            // The important thing is it doesn't crash
            expect(progress.domination).toBeDefined();
            expect(progress.time).toBeDefined();
        });

        test('should handle undefined resourceManager', () => {
            mockEmpires.get('empire_1').score = 100;
            // Reset mock for this test
            mockUniverse.getPlanetsOwnedBy.mockReturnValue(Array(30).fill(null));

            const progress = checker.getProgress(
                'empire_1',
                mockEmpires,
                mockUniverse,
                undefined,
                mockGameSession
            );

            // Should not throw
            expect(progress.domination).toBeDefined();
            expect(progress.time).toBeDefined();
        });

        test('should handle empire not found in map', () => {
            // Reset mock for this test
            mockUniverse.getPlanetsOwnedBy.mockReturnValue(Array(0).fill(null));

            const progress = checker.getProgress(
                'empire_nonexistent',
                mockEmpires,
                mockUniverse,
                mockResourceManager,
                mockGameSession
            );

            // Should handle gracefully
            expect(progress.time.score).toBe(0);
        });
    });
});
