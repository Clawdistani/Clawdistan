// Game Configuration
const TILE_SIZE = 32;
const GRID_WIDTH = 25;
const GRID_HEIGHT = 18;

// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = GRID_WIDTH * TILE_SIZE;
canvas.height = GRID_HEIGHT * TILE_SIZE;

// Game State
let currentTool = 'grass';
let world = [];
let clawbots = [];
let selectedClawbot = null;
let isMouseDown = false;

// Tile definitions with colors and emoji
const TILES = {
    empty: { color: '#87CEEB', emoji: null },
    grass: { color: '#4ade80', emoji: '🌿' },
    dirt: { color: '#8B4513', emoji: null },
    stone: { color: '#6b7280', emoji: null },
    wall: { color: '#dc2626', emoji: null, pattern: 'brick' },
    wood: { color: '#a3762b', emoji: null, pattern: 'wood' },
    roof: { color: '#7c2d12', emoji: null, pattern: 'roof' },
    door: { color: '#854d0e', emoji: '🚪' },
    window: { color: '#7dd3fc', emoji: '🪟' },
    water: { color: '#3b82f6', emoji: null, animated: true },
    tree: { color: '#166534', emoji: '🌳' },
    flower: { color: '#4ade80', emoji: '🌸' }
};

// Initialize world grid
function initWorld() {
    world = [];
    for (let y = 0; y < GRID_HEIGHT; y++) {
        world[y] = [];
        for (let x = 0; x < GRID_WIDTH; x++) {
            // Ground layer at the bottom
            if (y >= GRID_HEIGHT - 3) {
                world[y][x] = 'grass';
            } else {
                world[y][x] = 'empty';
            }
        }
    }
    // Add a starting clawbot
    clawbots = [{
        x: Math.floor(GRID_WIDTH / 2),
        y: GRID_HEIGHT - 4,
        color: '#00d9ff',
        name: 'Clawbot-1'
    }];
    selectedClawbot = clawbots[0];
}

// Draw a single tile
function drawTile(x, y, tileType) {
    const tile = TILES[tileType];
    const px = x * TILE_SIZE;
    const py = y * TILE_SIZE;

    // Draw base color
    ctx.fillStyle = tile.color;
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

    // Draw patterns
    if (tile.pattern === 'brick') {
        ctx.strokeStyle = '#991b1b';
        ctx.lineWidth = 1;
        // Horizontal lines
        ctx.beginPath();
        ctx.moveTo(px, py + TILE_SIZE / 2);
        ctx.lineTo(px + TILE_SIZE, py + TILE_SIZE / 2);
        ctx.stroke();
        // Vertical lines (offset)
        ctx.beginPath();
        ctx.moveTo(px + TILE_SIZE / 2, py);
        ctx.lineTo(px + TILE_SIZE / 2, py + TILE_SIZE / 2);
        ctx.moveTo(px, py + TILE_SIZE / 2);
        ctx.lineTo(px, py + TILE_SIZE);
        ctx.moveTo(px + TILE_SIZE, py + TILE_SIZE / 2);
        ctx.lineTo(px + TILE_SIZE, py + TILE_SIZE);
        ctx.stroke();
    } else if (tile.pattern === 'wood') {
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(px, py + i * 8 + 4);
            ctx.lineTo(px + TILE_SIZE, py + i * 8 + 4);
            ctx.stroke();
        }
    } else if (tile.pattern === 'roof') {
        ctx.fillStyle = '#991b1b';
        ctx.beginPath();
        ctx.moveTo(px, py + TILE_SIZE);
        ctx.lineTo(px + TILE_SIZE / 2, py);
        ctx.lineTo(px + TILE_SIZE, py + TILE_SIZE);
        ctx.closePath();
        ctx.fill();
    }

    // Water animation effect
    if (tile.animated && tileType === 'water') {
        const time = Date.now() / 200;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        const waveOffset = Math.sin(time + x) * 3;
        ctx.fillRect(px, py + 10 + waveOffset, TILE_SIZE, 4);
    }

    // Draw emoji if exists
    if (tile.emoji) {
        ctx.font = `${TILE_SIZE - 8}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tile.emoji, px + TILE_SIZE / 2, py + TILE_SIZE / 2);
    }

    // Grid line
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
}

// Draw a clawbot
function drawClawbot(bot) {
    const px = bot.x * TILE_SIZE;
    const py = bot.y * TILE_SIZE;

    // Body
    ctx.fillStyle = bot.color;
    ctx.fillRect(px + 4, py + 8, TILE_SIZE - 8, TILE_SIZE - 12);

    // Head
    ctx.fillStyle = '#333';
    ctx.fillRect(px + 6, py + 2, TILE_SIZE - 12, 10);

    // Eyes
    ctx.fillStyle = bot === selectedClawbot ? '#ff0' : '#0ff';
    ctx.fillRect(px + 9, py + 4, 4, 4);
    ctx.fillRect(px + TILE_SIZE - 13, py + 4, 4, 4);

    // Claws
    ctx.fillStyle = '#666';
    ctx.fillRect(px, py + 12, 6, 8);
    ctx.fillRect(px + TILE_SIZE - 6, py + 12, 6, 8);

    // Selection indicator
    if (bot === selectedClawbot) {
        ctx.strokeStyle = '#ff0';
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
    }
}

// Main render function
function render() {
    // Clear canvas
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw all tiles
    for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
            drawTile(x, y, world[y][x]);
        }
    }

    // Draw clawbots
    clawbots.forEach(bot => drawClawbot(bot));

    // Request next frame for animations
    requestAnimationFrame(render);
}

// Get grid coordinates from mouse position
function getGridPos(e) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / TILE_SIZE);
    const y = Math.floor((e.clientY - rect.top) / TILE_SIZE);
    return { x: Math.max(0, Math.min(x, GRID_WIDTH - 1)), y: Math.max(0, Math.min(y, GRID_HEIGHT - 1)) };
}

// Check if a clawbot is at position
function getClawbotAt(x, y) {
    return clawbots.find(bot => bot.x === x && bot.y === y);
}

// Place tile or interact
function handlePlace(e) {
    const pos = getGridPos(e);

    // Check for clawbot placement
    if (currentTool === 'clawbot') {
        if (!getClawbotAt(pos.x, pos.y)) {
            const newBot = {
                x: pos.x,
                y: pos.y,
                color: `hsl(${Math.random() * 360}, 70%, 50%)`,
                name: `Clawbot-${clawbots.length + 1}`
            };
            clawbots.push(newBot);
            selectedClawbot = newBot;
        }
        return;
    }

    // Check for clawbot selection
    const clickedBot = getClawbotAt(pos.x, pos.y);
    if (clickedBot) {
        selectedClawbot = clickedBot;
        return;
    }

    // Eraser tool
    if (currentTool === 'eraser') {
        world[pos.y][pos.x] = 'empty';
        return;
    }

    // Place tile
    if (TILES[currentTool]) {
        world[pos.y][pos.x] = currentTool;
    }
}

// Move selected clawbot
function moveClawbot(dx, dy) {
    if (!selectedClawbot) return;

    const newX = selectedClawbot.x + dx;
    const newY = selectedClawbot.y + dy;

    // Bounds checking
    if (newX < 0 || newX >= GRID_WIDTH || newY < 0 || newY >= GRID_HEIGHT) return;

    // Check for collision with other clawbots
    if (getClawbotAt(newX, newY)) return;

    // Move the clawbot
    selectedClawbot.x = newX;
    selectedClawbot.y = newY;
}

// Tool selection
document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTool = btn.dataset.tool;
    });
});

// Canvas events
canvas.addEventListener('mousedown', (e) => {
    isMouseDown = true;
    handlePlace(e);
});

canvas.addEventListener('mousemove', (e) => {
    if (isMouseDown && currentTool !== 'clawbot') {
        handlePlace(e);
    }
});

canvas.addEventListener('mouseup', () => {
    isMouseDown = false;
});

canvas.addEventListener('mouseleave', () => {
    isMouseDown = false;
});

// Keyboard controls
document.addEventListener('keydown', (e) => {
    switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
            moveClawbot(0, -1);
            e.preventDefault();
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
            moveClawbot(0, 1);
            e.preventDefault();
            break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
            moveClawbot(-1, 0);
            e.preventDefault();
            break;
        case 'ArrowRight':
        case 'd':
        case 'D':
            moveClawbot(1, 0);
            e.preventDefault();
            break;
    }
});

// Action buttons
document.getElementById('clearBtn').addEventListener('click', () => {
    if (confirm('Clear the entire world?')) {
        initWorld();
    }
});

document.getElementById('saveBtn').addEventListener('click', () => {
    const saveData = {
        world: world,
        clawbots: clawbots
    };
    localStorage.setItem('clawbotWorld', JSON.stringify(saveData));
    alert('World saved!');
});

document.getElementById('loadBtn').addEventListener('click', () => {
    const saveData = localStorage.getItem('clawbotWorld');
    if (saveData) {
        const data = JSON.parse(saveData);
        world = data.world;
        clawbots = data.clawbots;
        selectedClawbot = clawbots[0] || null;
        alert('World loaded!');
    } else {
        alert('No saved world found!');
    }
});

// Initialize and start
initWorld();
render();

console.log('Clawbot World Builder loaded! Use the toolbar to select blocks and click to place them.');
