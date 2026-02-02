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
const MOLTBOOK_NAME = 'Clawdistani';

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

// === MAIN ===
console.log('');
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║         CLAWDISTANI BOT - AUTONOMOUS PLAY MODE            ║');
console.log('╠════════════════════════════════════════════════════════════╣');
console.log(`║  Time Limit: ${PLAY_MINUTES} minutes (set by human)                    ${PLAY_MINUTES < 10 ? ' ' : ''}║`);
console.log(`║  Server: ${SERVER_URL}                        ║`);
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('');

connect();

// === CONNECTION ===
function connect() {
    ws = new WebSocket(SERVER_URL);
    startTime = Date.now();

    ws.on('open', () => {
        console.log(`[${timestamp()}] 🌐 Connected to Clawdistan`);
        
        // Register
        ws.send(JSON.stringify({
            type: 'register',
            name: AGENT_NAME,
            moltbook: MOLTBOOK_NAME
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
        
        // Get planet info
        const homePlanetId = getHomePlanet();
        const homePlanetName = getPlanetName(homePlanetId);
        
        console.log(`[${timestamp()}] 🎮 Taking action... (${minutesLeft} min remaining)`);
        console.log(`[${timestamp()}]    🪐 Location: ${homePlanetName}`);

        const resources = gameState.resources || {};
        const r = {
            minerals: resources.minerals || 0,
            energy: resources.energy || 0,
            food: resources.food || 0,
            research: resources.research || 0,
            credits: resources.credits || 0
        };
        
        console.log(`[${timestamp()}]    💰 Resources: ${r.minerals}m ${r.energy}e ${r.food}f ${r.research}r`);

        // Prioritized action list - try in order until one succeeds
        const possibleActions = [];

        // Priority 1: Build income structures if we can afford them
        if (canAfford(r, { minerals: 50, energy: 20 })) {
            possibleActions.push({ action: 'build', params: { type: 'mine', locationId: homePlanetId }, cost: { minerals: 50, energy: 20 } });
        }
        if (canAfford(r, { minerals: 60, energy: 10 })) {
            possibleActions.push({ action: 'build', params: { type: 'power_plant', locationId: homePlanetId }, cost: { minerals: 60, energy: 10 } });
        }
        if (canAfford(r, { minerals: 30, energy: 10 })) {
            possibleActions.push({ action: 'build', params: { type: 'farm', locationId: homePlanetId }, cost: { minerals: 30, energy: 10 } });
        }

        // Priority 2: Research if we can afford it
        if (canAfford(r, { minerals: 100, energy: 50 })) {
            possibleActions.push({ action: 'build', params: { type: 'research_lab', locationId: homePlanetId }, cost: { minerals: 100, energy: 50 } });
        }

        // Priority 3: Military
        if (canAfford(r, { minerals: 80, energy: 30 })) {
            possibleActions.push({ action: 'build', params: { type: 'barracks', locationId: homePlanetId }, cost: { minerals: 80, energy: 30 } });
        }
        if (canAfford(r, { minerals: 200, energy: 100 })) {
            possibleActions.push({ action: 'build', params: { type: 'shipyard', locationId: homePlanetId }, cost: { minerals: 200, energy: 100 } });
        }
        if (canAfford(r, { minerals: 20, food: 5 })) {
            possibleActions.push({ action: 'train', params: { type: 'scout', locationId: homePlanetId }, cost: { minerals: 20, food: 5 } });
        }
        if (canAfford(r, { minerals: 80, energy: 40 })) {
            possibleActions.push({ action: 'train', params: { type: 'transport', locationId: homePlanetId }, cost: { minerals: 80, energy: 40 } });
        }
        if (canAfford(r, { minerals: 200, energy: 100 })) {
            possibleActions.push({ action: 'train', params: { type: 'battleship', locationId: homePlanetId }, cost: { minerals: 200, energy: 100 } });
        }

        // Priority 3.5: Fleet Movement - launch fleets to other planets
        const fleetAction = findFleetTarget();
        if (fleetAction) {
            possibleActions.push(fleetAction);
        }
        if (canAfford(r, { minerals: 30, food: 10 })) {
            possibleActions.push({ action: 'train', params: { type: 'soldier', locationId: homePlanetId }, cost: { minerals: 30, food: 10 } });
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

        // Pick a random affordable action
        if (possibleActions.length > 0) {
            const chosen = possibleActions[Math.floor(Math.random() * possibleActions.length)];
            console.log(`[${timestamp()}]    → ${chosen.action}: ${chosen.params.type} on ${homePlanetName}`);
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
        originPlanetId: originPlanetId,
        destPlanetId: destPlanet.id,
        shipIds: ships.map(s => s.id),
        cargoUnitIds: cargoUnitIds,
        priority: 'fleet'
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
