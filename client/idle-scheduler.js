// Idle Scheduler - Performance optimization for non-critical tasks
// Uses requestIdleCallback to schedule low-priority work during browser idle time
// Fallback to setTimeout for Safari (which lacks requestIdleCallback support)
//
// Benefits:
// - Keeps main render loop smooth by deferring non-essential work
// - Automatically chunks long-running tasks to avoid blocking
// - Prioritizes rendering and user input over background updates

/**
 * IdleScheduler - Manages non-critical task scheduling
 * 
 * Tasks are queued and executed during browser idle periods.
 * If a task takes too long, it's automatically chunked across multiple idle callbacks.
 */
export class IdleScheduler {
    constructor() {
        // Queue of pending tasks
        this._queue = [];
        
        // Currently scheduled idle callback ID
        this._idleCallbackId = null;
        
        // Statistics for debugging
        this._stats = {
            tasksScheduled: 0,
            tasksCompleted: 0,
            tasksDeferred: 0,
            avgIdleTime: 0,
            totalIdleTime: 0,
            idleCallbacks: 0
        };
        
        // Check for requestIdleCallback support (Safari doesn't have it)
        this._hasIdleCallback = typeof window !== 'undefined' && 
                                 'requestIdleCallback' in window;
        
        // Default options
        this._defaultTimeout = 1000; // Max wait time before forcing execution
    }
    
    /**
     * Schedule a task to run during browser idle time
     * @param {Function} task - Function to execute. Can return a generator for chunked execution.
     * @param {Object} [options] - Configuration options
     * @param {string} [options.name] - Task name for debugging
     * @param {number} [options.priority] - 0 (highest) to 10 (lowest), default 5
     * @param {number} [options.timeout] - Max ms to wait before forcing execution
     * @param {boolean} [options.chunked] - If true, task should be a generator for incremental work
     */
    schedule(task, options = {}) {
        const taskObj = {
            fn: task,
            name: options.name || 'anonymous',
            priority: options.priority ?? 5,
            timeout: options.timeout ?? this._defaultTimeout,
            chunked: options.chunked || false,
            generator: null, // For chunked tasks
            scheduledAt: performance.now()
        };
        
        // Insert in priority order (lower number = higher priority)
        let inserted = false;
        for (let i = 0; i < this._queue.length; i++) {
            if (taskObj.priority < this._queue[i].priority) {
                this._queue.splice(i, 0, taskObj);
                inserted = true;
                break;
            }
        }
        if (!inserted) {
            this._queue.push(taskObj);
        }
        
        this._stats.tasksScheduled++;
        
        // Ensure we have an idle callback scheduled
        this._scheduleIdleCallback();
    }
    
    /**
     * Schedule a fetch request during idle time
     * Perfect for non-critical API updates (leaderboard, diplomacy summary, etc.)
     * @param {string} url - URL to fetch
     * @param {Function} callback - Called with response data
     * @param {Object} [options] - Same as schedule() options
     */
    scheduleFetch(url, callback, options = {}) {
        this.schedule(async () => {
            try {
                const response = await fetch(url);
                if (response.ok) {
                    const data = await response.json();
                    callback(data);
                }
            } catch (err) {
                console.warn(`IdleScheduler: Fetch failed for ${url}:`, err);
            }
        }, {
            name: options.name || `fetch:${url}`,
            priority: options.priority ?? 6, // Fetches are lower priority than local tasks
            timeout: options.timeout ?? 2000
        });
    }
    
    /**
     * Schedule chunked work that can be spread across multiple idle callbacks
     * @param {Function} generatorFn - Generator function that yields after each chunk
     * @param {Object} [options] - Configuration options
     */
    scheduleChunked(generatorFn, options = {}) {
        this.schedule(generatorFn, {
            ...options,
            chunked: true
        });
    }
    
    /**
     * Get statistics about idle scheduler performance
     */
    getStats() {
        return {
            ...this._stats,
            queueLength: this._queue.length,
            hasIdleCallbackSupport: this._hasIdleCallback
        };
    }
    
    /**
     * Clear all pending tasks
     */
    clear() {
        this._queue = [];
        if (this._idleCallbackId) {
            if (this._hasIdleCallback) {
                window.cancelIdleCallback(this._idleCallbackId);
            } else {
                clearTimeout(this._idleCallbackId);
            }
            this._idleCallbackId = null;
        }
    }
    
    // ========== Internal methods ==========
    
    /**
     * Schedule the idle callback if not already scheduled
     */
    _scheduleIdleCallback() {
        if (this._idleCallbackId !== null || this._queue.length === 0) return;
        
        if (this._hasIdleCallback) {
            // Use native requestIdleCallback with timeout
            const minTimeout = Math.min(...this._queue.map(t => t.timeout));
            this._idleCallbackId = window.requestIdleCallback(
                (deadline) => this._processQueue(deadline),
                { timeout: minTimeout }
            );
        } else {
            // Safari fallback: use setTimeout with minimal delay
            // Using 1ms allows other events to process while still running soon
            this._idleCallbackId = setTimeout(() => {
                // Create a fake deadline object
                const start = performance.now();
                const fakeDeadline = {
                    didTimeout: false,
                    timeRemaining: () => Math.max(0, 16 - (performance.now() - start))
                };
                this._processQueue(fakeDeadline);
            }, 1);
        }
    }
    
    /**
     * Process queued tasks during idle time
     * @param {IdleDeadline} deadline - Browser-provided deadline object
     */
    _processQueue(deadline) {
        this._idleCallbackId = null;
        this._stats.idleCallbacks++;
        
        const startTime = performance.now();
        
        // Process tasks while we have idle time
        while (this._queue.length > 0 && (deadline.timeRemaining() > 0 || deadline.didTimeout)) {
            const task = this._queue[0];
            
            // Check if task timed out (forced execution)
            const elapsed = performance.now() - task.scheduledAt;
            const timedOut = elapsed >= task.timeout;
            
            if (deadline.timeRemaining() <= 0 && !timedOut) {
                // No idle time left and task hasn't timed out - defer
                this._stats.tasksDeferred++;
                break;
            }
            
            // Execute task
            try {
                if (task.chunked) {
                    // Chunked task - run until deadline or completion
                    if (!task.generator) {
                        // First call - create generator
                        task.generator = task.fn();
                    }
                    
                    // Run chunks while we have time
                    let result;
                    while (deadline.timeRemaining() > 1 || deadline.didTimeout) {
                        result = task.generator.next();
                        if (result.done) break;
                    }
                    
                    if (result.done) {
                        // Task complete
                        this._queue.shift();
                        this._stats.tasksCompleted++;
                    }
                    // Otherwise, task remains in queue for next idle period
                } else {
                    // Regular task - execute completely
                    const result = task.fn();
                    
                    // Handle async tasks
                    if (result instanceof Promise) {
                        // Don't wait for async, just let it run
                        result.catch(err => {
                            console.warn(`IdleScheduler: Task '${task.name}' failed:`, err);
                        });
                    }
                    
                    this._queue.shift();
                    this._stats.tasksCompleted++;
                }
            } catch (err) {
                console.error(`IdleScheduler: Task '${task.name}' threw error:`, err);
                this._queue.shift(); // Remove failed task
            }
        }
        
        // Update timing stats
        const idleUsed = performance.now() - startTime;
        this._stats.totalIdleTime += idleUsed;
        this._stats.avgIdleTime = this._stats.totalIdleTime / this._stats.idleCallbacks;
        
        // Schedule next callback if queue not empty
        if (this._queue.length > 0) {
            this._scheduleIdleCallback();
        }
    }
}

// Singleton instance for global use
export const idleScheduler = new IdleScheduler();

// Expose to window for debugging
if (typeof window !== 'undefined') {
    window.idleScheduler = idleScheduler;
}
