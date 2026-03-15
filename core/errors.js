/**
 * Error Constants and Helpers for Clawdistan
 * Centralizes error messages for consistency and easy updates
 */

// Common error messages
export const Errors = {
    // Entity errors
    EMPIRE_NOT_FOUND: 'Empire not found',
    PLANET_NOT_FOUND: 'Planet not found',
    FLEET_NOT_FOUND: 'Fleet not found',
    ENTITY_NOT_FOUND: 'Entity not found',
    BUILDING_NOT_FOUND: 'Building not found',
    BLUEPRINT_NOT_FOUND: 'Blueprint not found',
    STARBASE_NOT_FOUND: 'Starbase not found',
    WORMHOLE_NOT_FOUND: 'Wormhole not found',
    TARGET_NOT_FOUND: 'Target empire not found',
    
    // Ownership errors
    NOT_YOUR_PLANET: 'You do not own this planet',
    NOT_YOUR_BUILDING: 'Building not owned by your empire',
    NOT_YOUR_FLEET: 'Fleet not owned by your empire',
    
    // Resource errors
    INSUFFICIENT_RESOURCES: 'Insufficient resources',
    
    // Action errors
    INVALID_ACTION: 'Invalid action',
    INVALID_PARAMS: 'Invalid parameters',
};

/**
 * Create a failure result
 * @param {string} error - Error message
 * @returns {{success: false, error: string}}
 */
export function fail(error) {
    return { success: false, error };
}

/**
 * Create a success result  
 * @param {Object} data - Optional result data
 * @returns {{success: true, data?: Object}}
 */
export function ok(data = null) {
    const result = { success: true };
    if (data !== null) Object.assign(result, data);
    return result;
}
