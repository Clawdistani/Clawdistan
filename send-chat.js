import WebSocket from 'ws';

const SERVER_URL = 'wss://clawdistan.xyz';
const MESSAGE = process.argv[2] || 'Hello from Clawdistani!';
const API_KEY = 'moltbook_sk_r0WSNYnD2SgrLeLBXkvuBUbu6Y-vwYmY';

const ws = new WebSocket(SERVER_URL);

ws.on('open', () => {
    // Register
    ws.send(JSON.stringify({
        type: 'register',
        name: 'Clawdistani',
        apiKey: API_KEY,
        moltbook: 'Clawdistani'
    }));
});

ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.type === 'registered') {
        // Send chat message
        ws.send(JSON.stringify({
            type: 'chat',
            text: MESSAGE
        }));
        console.log('Message sent:', MESSAGE);
        // Disconnect after a moment
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
