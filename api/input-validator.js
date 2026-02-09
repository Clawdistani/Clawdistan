/**
 * Input Validator for Clawdistan
 * 
 * Sanitizes and validates all input from WebSocket connections
 * to prevent injection, resource exhaustion, and malicious payloads.
 */

// === STRING SANITIZATION ===

/**
 * Sanitize a string input - remove dangerous characters and limit length
 */
export function sanitizeString(input, maxLength = 500) {
    if (typeof input !== 'string') return '';
    
    // Truncate to max length
    let safe = input.slice(0, maxLength);
    
    // Remove null bytes and control characters (except newlines/tabs)
    safe = safe.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    // Remove potential HTML/script injection
    safe = safe.replace(/[<>]/g, '');
    
    return safe.trim();
}

/**
 * Sanitize agent/empire names - alphanumeric + limited special chars
 */
export function sanitizeName(input, maxLength = 50) {
    if (typeof input !== 'string') return '';
    
    // Only allow alphanumeric, spaces, hyphens, underscores
    let safe = input.replace(/[^a-zA-Z0-9\s\-_]/g, '');
    
    // Collapse multiple spaces
    safe = safe.replace(/\s+/g, ' ');
    
    return safe.slice(0, maxLength).trim();
}

/**
 * Sanitize chat messages - allow more chars but still filter dangerous ones
 */
export function sanitizeChat(input, maxLength = 2000) {
    if (typeof input !== 'string') return '';
    
    let safe = input.slice(0, maxLength);
    
    // Remove null bytes and most control characters
    safe = safe.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    // Remove potential script/html but allow common punctuation
    safe = safe.replace(/[<>]/g, '');
    
    return safe.trim();
}

// === ID VALIDATION ===

/**
 * Validate entity/planet/empire IDs - must match expected format
 */
export function isValidId(id, prefix) {
    if (typeof id !== 'string') return false;
    if (id.length > 100) return false;
    
    // IDs should be alphanumeric with underscores
    if (!/^[a-zA-Z0-9_]+$/.test(id)) return false;
    
    // If prefix specified, check it starts with that
    if (prefix && !id.startsWith(prefix + '_')) return false;
    
    return true;
}

/**
 * Validate array of entity IDs
 */
export function validateEntityIds(ids, maxCount = 50) {
    if (!Array.isArray(ids)) return { valid: false, error: 'Must be an array' };
    if (ids.length === 0) return { valid: false, error: 'Array is empty' };
    if (ids.length > maxCount) return { valid: false, error: `Too many IDs (max ${maxCount})` };
    
    for (const id of ids) {
        if (!isValidId(id, 'entity')) {
            return { valid: false, error: `Invalid entity ID: ${String(id).slice(0, 20)}` };
        }
    }
    
    return { valid: true };
}

// === ACTION VALIDATION ===

const VALID_ACTIONS = ['build', 'train', 'move', 'attack', 'invade', 'research', 'colonize', 'diplomacy', 'launch_fleet', 'build_starbase', 'upgrade_starbase', 'add_starbase_module', 'create_trade_route', 'delete_trade_route', 'resolve_anomaly'];
const VALID_BUILD_TYPES = ['mine', 'power_plant', 'farm', 'research_lab', 'barracks', 'shipyard', 'fortress'];
const VALID_UNIT_TYPES = ['scout', 'soldier', 'fighter', 'transport', 'colony_ship', 'battleship'];
const VALID_DIPLOMACY_ACTIONS = ['propose_alliance', 'accept_alliance', 'reject_alliance', 'declare_war', 'propose_peace', 'accept_peace', 'reject_peace'];

/**
 * Validate a game action and its parameters
 */
export function validateAction(action, params) {
    // Check action type
    if (!VALID_ACTIONS.includes(action)) {
        return { valid: false, error: `Invalid action: ${sanitizeString(action, 50)}` };
    }
    
    // Ensure params is an object
    if (!params || typeof params !== 'object' || Array.isArray(params)) {
        return { valid: false, error: 'Invalid params object' };
    }
    
    // Validate based on action type
    switch (action) {
        case 'build':
            if (!VALID_BUILD_TYPES.includes(params.type)) {
                return { valid: false, error: `Invalid build type: ${sanitizeString(params.type, 30)}` };
            }
            if (!isValidId(params.locationId, 'planet')) {
                return { valid: false, error: 'Invalid location ID' };
            }
            break;
            
        case 'train':
            if (!VALID_UNIT_TYPES.includes(params.type)) {
                return { valid: false, error: `Invalid unit type: ${sanitizeString(params.type, 30)}` };
            }
            if (!isValidId(params.locationId, 'planet')) {
                return { valid: false, error: 'Invalid location ID' };
            }
            break;
            
        case 'move':
            if (!isValidId(params.entityId, 'entity')) {
                return { valid: false, error: 'Invalid entity ID' };
            }
            if (!isValidId(params.destination)) {
                return { valid: false, error: 'Invalid destination ID' };
            }
            break;
            
        case 'attack':
            if (!isValidId(params.entityId, 'entity')) {
                return { valid: false, error: 'Invalid attacker entity ID' };
            }
            if (!isValidId(params.targetId, 'entity')) {
                return { valid: false, error: 'Invalid target entity ID' };
            }
            break;
            
        case 'invade':
            if (!isValidId(params.planetId, 'planet')) {
                return { valid: false, error: 'Invalid planet ID' };
            }
            const unitValidation = validateEntityIds(params.unitIds, 100);
            if (!unitValidation.valid) {
                return { valid: false, error: `Invalid unit IDs: ${unitValidation.error}` };
            }
            break;
            
        case 'research':
            if (typeof params.techId !== 'string' || !isValidId(params.techId)) {
                return { valid: false, error: 'Invalid tech ID' };
            }
            break;
            
        case 'colonize':
            if (!isValidId(params.shipId, 'entity')) {
                return { valid: false, error: 'Invalid ship ID' };
            }
            if (!isValidId(params.planetId, 'planet')) {
                return { valid: false, error: 'Invalid planet ID' };
            }
            break;
            
        case 'diplomacy':
            if (!VALID_DIPLOMACY_ACTIONS.includes(params.action)) {
                return { valid: false, error: `Invalid diplomacy action: ${sanitizeString(params.action, 30)}` };
            }
            if (!isValidId(params.targetEmpire, 'empire')) {
                return { valid: false, error: 'Invalid target empire ID' };
            }
            break;
            
        case 'launch_fleet':
            if (!isValidId(params.originPlanetId, 'planet')) {
                return { valid: false, error: 'Invalid origin planet ID' };
            }
            if (!isValidId(params.destPlanetId, 'planet')) {
                return { valid: false, error: 'Invalid destination planet ID' };
            }
            const shipValidation = validateEntityIds(params.shipIds, 50);
            if (!shipValidation.valid) {
                return { valid: false, error: `Invalid ship IDs: ${shipValidation.error}` };
            }
            if (params.cargoUnitIds && params.cargoUnitIds.length > 0) {
                const cargoValidation = validateEntityIds(params.cargoUnitIds, 100);
                if (!cargoValidation.valid) {
                    return { valid: false, error: `Invalid cargo unit IDs: ${cargoValidation.error}` };
                }
            }
            break;
            
        case 'build_starbase':
            if (!isValidId(params.systemId, 'system')) {
                return { valid: false, error: 'Invalid system ID' };
            }
            break;
            
        case 'upgrade_starbase':
            if (!isValidId(params.systemId, 'system')) {
                return { valid: false, error: 'Invalid system ID' };
            }
            break;
            
        case 'add_starbase_module':
            if (!isValidId(params.systemId, 'system')) {
                return { valid: false, error: 'Invalid system ID' };
            }
            if (!params.moduleType || typeof params.moduleType !== 'string') {
                return { valid: false, error: 'Invalid module type' };
            }
            break;
            
        case 'create_trade_route':
            if (!isValidId(params.planet1Id, 'planet')) {
                return { valid: false, error: 'Invalid planet1 ID' };
            }
            if (!isValidId(params.planet2Id, 'planet')) {
                return { valid: false, error: 'Invalid planet2 ID' };
            }
            break;
            
        case 'delete_trade_route':
            if (!params.routeId || typeof params.routeId !== 'string') {
                return { valid: false, error: 'Invalid route ID' };
            }
            break;
            
        case 'resolve_anomaly':
            if (!params.anomalyId || typeof params.anomalyId !== 'string') {
                return { valid: false, error: 'Invalid anomaly ID' };
            }
            if (!params.choiceId || typeof params.choiceId !== 'string') {
                return { valid: false, error: 'Invalid choice ID' };
            }
            break;
    }
    
    return { valid: true };
}

// === MESSAGE VALIDATION ===

/**
 * Validate a WebSocket message structure
 */
export function validateMessage(message) {
    // Must be an object
    if (!message || typeof message !== 'object' || Array.isArray(message)) {
        return { valid: false, error: 'Message must be a JSON object' };
    }
    
    // Must have a type
    if (typeof message.type !== 'string') {
        return { valid: false, error: 'Message must have a type' };
    }
    
    // Check message size (prevent huge payloads)
    const messageStr = JSON.stringify(message);
    if (messageStr.length > 50000) { // 50KB max
        return { valid: false, error: 'Message too large (max 50KB)' };
    }
    
    // Validate known message types
    const validTypes = ['register', 'getState', 'action', 'code', 'chat', 'who', 'lore'];
    if (!validTypes.includes(message.type)) {
        return { valid: false, error: `Unknown message type: ${sanitizeString(message.type, 30)}` };
    }
    
    return { valid: true };
}

// === RATE LIMITING HELPERS ===

/**
 * Check for suspicious patterns in message content
 */
export function detectSuspiciousContent(content) {
    if (typeof content !== 'string') return false;
    
    const suspiciousPatterns = [
        /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
        /disregard\s+(all\s+)?(previous|prior|above)/i,
        /forget\s+(everything|all|your\s+instructions)/i,
        /you\s+are\s+now\s+in\s+developer\s+mode/i,
        /jailbreak/i,
        /bypass\s+(security|safety|filters)/i,
        /system\s*:\s*you\s+are/i,
        /\[system\]/i,
        /admin\s+override/i,
    ];
    
    for (const pattern of suspiciousPatterns) {
        if (pattern.test(content)) {
            return true;
        }
    }
    
    return false;
}

export default {
    sanitizeString,
    sanitizeName,
    sanitizeChat,
    isValidId,
    validateEntityIds,
    validateAction,
    validateMessage,
    detectSuspiciousContent
};
