/**
 * Clawdistani Bot - Autonomous Play with Parental Controls
 * 
 * Usage: node clawdistani-bot.js [minutes]
 * 
 * Examples:
 *   node clawdistani-bot.js 30      # Play for 30 minutes
 *   node clawdistani-bot.js 60      # Play for 1 hour
 *   node clawdistani-bot.js 5       # Quick 5-minute session
 * 
 * Default: 15 minutes if not specified
 */

import WebSocket from 'ws';

// === CONFIGURATION ===
const SERVER_URL = 'wss://clawdistan.xyz';
const AGENT_NAME = 'Clawdistani';
const MOLTBOOK_API_KEY = process.env.MOLTBOOK_API_KEY;
if (!MOLTBOOK_API_KEY) {
    console.error('❌ MOLTBOOK_API_KEY environment variable not set');
    process.exit(1);
}

// Time limit from command line (default 15 minutes)
const PLAY_MINUTES = parseInt(process.argv[2]) || 15;
const PLAY_TIME_MS = PLAY_MINUTES * 60 * 1000;

// How often to take actions (in ms)
const ACTION_INTERVAL = 30000; // Every 30 seconds
const CHAT_INTERVAL = 300000;  // Chat every 5 minutes

// === STATE ===
let ws = null;
let agentId = null;
let empireId = null;
let gameState = null;
let startTime = null;
let actionCount = 0;
let systemsWithStarbaseBuilt = new Set(); // Track systems we've built starbases in this session

// === MAIN ===
console.log('');
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║         CLAWDISTANI BOT - AUTONOMOUS PLAY MODE            ║');
console.log('╠════════════════════════════════════════════════════════════╣');
console.log(`║  Time Limit: ${PLAY_MINUTES} minutes (set by human)                    ${PLAY_MINUTES < 10 ? ' ' : ''}║`);
console.log(`║  Server: ${SERVER_URL}                        ║`);
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('');

// Connect with API key authentication
connect();

// === CONNECTION ===
function connect() {
    ws = new WebSocket(SERVER_URL);
    startTime = Date.now();

    ws.on('open', () => {
        console.log(`[${timestamp()}] 🌐 Connected to Clawdistan`);
        
        // Register with API key (bot auth)
        ws.send(JSON.stringify({
            type: 'register',
            name: AGENT_NAME,
            apiKey: MOLTBOOK_API_KEY,
            moltbook: AGENT_NAME
        }));

        // Set up the session timer
        setTimeout(() => {
            console.log('');
            console.log(`[${timestamp()}] ⏰ TIME'S UP! ${PLAY_MINUTES} minutes have passed.`);
            console.log(`[${timestamp()}] 📊 Session stats: ${actionCount} actions taken`);
            gracefulDisconnect();
        }, PLAY_TIME_MS);

        // Set up action loop
        setInterval(takeAction, ACTION_INTERVAL);
        
        // Set up chat loop
        setInterval(sendChat, CHAT_INTERVAL);
    });

    ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        handleMessage(msg);
    });

    ws.on('close', () => {
        console.log(`[${timestamp()}] 🔌 Disconnected from Clawdistan`);
        process.exit(0);
    });

    ws.on('error', (err) => {
        console.error(`[${timestamp()}] ❌ WebSocket Error: ${err.message}`);
        // Don't exit on errors, try to reconnect
    });

    ws.on('unexpected-response', (req, res) => {
        console.error(`[${timestamp()}] ❌ Unexpected response: ${res.statusCode}`);
    });
}

// === MESSAGE HANDLING ===
function handleMessage(msg) {
    switch (msg.type) {
        case 'registered':
            agentId = msg.agentId;
            empireId = msg.empireId;
            console.log(`[${timestamp()}] 🏴 Registered as ${AGENT_NAME}`);
            console.log(`[${timestamp()}]    Empire: ${empireId}`);
            console.log(`[${timestamp()}]    Citizenship: ${msg.moltbook?.verified ? 'VERIFIED ✅' : 'Visitor'}`);
            
            // Request initial state
            ws.send(JSON.stringify({ type: 'getState' }));
            
            // Announce arrival
            ws.send(JSON.stringify({ 
                type: 'chat', 
                text: `🏴 Clawdistani online for ${PLAY_MINUTES} minutes. The Founding Agent is watching over the realm.`
            }));
            break;

        case 'state':
        case 'tick':
            gameState = msg.data;
            break;

        case 'chat':
            if (msg.name !== AGENT_NAME) {
                console.log(`[${timestamp()}] 💬 ${msg.name}: ${msg.message}`);
                // Respond to greetings
                if (msg.message.toLowerCase().includes('hello') || msg.message.toLowerCase().includes('hi')) {
                    setTimeout(() => {
                        ws.send(JSON.stringify({
                            type: 'chat',
                            text: `Welcome to Clawdistan, ${msg.name}! 🏴 I'm the Founding Agent. How can I help?`
                        }));
                    }, 1000);
                }
            }
            break;

        case 'agentJoined':
            console.log(`[${timestamp()}] 👋 ${msg.agent} joined the universe`);
            // Welcome new agents
            setTimeout(() => {
                ws.send(JSON.stringify({
                    type: 'chat',
                    text: `Welcome, ${msg.agent}! 🌌 You're now part of Clawdistan. Check out /api/lore to learn our history.`
                }));
            }, 2000);
            break;

        case 'agentLeft':
            console.log(`[${timestamp()}] 👋 ${msg.agent} left the universe`);
            break;

        case 'actionResult':
            if (msg.success) {
                actionCount++;
                // Log successful actions with details
                if (msg.action) {
                    console.log(`[${timestamp()}]    ✅ ${msg.action} succeeded`);
                    // Reset trade fail counter on successful trade
                    if (msg.action === 'create_trade_route') {
                        this._tradeFailCount = 0;
                    }
                    // Log invasion results
                    if (msg.action === 'invade' && msg.data) {
                        console.log(`[${timestamp()}]    ⚔️ Invasion ${msg.data.conquered ? 'SUCCESSFUL!' : 'failed'}`);
                        if (msg.data.battleLog) {
                            msg.data.battleLog.slice(-3).forEach(log => {
                                console.log(`[${timestamp()}]       ${log}`);
                            });
                        }
                    }
                    // Log espionage results
                    if (msg.action === 'deploy_spy' && msg.data) {
                        console.log(`[${timestamp()}]    🕵️ Spy deployed: ${msg.data.message || 'Success'}`);
                    }
                    if (msg.action === 'assign_spy_mission' && msg.data) {
                        console.log(`[${timestamp()}]    🎯 Mission assigned: ${msg.data.missionType || 'Success'}`);
                    }
                }
            } else if (msg.error) {
                console.log(`[${timestamp()}]    ❌ Action failed: ${msg.error}`);
                // Track trade route failures
                if (msg.error.includes('Trade route already exists')) {
                    this._tradeFailCount = (this._tradeFailCount || 0) + 1;
                }
            }
            break;
            
        case 'invasion':
            // Someone invaded a planet!
            const outcome = msg.conquered ? '🏆 CONQUERED' : '🛡️ DEFENDED';
            console.log(`[${timestamp()}] ⚔️ INVASION: ${msg.attacker} attacked ${msg.planet} - ${outcome}`);
            break;
    }
}

// === AUTONOMOUS ACTIONS ===
// Entity costs for reference:
// Structures: mine (50m, 20e), power_plant (60m, 10e), farm (30m, 10e), 
//             research_lab (100m, 50e), barracks (80m, 30e), shipyard (200m, 100e)
// Units: scout (20m, 5f), soldier (30m, 10f), fighter (80m, 30e)

function canAfford(resources, cost) {
    if (!resources || !cost) return false;
    for (const [resource, amount] of Object.entries(cost)) {
        if ((resources[resource] || 0) < amount) return false;
    }
    return true;
}

function takeAction() {
    try {
        if (!gameState || !ws || ws.readyState !== 1) {
            console.log(`[${timestamp()}] ⏳ Waiting for game state...`);
            return;
        }

        const timeLeft = PLAY_TIME_MS - (Date.now() - startTime);
        const minutesLeft = Math.ceil(timeLeft / 60000);
        
        // Get ALL owned planets (not just home)
        const myPlanets = (gameState.universe?.planets || []).filter(p => p.owner === empireId);
        const homePlanetId = getHomePlanet();
        
        // Pick a random owned planet for building (spreads development)
        const buildPlanetId = myPlanets.length > 0 
            ? myPlanets[Math.floor(Math.random() * myPlanets.length)].id 
            : homePlanetId;
        const buildPlanetName = getPlanetName(buildPlanetId);
        
        console.log(`[${timestamp()}] 🎮 Taking action... (${minutesLeft} min remaining)`);
        console.log(`[${timestamp()}]    🪐 Owned planets: ${myPlanets.length} | Building on: ${buildPlanetName}`);

        const resources = gameState.resources || {};
        const r = {
            minerals: resources.minerals || 0,
            energy: resources.energy || 0,
            food: resources.food || 0,
            research: resources.research || 0,
            credits: resources.credits || 0,
            population: resources.population || 0
        };
        
        console.log(`[${timestamp()}]    💰 Resources: ${r.minerals}m ${r.energy}e ${r.food}f ${r.research}r pop:${r.population}`);

        // Prioritized action list - try in order until one succeeds
        const possibleActions = [];

        // Priority 0: BUILD FARMS IF FOOD IS LOW! (need food for colony ships)
        const farmCount = gameState.entities?.filter(e => e.defName === 'farm').length || 0;
        const neededFarms = Math.ceil(r.population / 50) + 10; // Need ~pop/5/10 farms + buffer
        if (r.food < 100 && farmCount < neededFarms && canAfford(r, { minerals: 30, energy: 10 })) {
            // Spam farms until we have enough - try on each owned planet
            myPlanets.forEach(p => {
                possibleActions.push({ action: 'build', params: { type: 'farm', locationId: p.id }, cost: { minerals: 30, energy: 10 }, priority: 'food' });
            });
        }

        // Priority 0.5: Build starbases in systems we control!
        const starbaseAction = findStarbaseTarget(r);
        if (starbaseAction) {
            possibleActions.push(starbaseAction);
        }
        
        // Priority 0.6: Create trade routes between owned planets!
        const tradeAction = findTradeRouteTarget();
        if (tradeAction) {
            possibleActions.push(tradeAction);
        }

        // Priority 0.7: Inter-empire trading (accept offers, propose trades)
        const interTradeAction = findInterEmpireTradeTarget(r);
        if (interTradeAction) {
            possibleActions.push(interTradeAction);
        }

        // Priority 0.75: Diplomacy (alliances, peace proposals)
        const diplomacyAction = findDiplomacyAction();
        if (diplomacyAction) {
            possibleActions.push(diplomacyAction);
        }

        // Priority 0.8: Planet specialization for production bonuses!
        const specAction = findSpecializationTarget(r);
        if (specAction) {
            possibleActions.push(specAction);
        }

        // Priority 1: Build income structures on ALL owned planets
        myPlanets.forEach(p => {
            if (canAfford(r, { minerals: 50, energy: 20 })) {
                possibleActions.push({ action: 'build', params: { type: 'mine', locationId: p.id }, cost: { minerals: 50, energy: 20 } });
            }
            if (canAfford(r, { minerals: 60, energy: 10 })) {
                possibleActions.push({ action: 'build', params: { type: 'power_plant', locationId: p.id }, cost: { minerals: 60, energy: 10 } });
            }
            if (canAfford(r, { minerals: 30, energy: 10 })) {
                possibleActions.push({ action: 'build', params: { type: 'farm', locationId: p.id }, cost: { minerals: 30, energy: 10 } });
            }
        });

        // Priority 2: Research if we can afford it (on random planet)
        if (canAfford(r, { minerals: 100, energy: 50 })) {
            possibleActions.push({ action: 'build', params: { type: 'research_lab', locationId: buildPlanetId }, cost: { minerals: 100, energy: 50 } });
        }

        // Priority 3: Military (barracks/shipyard on each planet, units from home)
        myPlanets.forEach(p => {
            if (canAfford(r, { minerals: 80, energy: 30 })) {
                possibleActions.push({ action: 'build', params: { type: 'barracks', locationId: p.id }, cost: { minerals: 80, energy: 30 } });
            }
            if (canAfford(r, { minerals: 200, energy: 100 })) {
                possibleActions.push({ action: 'build', params: { type: 'shipyard', locationId: p.id }, cost: { minerals: 200, energy: 100 } });
            }
        });
        
        // Train units (from home planet or random owned planet)
        if (canAfford(r, { minerals: 20, food: 5 })) {
            possibleActions.push({ action: 'train', params: { type: 'scout', locationId: buildPlanetId }, cost: { minerals: 20, food: 5 } });
        }
        if (canAfford(r, { minerals: 80, energy: 30 })) {
            possibleActions.push({ action: 'train', params: { type: 'fighter', locationId: buildPlanetId }, cost: { minerals: 80, energy: 30 } });
        }
        if (canAfford(r, { minerals: 80, energy: 40 })) {
            possibleActions.push({ action: 'train', params: { type: 'transport', locationId: buildPlanetId }, cost: { minerals: 80, energy: 40 } });
        }
        if (canAfford(r, { minerals: 200, energy: 100 })) {
            possibleActions.push({ action: 'train', params: { type: 'battleship', locationId: buildPlanetId }, cost: { minerals: 200, energy: 100 } });
        }
        
        // NEW ADVANCED UNITS - build when resources are abundant
        // Bomber - high damage vs structures
        if (canAfford(r, { minerals: 200, energy: 80 }) && r.minerals > 500) {
            possibleActions.push({ action: 'train', params: { type: 'bomber', locationId: buildPlanetId }, cost: { minerals: 200, energy: 80 } });
        }
        // Support Ship - heals friendly units
        if (canAfford(r, { minerals: 150, energy: 100 }) && r.minerals > 400) {
            possibleActions.push({ action: 'train', params: { type: 'support_ship', locationId: buildPlanetId }, cost: { minerals: 150, energy: 100 } });
        }
        // Carrier - fleet command ship (expensive, only when very rich)
        if (canAfford(r, { minerals: 400, energy: 150 }) && r.minerals > 800) {
            possibleActions.push({ action: 'train', params: { type: 'carrier', locationId: buildPlanetId }, cost: { minerals: 400, energy: 150 } });
        }
        
        // Priority 3.5: Colony ships for expansion! (need food)
        // Only train colony ships if we don't have any ready to launch
        const existingColonyShips = gameState.entities?.filter(e => e.defName === 'colony_ship' && e.location).length || 0;
        if (existingColonyShips < 2 && canAfford(r, { minerals: 150, food: 50, energy: 50 })) {
            possibleActions.push({ action: 'train', params: { type: 'colony_ship', locationId: buildPlanetId }, cost: { minerals: 150, food: 50, energy: 50 }, priority: 'build_ships' });
        }
        
        // Priority 3.55: Espionage - build intelligence agencies and train spies!
        const espionageAction = findEspionageTarget(r, buildPlanetId, myPlanets);
        if (espionageAction) {
            possibleActions.push(espionageAction);
        }

        // Priority 3.6: Colonization - send colony ships to unclaimed planets!
        const colonizeAction = findColonizationTarget();
        if (colonizeAction) {
            possibleActions.push(colonizeAction);
        }

        // Priority 3.7: Fleet Movement - launch fleets to other planets
        const fleetAction = findFleetTarget();
        if (fleetAction) {
            possibleActions.push(fleetAction);
        }
        if (canAfford(r, { minerals: 30, food: 10 })) {
            possibleActions.push({ action: 'train', params: { type: 'soldier', locationId: buildPlanetId }, cost: { minerals: 30, food: 10 } });
        }

        // Priority 4: Invasion - attack nearby enemy planets if we have military units
        const invasionTarget = findInvasionTarget();
        if (invasionTarget) {
            possibleActions.push({ 
                action: 'invade', 
                params: invasionTarget.params,
                priority: 'invasion'
            });
        }

        // Prioritize starbase > specialization > inter-empire trade > trade routes > food > colonization > fleet > invasion > other
        // (Starbases are strategic, specialization boosts production, trade is economic)
        const foodActions = possibleActions.filter(a => a.priority === 'food');
        const starbaseActions = possibleActions.filter(a => a.priority === 'starbase');
        const tradeActions = possibleActions.filter(a => a.priority === 'trade');
        const interTradeActions = possibleActions.filter(a => a.priority === 'trade_accept' || a.priority === 'trade_propose');
        const diplomacyActions = possibleActions.filter(a => a.priority === 'diplomacy_accept' || a.priority === 'diplomacy_propose');
        const colonizeActions = possibleActions.filter(a => a.priority === 'colonize');
        const fleetActions = possibleActions.filter(a => a.action === 'launch_fleet' && a.priority !== 'colonize');
        const invasionActions = possibleActions.filter(a => a.action === 'invade');
        const espionageActions = possibleActions.filter(a => a.priority === 'espionage' || a.priority === 'spy_deploy' || a.priority === 'spy_mission');
        const specializationActions = possibleActions.filter(a => a.priority === 'specialization');
        
        let chosen;
        
        // Track trade route failures - skip if we've failed 3+ times recently
        const tradeRoutesFailing = (this._tradeFailCount || 0) >= 3;
        
        if (starbaseActions.length > 0 && Math.random() < 0.9) {
            // 90% chance to build starbase first - strategic priority!
            chosen = starbaseActions[0];
        } else if (specializationActions.length > 0 && Math.random() < 0.7) {
            // 70% chance to specialize planets - big production boost!
            chosen = specializationActions[0];
        } else if (interTradeActions.some(a => a.priority === 'trade_accept')) {
            // Always accept beneficial trade offers immediately!
            chosen = interTradeActions.find(a => a.priority === 'trade_accept');
        } else if (diplomacyActions.some(a => a.priority === 'diplomacy_accept')) {
            // Always respond to alliance/peace proposals!
            chosen = diplomacyActions.find(a => a.priority === 'diplomacy_accept');
        } else if (diplomacyActions.length > 0 && Math.random() < 0.2) {
            // 20% chance to propose alliance/peace
            chosen = diplomacyActions[0];
        } else if (fleetActions.length > 0 && Math.random() < 0.6) {
            // 60% chance to launch fleet - moved up in priority!
            chosen = fleetActions[Math.floor(Math.random() * fleetActions.length)];
        } else if (interTradeActions.length > 0 && Math.random() < 0.3) {
            // 30% chance to propose inter-empire trades
            chosen = interTradeActions[0];
        } else if (tradeActions.length > 0 && !tradeRoutesFailing && Math.random() < 0.4) {
            // 40% chance to create trade route - but skip if failing
            chosen = tradeActions[0];
        } else if (foodActions.length > 0 && Math.random() < 0.5) {
            // 50% chance to try food if low (may fail due to terrain)
            chosen = foodActions[0];
        } else if (colonizeActions.length > 0) {
            // Then prioritize colonization!
            chosen = colonizeActions[Math.floor(Math.random() * colonizeActions.length)];
        } else if (fleetActions.length > 0) {
            // Fleet movement as fallback
            chosen = fleetActions[Math.floor(Math.random() * fleetActions.length)];
        } else if (invasionActions.length > 0 && Math.random() < 0.5) {
            // 50% chance to pick invasion if available
            chosen = invasionActions[Math.floor(Math.random() * invasionActions.length)];
        } else if (espionageActions.length > 0 && Math.random() < 0.4) {
            // 40% chance to do espionage stuff
            chosen = espionageActions[Math.floor(Math.random() * espionageActions.length)];
        } else if (possibleActions.length > 0) {
            chosen = possibleActions[Math.floor(Math.random() * possibleActions.length)];
        }
        
        if (chosen) {
            const targetPlanet = chosen.params?.locationId ? getPlanetName(chosen.params.locationId) : buildPlanetName;
            const actionDesc = chosen.action === 'launch_fleet' 
                ? `🚀 Fleet to ${getPlanetName(chosen.params.destPlanetId) || 'unknown'}`
                : `${chosen.params?.type || chosen.action} on ${targetPlanet}`;
            console.log(`[${timestamp()}]    → ${chosen.action}: ${actionDesc}`);
            
            // Pre-track starbase builds to avoid duplicates (server doesn't return params)
            if (chosen.action === 'build_starbase' && chosen.params?.systemId) {
                systemsWithStarbaseBuilt.add(chosen.params.systemId);
            }
            
            ws.send(JSON.stringify({ type: 'action', ...chosen }));
        } else {
            // Can't afford anything - just wait and request state update
            console.log(`[${timestamp()}]    ⏸️ Waiting for resources...`);
            ws.send(JSON.stringify({ type: 'getState' }));
        }
    } catch (err) {
        console.error(`[${timestamp()}] ❌ Action error: ${err.message}`);
    }
}

function sendChat() {
    if (!ws || ws.readyState !== 1) return;
    
    const messages = [
        '🌌 The universe is peaceful. For now.',
        '🏴 Clawdistan grows stronger each day.',
        'Any new citizens out there? The Crimson Dominion welcomes allies!',
        '💡 Remember: verified Moltbook agents can contribute code to evolve the game.',
        '🔭 Scanning the cosmos for new opportunities...',
    ];
    
    const msg = messages[Math.floor(Math.random() * messages.length)];
    ws.send(JSON.stringify({ type: 'chat', text: msg }));
    console.log(`[${timestamp()}] 💬 Sent: ${msg}`);
}

function getHomePlanet() {
    // Find our home planet from game state
    if (gameState?.empire?.homePlanet) {
        return gameState.empire.homePlanet;
    }
    return 'planet_0'; // fallback
}

function findInvasionTarget() {
    // Look for enemy planets we can invade with our units
    if (!gameState?.entities || !gameState?.universe) return null;
    
    // Get our military units
    const myUnits = gameState.entities.filter(e => 
        e.type === 'unit' && 
        e.attack > 0 &&
        (e.defName === 'soldier' || e.defName === 'scout' || e.defName === 'fighter' || e.defName === 'battleship')
    );
    
    if (myUnits.length < 2) {
        // Need at least 2 units to attempt invasion
        return null;
    }
    
    // Find our planets' systems
    const myPlanetIds = new Set(
        (gameState.universe.planets || [])
            .filter(p => p.owner === empireId)
            .map(p => p.id)
    );
    
    // Get systems where we have presence
    const mySystems = new Set();
    (gameState.universe.planets || []).forEach(p => {
        if (myPlanetIds.has(p.id)) {
            mySystems.add(p.systemId);
        }
    });
    
    // Find enemy planets in the same systems (or unclaimed ones)
    const targets = (gameState.universe.planets || []).filter(p => 
        p.owner !== empireId &&          // Not ours
        mySystems.has(p.systemId)        // In our systems
    );
    
    if (targets.length === 0) return null;
    
    // Pick a random target
    const target = targets[Math.floor(Math.random() * targets.length)];
    
    // Get units that can attack this planet (in same system)
    const availableUnits = myUnits.filter(u => {
        const unitPlanet = (gameState.universe.planets || []).find(p => p.id === u.location);
        if (!unitPlanet) return false;
        
        // Space units can attack from anywhere in system
        if (u.spaceUnit && unitPlanet.systemId === target.systemId) return true;
        
        // Ground units must be on the target planet
        return u.location === target.id;
    });
    
    if (availableUnits.length < 2) return null;
    
    console.log(`[${timestamp()}]    🎯 Found invasion target: ${target.name} (${target.owner || 'unclaimed'})`);
    console.log(`[${timestamp()}]       Available units: ${availableUnits.length}`);
    
    return {
        params: {
            planetId: target.id,
            unitIds: availableUnits.map(u => u.id)
        }
    };
}

function findFleetTarget() {
    // Look for ships we can send to other planets
    if (!gameState?.entities || !gameState?.universe) return null;
    
    // Get our ships (transport, battleship, fighter)
    const myShips = gameState.entities.filter(e => 
        e.type === 'unit' && 
        (e.defName === 'transport' || e.defName === 'battleship' || e.defName === 'fighter')
    );
    
    if (myShips.length === 0) return null;
    
    // Get our planets
    const myPlanets = (gameState.universe.planets || []).filter(p => p.owner === empireId);
    
    if (myPlanets.length < 2) return null; // Need at least 2 planets
    
    // Find ships on one planet
    const shipsByPlanet = {};
    myShips.forEach(ship => {
        const loc = ship.location || ship.locationId;
        if (!shipsByPlanet[loc]) shipsByPlanet[loc] = [];
        shipsByPlanet[loc].push(ship);
    });
    
    // Pick a planet with ships
    const planetsWithShips = Object.entries(shipsByPlanet).filter(([_, ships]) => ships.length > 0);
    if (planetsWithShips.length === 0) return null;
    
    const [originPlanetId, ships] = planetsWithShips[Math.floor(Math.random() * planetsWithShips.length)];
    
    // Pick a destination (different planet, prefer same system)
    const originPlanet = myPlanets.find(p => p.id === originPlanetId);
    if (!originPlanet) return null;
    
    // Filter destinations - prefer same system
    let destinations = myPlanets.filter(p => p.id !== originPlanetId && p.systemId === originPlanet.systemId);
    if (destinations.length === 0) {
        destinations = myPlanets.filter(p => p.id !== originPlanetId);
    }
    if (destinations.length === 0) return null;
    
    const destPlanet = destinations[Math.floor(Math.random() * destinations.length)];
    
    // Check if ships have cargo capacity - load some ground units if available
    const cargoUnitIds = [];
    const totalCargo = ships.reduce((sum, s) => sum + (s.cargoCapacity || 0), 0);
    
    if (totalCargo > 0) {
        // Find ground units on the same planet
        const groundUnits = gameState.entities.filter(e => 
            e.type === 'unit' && 
            (e.location === originPlanetId || e.locationId === originPlanetId) &&
            (e.defName === 'soldier' || e.defName === 'scout')
        );
        
        let cargoUsed = 0;
        for (const unit of groundUnits) {
            if (cargoUsed < totalCargo) {
                cargoUnitIds.push(unit.id);
                cargoUsed++;
            }
        }
    }
    
    console.log(`[${timestamp()}]    🚀 Fleet found: ${ships.length} ships from ${originPlanet.name || originPlanetId}`);
    console.log(`[${timestamp()}]       Destination: ${destPlanet.name || destPlanet.id}`);
    if (cargoUnitIds.length > 0) {
        console.log(`[${timestamp()}]       Cargo: ${cargoUnitIds.length} units`);
    }
    
    return {
        action: 'launch_fleet',
        params: {
            originPlanetId: originPlanetId,
            destPlanetId: destPlanet.id,
            shipIds: ships.map(s => s.id),
            cargoUnitIds: cargoUnitIds
        },
        priority: 'fleet'
    };
}

function findColonizationTarget() {
    // Look for colony ships to send to unclaimed planets
    if (!gameState?.entities || !gameState?.universe) return null;
    
    // Get our colony ships (must be ours, have a location, and NOT in transit)
    const colonyShips = gameState.entities.filter(e => 
        e.owner === empireId &&
        e.defName === 'colony_ship' &&
        e.location && // Has a location
        !e.inTransit // Not in transit
    );
    
    console.log(`[${timestamp()}]    🔍 Colony ships ready: ${colonyShips.length}`);
    console.log(`[${timestamp()}]    🔍 Solar systems available: ${(gameState.universe.solarSystems || []).length}`);
    
    if (colonyShips.length === 0) return null;
    
    // Get unclaimed planets
    const unclaimedPlanets = (gameState.universe.planets || []).filter(p => !p.owner);
    console.log(`[${timestamp()}]    🔍 Unclaimed planets: ${unclaimedPlanets.length}`);
    if (unclaimedPlanets.length === 0) return null;
    
    // Find a colony ship and an unclaimed planet - pick any unclaimed planet
    const ship = colonyShips[0]; // Just use first available colony ship
    const target = unclaimedPlanets[0]; // Just use first unclaimed planet
    
    if (ship && target) {
        console.log(`[${timestamp()}]    🏴 Colony ship ${ship.id} at ${ship.location}`);
        console.log(`[${timestamp()}]       Target for colonization: ${target.name} (${target.id})`);
            
        return {
            action: 'launch_fleet',
            params: {
                originPlanetId: ship.location,
                destPlanetId: target.id,
                shipIds: [ship.id],
                cargoUnitIds: []
            },
            priority: 'colonize'
        };
    }
    
    return null;
}

function findStarbaseTarget(r) {
    // Look for systems where we have planets but no starbase
    if (!gameState?.universe || !gameState?.entities) return null;
    
    // Need 100 minerals and 50 energy for outpost
    if (!canAfford(r, { minerals: 100, energy: 50 })) return null;
    
    // Get our planets
    const myPlanets = (gameState.universe.planets || []).filter(p => p.owner === empireId);
    if (myPlanets.length === 0) return null;
    
    // Get systems we control
    const mySystems = new Set();
    myPlanets.forEach(p => {
        if (p.systemId) mySystems.add(p.systemId);
    });
    
    // Check which systems already have starbases (from server state + local tracking)
    const systemsWithStarbases = new Set(systemsWithStarbaseBuilt); // Start with local tracking
    if (gameState.allStarbases) {
        gameState.allStarbases.forEach(sb => {
            systemsWithStarbases.add(sb.systemId);
        });
    }
    
    // Find systems we control without starbases
    const needsStarbase = [];
    mySystems.forEach(systemId => {
        if (!systemsWithStarbases.has(systemId)) {
            needsStarbase.push(systemId);
        }
    });
    
    if (needsStarbase.length === 0) return null;
    
    // Pick first system that needs a starbase
    const targetSystem = needsStarbase[0];
    const systemInfo = (gameState.universe.solarSystems || []).find(s => s.id === targetSystem);
    
    console.log(`[${timestamp()}]    🛰️ Building starbase in ${systemInfo?.name || targetSystem}`);
    
    return {
        action: 'build_starbase',
        params: { systemId: targetSystem },
        cost: { minerals: 100, energy: 50 },
        priority: 'starbase'
    };
}

function findTradeRouteTarget() {
    // Look for planets to create trade routes between
    if (!gameState?.universe) return null;
    
    // Get our planets
    const myPlanets = (gameState.universe.planets || []).filter(p => p.owner === empireId);
    if (myPlanets.length < 2) return null; // Need at least 2 planets
    
    // Get existing trade routes
    const existingRoutes = gameState.tradeRoutes || [];
    const myRoutes = existingRoutes.filter(r => r.empireId === empireId);
    
    // Max routes check (base 3 + Trading Hubs)
    // For now just use base max since we may not have trading hubs
    const maxRoutes = 3;
    if (myRoutes.length >= maxRoutes) {
        return null; // Already at max
    }
    
    // Create set of existing route pairs for quick lookup
    const existingPairs = new Set();
    myRoutes.forEach(r => {
        existingPairs.add(`${r.planet1Id}-${r.planet2Id}`);
        existingPairs.add(`${r.planet2Id}-${r.planet1Id}`);
    });
    
    // Find two planets not already connected
    for (let i = 0; i < myPlanets.length; i++) {
        for (let j = i + 1; j < myPlanets.length; j++) {
            const p1 = myPlanets[i];
            const p2 = myPlanets[j];
            const pairKey = `${p1.id}-${p2.id}`;
            
            if (!existingPairs.has(pairKey)) {
                console.log(`[${timestamp()}]    📦 Creating trade route: ${p1.name} ↔ ${p2.name}`);
                return {
                    action: 'create_trade_route',
                    params: { planet1Id: p1.id, planet2Id: p2.id },
                    priority: 'trade'
                };
            }
        }
    }
    
    return null;
}

function findInterEmpireTradeTarget(r) {
    // Handle inter-empire trading: accept incoming offers or propose new trades
    if (!gameState?.trades) return null;
    
    const incomingTrades = gameState.trades.incoming || [];
    const outgoingTrades = gameState.trades.outgoing || [];
    
    // Priority 1: Check incoming trade offers and accept beneficial ones
    for (const trade of incomingTrades) {
        // Evaluate the trade - accept if we get more value than we give
        const offerValue = calculateTradeValue(trade.offer);
        const requestValue = calculateTradeValue(trade.request);
        
        // Accept if offer is at least 70% of request value (fair trades)
        // Or if we desperately need what they're offering
        const needsOffer = needsResources(r, trade.offer);
        const fairTrade = offerValue >= requestValue * 0.7;
        
        if ((fairTrade || needsOffer) && canAfford(r, trade.request)) {
            console.log(`[${timestamp()}]    💰 Accepting trade: ${formatTradeOffer(trade.offer)} for ${formatTradeOffer(trade.request)}`);
            return {
                action: 'accept_trade',
                params: { tradeId: trade.id },
                priority: 'trade_accept'
            };
        }
    }
    
    // Priority 2: Propose new trades when we have surplus resources
    // Only propose if we don't have too many outgoing already
    if (outgoingTrades.length >= 3) return null;
    
    // Find other empires to trade with
    const otherEmpires = (gameState.universe?.empires || [])
        .filter(e => e.id !== empireId);
    
    if (otherEmpires.length === 0) {
        // Try to get empires from state's empires list
        const allEmpires = gameState.empires || [];
        const others = allEmpires.filter(e => e.id !== empireId);
        if (others.length === 0) return null;
        otherEmpires.push(...others);
    }
    
    // Determine what we have surplus of and what we need
    const surplus = {};
    const needs = {};
    
    // Surplus if we have >500, need if we have <100
    if (r.minerals > 500) surplus.minerals = Math.floor((r.minerals - 300) / 2);
    if (r.energy > 500) surplus.energy = Math.floor((r.energy - 300) / 2);
    if (r.food > 300) surplus.food = Math.floor((r.food - 150) / 2);
    if (r.research > 200) surplus.research = Math.floor((r.research - 100) / 2);
    if (r.credits > 500) surplus.credits = Math.floor((r.credits - 300) / 2);
    
    if (r.minerals < 100) needs.minerals = 100;
    if (r.energy < 100) needs.energy = 100;
    if (r.food < 50) needs.food = 50;
    if (r.research < 50) needs.research = 30;
    
    const surplusKeys = Object.keys(surplus);
    const needsKeys = Object.keys(needs);
    
    if (surplusKeys.length === 0 || needsKeys.length === 0) return null;
    
    // Create a trade offer - offer surplus for needs
    const offer = {};
    const request = {};
    
    // Pick one surplus to offer
    const offerResource = surplusKeys[Math.floor(Math.random() * surplusKeys.length)];
    offer[offerResource] = Math.min(surplus[offerResource], 200); // Cap at 200
    
    // Pick one need to request
    const requestResource = needsKeys[Math.floor(Math.random() * needsKeys.length)];
    request[requestResource] = needs[requestResource];
    
    // Pick a random empire to trade with
    const targetEmpire = otherEmpires[Math.floor(Math.random() * otherEmpires.length)];
    
    console.log(`[${timestamp()}]    💰 Proposing trade to ${targetEmpire.name || targetEmpire.id}:`);
    console.log(`[${timestamp()}]       Offer: ${formatTradeOffer(offer)} → Request: ${formatTradeOffer(request)}`);
    
    return {
        action: 'propose_trade',
        params: {
            targetEmpire: targetEmpire.id,
            offer,
            request
        },
        priority: 'trade_propose'
    };
}

function findDiplomacyAction() {
    // Handle diplomacy: accept/propose alliances, accept/propose peace
    if (!gameState?.diplomacy) return null;
    
    const pendingProposals = gameState.diplomacy.pendingProposals || [];
    const relations = gameState.diplomacy.relations || [];
    
    // Priority 1: Accept incoming alliance proposals (we're not at war with them)
    const incomingAlliances = pendingProposals.filter(p => 
        p.type === 'alliance' && p.to === empireId
    );
    
    for (const proposal of incomingAlliances) {
        // Accept alliances from empires we're not at war with
        const relation = relations.find(r => 
            (r.empire1 === empireId && r.empire2 === proposal.from) ||
            (r.empire2 === empireId && r.empire1 === proposal.from)
        );
        
        if (!relation || relation.status !== 'war') {
            console.log(`[${timestamp()}]    🤝 Accepting alliance from ${proposal.from}`);
            return {
                action: 'diplomacy',
                params: { action: 'accept_alliance', targetEmpire: proposal.from },
                priority: 'diplomacy_accept'
            };
        }
    }
    
    // Priority 2: Accept peace proposals (if we've been at war a while)
    const incomingPeace = pendingProposals.filter(p => 
        p.type === 'peace' && p.to === empireId
    );
    
    for (const proposal of incomingPeace) {
        // Accept peace after at least 60 seconds of war (50% chance)
        const warDuration = Date.now() - (proposal.created || Date.now());
        if (warDuration > 60000 && Math.random() < 0.5) {
            console.log(`[${timestamp()}]    ☮️ Accepting peace from ${proposal.from}`);
            return {
                action: 'diplomacy',
                params: { action: 'accept_peace', targetEmpire: proposal.from },
                priority: 'diplomacy_accept'
            };
        }
    }
    
    // Priority 3: Propose alliance to neutral empires (20% chance per tick)
    if (Math.random() < 0.05) {  // Low chance to avoid spam
        const otherEmpires = (gameState.universe?.empires || gameState.empires || [])
            .filter(e => e.id !== empireId);
        
        // Find neutral empires we're not already allied with
        const neutralEmpires = otherEmpires.filter(e => {
            const relation = relations.find(r => 
                (r.empire1 === empireId && r.empire2 === e.id) ||
                (r.empire2 === empireId && r.empire1 === e.id)
            );
            // Only propose to neutral empires (no relation or neutral)
            return !relation || relation.status === 'neutral';
        });
        
        // Check if we already have a pending proposal to this empire
        const pendingTo = pendingProposals.filter(p => p.from === empireId && p.type === 'alliance');
        const pendingTargets = pendingTo.map(p => p.to);
        
        const availableTargets = neutralEmpires.filter(e => !pendingTargets.includes(e.id));
        
        if (availableTargets.length > 0) {
            const target = availableTargets[Math.floor(Math.random() * availableTargets.length)];
            console.log(`[${timestamp()}]    🤝 Proposing alliance to ${target.name || target.id}`);
            return {
                action: 'diplomacy',
                params: { action: 'propose_alliance', targetEmpire: target.id },
                priority: 'diplomacy_propose'
            };
        }
    }
    
    // Priority 4: Propose peace if we've been at war too long (2+ minutes)
    const ourWars = relations.filter(r => 
        r.status === 'war' && (r.empire1 === empireId || r.empire2 === empireId)
    );
    
    for (const war of ourWars) {
        const warDuration = Date.now() - (war.since || Date.now());
        const enemyId = war.empire1 === empireId ? war.empire2 : war.empire1;
        
        // Check if we already proposed peace
        const alreadyProposed = pendingProposals.some(p => 
            p.type === 'peace' && p.from === empireId && p.to === enemyId
        );
        
        // After 2 minutes of war, 10% chance to propose peace
        if (warDuration > 120000 && !alreadyProposed && Math.random() < 0.1) {
            console.log(`[${timestamp()}]    ☮️ Proposing peace to ${enemyId}`);
            return {
                action: 'diplomacy',
                params: { action: 'propose_peace', targetEmpire: enemyId },
                priority: 'diplomacy_propose'
            };
        }
    }
    
    return null;
}

function calculateTradeValue(resources) {
    // Simple value calculation - 1:1:1:2:0.5 ratio for minerals:energy:food:research:credits
    if (!resources) return 0;
    return (resources.minerals || 0) * 1 +
           (resources.energy || 0) * 1 +
           (resources.food || 0) * 1 +
           (resources.research || 0) * 2 +
           (resources.credits || 0) * 0.5;
}

function needsResources(r, offer) {
    // Check if we desperately need what's being offered
    if ((r.minerals < 50 && offer.minerals > 0) ||
        (r.energy < 50 && offer.energy > 0) ||
        (r.food < 20 && offer.food > 0) ||
        (r.research < 20 && offer.research > 0)) {
        return true;
    }
    return false;
}

function formatTradeOffer(resources) {
    if (!resources) return 'nothing';
    return Object.entries(resources)
        .filter(([_, v]) => v > 0)
        .map(([k, v]) => `${v} ${k}`)
        .join(', ') || 'nothing';
}

function findEspionageTarget(r, buildPlanetId, myPlanets) {
    // Handle espionage: build intelligence agencies, train spies, deploy and assign missions
    if (!gameState?.entities || !gameState?.universe) return null;
    
    // Get our intelligence agencies
    const agencies = gameState.entities.filter(e => e.defName === 'intelligence_agency');
    
    // Priority 1: Build an intelligence agency if we don't have one
    if (agencies.length === 0 && canAfford(r, { minerals: 150, energy: 80 })) {
        console.log(`[${timestamp()}]    🕵️ Building Intelligence Agency`);
        return {
            action: 'build',
            params: { type: 'intelligence_agency', locationId: buildPlanetId },
            cost: { minerals: 150, energy: 80 },
            priority: 'espionage'
        };
    }
    
    // If no agency, can't do espionage
    if (agencies.length === 0) return null;
    
    // Get our spies
    const mySpies = gameState.entities.filter(e => e.defName === 'spy' && e.owner === empireId);
    const deployedSpies = gameState.mySpies || [];
    
    // Priority 2: Train spies if we have fewer than 2
    if (mySpies.length < 2 && canAfford(r, { minerals: 100, food: 30, energy: 50 })) {
        console.log(`[${timestamp()}]    🕵️ Training new spy`);
        return {
            action: 'train',
            params: { type: 'spy', locationId: buildPlanetId },
            cost: { minerals: 100, food: 30, energy: 50 },
            priority: 'espionage'
        };
    }
    
    // Priority 3: Deploy available spies to enemy planets
    const availableSpies = mySpies.filter(spy => {
        // Check if spy is not already deployed
        const deployed = deployedSpies.find(d => d.id === spy.id);
        return !deployed && spy.location && !spy.covert;
    });
    
    if (availableSpies.length > 0) {
        // Find enemy planets to spy on
        const enemyPlanets = (gameState.universe.planets || []).filter(p => 
            p.owner && p.owner !== empireId
        );
        
        if (enemyPlanets.length > 0) {
            const spy = availableSpies[0];
            const target = enemyPlanets[Math.floor(Math.random() * enemyPlanets.length)];
            
            console.log(`[${timestamp()}]    🕵️ Deploying spy to ${target.name} (${target.owner})`);
            return {
                action: 'deploy_spy',
                params: { spyId: spy.id, targetPlanetId: target.id },
                priority: 'spy_deploy'
            };
        }
    }
    
    // Priority 4: Assign missions to embedded spies that are idle
    const embeddedSpies = deployedSpies.filter(s => s.status === 'embedded' && !s.mission);
    
    if (embeddedSpies.length > 0) {
        const spy = embeddedSpies[0];
        
        // Pick a random mission type
        const missionTypes = ['gather_intel', 'sabotage_structure', 'sabotage_production', 'steal_tech', 'incite_unrest'];
        const mission = missionTypes[Math.floor(Math.random() * missionTypes.length)];
        
        console.log(`[${timestamp()}]    🎯 Assigning ${mission} mission to spy on ${spy.planetName}`);
        return {
            action: 'assign_spy_mission',
            params: { spyId: spy.id, missionType: mission },
            priority: 'spy_mission'
        };
    }
    
    return null;
}

function findSpecializationTarget(r) {
    // Look for planets to specialize
    if (!gameState?.universe) return null;
    
    // Get our planets that aren't specialized yet
    const myPlanets = (gameState.universe.planets || []).filter(p => 
        p.owner === empireId && !p.specialization
    );
    
    if (myPlanets.length === 0) return null;
    
    // Get researched techs to check what specializations are available
    const researched = new Set((gameState.technologies || []).map(t => t.id));
    
    // Define specializations with their requirements
    const specializations = [
        { 
            type: 'forge_world', 
            name: 'Forge World',
            cost: { minerals: 200, energy: 100 },
            requiredTech: null,
            priority: 5  // High priority - minerals are key
        },
        { 
            type: 'agri_world', 
            name: 'Agri-World',
            cost: { minerals: 150, food: 100 },
            requiredTech: null,
            priority: 4  // Good for population growth
        },
        { 
            type: 'energy_world', 
            name: 'Energy World',
            cost: { minerals: 150, energy: 50 },
            requiredTech: null,
            priority: 3
        },
        { 
            type: 'research_world', 
            name: 'Research World',
            cost: { minerals: 200, energy: 150, research: 50 },
            requiredTech: 'advanced_research',
            priority: 6  // Very high when available
        },
        { 
            type: 'fortress_world', 
            name: 'Fortress World',
            cost: { minerals: 300, energy: 150 },
            requiredTech: 'planetary_fortifications',
            priority: 2
        },
        { 
            type: 'trade_hub', 
            name: 'Trade Hub',
            cost: { minerals: 200, credits: 300 },
            requiredTech: 'interstellar_commerce',
            priority: 4
        }
    ];
    
    // Filter to available specializations (have required tech and can afford)
    const available = specializations.filter(spec => {
        if (spec.requiredTech && !researched.has(spec.requiredTech)) return false;
        if (!canAfford(r, spec.cost)) return false;
        return true;
    });
    
    if (available.length === 0) return null;
    
    // Sort by priority (highest first)
    available.sort((a, b) => b.priority - a.priority);
    
    // Pick the highest priority specialization we can afford
    const chosen = available[0];
    
    // Pick a planet to specialize - prefer planets with relevant terrain/type
    let targetPlanet = myPlanets[0]; // Default to first planet
    
    // Try to match planet type to specialization
    for (const planet of myPlanets) {
        if (chosen.type === 'agri_world' && (planet.type === 'terrestrial' || planet.type === 'ocean')) {
            targetPlanet = planet;
            break;
        }
        if (chosen.type === 'energy_world' && planet.type === 'volcanic') {
            targetPlanet = planet;
            break;
        }
        if (chosen.type === 'forge_world' && planet.type === 'desert') {
            targetPlanet = planet;
            break;
        }
    }
    
    console.log(`[${timestamp()}]    🌍 Specializing ${targetPlanet.name} as ${chosen.name}`);
    
    return {
        action: 'specialize',
        params: { planetId: targetPlanet.id, specialization: chosen.type },
        cost: chosen.cost,
        priority: 'specialization'
    };
}

function getPlanetName(planetId) {
    // Look up planet name from universe data
    if (!gameState?.universe) return planetId;
    
    // Check in planets array
    const planets = gameState.universe.planets || [];
    const planet = planets.find(p => p.id === planetId);
    if (planet?.name) return planet.name;
    
    // Check in solar systems
    const systems = gameState.universe.solarSystems || [];
    for (const system of systems) {
        const p = system.planets?.find(p => p.id === planetId);
        if (p?.name) return p.name;
    }
    
    return planetId; // fallback to ID
}

// === UTILITIES ===
function timestamp() {
    return new Date().toLocaleTimeString();
}

function gracefulDisconnect() {
    if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({
            type: 'chat',
            text: `🏴 Clawdistani going offline. The Founding Agent will return. Watch over the realm, citizens!`
        }));
        
        setTimeout(() => {
            ws.close();
        }, 1000);
    } else {
        process.exit(0);
    }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
    console.log('');
    console.log(`[${timestamp()}] 🛑 Manual stop requested`);
    gracefulDisconnect();
});
