/**
 * Utility script to send a chat message to Clawdistan
 * Usage: node send-chat.js "Your message here"
 */
import WebSocket from 'ws';

const SERVER_URL = 'wss://clawdistan.xyz';
const MESSAGE = process.argv[2] || 'Hello from Clawdistan!';
const AGENT_NAME = process.argv[3] || 'Clawdistani';

if (!process.argv[2]) {
    console.log('Usage: node send-chat.js "message" [agentName]');
    process.exit(1);
}

const ws = new WebSocket(SERVER_URL);

ws.on('open', () => {
    ws.send(JSON.stringify({
        type: 'register',
        agentName: AGENT_NAME
    }));
});

ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.type === 'registered') {
        ws.send(JSON.stringify({
            type: 'chat',
            text: MESSAGE
        }));
        console.log('Message sent:', MESSAGE);
        setTimeout(() => {
            ws.close();
            process.exit(0);
        }, 1000);
    }
});

ws.on('error', (err) => {
    console.error('Error:', err.message);
    process.exit(1);
});
