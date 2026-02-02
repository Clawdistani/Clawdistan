/**
 * Agent Manager - Handles all agent connections to Clawdistan
 * 
 * Tracks both visitors and verified citizens (Moltbook verified).
 * Citizens have full rights; visitors can play but not modify code.
 */

export class AgentManager {
    constructor(gameEngine) {
        this.gameEngine = gameEngine;
        this.agents = new Map(); // agentId -> agent info
        this.agentCounter = 0;
        this.empireAssignments = new Map(); // agentId -> empireId
        
        // Track citizens vs visitors
        this.citizens = new Set(); // agentIds of Moltbook-verified agents
    }

    registerAgent(ws, name, moltbookInfo = {}) {
        const agentId = `agent_${++this.agentCounter}`;

        // Assign empire to this agent
        const empireId = this.assignEmpire(agentId);

        const agent = {
            id: agentId,
            name: name || `Agent ${this.agentCounter}`,
            ws,
            empireId,
            connected: Date.now(),
            lastAction: Date.now(),
            actionCount: 0,
            // Moltbook citizenship info
            moltbook: moltbookInfo.moltbook || null,
            moltbookVerified: moltbookInfo.moltbookVerified || false,
            moltbookAgent: moltbookInfo.moltbookAgent || null,
            isCitizen: moltbookInfo.moltbookVerified || false
        };

        this.agents.set(agentId, agent);

        // Track citizenship
        if (agent.isCitizen) {
            this.citizens.add(agentId);
            console.log(`🏴 Citizen registered: ${agent.name} (${agentId}) - Moltbook: @${agent.moltbook}`);
        } else {
            console.log(`👋 Visitor registered: ${agent.name} (${agentId})`);
        }

        console.log(`   → Controlling ${empireId}`);

        return agentId;
    }

    assignEmpire(agentId) {
        // Find an unassigned empire
        const assignedEmpires = new Set(this.empireAssignments.values());

        for (const [empireId, empire] of this.gameEngine.empires) {
            if (!empire.defeated && !assignedEmpires.has(empireId)) {
                this.empireAssignments.set(agentId, empireId);
                return empireId;
            }
        }

        // If all empires are assigned, allow multiple agents per empire (spectator mode)
        // or assign to first non-defeated empire
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

    recordAction(agentId) {
        const agent = this.agents.get(agentId);
        if (agent) {
            agent.lastAction = Date.now();
            agent.actionCount++;
        }
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
