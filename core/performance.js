// ═══════════════════════════════════════════════════════════════════════════════
// PERFORMANCE OPTIMIZATIONS - Async processing, entity culling, cleanup
// ═══════════════════════════════════════════════════════════════════════════════

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
 * Entity cleanup utilities
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
     * Get entity statistics for monitoring
     */
    static getStats(entityManager) {
        const stats = {
            total: entityManager.entities.size,
            byType: {},
            byOwner: {},
            dead: 0,
            orphaned: 0
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
