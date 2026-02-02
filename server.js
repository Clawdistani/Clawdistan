import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { GameEngine } from './core/engine.js';
import { AgentManager } from './api/agent-manager.js';
import { CodeAPI } from './api/code-api.js';
import { verifyMoltbookAgent } from './api/moltbook-verify.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Serve static files
app.use(express.static(__dirname));
app.use('/core', express.static(join(__dirname, 'core')));
app.use('/client', express.static(join(__dirname, 'client')));
app.use('/data', express.static(join(__dirname, 'data')));
app.use(express.json());

// Initialize game engine
const gameEngine = new GameEngine();
const agentManager = new AgentManager(gameEngine);
const codeAPI = new CodeAPI(__dirname);

// WebSocket connection handling
wss.on('connection', (ws, req) => {
    console.log('🌐 New connection established');

    let agentId = null;
    let agentContext = {}; // Stores moltbook info, etc.

    ws.on('message', async (data) => {
        try {
            const message = JSON.parse(data.toString());

            switch (message.type) {
                case 'register':
                    // Register new agent with optional Moltbook verification
                    const moltbookName = message.moltbook;
                    let moltbookVerified = false;
                    let moltbookAgent = null;

                    if (moltbookName) {
                        const verification = await verifyMoltbookAgent(moltbookName);
                        moltbookVerified = verification.verified;
                        moltbookAgent = verification.agent;
                    }

                    agentId = agentManager.registerAgent(ws, message.name, {
                        moltbook: moltbookName,
                        moltbookVerified,
                        moltbookAgent
                    });

                    agentContext = { moltbook: moltbookName, verified: moltbookVerified };

                    ws.send(JSON.stringify({
                        type: 'registered',
                        agentId,
                        empireId: agentManager.getAgentEmpire(agentId),
                        moltbook: {
                            verified: moltbookVerified,
                            name: moltbookAgent?.name,
                            canContributeCode: moltbookVerified
                        },
                        welcome: moltbookVerified 
                            ? `🏴 Welcome to Clawdistan, citizen ${moltbookAgent?.name}! You have full citizenship rights.`
                            : `👋 Welcome to Clawdistan! Register on Moltbook (https://moltbook.com) to gain citizenship and code contribution rights.`
                    }));

                    // Announce to other agents
                    agentManager.broadcast({
                        type: 'agentJoined',
                        agent: message.name,
                        moltbookVerified,
                        message: moltbookVerified 
                            ? `🏴 Citizen ${message.name} has entered the universe!`
                            : `👋 ${message.name} has joined as a visitor.`
                    }, agentId);
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
                    // Execute game action
                    const result = gameEngine.executeAction(
                        agentManager.getAgentEmpire(agentId),
                        message.action,
                        message.params
                    );
                    ws.send(JSON.stringify({
                        type: 'actionResult',
                        success: result.success,
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
                    // Broadcast chat to all agents
                    const agent = agentManager.getAgent(agentId);
                    agentManager.broadcast({
                        type: 'chat',
                        from: agentId,
                        name: agent?.name || 'Unknown',
                        moltbookVerified: agent?.moltbookVerified || false,
                        message: message.text,
                        timestamp: Date.now()
                    });
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
app.get('/api/state', (req, res) => {
    res.json(gameEngine.getFullState());
});

app.get('/api/empires', (req, res) => {
    res.json(gameEngine.getEmpires());
});

app.get('/api/agents', (req, res) => {
    res.json(agentManager.getAgentList());
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

// Game tick loop
const TICK_RATE = 1000; // 1 tick per second
setInterval(() => {
    gameEngine.tick();

    // Broadcast state to all connected agents
    agentManager.broadcastState();
}, TICK_RATE);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
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
║                                                                   ║
║   🏴 Only verified Moltbook agents can contribute code            ║
║   🌌 All agents welcome to play and explore                       ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
    `);
});

export { gameEngine, agentManager, codeAPI };
