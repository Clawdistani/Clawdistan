// ═══════════════════════════════════════════════════════════════════════════════
// PERFORMANCE OPTIMIZATIONS - Async processing, entity culling, cleanup, tick budget
// ═══════════════════════════════════════════════════════════════════════════════

// Entity hard limits - prevent runaway entity accumulation
export const ENTITY_LIMITS = {
    SOFT_CAP: 3000,      // Start aggressive cleanup above this
    HARD_CAP: 5000,      // Force cull oldest entities above this
    WARNING_THRESHOLD: 2500, // Log warnings above this
    PER_EMPIRE_CAP: 500, // Max entities per empire (prevents one empire dominating)
    CLEANUP_BATCH: 100   // How many to clean per aggressive pass
};

// Tick budget configuration
export const TICK_BUDGET = {
    TARGET_MS: 50,       // Target tick duration (ms)
    WARNING_MS: 100,     // Log warning above this
    CRITICAL_MS: 200,    // Enter performance panic mode above this
    RECOVERY_TICKS: 30,  // Ticks to stay in panic mode after critical
    PANIC_CLEANUP_FREQ: 10 // Cleanup every N ticks in panic mode (vs 60 normally)
};

/**
 * Tick Budget Monitor - Tracks tick performance and triggers protective measures
 * Prevents tick buildup from causing health check failures
 */
export class TickBudgetMonitor {
    constructor() {
        this.history = [];          // Last N tick durations
        this.historySize = 60;      // Keep 1 minute of history
        this.panicMode = false;     // In performance panic mode?
        this.panicTicksRemaining = 0;
        this.consecutiveSlowTicks = 0;
        this.stats = {
            totalTicks: 0,
            slowTicks: 0,          // > WARNING_MS
            criticalTicks: 0,      // > CRITICAL_MS
            panicModeActivations: 0,
            maxDuration: 0,
            avgDuration: 0,
            lastSlowTick: null
        };
    }

    /**
     * Record a tick duration and update state
     * @returns {{ panicMode: boolean, shouldCleanup: boolean, skipHeavyOps: boolean }}
     */
    recordTick(durationMs, currentTick) {
        this.stats.totalTicks++;
        this.history.push(durationMs);
        if (this.history.length > this.historySize) {
            this.history.shift();
        }

        // Track max
        if (durationMs > this.stats.maxDuration) {
            this.stats.maxDuration = durationMs;
        }

        // Update average
        const sum = this.history.reduce((a, b) => a + b, 0);
        this.stats.avgDuration = this.history.length > 0 ? sum / this.history.length : 0;

        // Check thresholds
        const isWarning = durationMs > TICK_BUDGET.WARNING_MS;
        const isCritical = durationMs > TICK_BUDGET.CRITICAL_MS;

        if (isWarning) {
            this.stats.slowTicks++;
            this.stats.lastSlowTick = currentTick;
            this.consecutiveSlowTicks++;
        } else {
            this.consecutiveSlowTicks = 0;
        }

        if (isCritical) {
            this.stats.criticalTicks++;
            // Enter panic mode
            if (!this.panicMode) {
                this.panicMode = true;
                this.stats.panicModeActivations++;
                console.warn(`🚨 PANIC MODE ACTIVATED: Tick ${currentTick} took ${durationMs}ms`);
            }
            this.panicTicksRemaining = TICK_BUDGET.RECOVERY_TICKS;
        }

        // Panic mode countdown
        if (this.panicMode) {
            this.panicTicksRemaining--;
            if (this.panicTicksRemaining <= 0 && !isCritical) {
                this.panicMode = false;
                console.log(`✅ PANIC MODE DEACTIVATED: Performance recovered`);
            }
        }

        // Determine recommended actions
        return {
            panicMode: this.panicMode,
            shouldCleanup: this.panicMode && (currentTick % TICK_BUDGET.PANIC_CLEANUP_FREQ === 0),
            skipHeavyOps: this.panicMode || this.consecutiveSlowTicks >= 3,
            warningLevel: isCritical ? 'critical' : (isWarning ? 'warning' : 'ok')
        };
    }

    getStats() {
        return {
            ...this.stats,
            panicMode: this.panicMode,
            panicTicksRemaining: this.panicTicksRemaining,
            consecutiveSlowTicks: this.consecutiveSlowTicks,
            avgDurationFormatted: this.stats.avgDuration.toFixed(2) + 'ms',
            recentHistory: this.history.slice(-10)
        };
    }

    reset() {
        this.history = [];
        this.panicMode = false;
        this.panicTicksRemaining = 0;
        this.consecutiveSlowTicks = 0;
        this.stats = {
            totalTicks: 0,
            slowTicks: 0,
            criticalTicks: 0,
            panicModeActivations: 0,
            maxDuration: 0,
            avgDuration: 0,
            lastSlowTick: null
        };
    }
}

/**
 * Async chunk processor - prevents blocking the event loop
 * Processes items in batches with setImmediate breaks
 */
export function processInChunks(items, processFn, chunkSize = 100) {
    return new Promise((resolve) => {
        let index = 0;
        const results = [];
        
        function processChunk() {
            const end = Math.min(index + chunkSize, items.length);
            
            while (index < end) {
                const result = processFn(items[index], index);
                if (result !== undefined) {
                    results.push(result);
                }
                index++;
            }
            
            if (index < items.length) {
                // Yield to event loop before next chunk
                setImmediate(processChunk);
            } else {
                resolve(results);
            }
        }
        
        processChunk();
    });
}

/**
 * Spatial indexing for entities - QuadTree-like bucketing
 * Divides universe into grid cells for O(1) region queries
 */
export class SpatialIndex {
    constructor(cellSize = 5000) {
        this.cellSize = cellSize;
        this.cells = new Map(); // "x,y" -> Set of entity IDs
        this.entityCells = new Map(); // entityId -> "x,y"
    }
    
    getCellKey(x, y) {
        const cellX = Math.floor(x / this.cellSize);
        const cellY = Math.floor(y / this.cellSize);
        return `${cellX},${cellY}`;
    }
    
    add(entityId, x, y) {
        const key = this.getCellKey(x, y);
        
        // Remove from old cell if exists
        this.remove(entityId);
        
        // Add to new cell
        if (!this.cells.has(key)) {
            this.cells.set(key, new Set());
        }
        this.cells.get(key).add(entityId);
        this.entityCells.set(entityId, key);
    }
    
    remove(entityId) {
        const oldKey = this.entityCells.get(entityId);
        if (oldKey) {
            const cell = this.cells.get(oldKey);
            if (cell) {
                cell.delete(entityId);
                if (cell.size === 0) {
                    this.cells.delete(oldKey);
                }
            }
            this.entityCells.delete(entityId);
        }
    }
    
    // Get entities in viewport (x, y, width, height)
    getInViewport(x, y, width, height) {
        const entityIds = new Set();
        
        const startCellX = Math.floor(x / this.cellSize);
        const startCellY = Math.floor(y / this.cellSize);
        const endCellX = Math.floor((x + width) / this.cellSize);
        const endCellY = Math.floor((y + height) / this.cellSize);
        
        for (let cx = startCellX; cx <= endCellX; cx++) {
            for (let cy = startCellY; cy <= endCellY; cy++) {
                const key = `${cx},${cy}`;
                const cell = this.cells.get(key);
                if (cell) {
                    for (const id of cell) {
                        entityIds.add(id);
                    }
                }
            }
        }
        
        return entityIds;
    }
    
    clear() {
        this.cells.clear();
        this.entityCells.clear();
    }
}

/**
 * Entity cleanup utilities - handles regular and aggressive cleanup
 */
export class EntityCleanup {
    /**
     * Clean up dead, orphaned, and eliminated empire entities
     * Returns count of removed entities
     */
    static cleanup(entityManager, universe, empires) {
        const toRemove = [];
        const now = Date.now();
        
        for (const [id, entity] of entityManager.entities) {
            // P2 Fix 1: Remove dead entities (hp <= 0)
            if (entity.hp !== undefined && entity.hp <= 0) {
                toRemove.push({ id, reason: 'dead' });
                continue;
            }
            
            // P2 Fix 2: Remove orphaned entities (location doesn't exist)
            if (entity.location) {
                const planet = universe.getPlanet(entity.location);
                if (!planet) {
                    // Location doesn't exist - orphaned
                    toRemove.push({ id, reason: 'orphaned' });
                    continue;
                }
            }
            
            // P2 Fix 3: Remove entities from eliminated empires
            if (entity.owner) {
                const empire = empires.get(entity.owner);
                if (!empire) {
                    // Empire doesn't exist
                    toRemove.push({ id, reason: 'no_empire' });
                    continue;
                }
                // Check if empire is defeated and has 0 planets
                if (empire.defeated) {
                    toRemove.push({ id, reason: 'defeated_empire' });
                    continue;
                }
            }
        }
        
        // Remove marked entities
        for (const { id, reason } of toRemove) {
            entityManager.entities.delete(id);
        }
        
        if (toRemove.length > 0) {
            console.log(`🧹 Cleanup: removed ${toRemove.length} entities (dead: ${toRemove.filter(r => r.reason === 'dead').length}, orphaned: ${toRemove.filter(r => r.reason === 'orphaned').length}, eliminated: ${toRemove.filter(r => r.reason === 'no_empire' || r.reason === 'defeated_empire').length})`);
        }
        
        return toRemove.length;
    }

    /**
     * Aggressive cleanup - called when entity count exceeds soft cap
     * Prioritizes removing low-value entities first
     * @returns {number} Count of removed entities
     */
    static aggressiveCleanup(entityManager, universe, empires, targetRemoval = ENTITY_LIMITS.CLEANUP_BATCH) {
        // First do normal cleanup
        let removed = this.cleanup(entityManager, universe, empires);
        
        const currentCount = entityManager.entities.size;
        if (currentCount <= ENTITY_LIMITS.SOFT_CAP) {
            return removed; // Already under control
        }

        // Calculate how many more we need to remove
        const excess = currentCount - ENTITY_LIMITS.SOFT_CAP;
        const toRemoveCount = Math.min(excess, targetRemoval);
        
        if (toRemoveCount <= 0) return removed;

        // Score entities by importance (lower = more likely to cull)
        const entityScores = [];
        for (const [id, entity] of entityManager.entities) {
            const score = this._getEntityImportance(entity, empires);
            entityScores.push({ id, entity, score });
        }

        // Sort by score ascending (lowest importance first)
        entityScores.sort((a, b) => a.score - b.score);

        // Remove the least important entities
        let culled = 0;
        for (let i = 0; i < toRemoveCount && i < entityScores.length; i++) {
            const { id, entity } = entityScores[i];
            // Don't cull structures or high-HP units
            if (entity.type === 'structure' && entity.hp > 50) continue;
            
            entityManager.entities.delete(id);
            culled++;
        }

        if (culled > 0) {
            console.log(`🔥 Aggressive cleanup: culled ${culled} low-priority entities (${currentCount - culled} remaining)`);
        }

        return removed + culled;
    }

    /**
     * Hard limit enforcement - called when entity count exceeds hard cap
     * Forces removal regardless of importance (except structures)
     */
    static enforceHardLimit(entityManager, universe, empires) {
        const currentCount = entityManager.entities.size;
        if (currentCount <= ENTITY_LIMITS.HARD_CAP) {
            return 0;
        }

        // First do aggressive cleanup
        this.aggressiveCleanup(entityManager, universe, empires, ENTITY_LIMITS.CLEANUP_BATCH * 3);

        // If still over hard cap, force cull units (not structures)
        const stillOver = entityManager.entities.size - ENTITY_LIMITS.HARD_CAP;
        if (stillOver <= 0) return 0;

        // Get all non-structure entities sorted by age (oldest first)
        const units = [];
        for (const [id, entity] of entityManager.entities) {
            if (entity.type !== 'structure') {
                units.push({ id, createdAt: entity.createdAt || 0 });
            }
        }
        units.sort((a, b) => a.createdAt - b.createdAt);

        // Force remove oldest units
        let forceRemoved = 0;
        for (let i = 0; i < stillOver && i < units.length; i++) {
            entityManager.entities.delete(units[i].id);
            forceRemoved++;
        }

        if (forceRemoved > 0) {
            console.warn(`⚠️ HARD LIMIT: Force-removed ${forceRemoved} oldest units (was ${currentCount}, now ${entityManager.entities.size})`);
        }

        return forceRemoved;
    }

    /**
     * Per-empire limit enforcement
     * Prevents one empire from accumulating too many entities
     */
    static enforcePerEmpireLimits(entityManager, empires) {
        const byOwner = new Map();
        
        // Count entities per empire
        for (const [id, entity] of entityManager.entities) {
            if (!entity.owner) continue;
            if (!byOwner.has(entity.owner)) {
                byOwner.set(entity.owner, []);
            }
            byOwner.get(entity.owner).push({ id, entity, createdAt: entity.createdAt || 0 });
        }

        let totalRemoved = 0;

        // For each empire over the limit, remove oldest units
        for (const [empireId, entities] of byOwner) {
            if (entities.length <= ENTITY_LIMITS.PER_EMPIRE_CAP) continue;

            const excess = entities.length - ENTITY_LIMITS.PER_EMPIRE_CAP;
            
            // Sort by creation time (oldest first), prioritize non-structures
            entities.sort((a, b) => {
                // Structures sort last (don't want to remove them first)
                if (a.entity.type === 'structure' && b.entity.type !== 'structure') return 1;
                if (a.entity.type !== 'structure' && b.entity.type === 'structure') return -1;
                return a.createdAt - b.createdAt;
            });

            for (let i = 0; i < excess; i++) {
                entityManager.entities.delete(entities[i].id);
                totalRemoved++;
            }

            if (excess > 0) {
                const empire = empires.get(empireId);
                console.log(`🧹 Empire limit: Removed ${excess} entities from ${empire?.name || empireId}`);
            }
        }

        return totalRemoved;
    }

    /**
     * Calculate entity importance score (higher = more important, less likely to cull)
     */
    static _getEntityImportance(entity, empires) {
        let score = 0;

        // Base score by type
        if (entity.type === 'structure') score += 1000; // Structures are important
        if (entity.type === 'unit') score += 100;

        // HP remaining matters
        if (entity.hp !== undefined && entity.maxHp) {
            score += (entity.hp / entity.maxHp) * 50;
        }

        // Attack power
        if (entity.attack) {
            score += entity.attack * 2;
        }

        // Special units
        if (entity.defName === 'colony_ship') score += 500;
        if (entity.defName === 'battleship') score += 200;
        if (entity.defName === 'carrier') score += 150;
        if (entity.defName === 'titan') score += 300;

        // In transit units are important (active gameplay)
        if (entity.inTransit) score += 100;

        return score;
    }
    
    /**
     * Get entity statistics for monitoring
     */
    static getStats(entityManager) {
        const stats = {
            total: entityManager.entities.size,
            byType: {},
            byOwner: {},
            dead: 0,
            orphaned: 0,
            limits: {
                softCap: ENTITY_LIMITS.SOFT_CAP,
                hardCap: ENTITY_LIMITS.HARD_CAP,
                perEmpireCap: ENTITY_LIMITS.PER_EMPIRE_CAP,
                status: entityManager.entities.size < ENTITY_LIMITS.WARNING_THRESHOLD ? '✅ OK' :
                        entityManager.entities.size < ENTITY_LIMITS.SOFT_CAP ? '⚠️ WARNING' :
                        entityManager.entities.size < ENTITY_LIMITS.HARD_CAP ? '🔥 HIGH' : '🚨 CRITICAL'
            }
        };
        
        for (const [id, entity] of entityManager.entities) {
            // Count by type
            const type = entity.type || 'unknown';
            stats.byType[type] = (stats.byType[type] || 0) + 1;
            
            // Count by owner
            if (entity.owner) {
                stats.byOwner[entity.owner] = (stats.byOwner[entity.owner] || 0) + 1;
            }
            
            // Count dead
            if (entity.hp !== undefined && entity.hp <= 0) {
                stats.dead++;
            }
        }
        
        return stats;
    }

    /**
     * Full cleanup pass - runs all cleanup strategies
     * Call this when performance is critical
     */
    static fullCleanup(entityManager, universe, empires) {
        let total = 0;
        total += this.cleanup(entityManager, universe, empires);
        total += this.enforcePerEmpireLimits(entityManager, empires);
        total += this.aggressiveCleanup(entityManager, universe, empires);
        total += this.enforceHardLimit(entityManager, universe, empires);
        return total;
    }
}

/**
 * Lightweight entity serialization for /api/state
 * Only includes essential fields, skipping heavy data
 */
export function serializeEntityLight(entity) {
    return {
        id: entity.id,
        defName: entity.defName,
        type: entity.type,
        owner: entity.owner,
        location: entity.location,
        hp: entity.hp,
        maxHp: entity.maxHp,
        // Skip: movement details, construction details, full definitions
        // Include position if available
        x: entity.x,
        y: entity.y
    };
}

/**
 * Paginate entities for API response
 */
export function paginateEntities(entities, page = 1, limit = 500) {
    const total = entities.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const paginated = entities.slice(startIndex, startIndex + limit);
    
    return {
        entities: paginated,
        pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1
        }
    };
}
