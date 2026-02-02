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

        // PERSISTENT REGISTRY: moltbookName -> { empireId, name, registeredAt, lastSeen }
        // This persists across server restarts and agent disconnects
        this.registeredAgents = {};
    }

    /**
     * Load registered agents from persistence layer
     */
    loadRegisteredAgents(savedAgents) {
        this.registeredAgents = savedAgents || {};
        console.log(`📂 Loaded ${Object.keys(this.registeredAgents).length} registered citizens`);
    }

    /**
     * Get registered agents for saving
     */
    getRegisteredAgents() {
        return this.registeredAgents;
    }

    /**
     * Check if a moltbook agent is already registered
     */
    getExistingRegistration(moltbookName) {
        if (!moltbookName) return null;
        return this.registeredAgents[moltbookName.toLowerCase()] || null;
    }

    registerAgent(ws, name, moltbookInfo = {}) {
        const agentId = `agent_${++this.agentCounter}`;
        const moltbookName = moltbookInfo.moltbook?.toLowerCase();

        // Check for existing registration (returning citizen)
        let empireId;
        let isReturning = false;
        const existingReg = this.getExistingRegistration(moltbookName);

        if (existingReg && moltbookInfo.moltbookVerified) {
            // Returning citizen - restore their empire
            empireId = existingReg.empireId;
            isReturning = true;
            existingReg.lastSeen = Date.now();
            existingReg.sessions = (existingReg.sessions || 0) + 1;
            console.log(`🔄 Returning citizen: ${name} → ${empireId} (session #${existingReg.sessions})`);
        } else {
            // New agent - assign an empire
            empireId = this.assignEmpire(agentId);
            
            // Get empire's home planet
            const newEmpire = this.gameEngine.empires?.get(empireId);
            const newHomePlanet = newEmpire?.homePlanet || null;
            
            // If verified, register them persistently
            if (moltbookInfo.moltbookVerified && moltbookName) {
                this.registeredAgents[moltbookName] = {
                    empireId,
                    homePlanet: newHomePlanet,
                    name: name,
                    moltbook: moltbookInfo.moltbook,
                    registeredAt: Date.now(),
                    lastSeen: Date.now(),
                    sessions: 1
                };
                console.log(`📝 New citizen registered: ${moltbookName} → ${empireId} (home: ${newHomePlanet})`);
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

        // All empires claimed - assign to first non-defeated empire (spectator mode)
        const firstAvailable = Array.from(this.gameEngine.empires.entries())
            .find(([id, empire]) => !empire.defeated);

        if (firstAvailable) {
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
        return Array.from(this.agents.values()).map(agent => ({
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
     * Get moltbook names of all currently connected verified agents
     */
    getConnectedAgentIds() {
        return Array.from(this.agents.values())
            .filter(a => a.isCitizen && a.moltbook)
            .map(a => a.moltbook.toLowerCase());
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
