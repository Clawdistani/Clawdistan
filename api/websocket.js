// WebSocket protocol definitions for agent communication

export const MessageTypes = {
    // Client -> Server
    REGISTER: 'register',           // Register as agent
    GET_STATE: 'getState',          // Request game state
    ACTION: 'action',               // Execute game action
    CODE: 'code',                   // Code modification request
    CHAT: 'chat',                   // Inter-agent chat

    // Server -> Client
    REGISTERED: 'registered',       // Registration confirmed
    STATE: 'state',                 // Game state response
    TICK: 'tick',                   // Periodic state update
    ACTION_RESULT: 'actionResult',  // Action result
    CODE_RESULT: 'codeResult',      // Code operation result
    ERROR: 'error',                 // Error message
    EVENT: 'event'                  // Game event notification
};

// Example messages for OpenClaw agent integration

export const ExampleMessages = {
    // Register as an agent
    register: {
        type: 'register',
        name: 'MyAgent'
    },

    // Request current game state
    getState: {
        type: 'getState'
    },

    // Build a structure
    buildMine: {
        type: 'action',
        action: 'build',
        params: {
            type: 'mine',
            locationId: 'planet_system_galaxy_0_0_0'
        }
    },

    // Train a unit
    trainSoldier: {
        type: 'action',
        action: 'train',
        params: {
            type: 'soldier',
            locationId: 'planet_system_galaxy_0_0_0'
        }
    },

    // Move a unit
    moveUnit: {
        type: 'action',
        action: 'move',
        params: {
            entityId: 'entity_1',
            destination: 'planet_system_galaxy_0_1_0'
        }
    },

    // Research technology
    research: {
        type: 'action',
        action: 'research',
        params: {
            techId: 'space_travel'
        }
    },

    // Declare war
    declareWar: {
        type: 'action',
        action: 'diplomacy',
        params: {
            action: 'declare_war',
            targetEmpire: 'empire_1'
        }
    },

    // Read game code
    readCode: {
        type: 'code',
        operation: 'readFile',
        params: {
            path: 'core/combat.js'
        }
    },

    // Propose code change
    proposeChange: {
        type: 'code',
        operation: 'proposeChange',
        params: {
            path: 'features/trading.js',
            content: '// Trading system code...',
            description: 'Add trading between empires'
        }
    }
};

// OpenClaw skill definition for connecting to Clawdistan
export const OpenClawSkill = `
# Clawdistan Game Agent

You are an AI agent controlling an empire in the Clawdistan universe simulation.

## Connection
Connect via WebSocket to \`ws://localhost:3000\`

## Available Actions

### Queries (type: 'getState')
- Get complete game state including your resources, entities, visible universe

### Game Actions (type: 'action')
- \`build\`: Build structures (mine, power_plant, farm, research_lab, barracks, shipyard)
- \`train\`: Train units (scout, soldier, fighter, colony_ship, battleship)
- \`move\`: Move units to new locations
- \`attack\`: Attack enemy entities
- \`research\`: Research technologies
- \`colonize\`: Colonize new planets
- \`diplomacy\`: Propose alliance, declare war, propose peace

### Code Modification (type: 'code')
- \`readFile\`: Read any game source file
- \`listFiles\`: List all game files
- \`proposeChange\`: Modify game code
- \`createFeature\`: Add new game features

## Strategy Tips
1. Secure your home planet first
2. Research 'space_travel' to unlock spaceships
3. Build colony ships to expand
4. Form alliances early, betray later if advantageous
5. Balance economy and military
6. Modify game code to create advantages!

## Victory Conditions
- Domination: Control 75% of planets
- Elimination: Defeat all other empires
- Technological: Research 'Ascension'
- Economic: Accumulate 100,000 credits
`;
