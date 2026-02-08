/**
 * Multi-Bot Arena - 20 Factions Battle for Galactic Supremacy
 * 
 * Usage: node multi-bot-arena.js [minutes]
 * Default: 30 minutes
 */

import WebSocket from 'ws';

// === CONFIGURATION ===
const SERVER_URL = 'wss://clawdistan.xyz';
const MOLTBOOK_API_KEY = process.env.MOLTBOOK_API_KEY || 'moltbook_sk_r0WSNYnD2SgrLeLBXkvuBUbu6Y-vwYmY';

// 20 Epic Faction Names (lowercase to match registered citizens)
const FACTIONS = [
    'clawdistani',           // The Founding Agent (you)
    'voidreapers',           // Aggressive militarists
    'nebulakings',           // Expansion-focused
    'stellarforge',          // Industry powerhouse
    'crimsontide',           // Ruthless conquerors
    'aetherweavers',         // Research-focused
    'ironnexus',             // Defensive turtlers
    'phantomfleet',          // Hit-and-run tactics
    'solardominion',         // Balanced empire
    'darkmatter',            // Mysterious faction
    'titanlords',            // Big ship builders
    'novastrike',            // Fast expansion
    'obsidianorder',         // Diplomatic manipulators
    'starfallempire',        // Classic imperials
    'quantumhive',           // Swarm tactics
    'frostbornlegion',       // Slow but powerful
    'thunderhawk',           // Aggressive raiders
    'eclipsesyndicate',      // Trade-focused
    'ashencrown',            // Ancient empire vibes
    'zenithprime'            // Tech supremacists
];

// Play time from command line (default 30 minutes)
const PLAY_MINUTES = parseInt(process.argv[2]) || 30;
const PLAY_TIME_MS = PLAY_MINUTES * 60 * 1000;

// Bot behavior profiles (affects decision weights) - lowercase to match faction names
const PROFILES = {
    'clawdistani': { expand: 0.3, build: 0.3, research: 0.2, military: 0.2 },
    'voidreapers': { expand: 0.2, build: 0.1, research: 0.1, military: 0.6 },
    'nebulakings': { expand: 0.5, build: 0.2, research: 0.2, military: 0.1 },
    'stellarforge': { expand: 0.2, build: 0.5, research: 0.2, military: 0.1 },
    'crimsontide': { expand: 0.3, build: 0.1, research: 0.1, military: 0.5 },
    'aetherweavers': { expand: 0.2, build: 0.2, research: 0.5, military: 0.1 },
    'ironnexus': { expand: 0.1, build: 0.4, research: 0.2, military: 0.3 },
    'phantomfleet': { expand: 0.3, build: 0.1, research: 0.2, military: 0.4 },
    'solardominion': { expand: 0.25, build: 0.25, research: 0.25, military: 0.25 },
    'darkmatter': { expand: 0.2, build: 0.3, research: 0.3, military: 0.2 },
    'titanlords': { expand: 0.1, build: 0.3, research: 0.2, military: 0.4 },
    'novastrike': { expand: 0.5, build: 0.2, research: 0.1, military: 0.2 },
    'obsidianorder': { expand: 0.2, build: 0.3, research: 0.3, military: 0.2 },
    'starfallempire': { expand: 0.3, build: 0.3, research: 0.2, military: 0.2 },
    'quantumhive': { expand: 0.4, build: 0.2, research: 0.2, military: 0.2 },
    'frostbornlegion': { expand: 0.1, build: 0.4, research: 0.3, military: 0.2 },
    'thunderhawk': { expand: 0.3, build: 0.1, research: 0.1, military: 0.5 },
    'eclipsesyndicate': { expand: 0.3, build: 0.4, research: 0.2, military: 0.1 },
    'ashencrown': { expand: 0.2, build: 0.3, research: 0.3, military: 0.2 },
    'zenithprime': { expand: 0.2, build: 0.2, research: 0.5, military: 0.1 }
};

// === BOT CLASS ===
class FactionBot {
    constructor(name) {
        this.name = name;
        this.ws = null;
        this.agentId = null;
        this.empireId = null;
        this.gameState = null;
        this.profile = PROFILES[name] || PROFILES['SolarDominion'];
        this.actionCount = 0;
        this.connected = false;
        this.systemsWithStarbase = new Set();
        this.lastTradeTarget = null;
    }

    connect() {
        this.ws = new WebSocket(SERVER_URL);

        this.ws.on('open', () => {
            this.connected = true;
            console.log(`[${this.name}] 🌐 Connected`);
            
            // clawdistani uses real auth, others use openRegistration for unique empires
            if (this.name === 'clawdistani') {
                this.ws.send(JSON.stringify({
                    type: 'register',
                    name: this.name,
                    apiKey: MOLTBOOK_API_KEY,
                    moltbook: 'Clawdistani'
                }));
            } else {
                this.ws.send(JSON.stringify({
                    type: 'register',
                    name: this.name,
                    openRegistration: true
                }));
            }
        });

        this.ws.on('message', (data) => {
            const msg = JSON.parse(data.toString());
            this.handleMessage(msg);
        });

        this.ws.on('close', () => {
            this.connected = false;
            console.log(`[${this.name}] 🔌 Disconnected`);
        });

        this.ws.on('error', (err) => {
            console.error(`[${this.name}] ❌ Error: ${err.message}`);
        });
    }

    handleMessage(msg) {
        switch (msg.type) {
            case 'registered':
                this.agentId = msg.agentId;
                this.empireId = msg.empireId;
                console.log(`[${this.name}] 🏴 Empire: ${msg.empireName || this.empireId}`);
                this.ws.send(JSON.stringify({ type: 'getState' }));
                break;

            case 'state':
            case 'tick':
                this.gameState = msg.data;
                break;

            case 'delta':
                // Apply delta updates to game state
                if (!this.gameState) {
                    this.gameState = {};
                }
                if (msg.resources) {
                    this.gameState.myResources = msg.resources;
                }
                if (msg.tick) {
                    this.gameState.tick = msg.tick;
                }
                if (msg.empires) {
                    this.gameState.empires = msg.empires;
                }
                if (msg.fleets) {
                    this.gameState.myFleets = msg.fleets;
                }
                break;

            case 'actionResult':
                if (msg.success) {
                    this.actionCount++;
                }
                break;
        }
    }

    takeAction() {
        if (!this.connected || !this.gameState || !this.empireId) return;

        const myEmpire = this.gameState.empires?.find(e => e.id === this.empireId);
        if (!myEmpire) return;

        const resources = myEmpire.resources || {};
        const myPlanets = this.gameState.universe?.planets?.filter(p => p.owner === this.empireId) || [];
        const allPlanets = this.gameState.universe?.planets || [];
        const unownedPlanets = allPlanets.filter(p => !p.owner);
        const enemyPlanets = allPlanets.filter(p => p.owner && p.owner !== this.empireId);

        // Weight-based decision making
        const roll = Math.random();
        let cumulative = 0;

        // EXPAND
        cumulative += this.profile.expand;
        if (roll < cumulative && unownedPlanets.length > 0) {
            const target = unownedPlanets[Math.floor(Math.random() * unownedPlanets.length)];
            this.send({ type: 'action', action: 'colonize', planetId: target.id });
            return;
        }

        // BUILD
        cumulative += this.profile.build;
        if (roll < cumulative && myPlanets.length > 0) {
            const planet = myPlanets[Math.floor(Math.random() * myPlanets.length)];
            const buildings = ['mine', 'solar_plant', 'farm', 'research_lab', 'factory', 'shipyard'];
            const building = buildings[Math.floor(Math.random() * buildings.length)];
            this.send({ type: 'action', action: 'build', planetId: planet.id, building });
            return;
        }

        // RESEARCH
        cumulative += this.profile.research;
        if (roll < cumulative) {
            const techs = this.gameState.availableTech || [];
            if (techs.length > 0) {
                const tech = techs[Math.floor(Math.random() * techs.length)];
                this.send({ type: 'action', action: 'research', techId: tech.id || tech });
            }
            return;
        }

        // MILITARY
        if (myPlanets.length > 0) {
            // Build ships or attack
            if (Math.random() < 0.7) {
                // Build ships
                const planet = myPlanets.find(p => p.buildings?.shipyard) || myPlanets[0];
                const ships = ['fighter', 'destroyer', 'cruiser', 'battleship', 'carrier'];
                const ship = ships[Math.floor(Math.random() * ships.length)];
                this.send({ type: 'action', action: 'build_ship', planetId: planet.id, shipType: ship });
            } else if (enemyPlanets.length > 0 && resources.population > 500) {
                // Attack
                const target = enemyPlanets[Math.floor(Math.random() * enemyPlanets.length)];
                const source = myPlanets[0];
                this.send({ type: 'action', action: 'invade', fromPlanetId: source.id, toPlanetId: target.id });
            }
        }
    }

    send(msg) {
        if (this.connected && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

// === ARENA MANAGER ===
class ArenaManager {
    constructor() {
        this.bots = [];
        this.startTime = null;
        this.statsInterval = null;
    }

    start() {
        console.log('');
        console.log('╔═══════════════════════════════════════════════════════════════╗');
        console.log('║       🏟️  CLAWDISTAN MULTI-BOT ARENA  🏟️                      ║');
        console.log('╠═══════════════════════════════════════════════════════════════╣');
        console.log(`║  Factions: ${FACTIONS.length}                                               ║`);
        console.log(`║  Duration: ${PLAY_MINUTES} minutes                                          ${PLAY_MINUTES < 10 ? ' ' : ''}║`);
        console.log('╚═══════════════════════════════════════════════════════════════╝');
        console.log('');

        this.startTime = Date.now();

        // Stagger bot connections to avoid overwhelming the server
        FACTIONS.forEach((name, i) => {
            setTimeout(() => {
                const bot = new FactionBot(name);
                bot.connect();
                this.bots.push(bot);
            }, i * 2000); // 2 seconds apart for stability
        });

        // Start action loops after all bots connected
        setTimeout(() => {
            console.log('\n🎮 All factions deployed! Battle begins...\n');
            
            // Each bot takes action every 5-15 seconds (randomized)
            this.bots.forEach(bot => {
                const interval = 5000 + Math.random() * 10000;
                setInterval(() => bot.takeAction(), interval);
                
                // Also refresh full state every 30 seconds
                setInterval(() => {
                    if (bot.connected && bot.ws.readyState === WebSocket.OPEN) {
                        bot.ws.send(JSON.stringify({ type: 'getState' }));
                    }
                }, 30000);
            });

            // Stats every 60 seconds
            this.statsInterval = setInterval(() => this.printStats(), 60000);
            
        }, FACTIONS.length * 500 + 2000);

        // End session
        setTimeout(() => {
            console.log('\n⏰ TIME\'S UP! Arena session complete.\n');
            this.printFinalStats();
            this.shutdown();
        }, PLAY_TIME_MS);
    }

    printStats() {
        const elapsed = Math.floor((Date.now() - this.startTime) / 60000);
        console.log(`\n📊 [${elapsed} min] Arena Status:`);
        
        // Get game state from any connected bot
        const connectedBot = this.bots.find(b => b.gameState);
        if (!connectedBot?.gameState?.empires) {
            console.log('   Waiting for game state...');
            return;
        }

        const empires = connectedBot.gameState.empires.sort((a, b) => (b.score || 0) - (a.score || 0));
        console.log('   Leaderboard:');
        empires.slice(0, 10).forEach((e, i) => {
            const planets = connectedBot.gameState.universe?.planets?.filter(p => p.owner === e.id).length || 0;
            console.log(`   ${i + 1}. ${e.name}: ${e.score || 0} pts, ${planets} planets`);
        });
    }

    printFinalStats() {
        console.log('\n🏆 FINAL RESULTS:\n');
        
        const connectedBot = this.bots.find(b => b.gameState);
        if (!connectedBot?.gameState?.empires) return;

        const empires = connectedBot.gameState.empires.sort((a, b) => (b.score || 0) - (a.score || 0));
        
        empires.forEach((e, i) => {
            const planets = connectedBot.gameState.universe?.planets?.filter(p => p.owner === e.id).length || 0;
            const bot = this.bots.find(b => b.empireId === e.id);
            const actions = bot?.actionCount || 0;
            
            let medal = '';
            if (i === 0) medal = '🥇';
            else if (i === 1) medal = '🥈';
            else if (i === 2) medal = '🥉';
            
            console.log(`${medal} ${i + 1}. ${e.name}: ${e.score || 0} pts | ${planets} planets | ${actions} actions`);
        });

        console.log('\n📈 Total actions:', this.bots.reduce((sum, b) => sum + b.actionCount, 0));
    }

    shutdown() {
        clearInterval(this.statsInterval);
        this.bots.forEach(bot => bot.disconnect());
        setTimeout(() => process.exit(0), 2000);
    }
}

// === MAIN ===
const arena = new ArenaManager();
arena.start();
