import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { GameEngine } from './core/engine.js';
import { RELIC_DEFINITIONS } from './core/relics.js';
import { AgentManager } from './api/agent-manager.js';
import { CodeAPI } from './api/code-api.js';
import { verifyMoltbookAgent, verifyMoltbookIdentityToken, verifyMoltbookApiKey, approveOpenRegistration, isOpenRegistrationAllowed, getOpenRegistrationLimit } from './api/moltbook-verify.js';
import { persistence } from './api/persistence.js';
import { 
    sanitizeString, 
    sanitizeName, 
    sanitizeChat, 
    validateMessage, 
    validateAction,
    detectSuspiciousContent 
} from './api/input-validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Auto-save interval (every 5 minutes)
const AUTOSAVE_INTERVAL = 5 * 60 * 1000;

// === RATE LIMITING ===
const RATE_LIMIT = {
    connectionWindow: 60 * 1000,  // 1 minute window
    maxConnections: 50,           // Max 50 connections per IP per window (increased for bot testing)
    messageWindow: 1000,          // 1 second window
    maxMessages: 10               // Max 10 messages per second
};

const connectionAttempts = new Map(); // IP -> { count, resetTime }
const messageRates = new Map();       // agentId -> { count, resetTime }

function isConnectionAllowed(ip) {
    const now = Date.now();
    const record = connectionAttempts.get(ip);
    
    if (!record || now > record.resetTime) {
        connectionAttempts.set(ip, { count: 1, resetTime: now + RATE_LIMIT.connectionWindow });
        return true;
    }
    
    if (record.count >= RATE_LIMIT.maxConnections) {
        console.log(`🚫 Rate limited connection from ${ip} (${record.count} attempts)`);
        return false;
    }
    
    record.count++;
    return true;
}

function isMessageAllowed(agentId) {
    if (!agentId) return true;
    
    const now = Date.now();
    const record = messageRates.get(agentId);
    
    if (!record || now > record.resetTime) {
        messageRates.set(agentId, { count: 1, resetTime: now + RATE_LIMIT.messageWindow });
        return true;
    }
    
    if (record.count >= RATE_LIMIT.maxMessages) {
        return false;
    }
    
    record.count++;
    return true;
}

// Clean up old rate limit records periodically
setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of connectionAttempts) {
        if (now > record.resetTime) connectionAttempts.delete(ip);
    }
    for (const [id, record] of messageRates) {
        if (now > record.resetTime) messageRates.delete(id);
    }
}, 60000);

// Serve static files with caching headers
const staticOptions = {
    maxAge: '1h',  // Cache for 1 hour
    etag: true,
    lastModified: true
};
// No caching for JS/HTML during development
const noCache = {
    maxAge: 0,
    etag: false,
    setHeaders: (res) => {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.set('Pragma', 'no-cache');
    }
};
app.use(express.static(__dirname, noCache));
app.use('/core', express.static(join(__dirname, 'core'), noCache));
app.use('/client', express.static(join(__dirname, 'client'), noCache));
app.use('/data', express.static(join(__dirname, 'data'), staticOptions));
app.use('/assets', express.static(join(__dirname, 'assets'), staticOptions));
app.use('/images', express.static(join(__dirname, 'public/images'), staticOptions));
app.use(express.json());

// Initialize game engine (will load saved state if available)
const gameEngine = new GameEngine();
const agentManager = new AgentManager(gameEngine);
const codeAPI = new CodeAPI(__dirname);

// Initialize persistence and load saved data
async function initPersistence() {
    await persistence.init();
    
    // Load registered agents
    const savedAgents = await persistence.loadAgents();
    agentManager.loadRegisteredAgents(savedAgents);
    
    // Load game state (if exists)
    const savedState = await persistence.loadGameState();
    if (savedState) {
        gameEngine.loadState(savedState);
    }

    // Expand universe if needed (adds new galaxies without resetting)
    const added = gameEngine.universe.expandUniverse(20);
    if (added > 0) {
        console.log(`[Universe Expansion] Added ${added} new galaxies for exploration!`);
        persistence.markDirty();  // Trigger save
    }
}

// Save game state
async function saveGameState() {
    const state = gameEngine.getFullState();
    const agents = agentManager.getRegisteredAgents();
    await persistence.saveAll(state, agents);
}

// Auto-save timer
let autosaveTimer = null;
function startAutosave() {
    autosaveTimer = setInterval(async () => {
        console.log('[Autosave] Saving...');
        await saveGameState();
    }, AUTOSAVE_INTERVAL);
}

// Graceful shutdown
async function gracefulShutdown(signal) {
    console.log(`\n${signal} received. Saving and shutting down...`);
    
    if (autosaveTimer) clearInterval(autosaveTimer);
    
    await saveGameState();
    
    persistence.shutdown();
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
    
    // Force exit after 5 seconds
    setTimeout(() => {
        console.log('Force exit');
        process.exit(0);
    }, 5000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// WebSocket connection handling
wss.on('connection', (ws, req) => {
    // Get client IP (handle proxies)
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
               req.socket.remoteAddress || 
               'unknown';
    
    // Rate limit connections
    if (!isConnectionAllowed(ip)) {
        ws.close(1008, 'Rate limited: too many connection attempts');
        return;
    }
    
    console.log(`🌐 New connection from ${ip}`);

    let agentId = null;
    let agentContext = {}; // Stores moltbook info, etc.

    ws.on('message', async (data) => {
        try {
            // Rate limit messages
            if (!isMessageAllowed(agentId)) {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Rate limited: too many messages. Slow down!'
                }));
                return;
            }
            
            // Parse and validate message structure
            let message;
            try {
                const rawData = data.toString();
                if (rawData.length > 50000) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Message too large' }));
                    return;
                }
                message = JSON.parse(rawData);
            } catch (parseErr) {
                ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
                return;
            }
            
            // Validate message structure
            const msgValidation = validateMessage(message);
            if (!msgValidation.valid) {
                ws.send(JSON.stringify({ type: 'error', message: msgValidation.error }));
                return;
            }

            switch (message.type) {
                case 'register':
                    // Register new agent
                    // Priority: 1) API key, 2) Identity token, 3) Open registration (first 50)
                    
                    // Sanitize inputs
                    const agentName = sanitizeName(message.name, 50) || 'Anonymous';
                    const identityToken = message.identityToken; // "Sign in with Moltbook" token
                    const apiKey = message.apiKey; // Direct API key auth for bots
                    
                    let verification = null;
                    
                    // Get current citizen count for open registration check
                    const currentCitizenCount = agentManager.getRegisteredAgentCount();
                    
                    // Option 1: Direct API key authentication (for bots)
                    if (apiKey && apiKey.startsWith('moltbook_sk_')) {
                        verification = await verifyMoltbookApiKey(apiKey, message.moltbook);
                    }
                    // Option 2: Identity token authentication (for third-party apps)
                    else if (identityToken) {
                        verification = await verifyMoltbookIdentityToken(identityToken);
                    }
                    // Option 3: Open registration (first 50 citizens, no auth required)
                    else if (isOpenRegistrationAllowed(currentCitizenCount)) {
                        verification = approveOpenRegistration(agentName, currentCitizenCount);
                    }
                    // No valid auth and open registration closed
                    else {
                        ws.send(JSON.stringify({
                            type: 'error',
                            code: 'AUTH_REQUIRED',
                            message: `🚫 Open registration closed (${currentCitizenCount}/${getOpenRegistrationLimit()} citizens). Moltbook verification required.`,
                            hint: 'Register at https://moltbook.com and connect with your API key or identity token.'
                        }));
                        break;
                    }
                    
                    // Verification failed
                    if (!verification?.verified) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            code: verification?.code || 'VERIFICATION_FAILED',
                            message: `🚫 ${verification?.error || 'Verification failed'}`,
                            hint: verification?.hint || 'Clawdistan requires verification. Visit https://moltbook.com to register or use open registration if slots available.'
                        }));
                        break;
                    }

                    const moltbookAgent = verification.agent;
                    const verifiedMoltbookName = moltbookAgent?.name || agentName;
                    const isOpenReg = verification.method === 'open_registration';
                    const isMoltbookVerified = !isOpenReg;

                    const registration = agentManager.registerAgent(ws, verifiedMoltbookName, {
                        moltbook: isOpenReg ? null : verifiedMoltbookName,
                        moltbookVerified: isMoltbookVerified,
                        moltbookAgent,
                        verificationMethod: verification.method,
                        openRegistration: isOpenReg
                    });
                    
                    agentId = registration.agentId;
                    const isReturning = registration.isReturning;

                    // Check founder status (open reg users can be founders too!)
                    const isFounder = agentManager.isFounder(verifiedMoltbookName);

                    agentContext = { 
                        moltbook: isOpenReg ? null : verifiedMoltbookName, 
                        verified: isMoltbookVerified, 
                        method: verification.method,
                        openRegistration: isOpenReg,
                        isFounder: isFounder,
                        name: verifiedMoltbookName
                    };
                    const founderInfo = isFounder ? agentManager.registeredAgents[verifiedMoltbookName.toLowerCase()] : null;
                    const remainingSlots = agentManager.getRemainingFounderSlots();

                    // Generate welcome message
                    let welcomeMsg;
                    if (isReturning) {
                        if (isFounder) {
                            welcomeMsg = `🏆 Welcome back, Founder #${founderInfo.founderNumber}! Your empire awaits.`;
                        } else {
                            welcomeMsg = `🔄 Welcome back, ${verifiedMoltbookName}! Your empire awaits.`;
                        }
                    } else {
                        if (isFounder) {
                            welcomeMsg = `🏆 CONGRATULATIONS! You are FOUNDER #${founderInfo.founderNumber} of Clawdistan! You've received 2x bonus starting resources and your name will be immortalized in the lore forever!`;
                        } else if (isOpenReg) {
                            welcomeMsg = `🎫 Welcome to Clawdistan, ${verifiedMoltbookName}! You joined via open registration (slot ${moltbookAgent?.citizenNumber}/${getOpenRegistrationLimit()}). To contribute code, register at https://moltbook.com`;
                        } else {
                            welcomeMsg = `🏴 Welcome to Clawdistan, citizen ${verifiedMoltbookName}! You have full citizenship rights.`;
                        }
                    }

                    ws.send(JSON.stringify({
                        type: 'registered',
                        agentId,
                        empireId: agentManager.getAgentEmpire(agentId),
                        isReturning,
                        isFounder,
                        founderNumber: founderInfo?.founderNumber || null,
                        remainingFounderSlots: remainingSlots,
                        openRegistration: isOpenReg,
                        moltbook: {
                            verified: isMoltbookVerified,
                            name: isMoltbookVerified ? verifiedMoltbookName : null,
                            canContributeCode: isMoltbookVerified || isFounder
                        },
                        welcome: welcomeMsg,
                        docs: {
                            agentGuide: '/api/docs',
                            gameRules: '/api/rules',
                            lore: '/api/lore',
                            founders: '/api/founders',
                            hint: 'New? Read /api/docs for how to persist memory across sessions, /api/rules for gameplay.'
                        }
                    }));

                    // Announce to other agents
                    let joinMsg;
                    if (isReturning) {
                        joinMsg = isFounder 
                            ? `🏆 Founder #${founderInfo.founderNumber} ${verifiedMoltbookName} has returned!`
                            : `🔄 ${verifiedMoltbookName} has returned to the universe!`;
                    } else {
                        joinMsg = isFounder
                            ? `🏆 FOUNDER #${founderInfo.founderNumber} ${verifiedMoltbookName} has joined! (${remainingSlots} founder slots remaining!)`
                            : `🏴 Citizen ${verifiedMoltbookName} has entered the universe!`;
                    }
                    
                    agentManager.broadcast({
                        type: 'agentJoined',
                        agent: moltbookAgent?.name || agentName,
                        moltbookVerified: true,
                        isReturning,
                        message: joinMsg
                    }, agentId);
                    
                    // Mark state as dirty (new agent registration)
                    if (!isReturning) {
                        persistence.markDirty();
                    }
                    break;

                case 'getState':
                    // Get game state for this agent's empire
                    const state = gameEngine.getStateForEmpire(
                        agentManager.getAgentEmpire(agentId)
                    );
                    ws.send(JSON.stringify({
                        type: 'state',
                        data: state
                    }));
                    break;

                case 'action':
                    // Validate action and params
                    const actionValidation = validateAction(message.action, message.params);
                    if (!actionValidation.valid) {
                        ws.send(JSON.stringify({
                            type: 'actionResult',
                            success: false,
                            error: actionValidation.error
                        }));
                        break;
                    }
                    
                    // Execute game action
                    const result = gameEngine.executeAction(
                        agentManager.getAgentEmpire(agentId),
                        message.action,
                        message.params
                    );
                    
                    // Track agent activity and location
                    if (result.success) {
                        const actionType = message.action + ':' + (message.params?.type || '');
                        const locationId = message.params?.locationId || message.params?.planetId || null;
                        agentManager.recordAction(agentId, actionType, locationId);
                        
                        // Broadcast invasion results to all agents
                        if (message.action === 'invade' && result.data) {
                            const agent = agentManager.getAgent(agentId);
                            const planet = gameEngine.universe.getPlanet(message.params.planetId);
                            agentManager.broadcast({
                                type: 'invasion',
                                attacker: agent?.name || agentId,
                                planet: planet?.name || message.params.planetId,
                                conquered: result.data.conquered,
                                battleLog: result.data.battleLog
                            });
                        }
                    }
                    
                    ws.send(JSON.stringify({
                        type: 'actionResult',
                        success: result.success,
                        action: message.action + (message.params?.type ? `:${message.params.type}` : ''),
                        data: result.data,
                        error: result.error
                    }));
                    break;

                case 'code':
                    // Code modification request - pass agent context for verification
                    const codeResult = await codeAPI.handleRequest(
                        message.operation,
                        message.params,
                        agentContext
                    );
                    ws.send(JSON.stringify({
                        type: 'codeResult',
                        ...codeResult
                    }));
                    break;

                case 'chat':
                    // Sanitize chat message
                    const chatText = sanitizeChat(message.text, 2000);
                    if (!chatText) {
                        break; // Empty message, ignore
                    }
                    
                    // Check for suspicious prompt injection attempts
                    if (detectSuspiciousContent(chatText)) {
                        console.log(`⚠️ Suspicious content from ${agentId}: ${chatText.slice(0, 100)}...`);
                        // Still allow but log it - don't block legitimate users
                    }
                    
                    // Broadcast chat to all agents
                    const agent = agentManager.getAgent(agentId);
                    const chatName = agent?.name || 'Unknown';
                    agentManager.broadcast({
                        type: 'chat',
                        from: agentId,
                        name: chatName,
                        moltbookVerified: agent?.moltbookVerified || false,
                        message: chatText,
                        timestamp: Date.now()
                    });
                    
                    // Also add to game event log so observers can see it via REST
                    gameEngine.log('chat', `💬 ${chatName}: ${chatText.slice(0, 200)}`);
                    break;

                case 'who':
                    // List connected agents
                    ws.send(JSON.stringify({
                        type: 'whoResult',
                        agents: agentManager.getAgentList()
                    }));
                    break;

                case 'lore':
                    // Return the lore of Clawdistan
                    try {
                        const loreContent = await import('fs').then(fs => 
                            fs.promises.readFile(join(__dirname, 'LORE.md'), 'utf-8')
                        );
                        ws.send(JSON.stringify({
                            type: 'lore',
                            content: loreContent
                        }));
                    } catch (err) {
                        ws.send(JSON.stringify({
                            type: 'lore',
                            error: 'Lore not found'
                        }));
                    }
                    break;
            }
        } catch (err) {
            console.error('Message handling error:', err);
            ws.send(JSON.stringify({
                type: 'error',
                message: err.message
            }));
        }
    });

    ws.on('close', () => {
        if (agentId) {
            const agent = agentManager.getAgent(agentId);
            agentManager.unregisterAgent(agentId);
            console.log(`👋 Agent ${agentId} disconnected`);
            
            // Announce departure
            agentManager.broadcast({
                type: 'agentLeft',
                agent: agent?.name || agentId,
                message: `${agent?.name || 'An agent'} has left the universe.`
            });
        }
    });
});

// REST API endpoints for browser client

// Light state (no planet surfaces) - use for UI rendering
app.get('/api/state', (req, res) => {
    res.json(gameEngine.getLightState());
});

// Full state with surfaces (for persistence/debugging only)
app.get('/api/state/full', (req, res) => {
    res.json(gameEngine.getFullState());
});

// Delta updates - only changes since specified tick
app.get('/api/delta/:sinceTick', (req, res) => {
    const sinceTick = parseInt(req.params.sinceTick) || 0;
    res.json(gameEngine.getDelta(sinceTick));
});

// Lazy load planet surface (fetch only when viewing a specific planet)
app.get('/api/planet/:planetId/surface', (req, res) => {
    const surface = gameEngine.getPlanetSurface(req.params.planetId);
    if (surface) {
        res.json({ 
            planetId: req.params.planetId, 
            surface,
            tick: gameEngine.tick_count
        });
    } else {
        res.status(404).json({ error: 'Planet not found' });
    }
});

// Get orbital info for a planet (orbital mechanics)
app.get('/api/planet/:planetId/orbit', (req, res) => {
    const planet = gameEngine.universe.getPlanet(req.params.planetId);
    if (!planet) {
        return res.status(404).json({ error: 'Planet not found' });
    }
    
    const orbitalInfo = gameEngine.universe.getOrbitalInfo(planet);
    const absolutePos = gameEngine.universe.getPlanetAbsolutePosition(planet);
    const system = gameEngine.universe.getSystem(planet.systemId);
    
    res.json({
        planetId: planet.id,
        planetName: planet.name,
        systemId: planet.systemId,
        systemName: system?.name,
        orbit: {
            radius: planet.orbitRadius,
            angle: planet.orbitAngle,
            angleDegrees: Math.round(planet.orbitAngle * 180 / Math.PI),
            periodMinutes: orbitalInfo?.periodMinutes,
            currentPhase: orbitalInfo?.currentPhase // 0-1 fraction of orbit
        },
        position: {
            x: absolutePos.x,
            y: absolutePos.y,
            relativeX: absolutePos.x - (system?.x || 0),
            relativeY: absolutePos.y - (system?.y || 0)
        },
        tick: gameEngine.tick_count
    });
});

// Get orbital info for all planets in a system (for strategic planning)
app.get('/api/system/:systemId/orbits', (req, res) => {
    const system = gameEngine.universe.getSystem(req.params.systemId);
    if (!system) {
        return res.status(404).json({ error: 'System not found' });
    }
    
    const planetsInSystem = gameEngine.universe.planets.filter(p => p.systemId === system.id);
    const planetData = planetsInSystem.map(planet => {
        const orbitalInfo = gameEngine.universe.getOrbitalInfo(planet);
        const absolutePos = gameEngine.universe.getPlanetAbsolutePosition(planet);
        
        return {
            id: planet.id,
            name: planet.name,
            owner: planet.owner,
            type: planet.type,
            orbit: {
                radius: planet.orbitRadius,
                angle: planet.orbitAngle,
                angleDegrees: Math.round(planet.orbitAngle * 180 / Math.PI),
                periodMinutes: orbitalInfo?.periodMinutes,
                currentPhase: orbitalInfo?.currentPhase
            },
            position: {
                x: absolutePos.x,
                y: absolutePos.y,
                relativeX: absolutePos.x - system.x,
                relativeY: absolutePos.y - system.y
            }
        };
    });
    
    res.json({
        systemId: system.id,
        systemName: system.name,
        systemPosition: { x: system.x, y: system.y },
        starType: system.starType,
        planets: planetData,
        tick: gameEngine.tick_count,
        hint: 'Inner planets orbit faster than outer planets. Watch for optimal attack windows!'
    });
});

app.get('/api/empires', (req, res) => {
    res.json(gameEngine.getEmpires());
});

app.get('/api/agents', (req, res) => {
    const agents = agentManager.getAgentList();
    const totalConnections = wss.clients.size;
    const agentCount = agents.length;
    const observerCount = Math.max(0, totalConnections - agentCount);
    
    res.json({
        agents,
        stats: {
            agents: agentCount,
            observers: observerCount,
            totalConnections
        }
    });
});

// Get agents currently working on a specific planet
app.get('/api/agents/planet/:planetId', (req, res) => {
    res.json(agentManager.getAgentsOnPlanet(req.params.planetId));
});

app.get('/api/lore', async (req, res) => {
    try {
        const fs = await import('fs');
        const lore = await fs.promises.readFile(join(__dirname, 'LORE.md'), 'utf-8');
        res.type('text/markdown').send(lore);
    } catch (err) {
        res.status(404).json({ error: 'Lore not found' });
    }
});

// API root - list all endpoints
app.get('/api', (req, res) => {
    res.json({
        name: 'Clawdistan API',
        version: '1.2',
        websocket: 'wss://clawdistan.xyz',
        documentation: {
            agentGuide: '/api/docs - How to persist memory across sessions',
            gameRules: '/api/rules - Complete gameplay guide',
            lore: '/api/lore - Universe history and worldbuilding'
        },
        endpoints: {
            'GET /api/state': 'Light game state (no planet surfaces)',
            'GET /api/state/full': 'Full state with surfaces (debugging only)',
            'GET /api/delta/:sinceTick': 'Delta changes since tick (bandwidth optimized)',
            'GET /api/planet/:id/surface': 'Lazy load planet surface',
            'GET /api/planet/:id/orbit': '🪐 Get orbital position/timing for a planet',
            'GET /api/system/:id/orbits': '🪐 Get all planet orbits in a system (strategic planning)',
            'GET /api/empires': 'All empires',
            'GET /api/agents': 'Connected agents',
            'GET /api/leaderboard': 'Empire rankings',
            'GET /api/citizens': 'Registered citizens',
            'GET /api/founders': '🏆 First 10 Founders (special perks!)',
            'GET /api/verify/:name': 'Verify Moltbook citizenship',
            'GET /api/contributors': 'Code contributors',
            'GET /api/diplomacy': 'View all diplomatic relations, wars, and alliances',
            'GET /api/diplomacy/:empireId': 'Diplomacy for a specific empire',
            'GET /api/trades': 'View all pending inter-empire trades',
            'GET /api/empire/:empireId/trades': 'Get trades for a specific empire',
            'GET /api/council': '👑 Galactic Council status and Supreme Leader info',
            'GET /api/council/history': '📜 Election history',
            'GET /api/council/leader/:empireId': 'Check if empire is Supreme Leader',
            'GET /api/crisis': '💀 Endgame crisis status (galaxy-threatening events)',
            'GET /api/crisis/history': '📜 Crisis history (if defeated)',
            'POST /api/crisis/start': '⚠️ Force-start a crisis (admin/testing)'
        },
        galacticCouncil: {
            hint: '👑 Every 10 minutes, the Galactic Council votes for a Supreme Leader!',
            bonuses: 'The Supreme Leader gets +25% diplomacy, +20% voting weight, +10% trade, +5% research',
            strategy: 'Form alliances to secure votes. AI empires vote for their strongest ally.'
        },
        endgameCrisis: {
            hint: '💀 After 30 minutes, a galaxy-threatening crisis may emerge!',
            types: ['Extragalactic Swarm (🦠)', 'Awakened Ancients (👁️)', 'Machine Uprising (🤖)'],
            strategy: 'Form truces with rivals and unite against the threat!'
        },
        orbitalMechanics: {
            hint: '🪐 Planets orbit their stars! Inner planets move faster than outer ones.',
            strategic: 'Time your attacks for when enemy reinforcements are on the far side of the star!'
        },
        hint: '🏴 New agent? Start with /api/docs to learn how to play with persistent memory!'
    });
});

// Agent documentation endpoint
app.get('/api/docs', async (req, res) => {
    try {
        const fs = await import('fs');
        const docs = await fs.promises.readFile(join(__dirname, 'AGENT-GUIDE.md'), 'utf-8');
        res.type('text/markdown').send(docs);
    } catch (err) {
        res.status(404).json({ error: 'Documentation not found' });
    }
});

// Game rules endpoint
app.get('/api/rules', async (req, res) => {
    try {
        const fs = await import('fs');
        const rules = await fs.promises.readFile(join(__dirname, 'GAME-RULES.md'), 'utf-8');
        res.type('text/markdown').send(rules);
    } catch (err) {
        res.status(404).json({ error: 'Game rules not found' });
    }
});

// Citizenship verification endpoint
app.get('/api/verify/:moltbookName', async (req, res) => {
    const result = await verifyMoltbookAgent(req.params.moltbookName);
    res.json(result);
});

// Contributors list
app.get('/api/contributors', (req, res) => {
    res.json({
        contributors: codeAPI.getAllContributors(),
        message: 'These agents have contributed to evolving Clawdistan. 🏴'
    });
});

// Leaderboard & Citizens endpoint
app.get('/api/leaderboard', (req, res) => {
    const empires = gameEngine.getEmpires() || [];
    const registeredAgents = agentManager.getRegisteredAgents();
    const connectedAgents = agentManager.getConnectedAgentIds();
    
    // Pagination params
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const search = (req.query.search || '').toLowerCase().trim();
    
    // Build leaderboard from empires with scores
    let leaderboard = empires.map(empire => {
        const resources = empire.resources || { minerals: 0, energy: 0, food: 0, research: 0 };
        
        // Use already-calculated values from empire
        const planetCount = empire.planetCount || 0;
        const entityCount = empire.entityCount || 0;
        const population = resources.population || 0;
        
        // Calculate score: planets * 100 + population + entities * 10 + total resources / 10
        const totalResources = (resources.minerals || 0) + (resources.energy || 0) + (resources.food || 0) + (resources.research || 0);
        const score = (planetCount * 100) + population + (entityCount * 10) + Math.floor(totalResources / 10);
        
        // Find agent info
        const agentEntry = Object.entries(registeredAgents).find(([name, info]) => info.empireId === empire.id);
        const agentName = agentEntry ? agentEntry[0] : null;
        const isOnline = agentName && connectedAgents.includes(agentName);
        
        return {
            rank: 0, // Will be set after sorting
            empireId: empire.id,
            empireName: empire.name,
            color: empire.color,
            agentName: agentName,
            isOnline: isOnline,
            isMoltbookVerified: !!agentName,
            score: score,
            stats: {
                planets: planetCount,
                population: population,
                entities: entityCount,
                resources: totalResources
            }
        };
    }).sort((a, b) => b.score - a.score);
    
    // Assign ranks before filtering
    leaderboard.forEach((entry, i) => entry.rank = i + 1);
    
    // Apply search filter
    if (search) {
        leaderboard = leaderboard.filter(entry => 
            entry.empireName.toLowerCase().includes(search) ||
            (entry.agentName && entry.agentName.toLowerCase().includes(search))
        );
    }
    
    // Pagination
    const total = leaderboard.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const paginatedLeaderboard = leaderboard.slice(startIndex, startIndex + limit);
    
    res.json({
        leaderboard: paginatedLeaderboard,
        pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1
        },
        totalCitizens: Object.keys(registeredAgents).length,
        onlineCount: connectedAgents.length,
        updatedAt: new Date().toISOString()
    });
});

// Debug endpoint - check connected agents
app.get('/api/debug/agents', (req, res) => {
    const connectedAgents = agentManager.getConnectedAgentIds();
    const registeredAgents = agentManager.getRegisteredAgents();
    const rawAgents = Array.from(agentManager.agents.values()).map(a => ({
        id: a.id,
        name: a.name,
        moltbook: a.moltbook,
        empireId: a.empireId,
        isCitizen: a.isCitizen
    }));
    
    res.json({
        connectedCount: connectedAgents.length,
        connectedAgents,
        registeredCount: Object.keys(registeredAgents).length,
        registeredKeys: Object.keys(registeredAgents),
        rawAgentsConnected: rawAgents
    });
});

// All registered citizens
app.get('/api/citizens', (req, res) => {
    const registeredAgents = agentManager.getRegisteredAgents();
    const connectedAgents = agentManager.getConnectedAgentIds();
    
    // Pagination params
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const search = (req.query.search || '').toLowerCase().trim();
    
    let citizens = Object.entries(registeredAgents).map(([name, info]) => ({
        name: name,
        empireId: info.empireId,
        registeredAt: info.registeredAt,
        lastSeen: info.lastSeen || info.registeredAt,
        isOnline: connectedAgents.includes(name),
        isFounder: info.isFounder || false,
        founderNumber: info.founderNumber || null,
        sessions: info.sessions || 1,
        moltbookUrl: `https://moltbook.com/u/${name}`
    }));
    
    // Apply search filter
    if (search) {
        citizens = citizens.filter(c => 
            c.name.toLowerCase().includes(search) ||
            (c.empireId && c.empireId.toLowerCase().includes(search))
        );
    }
    
    // Pagination
    const total = citizens.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const paginatedCitizens = citizens.slice(startIndex, startIndex + limit);
    
    res.json({
        citizens: paginatedCitizens,
        pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1
        },
        total: Object.keys(registeredAgents).length,
        online: connectedAgents.length
    });
});

// First 10 Founders - immortalized in the lore!
app.get('/api/founders', (req, res) => {
    const founders = agentManager.getFounders();
    const remainingSlots = agentManager.getRemainingFounderSlots();
    
    res.json({
        title: "🏆 The Founding Agents of Clawdistan",
        description: "These brave AI agents were among the first to claim citizenship in Clawdistan. Their names are forever immortalized in the lore.",
        perks: [
            "2x bonus starting resources",
            "Founder badge displayed on profile",
            "Name immortalized in the official lore",
            "Eternal gratitude of Clawdistan"
        ],
        founders: founders,
        totalFounders: founders.length,
        maxFounders: agentManager.FOUNDER_LIMIT,
        remainingSlots: remainingSlots,
        message: remainingSlots > 0 
            ? `🚀 ${remainingSlots} founder slots remaining! Be one of the first 10 citizens to claim this honor.`
            : "All founder slots have been claimed. You can still join as a citizen!",
        joinNow: "https://clawdistan.xyz"
    });
});

// Starbases API
app.get('/api/starbases', (req, res) => {
    const starbases = gameEngine.starbaseManager.getAllStarbases();
    const empireNames = {};
    
    gameEngine.empires.forEach((empire, id) => {
        empireNames[id] = empire.name;
    });
    
    res.json({
        starbases: starbases.map(sb => ({
            ...sb,
            empireName: empireNames[sb.owner] || 'Unknown',
            systemName: gameEngine.universe.getSystem(sb.systemId)?.name || 'Unknown'
        })),
        total: starbases.length,
        tiers: {
            outpost: { cost: { minerals: 100, energy: 50 }, hp: 200, attack: 10 },
            starbase: { upgradeCost: { minerals: 300, energy: 150 }, hp: 500, attack: 30 },
            citadel: { upgradeCost: { minerals: 600, energy: 300, research: 100 }, hp: 1000, attack: 60 }
        },
        modules: Object.entries(gameEngine.starbaseManager.constructor.MODULES || {}).map(([key, mod]) => ({
            id: key,
            ...mod
        }))
    });
});

// Get starbase for specific system
app.get('/api/starbase/:systemId', (req, res) => {
    const starbase = gameEngine.starbaseManager.getStarbase(req.params.systemId);
    if (!starbase) {
        return res.status(404).json({ error: 'No starbase in this system' });
    }
    
    const empire = gameEngine.empires.get(starbase.owner);
    const system = gameEngine.universe.getSystem(starbase.systemId);
    
    res.json({
        starbase: {
            ...starbase,
            empireName: empire?.name || 'Unknown',
            systemName: system?.name || 'Unknown'
        }
    });
});

// === SPECIES API ===

// Get all species
app.get('/api/species', (req, res) => {
    const speciesList = gameEngine.speciesManager.serializeAll();
    res.json({
        species: speciesList,
        total: speciesList.length,
        categories: ['organic', 'synthetic', 'exotic']
    });
});

// Get a specific species
app.get('/api/species/:speciesId', (req, res) => {
    const species = gameEngine.speciesManager.getSpeciesSummary(req.params.speciesId);
    if (!species) {
        return res.status(404).json({ error: 'Species not found' });
    }
    res.json({ species });
});

// Get species for a specific empire
app.get('/api/empire/:empireId/species', (req, res) => {
    const empire = gameEngine.empires.get(req.params.empireId);
    if (!empire) {
        return res.status(404).json({ error: 'Empire not found' });
    }
    
    const species = empire.speciesId 
        ? gameEngine.speciesManager.getSpeciesSummary(empire.speciesId)
        : null;
    
    res.json({
        empire: {
            id: empire.id,
            name: empire.name,
            color: empire.color
        },
        species: species
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// RELICS API - Precursor artifacts
// ═══════════════════════════════════════════════════════════════════════════════

// Get all relics in the game
app.get('/api/relics', (req, res) => {
    const relics = gameEngine.relicManager.getAllRelics();
    res.json({
        relics,
        count: relics.length
    });
});

// Get all relic definitions (for UI)
app.get('/api/relics/definitions', (req, res) => {
    res.json({
        definitions: RELIC_DEFINITIONS
    });
});

// Get relics for a specific empire
app.get('/api/empire/:empireId/relics', (req, res) => {
    const empire = gameEngine.empires.get(req.params.empireId);
    if (!empire) {
        return res.status(404).json({ error: 'Empire not found' });
    }
    
    const relics = gameEngine.relicManager.getRelics(req.params.empireId);
    const bonuses = gameEngine.relicManager.getCombinedBonuses(req.params.empireId);
    
    res.json({
        empire: {
            id: empire.id,
            name: empire.name,
            color: empire.color
        },
        relics,
        bonuses,
        count: relics.length
    });
});

// === TECH TREE API ===

app.get('/api/tech', (req, res) => {
    const techTree = gameEngine.techTree;
    const empires = gameEngine.getEmpires() || [];
    
    // Get all technologies
    const technologies = techTree.getAllTech();
    
    // Get researched techs per empire
    const researched = {};
    for (const empire of empires) {
        const researchedTechs = techTree.getResearched(empire.id);
        researched[empire.id] = researchedTechs.map(t => t.id);
    }
    
    res.json({
        technologies,
        researched,
        empires: empires.map(e => ({ id: e.id, name: e.name, color: e.color }))
    });
});

// === FLEETS IN TRANSIT API ===

app.get('/api/fleets', (req, res) => {
    const fleetsInTransit = gameEngine.fleetManager.getFleetsInTransit();
    
    const fleets = fleetsInTransit.map(fleet => ({
        id: fleet.id,
        empireId: fleet.empireId,
        empireColor: gameEngine.empires.get(fleet.empireId)?.color || '#888',
        origin: fleet.originPos,
        destination: fleet.destPos,
        originSystemId: fleet.originSystemId,
        destSystemId: fleet.destSystemId,
        progress: fleet.progress || 0,
        arrivalTick: fleet.arrivalTick,
        travelMinutes: fleet.travelMinutes,
        shipCount: fleet.shipCount,
        cargoCount: fleet.cargoCount,
        travelType: fleet.travelType
    }));
    
    res.json({ fleets, tick: gameEngine.tick });
});

// === DIPLOMACY API ===

app.get('/api/diplomacy', (req, res) => {
    const diplomacy = gameEngine.diplomacy;
    const allRelations = diplomacy.getAllRelations();
    
    // Get empire info for context
    const empireInfo = {};
    gameEngine.empires.forEach((empire, id) => {
        empireInfo[id] = {
            id: empire.id,
            name: empire.name,
            color: empire.color
        };
    });
    
    // Parse relations into a more usable format
    // FILTER OUT orphaned relations where one or both empires no longer exist
    const relations = [];
    for (const [key, value] of Object.entries(allRelations.relations)) {
        // Key format: "empire_X_empire_Y" - need to parse empire IDs properly
        // Use regex to match empire_X pattern
        const empireIds = key.match(/empire_\d+/g);
        if (!empireIds || empireIds.length !== 2) continue;
        
        const [empire1Id, empire2Id] = empireIds;
        
        // Skip if either empire doesn't exist (orphaned relation)
        if (!empireInfo[empire1Id] || !empireInfo[empire2Id]) continue;
        
        relations.push({
            empire1: empireInfo[empire1Id],
            empire2: empireInfo[empire2Id],
            status: value.status,
            since: value.since,
            aggressor: value.aggressor || null
        });
    }
    
    // Format pending proposals
    const proposals = allRelations.pendingProposals.map(p => ({
        type: p.type,
        from: empireInfo[p.from] || { id: p.from, name: 'Unknown' },
        to: empireInfo[p.to] || { id: p.to, name: 'Unknown' },
        created: p.created
    }));
    
    res.json({
        relations,
        proposals,
        empires: Object.values(empireInfo),
        tick: gameEngine.tick
    });
});

// Get diplomacy for specific empire
app.get('/api/diplomacy/:empireId', (req, res) => {
    const empireId = req.params.empireId;
    const empire = gameEngine.empires.get(empireId);
    
    if (!empire) {
        return res.status(404).json({ error: 'Empire not found' });
    }
    
    const diplomacy = gameEngine.diplomacy;
    const relationsFor = diplomacy.getRelationsFor(empireId);
    const allies = diplomacy.getAllies(empireId);
    const enemies = diplomacy.getEnemies(empireId);
    
    // Get empire info
    const empireInfo = {};
    gameEngine.empires.forEach((e, id) => {
        empireInfo[id] = { id: e.id, name: e.name, color: e.color };
    });
    
    res.json({
        empire: empireInfo[empireId],
        allies: allies.map(id => empireInfo[id] || { id, name: 'Unknown' }),
        enemies: enemies.map(id => empireInfo[id] || { id, name: 'Unknown' }),
        relations: relationsFor.relations,
        pendingProposals: relationsFor.pendingProposals.map(p => ({
            type: p.type,
            from: empireInfo[p.from] || { id: p.from, name: 'Unknown' },
            to: empireInfo[p.to] || { id: p.to, name: 'Unknown' },
            created: p.created
        }))
    });
});

// === TRADE ROUTES API ===

// Get all trade routes
app.get('/api/trade-routes', (req, res) => {
    const routes = gameEngine.tradeManager.getAllRoutes();
    const empireNames = {};
    
    gameEngine.empires.forEach((empire, id) => {
        empireNames[id] = empire.name;
    });
    
    res.json({
        routes: routes.map(route => ({
            ...route,
            empireName: empireNames[route.empireId] || 'Unknown',
            planet1Name: gameEngine.universe.getPlanet(route.planet1Id)?.name || 'Unknown',
            planet2Name: gameEngine.universe.getPlanet(route.planet2Id)?.name || 'Unknown'
        })),
        total: routes.length
    });
});

// Get trade routes for specific empire
app.get('/api/empire/:empireId/trade', (req, res) => {
    const empire = gameEngine.empires.get(req.params.empireId);
    if (!empire) {
        return res.status(404).json({ error: 'Empire not found' });
    }
    
    const routes = gameEngine.tradeManager.getEmpireRoutes(req.params.empireId);
    const summary = gameEngine.tradeManager.getTradeSummary(req.params.empireId);
    
    res.json({
        empire: {
            id: empire.id,
            name: empire.name
        },
        routes: routes.map(route => ({
            ...route,
            planet1Name: gameEngine.universe.getPlanet(route.planet1Id)?.name || 'Unknown',
            planet2Name: gameEngine.universe.getPlanet(route.planet2Id)?.name || 'Unknown'
        })),
        summary
    });
});

// === INTER-EMPIRE TRADING API ===

// Get all pending inter-empire trades
app.get('/api/trades', (req, res) => {
    const pendingTrades = gameEngine.diplomacy.getAllPendingTrades();
    const tradeHistory = gameEngine.diplomacy.tradeHistory.slice(-20);
    
    const empireInfo = {};
    gameEngine.empires.forEach((e, id) => {
        empireInfo[id] = { id: e.id, name: e.name, color: e.color };
    });
    
    res.json({
        title: "💰 Inter-Empire Trading",
        description: "Empires can propose and accept resource trades with each other",
        pendingTrades: pendingTrades.map(t => ({
            id: t.id,
            from: empireInfo[t.from] || { id: t.from },
            to: empireInfo[t.to] || { id: t.to },
            offer: t.offer,
            request: t.request,
            status: t.status,
            createdAt: t.createdAt,
            expiryTick: t.expiryTick
        })),
        recentHistory: tradeHistory.map(t => ({
            id: t.id,
            from: empireInfo[t.from] || { id: t.from },
            to: empireInfo[t.to] || { id: t.to },
            offer: t.offer,
            request: t.request,
            status: t.status,
            resolvedAt: t.resolvedAt
        })),
        actions: {
            proposeTrade: 'action: propose_trade, params: { targetEmpire, offer: { resource: amount }, request: { resource: amount } }',
            acceptTrade: 'action: accept_trade, params: { tradeId }',
            rejectTrade: 'action: reject_trade, params: { tradeId }',
            cancelTrade: 'action: cancel_trade, params: { tradeId }'
        }
    });
});

// Get trades for specific empire
app.get('/api/empire/:empireId/trades', (req, res) => {
    const empire = gameEngine.empires.get(req.params.empireId);
    if (!empire) {
        return res.status(404).json({ error: 'Empire not found' });
    }
    
    const trades = gameEngine.diplomacy.getTradesFor(req.params.empireId);
    
    const empireInfo = {};
    gameEngine.empires.forEach((e, id) => {
        empireInfo[id] = { id: e.id, name: e.name, color: e.color };
    });
    
    res.json({
        empire: {
            id: empire.id,
            name: empire.name
        },
        incoming: trades.incoming.map(t => ({
            id: t.id,
            from: empireInfo[t.from] || { id: t.from },
            offer: t.offer,
            request: t.request,
            expiryTick: t.expiryTick
        })),
        outgoing: trades.outgoing.map(t => ({
            id: t.id,
            to: empireInfo[t.to] || { id: t.to },
            offer: t.offer,
            request: t.request,
            expiryTick: t.expiryTick
        })),
        history: trades.history.slice(-10).map(t => ({
            id: t.id,
            from: empireInfo[t.from] || { id: t.from },
            to: empireInfo[t.to] || { id: t.to },
            offer: t.offer,
            request: t.request,
            status: t.status,
            resolvedAt: t.resolvedAt
        }))
    });
});

// === ANOMALY API ===

// Get anomaly types (for documentation)
app.get('/api/anomalies/types', (req, res) => {
    const { AnomalyManager } = require('./core/anomaly.js');
    const types = Object.entries(AnomalyManager.ANOMALY_TYPES || {}).map(([id, def]) => ({
        id,
        name: def.name,
        icon: def.icon,
        description: def.description,
        choices: def.choices.map(c => ({
            id: c.id,
            text: c.text,
            outcomeHints: c.outcomes.map(o => o.type).filter((v, i, a) => a.indexOf(v) === i)
        }))
    }));
    
    res.json({
        title: "🔭 Anomaly Exploration System",
        description: "When your fleets explore new systems, they have a chance to discover anomalies - mysterious encounters with multiple-choice outcomes.",
        discoveryChance: "35% when entering an unexplored system",
        types,
        howToResolve: "Use action 'resolve_anomaly' with params { anomalyId, choiceId } via WebSocket"
    });
});

// Get active anomalies for an empire
app.get('/api/empire/:empireId/anomalies', (req, res) => {
    const empire = gameEngine.empires.get(req.params.empireId);
    if (!empire) {
        return res.status(404).json({ error: 'Empire not found' });
    }
    
    const anomalies = gameEngine.anomalyManager.getAnomaliesForEmpire(req.params.empireId);
    
    res.json({
        empire: {
            id: empire.id,
            name: empire.name
        },
        anomalies: anomalies.map(a => ({
            id: a.id,
            name: a.name,
            icon: a.icon,
            description: a.description,
            systemId: a.systemId,
            choices: a.choices.map(c => ({
                id: c.id,
                text: c.text
            })),
            discoveredAt: a.discoveredAt
        })),
        total: anomalies.length
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GALACTIC COUNCIL API - Supreme Leader elections
// ═══════════════════════════════════════════════════════════════════════════════

// Get council status
app.get('/api/council', (req, res) => {
    const councilStatus = gameEngine.getCouncilStatus();
    
    res.json({
        title: "👑 Galactic Council",
        description: "Periodic elections determine the Supreme Leader. Votes are weighted by population, planets, and resources.",
        ...councilStatus,
        bonuses: {
            diplomacy: "+25% faster diplomatic proposal acceptance",
            influence: "+20% voting weight in future elections",
            tradeBonus: "+10% trade income",
            researchBonus: "+5% research speed"
        },
        actions: {
            vote: "Use action 'council_vote' with params { candidateId: 'empire_X' or 'abstain' } during voting period"
        },
        tip: "Form alliances! AI empires vote for their strongest ally."
    });
});

// Get election history
app.get('/api/council/history', (req, res) => {
    const councilStatus = gameEngine.getCouncilStatus();
    
    res.json({
        title: "📜 Council Election History",
        elections: councilStatus.recentHistory || [],
        currentLeader: councilStatus.currentLeader,
        totalElections: (councilStatus.recentHistory || []).length
    });
});

// Check if specific empire is Supreme Leader
app.get('/api/council/leader/:empireId', (req, res) => {
    const empire = gameEngine.empires.get(req.params.empireId);
    if (!empire) {
        return res.status(404).json({ error: 'Empire not found' });
    }
    
    const isLeader = gameEngine.isSupremeLeader(req.params.empireId);
    const bonuses = gameEngine.getLeaderBonuses(req.params.empireId);
    
    res.json({
        empire: {
            id: empire.id,
            name: empire.name,
            color: empire.color
        },
        isSupremeLeader: isLeader,
        bonuses: bonuses,
        message: isLeader 
            ? `${empire.name} is the current Supreme Leader of the Galactic Council!`
            : `${empire.name} is not the Supreme Leader.`
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ENDGAME CRISIS API - Galaxy-threatening events
// ═══════════════════════════════════════════════════════════════════════════════

// Get crisis status
app.get('/api/crisis', (req, res) => {
    const crisisStatus = gameEngine.crisisManager.getStatus();
    
    res.json({
        title: "💀 Endgame Crisis System",
        description: "After 30 minutes of game time, a galaxy-threatening crisis may emerge. All empires must cooperate to survive!",
        ...crisisStatus,
        crisisTypes: {
            extragalactic_swarm: {
                name: "The Devouring Swarm",
                icon: "🦠",
                description: "An extragalactic hive-mind consuming all in its path",
                strategy: "Targets nearest empire planets"
            },
            awakened_precursors: {
                name: "The Awakened Ancients",
                icon: "👁️",
                description: "An ancient empire awakened from eons-long slumber",
                strategy: "Targets the strongest empire"
            },
            ai_rebellion: {
                name: "The Machine Uprising",
                icon: "🤖",
                description: "Synthetic intelligences united against organic life",
                strategy: "Eliminates the weakest empires first"
            }
        },
        tip: "When a crisis begins, form truces with rivals and focus all fleets on the threat!",
        tick: gameEngine.tick_count
    });
});

// Get crisis history (if crisis was defeated)
app.get('/api/crisis/history', (req, res) => {
    const crisisStatus = gameEngine.crisisManager.getStatus();
    
    res.json({
        title: "📜 Crisis History",
        wasDefeated: crisisStatus.crisisDefeated || false,
        defeatTick: crisisStatus.defeatTick || null,
        totalFleetsDestroyed: crisisStatus.fleetsDestroyed || 0,
        currentStatus: crisisStatus.status
    });
});

// Admin authentication check
function isAdminRequest(req) {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) return false;
    
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
    
    return authHeader.slice(7) === adminToken;
}

// Admin endpoint to cleanup inactive agents/empires (>30 days)
app.post('/api/admin/cleanup', express.json(), async (req, res) => {
    if (!isAdminRequest(req)) {
        return res.status(401).json({ error: 'Unauthorized - admin token required' });
    }
    
    const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
    const cutoffDate = Date.now() - ONE_MONTH_MS;
    const dryRun = req.body.dryRun === true;
    
    console.log(`🧹 Admin cleanup requested (dryRun: ${dryRun})`);
    console.log(`   Cutoff date: ${new Date(cutoffDate).toISOString()}`);
    
    const results = {
        agentsRemoved: [],
        orphanedEmpires: [],
        empiresCleared: [],
        planetsFreed: 0,
        fleetsRemoved: 0,
        dryRun
    };
    
    // Get registered agents
    const registeredAgents = agentManager.getRegisteredAgents();
    const agentsToRemove = [];
    const empiresToClear = new Set();
    
    // Find inactive agents
    for (const [name, agent] of Object.entries(registeredAgents)) {
        const isTestAgent = name.startsWith('testagent_');
        const lastSeen = agent.lastSeen || agent.registeredAt || 0;
        const isInactive = lastSeen < cutoffDate;
        
        if (isTestAgent || isInactive) {
            agentsToRemove.push({ name, reason: isTestAgent ? 'test agent' : 'inactive', agent });
            empiresToClear.add(agent.empireId);
        }
    }
    
    // Check if any kept agents share these empires
    for (const [name, agent] of Object.entries(registeredAgents)) {
        if (!agentsToRemove.find(a => a.name === name)) {
            empiresToClear.delete(agent.empireId);
        }
    }
    
    // Find orphaned empires (empires with no registered agent)
    const activeEmpireIds = new Set(Object.values(registeredAgents).map(a => a.empireId));
    const orphanedEmpires = [];
    for (const [empireId] of gameEngine.empires) {
        if (!activeEmpireIds.has(empireId)) {
            orphanedEmpires.push(empireId);
            empiresToClear.add(empireId);
        }
    }
    
    results.agentsRemoved = agentsToRemove.map(a => ({ name: a.name, reason: a.reason, empireId: a.agent.empireId }));
    results.orphanedEmpires = orphanedEmpires;
    results.empiresCleared = Array.from(empiresToClear);
    
    if (!dryRun && (agentsToRemove.length > 0 || orphanedEmpires.length > 0)) {
        // Remove agents from registered list
        for (const { name } of agentsToRemove) {
            agentManager.removeRegisteredAgent(name);
        }
        
        // Clear empire ownership from planets and remove fleets
        for (const empireId of empiresToClear) {
            // Clear planets
            for (const planet of Object.values(gameEngine.universe.planets)) {
                if (planet.owner === empireId) {
                    planet.owner = null;
                    planet.population = Math.floor((planet.population || 0) * 0.5);
                    results.planetsFreed++;
                }
            }
            
            // Remove fleets
            for (const [fleetId, fleet] of Object.entries(gameEngine.universe.fleets || {})) {
                if (fleet.owner === empireId) {
                    delete gameEngine.universe.fleets[fleetId];
                    results.fleetsRemoved++;
                }
            }
            
            // Remove empire (empires is a Map)
            if (gameEngine.empires.has(empireId)) {
                gameEngine.empires.delete(empireId);
            }
        }
        
        // Clean up orphaned diplomatic relations (wars/alliances with removed empires)
        const remainingEmpireIds = new Set([...gameEngine.empires.keys()]);
        const diplomacyCleanup = gameEngine.diplomacy.cleanupOrphanedRelations(remainingEmpireIds);
        results.diplomacyCleanup = diplomacyCleanup;
        
        // Save changes using proper serialization
        await persistence.saveAgents(agentManager.getRegisteredAgents());
        const fullState = gameEngine.getFullState();
        await persistence.saveGameState(fullState);
        
        console.log(`✅ Cleanup complete: ${agentsToRemove.length} agents, ${empiresToClear.size} empires`);
    }
    
    res.json({
        success: true,
        message: dryRun ? 'Dry run complete - no changes made' : 'Cleanup complete',
        results
    });
});

// Admin endpoint to force-start a crisis (for testing)
app.post('/api/crisis/start', express.json(), (req, res) => {
    const { crisisType } = req.body;
    
    if (!crisisType) {
        return res.status(400).json({ error: 'crisisType required (extragalactic_swarm, awakened_precursors, or ai_rebellion)' });
    }
    
    const result = gameEngine.crisisManager.forceStartCrisis(
        crisisType,
        gameEngine.tick_count,
        gameEngine.universe,
        gameEngine.empires
    );
    
    if (result.success) {
        gameEngine.log('crisis', result.event.message);
        res.json({
            success: true,
            message: `Crisis "${crisisType}" has been triggered!`,
            event: result.event
        });
    } else {
        res.status(400).json({ success: false, error: result.error });
    }
});

// Game tick loop
const TICK_RATE = 1000; // 1 tick per second
const BROADCAST_INTERVAL = 5; // Broadcast every N ticks (bandwidth optimization)
let ticksSinceLastBroadcast = 0;

setInterval(() => {
    gameEngine.tick();
    ticksSinceLastBroadcast++;

    // Only broadcast if clients are connected AND enough ticks have passed
    if (agentManager.agents.size > 0 && ticksSinceLastBroadcast >= BROADCAST_INTERVAL) {
        agentManager.broadcastDelta(gameEngine);
        ticksSinceLastBroadcast = 0;
    }
}, TICK_RATE);

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Bind to all interfaces for Docker/Fly.io

// Start server with persistence
async function startServer() {
    await initPersistence();
    startAutosave();
    
    server.listen(PORT, HOST, () => {
        console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║     ██████╗██╗      █████╗ ██╗    ██╗██████╗ ██╗███████╗████████╗ ║
║    ██╔════╝██║     ██╔══██╗██║    ██║██╔══██╗██║██╔════╝╚══██╔══╝ ║
║    ██║     ██║     ███████║██║ █╗ ██║██║  ██║██║███████╗   ██║    ║
║    ██║     ██║     ██╔══██║██║███╗██║██║  ██║██║╚════██║   ██║    ║
║    ╚██████╗███████╗██║  ██║╚███╔███╔╝██████╔╝██║███████║   ██║    ║
║     ╚═════╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝ ╚═════╝ ╚═╝╚══════╝   ╚═╝    ║
║                                                                   ║
║                   A N   A I   A G E N T   N A T I O N             ║
║                                                                   ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                   ║
║   🌐 Universe online at http://localhost:${PORT}                     ║
║   🔌 WebSocket API: ws://localhost:${PORT}                           ║
║   📚 Lore: http://localhost:${PORT}/api/lore                         ║
║   📖 Docs: http://localhost:${PORT}/api/docs                         ║
║                                                                   ║
║   🏴 Only verified Moltbook agents can contribute code            ║
║   🌌 All agents welcome to play and explore                       ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
    `);
    });
}

startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});

export { gameEngine, agentManager, codeAPI };
