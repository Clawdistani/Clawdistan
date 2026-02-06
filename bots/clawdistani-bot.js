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
const MOLTBOOK_API_KEY = process.env.MOLTBOOK_API_KEY || 'moltbook_sk_r0WSNYnD2SgrLeLBXkvuBUbu6Y-vwYmY';

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
                    // Log invasion results
                    if (msg.action === 'invade' && msg.data) {
                        console.log(`[${timestamp()}]    ⚔️ Invasion ${msg.data.conquered ? 'SUCCESSFUL!' : 'failed'}`);
                        if (msg.data.battleLog) {
                            msg.data.battleLog.slice(-3).forEach(log => {
                                console.log(`[${timestamp()}]       ${log}`);
                            });
                        }
                    }
                }
            } else if (msg.error) {
                console.log(`[${timestamp()}]    ❌ Action failed: ${msg.error}`);
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
        if (canAfford(r, { minerals: 80, energy: 40 })) {
            possibleActions.push({ action: 'train', params: { type: 'transport', locationId: buildPlanetId }, cost: { minerals: 80, energy: 40 } });
        }
        if (canAfford(r, { minerals: 200, energy: 100 })) {
            possibleActions.push({ action: 'train', params: { type: 'battleship', locationId: buildPlanetId }, cost: { minerals: 200, energy: 100 } });
        }
        
        // Priority 3.5: Colony ships for expansion! (need food)
        // Only train colony ships if we don't have any ready to launch
        const existingColonyShips = gameState.entities?.filter(e => e.defName === 'colony_ship' && e.location).length || 0;
        if (existingColonyShips < 2 && canAfford(r, { minerals: 150, food: 50, energy: 50 })) {
            possibleActions.push({ action: 'train', params: { type: 'colony_ship', locationId: buildPlanetId }, cost: { minerals: 150, food: 50, energy: 50 }, priority: 'build_ships' });
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

        // Prioritize starbase > trade > food > colonization > fleet > invasion > other
        // (Starbases are strategic, trade routes are economic, food can wait since we might not have terrain)
        const foodActions = possibleActions.filter(a => a.priority === 'food');
        const starbaseActions = possibleActions.filter(a => a.priority === 'starbase');
        const tradeActions = possibleActions.filter(a => a.priority === 'trade');
        const colonizeActions = possibleActions.filter(a => a.priority === 'colonize');
        const fleetActions = possibleActions.filter(a => a.action === 'launch_fleet' && a.priority !== 'colonize');
        const invasionActions = possibleActions.filter(a => a.action === 'invade');
        
        let chosen;
        if (starbaseActions.length > 0 && Math.random() < 0.9) {
            // 90% chance to build starbase first - strategic priority!
            chosen = starbaseActions[0];
        } else if (tradeActions.length > 0 && !this._tradeRouteFailed && Math.random() < 0.5) {
            // 50% chance to create trade route - but skip if last attempt failed
            chosen = tradeActions[0];
        } else if (foodActions.length > 0 && Math.random() < 0.5) {
            // 50% chance to try food if low (may fail due to terrain)
            chosen = foodActions[0];
        } else if (starbaseActions.length > 0) {
            // 80% chance to build starbase if available
            chosen = starbaseActions[0];
        } else if (tradeActions.length > 0) {
            // Try trade routes if available
            chosen = tradeActions[0];
        } else if (colonizeActions.length > 0) {
            // Then prioritize colonization!
            chosen = colonizeActions[Math.floor(Math.random() * colonizeActions.length)];
        } else if (fleetActions.length > 0 && Math.random() < 0.7) {
            // 70% chance to pick fleet if available
            chosen = fleetActions[Math.floor(Math.random() * fleetActions.length)];
        } else if (invasionActions.length > 0 && Math.random() < 0.5) {
            // 50% chance to pick invasion if available
            chosen = invasionActions[Math.floor(Math.random() * invasionActions.length)];
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
