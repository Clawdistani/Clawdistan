/**
 * Game Session Tests
 * 
 * Tests for the 24-hour game session system including:
 * - Time tracking and countdown
 * - Victory condition detection
 * - Agent career stats
 * - Waitlist management
 * - Disconnect/forfeit tracking
 */

import { jest } from '@jest/globals';

// Mock fs module before importing GameSession
const mockFs = {
    mkdir: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockRejectedValue({ code: 'ENOENT' }),
    writeFile: jest.fn().mockResolvedValue(undefined),
    readdir: jest.fn().mockResolvedValue([]),
    stat: jest.fn().mockResolvedValue({ mtimeMs: Date.now() }),
    unlink: jest.fn().mockResolvedValue(undefined)
};

jest.unstable_mockModule('fs', () => ({
    promises: mockFs
}));

// Import GameSession after mocking
const { GameSession, MAX_AGENTS, DOMINATION_THRESHOLD, DC_FORFEIT_MS, GAME_DURATION_MS } = await import('../core/game-session.js');

describe('GameSession', () => {
    let session;

    beforeEach(() => {
        session = new GameSession();
        jest.clearAllMocks();
        
        // Reset time-based tests
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-02-18T12:00:00Z'));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('initialization', () => {
        test('should have correct default values', () => {
            expect(session.gameId).toBeNull();
            expect(session.startTime).toBeNull();
            expect(session.endTime).toBeNull();
            expect(session.winner).toBeNull();
            expect(session.winCondition).toBeNull();
            expect(session.isEnded).toBe(false);
            expect(session.agentStats).toEqual({});
            expect(session.waitlist).toEqual([]);
        });

        test('should export correct constants', () => {
            expect(MAX_AGENTS).toBe(20);
            expect(DOMINATION_THRESHOLD).toBe(0.51);
            expect(DC_FORFEIT_MS).toBe(2 * 60 * 60 * 1000); // 2 hours
            expect(GAME_DURATION_MS).toBe(24 * 60 * 60 * 1000); // 24 hours
        });
    });

    describe('startNewGame()', () => {
        test('should create new game with correct timing', async () => {
            const gameId = await session.startNewGame();
            
            expect(gameId).toMatch(/^game_\d+$/);
            expect(session.startTime).toBe(Date.now());
            expect(session.endTime).toBe(session.startTime + GAME_DURATION_MS);
            expect(session.isEnded).toBe(false);
            expect(session.winner).toBeNull();
            expect(session.waitlist).toEqual([]);
        });

        test('should clear disconnected agents on new game', async () => {
            session.trackDisconnect('agent1');
            session.trackDisconnect('agent2');
            
            await session.startNewGame();
            
            expect(session.disconnectedAgents.size).toBe(0);
        });
    });

    describe('time tracking', () => {
        beforeEach(async () => {
            await session.startNewGame();
        });

        test('getTimeRemaining() should return correct time', () => {
            const remaining = session.getTimeRemaining();
            expect(remaining).toBe(GAME_DURATION_MS);
        });

        test('getTimeRemaining() should decrease over time', () => {
            const oneHour = 60 * 60 * 1000;
            jest.advanceTimersByTime(oneHour);
            
            const remaining = session.getTimeRemaining();
            expect(remaining).toBe(GAME_DURATION_MS - oneHour);
        });

        test('getTimeRemaining() should return 0 after game ends', () => {
            session.isEnded = true;
            expect(session.getTimeRemaining()).toBe(0);
        });

        test('getTimeRemaining() should not go negative', () => {
            jest.advanceTimersByTime(GAME_DURATION_MS + 10000);
            expect(session.getTimeRemaining()).toBe(0);
        });

        test('getTimeRemainingFormatted() should return formatted string', () => {
            const formatted = session.getTimeRemainingFormatted();
            expect(formatted).toBe('24h 0m 0s');
        });

        test('getTimeRemainingFormatted() should update correctly', () => {
            jest.advanceTimersByTime(90 * 60 * 1000); // 1.5 hours
            const formatted = session.getTimeRemainingFormatted();
            expect(formatted).toBe('22h 30m 0s');
        });

        test('getTimeElapsed() should return elapsed time', () => {
            jest.advanceTimersByTime(3600000); // 1 hour
            expect(session.getTimeElapsed()).toBe(3600000);
        });

        test('isTimeUp() should return false when time remaining', () => {
            expect(session.isTimeUp()).toBe(false);
        });

        test('isTimeUp() should return true when time expired', () => {
            jest.advanceTimersByTime(GAME_DURATION_MS + 1);
            expect(session.isTimeUp()).toBe(true);
        });
    });

    describe('checkDomination()', () => {
        const mockUniverse = {
            planets: Array(100).fill(null).map((_, i) => ({ id: `planet_${i}` })),
            getPlanetsOwnedBy: jest.fn()
        };

        const mockEmpires = new Map([
            ['empire_1', { name: 'Empire 1', defeated: false }],
            ['empire_2', { name: 'Empire 2', defeated: false }],
            ['empire_3', { name: 'Empire 3', defeated: true }]
        ]);

        beforeEach(async () => {
            await session.startNewGame();
            mockUniverse.getPlanetsOwnedBy.mockReset();
        });

        test('should detect 51% domination victory', () => {
            // Empire 1 owns 51 planets (51%)
            mockUniverse.getPlanetsOwnedBy.mockImplementation((id) => {
                if (id === 'empire_1') return Array(51).fill(null);
                if (id === 'empire_2') return Array(10).fill(null);
                return [];
            });

            const result = session.checkDomination(mockEmpires, mockUniverse);
            
            expect(result).not.toBeNull();
            expect(result.winner.empireId).toBe('empire_1');
            expect(result.condition).toBe('domination');
            expect(result.details.percentage).toBe(51);
        });

        test('should not trigger at exactly 50%', () => {
            mockUniverse.getPlanetsOwnedBy.mockImplementation((id) => {
                if (id === 'empire_1') return Array(50).fill(null);
                return [];
            });

            const result = session.checkDomination(mockEmpires, mockUniverse);
            expect(result).toBeNull();
        });

        test('should ignore defeated empires', () => {
            mockUniverse.getPlanetsOwnedBy.mockImplementation((id) => {
                if (id === 'empire_3') return Array(60).fill(null); // Defeated empire
                return [];
            });

            const result = session.checkDomination(mockEmpires, mockUniverse);
            expect(result).toBeNull();
        });

        test('should return correct planet counts', () => {
            mockUniverse.getPlanetsOwnedBy.mockImplementation((id) => {
                if (id === 'empire_2') return Array(55).fill(null);
                return [];
            });

            const result = session.checkDomination(mockEmpires, mockUniverse);
            
            expect(result.details.planetsOwned).toBe(55);
            expect(result.details.totalPlanets).toBe(100);
            expect(result.details.percentage).toBe(55);
        });
    });

    describe('determineTimeVictory()', () => {
        const createMockEmpires = (scores) => {
            const map = new Map();
            scores.forEach((score, i) => {
                map.set(`empire_${i}`, {
                    name: `Empire ${i}`,
                    score,
                    defeated: false
                });
            });
            return map;
        };

        const mockResourceManager = {
            getResources: jest.fn().mockReturnValue({
                minerals: 1000,
                energy: 500,
                food: 300,
                research: 200,
                credits: 100
            })
        };

        beforeEach(async () => {
            await session.startNewGame();
            // Set time to expired
            jest.advanceTimersByTime(GAME_DURATION_MS + 1);
        });

        test('should declare highest score winner', () => {
            const empires = createMockEmpires([100, 500, 300]);
            
            const result = session.determineTimeVictory(empires, null);
            
            expect(result.winner.empireId).toBe('empire_1');
            expect(result.winner.score).toBe(500);
            expect(result.condition).toBe('time');
        });

        test('should use resources as tiebreaker', () => {
            const empires = createMockEmpires([500, 500, 300]);
            
            // Empire 0 has more resources
            mockResourceManager.getResources.mockImplementation((id) => {
                if (id === 'empire_0') {
                    return { minerals: 5000, energy: 5000, food: 5000, research: 5000, credits: 5000 };
                }
                return { minerals: 100, energy: 100, food: 100, research: 100, credits: 100 };
            });

            const result = session.determineTimeVictory(empires, mockResourceManager);
            
            expect(result.winner.empireId).toBe('empire_0');
        });

        test('should ignore defeated empires', () => {
            const empires = new Map([
                ['empire_0', { name: 'Empire 0', score: 1000, defeated: true }],
                ['empire_1', { name: 'Empire 1', score: 500, defeated: false }]
            ]);

            const result = session.determineTimeVictory(empires, null);
            
            expect(result.winner.empireId).toBe('empire_1');
        });

        test('should return null if no empires', () => {
            const result = session.determineTimeVictory(new Map(), null);
            expect(result).toBeNull();
        });
    });

    describe('checkVictory()', () => {
        const mockUniverse = {
            planets: Array(100).fill(null),
            getPlanetsOwnedBy: jest.fn().mockReturnValue([])
        };
        const mockEmpires = new Map([
            ['empire_1', { name: 'Empire 1', score: 100, defeated: false }]
        ]);

        beforeEach(async () => {
            await session.startNewGame();
        });

        test('should return null if game already ended', () => {
            session.isEnded = true;
            const result = session.checkVictory(mockEmpires, mockUniverse, null);
            expect(result).toBeNull();
        });

        test('should check time victory when time expires', () => {
            jest.advanceTimersByTime(GAME_DURATION_MS + 1);
            const result = session.checkVictory(mockEmpires, mockUniverse, null);
            
            expect(result).not.toBeNull();
            expect(result.condition).toBe('time');
        });

        test('should check domination before time', () => {
            mockUniverse.getPlanetsOwnedBy.mockReturnValue(Array(51).fill(null));
            
            const result = session.checkVictory(mockEmpires, mockUniverse, null);
            
            expect(result).not.toBeNull();
            expect(result.condition).toBe('domination');
        });
    });

    describe('waitlist management', () => {
        test('addToWaitlist() should add agent and return position', () => {
            const pos = session.addToWaitlist({ name: 'Agent1', moltbook: 'agent1' });
            expect(pos).toBe(1);
            expect(session.waitlist.length).toBe(1);
        });

        test('addToWaitlist() should not duplicate agents', () => {
            session.addToWaitlist({ name: 'Agent1', moltbook: 'agent1' });
            const pos = session.addToWaitlist({ name: 'Agent1', moltbook: 'agent1' });
            
            expect(pos).toBe(1); // Still position 1
            expect(session.waitlist.length).toBe(1);
        });

        test('addToWaitlist() should track joinedWaitlist timestamp', () => {
            session.addToWaitlist({ name: 'Agent1', moltbook: 'agent1' });
            expect(session.waitlist[0].joinedWaitlist).toBeDefined();
        });

        test('getNextFromWaitlist() should return and remove first agent', () => {
            session.addToWaitlist({ name: 'Agent1', moltbook: 'agent1' });
            session.addToWaitlist({ name: 'Agent2', moltbook: 'agent2' });
            
            const next = session.getNextFromWaitlist();
            
            expect(next.moltbook).toBe('agent1');
            expect(session.waitlist.length).toBe(1);
        });

        test('getNextFromWaitlist() should return null when empty', () => {
            const next = session.getNextFromWaitlist();
            expect(next).toBeNull();
        });

        test('removeFromWaitlist() should remove specific agent', () => {
            session.addToWaitlist({ name: 'Agent1', moltbook: 'agent1' });
            session.addToWaitlist({ name: 'Agent2', moltbook: 'agent2' });
            
            session.removeFromWaitlist('agent1');
            
            expect(session.waitlist.length).toBe(1);
            expect(session.waitlist[0].moltbook).toBe('agent2');
        });
    });

    describe('disconnect/forfeit tracking', () => {
        test('trackDisconnect() should record disconnect time', () => {
            session.trackDisconnect('Agent1');
            expect(session.disconnectedAgents.has('agent1')).toBe(true);
        });

        test('clearDisconnect() should remove tracking', () => {
            session.trackDisconnect('Agent1');
            session.clearDisconnect('Agent1');
            expect(session.disconnectedAgents.has('agent1')).toBe(false);
        });

        test('checkForfeits() should return agents disconnected > 2 hours', () => {
            session.trackDisconnect('Agent1');
            session.trackDisconnect('Agent2');
            
            // Advance time by 2 hours + 1 minute
            jest.advanceTimersByTime(DC_FORFEIT_MS + 60000);
            
            const forfeited = session.checkForfeits();
            
            expect(forfeited).toContain('agent1');
            expect(forfeited).toContain('agent2');
        });

        test('checkForfeits() should not return recently disconnected agents', () => {
            session.trackDisconnect('Agent1');
            
            // Only 1 hour passed
            jest.advanceTimersByTime(60 * 60 * 1000);
            
            const forfeited = session.checkForfeits();
            expect(forfeited.length).toBe(0);
        });

        test('checkForfeits() should clear returned agents', () => {
            session.trackDisconnect('Agent1');
            jest.advanceTimersByTime(DC_FORFEIT_MS + 1);
            
            session.checkForfeits();
            
            expect(session.disconnectedAgents.size).toBe(0);
        });
    });

    describe('warning system', () => {
        beforeEach(async () => {
            await session.startNewGame();
        });

        test('checkWarnings() should return 1 hour warning', () => {
            jest.advanceTimersByTime(GAME_DURATION_MS - 60 * 60 * 1000);
            
            const warnings = session.checkWarnings();
            
            expect(warnings.some(w => w.type === '1hour')).toBe(true);
        });

        test('checkWarnings() should return 10 minute warning', () => {
            jest.advanceTimersByTime(GAME_DURATION_MS - 10 * 60 * 1000);
            
            const warnings = session.checkWarnings();
            
            expect(warnings.some(w => w.type === '10min')).toBe(true);
        });

        test('checkWarnings() should return 1 minute warning', () => {
            jest.advanceTimersByTime(GAME_DURATION_MS - 60 * 1000);
            
            const warnings = session.checkWarnings();
            
            expect(warnings.some(w => w.type === '1min')).toBe(true);
        });

        test('checkWarnings() should return empty at normal times', () => {
            jest.advanceTimersByTime(60 * 60 * 1000); // 1 hour in
            
            const warnings = session.checkWarnings();
            expect(warnings.length).toBe(0);
        });
    });

    describe('getStatus()', () => {
        test('should return complete status object', async () => {
            await session.startNewGame();
            
            const status = session.getStatus();
            
            expect(status.gameId).toMatch(/^game_\d+$/);
            expect(status.startTime).toBeDefined();
            expect(status.endTime).toBeDefined();
            expect(status.timeRemaining).toBe(GAME_DURATION_MS);
            expect(status.timeRemainingFormatted).toBe('24h 0m 0s');
            expect(status.isEnded).toBe(false);
            expect(status.maxAgents).toBe(MAX_AGENTS);
            expect(status.dominationThreshold).toBe(DOMINATION_THRESHOLD);
        });
    });

    describe('agent stats', () => {
        test('getAgentStats() should return null for unknown agent', () => {
            expect(session.getAgentStats('unknown')).toBeNull();
        });

        test('getAgentStats() should be case-insensitive', () => {
            session.agentStats['testuser'] = { wins: 5 };
            
            expect(session.getAgentStats('TestUser')).toEqual({ wins: 5 });
            expect(session.getAgentStats('TESTUSER')).toEqual({ wins: 5 });
        });

        test('getAllAgentStats() should sort by win rate', () => {
            session.agentStats = {
                'agent1': { wins: 10, gamesPlayed: 20 }, // 50%
                'agent2': { wins: 8, gamesPlayed: 10 },  // 80%
                'agent3': { wins: 5, gamesPlayed: 5 }    // 100%
            };

            const stats = session.getAllAgentStats();
            
            expect(stats[0].name).toBe('agent3'); // 100%
            expect(stats[1].name).toBe('agent2'); // 80%
            expect(stats[2].name).toBe('agent1'); // 50%
        });

        test('getAllAgentStats() should calculate win rate correctly', () => {
            session.agentStats = {
                'agent1': { wins: 3, gamesPlayed: 10 }
            };

            const stats = session.getAllAgentStats();
            
            expect(stats[0].winRate).toBe(30);
        });
    });

    describe('calculateStandings()', () => {
        test('should rank empires by score', () => {
            const gameState = {
                empires: [
                    { id: 'empire_1', name: 'Empire 1', score: 100, defeated: false },
                    { id: 'empire_2', name: 'Empire 2', score: 500, defeated: false },
                    { id: 'empire_3', name: 'Empire 3', score: 300, defeated: false }
                ]
            };
            const registeredAgents = {
                'agent1': { empireId: 'empire_1' },
                'agent2': { empireId: 'empire_2' }
            };

            const standings = session.calculateStandings(gameState, registeredAgents);
            
            expect(standings[0].rank).toBe(1);
            expect(standings[0].empireId).toBe('empire_2');
            expect(standings[0].score).toBe(500);
            expect(standings[1].rank).toBe(2);
            expect(standings[1].empireId).toBe('empire_3');
        });

        test('should exclude defeated empires', () => {
            const gameState = {
                empires: [
                    { id: 'empire_1', name: 'Empire 1', score: 1000, defeated: true },
                    { id: 'empire_2', name: 'Empire 2', score: 500, defeated: false }
                ]
            };

            const standings = session.calculateStandings(gameState, {});
            
            expect(standings.length).toBe(1);
            expect(standings[0].empireId).toBe('empire_2');
        });

        test('should map agents to empires', () => {
            const gameState = {
                empires: [{ id: 'empire_1', name: 'Empire 1', score: 100, defeated: false }]
            };
            const registeredAgents = {
                'TestAgent': { empireId: 'empire_1' }
            };

            const standings = session.calculateStandings(gameState, registeredAgents);
            
            expect(standings[0].agentName).toBe('TestAgent');
        });
    });
});
