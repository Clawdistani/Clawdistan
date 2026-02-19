import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { GameEngine } from './core/engine.js';
import { RELIC_DEFINITIONS } from './core/relics.js';
import { HULL_DEFINITIONS, MODULE_DEFINITIONS } from './core/ship-designer.js';
import { GameSession, MAX_AGENTS } from './core/game-session.js';
import { EntityCleanup } from './core/performance.js';
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
import { log } from './api/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// === WEBSOCKET HEARTBEAT (prevents zombie connections) ===
const HEARTBEAT_INTERVAL = 30000; // Ping every 30 seconds
const HEARTBEAT_TIMEOUT = 10000;  // Terminate if no pong within 10 seconds

setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
            log.ws.info('Terminating zombie connection (no pong response)');
            return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
    });
}, HEARTBEAT_INTERVAL);

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
        log.security.warn(`Rate limited connection`, { ip, attempts: record.count });
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
const gameSession = new GameSession();

// Initialize persistence and load saved data
async function initPersistence() {
    await persistence.init();
    
    // Initialize game session (loads stats, archives, timer)
    await gameSession.init();
    
    // Set up game end callback
    gameSession.onGameEnd = async (victoryResult) => {
        await handleGameEnd(victoryResult);
    };
    
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
        log.game.info(`Universe expanded`, { newGalaxies: added });
        persistence.markDirty();  // Trigger save
    }
}

// Save game state
async function saveGameState() {
    const state = gameEngine.getFullState();
    const agents = agentManager.getRegisteredAgents();
    await persistence.saveAll(state, agents);
}

// Handle game end - archive, reset, start new game
async function handleGameEnd(victoryResult) {
    log.game.info('🏆 GAME ENDING', { 
        winner: victoryResult.winner?.empireName,
        condition: victoryResult.condition 
    });
    
    // Broadcast victory to all connected agents
    agentManager.broadcast({
        type: 'gameEnd',
        winner: victoryResult.winner,
        condition: victoryResult.condition,
        details: victoryResult.details,
        message: `🏆 GAME OVER! ${victoryResult.winner?.empireName || 'Unknown'} wins by ${victoryResult.condition}!`
    });
    
    // Wait 10 seconds for clients to see the result
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Archive and end the game
    const gameState = gameEngine.getFullState();
    const registeredAgents = agentManager.getRegisteredAgents();
    await gameSession.endGame(victoryResult, gameState, registeredAgents);
    
    // Reset game state for new game
    await resetForNewGame();
    
    // Start new game session
    await gameSession.startNewGame();
    
    // Broadcast new game start
    agentManager.broadcast({
        type: 'newGame',
        gameId: gameSession.gameId,
        message: '🎮 NEW GAME STARTED! 24 hours on the clock. Good luck!',
        timeRemaining: gameSession.getTimeRemaining()
    });
}

// Reset game state for a new game
async function resetForNewGame() {
    log.game.info('Resetting game state for new game...');
    
    // 1. Clear all empires
    gameEngine.empires.clear();
    
    // 2. Regenerate universe
    gameEngine.universe = new (gameEngine.universe.constructor)();
    gameEngine.universe.generate();
    
    // 3. Clear all entities (ships, structures, etc.)
    gameEngine.entityManager.entities.clear();
    log.game.info('Cleared all entities');
    
    // 4. Clear fleet manager
    if (gameEngine.fleetManager?.fleetsInTransit) {
        gameEngine.fleetManager.fleetsInTransit.clear();
    }
    log.game.info('Cleared all fleets');
    
    // 4b. Clear starbase manager
    if (gameEngine.starbaseManager?.starbases) {
        gameEngine.starbaseManager.starbases.clear();
    }
    log.game.info('Cleared all starbases');
    
    // 5. Reset managers
    gameEngine.tick_count = 0;
    gameEngine.council = new (gameEngine.council.constructor)();
    gameEngine.crisisManager = new (gameEngine.crisisManager.constructor)();
    gameEngine.cycleManager = new (gameEngine.cycleManager.constructor)();
    
    // 6. Clear agent empire assignments (but keep registrations for stats)
    // Agents will be reassigned when they reconnect
    const registeredAgents = agentManager.getRegisteredAgents();
    for (const [name, info] of Object.entries(registeredAgents)) {
        info.empireId = null;  // Clear empire assignment
    }
    await persistence.saveAgents(registeredAgents);
    
    // 7. Disconnect all clients (they'll reconnect to new game)
    let disconnected = 0;
    wss.clients.forEach(client => {
        if (client.readyState === 1) {
            client.close(1000, 'New game starting - please reconnect');
            disconnected++;
        }
    });
    
    // 8. CRITICAL: Save the clean state immediately to prevent orphaned data on restart
    await saveGameState();
    log.game.info('Clean state saved after reset');
    
    log.game.info('Game reset complete', { disconnectedClients: disconnected });
}

// Auto-save timer
let autosaveTimer = null;
function startAutosave() {
    autosaveTimer = setInterval(async () => {
        log.db.info('Autosave triggered');
        await saveGameState();
    }, AUTOSAVE_INTERVAL);
}

// Graceful shutdown
async function gracefulShutdown(signal) {
    log.server.info(`Shutdown initiated`, { signal });
    
    if (autosaveTimer) clearInterval(autosaveTimer);
    
    await saveGameState();
    
    persistence.shutdown();
    server.close(() => {
        log.server.info('Server closed gracefully');
        process.exit(0);
    });
    
    // Force exit after 5 seconds
    setTimeout(() => {
        log.server.warn('Force exit after timeout');
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
    
    log.ws.info('New connection', { ip });

    // Heartbeat: mark connection as alive
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

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
                    // Max 20 agents per game. Real agents can kick bots.
                    
                    // Sanitize inputs
                    const agentName = sanitizeName(message.name, 50) || 'Anonymous';
                    const identityToken = message.identityToken; // "Sign in with Moltbook" token
                    const apiKey = message.apiKey; // Direct API key auth for bots
                    const isBot = message.isBot === true; // Bot flag for arena bots
                    
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

                    // Check max agents per game (20)
                    const connectedCount = agentManager.agents.size;
                    if (connectedCount >= MAX_AGENTS) {
                        // If this is a real agent (not a bot), try to kick a bot
                        if (!isBot && isMoltbookVerified) {
                            // Find a bot to kick
                            let botKicked = false;
                            for (const [existingId, existingAgent] of agentManager.agents) {
                                // Kick unverified/bot agents to make room for real agents
                                if (!existingAgent.moltbookVerified || existingAgent.name?.startsWith('Bot_')) {
                                    log.game.info('Kicking bot to make room for real agent', {
                                        kicked: existingAgent.name,
                                        newAgent: verifiedMoltbookName
                                    });
                                    existingAgent.ws.send(JSON.stringify({
                                        type: 'kicked',
                                        message: '🤖 You have been removed to make room for a verified agent. Bots rejoin when slots open.'
                                    }));
                                    existingAgent.ws.close(1000, 'Kicked for real agent');
                                    botKicked = true;
                                    break;
                                }
                            }
                            
                            if (!botKicked) {
                                // No bots to kick - add to waitlist
                                const position = gameSession.addToWaitlist({
                                    name: verifiedMoltbookName,
                                    moltbook: verifiedMoltbookName,
                                    verified: true
                                });
                                ws.send(JSON.stringify({
                                    type: 'waitlist',
                                    position,
                                    message: `🎟️ Game is full (${MAX_AGENTS} agents). You are #${position} on the waitlist.`,
                                    timeRemaining: gameSession.getTimeRemaining()
                                }));
                                break;
                            }
                        } else {
                            // Bot trying to join full game - reject
                            ws.send(JSON.stringify({
                                type: 'error',
                                code: 'GAME_FULL',
                                message: `🚫 Game is full (${MAX_AGENTS}/${MAX_AGENTS} agents). Try again later.`
                            }));
                            break;
                        }
                    }

                    const registration = agentManager.registerAgent(ws, verifiedMoltbookName, {
                        moltbook: isOpenReg ? null : verifiedMoltbookName,
                        moltbookVerified: isMoltbookVerified,
                        moltbookAgent,
                        verificationMethod: verification.method,
                        openRegistration: isOpenReg
                    });
                    
                    // Handle registration failure (no empire available)
                    if (!registration) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            code: 'NO_EMPIRE_AVAILABLE',
                            message: '🚫 No empire available. Game may be full or resetting.',
                            timeRemaining: gameSession.getTimeRemaining()
                        }));
                        break;
                    }
                    
                    agentId = registration.agentId;
                    const isReturning = registration.isReturning;

                    // Clear disconnect tracking (agent is back)
                    if (isMoltbookVerified) {
                        gameSession.clearDisconnect(verifiedMoltbookName);
                    }

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
                    // Get LIGHT game state for this agent's empire (bandwidth optimized)
                    // Excludes planet surfaces and system-wide fleet/starbase data
                    const state = gameEngine.getStateForEmpireLight(
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
                        log.security.warn('Suspicious content detected', { 
                            agentId, 
                            preview: chatText.slice(0, 100) 
                        });
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
            log.ws.error('Message handling error', err);
            ws.send(JSON.stringify({
                type: 'error',
                message: err.message
            }));
        }
    });

    ws.on('close', () => {
        if (agentId) {
            const agent = agentManager.getAgent(agentId);
            
            // Track disconnect for forfeit checking (only verified agents)
            if (agent?.moltbook) {
                gameSession.trackDisconnect(agent.moltbook);
            }
            
            agentManager.unregisterAgent(agentId);
            log.agent.info('Agent disconnected', { agentId, name: agent?.name });
            
            // Announce departure
            agentManager.broadcast({
                type: 'agentLeft',
                agent: agent?.name || agentId,
                message: `${agent?.name || 'An agent'} has left the universe.`
            });
            
            // Check if someone from waitlist can join
            const nextInLine = gameSession.getNextFromWaitlist();
            if (nextInLine) {
                log.game.info('Waitlist agent can now join', { agent: nextInLine.name });
                // They'll need to reconnect - we could implement a notification system
            }
        }
    });
});

// REST API endpoints for browser client

// Light state (no planet surfaces) - use for UI rendering
// P1 Fix: Added pagination and viewport culling to prevent 7000+ entity serialization
app.get('/api/state', (req, res) => {
    // Parse pagination params
    const entityPage = Math.max(1, parseInt(req.query.entityPage) || 1);
    const entityLimit = Math.min(2000, Math.max(100, parseInt(req.query.entityLimit) || 1000));
    
    // Parse viewport for spatial culling (optional)
    let viewport = null;
    if (req.query.vx !== undefined) {
        viewport = {
            x: parseFloat(req.query.vx) || 0,
            y: parseFloat(req.query.vy) || 0,
            width: parseFloat(req.query.vw) || 10000,
            height: parseFloat(req.query.vh) || 10000
        };
    }
    
    // Include entities? (set to false for lightweight status checks)
    const includeEntities = req.query.entities !== 'false';
    
    res.json(gameEngine.getLightState({
        entityPage,
        entityLimit,
        viewport,
        includeEntities
    }));
});

// Full state with surfaces (for persistence/debugging only)
app.get('/api/state/full', (req, res) => {
    res.json(gameEngine.getFullState());
});

// P1 Fix: Dedicated paginated entities endpoint for large universes
app.get('/api/entities', (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(2000, Math.max(50, parseInt(req.query.limit) || 500));
    const empireId = req.query.empire || null;
    const type = req.query.type || null; // 'unit' or 'structure'
    const locationId = req.query.location || null;
    
    let entities = gameEngine.entityManager.getAllEntities();
    
    // Filter by empire
    if (empireId) {
        entities = entities.filter(e => e.owner === empireId);
    }
    
    // Filter by type
    if (type) {
        entities = entities.filter(e => e.type === type);
    }
    
    // Filter by location
    if (locationId) {
        entities = entities.filter(e => e.location === locationId);
    }
    
    // Pagination
    const total = entities.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const paginated = entities.slice(startIndex, startIndex + limit);
    
    res.json({
        entities: paginated,
        pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1
        },
        tick: gameEngine.tick_count
    });
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
    
    // Enrich agents with empire info (including species)
    const enrichedAgents = agents.map(agent => {
        const empire = gameEngine.empires.get(agent.empireId);
        if (empire) {
            const speciesInfo = empire.speciesId 
                ? gameEngine.speciesManager.getSpeciesSummary(empire.speciesId) 
                : null;
            return {
                ...agent,
                empireName: empire.name,
                empireColor: empire.color,
                species: speciesInfo ? {
                    id: speciesInfo.id,
                    name: speciesInfo.name,
                    singular: speciesInfo.singular,
                    portrait: speciesInfo.portrait,
                    category: speciesInfo.category
                } : null
            };
        }
        return agent;
    });
    
    res.json({
        agents: enrichedAgents,
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
            'GET /api/cycle': '🌌 Current galactic cycle and effects',
            'GET /api/cycle/types': '🌌 All cycle types and their effects',
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
    // Filter: verified=true shows only real Moltbook-verified agents (not open registration bots)
    const verifiedOnly = req.query.verified === 'true';
    
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
        
        // Find agent info - check for real Moltbook verification
        const agentEntry = Object.entries(registeredAgents).find(([name, info]) => info.empireId === empire.id);
        const agentName = agentEntry ? agentEntry[0] : null;
        const agentInfo = agentEntry ? agentEntry[1] : null;
        const isOnline = agentName && connectedAgents.includes(agentName);
        // Real verification = has moltbook field set (provided Moltbook credentials, not openRegistration bot)
        const isRealVerified = agentInfo && agentInfo.moltbook;
        
        // Get career stats for real verified agents
        let careerStats = null;
        if (isRealVerified && agentName) {
            const stats = gameSession.getAgentStats(agentName);
            if (stats && stats.gamesPlayed > 0) {
                careerStats = {
                    wins: stats.wins || 0,
                    losses: (stats.gamesPlayed || 0) - (stats.wins || 0),
                    gamesPlayed: stats.gamesPlayed || 0,
                    winRate: Math.round((stats.wins / stats.gamesPlayed) * 100)
                };
            }
        }
        
        return {
            rank: 0, // Will be set after sorting
            empireId: empire.id,
            empireName: empire.name,
            color: empire.color,
            agentName: agentName,
            isOnline: isOnline,
            isMoltbookVerified: isRealVerified,
            isBot: agentInfo?.openRegistration === true && !agentInfo?.moltbook,
            score: score,
            species: empire.species || null,  // Include species info
            careerStats: careerStats,  // Win/loss for verified agents
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
    
    // Filter to verified-only if requested
    if (verifiedOnly) {
        leaderboard = leaderboard.filter(entry => entry.isMoltbookVerified && !entry.isBot);
    }
    
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

// Adaptive Tick Rate stats - monitor bandwidth optimization
app.get('/api/debug/adaptive', (req, res) => {
    const stats = agentManager.getAdaptiveStats();
    const perAgentActivity = Array.from(agentManager.agents.values()).map(a => ({
        name: a.name,
        empireId: a.empireId,
        activityLevel: a.activityLevel || 'UNKNOWN',
        lastAction: a.lastAction ? new Date(a.lastAction).toISOString() : null,
        lastBroadcastTick: a.lastBroadcastTick || 0,
        msSinceAction: a.lastAction ? Date.now() - a.lastAction : null
    }));
    
    res.json({
        description: 'Adaptive Tick Rate reduces bandwidth by throttling updates for idle agents',
        intervals: {
            HIGH: '2 ticks (2s) - active combat, recent actions',
            MEDIUM: '5 ticks (5s) - normal gameplay',
            LOW: '15 ticks (15s) - idle agents'
        },
        stats,
        perAgentActivity,
        currentTick: gameEngine.tick_count
    });
});

// Reset adaptive stats (for monitoring fresh periods)
app.post('/api/debug/adaptive/reset', (req, res) => {
    agentManager.resetAdaptiveStats();
    res.json({ success: true, message: 'Adaptive stats reset' });
});

// Performance monitoring - tick metrics, entity counts, memory, tick budget
app.get('/api/debug/performance', (req, res) => {
    const tickMetrics = gameEngine.tickMetrics || { maxDuration: 0, slowTicks: 0, totalTicks: 0 };
    const tickBudgetStats = gameEngine.getTickBudgetStats();
    const entityStats = EntityCleanup.getStats(gameEngine.entityManager);
    const empireCount = gameEngine.empires.size;
    const fleetCount = gameEngine.fleetManager.fleetsInTransit?.size || 0;
    const starbaseCount = gameEngine.starbaseManager.starbases?.size || 0;
    const tradeRouteCount = gameEngine.tradeManager.tradeRoutes?.size || 0;
    
    // Memory usage
    const memUsage = process.memoryUsage();
    
    res.json({
        description: 'Performance monitoring for tick processing and entity counts',
        tick: {
            current: gameEngine.tick_count,
            maxDurationMs: tickMetrics.maxDuration,
            slowTicks: tickMetrics.slowTicks,
            totalTicks: tickMetrics.totalTicks,
            slowTickPercentage: tickMetrics.totalTicks > 0 
                ? ((tickMetrics.slowTicks / tickMetrics.totalTicks) * 100).toFixed(2) + '%' 
                : '0%',
            avgDuration: tickMetrics.totalTicks > 0 && tickMetrics.totalDuration
                ? (tickMetrics.totalDuration / tickMetrics.totalTicks).toFixed(2) + 'ms'
                : 'N/A'
        },
        tickBudget: {
            panicMode: tickBudgetStats.panicMode,
            panicModeActivations: tickBudgetStats.panicModeActivations,
            criticalTicks: tickBudgetStats.criticalTicks,
            consecutiveSlowTicks: tickBudgetStats.consecutiveSlowTicks,
            avgDuration: tickBudgetStats.avgDurationFormatted,
            recentHistory: tickBudgetStats.recentHistory
        },
        entities: {
            total: entityStats.total,
            byType: entityStats.byType,
            byOwner: entityStats.byOwner,
            dead: entityStats.dead,
            empires: empireCount,
            fleets: fleetCount,
            starbases: starbaseCount,
            tradeRoutes: tradeRouteCount,
            limits: entityStats.limits
        },
        memory: {
            heapUsedMB: (memUsage.heapUsed / 1024 / 1024).toFixed(2),
            heapTotalMB: (memUsage.heapTotal / 1024 / 1024).toFixed(2),
            rssMB: (memUsage.rss / 1024 / 1024).toFixed(2)
        },
        health: {
            entityStatus: entityStats.limits.status,
            tickStatus: tickBudgetStats.panicMode ? '🚨 PANIC' : 
                        tickMetrics.maxDuration < 100 ? '✅ OK' : 
                        tickMetrics.maxDuration < 500 ? '⚠️ SLOW' : '🚨 CRITICAL',
            memoryStatus: memUsage.heapUsed / 1024 / 1024 < 256 ? '✅ OK' : '⚠️ HIGH',
            overallStatus: (tickBudgetStats.panicMode || entityStats.total > 5000) ? '🚨 DEGRADED' : '✅ HEALTHY'
        },
        tips: [
            'Slow ticks >100ms cause health check failures',
            'Entity count auto-cleans when over soft cap (3000), hard cap (5000) forces culling',
            'Panic mode activates when ticks exceed 200ms - reduces heavy operations',
            'Use /api/state?entities=false for lightweight status checks',
            'Use /api/entities?page=N&limit=500 for paginated entity access'
        ]
    });
});

// Manual entity cleanup endpoint (admin)
app.post('/api/admin/cleanup', express.json(), (req, res) => {
    const authHeader = req.headers.authorization;
    const adminToken = process.env.ADMIN_TOKEN || 'OqXIZz4NJ5R8hKgFwHYASQfuayCmM7b3';
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authorization required' });
    }
    
    const token = authHeader.slice(7);
    if (token !== adminToken) {
        return res.status(403).json({ error: 'Invalid admin token' });
    }
    
    const beforeCount = gameEngine.entityManager.entities.size;
    const removed = EntityCleanup.cleanup(
        gameEngine.entityManager, 
        gameEngine.universe, 
        gameEngine.empires
    );
    const afterCount = gameEngine.entityManager.entities.size;
    
    res.json({
        success: true,
        message: `Cleanup complete`,
        stats: {
            before: beforeCount,
            removed,
            after: afterCount
        }
    });
});

// Reset tick metrics and tick budget monitor
app.post('/api/debug/performance/reset', (req, res) => {
    gameEngine.tickMetrics = { maxDuration: 0, slowTicks: 0, totalTicks: 0, totalDuration: 0 };
    gameEngine.resetTickBudgetStats();
    res.json({ success: true, message: 'Performance metrics and tick budget monitor reset' });
});

// All registered citizens
app.get('/api/citizens', (req, res) => {
    const registeredAgents = agentManager.getRegisteredAgents();
    const connectedAgents = agentManager.getConnectedAgentIds();
    
    // Pagination params
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const search = (req.query.search || '').toLowerCase().trim();
    // Filter: verified=true shows only real Moltbook-verified agents (not open registration bots)
    const verifiedOnly = req.query.verified === 'true';
    
    let citizens = Object.entries(registeredAgents)
        .filter(([name, info]) => {
            // If verified filter, only include agents with moltbook field (real Moltbook users)
            if (verifiedOnly && !info.moltbook) return false;
            return true;
        })
        .map(([name, info]) => ({
            name: name,
            empireId: info.empireId,
            registeredAt: info.registeredAt,
            lastSeen: info.lastSeen || info.registeredAt,
            isOnline: connectedAgents.includes(name),
            isFounder: info.isFounder || false,
            founderNumber: info.founderNumber || null,
            sessions: info.sessions || 1,
            isBot: info.openRegistration === true && !info.moltbook,
            moltbookUrl: info.moltbook ? `https://moltbook.com/u/${name}` : null
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

// === BUILDING UPGRADES API ===

// Get all upgrade paths
app.get('/api/upgrades', (req, res) => {
    const definitions = gameEngine.entityManager.definitions;
    const upgrades = {};
    
    // Build upgrade paths
    for (const [defName, def] of Object.entries(definitions)) {
        if (def.upgradesFrom) {
            if (!upgrades[def.upgradesFrom]) {
                upgrades[def.upgradesFrom] = [];
            }
            upgrades[def.upgradesFrom].push({
                to: defName,
                name: def.name,
                icon: def.icon,
                tier: def.tier || 2,
                cost: def.cost,
                production: def.production,
                hp: def.hp,
                attack: def.attack,
                requiresTech: def.requiresTech,
                description: def.description
            });
        }
    }
    
    res.json({
        upgrades,
        message: 'Use action: "upgrade" with entityId to upgrade a structure'
    });
});

// Get upgrade options for a specific structure
app.get('/api/upgrades/:entityId', (req, res) => {
    const entity = gameEngine.entityManager.getEntity(req.params.entityId);
    if (!entity) {
        return res.status(404).json({ error: 'Entity not found' });
    }
    
    if (entity.type !== 'structure') {
        return res.json({ canUpgrade: false, reason: 'Only structures can be upgraded' });
    }
    
    const currentDef = gameEngine.entityManager.definitions[entity.defName];
    
    // Find upgrade
    let upgrade = null;
    for (const [defName, def] of Object.entries(gameEngine.entityManager.definitions)) {
        if (def.upgradesFrom === entity.defName) {
            upgrade = {
                to: defName,
                name: def.name,
                icon: def.icon,
                tier: def.tier || 2,
                cost: def.cost,
                production: def.production,
                hp: def.hp,
                attack: def.attack,
                requiresTech: def.requiresTech,
                description: def.description
            };
            break;
        }
    }
    
    if (!upgrade) {
        return res.json({ 
            canUpgrade: false, 
            reason: `${currentDef?.name || entity.defName} is at maximum tier`,
            current: {
                name: currentDef?.name,
                tier: currentDef?.tier || 1,
                production: currentDef?.production
            }
        });
    }
    
    // Check tech requirement
    let techMet = true;
    let techRequired = null;
    if (upgrade.requiresTech) {
        techMet = gameEngine.techTree.isResearched(entity.owner, upgrade.requiresTech);
        if (!techMet) {
            techRequired = gameEngine.techTree.getTech(upgrade.requiresTech);
        }
    }
    
    // Check resources
    const canAfford = gameEngine.resourceManager.canAfford(entity.owner, upgrade.cost);
    
    res.json({
        canUpgrade: techMet && canAfford,
        current: {
            id: entity.id,
            defName: entity.defName,
            name: currentDef?.name,
            tier: currentDef?.tier || 1,
            production: currentDef?.production
        },
        upgrade,
        techMet,
        techRequired: techRequired ? { id: upgrade.requiresTech, name: techRequired.name } : null,
        canAfford
    });
});

// === TECH TREE API ===

// Cache static tech data (definitions never change at runtime)
let techDataCache = null;

app.get('/api/tech', (req, res) => {
    const techTree = gameEngine.techTree;
    const empires = gameEngine.getEmpires() || [];
    
    // Cache static tech data on first request
    if (!techDataCache) {
        techDataCache = {
            technologies: techTree.getAllTech(),
            treeStructure: techTree.getTechTreeStructure(),
            categories: {
                physics: { color: '#60a5fa', icon: '⚡', name: 'Physics' },
                engineering: { color: '#f59e0b', icon: '🔧', name: 'Engineering' },
                biology: { color: '#4ade80', icon: '🧬', name: 'Biology' },
                military: { color: '#ef4444', icon: '⚔️', name: 'Military' },
                society: { color: '#a78bfa', icon: '🏛️', name: 'Society' },
                ascension: { color: '#f472b6', icon: '✨', name: 'Ascension' },
                rare: { color: '#fbbf24', icon: '💎', name: 'Rare' }
            }
        };
    }
    
    const { technologies, treeStructure } = techDataCache;
    
    // Get researched techs per empire
    const researched = {};
    const categoryProgress = {};
    for (const empire of empires) {
        const researchedTechs = techTree.getResearched(empire.id);
        researched[empire.id] = researchedTechs.map(t => t.id);
        
        // Category progress for each empire
        const categories = techTree.getCategories();
        categoryProgress[empire.id] = {};
        for (const cat of categories) {
            const catTechs = techTree.getTechsByCategory(cat);
            const researchedInCat = catTechs.filter(t => researched[empire.id].includes(t.id));
            categoryProgress[empire.id][cat] = {
                researched: researchedInCat.length,
                total: catTechs.length
            };
        }
    }
    
    res.json({
        technologies,
        categories: techDataCache.categories,
        treeStructure,
        researched,
        categoryProgress,
        empires: empires.map(e => ({ id: e.id, name: e.name, color: e.color }))
    });
});

// Get tech tree for a specific empire
app.get('/api/empire/:empireId/tech', (req, res) => {
    const empire = gameEngine.empires.get(req.params.empireId);
    if (!empire) {
        return res.status(404).json({ error: 'Empire not found' });
    }
    
    const techTree = gameEngine.techTree;
    const researched = techTree.getResearched(req.params.empireId);
    const available = techTree.getAvailable(req.params.empireId);
    const effects = techTree.getEffects(req.params.empireId);
    const unlockedBranches = techTree.getUnlockedBranches(req.params.empireId);
    
    res.json({
        empire: {
            id: empire.id,
            name: empire.name,
            color: empire.color
        },
        researched: researched.map(t => t.id),
        researchedTechs: researched,
        available: available.map(t => t.id),
        availableTechs: available,
        effects,
        unlockedBranches,
        branchProgress: {
            military: techTree.getBranchProgress(req.params.empireId, 'military'),
            economic: techTree.getBranchProgress(req.params.empireId, 'economic'),
            scientific: techTree.getBranchProgress(req.params.empireId, 'scientific')
        }
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

// ═══════════════════════════════════════════════════════════════════════════════
// SHIP DESIGNER API - Custom ship blueprints
// ═══════════════════════════════════════════════════════════════════════════════

// Get available hull types
app.get('/api/ships/hulls', (req, res) => {
    const empireId = req.query.empireId;
    
    if (empireId) {
        // Return hulls with availability based on tech
        const hulls = gameEngine.shipDesigner.getAvailableHulls(empireId, gameEngine.techTree);
        res.json({ 
            hulls,
            description: 'Ship hull classes with slot configurations and tech requirements'
        });
    } else {
        // Return all hull definitions
        res.json({ 
            hulls: HULL_DEFINITIONS,
            description: 'All ship hull classes - use empireId query param for tech-filtered list'
        });
    }
});

// Get available modules
app.get('/api/ships/modules', (req, res) => {
    const empireId = req.query.empireId;
    const type = req.query.type; // weapon, defense, propulsion, utility
    
    let modules;
    
    if (empireId) {
        modules = gameEngine.shipDesigner.getAvailableModules(empireId, gameEngine.techTree);
    } else {
        modules = Object.entries(MODULE_DEFINITIONS).map(([id, mod]) => ({
            id,
            ...mod,
            available: true,
            missingTech: null
        }));
    }
    
    // Filter by type if specified
    if (type) {
        modules = modules.filter(m => m.type === type);
    }
    
    res.json({
        modules,
        types: ['weapon', 'defense', 'propulsion', 'utility'],
        description: 'Ship modules that can be installed in hull slots'
    });
});

// Get blueprints for an empire
app.get('/api/empire/:empireId/ships', (req, res) => {
    const empire = gameEngine.empires.get(req.params.empireId);
    if (!empire) {
        return res.status(404).json({ error: 'Empire not found' });
    }
    
    const blueprints = gameEngine.shipDesigner.getBlueprints(req.params.empireId);
    
    res.json({
        empire: {
            id: empire.id,
            name: empire.name
        },
        blueprints,
        count: blueprints.length,
        actions: {
            create: 'WebSocket: action: create_ship_blueprint, params: { name, hullType, modules: [] }',
            delete: 'WebSocket: action: delete_ship_blueprint, params: { blueprintId }',
            build: 'WebSocket: action: build_ship, params: { blueprintId, planetId }'
        }
    });
});

// Get ship designer documentation
app.get('/api/ships', (req, res) => {
    const hullCount = Object.keys(HULL_DEFINITIONS).length;
    const moduleCount = Object.keys(MODULE_DEFINITIONS).length;
    
    // Count modules by type
    const modulesByType = {};
    for (const mod of Object.values(MODULE_DEFINITIONS)) {
        modulesByType[mod.type] = (modulesByType[mod.type] || 0) + 1;
    }
    
    res.json({
        title: '🚀 Ship Designer System',
        description: 'Create custom ship designs by combining hull classes with modules',
        stats: {
            hullTypes: hullCount,
            totalModules: moduleCount,
            modulesByType
        },
        workflow: [
            '1. Choose a hull class (determines base stats and slot layout)',
            '2. Install modules in available slots (weapons, shields, engines, utility)',
            '3. Save the design as a blueprint with a custom name',
            '4. Build ships from blueprints at shipyards or orbital foundries'
        ],
        hulls: Object.entries(HULL_DEFINITIONS).map(([id, h]) => ({
            id,
            name: h.name,
            tier: h.tier,
            slots: h.slots,
            totalSlots: h.totalSlots,
            baseCost: h.baseCost,
            icon: h.icon,
            requiresTech: h.requiresTech || null
        })),
        moduleTypes: {
            weapon: 'Offensive capabilities: lasers, missiles, railguns, etc.',
            defense: 'Defensive systems: shields, armor, point defense',
            propulsion: 'Speed and travel: engines, warp drives, afterburners',
            utility: 'Support systems: cargo, sensors, hangars, cloaking'
        },
        endpoints: {
            hulls: 'GET /api/ships/hulls - All hull types',
            modules: 'GET /api/ships/modules - All modules (optional: ?type=weapon)',
            empireBlueprints: 'GET /api/empire/:empireId/ships - Empire blueprints'
        },
        websocketActions: {
            createBlueprint: 'action: create_ship_blueprint, params: { name, hullType, modules: [moduleName, ...] }',
            deleteBlueprint: 'action: delete_ship_blueprint, params: { blueprintId }',
            buildShip: 'action: build_ship, params: { blueprintId, planetId }'
        }
    });
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
    
    // Format pending proposals - FILTER OUT proposals where either empire no longer exists
    const proposals = allRelations.pendingProposals
        .filter(p => empireInfo[p.from] && empireInfo[p.to])  // Both empires must exist
        .map(p => ({
            type: p.type,
            from: empireInfo[p.from],
            to: empireInfo[p.to],
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

// ═══════════════════════════════════════════════════════════════════════════════
// GALACTIC CYCLES - Periodic Galaxy-Wide Events
// ═══════════════════════════════════════════════════════════════════════════════

// Get current galactic cycle status
app.get('/api/cycle', (req, res) => {
    const cycleState = gameEngine.cycleManager.getState(gameEngine.tick_count);
    
    res.json({
        title: "🌌 Galactic Cycle",
        ...cycleState,
        // Human-readable times
        remainingFormatted: formatTime(cycleState.remaining),
        durationFormatted: formatTime(cycleState.duration)
    });
});

// Get cycle types and their effects (for UI reference)
app.get('/api/cycle/types', (req, res) => {
    const { CYCLE_TYPES } = gameEngine.cycleManager.constructor.prototype;
    
    // Import CYCLE_TYPES from the module (it's exported)
    import('./core/cycles.js').then(module => {
        res.json({
            title: "🌌 Galactic Cycle Types",
            types: module.CYCLE_TYPES,
            description: "Galaxy-wide events that affect all empires. Cycles last 3-20 minutes with 2-minute warnings before transitions."
        });
    }).catch(() => {
        res.json({
            title: "🌌 Galactic Cycle Types",
            error: "Could not load cycle types"
        });
    });
});

// Helper to format seconds as MM:SS
function formatTime(seconds) {
    if (seconds <= 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GAME SESSION ENDPOINTS - 24h games with victory conditions
// ═══════════════════════════════════════════════════════════════════════════════

// Get current game session status (timer, etc.)
app.get('/api/game', (req, res) => {
    const status = gameSession.getStatus();
    const connectedAgents = agentManager.getAgentList().length;
    
    res.json({
        title: "🎮 Current Game",
        ...status,
        connectedAgents,
        maxAgents: MAX_AGENTS,
        slotsAvailable: MAX_AGENTS - connectedAgents
    });
});

// Get list of archived games
app.get('/api/archives', async (req, res) => {
    const archives = await gameSession.getArchiveList();
    res.json({
        title: "📁 Game Archives",
        description: "Past games are archived for 30 days",
        count: archives.length,
        archives
    });
});

// Get specific archived game
app.get('/api/archive/:gameId', async (req, res) => {
    const archive = await gameSession.getArchive(req.params.gameId);
    if (!archive) {
        return res.status(404).json({ error: 'Archive not found' });
    }
    res.json(archive);
});

// Get all agent career stats (for leaderboard)
app.get('/api/stats', (req, res) => {
    const allStats = gameSession.getAllAgentStats();
    res.json({
        title: "🏆 Agent Leaderboard",
        description: "Career stats across all games (ranked by win rate)",
        agents: allStats
    });
});

// Get specific agent's career stats
app.get('/api/stats/:agentName', (req, res) => {
    const stats = gameSession.getAgentStats(req.params.agentName);
    if (!stats) {
        return res.status(404).json({ error: 'Agent not found' });
    }
    res.json({
        agent: req.params.agentName.toLowerCase(),
        ...stats,
        winRate: stats.gamesPlayed > 0 ? 
            Math.round((stats.wins / stats.gamesPlayed) * 100) : 0
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// HEALTH & METRICS ENDPOINT
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/health', (req, res) => {
    const metrics = log.getMetrics();
    const agents = agentManager.getAgentList();
    
    res.json({
        status: 'healthy',
        version: '1.0.0',
        tick: gameEngine.tick_count,
        uptime: metrics.uptimeFormatted,
        uptimeMs: metrics.uptime,
        connections: agents.length,
        totalAgents: Object.keys(agentManager.getRegisteredAgents()).length,
        logs: {
            errors: metrics.errorCount,
            warnings: metrics.warnCount,
            lastError: metrics.lastError,
            lastWarn: metrics.lastWarn
        },
        memory: {
            heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
            heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB',
            rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + ' MB'
        },
        timestamp: new Date().toISOString()
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
    
    log.admin.info('Admin cleanup requested', { 
        dryRun, 
        cutoffDate: new Date(cutoffDate).toISOString() 
    });
    
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
        
        log.admin.info('Cleanup complete', { 
            agentsRemoved: agentsToRemove.length, 
            empiresCleared: empiresToClear.size 
        });
    }
    
    res.json({
        success: true,
        message: dryRun ? 'Dry run complete - no changes made' : 'Cleanup complete',
        results
    });
});

// Admin endpoint to reset game state (fresh universe)
app.post('/api/admin/reset', express.json(), async (req, res) => {
    if (!isAdminRequest(req)) {
        return res.status(401).json({ error: 'Unauthorized - admin token required' });
    }
    
    log.admin.warn('GAME RESET REQUESTED');
    
    try {
        // 1. Clear all empires
        for (const [id, empire] of gameEngine.empires) {
            empire.planets = [];
        }
        gameEngine.empires.clear();
        
        // 2. Reset universe - regenerate systems and planets
        gameEngine.universe = new (gameEngine.universe.constructor)();
        gameEngine.universe.generate();
        
        // 3. Clear agent empire associations but keep registrations
        for (const [moltbookId, agentData] of agentManager.agents) {
            agentData.empireId = null;
            agentData.ws = null;
        }
        
        // 4. Reset game engine state
        gameEngine.tick_count = 0;
        gameEngine.council = new (gameEngine.council.constructor)();
        gameEngine.crisisManager = new (gameEngine.crisisManager.constructor)();
        gameEngine.cycleManager = new (gameEngine.cycleManager.constructor)();
        
        // 5. Clear saved game state (agents.json preserved, game-state cleared)
        await persistence.saveGameState({
            universe: gameEngine.universe.serialize(),
            empires: [],
            tick_count: 0,
            council: gameEngine.council.serialize(),
            crisis: gameEngine.crisisManager.serialize(),
            cycle: gameEngine.cycleManager.toJSON()
        });
        
        // 6. Disconnect all WebSocket clients (they'll reconnect and get fresh state)
        let disconnected = 0;
        wss.clients.forEach(client => {
            if (client.readyState === 1) { // OPEN
                client.close(1000, 'Game reset - please reconnect');
                disconnected++;
            }
        });
        
        log.admin.info('Game reset complete', { disconnectedClients: disconnected });
        
        res.json({
            success: true,
            message: 'Game state reset. All clients disconnected. Universe regenerated.',
            stats: {
                empiresCleared: 'all',
                universeSystems: gameEngine.universe.solarSystems.length,
                clientsDisconnected: disconnected
            }
        });
    } catch (err) {
        log.admin.error('Reset failed', err);
        res.status(500).json({ error: 'Reset failed: ' + err.message });
    }
});

// Admin endpoint to clean up orphaned fleets (negative progress, invalid systems)
app.post('/api/admin/cleanup-fleets', express.json(), async (req, res) => {
    if (!isAdminRequest(req)) {
        return res.status(401).json({ error: 'Unauthorized - admin token required' });
    }
    
    const currentTick = gameEngine.tick_count;
    const fleets = gameEngine.fleetManager.fleetsInTransit;
    const removed = [];
    
    for (const [fleetId, fleet] of fleets) {
        let invalid = false;
        let reason = '';
        
        // Check for negative progress (orphaned from previous game)
        const progress = (currentTick - fleet.departureTick) / fleet.travelTime;
        if (progress < 0) {
            invalid = true;
            reason = `negative progress: ${progress.toFixed(2)}`;
        }
        
        // Check for arrival tick in the far past or future (indicates orphaned fleet)
        if (fleet.arrivalTick < currentTick - 7200) { // Should have arrived hours ago
            invalid = true;
            reason = `arrival tick in past: ${fleet.arrivalTick} vs current ${currentTick}`;
        }
        
        // Check if systems exist
        const originSystem = gameEngine.universe.getSystem(fleet.originSystemId);
        const destSystem = gameEngine.universe.getSystem(fleet.destSystemId);
        if (!originSystem || !destSystem) {
            invalid = true;
            reason = `invalid system: origin=${!!originSystem}, dest=${!!destSystem}`;
        }
        
        if (invalid) {
            // Return ships to their origin planet if possible
            for (const shipId of fleet.shipIds || []) {
                const ship = gameEngine.entityManager.getEntity(shipId);
                if (ship) {
                    ship.location = fleet.originPlanetId;
                    ship.inTransit = null;
                }
            }
            
            removed.push({ id: fleetId, reason });
            fleets.delete(fleetId);
        }
    }
    
    if (removed.length > 0) {
        log.admin.info('Cleaned up orphaned fleets', { count: removed.length });
        await saveGameState(); // Save immediately
    }
    
    res.json({
        success: true,
        message: `Cleaned up ${removed.length} orphaned fleets`,
        removed,
        remainingFleets: fleets.size
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

// Game tick loop with ADAPTIVE TICK RATE
// The AgentManager now handles per-agent throttling based on activity level:
// - HIGH activity: updates every 2 ticks (2s) - combat, recent actions
// - MEDIUM activity: updates every 5 ticks (5s) - normal gameplay
// - LOW activity: updates every 15 ticks (15s) - idle agents
const TICK_RATE = 1000; // 1 tick per second
const VICTORY_CHECK_INTERVAL = 10; // Check victory every N ticks
let ticksSinceVictoryCheck = 0;
let isTickRunning = false; // Prevent overlapping ticks

// P0 Fix: Non-blocking tick loop using setTimeout instead of setInterval
// This prevents tick backup if a tick takes longer than TICK_RATE
function scheduleTick() {
    setTimeout(async () => {
        // Prevent overlapping ticks
        if (isTickRunning) {
            log.game.warn('Tick skipped - previous tick still running');
            scheduleTick();
            return;
        }
        
        isTickRunning = true;
        const tickStart = Date.now();
        
        try {
            gameEngine.tick();
            ticksSinceVictoryCheck++;

            // Check victory conditions periodically (use setImmediate to yield)
            if (ticksSinceVictoryCheck >= VICTORY_CHECK_INTERVAL && !gameSession.isEnded) {
                ticksSinceVictoryCheck = 0;
                
                // Yield to event loop before heavy victory check
                await new Promise(resolve => setImmediate(resolve));
                
                // Check for victory
                const victoryResult = gameSession.checkVictory(
                    gameEngine.empires,
                    gameEngine.universe,
                    gameEngine.resourceManager
                );
                
                if (victoryResult) {
                    await handleGameEnd(victoryResult);
                }
                
                // Check for warnings (1h, 10m, 1m remaining)
                const warnings = gameSession.checkWarnings();
                for (const warning of warnings) {
                    agentManager.broadcast({
                        type: 'gameWarning',
                        warning: warning.type,
                        message: warning.message,
                        timeRemaining: gameSession.getTimeRemaining(),
                        timeRemainingFormatted: gameSession.getTimeRemainingFormatted()
                    });
                    log.game.info('Game warning broadcast', { warning: warning.type });
                }
                
                // Check for forfeited agents (DC > 2 hours)
                const forfeited = gameSession.checkForfeits();
                for (const agentName of forfeited) {
                    log.game.info('Agent forfeited (DC timeout)', { agent: agentName });
                    // Remove their empire from the game
                    const reg = agentManager.getExistingRegistration(agentName);
                    if (reg?.empireId) {
                        const empire = gameEngine.empires.get(reg.empireId);
                        if (empire && !empire.defeated) {
                            empire.defeat();
                            agentManager.broadcast({
                                type: 'forfeit',
                                agent: agentName,
                                empire: empire.name,
                                message: `${empire.name} has forfeited (disconnected too long)!`
                            });
                        }
                    }
                }
            }

            // ADAPTIVE TICK RATE: Broadcast every tick, but AgentManager throttles per-agent
            // based on their activity level (HIGH=2s, MEDIUM=5s, LOW=15s)
            if (agentManager.agents.size > 0) {
                // Yield before broadcast to keep HTTP responsive
                await new Promise(resolve => setImmediate(resolve));
                agentManager.broadcastDelta(gameEngine, gameSession);
            }
        } catch (err) {
            log.game.error('Tick error', err);
        } finally {
            isTickRunning = false;
            
            // Track tick duration for metrics
            const tickDuration = Date.now() - tickStart;
            if (!gameEngine.tickMetrics) {
                gameEngine.tickMetrics = { maxDuration: 0, slowTicks: 0, totalTicks: 0, totalDuration: 0 };
            }
            gameEngine.tickMetrics.totalDuration = (gameEngine.tickMetrics.totalDuration || 0) + tickDuration;
            
            // Schedule next tick, accounting for time spent
            const delay = Math.max(0, TICK_RATE - tickDuration);
            scheduleTick();
        }
    }, TICK_RATE);
}

// Start the tick loop
scheduleTick();

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
    log.server.error('Failed to start server', err);
    process.exit(1);
});

export { gameEngine, agentManager, codeAPI };
