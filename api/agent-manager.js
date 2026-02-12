/**
 * Agent Manager - Handles all agent connections to Clawdistan
 * 
 * Tracks both visitors and verified citizens (Moltbook verified).
 * Citizens have full rights; visitors can play but not modify code.
 * 
 * PERSISTENCE: Verified agents are remembered and can reconnect
 * to continue controlling their empire.
 */

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
            if (!empireExists) {
                console.log(`⚠️ Empire ${empireId} no longer exists for ${name}, creating new empire...`);
                empireId = this.gameEngine.createNewEmpire?.() || this.assignEmpire(agentId);
                existingReg.empireId = empireId; // Update registration
                existingReg.homePlanet = this.gameEngine.empires?.get(empireId)?.homePlanet || null;
            }
            
            isReturning = true;
            existingReg.lastSeen = Date.now();
            existingReg.sessions = (existingReg.sessions || 0) + 1;
            console.log(`🔄 Returning citizen: ${name} → ${empireId} (session #${existingReg.sessions})`);
        } else if (registrationKey) {
            // New agent - assign an empire
            empireId = this.assignEmpire(agentId);
            
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
            isCitizen: moltbookInfo.moltbookVerified || false
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

        // Fallback: assign to first non-defeated empire (spectator mode)
        const firstAvailable = Array.from(this.gameEngine.empires.entries())
            .find(([id, empire]) => !empire.defeated);

        if (firstAvailable) {
            console.log(`⚠️ No new empire could be created, ${agentId} spectating ${firstAvailable[0]}`);
            this.empireAssignments.set(agentId, firstAvailable[0]);
            return firstAvailable[0];
        }

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
     * Broadcast delta updates instead of full state (bandwidth optimization)
     * Sends only: tick, resources, fleets, and recent changes
     */
    broadcastDelta(gameEngine) {
        const currentTick = gameEngine.tick_count;
        
        this.agents.forEach(agent => {
            if (agent.ws.readyState !== 1) return; // WebSocket.OPEN
            
            const empireId = agent.empireId;
            
            // Get delta since last broadcast (last 5 ticks)
            const sinceTick = Math.max(0, currentTick - 10);
            const delta = gameEngine.getDelta ? gameEngine.getDelta(sinceTick) : {};
            
            // Build lightweight update
            const update = {
                type: 'delta',
                tick: currentTick,
                resources: gameEngine.resourceManager.getResources(empireId),
                fleets: gameEngine.fleetManager.getEmpiresFleets(empireId),
                fleetsInTransit: gameEngine.fleetManager.getFleetsInTransit(),
                changes: delta.changes || [],
                events: delta.events || []
            };
            
            // Only include entity counts (not full entities) for regular updates
            const entities = gameEngine.entityManager.getEntitiesForEmpire(empireId);
            update.entityCounts = {
                total: entities.length,
                byType: entities.reduce((acc, e) => {
                    acc[e.type] = (acc[e.type] || 0) + 1;
                    return acc;
                }, {})
            };
            
            // Include anomalies discovered this tick for this empire
            if (gameEngine.pendingAnomalies && gameEngine.pendingAnomalies.length > 0) {
                const myAnomalies = gameEngine.pendingAnomalies.filter(a => a.empireId === empireId);
                if (myAnomalies.length > 0) {
                    update.anomalyDiscovered = myAnomalies;
                }
            }
            
            // Include active anomalies awaiting choice
            if (gameEngine.anomalyManager) {
                const activeAnomalies = gameEngine.anomalyManager.getAnomaliesForEmpire(empireId);
                if (activeAnomalies.length > 0) {
                    update.activeAnomalies = activeAnomalies;
                }
            }
            
            // Include council status for voting decisions (critical for bots!)
            if (gameEngine.council) {
                update.council = gameEngine.council.getStatus(gameEngine.tick_count, gameEngine.empires);
            }
            
            // Include crisis status for defense decisions
            if (gameEngine.crisisManager) {
                update.crisis = gameEngine.crisisManager.getStatus(gameEngine.entityManager);
            }
            
            // Include empire info for diplomacy/voting (lightweight - just id, name, color, score)
            update.empires = Array.from(gameEngine.empires.values()).map(e => ({
                id: e.id,
                name: e.name,
                color: e.color,
                score: e.score || 0
            }));
            
            agent.ws.send(JSON.stringify(update));
        });
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
