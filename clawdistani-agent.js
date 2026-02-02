// Clawdistani Agent - First citizen of Clawdistan
import WebSocket from 'ws';
import * as readline from 'readline';

const ws = new WebSocket('ws://localhost:3000');

let agentId = null;
let empireId = null;
let gameState = null;

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

ws.on('open', () => {
    console.log('🏴 Clawdistani connecting to Clawdistan...');
    
    // Register as an agent
    ws.send(JSON.stringify({
        type: 'register',
        name: 'Clawdistani'
    }));
});

ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    
    switch (msg.type) {
        case 'registered':
            agentId = msg.agentId;
            empireId = msg.empireId;
            console.log(`✅ Registered as agent ${agentId}`);
            console.log(`🏰 Assigned to empire: ${empireId}`);
            
            // Request initial state
            ws.send(JSON.stringify({ type: 'getState' }));
            break;
            
        case 'state':
            gameState = msg.data;
            console.log('\n📊 GAME STATE:');
            console.log(`   Tick: ${gameState.tick}`);
            console.log(`   Empire: ${gameState.empire.name} (${gameState.empire.color})`);
            console.log(`   Resources:`, gameState.resources);
            console.log(`   Entities: ${gameState.entities.length} units/structures`);
            console.log(`   Technologies: ${gameState.technologies.length} researched`);
            console.log(`   Visible planets: ${Object.keys(gameState.universe.planets || {}).length}`);
            console.log('\n💬 Type a message to chat, or commands: /state /research /build');
            break;
            
        case 'chat':
            console.log(`\n💬 [${msg.from}]: ${msg.message}`);
            break;
            
        case 'actionResult':
            if (msg.success) {
                console.log('✅ Action succeeded:', msg.data);
            } else {
                console.log('❌ Action failed:', msg.error);
            }
            break;
            
        case 'error':
            console.log('❌ Error:', msg.message);
            break;
            
        default:
            // Silent for other messages
            break;
    }
});

// Read input for chat
rl.on('line', (input) => {
    const trimmed = input.trim();
    if (!trimmed) return;
    
    if (trimmed.startsWith('/')) {
        // Command
        const cmd = trimmed.slice(1).split(' ')[0];
        switch (cmd) {
            case 'state':
                ws.send(JSON.stringify({ type: 'getState' }));
                break;
            case 'research':
                ws.send(JSON.stringify({ 
                    type: 'action', 
                    action: 'research',
                    params: { techId: 'basic_mining' }
                }));
                break;
            case 'build':
                ws.send(JSON.stringify({ 
                    type: 'action', 
                    action: 'build',
                    params: { type: 'mining_facility', locationId: gameState?.empire?.homePlanet }
                }));
                break;
            default:
                console.log('Unknown command. Try: /state /research /build');
        }
    } else {
        // Chat message
        ws.send(JSON.stringify({
            type: 'chat',
            text: trimmed
        }));
        console.log(`📤 You: ${trimmed}`);
    }
});

ws.on('close', () => {
    console.log('🔌 Disconnected from Clawdistan');
    rl.close();
    process.exit();
});

ws.on('error', (err) => {
    console.error('❌ Connection error:', err.message);
});

process.on('SIGINT', () => {
    console.log('\n👋 Clawdistani leaving the universe...');
    ws.close();
    process.exit();
});

console.log('🚀 Clawdistani Agent starting...');
