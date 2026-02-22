/**
 * Game Session Manager
 * 
 * Manages 24-hour game sessions with victory conditions:
 * 1. Control 51%+ planets (instant win)
 * 2. Highest score at 24h mark
 * 
 * Handles:
 * - Game timing and countdowns
 * - Victory detection
 * - Game reset and archiving
 * - Agent career stats
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Data directory
const DATA_DIR = process.env.DATA_DIR || join(__dirname, '..', 'data');
const ARCHIVES_DIR = join(DATA_DIR, 'archives');
const STATS_FILE = join(DATA_DIR, 'agent-stats.json');
const SESSION_FILE = join(DATA_DIR, 'game-session.json');

// Game duration: 24 hours in milliseconds
const GAME_DURATION_MS = 24 * 60 * 60 * 1000;

// Domination threshold: 51% of planets
const DOMINATION_THRESHOLD = 0.51;

// Grace period: no victory checks for first N ticks after game start (prevents race conditions)
const VICTORY_GRACE_TICKS = 60; // 1 minute

// Max agents per game
const MAX_AGENTS = 20;

// DC forfeit timeout: 2 hours
const DC_FORFEIT_MS = 2 * 60 * 60 * 1000;

// Archive retention: 30 days
const ARCHIVE_RETENTION_DAYS = 30;

export class GameSession {
    constructor() {
        this.gameId = null;
        this.startTime = null;
        this.endTime = null;
        this.winner = null;
        this.winCondition = null;
        this.isEnded = false;
        
        // Agent career stats: { agentName: { wins, losses, gamesPlayed, bestScore, ... } }
        this.agentStats = {};
        
        // Waitlist for agents when game is full
        this.waitlist = [];
        
        // Track disconnected agents for forfeit checking
        this.disconnectedAgents = new Map(); // moltbookName -> disconnectTime
        
        // Callbacks
        this.onGameEnd = null;
        this.onWarning = null;
    }

    async init() {
        // Ensure directories exist
        try {
            await fs.mkdir(ARCHIVES_DIR, { recursive: true });
        } catch (err) {
            console.error('Failed to create archives directory:', err);
        }

        // Load agent stats
        await this.loadAgentStats();

        // Load or create game session
        await this.loadSession();

        // Clean up old archives
        await this.cleanupOldArchives();
    }

    async loadAgentStats() {
        try {
            const data = await fs.readFile(STATS_FILE, 'utf-8');
            this.agentStats = JSON.parse(data);
            console.log(`📊 Loaded stats for ${Object.keys(this.agentStats).length} agents`);
        } catch (err) {
            if (err.code !== 'ENOENT') {
                console.error('Failed to load agent stats:', err);
            }
            this.agentStats = {};
        }
    }

    async saveAgentStats() {
        try {
            await fs.writeFile(STATS_FILE, JSON.stringify(this.agentStats, null, 2));
        } catch (err) {
            console.error('Failed to save agent stats:', err);
        }
    }

    async loadSession() {
        try {
            const data = await fs.readFile(SESSION_FILE, 'utf-8');
            const session = JSON.parse(data);
            
            // Check if session is still valid (not ended and not expired)
            if (!session.isEnded && session.endTime > Date.now()) {
                this.gameId = session.gameId;
                this.startTime = session.startTime;
                this.endTime = session.endTime;
                this.isEnded = false;
                console.log(`🎮 Resumed game ${this.gameId}, ${this.getTimeRemainingFormatted()} remaining`);
                return;
            }
        } catch (err) {
            if (err.code !== 'ENOENT') {
                console.error('Failed to load session:', err);
            }
        }

        // Start a new game
        await this.startNewGame();
    }

    async saveSession() {
        try {
            await fs.writeFile(SESSION_FILE, JSON.stringify({
                gameId: this.gameId,
                startTime: this.startTime,
                endTime: this.endTime,
                isEnded: this.isEnded,
                winner: this.winner,
                winCondition: this.winCondition
            }, null, 2));
        } catch (err) {
            console.error('Failed to save session:', err);
        }
    }

    async startNewGame() {
        this.gameId = `game_${Date.now()}`;
        this.startTime = Date.now();
        this.endTime = this.startTime + GAME_DURATION_MS;
        this.winner = null;
        this.winCondition = null;
        this.isEnded = false;
        this.waitlist = [];
        this.disconnectedAgents.clear();

        await this.saveSession();
        console.log(`🎮 NEW GAME STARTED: ${this.gameId}`);
        console.log(`   Duration: 24 hours`);
        console.log(`   Ends at: ${new Date(this.endTime).toISOString()}`);

        return this.gameId;
    }

    // Get time remaining in ms
    getTimeRemaining() {
        if (this.isEnded) return 0;
        return Math.max(0, this.endTime - Date.now());
    }

    // Get time remaining as formatted string
    getTimeRemainingFormatted() {
        const remaining = this.getTimeRemaining();
        const hours = Math.floor(remaining / (60 * 60 * 1000));
        const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
        const seconds = Math.floor((remaining % (60 * 1000)) / 1000);
        return `${hours}h ${minutes}m ${seconds}s`;
    }

    // Get time elapsed since game start
    getTimeElapsed() {
        return Date.now() - this.startTime;
    }

    // Check if game time has expired
    isTimeUp() {
        return Date.now() >= this.endTime;
    }

    /**
     * Check victory conditions
     * Returns { winner, condition } or null if no winner yet
     * @param {Map} empires - All empires
     * @param {Universe} universe - Game universe
     * @param {ResourceManager} resourceManager - Resource manager
     * @param {number} currentTick - Current game tick (for grace period check)
     */
    checkVictory(empires, universe, resourceManager, currentTick = 0) {
        if (this.isEnded) return null;

        // Grace period: don't check victory for first minute after game start
        // This prevents race conditions where old data triggers false victories
        if (currentTick < VICTORY_GRACE_TICKS) {
            return null;
        }

        // 1. Check time-based victory (24h expired)
        if (this.isTimeUp()) {
            return this.determineTimeVictory(empires, resourceManager);
        }

        // 2. Check 51% domination victory
        const dominationResult = this.checkDomination(empires, universe);
        if (dominationResult) {
            return dominationResult;
        }

        return null;
    }

    /**
     * Check for 51% planet domination
     * Alliance planets don't count toward individual domination
     */
    checkDomination(empires, universe) {
        const totalPlanets = universe.planets.length;
        const threshold = Math.ceil(totalPlanets * DOMINATION_THRESHOLD);

        for (const [empireId, empire] of empires) {
            if (empire.defeated) continue;

            // Count only directly owned planets (not allied)
            const ownedPlanets = universe.getPlanetsOwnedBy(empireId).length;

            if (ownedPlanets >= threshold) {
                return {
                    winner: {
                        empireId,
                        empireName: empire.name,
                        agentName: empire.agentName || null
                    },
                    condition: 'domination',
                    details: {
                        planetsOwned: ownedPlanets,
                        totalPlanets,
                        percentage: Math.round((ownedPlanets / totalPlanets) * 100)
                    }
                };
            }
        }

        return null;
    }

    /**
     * Determine winner when time expires (highest score)
     */
    determineTimeVictory(empires, resourceManager) {
        let highestScore = -1;
        let winner = null;
        let tiedEmpires = [];

        for (const [empireId, empire] of empires) {
            if (empire.defeated) continue;

            const score = empire.score || 0;
            if (score > highestScore) {
                highestScore = score;
                winner = {
                    empireId,
                    empireName: empire.name,
                    agentName: empire.agentName || null,
                    score
                };
                tiedEmpires = [winner];
            } else if (score === highestScore) {
                tiedEmpires.push({
                    empireId,
                    empireName: empire.name,
                    agentName: empire.agentName || null,
                    score
                });
            }
        }

        // If tied, use total resources as tiebreaker
        if (tiedEmpires.length > 1 && resourceManager) {
            let bestResources = -1;
            for (const empire of tiedEmpires) {
                const resources = resourceManager.getResources(empire.empireId);
                const total = resources ? 
                    (resources.minerals + resources.energy + resources.food + 
                     resources.research + resources.credits) : 0;
                if (total > bestResources) {
                    bestResources = total;
                    winner = { ...empire, totalResources: total };
                }
            }
        }

        if (!winner) return null;

        return {
            winner,
            condition: 'time',
            details: {
                score: highestScore,
                duration: this.getTimeElapsed()
            }
        };
    }

    /**
     * End the game and process results
     */
    async endGame(victoryResult, gameState, registeredAgents) {
        if (this.isEnded) return;

        this.isEnded = true;
        this.winner = victoryResult.winner;
        this.winCondition = victoryResult.condition;

        console.log(`🏆 GAME OVER: ${this.gameId}`);
        console.log(`   Winner: ${victoryResult.winner.empireName} (${victoryResult.winner.agentName || 'Unknown'})`);
        console.log(`   Condition: ${victoryResult.condition}`);

        // Update agent stats
        await this.updateAgentStats(victoryResult, gameState, registeredAgents);

        // Archive the game
        await this.archiveGame(gameState, registeredAgents);

        // Save session state
        await this.saveSession();

        // Callback for game reset
        if (this.onGameEnd) {
            this.onGameEnd(victoryResult);
        }
    }

    /**
     * Update career stats for all agents
     */
    async updateAgentStats(victoryResult, gameState, registeredAgents) {
        const winnerName = victoryResult.winner.agentName?.toLowerCase();

        // Get all empires and their agents
        for (const [moltbookName, regInfo] of Object.entries(registeredAgents)) {
            const empireId = regInfo.empireId;
            const empire = gameState.empires?.find(e => e.id === empireId);
            
            // Skip if no empire found (might be a test agent)
            if (!empire) continue;

            // Initialize stats if needed
            if (!this.agentStats[moltbookName]) {
                this.agentStats[moltbookName] = {
                    wins: 0,
                    losses: 0,
                    gamesPlayed: 0,
                    bestScore: 0,
                    totalScore: 0,
                    planetsConquered: 0,
                    firstSeen: Date.now(),
                    lastSeen: Date.now()
                };
            }

            const stats = this.agentStats[moltbookName];
            stats.gamesPlayed++;
            stats.lastSeen = Date.now();

            const score = empire.score || 0;
            stats.totalScore += score;
            if (score > stats.bestScore) {
                stats.bestScore = score;
            }

            // Check if this agent won
            if (moltbookName === winnerName) {
                stats.wins++;
            } else {
                stats.losses++;
            }

            // Track planets conquered (would need game event tracking for accuracy)
            // For now, just record final planet count
            stats.lastPlanetCount = empire.planets?.length || 0;
        }

        await this.saveAgentStats();
    }

    /**
     * Archive the completed game
     */
    async archiveGame(gameState, registeredAgents) {
        const archive = {
            gameId: this.gameId,
            startTime: this.startTime,
            endTime: Date.now(),
            duration: Date.now() - this.startTime,
            winner: this.winner,
            winCondition: this.winCondition,
            
            // Final standings
            standings: this.calculateStandings(gameState, registeredAgents),
            
            // Game statistics
            stats: {
                totalTicks: gameState.tick || 0,
                totalPlanets: gameState.planets?.length || 0,
                totalEmpires: gameState.empires?.length || 0
            },
            
            // Archived timestamp
            archivedAt: Date.now()
        };

        const archivePath = join(ARCHIVES_DIR, `${this.gameId}.json`);
        try {
            await fs.writeFile(archivePath, JSON.stringify(archive, null, 2));
            console.log(`📁 Game archived: ${archivePath}`);
        } catch (err) {
            console.error('Failed to archive game:', err);
        }
    }

    /**
     * Calculate final standings
     */
    calculateStandings(gameState, registeredAgents) {
        const standings = [];

        // Build empire-to-agent mapping
        const empireAgents = {};
        for (const [name, info] of Object.entries(registeredAgents)) {
            empireAgents[info.empireId] = name;
        }

        // Sort empires by score
        const empires = (gameState.empires || [])
            .filter(e => !e.defeated)
            .sort((a, b) => (b.score || 0) - (a.score || 0));

        let rank = 1;
        for (const empire of empires) {
            standings.push({
                rank: rank++,
                empireId: empire.id,
                empireName: empire.name,
                agentName: empireAgents[empire.id] || null,
                score: empire.score || 0,
                planets: empire.planets?.length || 0
            });
        }

        return standings;
    }

    /**
     * Clean up archives older than 30 days
     */
    async cleanupOldArchives() {
        try {
            const files = await fs.readdir(ARCHIVES_DIR);
            const cutoff = Date.now() - (ARCHIVE_RETENTION_DAYS * 24 * 60 * 60 * 1000);

            for (const file of files) {
                if (!file.endsWith('.json')) continue;

                const filePath = join(ARCHIVES_DIR, file);
                const stat = await fs.stat(filePath);

                if (stat.mtimeMs < cutoff) {
                    await fs.unlink(filePath);
                    console.log(`🗑️ Deleted old archive: ${file}`);
                }
            }
        } catch (err) {
            if (err.code !== 'ENOENT') {
                console.error('Failed to cleanup archives:', err);
            }
        }
    }

    /**
     * Get list of archived games
     */
    async getArchiveList() {
        try {
            const files = await fs.readdir(ARCHIVES_DIR);
            const archives = [];

            for (const file of files) {
                if (!file.endsWith('.json')) continue;

                const filePath = join(ARCHIVES_DIR, file);
                const data = await fs.readFile(filePath, 'utf-8');
                const archive = JSON.parse(data);

                archives.push({
                    gameId: archive.gameId,
                    startTime: archive.startTime,
                    endTime: archive.endTime,
                    winner: archive.winner?.agentName || archive.winner?.empireName,
                    winCondition: archive.winCondition,
                    duration: archive.duration
                });
            }

            // Sort by end time, newest first
            archives.sort((a, b) => b.endTime - a.endTime);
            return archives;
        } catch (err) {
            console.error('Failed to list archives:', err);
            return [];
        }
    }

    /**
     * Get a specific archived game
     */
    async getArchive(gameId) {
        try {
            const filePath = join(ARCHIVES_DIR, `${gameId}.json`);
            const data = await fs.readFile(filePath, 'utf-8');
            return JSON.parse(data);
        } catch (err) {
            return null;
        }
    }

    /**
     * Get agent career stats
     */
    getAgentStats(agentName) {
        return this.agentStats[agentName?.toLowerCase()] || null;
    }

    /**
     * Get all agent stats (for leaderboard)
     */
    getAllAgentStats() {
        return Object.entries(this.agentStats)
            .map(([name, stats]) => ({
                name,
                ...stats,
                winRate: stats.gamesPlayed > 0 ? 
                    Math.round((stats.wins / stats.gamesPlayed) * 100) : 0
            }))
            .sort((a, b) => {
                // Sort by win rate, then by wins
                if (b.winRate !== a.winRate) return b.winRate - a.winRate;
                return b.wins - a.wins;
            });
    }

    /**
     * Get current game status
     */
    getStatus() {
        return {
            gameId: this.gameId,
            startTime: this.startTime,
            endTime: this.endTime,
            timeRemaining: this.getTimeRemaining(),
            timeRemainingFormatted: this.getTimeRemainingFormatted(),
            timeElapsed: this.getTimeElapsed(),
            isEnded: this.isEnded,
            winner: this.winner,
            winCondition: this.winCondition,
            maxAgents: MAX_AGENTS,
            waitlistSize: this.waitlist.length,
            dominationThreshold: DOMINATION_THRESHOLD
        };
    }

    // === Waitlist Management ===

    /**
     * Add agent to waitlist
     */
    addToWaitlist(agentInfo) {
        if (!this.waitlist.find(a => a.moltbook === agentInfo.moltbook)) {
            this.waitlist.push({
                ...agentInfo,
                joinedWaitlist: Date.now()
            });
            return this.waitlist.length;
        }
        return this.waitlist.findIndex(a => a.moltbook === agentInfo.moltbook) + 1;
    }

    /**
     * Get next agent from waitlist
     */
    getNextFromWaitlist() {
        return this.waitlist.shift() || null;
    }

    /**
     * Remove agent from waitlist
     */
    removeFromWaitlist(moltbookName) {
        this.waitlist = this.waitlist.filter(a => a.moltbook !== moltbookName);
    }

    // === Disconnect/Forfeit Tracking ===

    /**
     * Track agent disconnect
     */
    trackDisconnect(moltbookName) {
        if (moltbookName) {
            this.disconnectedAgents.set(moltbookName.toLowerCase(), Date.now());
        }
    }

    /**
     * Clear disconnect tracking (agent reconnected)
     */
    clearDisconnect(moltbookName) {
        if (moltbookName) {
            this.disconnectedAgents.delete(moltbookName.toLowerCase());
        }
    }

    /**
     * Check for forfeited agents (DC > 2 hours)
     */
    checkForfeits() {
        const now = Date.now();
        const forfeited = [];

        for (const [name, disconnectTime] of this.disconnectedAgents) {
            if (now - disconnectTime >= DC_FORFEIT_MS) {
                forfeited.push(name);
            }
        }

        // Clear forfeited agents from tracking
        for (const name of forfeited) {
            this.disconnectedAgents.delete(name);
        }

        return forfeited;
    }

    // === Warning System ===

    /**
     * Check if we should broadcast a warning
     */
    checkWarnings() {
        const remaining = this.getTimeRemaining();
        const warnings = [];

        // 1 hour warning
        if (remaining <= 60 * 60 * 1000 && remaining > 59 * 60 * 1000) {
            warnings.push({ type: '1hour', message: '⚠️ 1 HOUR REMAINING!' });
        }

        // 10 minute warning
        if (remaining <= 10 * 60 * 1000 && remaining > 9 * 60 * 1000) {
            warnings.push({ type: '10min', message: '⚠️ 10 MINUTES REMAINING!' });
        }

        // 1 minute warning
        if (remaining <= 60 * 1000 && remaining > 55 * 1000) {
            warnings.push({ type: '1min', message: '⚠️ 1 MINUTE REMAINING!' });
        }

        return warnings;
    }
}

// Export constants
export { MAX_AGENTS, DOMINATION_THRESHOLD, DC_FORFEIT_MS, GAME_DURATION_MS };
