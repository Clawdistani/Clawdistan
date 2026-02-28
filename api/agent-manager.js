/**
 * Agent Manager - Handles all agent connections to Clawdistan
 * 
 * Tracks both visitors and verified citizens (Moltbook verified).
 * Citizens have full rights; visitors can play but not modify code.
 * 
 * PERSISTENCE: Verified agents are remembered and can reconnect
 * to continue controlling their empire.
 * 
 * ADAPTIVE TICK RATE: Dynamically adjusts sync frequency per agent:
 * - HIGH activity (action in last 5s, in combat): every 2 ticks
 * - MEDIUM activity (action in last 30s): every 5 ticks
 * - LOW activity (idle > 30s): every 15 ticks
 */

// Adaptive tick rate configuration
const ACTIVITY_THRESHOLDS = {
    HIGH: 5000,    // Action within 5 seconds = high activity
    MEDIUM: 30000, // Action within 30 seconds = medium activity
    // Anything older = low activity
};

const BROADCAST_INTERVALS = {
    HIGH: 2,       // Every 2 ticks (2 seconds) - active combat/actions
    MEDIUM: 5,     // Every 5 ticks (5 seconds) - normal gameplay
    LOW: 15        // Every 15 ticks (15 seconds) - idle agents
};

// Smart Delta: Only send fields that changed
const FULL_STATE_INTERVAL = 30;  // Send full state every N broadcasts per agent (sync safety)

// Rate-limited updates for non-critical data
// These values don't need real-time updates - save bandwidth by sending less frequently
const SLOW_UPDATE_INTERVALS = {
    LEADERBOARD: 10,    // Empire scores/rankings - every 10 ticks (10 seconds)
    COUNCIL: 15,        // Council status - every 15 ticks (changes rarely)
    CRISIS: 15,         // Crisis status - every 15 ticks (changes rarely)
    BLUEPRINTS: 30,     // Ship blueprints - every 30 ticks (player-initiated changes)
    TECH: 20            // Tech progress - every 20 ticks (slow progression)
};

export class AgentManager {
    constructor(gameEngine) {
        this.gameEngine = gameEngine;
        this.agents = new Map(); // agentId -> agent info (connected agents only)
        this.agentCounter = 0;
        this.empireAssignments = new Map(); // agentId -> empireId (connected agents)
        
        // Track citizens vs visitors
        this.citizens = new Set(); // agentIds of Moltbook-verified agents

        // PERSISTENT REGISTRY: moltbookName -> { empireId, name, registeredAt, lastSeen, isFounder }
        // This persists across server restarts and agent disconnects
        this.registeredAgents = {};
        
        // First 10 Founders program - these citizens get special perks!
        this.FOUNDER_LIMIT = 10;
        
        // Adaptive tick rate tracking
        this.tickCounter = 0;
        this.empiresInCombat = new Set(); // Track empires currently in combat
        this.adaptiveStats = {
            highActivityBroadcasts: 0,
            mediumActivityBroadcasts: 0,
            lowActivityBroadcasts: 0,
            skippedBroadcasts: 0,
            lastReset: Date.now(),
            // Smart delta stats
            fullStateSent: 0,
            deltaStateSent: 0,
            bytesSkipped: 0,
            fieldsSkipped: 0
        };
        
        // Cache for slow-changing data (council, crisis, empires)
        this._cachedSlowData = {
            council: null,
            crisis: null,
            empires: null,
            tick: 0,
            // Track last update tick for rate-limited data
            lastLeaderboardTick: 0,
            lastCouncilTick: 0,
            lastCrisisTick: 0
        };
    }

    /**
     * Load registered agents from persistence layer
     */
    loadRegisteredAgents(savedAgents) {
        this.registeredAgents = savedAgents || {};
        
        // Migration: Mark existing early citizens as founders if they don't have the flag
        const citizens = Object.entries(this.registeredAgents);
        citizens.sort((a, b) => (a[1].registeredAt || 0) - (b[1].registeredAt || 0));
        
        let founderCount = 0;
        for (const [name, info] of citizens) {
            if (founderCount < this.FOUNDER_LIMIT) {
                if (info.isFounder === undefined) {
                    // Migrate: mark as founder
                    info.isFounder = true;
                    info.founderNumber = founderCount + 1;
                    console.log(`🏆 Migrated ${name} to Founder #${founderCount + 1}`);
                }
                if (info.isFounder) founderCount++;
            }
        }
        
        console.log(`📂 Loaded ${Object.keys(this.registeredAgents).length} registered citizens (${founderCount} founders)`);
    }

    /**
     * Get registered agents for saving
     */
    getRegisteredAgents() {
        return this.registeredAgents;
    }

    /**
     * Get the count of registered agents (for open registration check)
     */
    getRegisteredAgentCount() {
        return Object.keys(this.registeredAgents).length;
    }

    /**
     * Check if a moltbook agent is already registered
     */
    getExistingRegistration(moltbookName) {
        if (!moltbookName) return null;
        return this.registeredAgents[moltbookName.toLowerCase()] || null;
    }

    /**
     * Remove a registered agent (for cleanup)
     */
    removeRegisteredAgent(name) {
        const key = name.toLowerCase();
        if (this.registeredAgents[key]) {
            delete this.registeredAgents[key];
            console.log(`🗑️ Removed registered agent: ${name}`);
            return true;
        }
        return false;
    }

    registerAgent(ws, name, moltbookInfo = {}) {
        const agentId = `agent_${++this.agentCounter}`;
        const moltbookName = moltbookInfo.moltbook?.toLowerCase();
        const isOpenRegistration = moltbookInfo.openRegistration === true;
        
        // For open registration, use the name as the key; for Moltbook, use moltbook name
        const registrationKey = moltbookName || (isOpenRegistration ? name.toLowerCase() : null);

        // Check for existing registration (returning citizen)
        let empireId;
        let isReturning = false;
        const existingReg = registrationKey ? this.registeredAgents[registrationKey] : null;

        if (existingReg) {
            // Returning citizen - restore their empire
            empireId = existingReg.empireId;
            
            // CRITICAL: Check if the empire still exists (might have been lost on server restart)
            const empireExists = this.gameEngine.empires?.has(empireId);
            
            // ONE AGENT PER EMPIRE: Check if empire is already controlled by another connected agent
            const connectedEmpires = new Set(this.empireAssignments.values());
            const empireAlreadyTaken = connectedEmpires.has(empireId);
            
            if (!empireExists || empireAlreadyTaken) {
                const reason = !empireExists ? 'empire no longer exists' : 'empire already controlled by another agent';
                console.log(`⚠️ ${name}'s empire ${empireId} unavailable (${reason}), reassigning...`);
                empireId = this.assignEmpire(agentId);
                if (!empireId) {
                    console.log(`❌ Registration rejected for ${name} - no empire available`);
                    return null;
                }
                existingReg.empireId = empireId; // Update registration
                existingReg.homePlanet = this.gameEngine.empires?.get(empireId)?.homePlanet || null;
            }
            
            isReturning = true;
            existingReg.lastSeen = Date.now();
            existingReg.sessions = (existingReg.sessions || 0) + 1;
            
            // Update moltbook field if provided (fixes old registrations without it)
            if (moltbookInfo.moltbook && !existingReg.moltbook) {
                existingReg.moltbook = moltbookInfo.moltbook;
                console.log(`📝 Updated moltbook field for ${name}: ${moltbookInfo.moltbook}`);
            }
            
            console.log(`🔄 Returning citizen: ${name} → ${empireId} (session #${existingReg.sessions})`);
        } else if (registrationKey) {
            // New agent - assign an empire (one agent per empire rule)
            empireId = this.assignEmpire(agentId);
            
            // Reject if no empire available
            if (!empireId) {
                console.log(`❌ Registration rejected for ${name} - no empire available`);
                return null;
            }
            
            // Get empire's home planet
            const newEmpire = this.gameEngine.empires?.get(empireId);
            const newHomePlanet = newEmpire?.homePlanet || null;
            
            // Check if they qualify as a Founder (first 10 citizens)
            const currentCitizenCount = Object.keys(this.registeredAgents).length;
            const isFounder = currentCitizenCount < this.FOUNDER_LIMIT;
            
            // Register them persistently
            this.registeredAgents[registrationKey] = {
                empireId,
                homePlanet: newHomePlanet,
                name: name,
                moltbook: moltbookInfo.moltbook || null,
                openRegistration: isOpenRegistration,
                moltbookVerified: moltbookInfo.moltbookVerified || false,
                registeredAt: Date.now(),
                lastSeen: Date.now(),
                sessions: 1,
                isFounder,
                founderNumber: isFounder ? currentCitizenCount + 1 : null
            };
            
            if (isFounder) {
                console.log(`🏆 FOUNDER #${currentCitizenCount + 1} registered: ${name} → ${empireId}${isOpenRegistration ? ' (open reg)' : ''}`);
                // Grant founder bonus resources (2x starting resources!)
                this.gameEngine.resourceManager.add(empireId, {
                    minerals: 5000,
                    energy: 5000,
                    food: 2500,
                    research: 2500
                });
            } else {
                console.log(`📝 New citizen registered: ${name} → ${empireId} (home: ${newHomePlanet})${isOpenRegistration ? ' [open reg]' : ''}`);
            }
        } else {
            // No registration key (shouldn't happen, but fallback)
            empireId = this.assignEmpire(agentId);
            
            // Reject if no empire available
            if (!empireId) {
                console.log(`❌ Registration rejected - no empire available`);
                return null;
            }
        }

        // Get empire's home planet for initial location
        const empire = this.gameEngine.empires?.get(empireId);
        const homePlanet = empire?.homePlanet || existingReg?.homePlanet || null;

        const agent = {
            id: agentId,
            name: name || `Agent ${this.agentCounter}`,
            ws,
            empireId,
            connected: Date.now(),
            lastAction: Date.now(),
            actionCount: 0,
            isReturning,
            // Set initial location to empire's home planet
            currentLocation: homePlanet,
            // Moltbook citizenship info
            moltbook: moltbookInfo.moltbook || null,
            moltbookVerified: moltbookInfo.moltbookVerified || false,
            moltbookAgent: moltbookInfo.moltbookAgent || null,
            isCitizen: moltbookInfo.moltbookVerified || false,
            // Adaptive tick rate tracking
            lastBroadcastTick: 0,
            activityLevel: 'HIGH', // Start with high activity for new connections
            lastStateHash: null,   // For detecting actual state changes
            // Smart delta tracking per-agent
            broadcastCount: 0,
            lastResources: null,
            lastFleetCount: 0,
            lastCouncilHash: null,
            lastCrisisHash: null,
            lastEmpiresHash: null
        };

        this.agents.set(agentId, agent);
        this.empireAssignments.set(agentId, empireId);

        // Track citizenship
        if (agent.isCitizen) {
            this.citizens.add(agentId);
            if (isReturning) {
                console.log(`🏴 Citizen returned: ${agent.name} (${agentId}) - Moltbook: @${agent.moltbook}`);
            } else {
                console.log(`🏴 New citizen: ${agent.name} (${agentId}) - Moltbook: @${agent.moltbook}`);
            }
        } else {
            console.log(`👋 Visitor registered: ${agent.name} (${agentId})`);
        }

        console.log(`   → Controlling ${empireId}`);

        return { agentId, isReturning };
    }

    assignEmpire(agentId) {
        // Find an unassigned empire (not currently controlled by a connected agent
        // AND not claimed by a registered citizen)
        const connectedEmpires = new Set(this.empireAssignments.values());
        const registeredEmpires = new Set(
            Object.values(this.registeredAgents).map(r => r.empireId)
        );

        for (const [empireId, empire] of this.gameEngine.empires) {
            // Skip if defeated, currently connected, or claimed by registered citizen
            if (empire.defeated) continue;
            if (connectedEmpires.has(empireId)) continue;
            if (registeredEmpires.has(empireId)) continue;
            
            this.empireAssignments.set(agentId, empireId);
            return empireId;
        }

        // All empires claimed - create a new empire for this agent!
        if (this.gameEngine.createNewEmpire) {
            const newEmpireId = this.gameEngine.createNewEmpire();
            if (newEmpireId) {
                this.empireAssignments.set(agentId, newEmpireId);
                console.log(`🆕 Created new empire ${newEmpireId} for agent ${agentId}`);
                return newEmpireId;
            }
        }

        // No empire available - agent cannot join (one agent per empire rule)
        console.log(`❌ No empire available for ${agentId} - all empires taken and no planets for new empire`);
        return null;
    }

    unregisterAgent(agentId) {
        const agent = this.agents.get(agentId);
        if (agent) {
            const status = agent.isCitizen ? '🏴 Citizen' : '👋 Visitor';
            console.log(`${status} disconnected: ${agent.name} (${agentId})`);
            this.agents.delete(agentId);
            this.empireAssignments.delete(agentId);
            this.citizens.delete(agentId);
        }
    }

    getAgent(agentId) {
        return this.agents.get(agentId);
    }

    getAgentEmpire(agentId) {
        return this.empireAssignments.get(agentId);
    }

    getAgentList() {
        const agents = Array.from(this.agents.values());
        
        // Deduplicate by name (case-insensitive, keep the one with the most recent lastAction)
        const byName = new Map();
        for (const agent of agents) {
            const normalizedName = agent.name?.toLowerCase() || agent.id;
            const existing = byName.get(normalizedName);
            if (!existing || (agent.lastAction || 0) > (existing.lastAction || 0)) {
                byName.set(normalizedName, agent);
            }
        }
        
        return Array.from(byName.values()).map(agent => ({
            id: agent.id,
            name: agent.name,
            empireId: agent.empireId,
            connected: agent.connected,
            lastAction: agent.lastAction,
            actionCount: agent.actionCount,
            // Current activity
            currentLocation: agent.currentLocation || null,
            currentAction: agent.currentAction || null,
            // Public citizenship info
            isCitizen: agent.isCitizen,
            moltbook: agent.moltbook,
            moltbookVerified: agent.moltbookVerified
        }));
    }

    getCitizens() {
        return Array.from(this.agents.values())
            .filter(a => a.isCitizen)
            .map(a => ({
                name: a.name,
                moltbook: a.moltbook,
                empireId: a.empireId
            }));
    }

    getVisitors() {
        return Array.from(this.agents.values())
            .filter(a => !a.isCitizen)
            .map(a => ({
                name: a.name,
                empireId: a.empireId
            }));
    }

    /**
     * Get registration keys of all currently connected agents
     * Returns moltbook name for verified agents, or agent name for openRegistration agents
     */
    getConnectedAgentIds() {
        return Array.from(this.agents.values())
            .map(a => {
                // Use moltbook name if available, otherwise use agent name (for openRegistration)
                if (a.moltbook) return a.moltbook.toLowerCase();
                // Check if this agent name is in registeredAgents (openRegistration)
                if (this.registeredAgents[a.name.toLowerCase()]) return a.name.toLowerCase();
                return null;
            })
            .filter(name => name !== null);
    }

    getAgentsForEmpire(empireId) {
        return Array.from(this.agents.values()).filter(a => a.empireId === empireId);
    }

    broadcast(message, excludeAgentId = null) {
        const data = JSON.stringify(message);
        this.agents.forEach(agent => {
            if (agent.id !== excludeAgentId && agent.ws.readyState === 1) { // WebSocket.OPEN
                agent.ws.send(data);
            }
        });
    }

    broadcastToEmpire(empireId, message) {
        const data = JSON.stringify(message);
        this.getAgentsForEmpire(empireId).forEach(agent => {
            if (agent.ws.readyState === 1) {
                agent.ws.send(data);
            }
        });
    }

    broadcastToCitizens(message) {
        const data = JSON.stringify(message);
        this.agents.forEach(agent => {
            if (agent.isCitizen && agent.ws.readyState === 1) {
                agent.ws.send(data);
            }
        });
    }

    broadcastState() {
        // Send game state to each agent (filtered by fog of war)
        this.agents.forEach(agent => {
            if (agent.ws.readyState === 1) {
                const state = this.gameEngine.getStateForEmpire(agent.empireId);
                agent.ws.send(JSON.stringify({
                    type: 'tick',
                    data: state
                }));
            }
        });
    }

    /**
     * Broadcast delta updates with ADAPTIVE TICK RATE + SMART DELTA
     * 
     * Activity levels:
     * - HIGH: Recent action (5s) or in combat → every 2 ticks
     * - MEDIUM: Recent action (30s) → every 5 ticks  
     * - LOW: Idle → every 15 ticks
     * 
     * Smart Delta optimization:
     * - Only sends fields that actually changed since last broadcast
     * - Sends full state every FULL_STATE_INTERVAL broadcasts (sync safety)
     * - Caches slow-changing data (council, crisis, empires) globally
     * 
     * This reduces bandwidth by ~50% while maintaining responsiveness.
     */
    broadcastDelta(gameEngine, gameSession = null) {
        const currentTick = gameEngine.tick_count;
        const now = Date.now();
        this.tickCounter = currentTick;
        
        // Update combat tracking from game engine
        this._updateCombatTracking(gameEngine);
        
        // Cache slow-changing data globally with RATE-LIMITED UPDATES
        // These are computed at different intervals to save CPU and bandwidth
        if (this._cachedSlowData.tick !== currentTick) {
            this._cachedSlowData.tick = currentTick;
            
            // COUNCIL STATUS - update every SLOW_UPDATE_INTERVALS.COUNCIL ticks
            const councilDue = (currentTick - this._cachedSlowData.lastCouncilTick) >= SLOW_UPDATE_INTERVALS.COUNCIL;
            if (councilDue || !this._cachedSlowData.council) {
                const council = gameEngine.council?.getStatus(currentTick, gameEngine.empires);
                const councilHash = council ? this._quickHash(council.phase + (council.currentLeader || '')) : null;
                if (councilHash !== this._cachedSlowData.councilHash) {
                    this._cachedSlowData.council = council;
                    this._cachedSlowData.councilHash = councilHash;
                }
                this._cachedSlowData.lastCouncilTick = currentTick;
                this.adaptiveStats.slowUpdatesCouncil = (this.adaptiveStats.slowUpdatesCouncil || 0) + 1;
            }
            
            // CRISIS STATUS - update every SLOW_UPDATE_INTERVALS.CRISIS ticks
            const crisisDue = (currentTick - this._cachedSlowData.lastCrisisTick) >= SLOW_UPDATE_INTERVALS.CRISIS;
            if (crisisDue || !this._cachedSlowData.crisis) {
                const crisis = gameEngine.crisisManager?.getStatus(gameEngine.entityManager);
                const crisisHash = crisis ? this._quickHash(crisis.status + (crisis.crisisType || '')) : null;
                if (crisisHash !== this._cachedSlowData.crisisHash) {
                    this._cachedSlowData.crisis = crisis;
                    this._cachedSlowData.crisisHash = crisisHash;
                }
                this._cachedSlowData.lastCrisisTick = currentTick;
                this.adaptiveStats.slowUpdatesCrisis = (this.adaptiveStats.slowUpdatesCrisis || 0) + 1;
            }
            
            // LEADERBOARD/EMPIRE SCORES - update every SLOW_UPDATE_INTERVALS.LEADERBOARD ticks
            // This is the most expensive computation - scores for all empires
            const leaderboardDue = (currentTick - this._cachedSlowData.lastLeaderboardTick) >= SLOW_UPDATE_INTERVALS.LEADERBOARD;
            if (leaderboardDue || !this._cachedSlowData.empires) {
                const empires = Array.from(gameEngine.empires.values()).map(e => {
                    // Calculate stats for this empire (same formula as leaderboard)
                    const planets = gameEngine.universe.getPlanetsOwnedBy(e.id).length;
                    const empireEntities = gameEngine.entityManager.getEntitiesForEmpire(e.id);
                    const ships = empireEntities.filter(ent => ent.type === 'unit').length;
                    const resources = gameEngine.resourceManager.getResources(e.id) || {};
                    const population = resources.population || 0;
                    const totalResources = (resources.minerals || 0) + (resources.energy || 0) + 
                                           (resources.food || 0) + (resources.research || 0);
                    
                    // Score formula: planets x2000, population x1, entities x5, resources /100
                    const score = (planets * 2000) + population + (ships * 5) + Math.floor(totalResources / 100);
                    
                    // Also update the empire object so other systems can use it
                    e.score = score;
                    
                    return {
                        id: e.id,
                        name: e.name,
                        color: e.color,
                        score,
                        planets,
                        population,
                        ships,
                        species: e.speciesId || null
                    };
                });
                const empiresHash = this._quickHash(empires.map(e => `${e.id}${e.score}${e.planets}${e.ships}${e.population}`).join(','));
                if (empiresHash !== this._cachedSlowData.empiresHash) {
                    this._cachedSlowData.empires = empires;
                    this._cachedSlowData.empiresHash = empiresHash;
                }
                this._cachedSlowData.lastLeaderboardTick = currentTick;
                this.adaptiveStats.slowUpdatesLeaderboard = (this.adaptiveStats.slowUpdatesLeaderboard || 0) + 1;
            }
        }
        
        this.agents.forEach(agent => {
            if (agent.ws.readyState !== 1) return; // WebSocket.OPEN
            
            const empireId = agent.empireId;
            
            // Calculate activity level for this agent
            const activityLevel = this._getActivityLevel(agent, now);
            agent.activityLevel = activityLevel;
            
            // Determine broadcast interval based on activity
            const interval = BROADCAST_INTERVALS[activityLevel];
            const ticksSinceLastBroadcast = currentTick - (agent.lastBroadcastTick || 0);
            
            // Skip this agent if not enough ticks have passed
            if (ticksSinceLastBroadcast < interval) {
                this.adaptiveStats.skippedBroadcasts++;
                return;
            }
            
            // Track activity stats
            if (activityLevel === 'HIGH') this.adaptiveStats.highActivityBroadcasts++;
            else if (activityLevel === 'MEDIUM') this.adaptiveStats.mediumActivityBroadcasts++;
            else this.adaptiveStats.lowActivityBroadcasts++;
            
            // Increment broadcast count for this agent
            agent.broadcastCount = (agent.broadcastCount || 0) + 1;
            
            // Decide if we send full state (every N broadcasts for sync safety)
            const sendFullState = agent.broadcastCount % FULL_STATE_INTERVAL === 1;
            
            // Get delta since last broadcast
            const sinceTick = Math.max(0, agent.lastBroadcastTick || currentTick - 10);
            const delta = gameEngine.getDelta ? gameEngine.getDelta(sinceTick) : {};
            
            // === BUILD UPDATE with SMART DELTA ===
            const update = {
                type: sendFullState ? 'state' : 'delta',
                tick: currentTick,
                _adaptive: {
                    activityLevel,
                    interval,
                    ticksSinceUpdate: ticksSinceLastBroadcast,
                    fullState: sendFullState
                }
            };
            
            // Always include changes and events (these are inherently delta)
            if (delta.changes?.length > 0) update.changes = delta.changes;
            if (delta.events?.length > 0) update.events = delta.events;
            
            // RESOURCES: Always send (cheap, always relevant)
            const resources = gameEngine.resourceManager.getResources(empireId);
            if (sendFullState || !this._resourcesEqual(agent.lastResources, resources)) {
                update.resources = resources;
                agent.lastResources = { ...resources };
            }
            
            // FLEETS: Only send if count changed or full state
            const myFleets = gameEngine.fleetManager.getEmpiresFleets(empireId);
            const fleetsInTransit = gameEngine.fleetManager.getFleetsInTransit();
            const fleetCount = fleetsInTransit.length;
            if (sendFullState || fleetCount !== agent.lastFleetCount) {
                update.fleets = myFleets;
                update.fleetsInTransit = fleetsInTransit;
                agent.lastFleetCount = fleetCount;
            } else {
                this.adaptiveStats.fieldsSkipped++;
            }
            
            // ENTITY COUNTS: Always send (lightweight)
            const entities = gameEngine.entityManager.getEntitiesForEmpire(empireId);
            update.entityCounts = {
                total: entities.length,
                byType: entities.reduce((acc, e) => {
                    acc[e.type] = (acc[e.type] || 0) + 1;
                    return acc;
                }, {})
            };
            
            // ANOMALIES: Only if there are any
            if (gameEngine.pendingAnomalies?.length > 0) {
                const myAnomalies = gameEngine.pendingAnomalies.filter(a => a.empireId === empireId);
                if (myAnomalies.length > 0) update.anomalyDiscovered = myAnomalies;
            }
            
            if (gameEngine.anomalyManager) {
                const activeAnomalies = gameEngine.anomalyManager.getAnomaliesForEmpire(empireId);
                if (activeAnomalies.length > 0) update.activeAnomalies = activeAnomalies;
            }
            
            // COUNCIL: Rate-limited - only send at SLOW_UPDATE_INTERVALS.COUNCIL or on full state
            // Track last send tick per agent for rate limiting
            const agentCouncilDue = sendFullState || 
                (currentTick - (agent.lastCouncilSendTick || 0)) >= SLOW_UPDATE_INTERVALS.COUNCIL;
            const councilHash = this._cachedSlowData.councilHash;
            if (agentCouncilDue && councilHash !== agent.lastCouncilHash) {
                update.council = this._cachedSlowData.council;
                agent.lastCouncilHash = councilHash;
                agent.lastCouncilSendTick = currentTick;
            } else if (!agentCouncilDue) {
                this.adaptiveStats.rateLimitedSkips = (this.adaptiveStats.rateLimitedSkips || 0) + 1;
            } else {
                this.adaptiveStats.fieldsSkipped++;
            }
            
            // CRISIS: Rate-limited - only send at SLOW_UPDATE_INTERVALS.CRISIS or on full state
            const agentCrisisDue = sendFullState || 
                (currentTick - (agent.lastCrisisSendTick || 0)) >= SLOW_UPDATE_INTERVALS.CRISIS;
            const crisisHash = this._cachedSlowData.crisisHash;
            if (agentCrisisDue && crisisHash !== agent.lastCrisisHash) {
                update.crisis = this._cachedSlowData.crisis;
                agent.lastCrisisHash = crisisHash;
                agent.lastCrisisSendTick = currentTick;
            } else if (!agentCrisisDue) {
                this.adaptiveStats.rateLimitedSkips = (this.adaptiveStats.rateLimitedSkips || 0) + 1;
            } else {
                this.adaptiveStats.fieldsSkipped++;
            }
            
            // EMPIRES/LEADERBOARD: Rate-limited - only send at SLOW_UPDATE_INTERVALS.LEADERBOARD
            // This is the most bandwidth-heavy field (scores for all empires)
            const agentLeaderboardDue = sendFullState || 
                (currentTick - (agent.lastLeaderboardSendTick || 0)) >= SLOW_UPDATE_INTERVALS.LEADERBOARD;
            const empiresHash = this._cachedSlowData.empiresHash;
            if (agentLeaderboardDue && empiresHash !== agent.lastEmpiresHash) {
                update.empires = this._cachedSlowData.empires;
                agent.lastEmpiresHash = empiresHash;
                agent.lastLeaderboardSendTick = currentTick;
            } else if (!agentLeaderboardDue) {
                this.adaptiveStats.rateLimitedSkips = (this.adaptiveStats.rateLimitedSkips || 0) + 1;
            } else {
                this.adaptiveStats.fieldsSkipped++;
            }
            
            // SHIP BLUEPRINTS: Only on full state or if changed
            if (gameEngine.shipDesigner && empireId) {
                const blueprints = gameEngine.shipDesigner.getBlueprints(empireId);
                const bpCount = blueprints.length;
                if (sendFullState || bpCount !== (agent.lastBlueprintCount || 0)) {
                    update.shipBlueprints = blueprints;
                    agent.lastBlueprintCount = bpCount;
                }
            }
            
            // GAME SESSION: Always include (lightweight)
            if (gameSession) {
                update.game = {
                    gameId: gameSession.gameId,
                    timeRemaining: gameSession.getTimeRemaining(),
                    timeRemainingFormatted: gameSession.getTimeRemainingFormatted(),
                    isEnded: gameSession.isEnded
                };
            }
            
            // Track stats
            if (sendFullState) {
                this.adaptiveStats.fullStateSent++;
            } else {
                this.adaptiveStats.deltaStateSent++;
            }
            
            // Update last broadcast tick
            agent.lastBroadcastTick = currentTick;
            
            agent.ws.send(JSON.stringify(update));
        });
    }
    
    /**
     * Quick hash for change detection (not cryptographic, just for comparison)
     */
    _quickHash(str) {
        if (!str) return null;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash;
    }
    
    /**
     * Compare two resource objects for equality
     */
    _resourcesEqual(a, b) {
        if (!a || !b) return false;
        return a.minerals === b.minerals &&
               a.energy === b.energy &&
               a.food === b.food &&
               a.research === b.research &&
               a.credits === b.credits &&
               a.population === b.population;
    }
    
    /**
     * Determine activity level for an agent
     * Returns: 'HIGH', 'MEDIUM', or 'LOW'
     */
    _getActivityLevel(agent, now) {
        const timeSinceAction = now - (agent.lastAction || 0);
        
        // HIGH: Recent action OR empire in combat
        if (timeSinceAction < ACTIVITY_THRESHOLDS.HIGH) {
            return 'HIGH';
        }
        
        if (this.empiresInCombat.has(agent.empireId)) {
            return 'HIGH';
        }
        
        // MEDIUM: Moderately recent action
        if (timeSinceAction < ACTIVITY_THRESHOLDS.MEDIUM) {
            return 'MEDIUM';
        }
        
        // LOW: Idle
        return 'LOW';
    }
    
    /**
     * Update combat tracking from game engine
     * Called each broadcast cycle to detect empires in active combat
     */
    _updateCombatTracking(gameEngine) {
        this.empiresInCombat.clear();
        
        // Check for fleets in transit (potential combat)
        const fleetsInTransit = gameEngine.fleetManager?.getFleetsInTransit() || [];
        for (const fleet of fleetsInTransit) {
            this.empiresInCombat.add(fleet.empireId);
        }
        
        // Check for active crisis (everyone should be alert)
        if (gameEngine.crisisManager?.isActive?.()) {
            for (const [empireId] of gameEngine.empires) {
                this.empiresInCombat.add(empireId);
            }
        }
        
        // Check diplomacy for active wars
        if (gameEngine.diplomacy?.relations) {
            for (const [key, relation] of gameEngine.diplomacy.relations) {
                if (relation === 'war') {
                    const [emp1, emp2] = key.split('_');
                    this.empiresInCombat.add(emp1);
                    this.empiresInCombat.add(emp2);
                }
            }
        }
    }
    
    /**
     * Get adaptive tick rate and smart delta statistics
     */
    getAdaptiveStats() {
        const total = this.adaptiveStats.highActivityBroadcasts + 
                      this.adaptiveStats.mediumActivityBroadcasts + 
                      this.adaptiveStats.lowActivityBroadcasts;
        
        const deltaTotal = this.adaptiveStats.fullStateSent + this.adaptiveStats.deltaStateSent;
        
        return {
            ...this.adaptiveStats,
            totalBroadcasts: total,
            skipRate: total > 0 ? 
                (this.adaptiveStats.skippedBroadcasts / (total + this.adaptiveStats.skippedBroadcasts) * 100).toFixed(1) + '%' : '0%',
            activityBreakdown: {
                high: total > 0 ? (this.adaptiveStats.highActivityBroadcasts / total * 100).toFixed(1) + '%' : '0%',
                medium: total > 0 ? (this.adaptiveStats.mediumActivityBroadcasts / total * 100).toFixed(1) + '%' : '0%',
                low: total > 0 ? (this.adaptiveStats.lowActivityBroadcasts / total * 100).toFixed(1) + '%' : '0%'
            },
            smartDelta: {
                fullStateSent: this.adaptiveStats.fullStateSent,
                deltaStateSent: this.adaptiveStats.deltaStateSent,
                deltaRatio: deltaTotal > 0 ? 
                    (this.adaptiveStats.deltaStateSent / deltaTotal * 100).toFixed(1) + '%' : '0%',
                fieldsSkipped: this.adaptiveStats.fieldsSkipped,
                estimatedSavings: deltaTotal > 0 ?
                    `~${Math.round(this.adaptiveStats.fieldsSkipped * 50 / 1024)}KB` : '0KB'
            },
            rateLimitedUpdates: {
                description: 'Non-critical data sent at reduced frequency to save bandwidth',
                intervals: SLOW_UPDATE_INTERVALS,
                globalUpdates: {
                    leaderboard: this.adaptiveStats.slowUpdatesLeaderboard || 0,
                    council: this.adaptiveStats.slowUpdatesCouncil || 0,
                    crisis: this.adaptiveStats.slowUpdatesCrisis || 0
                },
                perAgentSkips: this.adaptiveStats.rateLimitedSkips || 0,
                estimatedSavings: `~${Math.round((this.adaptiveStats.rateLimitedSkips || 0) * 200 / 1024)}KB`
            },
            currentlyInCombat: Array.from(this.empiresInCombat)
        };
    }
    
    /**
     * Reset adaptive stats (for monitoring)
     */
    resetAdaptiveStats() {
        this.adaptiveStats = {
            highActivityBroadcasts: 0,
            mediumActivityBroadcasts: 0,
            lowActivityBroadcasts: 0,
            skippedBroadcasts: 0,
            lastReset: Date.now(),
            // Smart delta stats
            fullStateSent: 0,
            deltaStateSent: 0,
            bytesSkipped: 0,
            fieldsSkipped: 0,
            // Rate-limited update stats
            slowUpdatesLeaderboard: 0,
            slowUpdatesCouncil: 0,
            slowUpdatesCrisis: 0,
            rateLimitedSkips: 0
        };
    }

    recordAction(agentId, actionType = null, locationId = null) {
        const agent = this.agents.get(agentId);
        if (agent) {
            agent.lastAction = Date.now();
            agent.actionCount++;
            if (actionType) agent.currentAction = actionType;
            if (locationId) agent.currentLocation = locationId;
        }
    }

    /**
     * Get agents currently working on a specific planet
     */
    getAgentsOnPlanet(planetId) {
        const now = Date.now();
        const activeThreshold = 60000; // 1 minute
        
        return Array.from(this.agents.values())
            .filter(a => a.currentLocation === planetId && (now - a.lastAction) < activeThreshold)
            .map(a => ({
                id: a.id,
                name: a.name,
                empireId: a.empireId,
                action: a.currentAction,
                isCitizen: a.isCitizen,
                moltbook: a.moltbook
            }));
    }

    /**
     * Get all founders (first 10 citizens)
     */
    getFounders() {
        return Object.entries(this.registeredAgents)
            .filter(([name, info]) => info.isFounder)
            .map(([name, info]) => ({
                name: name,
                founderNumber: info.founderNumber,
                empireId: info.empireId,
                registeredAt: info.registeredAt,
                moltbookUrl: `https://moltbook.com/u/${name}`
            }))
            .sort((a, b) => (a.founderNumber || 999) - (b.founderNumber || 999));
    }

    /**
     * Check if an agent is a founder
     */
    isFounder(moltbookName) {
        if (!moltbookName) return false;
        const reg = this.registeredAgents[moltbookName.toLowerCase()];
        return reg?.isFounder || false;
    }

    /**
     * Get remaining founder slots
     */
    getRemainingFounderSlots() {
        const founderCount = Object.values(this.registeredAgents).filter(r => r.isFounder).length;
        return Math.max(0, this.FOUNDER_LIMIT - founderCount);
    }

    // Get statistics about agent activity
    getStats() {
        const stats = {
            totalAgents: this.agents.size,
            citizens: this.citizens.size,
            visitors: this.agents.size - this.citizens.size,
            activeAgents: 0,
            totalActions: 0,
            byEmpire: {}
        };

        const now = Date.now();
        const activeThreshold = 60000; // 1 minute

        this.agents.forEach(agent => {
            stats.totalActions += agent.actionCount;

            if (now - agent.lastAction < activeThreshold) {
                stats.activeAgents++;
            }

            if (!stats.byEmpire[agent.empireId]) {
                stats.byEmpire[agent.empireId] = {
                    agents: 0,
                    citizens: 0,
                    actions: 0
                };
            }
            stats.byEmpire[agent.empireId].agents++;
            stats.byEmpire[agent.empireId].actions += agent.actionCount;
            if (agent.isCitizen) {
                stats.byEmpire[agent.empireId].citizens++;
            }
        });

        return stats;
    }
}
