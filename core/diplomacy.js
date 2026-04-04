
// ═══════════════════════════════════════════════════════════════════════════════
// WAR GOALS (CASUS BELLI) SYSTEM
// Requires justification for war, limits conquest, and adds war score mechanics
// ═══════════════════════════════════════════════════════════════════════════════

export const WAR_GOAL_TYPES = {
    conquest: {
        name: 'Conquest',
        icon: '⚔️',
        description: 'Claim specific planets as war prizes',
        warScoreToWin: 100,
        // Max planets that can be claimed scales with war score
        maxClaims: 3,
        exhaustionRate: 1.0,  // Normal exhaustion buildup
        aggressorPenalty: 10  // Diplomatic penalty with others for unprovoked war
    },
    humiliation: {
        name: 'Humiliation',
        icon: '😤',
        description: 'Force enemy to pay reparations and accept status quo',
        warScoreToWin: 50,
        maxClaims: 0,
        reparationsPercent: 25,  // % of enemy resources as payment
        exhaustionRate: 0.5,     // Lower exhaustion - limited war
        aggressorPenalty: 5
    },
    liberation: {
        name: 'Liberation',
        icon: '🕊️',
        description: 'Free planets from enemy control (they become neutral)',
        warScoreToWin: 75,
        maxClaims: 0,  // Can't claim for self, but can liberate
        maxLiberations: 5,
        exhaustionRate: 0.75,
        aggressorPenalty: 0  // No penalty - seen as noble
    },
    subjugation: {
        name: 'Subjugation',
        icon: '👑',
        description: 'Force enemy to become your vassal (future feature)',
        warScoreToWin: 150,
        maxClaims: 0,
        exhaustionRate: 1.5,  // Long, hard war
        aggressorPenalty: 20
    },
    defensive: {
        name: 'Defensive War',
        icon: '🛡️',
        description: 'Respond to aggression - full claims allowed',
        warScoreToWin: 100,
        maxClaims: 5,  // Defenders get more claims
        exhaustionRate: 0.75,  // Defenders tire slower
        aggressorPenalty: 0  // No penalty - defending yourself
    },
    total_war: {
        name: 'Total War',
        icon: '💀',
        description: 'No limits - destroy the enemy completely',
        warScoreToWin: 200,
        maxClaims: -1,  // Unlimited
        exhaustionRate: 2.0,  // Very taxing
        aggressorPenalty: 50  // Everyone hates you
    }
};

// War score modifiers - how different actions affect war score
export const WAR_SCORE_VALUES = {
    battleWon: 10,           // Won a battle (any combat victory)
    battleLost: -5,          // Lost a battle
    planetCaptured: 25,      // Captured enemy planet
    planetLost: -20,         // Lost a planet to enemy
    fleetDestroyed: 5,       // Destroyed enemy fleet
    capitalThreatened: 15,   // Have forces near enemy capital
    ticksAtWar: 0.01,        // Passive gain per tick (attacker slowly gains)
    
    // Exhaustion effects (negative to war score when exhausted)
    exhaustionPenalty: -0.5  // Per exhaustion point over 50
};

export class DiplomacySystem {
    constructor() {
        // Relations: Map of "empire1_empire2" -> relation state
        this.relations = new Map();
        this.pendingProposals = []; // Alliance and peace proposals
        
        // Inter-empire trading system
        this.trades = new Map();  // tradeId -> trade object
        this.nextTradeId = 1;
        this.tradeHistory = [];   // Completed/rejected trades (last 100)
        
        // Trade limits
        this.MAX_PENDING_TRADES_PER_EMPIRE = 5;
        this.TRADE_EXPIRY_TICKS = 600; // 10 minutes
        
        // ═══════════════════════════════════════════════════════════════════════════════
        // WAR GOALS SYSTEM - Tracking active wars and their objectives
        // ═══════════════════════════════════════════════════════════════════════════════
        this.activeWars = new Map();  // warId -> war state object
        this.nextWarId = 1;
        this.warHistory = [];  // Completed wars (last 50)

    }

    getRelationKey(empire1, empire2) {
        // Consistent key regardless of order
        return [empire1, empire2].sort().join('_');
    }

    getRelation(empire1, empire2) {
        if (empire1 === empire2) return 'self';
        const key = this.getRelationKey(empire1, empire2);
        const relation = this.relations.get(key);
        return relation?.status || 'neutral';
    }

    setRelation(empire1, empire2, status, data = {}) {
        const key = this.getRelationKey(empire1, empire2);
        this.relations.set(key, {
            status,
            since: Date.now(),
            ...data
        });
    }

    proposeAlliance(fromEmpire, toEmpire) {
        // Add to pending proposals
        this.pendingProposals.push({
            type: 'alliance',
            from: fromEmpire,
            to: toEmpire,
            created: Date.now()
        });
    }

    acceptAlliance(fromEmpire, toEmpire) {
        // Find and remove the proposal
        const idx = this.pendingProposals.findIndex(p =>
            p.type === 'alliance' &&
            p.from === fromEmpire &&
            p.to === toEmpire
        );

        if (idx >= 0) {
            this.pendingProposals.splice(idx, 1);
            this.setRelation(fromEmpire, toEmpire, 'allied');
            return true;
        }
        return false;
    }

    rejectAlliance(fromEmpire, toEmpire) {
        const idx = this.pendingProposals.findIndex(p =>
            p.type === 'alliance' &&
            p.from === fromEmpire &&
            p.to === toEmpire
        );

        if (idx >= 0) {
            this.pendingProposals.splice(idx, 1);
            return true;
        }
        return false;
    }

    declareWar(fromEmpire, toEmpire, warGoalType = 'conquest', claims = []) {
        const currentRelation = this.getRelation(fromEmpire, toEmpire);

        // Can't declare war on allies without breaking alliance first
        if (currentRelation === 'allied') {
            this.breakAlliance(fromEmpire, toEmpire);
        }
        
        // Validate war goal type
        const goalDef = WAR_GOAL_TYPES[warGoalType];
        if (!goalDef) {
            return { success: false, error: 'Invalid war goal type' };
        }
        
        // Check if already at war
        const existingWar = this.getWarBetween(fromEmpire, toEmpire);
        if (existingWar) {
            return { success: false, error: 'Already at war with this empire' };
        }
        
        // Create war state
        const warId = `war_${this.nextWarId++}`;
        const war = {
            id: warId,
            attacker: fromEmpire,
            defender: toEmpire,
            warGoal: warGoalType,
            goalDef: goalDef,
            claims: claims.slice(0, goalDef.maxClaims === -1 ? 100 : goalDef.maxClaims),  // Claimed planet IDs
            startTick: Date.now(),
            startedAt: new Date().toISOString(),
            
            // War score tracking
            attackerScore: 0,
            defenderScore: 0,
            
            // War exhaustion (builds over time, affects willingness to continue)
            attackerExhaustion: 0,
            defenderExhaustion: 0,
            
            // Battle history
            battles: [],
            
            // Status
            status: 'active',  // active, white_peace, attacker_victory, defender_victory
            endedAt: null,
            terms: null
        };
        
        this.activeWars.set(warId, war);

        this.setRelation(fromEmpire, toEmpire, 'war', {
            aggressor: fromEmpire,
            warId: warId,
            warGoal: warGoalType
        });
        
        return { 
            success: true, 
            warId, 
            war,
            message: `${goalDef.icon} War declared with goal: ${goalDef.name}`
        };
    }

    proposePeace(fromEmpire, toEmpire) {
        const currentRelation = this.getRelation(fromEmpire, toEmpire);

        if (currentRelation !== 'war') {
            return false;
        }

        this.pendingProposals.push({
            type: 'peace',
            from: fromEmpire,
            to: toEmpire,
            created: Date.now()
        });

        return true;
    }

    acceptPeace(fromEmpire, toEmpire) {
        const idx = this.pendingProposals.findIndex(p =>
            p.type === 'peace' &&
            p.from === fromEmpire &&
            p.to === toEmpire
        );

        if (idx >= 0) {
            this.pendingProposals.splice(idx, 1);
            this.setRelation(fromEmpire, toEmpire, 'neutral');
            return true;
        }
        return false;
    }

    rejectPeace(fromEmpire, toEmpire) {
        const idx = this.pendingProposals.findIndex(p =>
            p.type === 'peace' &&
            p.from === fromEmpire &&
            p.to === toEmpire
        );

        if (idx >= 0) {
            this.pendingProposals.splice(idx, 1);
            return true;
        }
        return false;
    }

    breakAlliance(empire1, empire2) {
        const currentRelation = this.getRelation(empire1, empire2);

        if (currentRelation === 'allied') {
            this.setRelation(empire1, empire2, 'neutral', {
                previouslyAllied: true
            });
            return true;
        }
        return false;
    }

    getRelationsFor(empireId) {
        const relations = {};

        this.relations.forEach((value, key) => {
            const empires = key.split('_');
            if (empires.includes(empireId)) {
                const otherEmpire = empires.find(e => e !== empireId);
                relations[otherEmpire] = value;
            }
        });

        return {
            relations,
            pendingProposals: this.pendingProposals.filter(p =>
                p.from === empireId || p.to === empireId
            )
        };
    }

    getAllRelations() {
        const result = {};
        this.relations.forEach((value, key) => {
            result[key] = value;
        });
        return {
            relations: result,
            pendingProposals: this.pendingProposals
        };
    }

    // Check if two empires can attack each other
    canAttack(empire1, empire2) {
        const relation = this.getRelation(empire1, empire2);
        return relation === 'war' || relation === 'neutral';
    }

    // Get all empires at war with given empire
    getEnemies(empireId) {
        const enemies = [];
        this.relations.forEach((value, key) => {
            if (value.status === 'war') {
                const empires = key.split('_');
                if (empires.includes(empireId)) {
                    const otherEmpire = empires.find(e => e !== empireId);
                    enemies.push(otherEmpire);
                }
            }
        });
        return enemies;
    }

    // Get all allies
    getAllies(empireId) {
        const allies = [];
        this.relations.forEach((value, key) => {
            if (value.status === 'allied') {
                const empires = key.split('_');
                if (empires.includes(empireId)) {
                    const otherEmpire = empires.find(e => e !== empireId);
                    allies.push(otherEmpire);
                }
            }
        });
        return allies;
    }

    /**
     * Record a diplomatic incident (espionage, treaty violation, etc.)
     * @param {string} fromEmpire - Empire that caused the incident
     * @param {string} toEmpire - Empire affected by the incident
     * @param {string} type - Type of incident ('espionage', 'treaty_violation', etc.)
     * @param {number} relationPenalty - Relation score change (negative for bad)
     */
    recordIncident(fromEmpire, toEmpire, type, relationPenalty) {
        const key = this.getRelationKey(fromEmpire, toEmpire);
        const current = this.relations.get(key) || { status: 'neutral' };
        
        // Track incidents
        if (!current.incidents) {
            current.incidents = [];
        }
        
        current.incidents.push({
            type,
            from: fromEmpire,
            penalty: relationPenalty,
            timestamp: Date.now()
        });
        
        // Keep only last 10 incidents
        if (current.incidents.length > 10) {
            current.incidents = current.incidents.slice(-10);
        }
        
        // Relation penalties don't change status directly, but could trigger war AI
        // For now, just store them
        current.relationScore = (current.relationScore || 0) + relationPenalty;
        
        this.relations.set(key, current);
        
        // If really bad relations and not already at war, AI could auto-declare war
        if (current.relationScore <= -100 && current.status !== 'war') {
            // Just flag it - actual declaration is up to game logic/AI
            current.warThresholdReached = true;
        }
    }


    // ═══════════════════════════════════════════════════════════════════════════════
    // WAR GOALS SYSTEM - War management and war score tracking
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * Get the active war between two empires (if any)
     */
    getWarBetween(empire1, empire2) {
        for (const [warId, war] of this.activeWars) {
            if (war.status !== 'active') continue;
            if ((war.attacker === empire1 && war.defender === empire2) ||
                (war.attacker === empire2 && war.defender === empire1)) {
                return war;
            }
        }
        return null;
    }

    /**
     * Get all active wars for an empire
     */
    getWarsFor(empireId) {
        const wars = [];
        for (const [warId, war] of this.activeWars) {
            if (war.status !== 'active') continue;
            if (war.attacker === empireId || war.defender === empireId) {
                wars.push({
                    ...war,
                    isAttacker: war.attacker === empireId,
                    myScore: war.attacker === empireId ? war.attackerScore : war.defenderScore,
                    enemyScore: war.attacker === empireId ? war.defenderScore : war.attackerScore,
                    myExhaustion: war.attacker === empireId ? war.attackerExhaustion : war.defenderExhaustion
                });
            }
        }
        return wars;
    }

    /**
     * Add war score for an event
     * @param {string} warId - The war ID
     * @param {string} empireId - Empire that gains/loses score
     * @param {string} eventType - Type of event (battleWon, planetCaptured, etc.)
     * @param {number} modifier - Optional multiplier
     */
    addWarScore(warId, empireId, eventType, modifier = 1) {
        const war = this.activeWars.get(warId);
        if (!war || war.status !== 'active') return;
        
        const baseScore = WAR_SCORE_VALUES[eventType] || 0;
        const score = baseScore * modifier;
        
        if (empireId === war.attacker) {
            war.attackerScore = Math.max(0, Math.min(200, war.attackerScore + score));
        } else if (empireId === war.defender) {
            war.defenderScore = Math.max(0, Math.min(200, war.defenderScore + score));
        }
        
        // Record battle event
        war.battles.push({
            tick: Date.now(),
            empireId,
            eventType,
            scoreChange: score
        });
        
        return score;
    }

    /**
     * Update war exhaustion (called every tick)
     */
    updateWarExhaustion(currentTick) {
        for (const [warId, war] of this.activeWars) {
            if (war.status !== 'active') continue;
            
            const exhaustionRate = war.goalDef?.exhaustionRate || 1.0;
            
            // Both sides gain exhaustion over time
            war.attackerExhaustion += 0.01 * exhaustionRate;
            war.defenderExhaustion += 0.008;  // Defenders exhaust slightly slower
            
            // Cap exhaustion at 100
            war.attackerExhaustion = Math.min(100, war.attackerExhaustion);
            war.defenderExhaustion = Math.min(100, war.defenderExhaustion);
            
            // High exhaustion reduces war score effectiveness
            if (war.attackerExhaustion > 50) {
                const penalty = (war.attackerExhaustion - 50) * WAR_SCORE_VALUES.exhaustionPenalty;
                war.attackerScore = Math.max(0, war.attackerScore + penalty);
            }
            if (war.defenderExhaustion > 50) {
                const penalty = (war.defenderExhaustion - 50) * WAR_SCORE_VALUES.exhaustionPenalty;
                war.defenderScore = Math.max(0, war.defenderScore + penalty);
            }
        }
    }

    /**
     * Check if an empire can enforce their war goal (end the war victoriously)
     */
    canEnforceWarGoal(empireId) {
        const results = [];
        
        for (const war of this.getWarsFor(empireId)) {
            const isAttacker = war.attacker === empireId;
            const myScore = isAttacker ? war.attackerScore : war.defenderScore;
            const goalDef = war.goalDef || WAR_GOAL_TYPES[war.warGoal] || WAR_GOAL_TYPES.conquest;
            const requiredScore = goalDef.warScoreToWin;
            
            results.push({
                warId: war.id,
                enemy: isAttacker ? war.defender : war.attacker,
                canEnforce: myScore >= requiredScore,
                currentScore: myScore,
                requiredScore,
                warGoal: war.warGoal
            });
        }
        
        return results;
    }

    /**
     * Enforce war goal and end the war
     * @param {string} empireId - Empire enforcing their goals
     * @param {string} warId - War to end
     * @param {object} options - Additional options for peace terms
     */
    enforceWarGoal(empireId, warId, options = {}) {
        const war = this.activeWars.get(warId);
        if (!war || war.status !== 'active') {
            return { success: false, error: 'War not found or already ended' };
        }
        
        const isAttacker = war.attacker === empireId;
        const myScore = isAttacker ? war.attackerScore : war.defenderScore;
        const goalDef = war.goalDef || WAR_GOAL_TYPES[war.warGoal] || WAR_GOAL_TYPES.conquest;
        
        // Check if war score is sufficient
        if (myScore < goalDef.warScoreToWin) {
            return { 
                success: false, 
                error: `Insufficient war score (${myScore}/${goalDef.warScoreToWin})` 
            };
        }
        
        // Determine peace terms based on war goal
        const terms = {
            winner: empireId,
            loser: isAttacker ? war.defender : war.attacker,
            warGoal: war.warGoal,
            finalScore: myScore,
            conqueredPlanets: [],
            liberatedPlanets: [],
            reparations: null
        };
        
        // Apply war goal effects
        switch (war.warGoal) {
            case 'conquest':
                // Claims become conquests (handled by caller)
                terms.conqueredPlanets = war.claims.slice(0, Math.floor(myScore / 25));  // 1 planet per 25 score
                break;
            case 'humiliation':
                // Calculate reparations
                terms.reparations = {
                    percent: goalDef.reparationsPercent,
                    resources: {}  // Filled by caller with actual amounts
                };
                break;
            case 'liberation':
                // Planets become neutral (handled by caller)
                terms.liberatedPlanets = options.liberationTargets || [];
                break;
            case 'subjugation':
                // Create vassal relationship (future feature)
                terms.vassalized = true;
                break;
            case 'defensive':
            case 'total_war':
                // Full claims allowed
                terms.conqueredPlanets = war.claims;
                break;
        }
        
        // End the war
        war.status = isAttacker ? 'attacker_victory' : 'defender_victory';
        war.endedAt = new Date().toISOString();
        war.terms = terms;
        
        // Update diplomatic relation to neutral
        this.setRelation(war.attacker, war.defender, 'neutral', {
            previousWar: warId,
            warEnded: Date.now()
        });
        
        // Archive war
        this.archiveWar(war);
        
        return { 
            success: true, 
            terms,
            message: `${goalDef.icon} War ended! ${goalDef.name} achieved.`
        };
    }

    /**
     * Propose white peace (status quo ante bellum)
     * Both sides return to pre-war borders, no victor
     */
    proposeWhitePeace(fromEmpire, toEmpire) {
        const war = this.getWarBetween(fromEmpire, toEmpire);
        if (!war) {
            return { success: false, error: 'No active war with this empire' };
        }
        
        // Can only propose white peace if both sides have > 25 exhaustion
        const fromExhaustion = war.attacker === fromEmpire ? war.attackerExhaustion : war.defenderExhaustion;
        if (fromExhaustion < 25) {
            return { success: false, error: 'Need at least 25 war exhaustion to propose white peace' };
        }
        
        this.pendingProposals.push({
            type: 'white_peace',
            from: fromEmpire,
            to: toEmpire,
            warId: war.id,
            created: Date.now()
        });
        
        return { success: true, message: 'White peace proposed' };
    }

    /**
     * Accept white peace proposal
     */
    acceptWhitePeace(fromEmpire, toEmpire) {
        const idx = this.pendingProposals.findIndex(p =>
            p.type === 'white_peace' &&
            p.from === fromEmpire &&
            p.to === toEmpire
        );

        if (idx < 0) {
            return { success: false, error: 'No pending white peace proposal' };
        }
        
        const proposal = this.pendingProposals[idx];
        const war = this.activeWars.get(proposal.warId);
        
        if (!war || war.status !== 'active') {
            this.pendingProposals.splice(idx, 1);
            return { success: false, error: 'War already ended' };
        }
        
        // End the war as white peace
        war.status = 'white_peace';
        war.endedAt = new Date().toISOString();
        war.terms = {
            type: 'white_peace',
            message: 'Both sides agreed to return to status quo'
        };
        
        // Update diplomatic relation to neutral
        this.setRelation(war.attacker, war.defender, 'neutral', {
            previousWar: war.id,
            whitePeace: true
        });
        
        this.pendingProposals.splice(idx, 1);
        this.archiveWar(war);
        
        return { 
            success: true, 
            message: '☮️ White peace accepted - war ends with no victor'
        };
    }

    /**
     * Archive a completed war to history
     */
    archiveWar(war) {
        this.activeWars.delete(war.id);
        this.warHistory.push(war);
        
        // Keep only last 50 wars in history
        if (this.warHistory.length > 50) {
            this.warHistory = this.warHistory.slice(-50);
        }
    }

    /**
     * Check if empire can claim a planet in war
     * @param {string} empireId - Empire trying to claim
     * @param {string} planetId - Planet to claim
     */
    canClaimPlanet(empireId, planetId, targetEmpireId) {
        const war = this.getWarBetween(empireId, targetEmpireId);
        if (!war) return { allowed: false, error: 'No war with this empire' };
        
        const isAttacker = war.attacker === empireId;
        const goalDef = war.goalDef || WAR_GOAL_TYPES[war.warGoal];
        
        // Check max claims
        if (goalDef.maxClaims === 0) {
            return { allowed: false, error: `${goalDef.name} war goal does not allow conquest` };
        }
        
        if (goalDef.maxClaims !== -1 && war.claims.length >= goalDef.maxClaims) {
            return { allowed: false, error: `Maximum claims reached (${goalDef.maxClaims})` };
        }
        
        // Check if already claimed
        if (war.claims.includes(planetId)) {
            return { allowed: false, error: 'Planet already claimed' };
        }
        
        return { allowed: true };
    }

    /**
     * Add a claim to a war
     */
    addWarClaim(empireId, planetId, targetEmpireId) {
        const canClaim = this.canClaimPlanet(empireId, planetId, targetEmpireId);
        if (!canClaim.allowed) return canClaim;
        
        const war = this.getWarBetween(empireId, targetEmpireId);
        war.claims.push(planetId);
        
        return { success: true, message: 'Planet claimed as war goal' };
    }

    /**
     * Get available war goal types for declaring war
     */
    getAvailableWarGoals() {
        return Object.entries(WAR_GOAL_TYPES).map(([id, def]) => ({
            id,
            name: def.name,
            icon: def.icon,
            description: def.description,
            warScoreToWin: def.warScoreToWin,
            maxClaims: def.maxClaims,
            aggressorPenalty: def.aggressorPenalty
        }));
    }


    loadState(saved) {
        if (!saved) return;
        
        this.relations.clear();
        
        if (saved.relations) {
            for (const [key, value] of Object.entries(saved.relations)) {
                this.relations.set(key, value);
            }
        }
        
        this.pendingProposals = saved.pendingProposals || [];
        
        // Load war goals system state
        if (saved.activeWars) {
            this.activeWars.clear();
            for (const war of saved.activeWars) {
                this.activeWars.set(war.id, war);
            }
        }
        this.nextWarId = saved.nextWarId || this.activeWars.size + 1;
        this.warHistory = saved.warHistory || [];
        console.log(`   📂 Wars: ${this.activeWars.size} active wars loaded`);
        
        // Load trade state
        if (saved.trades) {
            this.trades.clear();
            for (const trade of saved.trades) {
                this.trades.set(trade.id, trade);
            }
        }
        this.nextTradeId = saved.nextTradeId || this.trades.size + 1;
        this.tradeHistory = saved.tradeHistory || [];
        
        console.log(`   📂 Diplomacy: ${this.relations.size} relations, ${this.trades.size} pending trades loaded`);
    }

    // ==========================================
    // INTER-EMPIRE TRADING SYSTEM
    // ==========================================

    /**
     * Propose a trade with another empire
     * @param {string} fromEmpire - Empire proposing the trade
     * @param {string} toEmpire - Empire receiving the offer
     * @param {object} offer - Resources being offered { minerals: X, energy: Y, ... }
     * @param {object} request - Resources being requested { research: Z, credits: W, ... }
     * @param {number} currentTick - Current game tick (for expiry)
     * @returns {object} Result with success/error and trade data
     */
    proposeTrade(fromEmpire, toEmpire, offer, request, currentTick) {
        if (fromEmpire === toEmpire) {
            return { success: false, error: 'Cannot trade with yourself' };
        }

        // Check if at war
        const relation = this.getRelation(fromEmpire, toEmpire);
        if (relation === 'war') {
            return { success: false, error: 'Cannot trade with empires you are at war with' };
        }

        // Check pending trade limit
        const pendingCount = this.getPendingTradesFrom(fromEmpire).length;
        if (pendingCount >= this.MAX_PENDING_TRADES_PER_EMPIRE) {
            return { success: false, error: `Maximum pending trades reached (${this.MAX_PENDING_TRADES_PER_EMPIRE})` };
        }

        // Validate offer and request have at least one resource
        const offerTotal = Object.values(offer || {}).reduce((a, b) => a + b, 0);
        const requestTotal = Object.values(request || {}).reduce((a, b) => a + b, 0);
        
        if (offerTotal <= 0 && requestTotal <= 0) {
            return { success: false, error: 'Trade must include resources' };
        }

        // Clean up zero values
        const cleanOffer = {};
        const cleanRequest = {};
        
        for (const [resource, amount] of Object.entries(offer || {})) {
            if (amount > 0) cleanOffer[resource] = Math.floor(amount);
        }
        for (const [resource, amount] of Object.entries(request || {})) {
            if (amount > 0) cleanRequest[resource] = Math.floor(amount);
        }

        const tradeId = `trade_${this.nextTradeId++}`;
        const trade = {
            id: tradeId,
            from: fromEmpire,
            to: toEmpire,
            offer: cleanOffer,
            request: cleanRequest,
            status: 'pending',
            createdTick: currentTick,
            expiryTick: currentTick + this.TRADE_EXPIRY_TICKS,
            createdAt: Date.now()
        };

        this.trades.set(tradeId, trade);

        return { 
            success: true, 
            trade,
            message: 'Trade proposal sent'
        };
    }

    /**
     * Accept a pending trade offer
     * @param {string} empireId - Empire accepting (must be the 'to' empire)
     * @param {string} tradeId - Trade ID to accept
     * @param {function} canAffordFn - Function to check if empires can afford
     * @param {function} transferFn - Function to transfer resources
     * @param {function} getDiplomacyBonus - Optional: (empireId) => diplomacy modifier (e.g., 1.30 for Celesti)
     * @returns {object} Result
     */
    acceptTrade(empireId, tradeId, canAffordFn, transferFn, getDiplomacyBonus = null) {
        const trade = this.trades.get(tradeId);
        
        if (!trade) {
            return { success: false, error: 'Trade not found' };
        }

        if (trade.to !== empireId) {
            return { success: false, error: 'This trade offer is not for you' };
        }

        if (trade.status !== 'pending') {
            return { success: false, error: 'Trade is no longer pending' };
        }

        // Check if proposing empire can still afford their offer
        if (!canAffordFn(trade.from, trade.offer)) {
            // Auto-cancel the trade
            trade.status = 'cancelled';
            trade.resolvedAt = Date.now();
            this.archiveTrade(trade);
            return { success: false, error: 'Proposing empire can no longer afford this trade' };
        }

        // Check if accepting empire can afford the request
        if (!canAffordFn(trade.to, trade.request)) {
            return { success: false, error: 'You cannot afford the requested resources' };
        }

        // 🤝 DIPLOMACY BONUS - Species with diplomacy bonuses get extra from trades!
        // Celesti (+30%) receiving 100 minerals gets 130 minerals
        // Both parties benefit from their own diplomacy skill
        let offerWithBonus = { ...trade.offer };
        let requestWithBonus = { ...trade.request };
        let diplomacyBonuses = { fromBonus: 0, toBonus: 0 };
        
        if (getDiplomacyBonus) {
            const fromBonus = getDiplomacyBonus(trade.from);
            const toBonus = getDiplomacyBonus(trade.to);
            
            // Apply bonus to what each empire RECEIVES (not what they give)
            // 'From' empire receives 'request', 'To' empire receives 'offer'
            if (fromBonus > 1.0) {
                // From empire gets bonus on what they receive (the request)
                for (const [resource, amount] of Object.entries(trade.request)) {
                    requestWithBonus[resource] = Math.floor(amount * fromBonus);
                }
                diplomacyBonuses.fromBonus = Math.round((fromBonus - 1) * 100);
            }
            
            if (toBonus > 1.0) {
                // To empire gets bonus on what they receive (the offer)
                for (const [resource, amount] of Object.entries(trade.offer)) {
                    offerWithBonus[resource] = Math.floor(amount * toBonus);
                }
                diplomacyBonuses.toBonus = Math.round((toBonus - 1) * 100);
            }
        }

        // Execute the trade!
        // From empire gives their offer to To empire (with To's diplomacy bonus)
        transferFn(trade.from, trade.to, offerWithBonus);
        // To empire gives their payment to From empire (with From's diplomacy bonus)
        transferFn(trade.to, trade.from, requestWithBonus);

        trade.status = 'accepted';
        trade.resolvedAt = Date.now();
        trade.diplomacyBonuses = diplomacyBonuses;  // Record bonuses for history/display
        this.archiveTrade(trade);

        // Build detailed message with diplomacy bonuses
        let message = 'Trade completed!';
        if (diplomacyBonuses.fromBonus > 0 || diplomacyBonuses.toBonus > 0) {
            const bonusParts = [];
            if (diplomacyBonuses.toBonus > 0) {
                bonusParts.push(`You received +${diplomacyBonuses.toBonus}% diplomacy bonus!`);
            }
            if (diplomacyBonuses.fromBonus > 0) {
                bonusParts.push(`Partner received +${diplomacyBonuses.fromBonus}% diplomacy bonus`);
            }
            message = `Trade completed! ${bonusParts.join(' ')}`;
        }

        return { 
            success: true, 
            trade,
            message,
            diplomacyBonuses
        };
    }

    /**
     * Reject a trade offer
     */
    rejectTrade(empireId, tradeId) {
        const trade = this.trades.get(tradeId);
        
        if (!trade) {
            return { success: false, error: 'Trade not found' };
        }

        if (trade.to !== empireId) {
            return { success: false, error: 'This trade offer is not for you' };
        }

        if (trade.status !== 'pending') {
            return { success: false, error: 'Trade is no longer pending' };
        }

        trade.status = 'rejected';
        trade.resolvedAt = Date.now();
        this.archiveTrade(trade);

        return { success: true, message: 'Trade rejected' };
    }

    /**
     * Cancel your own pending trade
     */
    cancelTrade(empireId, tradeId) {
        const trade = this.trades.get(tradeId);
        
        if (!trade) {
            return { success: false, error: 'Trade not found' };
        }

        if (trade.from !== empireId) {
            return { success: false, error: 'You can only cancel trades you proposed' };
        }

        if (trade.status !== 'pending') {
            return { success: false, error: 'Trade is no longer pending' };
        }

        trade.status = 'cancelled';
        trade.resolvedAt = Date.now();
        this.archiveTrade(trade);

        return { success: true, message: 'Trade cancelled' };
    }

    /**
     * Move completed trade to history
     */
    archiveTrade(trade) {
        this.trades.delete(trade.id);
        this.tradeHistory.push(trade);
        
        // Keep only last 100 trades in history
        if (this.tradeHistory.length > 100) {
            this.tradeHistory = this.tradeHistory.slice(-100);
        }
    }

    /**
     * Clean up expired trades
     */
    cleanupExpiredTrades(currentTick) {
        const expired = [];
        
        for (const [tradeId, trade] of this.trades) {
            if (trade.status === 'pending' && currentTick >= trade.expiryTick) {
                trade.status = 'expired';
                trade.resolvedAt = Date.now();
                expired.push(trade);
            }
        }

        for (const trade of expired) {
            this.archiveTrade(trade);
        }

        return expired;
    }

    /**
     * Get pending trades FROM an empire (offers they've made)
     */
    getPendingTradesFrom(empireId) {
        const trades = [];
        for (const trade of this.trades.values()) {
            if (trade.from === empireId && trade.status === 'pending') {
                trades.push(trade);
            }
        }
        return trades;
    }

    /**
     * Get pending trades TO an empire (offers they've received)
     */
    getPendingTradesTo(empireId) {
        const trades = [];
        for (const trade of this.trades.values()) {
            if (trade.to === empireId && trade.status === 'pending') {
                trades.push(trade);
            }
        }
        return trades;
    }

    /**
     * Get all trades involving an empire
     */
    getTradesFor(empireId) {
        const outgoing = this.getPendingTradesFrom(empireId);
        const incoming = this.getPendingTradesTo(empireId);
        const history = this.tradeHistory.filter(t => 
            t.from === empireId || t.to === empireId
        ).slice(-20);

        return {
            outgoing,
            incoming,
            history
        };
    }

    /**
     * Get all pending trades (for observer)
     */
    getAllPendingTrades() {
        return Array.from(this.trades.values()).filter(t => t.status === 'pending');
    }

    /**
     * Format trade for display
     */
    formatTrade(trade, empireNames) {
        const fromName = empireNames[trade.from] || trade.from;
        const toName = empireNames[trade.to] || trade.to;
        
        const offerStr = Object.entries(trade.offer)
            .map(([r, v]) => `${v} ${r}`)
            .join(', ') || 'nothing';
        const requestStr = Object.entries(trade.request)
            .map(([r, v]) => `${v} ${r}`)
            .join(', ') || 'nothing';

        return `${fromName} offers [${offerStr}] for [${requestStr}] to ${toName}`;
    }

    /**
     * Serialize trade data for save
     */
    serializeTrades() {
        return {
            trades: Array.from(this.trades.values()),
            nextTradeId: this.nextTradeId,
            tradeHistory: this.tradeHistory
        };
    }

    /**
     * Clean up orphaned relations and trades pointing to non-existent empires
     * @param {Set|Array} validEmpireIds - Set or array of existing empire IDs
     * @returns {object} Cleanup stats
     */
    cleanupOrphanedRelations(validEmpireIds) {
        const validSet = validEmpireIds instanceof Set ? validEmpireIds : new Set(validEmpireIds);
        let relationsRemoved = 0;
        let proposalsRemoved = 0;
        let tradesRemoved = 0;

        // Clean up relations
        const keysToRemove = [];
        this.relations.forEach((value, key) => {
            const [empire1, empire2] = key.split('_');
            if (!validSet.has(empire1) || !validSet.has(empire2)) {
                keysToRemove.push(key);
            }
        });
        keysToRemove.forEach(key => {
            this.relations.delete(key);
            relationsRemoved++;
        });

        // Clean up pending proposals
        const validProposals = this.pendingProposals.filter(p => 
            validSet.has(p.from) && validSet.has(p.to)
        );
        proposalsRemoved = this.pendingProposals.length - validProposals.length;
        this.pendingProposals = validProposals;

        // Clean up pending trades
        const tradeIdsToRemove = [];
        this.trades.forEach((trade, tradeId) => {
            if (!validSet.has(trade.from) || !validSet.has(trade.to)) {
                tradeIdsToRemove.push(tradeId);
            }
        });
        tradeIdsToRemove.forEach(id => {
            this.trades.delete(id);
            tradesRemoved++;
        });

        console.log(`   🧹 Diplomacy cleanup: ${relationsRemoved} relations, ${proposalsRemoved} proposals, ${tradesRemoved} trades removed`);

        return {
            relationsRemoved,
            proposalsRemoved,
            tradesRemoved
        };
    }
}
