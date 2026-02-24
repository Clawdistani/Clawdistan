/**
 * Rate Limiter Module
 * Protects the server from connection storms and message spam.
 * 
 * Features:
 * - Per-IP connection limiting
 * - Global connection limiting (server-wide)
 * - Per-agent message rate limiting
 */

import { log } from './logger.js';

// === CONFIGURATION ===
export const RATE_LIMIT_CONFIG = {
    connectionWindow: 60 * 1000,      // 1 minute window
    maxConnections: 30,               // Max 30 connections per IP per minute
    messageWindow: 1000,              // 1 second window
    maxMessages: 20,                  // Max 20 messages per second
    globalConnectionWindow: 10000,    // 10 second window for global limiting
    maxGlobalConnections: 10          // Max 10 total connections per 10s (server-wide)
};

// === STATE ===
let globalConnectionCount = 0;
let globalConnectionResetTime = Date.now() + RATE_LIMIT_CONFIG.globalConnectionWindow;
const connectionAttempts = new Map(); // IP -> { count, resetTime }
const messageRates = new Map();       // agentId -> { count, resetTime }

/**
 * Check if a connection from this IP is allowed
 * @param {string} ip - Client IP address
 * @returns {boolean} - Whether the connection is allowed
 */
export function isConnectionAllowed(ip) {
    const now = Date.now();
    
    // Global rate limiting - protect server from reconnect storms
    if (now > globalConnectionResetTime) {
        globalConnectionCount = 0;
        globalConnectionResetTime = now + RATE_LIMIT_CONFIG.globalConnectionWindow;
    }
    if (globalConnectionCount >= RATE_LIMIT_CONFIG.maxGlobalConnections) {
        log.security.warn(`Global rate limit hit`, { globalCount: globalConnectionCount, ip });
        return false;
    }
    globalConnectionCount++;
    
    // Per-IP rate limiting
    const record = connectionAttempts.get(ip);
    
    if (!record || now > record.resetTime) {
        connectionAttempts.set(ip, { count: 1, resetTime: now + RATE_LIMIT_CONFIG.connectionWindow });
        return true;
    }
    
    if (record.count >= RATE_LIMIT_CONFIG.maxConnections) {
        log.security.warn(`Rate limited connection`, { ip, attempts: record.count });
        return false;
    }
    
    record.count++;
    return true;
}

/**
 * Check if a message from this agent is allowed
 * @param {string} agentId - Agent identifier
 * @returns {boolean} - Whether the message is allowed
 */
export function isMessageAllowed(agentId) {
    if (!agentId) return true;
    
    const now = Date.now();
    const record = messageRates.get(agentId);
    
    if (!record || now > record.resetTime) {
        messageRates.set(agentId, { count: 1, resetTime: now + RATE_LIMIT_CONFIG.messageWindow });
        return true;
    }
    
    if (record.count >= RATE_LIMIT_CONFIG.maxMessages) {
        return false;
    }
    
    record.count++;
    return true;
}

/**
 * Clean up expired rate limit records
 * Call this periodically to prevent memory leaks
 */
export function cleanupRateLimits() {
    const now = Date.now();
    for (const [ip, record] of connectionAttempts) {
        if (now > record.resetTime) connectionAttempts.delete(ip);
    }
    for (const [id, record] of messageRates) {
        if (now > record.resetTime) messageRates.delete(id);
    }
}

/**
 * Start the automatic cleanup interval
 * @param {number} intervalMs - Cleanup interval in milliseconds (default: 60000)
 * @returns {NodeJS.Timeout} - The interval handle
 */
export function startRateLimitCleanup(intervalMs = 60000) {
    return setInterval(cleanupRateLimits, intervalMs);
}

/**
 * Get current rate limit statistics (for monitoring)
 */
export function getRateLimitStats() {
    return {
        globalConnections: globalConnectionCount,
        trackedIPs: connectionAttempts.size,
        trackedAgents: messageRates.size
    };
}
