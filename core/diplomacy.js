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

    declareWar(fromEmpire, toEmpire) {
        const currentRelation = this.getRelation(fromEmpire, toEmpire);

        // Can't declare war on allies without breaking alliance first
        if (currentRelation === 'allied') {
            this.breakAlliance(fromEmpire, toEmpire);
        }

        this.setRelation(fromEmpire, toEmpire, 'war', {
            aggressor: fromEmpire
        });
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

    loadState(saved) {
        if (!saved) return;
        
        this.relations.clear();
        
        if (saved.relations) {
            for (const [key, value] of Object.entries(saved.relations)) {
                this.relations.set(key, value);
            }
        }
        
        this.pendingProposals = saved.pendingProposals || [];
        
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
