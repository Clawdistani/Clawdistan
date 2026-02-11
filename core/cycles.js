// ═══════════════════════════════════════════════════════════════════════════════
// GALACTIC CYCLES - Periodic Galaxy-Wide Events
// ═══════════════════════════════════════════════════════════════════════════════
// Inspired by: Endless Legend's winter mechanic
// 
// The galaxy pulses with cosmic rhythms. Every 15-20 minutes, a new cycle begins,
// affecting all empires. Strategic timing becomes crucial - attack during Warp
// Resonance for speed, turtle during Void Storm for safety.
// ═══════════════════════════════════════════════════════════════════════════════

export const CYCLE_TYPES = {
    normal: {
        id: 'normal',
        name: 'Cosmic Equilibrium',
        icon: '⚖️',
        description: 'The galaxy exists in a state of balance. Standard operations.',
        color: '#888888',
        effects: {
            // No modifiers - baseline state
        },
        minDuration: 900,  // 15 minutes (in ticks/seconds)
        maxDuration: 1200  // 20 minutes
    },
    void_storm: {
        id: 'void_storm',
        name: 'Void Storm',
        icon: '🌀',
        description: 'Violent spacetime distortions sweep across the galaxy. Fleets in transit take damage. Hunker down or risk losses.',
        color: '#6b21a8',
        effects: {
            fleetDamagePerTick: 0.5,      // 0.5% HP per tick for fleets in transit
            travelTimeModifier: 1.25,      // 25% slower travel
            sensorRangeModifier: 0.75,     // 25% reduced sensor range
            shieldRegenModifier: 0.5       // 50% reduced shield regen
        },
        minDuration: 180,  // 3 minutes
        maxDuration: 300   // 5 minutes
    },
    golden_age: {
        id: 'golden_age',
        name: 'Golden Age',
        icon: '✨',
        description: 'Cosmic alignment amplifies productivity. All production increased. Rush to build!',
        color: '#fbbf24',
        effects: {
            productionModifier: 1.5,       // +50% all production
            researchModifier: 1.5,         // +50% research speed
            creditModifier: 1.5,           // +50% credit income
            buildSpeedModifier: 0.75       // 25% faster construction
        },
        minDuration: 180,  // 3 minutes
        maxDuration: 300   // 5 minutes
    },
    dark_era: {
        id: 'dark_era',
        name: 'Dark Era',
        icon: '🌑',
        description: 'Strange radiation floods space, disrupting sensors. Fog of war expands. Perfect for ambushes.',
        color: '#1e293b',
        effects: {
            sensorRangeModifier: 0.5,      // 50% reduced sensor range
            stealthModifier: 1.5,          // 50% harder to detect
            spySuccessModifier: 1.25,      // 25% better spy missions
            detectionChanceModifier: 0.75  // 25% lower detection chance
        },
        minDuration: 180,  // 3 minutes
        maxDuration: 300   // 5 minutes
    },
    warp_resonance: {
        id: 'warp_resonance',
        name: 'Warp Resonance',
        icon: '⚡',
        description: 'Hyperlanes resonate with amplified energy. Travel time halved. Blitz attacks possible!',
        color: '#22d3ee',
        effects: {
            travelTimeModifier: 0.5,       // 50% faster travel!
            fleetSpeedModifier: 2.0,       // Double fleet speed
            invasionCooldownModifier: 0.75 // 25% faster invasion cooldowns
        },
        minDuration: 120,  // 2 minutes
        maxDuration: 240   // 4 minutes
    }
};

// Cycle transition sequence - affects what follows what
const CYCLE_WEIGHTS = {
    normal: { void_storm: 2, golden_age: 3, dark_era: 2, warp_resonance: 3 },
    void_storm: { normal: 5, golden_age: 2, dark_era: 1, warp_resonance: 2 },
    golden_age: { normal: 4, void_storm: 2, dark_era: 2, warp_resonance: 2 },
    dark_era: { normal: 4, void_storm: 2, golden_age: 2, warp_resonance: 2 },
    warp_resonance: { normal: 5, void_storm: 2, golden_age: 2, dark_era: 1 }
};

export class CycleManager {
    constructor() {
        this.currentCycle = 'normal';
        this.cycleStartTick = 0;
        this.cycleDuration = 900; // Default 15 min
        this.nextCycle = null;
        this.warningIssued = false;
        this.cycleHistory = [];
        this.WARNING_LEAD_TIME = 120; // 2 minute warning
    }

    /**
     * Initialize or restore cycle state
     */
    initialize(tick = 0) {
        this.currentCycle = 'normal';
        this.cycleStartTick = tick;
        this.cycleDuration = this.rollDuration('normal');
        this.nextCycle = this.rollNextCycle('normal');
        this.warningIssued = false;
    }

    /**
     * Main tick processing
     * @returns {Object|null} Event if cycle changes or warning issued
     */
    tick(tickCount) {
        const elapsed = tickCount - this.cycleStartTick;
        const remaining = this.cycleDuration - elapsed;
        
        // Issue warning before cycle ends
        if (!this.warningIssued && remaining <= this.WARNING_LEAD_TIME && remaining > 0) {
            this.warningIssued = true;
            const nextCycleInfo = CYCLE_TYPES[this.nextCycle];
            return {
                event: 'cycle_warning',
                currentCycle: this.currentCycle,
                nextCycle: this.nextCycle,
                secondsRemaining: remaining,
                message: `${nextCycleInfo.icon} WARNING: ${nextCycleInfo.name} approaching in ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}!`
            };
        }
        
        // Cycle ends
        if (remaining <= 0) {
            return this.transitionCycle(tickCount);
        }
        
        return null;
    }

    /**
     * Transition to the next cycle
     */
    transitionCycle(tickCount) {
        const previousCycle = this.currentCycle;
        this.currentCycle = this.nextCycle;
        this.cycleStartTick = tickCount;
        this.cycleDuration = this.rollDuration(this.currentCycle);
        this.nextCycle = this.rollNextCycle(this.currentCycle);
        this.warningIssued = false;
        
        // Record in history
        this.cycleHistory.push({
            cycle: previousCycle,
            endTick: tickCount,
            duration: this.cycleDuration
        });
        
        // Keep only last 20 cycles in history
        if (this.cycleHistory.length > 20) {
            this.cycleHistory.shift();
        }
        
        const cycleInfo = CYCLE_TYPES[this.currentCycle];
        return {
            event: 'cycle_started',
            cycle: this.currentCycle,
            previousCycle,
            duration: this.cycleDuration,
            effects: cycleInfo.effects,
            message: `${cycleInfo.icon} ${cycleInfo.name} has begun! ${cycleInfo.description}`
        };
    }

    /**
     * Roll duration for a cycle type
     */
    rollDuration(cycleType) {
        const cycle = CYCLE_TYPES[cycleType];
        return Math.floor(Math.random() * (cycle.maxDuration - cycle.minDuration + 1)) + cycle.minDuration;
    }

    /**
     * Weighted random selection for next cycle
     */
    rollNextCycle(currentCycleType) {
        const weights = CYCLE_WEIGHTS[currentCycleType] || CYCLE_WEIGHTS.normal;
        const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
        let roll = Math.random() * totalWeight;
        
        for (const [cycle, weight] of Object.entries(weights)) {
            roll -= weight;
            if (roll <= 0) return cycle;
        }
        
        return 'normal'; // Fallback
    }

    /**
     * Get current cycle effects
     */
    getEffects() {
        return CYCLE_TYPES[this.currentCycle]?.effects || {};
    }

    /**
     * Get a specific effect modifier (returns 1.0 if not present)
     */
    getEffectModifier(effectName, defaultValue = 1.0) {
        const effects = this.getEffects();
        return effects[effectName] ?? defaultValue;
    }

    /**
     * Get current cycle info for API/UI
     */
    getState(tickCount) {
        const cycle = CYCLE_TYPES[this.currentCycle];
        const elapsed = tickCount - this.cycleStartTick;
        const remaining = Math.max(0, this.cycleDuration - elapsed);
        const nextCycle = CYCLE_TYPES[this.nextCycle];
        
        return {
            current: {
                id: this.currentCycle,
                name: cycle.name,
                icon: cycle.icon,
                description: cycle.description,
                color: cycle.color,
                effects: cycle.effects
            },
            elapsed,
            remaining,
            duration: this.cycleDuration,
            progress: elapsed / this.cycleDuration,
            next: {
                id: this.nextCycle,
                name: nextCycle.name,
                icon: nextCycle.icon,
                color: nextCycle.color
            },
            warningIssued: this.warningIssued,
            history: this.cycleHistory.slice(-5) // Last 5 cycles
        };
    }

    /**
     * Apply fleet damage during Void Storm
     * @returns {Array} List of damaged ships
     */
    applyVoidStormDamage(fleets, entityManager) {
        if (this.currentCycle !== 'void_storm') return [];
        
        const damagePercent = this.getEffectModifier('fleetDamagePerTick', 0);
        if (damagePercent <= 0) return [];
        
        const damaged = [];
        
        for (const fleet of fleets) {
            if (!fleet.inTransit) continue;
            
            for (const shipId of fleet.shipIds) {
                const ship = entityManager.getEntity(shipId);
                if (!ship) continue;
                
                const damage = Math.max(1, Math.floor(ship.maxHp * (damagePercent / 100)));
                ship.hp = Math.max(1, ship.hp - damage); // Don't kill, just damage
                
                damaged.push({
                    shipId,
                    damage,
                    remainingHp: ship.hp
                });
            }
        }
        
        return damaged;
    }

    /**
     * Modify travel time based on current cycle
     */
    modifyTravelTime(baseTravelTime) {
        const modifier = this.getEffectModifier('travelTimeModifier', 1.0);
        return Math.max(1, Math.floor(baseTravelTime * modifier));
    }

    /**
     * Modify production based on current cycle
     */
    modifyProduction(baseProduction) {
        const modifier = this.getEffectModifier('productionModifier', 1.0);
        return baseProduction * modifier;
    }

    /**
     * Modify research based on current cycle
     */
    modifyResearch(baseResearch) {
        const modifier = this.getEffectModifier('researchModifier', 1.0);
        return baseResearch * modifier;
    }

    /**
     * Serialize for persistence
     */
    toJSON() {
        return {
            currentCycle: this.currentCycle,
            cycleStartTick: this.cycleStartTick,
            cycleDuration: this.cycleDuration,
            nextCycle: this.nextCycle,
            warningIssued: this.warningIssued,
            cycleHistory: this.cycleHistory
        };
    }

    /**
     * Restore from persistence
     */
    fromJSON(data) {
        if (!data) {
            this.initialize(0);
            return;
        }
        
        this.currentCycle = data.currentCycle || 'normal';
        this.cycleStartTick = data.cycleStartTick || 0;
        this.cycleDuration = data.cycleDuration || 900;
        this.nextCycle = data.nextCycle || this.rollNextCycle(this.currentCycle);
        this.warningIssued = data.warningIssued || false;
        this.cycleHistory = data.cycleHistory || [];
    }
}
