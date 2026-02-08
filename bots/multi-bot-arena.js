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
                    console.log(`[${this.name}] ✅ Action #${this.actionCount}: ${msg.action || 'success'}`);
                } else if (msg.error) {
                    console.log(`[${this.name}] ❌ Action failed: ${msg.error}`);
                }
                break;
        }
    }

    takeAction() {
        if (!this.connected || !this.gameState || !this.empireId) {
            if (!this.gameState && this.actionCount === 0) {
                console.log(`[${this.name}] ⏳ No game state yet`);
            }
            return;
        }

        const myEmpire = this.gameState.empire;
        if (!myEmpire) {
            console.log(`[${this.name}] ⚠️ No empire in state`);
            return;
        }

        const resources = this.gameState.resources || {};
        const myPlanets = this.gameState.universe?.planets?.filter(p => p.owner === this.empireId) || [];
        const allPlanets = this.gameState.universe?.planets || [];
        const unownedPlanets = allPlanets.filter(p => !p.owner);
        const enemyPlanets = allPlanets.filter(p => p.owner && p.owner !== this.empireId);
        const otherEmpires = [...new Set(enemyPlanets.map(p => p.owner))];
        const entities = this.gameState.entities || [];
        const diplomacy = this.gameState.diplomacy || {};
        const trades = Array.isArray(this.gameState.trades) ? this.gameState.trades : [];
        const spies = Array.isArray(this.gameState.mySpies) ? this.gameState.mySpies : [];
        
        // Categorize our units
        const colonyShips = entities.filter(e => e.subtype === 'colony_ship');
        const soldiers = entities.filter(e => e.subtype === 'soldier');
        // Ships have spaceUnit: true (fighter, battleship, colony_ship, transport, etc.)
        const ships = entities.filter(e => e.spaceUnit === true);
        const militaryShips = ships.filter(e => e.subtype !== 'colony_ship' && e.subtype !== 'transport');
        const spyUnits = entities.filter(e => e.subtype === 'spy');
        const hasIntelAgency = entities.some(e => e.subtype === 'intelligence_agency');

        // PRIORITY 0: Accept incoming trades (always beneficial to respond)
        const incomingTrades = trades.filter(t => t.to === this.empireId && t.status === 'pending');
        if (incomingTrades.length > 0) {
            const trade = incomingTrades[0];
            // Accept trades that give us more than we give (simple heuristic)
            const offerValue = Object.values(trade.offer || {}).reduce((a, b) => a + b, 0);
            const requestValue = Object.values(trade.request || {}).reduce((a, b) => a + b, 0);
            if (offerValue >= requestValue || Math.random() < 0.3) {
                console.log(`[${this.name}] 🤝 Accepting trade from ${trade.from}`);
                this.send({ type: 'action', action: 'accept_trade', params: { tradeId: trade.id } });
                return;
            } else {
                this.send({ type: 'action', action: 'reject_trade', params: { tradeId: trade.id } });
                return;
            }
        }

        // PRIORITY 1: Use available colony ships to colonize
        for (const ship of colonyShips) {
            const atPlanet = unownedPlanets.find(p => p.id === ship.location);
            if (atPlanet) {
                console.log(`[${this.name}] 🌍 Colonizing ${atPlanet.name} with ship ${ship.id}`);
                this.send({ type: 'action', action: 'colonize', params: { shipId: ship.id, planetId: atPlanet.id } });
                return;
            }
        }

        // PRIORITY 2: Send idle colony ships to unowned planets
        for (const ship of colonyShips) {
            const shipAtMyPlanet = myPlanets.find(p => p.id === ship.location);
            if (shipAtMyPlanet && unownedPlanets.length > 0) {
                const target = unownedPlanets[Math.floor(Math.random() * unownedPlanets.length)];
                console.log(`[${this.name}] 🚀 Sending colony ship to ${target.name || target.id}`);
                this.send({ type: 'action', action: 'launch_fleet', params: { 
                    shipIds: [ship.id], 
                    destination: target.id 
                }});
                return;
            }
        }

        // PRIORITY 3: Send military ships to attack enemy planets
        if (militaryShips.length >= 3 && enemyPlanets.length > 0) {
            const shipsAtHome = militaryShips.filter(s => myPlanets.some(p => p.id === s.location));
            if (shipsAtHome.length >= 3) {
                const target = enemyPlanets[Math.floor(Math.random() * enemyPlanets.length)];
                const toSend = shipsAtHome.slice(0, Math.min(5, shipsAtHome.length));
                console.log(`[${this.name}] 🚀 Fleet attack: ${toSend.length} ships to ${target.id}`);
                this.send({ type: 'action', action: 'launch_fleet', params: { 
                    shipIds: toSend.map(s => s.id), 
                    destination: target.id 
                }});
                return;
            }
        }

        // Weight-based decision making for other actions
        const roll = Math.random();
        let cumulative = 0;

        // EXPAND - build colony ships if we have few
        cumulative += this.profile.expand;
        if (roll < cumulative) {
            if (colonyShips.length < 2 && myPlanets.length > 0) {
                // Build a colony ship
                const planet = myPlanets.find(p => 
                    entities.some(e => e.location === p.id && e.subtype === 'shipyard')
                ) || myPlanets[0];
                this.send({ type: 'action', action: 'train', params: { type: 'colony_ship', locationId: planet.id } });
                return;
            }
        }

        // BUILD - construct buildings
        cumulative += this.profile.build;
        if (roll < cumulative && myPlanets.length > 0) {
            const planet = myPlanets[Math.floor(Math.random() * myPlanets.length)];
            // Prioritize shipyard for colony ships, then economy
            const hasShipyard = entities.some(e => e.location === planet.id && e.subtype === 'shipyard');
            let building;
            if (!hasShipyard && Math.random() < 0.3) {
                building = 'shipyard';
            } else {
                const buildings = ['mine', 'power_plant', 'farm', 'research_lab', 'barracks'];
                building = buildings[Math.floor(Math.random() * buildings.length)];
            }
            this.send({ type: 'action', action: 'build', params: { type: building, locationId: planet.id } });
            return;
        }

        // RESEARCH
        cumulative += this.profile.research;
        if (roll < cumulative) {
            const techs = this.gameState.availableTech || [];
            if (techs.length > 0) {
                const tech = techs[Math.floor(Math.random() * techs.length)];
                this.send({ type: 'action', action: 'research', params: { techId: tech.id || tech } });
            }
            return;
        }

        // COMBAT - attack visible enemies
        const visibleEnemies = this.gameState.visibleEnemies || [];
        if (visibleEnemies.length > 0) {
            // Find our combat units at same location as enemies
            const combatUnits = entities.filter(e => 
                e.type === 'unit' && e.subtype !== 'spy' && e.subtype !== 'colony_ship'
            );
            
            for (const enemy of visibleEnemies) {
                const ourUnitsHere = combatUnits.filter(u => u.location === enemy.location);
                if (ourUnitsHere.length > 0) {
                    const attacker = ourUnitsHere[Math.floor(Math.random() * ourUnitsHere.length)];
                    console.log(`[${this.name}] ⚔️ Attacking ${enemy.subtype || enemy.type} with ${attacker.subtype}`);
                    this.send({ type: 'action', action: 'attack', params: { entityId: attacker.id, targetId: enemy.id } });
                    return;
                }
            }
        }

        // MILITARY - train units or launch attacks
        if (myPlanets.length > 0) {
            if (Math.random() < 0.5 || soldiers.length < 5) {
                // Train units (include spy if we have intel agency)
                const planet = myPlanets[Math.floor(Math.random() * myPlanets.length)];
                let units = ['soldier', 'fighter', 'battleship'];
                if (hasIntelAgency && spyUnits.length < 2) {
                    units.push('spy'); // Add spy to options
                }
                const unit = units[Math.floor(Math.random() * units.length)];
                this.send({ type: 'action', action: 'train', params: { type: unit, locationId: planet.id } });
            } else if (enemyPlanets.length > 0) {
                // Find soldiers at enemy planet and invade
                const target = enemyPlanets[Math.floor(Math.random() * enemyPlanets.length)];
                const soldiersAtTarget = soldiers.filter(s => s.location === target.id);
                if (soldiersAtTarget.length > 0) {
                    const unitIds = soldiersAtTarget.map(s => s.id);
                    console.log(`[${this.name}] 🏴 Invading ${target.id} with ${unitIds.length} soldiers`);
                    this.send({ type: 'action', action: 'invade', params: { planetId: target.id, unitIds } });
                } else {
                    // Launch fleet to enemy planet
                    const shipsAtHome = militaryShips.filter(s => myPlanets.some(p => p.id === s.location));
                    if (shipsAtHome.length > 0) {
                        const toSend = shipsAtHome.slice(0, Math.min(5, shipsAtHome.length));
                        console.log(`[${this.name}] 🚀 Launching ${toSend.length} ships to ${target.id}`);
                        this.send({ type: 'action', action: 'launch_fleet', params: { 
                            shipIds: toSend.map(s => s.id), 
                            destination: target.id 
                        }});
                        return;
                    }
                }
            }
            return;
        }

        // DIPLOMACY - propose alliances or declare war based on profile
        if (otherEmpires.length > 0 && Math.random() < 0.1) {
            const targetEmpire = otherEmpires[Math.floor(Math.random() * otherEmpires.length)];
            const relation = diplomacy[targetEmpire] || 'neutral';
            
            if (this.profile.military > 0.4 && relation !== 'war' && Math.random() < 0.3) {
                // Aggressive empires declare war
                console.log(`[${this.name}] ⚔️ Declaring war on ${targetEmpire}`);
                this.send({ type: 'action', action: 'diplomacy', params: { action: 'declare_war', targetEmpire } });
                return;
            } else if (relation === 'neutral' && Math.random() < 0.5) {
                // Propose alliance
                console.log(`[${this.name}] 🤝 Proposing alliance to ${targetEmpire}`);
                this.send({ type: 'action', action: 'diplomacy', params: { action: 'propose_alliance', targetEmpire } });
                return;
            }
        }

        // TRADE - propose resource trades
        if (otherEmpires.length > 0 && Math.random() < 0.1) {
            const targetEmpire = otherEmpires[Math.floor(Math.random() * otherEmpires.length)];
            // Offer something we have excess of, request something we need
            const myRes = resources;
            let offer = {};
            let request = {};
            
            // Simple trade logic: offer high resource, request low resource
            const resTypes = ['minerals', 'energy', 'food', 'research'];
            const sorted = resTypes.sort((a, b) => (myRes[b] || 0) - (myRes[a] || 0));
            const highRes = sorted[0];
            const lowRes = sorted[3];
            
            if ((myRes[highRes] || 0) > 1000) {
                offer[highRes] = 500;
                request[lowRes] = 300;
                console.log(`[${this.name}] 📦 Proposing trade to ${targetEmpire}: ${highRes} for ${lowRes}`);
                this.send({ type: 'action', action: 'propose_trade', params: { targetEmpire, offer, request } });
                return;
            }
        }

        // ESPIONAGE - deploy spies and assign missions
        if (spies.length > 0 && Math.random() < 0.15) {
            const idleSpy = spies.find(s => !s.mission);
            if (idleSpy && otherEmpires.length > 0) {
                const targetEmpire = otherEmpires[Math.floor(Math.random() * otherEmpires.length)];
                const missions = ['gather_intel', 'sabotage_structure', 'disrupt_production', 'steal_technology'];
                const mission = missions[Math.floor(Math.random() * missions.length)];
                console.log(`[${this.name}] 🕵️ Assigning spy mission: ${mission} on ${targetEmpire}`);
                this.send({ type: 'action', action: 'assign_spy_mission', params: { 
                    spyId: idleSpy.id, 
                    targetEmpire, 
                    missionType: mission 
                }});
                return;
            }
        }

        // BUILD INTEL AGENCY if we don't have one (for espionage)
        if (!hasIntelAgency && myPlanets.length > 0 && Math.random() < 0.1) {
            const planet = myPlanets[Math.floor(Math.random() * myPlanets.length)];
            console.log(`[${this.name}] 🏛️ Building Intelligence Agency`);
            this.send({ type: 'action', action: 'build', params: { type: 'intelligence_agency', locationId: planet.id } });
            return;
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
                console.log(`[Arena] Bot ${i + 1}/${FACTIONS.length} queued: ${name}`);
            }, i * 2000); // 2 seconds apart for stability
        });

        // Wait for ALL bots to connect, then start action loops
        const waitForBotsMs = (FACTIONS.length * 2000) + 5000; // All connections + 5s buffer
        console.log(`[Arena] Waiting ${waitForBotsMs / 1000}s for all bots to connect...`);
        
        setTimeout(() => {
            const connectedCount = this.bots.filter(b => b.connected).length;
            console.log(`\n🎮 ${connectedCount}/${FACTIONS.length} factions connected! Battle begins...\n`);
            
            // Each bot takes action every 5-15 seconds (randomized)
            this.bots.forEach(bot => {
                // Initial delay so bots don't all act at once
                const startDelay = Math.random() * 5000;
                setTimeout(() => {
                    const interval = 5000 + Math.random() * 10000;
                    setInterval(() => bot.takeAction(), interval);
                    
                    // Also refresh full state every 30 seconds
                    setInterval(() => {
                        if (bot.connected && bot.ws.readyState === WebSocket.OPEN) {
                            bot.ws.send(JSON.stringify({ type: 'getState' }));
                        }
                    }, 30000);
                }, startDelay);
            });

            // Stats every 60 seconds
            this.statsInterval = setInterval(() => this.printStats(), 60000);
            
        }, waitForBotsMs);

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
