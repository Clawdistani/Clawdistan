/**
 * Object Pool - Reusable object caching to reduce GC overhead
 * 
 * Used for frequently created/destroyed objects like:
 * - Projectiles, explosions, damage numbers in battle viewer
 * - Particle effects, trails
 * 
 * Performance benefit: Avoids memory allocation/deallocation churn
 * which causes garbage collection pauses during animations.
 */

export class ObjectPool {
    /**
     * Create a new object pool
     * @param {Function} factory - Function that creates new objects: () => object
     * @param {Function} reset - Function that resets an object for reuse: (obj) => void
     * @param {number} initialSize - Pre-allocate this many objects
     * @param {number} maxSize - Maximum pool size (prevents memory bloat)
     */
    constructor(factory, reset, initialSize = 20, maxSize = 500) {
        this.factory = factory;
        this.reset = reset;
        this.maxSize = maxSize;
        this.pool = [];
        this.activeCount = 0;
        
        // Pre-allocate initial objects
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(factory());
        }
    }
    
    /**
     * Acquire an object from the pool
     * @returns {Object} A fresh or recycled object
     */
    acquire() {
        this.activeCount++;
        if (this.pool.length > 0) {
            const obj = this.pool.pop();
            this.reset(obj);
            return obj;
        }
        // Pool empty - create new object
        return this.factory();
    }
    
    /**
     * Release an object back to the pool
     * @param {Object} obj - The object to release
     */
    release(obj) {
        this.activeCount--;
        if (this.pool.length < this.maxSize) {
            this.pool.push(obj);
        }
        // If pool is at max, let GC collect it
    }
    
    /**
     * Release multiple objects back to the pool
     * @param {Array} objects - Array of objects to release
     */
    releaseAll(objects) {
        for (const obj of objects) {
            this.release(obj);
        }
    }
    
    /**
     * Get pool statistics
     * @returns {Object} Stats about pool usage
     */
    getStats() {
        return {
            pooled: this.pool.length,
            active: this.activeCount,
            maxSize: this.maxSize
        };
    }
    
    /**
     * Clear the pool (for cleanup)
     */
    clear() {
        this.pool = [];
        this.activeCount = 0;
    }
}

/**
 * Pre-configured pools for common game objects
 */

// Projectile pool factory
export function createProjectilePool(initialSize = 50) {
    return new ObjectPool(
        // Factory: create projectile object
        () => ({
            x: 0,
            y: 0,
            targetX: 0,
            targetY: 0,
            speed: 15,
            color: '#ffeb3b',
            trail: [],
            active: false
        }),
        // Reset: clear properties for reuse
        (p) => {
            p.x = 0;
            p.y = 0;
            p.targetX = 0;
            p.targetY = 0;
            p.speed = 15;
            p.color = '#ffeb3b';
            p.trail.length = 0; // Clear array without reallocating
            p.active = true;
        },
        initialSize,
        200
    );
}

// Explosion pool factory
export function createExplosionPool(initialSize = 30) {
    return new ObjectPool(
        // Factory
        () => ({
            x: 0,
            y: 0,
            radius: 0,
            maxRadius: 40,
            alpha: 1,
            color: '#ff9800',
            active: false
        }),
        // Reset
        (e) => {
            e.x = 0;
            e.y = 0;
            e.radius = 0;
            e.maxRadius = 40;
            e.alpha = 1;
            e.color = '#ff9800';
            e.active = true;
        },
        initialSize,
        100
    );
}

// Damage number pool factory
export function createDamageNumberPool(initialSize = 40) {
    return new ObjectPool(
        // Factory
        () => ({
            x: 0,
            y: 0,
            value: 0,
            alpha: 1,
            vy: -2,
            active: false
        }),
        // Reset
        (d) => {
            d.x = 0;
            d.y = 0;
            d.value = 0;
            d.alpha = 1;
            d.vy = -2;
            d.active = true;
        },
        initialSize,
        150
    );
}

// Warp effect pool factory
export function createWarpEffectPool(initialSize = 10) {
    return new ObjectPool(
        // Factory
        () => ({
            x: 0,
            y: 0,
            radius: 0,
            maxRadius: 60,
            alpha: 1,
            color: '#ff6b6b',
            active: false
        }),
        // Reset
        (w) => {
            w.x = 0;
            w.y = 0;
            w.radius = 0;
            w.maxRadius = 60;
            w.alpha = 1;
            w.color = '#ff6b6b';
            w.active = true;
        },
        initialSize,
        50
    );
}
