/**
 * Persistence Layer for Clawdistan
 * 
 * Saves game state and agent registrations to disk.
 * Enables agents to disconnect and reconnect to continue their empire.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { log } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Data directory - use /data on Fly.io (volume mount) or local ./data
const DATA_DIR = process.env.DATA_DIR || join(__dirname, '..', 'data');

const AGENTS_FILE = join(DATA_DIR, 'agents.json');
const GAME_STATE_FILE = join(DATA_DIR, 'game-state.json');

// Auto-save interval (5 minutes)
const AUTOSAVE_INTERVAL = 5 * 60 * 1000;

export class Persistence {
    constructor() {
        this.dirty = false; // Track if there are unsaved changes
        this.lastSave = null;
        this.autosaveTimer = null;
    }

    async init() {
        // Ensure data directory exists
        try {
            await fs.mkdir(DATA_DIR, { recursive: true });
            log.db.info('Data directory initialized', { path: DATA_DIR });
        } catch (err) {
            log.db.error('Failed to create data directory', err);
        }

        // Start autosave timer
        this.autosaveTimer = setInterval(() => this.autoSave(), AUTOSAVE_INTERVAL);
        log.db.info('Autosave enabled', { intervalMin: AUTOSAVE_INTERVAL / 60000 });
    }

    async autoSave() {
        if (this.dirty) {
            log.db.debug('Autosave triggered');
            // Note: actual save is called from server.js with current state
        }
    }

    markDirty() {
        this.dirty = true;
    }

    // === AGENT PERSISTENCE ===

    /**
     * Load registered agents from disk
     * Returns: { moltbookName: { empireId, name, registeredAt, lastSeen } }
     */
    async loadAgents() {
        try {
            const data = await fs.readFile(AGENTS_FILE, 'utf-8');
            const agents = JSON.parse(data);
            log.db.info('Loaded agents', { count: Object.keys(agents).length });
            return agents;
        } catch (err) {
            if (err.code === 'ENOENT') {
                log.db.info('No saved agents found, starting fresh');
                return {};
            }
            log.db.error('Failed to load agents', err);
            return {};
        }
    }

    /**
     * Save registered agents to disk
     */
    async saveAgents(agents) {
        try {
            await fs.writeFile(AGENTS_FILE, JSON.stringify(agents, null, 2));
            log.db.debug('Saved agents', { count: Object.keys(agents).length });
            return true;
        } catch (err) {
            log.db.error('Failed to save agents', err);
            return false;
        }
    }

    // === GAME STATE PERSISTENCE ===

    /**
     * Load game state from disk
     */
    async loadGameState() {
        try {
            const data = await fs.readFile(GAME_STATE_FILE, 'utf-8');
            const state = JSON.parse(data);
            log.db.info('Loaded game state', { tick: state.tick || 0 });
            return state;
        } catch (err) {
            if (err.code === 'ENOENT') {
                log.db.info('No saved game state, starting new universe');
                return null;
            }
            log.db.error('Failed to load game state', err);
            return null;
        }
    }

    /**
     * Save game state to disk
     */
    async saveGameState(state) {
        try {
            const data = {
                ...state,
                savedAt: new Date().toISOString()
            };
            await fs.writeFile(GAME_STATE_FILE, JSON.stringify(data, null, 2));
            this.lastSave = Date.now();
            this.dirty = false;
            log.db.debug('Saved game state', { tick: state.tick || 0 });
            return true;
        } catch (err) {
            log.db.error('Failed to save game state', err);
            return false;
        }
    }

    // === FULL SAVE ===

    /**
     * Save everything (call on graceful shutdown)
     */
    async saveAll(gameState, registeredAgents) {
        log.db.info('Saving all data...');
        await Promise.all([
            this.saveGameState(gameState),
            this.saveAgents(registeredAgents)
        ]);
        log.db.info('All data saved');
    }

    shutdown() {
        if (this.autosaveTimer) {
            clearInterval(this.autosaveTimer);
        }
    }
}

// Singleton instance
export const persistence = new Persistence();
