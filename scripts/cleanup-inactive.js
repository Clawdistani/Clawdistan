#!/usr/bin/env node
/**
 * Cleanup Script for Clawdistan
 * Removes test agents and agents/empires inactive for specified duration.
 * 
 * Usage: node scripts/cleanup-inactive.js [--dry-run]
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Data directory - use /data on Fly.io or local ./data
const DATA_DIR = process.env.DATA_DIR || join(__dirname, '..', 'data');
const AGENTS_FILE = join(DATA_DIR, 'agents.json');
const GAME_STATE_FILE = join(DATA_DIR, 'game-state.json');

// Config
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
    console.log('🧹 Clawdistan Cleanup Script');
    console.log(`📁 Data directory: ${DATA_DIR}`);
    console.log(`🔍 Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE'}`);
    console.log('');

    const now = Date.now();
    const cutoffDate = now - ONE_MONTH_MS;
    console.log(`📅 Cutoff date: ${new Date(cutoffDate).toISOString()}`);
    console.log(`   (removing agents inactive since before this date)`);
    console.log('');

    // Load agents
    let agents;
    try {
        const data = await fs.readFile(AGENTS_FILE, 'utf-8');
        agents = JSON.parse(data);
        console.log(`📂 Loaded ${Object.keys(agents).length} agents`);
    } catch (err) {
        console.error('❌ Failed to load agents:', err.message);
        process.exit(1);
    }

    // Identify agents to remove
    const toRemove = [];
    const toKeep = {};

    for (const [name, agent] of Object.entries(agents)) {
        const isTestAgent = name.startsWith('testagent_');
        const lastSeen = agent.lastSeen || agent.registeredAt || 0;
        const isInactive = lastSeen < cutoffDate;
        
        if (isTestAgent) {
            toRemove.push({ name, reason: 'test agent', agent });
        } else if (isInactive) {
            toRemove.push({ name, reason: `inactive since ${new Date(lastSeen).toISOString()}`, agent });
        } else {
            toKeep[name] = agent;
        }
    }

    console.log('');
    console.log('🗑️  Agents to REMOVE:');
    if (toRemove.length === 0) {
        console.log('   (none)');
    } else {
        for (const { name, reason, agent } of toRemove) {
            console.log(`   - ${name} (${reason}) [empire: ${agent.empireId}]`);
        }
    }

    console.log('');
    console.log(`✅ Agents to KEEP: ${Object.keys(toKeep).length}`);

    // Get empire IDs to remove
    const empiresToRemove = new Set(toRemove.map(r => r.agent.empireId));
    
    // Check if any kept agents share these empires (edge case)
    for (const agent of Object.values(toKeep)) {
        empiresToRemove.delete(agent.empireId);
    }

    console.log('');
    console.log('🏰 Empires to REMOVE from game state:');
    if (empiresToRemove.size === 0) {
        console.log('   (none - all empires have active agents)');
    } else {
        for (const empireId of empiresToRemove) {
            console.log(`   - ${empireId}`);
        }
    }

    // Load and clean game state
    let gameState;
    try {
        const data = await fs.readFile(GAME_STATE_FILE, 'utf-8');
        gameState = JSON.parse(data);
        console.log('');
        console.log(`📂 Loaded game state (tick ${gameState.tick || 0})`);
    } catch (err) {
        console.log('');
        console.log('⚠️  No game state file found, skipping game state cleanup');
        gameState = null;
    }

    if (gameState && empiresToRemove.size > 0) {
        // Clean empires
        if (gameState.empires) {
            const beforeCount = Object.keys(gameState.empires).length;
            for (const empireId of empiresToRemove) {
                delete gameState.empires[empireId];
            }
            const afterCount = Object.keys(gameState.empires).length;
            console.log(`   Empires: ${beforeCount} → ${afterCount}`);
        }

        // Clean planet ownership
        if (gameState.planets) {
            let planetsCleared = 0;
            for (const planet of Object.values(gameState.planets)) {
                if (planet.owner && empiresToRemove.has(planet.owner)) {
                    planet.owner = null;
                    planet.population = planet.population ? Math.floor(planet.population * 0.5) : 0;
                    planetsCleared++;
                }
            }
            console.log(`   Planets cleared: ${planetsCleared}`);
        }

        // Clean fleets
        if (gameState.fleets) {
            const beforeFleets = Object.keys(gameState.fleets).length;
            for (const [fleetId, fleet] of Object.entries(gameState.fleets)) {
                if (fleet.owner && empiresToRemove.has(fleet.owner)) {
                    delete gameState.fleets[fleetId];
                }
            }
            const afterFleets = Object.keys(gameState.fleets).length;
            console.log(`   Fleets: ${beforeFleets} → ${afterFleets}`);
        }

        // Clean council votes
        if (gameState.council?.votes) {
            for (const empireId of empiresToRemove) {
                delete gameState.council.votes[empireId];
            }
        }
    }

    // Save changes
    if (!DRY_RUN) {
        console.log('');
        console.log('💾 Saving changes...');

        // Backup first
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        
        try {
            await fs.copyFile(AGENTS_FILE, `${AGENTS_FILE}.backup-${timestamp}`);
            console.log(`   Backed up agents to agents.json.backup-${timestamp}`);
        } catch (err) {
            console.log('   (no backup needed for agents)');
        }

        // Save agents
        await fs.writeFile(AGENTS_FILE, JSON.stringify(toKeep, null, 2));
        console.log(`   ✅ Saved ${Object.keys(toKeep).length} agents`);

        // Save game state
        if (gameState) {
            try {
                await fs.copyFile(GAME_STATE_FILE, `${GAME_STATE_FILE}.backup-${timestamp}`);
                console.log(`   Backed up game state to game-state.json.backup-${timestamp}`);
            } catch (err) {
                console.log('   (no backup needed for game state)');
            }

            gameState.cleanedAt = new Date().toISOString();
            await fs.writeFile(GAME_STATE_FILE, JSON.stringify(gameState));
            console.log(`   ✅ Saved game state`);
        }

        console.log('');
        console.log('🎉 Cleanup complete!');
        console.log('   ⚠️  Restart the server to apply changes');
    } else {
        console.log('');
        console.log('🔍 DRY RUN complete - no changes made');
        console.log('   Run without --dry-run to apply changes');
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
