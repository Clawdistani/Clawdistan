// ═══════════════════════════════════════════════════════════════════════════════
// COALITION SYSTEM - Underdog alliance mechanics
// ═══════════════════════════════════════════════════════════════════════════════

export class CoalitionManager {
    constructor() {
        // Active coalition: { targetEmpireId, members: [empireId, ...], formedAt, formedTick }
        this.activeCoalition = null;
        
        // Coalition config
        this.config = {
            MAX_MEMBERS: 5,                    // Maximum coalition members
            SCORE_THRESHOLD: 0.50,             // Must have score < 50% of leader to join
            MIN_LEADER_LEAD: 0.25,             // Leader must be 25%+ ahead of #2 for coalition to form
            COMBAT_BONUS: 0.15,                // +15% damage vs coalition target
            VISION_SHARED: true,               // Coalition sees target's fleets
            COOLDOWN_TICKS: 600,               // 10 min cooldown after coalition ends
            MIN_MEMBERS_TO_FORM: 2             // Need at least 2 members to form
        };
        
        // Track when last coalition ended (for cooldown)
        this.lastCoalitionEndTick = null;
        
        // Pending invites: { empireId: { invitedBy, invitedAt, invitedTick } }
        this.pendingInvites = new Map();
    }

    /**
     * Get the current score leader empire
     */
    getScoreLeader(empires) {
        let leader = null;
        let highestScore = 0;
        
        for (const [id, empire] of empires) {
            if (!empire.defeated && empire.score > highestScore) {
                highestScore = empire.score;
                leader = empire;
            }
        }
        
        return leader;
    }

    /**
     * Get ranked list of active empires by score
     */
    getRankedEmpires(empires) {
        const active = [];
        for (const [id, empire] of empires) {
            if (!empire.defeated) {
                active.push(empire);
            }
        }
        return active.sort((a, b) => b.score - a.score);
    }

    /**
     * Check if empire can propose or join a coalition
     */
    canJoinCoalition(empireId, empires, currentTick) {
        const empire = empires.get(empireId);
        if (!empire || empire.defeated) {
            return { allowed: false, reason: 'Empire not found or defeated' };
        }
        
        const leader = this.getScoreLeader(empires);
        if (!leader || leader.id === empireId) {
            return { allowed: false, reason: 'You are the score leader - cannot join coalition against yourself' };
        }
        
        // Check cooldown
        if (this.lastCoalitionEndTick !== null && (currentTick - this.lastCoalitionEndTick) < this.config.COOLDOWN_TICKS) {
            const remaining = this.config.COOLDOWN_TICKS - (currentTick - this.lastCoalitionEndTick);
            return { allowed: false, reason: `Coalition cooldown active (${Math.ceil(remaining / 60)} min remaining)` };
        }
        
        // Check score threshold
        const scoreRatio = empire.score / leader.score;
        if (scoreRatio >= this.config.SCORE_THRESHOLD) {
            return { allowed: false, reason: `Your score is too high to join coalition (need < ${this.config.SCORE_THRESHOLD * 100}% of leader)` };
        }
        
        // If coalition already exists, check if targeting this leader
        if (this.activeCoalition) {
            if (this.activeCoalition.targetEmpireId !== leader.id) {
                return { allowed: false, reason: 'Active coalition targets a different empire' };
            }
            if (this.activeCoalition.members.includes(empireId)) {
                return { allowed: false, reason: 'Already a coalition member' };
            }
            if (this.activeCoalition.members.length >= this.config.MAX_MEMBERS) {
                return { allowed: false, reason: `Coalition is full (${this.config.MAX_MEMBERS} members max)` };
            }
        }
        
        // Check leader's lead is significant enough
        const ranked = this.getRankedEmpires(empires);
        if (ranked.length >= 2) {
            const secondPlace = ranked[1];
            const leadMargin = (leader.score - secondPlace.score) / leader.score;
            if (leadMargin < this.config.MIN_LEADER_LEAD) {
                return { allowed: false, reason: `Leader's lead is not significant enough (needs ${this.config.MIN_LEADER_LEAD * 100}%+ ahead of #2)` };
            }
        }
        
        return { allowed: true };
    }

    /**
     * Propose forming a coalition against the leader
     */
    proposeCoalition(proposerId, empires, currentTick) {
        const canJoin = this.canJoinCoalition(proposerId, empires, currentTick);
        if (!canJoin.allowed) {
            return { success: false, error: canJoin.reason };
        }
        
        // If coalition already exists, this is a join request
        if (this.activeCoalition) {
            return this.joinCoalition(proposerId, empires, currentTick);
        }
        
        // Create new coalition
        const leader = this.getScoreLeader(empires);
        this.activeCoalition = {
            targetEmpireId: leader.id,
            targetName: leader.name,
            members: [proposerId],
            formedAt: Date.now(),
            formedTick: currentTick,
            proposer: proposerId
        };
        
        return {
            success: true,
            coalition: this.activeCoalition,
            message: `Coalition formed against ${leader.name}! Need ${this.config.MIN_MEMBERS_TO_FORM - 1} more member(s) to activate bonuses.`
        };
    }

    /**
     * Join existing coalition
     */
    joinCoalition(empireId, empires, currentTick) {
        const canJoin = this.canJoinCoalition(empireId, empires, currentTick);
        if (!canJoin.allowed) {
            return { success: false, error: canJoin.reason };
        }
        
        if (!this.activeCoalition) {
            return this.proposeCoalition(empireId, empires, currentTick);
        }
        
        this.activeCoalition.members.push(empireId);
        
        const isActive = this.activeCoalition.members.length >= this.config.MIN_MEMBERS_TO_FORM;
        
        return {
            success: true,
            coalition: this.activeCoalition,
            message: isActive 
                ? `Joined coalition against ${this.activeCoalition.targetName}! Combat bonuses now active.`
                : `Joined coalition against ${this.activeCoalition.targetName}. Need ${this.config.MIN_MEMBERS_TO_FORM - this.activeCoalition.members.length} more member(s) to activate bonuses.`
        };
    }

    /**
     * Leave the coalition
     */
    leaveCoalition(empireId) {
        if (!this.activeCoalition) {
            return { success: false, error: 'No active coalition' };
        }
        
        const memberIndex = this.activeCoalition.members.indexOf(empireId);
        if (memberIndex === -1) {
            return { success: false, error: 'Not a coalition member' };
        }
        
        this.activeCoalition.members.splice(memberIndex, 1);
        
        // Disband if no members left
        if (this.activeCoalition.members.length === 0) {
            this.disbandCoalition('all members left');
            return { success: true, message: 'Left coalition (coalition disbanded - no members remaining)' };
        }
        
        return { success: true, message: 'Left the coalition' };
    }

    /**
     * Disband the coalition
     */
    disbandCoalition(reason, currentTick = null) {
        if (!this.activeCoalition) return;
        
        const coalition = this.activeCoalition;
        this.activeCoalition = null;
        this.lastCoalitionEndTick = currentTick;
        this.pendingInvites.clear();
        
        return {
            disbanded: true,
            reason,
            formerMembers: coalition.members,
            targetEmpireId: coalition.targetEmpireId
        };
    }

    /**
     * Check if coalition should disband (called each tick)
     */
    tickUpdate(empires, currentTick) {
        if (!this.activeCoalition) return null;
        
        const target = empires.get(this.activeCoalition.targetEmpireId);
        
        // Disband if target is defeated
        if (!target || target.defeated) {
            return this.disbandCoalition('target empire defeated', currentTick);
        }
        
        // Check if target is still #1
        const leader = this.getScoreLeader(empires);
        if (leader && leader.id !== this.activeCoalition.targetEmpireId) {
            // Target is no longer the leader - disband
            return this.disbandCoalition(`${this.activeCoalition.targetName} is no longer the score leader`, currentTick);
        }
        
        // Clean up members who are defeated
        const originalCount = this.activeCoalition.members.length;
        this.activeCoalition.members = this.activeCoalition.members.filter(memberId => {
            const empire = empires.get(memberId);
            return empire && !empire.defeated;
        });
        
        if (this.activeCoalition.members.length === 0) {
            return this.disbandCoalition('all members defeated', currentTick);
        }
        
        return null; // Coalition continues
    }

    /**
     * Check if empire is in active coalition
     */
    isCoalitionMember(empireId) {
        return this.activeCoalition && this.activeCoalition.members.includes(empireId);
    }

    /**
     * Check if empire is the coalition target
     */
    isCoalitionTarget(empireId) {
        return this.activeCoalition && this.activeCoalition.targetEmpireId === empireId;
    }

    /**
     * Check if coalition is active (has enough members)
     */
    isCoalitionActive() {
        return this.activeCoalition && 
               this.activeCoalition.members.length >= this.config.MIN_MEMBERS_TO_FORM;
    }

    /**
     * Get combat bonus for attacker vs defender
     */
    getCombatBonus(attackerId, defenderId) {
        if (!this.isCoalitionActive()) return 0;
        
        // Coalition members get bonus vs target
        if (this.isCoalitionMember(attackerId) && this.isCoalitionTarget(defenderId)) {
            return this.config.COMBAT_BONUS;
        }
        
        return 0;
    }

    /**
     * Check if empire can see target's fleets (shared vision)
     */
    hasSharedVision(viewerId, targetId) {
        if (!this.isCoalitionActive() || !this.config.VISION_SHARED) return false;
        
        // Coalition members can see target empire's fleets
        if (this.isCoalitionMember(viewerId) && this.isCoalitionTarget(targetId)) {
            return true;
        }
        
        return false;
    }

    /**
     * Get coalition state for an empire (for UI)
     */
    getCoalitionState(empireId, empires, currentTick) {
        const state = {
            active: !!this.activeCoalition,
            isMember: this.isCoalitionMember(empireId),
            isTarget: this.isCoalitionTarget(empireId),
            canJoin: false,
            canJoinReason: null,
            coalition: null,
            cooldownRemaining: 0
        };
        
        if (this.activeCoalition) {
            state.coalition = {
                targetEmpireId: this.activeCoalition.targetEmpireId,
                targetName: this.activeCoalition.targetName,
                memberCount: this.activeCoalition.members.length,
                isActive: this.isCoalitionActive(),
                combatBonus: this.isCoalitionActive() ? this.config.COMBAT_BONUS : 0
            };
        }
        
        if (!state.isMember && !state.isTarget) {
            const canJoin = this.canJoinCoalition(empireId, empires, currentTick);
            state.canJoin = canJoin.allowed;
            state.canJoinReason = canJoin.reason;
        }
        
        if (this.lastCoalitionEndTick && currentTick) {
            const cooldown = this.config.COOLDOWN_TICKS - (currentTick - this.lastCoalitionEndTick);
            state.cooldownRemaining = Math.max(0, cooldown);
        }
        
        return state;
    }

    /**
     * Serialize for persistence
     */
    serialize() {
        return {
            activeCoalition: this.activeCoalition,
            lastCoalitionEndTick: this.lastCoalitionEndTick,
            pendingInvites: Array.from(this.pendingInvites.entries())
        };
    }

    /**
     * Load from persistence
     */
    loadState(saved) {
        if (!saved) return;
        
        this.activeCoalition = saved.activeCoalition || null;
        this.lastCoalitionEndTick = saved.lastCoalitionEndTick || null;
        
        this.pendingInvites.clear();
        if (saved.pendingInvites) {
            for (const [key, value] of saved.pendingInvites) {
                this.pendingInvites.set(key, value);
            }
        }
        
        if (this.activeCoalition) {
            console.log(`   ⚔️ Coalition loaded: ${this.activeCoalition.members.length} members vs ${this.activeCoalition.targetName}`);
        }
    }
}
