// ═══════════════════════════════════════════════════════════════════════════════
// STRUCTURED LOGGING SYSTEM
// Consistent, leveled logging for Clawdistan
// ═══════════════════════════════════════════════════════════════════════════════

import { writeFileSync, appendFileSync, existsSync, mkdirSync, statSync, renameSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ═══════════════════════════════════════════════════════════════════════════════
// LOG LEVELS
// ═══════════════════════════════════════════════════════════════════════════════
export const LogLevel = {
    ERROR: 0,   // Critical errors that need attention
    WARN: 1,    // Warnings about potential issues
    INFO: 2,    // General information about game state
    DEBUG: 3,   // Detailed debugging information
    TRACE: 4    // Very detailed trace (usually off in production)
};

const LEVEL_NAMES = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'];
const LEVEL_COLORS = {
    ERROR: '\x1b[31m',  // Red
    WARN: '\x1b[33m',   // Yellow
    INFO: '\x1b[36m',   // Cyan
    DEBUG: '\x1b[90m',  // Gray
    TRACE: '\x1b[90m',  // Gray
};
const RESET = '\x1b[0m';

// ═══════════════════════════════════════════════════════════════════════════════
// LOGGER CLASS
// ═══════════════════════════════════════════════════════════════════════════════
class Logger {
    constructor(options = {}) {
        this.level = options.level ?? LogLevel.INFO;
        this.enableConsole = options.console ?? true;
        this.enableFile = options.file ?? false;
        this.logDir = options.logDir ?? join(__dirname, '..', 'logs');
        this.maxFileSize = options.maxFileSize ?? 10 * 1024 * 1024; // 10MB
        this.maxFiles = options.maxFiles ?? 5;
        this.colorize = options.colorize ?? true;
        
        // Metrics tracking
        this.metrics = {
            errorCount: 0,
            warnCount: 0,
            startTime: Date.now(),
            lastError: null,
            lastWarn: null
        };
        
        // Initialize log directory if file logging enabled
        if (this.enableFile && !existsSync(this.logDir)) {
            mkdirSync(this.logDir, { recursive: true });
        }
    }

    // Set minimum log level
    setLevel(level) {
        if (typeof level === 'string') {
            this.level = LogLevel[level.toUpperCase()] ?? LogLevel.INFO;
        } else {
            this.level = level;
        }
    }

    // Enable/disable file logging
    setFileLogging(enabled, dir = null) {
        this.enableFile = enabled;
        if (dir) this.logDir = dir;
        if (enabled && !existsSync(this.logDir)) {
            mkdirSync(this.logDir, { recursive: true });
        }
    }

    // Format timestamp
    _timestamp() {
        const now = new Date();
        return now.toISOString();
    }

    // Format log entry
    _format(level, component, message, data) {
        const timestamp = this._timestamp();
        const levelName = LEVEL_NAMES[level];
        
        // Structured format
        const entry = {
            time: timestamp,
            level: levelName,
            component,
            msg: message
        };
        
        // Add data if present
        if (data !== undefined) {
            if (data instanceof Error) {
                entry.error = {
                    name: data.name,
                    message: data.message,
                    stack: data.stack
                };
            } else if (typeof data === 'object' && data !== null) {
                entry.data = data;
            } else {
                entry.data = data;
            }
        }
        
        return entry;
    }

    // Format for console (human readable)
    _consoleFormat(entry) {
        const { time, level, component, msg, data, error } = entry;
        const color = this.colorize ? LEVEL_COLORS[level] : '';
        const reset = this.colorize ? RESET : '';
        
        // Compact timestamp (just time portion)
        const timeStr = time.slice(11, 23);
        
        // Build message
        let output = `${color}[${timeStr}] [${level.padEnd(5)}] [${component}]${reset} ${msg}`;
        
        // Add data/error details
        if (error) {
            output += `\n  Error: ${error.message}`;
            if (this.level >= LogLevel.DEBUG && error.stack) {
                output += `\n  ${error.stack.split('\n').slice(1, 4).join('\n  ')}`;
            }
        } else if (data !== undefined && this.level >= LogLevel.DEBUG) {
            const dataStr = typeof data === 'object' ? JSON.stringify(data) : String(data);
            if (dataStr.length < 200) {
                output += ` ${color}${dataStr}${reset}`;
            }
        }
        
        return output;
    }

    // Rotate logs if needed
    _rotateIfNeeded() {
        if (!this.enableFile) return;
        
        const logPath = join(this.logDir, 'server.log');
        if (!existsSync(logPath)) return;
        
        try {
            const stats = statSync(logPath);
            if (stats.size > this.maxFileSize) {
                // Rotate existing logs
                for (let i = this.maxFiles - 1; i >= 1; i--) {
                    const oldPath = join(this.logDir, `server.${i}.log`);
                    const newPath = join(this.logDir, `server.${i + 1}.log`);
                    if (existsSync(oldPath)) {
                        if (i === this.maxFiles - 1) {
                            // Delete oldest
                        } else {
                            renameSync(oldPath, newPath);
                        }
                    }
                }
                
                // Move current to .1
                renameSync(logPath, join(this.logDir, 'server.1.log'));
            }
        } catch (err) {
            // Ignore rotation errors
        }
    }

    // Write to file
    _writeFile(entry) {
        if (!this.enableFile) return;
        
        try {
            this._rotateIfNeeded();
            const logPath = join(this.logDir, 'server.log');
            appendFileSync(logPath, JSON.stringify(entry) + '\n');
        } catch (err) {
            // Fallback to console if file write fails
            console.error('Failed to write log file:', err.message);
        }
    }

    // Core log method
    _log(level, component, message, data) {
        if (level > this.level) return;
        
        const entry = this._format(level, component, message, data);
        
        // Track metrics
        if (level === LogLevel.ERROR) {
            this.metrics.errorCount++;
            this.metrics.lastError = { time: entry.time, msg: message };
        } else if (level === LogLevel.WARN) {
            this.metrics.warnCount++;
            this.metrics.lastWarn = { time: entry.time, msg: message };
        }
        
        // Output
        if (this.enableConsole) {
            const formatted = this._consoleFormat(entry);
            if (level === LogLevel.ERROR) {
                console.error(formatted);
            } else if (level === LogLevel.WARN) {
                console.warn(formatted);
            } else {
                console.log(formatted);
            }
        }
        
        if (this.enableFile) {
            this._writeFile(entry);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PUBLIC API - Scoped loggers for each component
    // ═══════════════════════════════════════════════════════════════════════════
    
    // Create a scoped logger for a specific component
    scope(component) {
        return {
            error: (msg, data) => this._log(LogLevel.ERROR, component, msg, data),
            warn: (msg, data) => this._log(LogLevel.WARN, component, msg, data),
            info: (msg, data) => this._log(LogLevel.INFO, component, msg, data),
            debug: (msg, data) => this._log(LogLevel.DEBUG, component, msg, data),
            trace: (msg, data) => this._log(LogLevel.TRACE, component, msg, data),
        };
    }

    // Convenience methods for general logging
    error(component, msg, data) { this._log(LogLevel.ERROR, component, msg, data); }
    warn(component, msg, data) { this._log(LogLevel.WARN, component, msg, data); }
    info(component, msg, data) { this._log(LogLevel.INFO, component, msg, data); }
    debug(component, msg, data) { this._log(LogLevel.DEBUG, component, msg, data); }
    trace(component, msg, data) { this._log(LogLevel.TRACE, component, msg, data); }

    // Get metrics
    getMetrics() {
        return {
            ...this.metrics,
            uptime: Date.now() - this.metrics.startTime,
            uptimeFormatted: this._formatUptime(Date.now() - this.metrics.startTime)
        };
    }

    _formatUptime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days}d ${hours % 24}h`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }

    // Clear metrics (for testing)
    resetMetrics() {
        this.metrics = {
            errorCount: 0,
            warnCount: 0,
            startTime: Date.now(),
            lastError: null,
            lastWarn: null
        };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════════

// Create default logger instance
const logger = new Logger({
    level: process.env.LOG_LEVEL ? LogLevel[process.env.LOG_LEVEL.toUpperCase()] : LogLevel.INFO,
    console: true,
    file: process.env.LOG_FILE === 'true',
    colorize: process.env.NO_COLOR !== 'true'
});

// Pre-created scoped loggers for common components
export const log = {
    server: logger.scope('Server'),
    ws: logger.scope('WebSocket'),
    game: logger.scope('Game'),
    combat: logger.scope('Combat'),
    agent: logger.scope('Agent'),
    api: logger.scope('API'),
    db: logger.scope('Database'),
    security: logger.scope('Security'),
    admin: logger.scope('Admin'),
    
    // Access the underlying logger for configuration
    _logger: logger,
    
    // Configure logger
    setLevel: (level) => logger.setLevel(level),
    setFileLogging: (enabled, dir) => logger.setFileLogging(enabled, dir),
    getMetrics: () => logger.getMetrics(),
    
    // Create custom scoped logger
    scope: (component) => logger.scope(component)
};

export default log;
