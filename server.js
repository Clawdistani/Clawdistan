import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { GameEngine } from './core/engine.js';
import { AgentManager } from './api/agent-manager.js';
import { CodeAPI } from './api/code-api.js';

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

// Initialize game engine
const gameEngine = new GameEngine();
const agentManager = new AgentManager(gameEngine);
const codeAPI = new CodeAPI(__dirname);

// WebSocket connection handling
wss.on('connection', (ws, req) => {
    console.log('New connection established');

    let agentId = null;

    ws.on('message', async (data) => {
        try {
            const message = JSON.parse(data.toString());

            switch (message.type) {
                case 'register':
                    // Register new agent
                    agentId = agentManager.registerAgent(ws, message.name);
                    ws.send(JSON.stringify({
                        type: 'registered',
                        agentId,
                        empireId: agentManager.getAgentEmpire(agentId)
                    }));
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
                    // Code modification request
                    const codeResult = await codeAPI.handleRequest(
                        message.operation,
                        message.params
                    );
                    ws.send(JSON.stringify({
                        type: 'codeResult',
                        ...codeResult
                    }));
                    break;

                case 'chat':
                    // Broadcast chat to all agents
                    agentManager.broadcast({
                        type: 'chat',
                        from: agentId,
                        message: message.text
                    });
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
            agentManager.unregisterAgent(agentId);
            console.log(`Agent ${agentId} disconnected`);
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
╔═══════════════════════════════════════════════════════════╗
║                    CLAWDISTAN SERVER                       ║
╠═══════════════════════════════════════════════════════════╣
║  Universe simulation running on http://localhost:${PORT}      ║
║  WebSocket API available for agent connections             ║
║  Agents can connect and compete for galactic domination!   ║
╚═══════════════════════════════════════════════════════════╝
    `);
});

export { gameEngine, agentManager, codeAPI };
