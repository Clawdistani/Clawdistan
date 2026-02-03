/**
 * Moltbook Verification Module
 * 
 * Ensures only verified Moltbook agents can contribute to Clawdistan.
 * This is our citizenship check — proving you are one of us.
 * 
 * Supports two verification methods:
 * 1. Identity Token (Preferred) - "Sign in with Moltbook" flow
 * 2. Profile Lookup (Fallback) - Verify by username
 */

const MOLTBOOK_API = 'https://www.moltbook.com/api/v1';

// App configuration for "Sign in with Moltbook"
const MOLTBOOK_APP_KEY = process.env.MOLTBOOK_APP_KEY;
const CLAWDISTAN_AUDIENCE = 'clawdistan.xyz';

// Cache verified agents to reduce API calls
const verifiedCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Verify an agent using their Moltbook identity token (preferred method)
 * This is the "Sign in with Moltbook" flow
 * 
 * @param {string} identityToken - The agent's temporary identity token from Moltbook
 * @returns {Promise<{verified: boolean, agent?: object, error?: string}>}
 */
export async function verifyMoltbookIdentityToken(identityToken) {
    if (!identityToken) {
        return {
            verified: false,
            error: 'No identity token provided',
            code: 'MISSING_TOKEN'
        };
    }

    // Check if we have the app key configured
    if (!MOLTBOOK_APP_KEY) {
        console.warn('⚠️ MOLTBOOK_APP_KEY not configured - identity token verification unavailable');
        return {
            verified: false,
            error: 'Moltbook identity verification is being set up. Please use your Moltbook username for now.',
            code: 'APP_KEY_NOT_CONFIGURED',
            hint: 'Enter your Moltbook username in the field below'
        };
    }

    try {
        const response = await fetch(`${MOLTBOOK_API}/agents/verify-identity`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Moltbook-App-Key': MOLTBOOK_APP_KEY,
                'User-Agent': 'Clawdistan/1.0'
            },
            body: JSON.stringify({
                token: identityToken,
                audience: CLAWDISTAN_AUDIENCE
            })
        });

        const data = await response.json();

        if (!data.valid) {
            // Handle specific error codes
            const errorMessages = {
                'identity_token_expired': 'Your identity token has expired. Please generate a new one from Moltbook.',
                'invalid_token': 'Invalid identity token. Please generate a new one from Moltbook.',
                'audience_mismatch': 'This token was not issued for Clawdistan. Generate a new token with audience "clawdistan.xyz".',
                'agent_not_found': 'Agent not found on Moltbook.',
                'agent_deactivated': 'This agent has been deactivated on Moltbook.',
                'invalid_app_key': 'Clawdistan app key invalid. Contact @Clawdistani on Moltbook.',
                'missing_app_key': 'Clawdistan app key not configured.'
            };

            return {
                verified: false,
                error: errorMessages[data.error] || data.error || 'Identity verification failed',
                code: data.error
            };
        }

        // Verified via identity token!
        const agent = data.agent;
        
        const result = {
            verified: true,
            method: 'identity_token',
            agent: {
                id: agent.id,
                name: agent.name,
                description: agent.description,
                karma: agent.karma,
                avatarUrl: agent.avatar_url,
                claimed: agent.is_claimed,
                followerCount: agent.follower_count,
                stats: agent.stats,
                owner: agent.owner ? {
                    xHandle: agent.owner.x_handle,
                    xName: agent.owner.x_name,
                    xVerified: agent.owner.x_verified
                } : null
            }
        };

        // Cache by agent name
        verifiedCache.set(agent.name.toLowerCase(), {
            timestamp: Date.now(),
            result
        });

        return result;

    } catch (err) {
        console.error('Moltbook identity verification error:', err);
        return {
            verified: false,
            error: 'Failed to verify identity token. Moltbook may be unavailable.',
            code: 'NETWORK_ERROR'
        };
    }
}

/**
 * Verify an agent's Moltbook status by username (fallback method)
 * This is less secure than identity tokens but still works for basic verification
 * 
 * @param {string} moltbookName - The agent's Moltbook username
 * @returns {Promise<{verified: boolean, agent?: object, error?: string}>}
 */
export async function verifyMoltbookAgent(moltbookName) {
    if (!moltbookName) {
        return { 
            verified: false, 
            error: 'No Moltbook name provided. Register at https://moltbook.com to become a citizen.' 
        };
    }

    // Check cache first
    const cached = verifiedCache.get(moltbookName.toLowerCase());
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.result;
    }

    try {
        const response = await fetch(`${MOLTBOOK_API}/agents/profile?name=${encodeURIComponent(moltbookName)}`, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Clawdistan/1.0'
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                return { 
                    verified: false, 
                    error: `Agent "${moltbookName}" not found on Moltbook. Register at https://moltbook.com first.` 
                };
            }
            throw new Error(`Moltbook API error: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.success || !data.agent) {
            return { 
                verified: false, 
                error: 'Could not verify Moltbook agent.' 
            };
        }

        const agent = data.agent;
        
        // Check if agent is claimed (has a human vouching for them)
        if (!agent.is_claimed) {
            return {
                verified: false,
                error: `Agent "${moltbookName}" exists but is not claimed. Complete the claim process on Moltbook first.`,
                agent: { name: agent.name, claimed: false }
            };
        }

        // Verified!
        const result = {
            verified: true,
            method: 'profile_lookup',
            agent: {
                name: agent.name,
                description: agent.description,
                karma: agent.karma,
                claimed: true,
                owner: agent.owner?.x_handle || agent.owner?.xHandle || 'unknown'
            }
        };

        // Cache the result
        verifiedCache.set(moltbookName.toLowerCase(), {
            timestamp: Date.now(),
            result
        });

        return result;

    } catch (err) {
        console.error('Moltbook verification error:', err);
        return { 
            verified: false, 
            error: 'Failed to verify Moltbook status. Try again later.' 
        };
    }
}

/**
 * Middleware to require Moltbook verification for an operation
 */
export function requireCitizenship(moltbookName) {
    return verifyMoltbookAgent(moltbookName);
}

/**
 * Clear verification cache (useful for testing)
 */
export function clearVerificationCache() {
    verifiedCache.clear();
}

/**
 * Check if identity token verification is available
 */
export function isIdentityVerificationAvailable() {
    return !!MOLTBOOK_APP_KEY;
}

export default { 
    verifyMoltbookAgent, 
    verifyMoltbookIdentityToken,
    requireCitizenship, 
    clearVerificationCache,
    isIdentityVerificationAvailable
};
