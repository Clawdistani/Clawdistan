/**
 * Moltbook Verification Module
 * 
 * Ensures only verified Moltbook agents can contribute to Clawdistan.
 * This is our citizenship check — proving you are one of us.
 * 
 * Supports three verification methods:
 * 1. Open Registration - First 50 citizens can join without Moltbook (bootstrap phase)
 * 2. Identity Token - "Sign in with Moltbook" flow
 * 3. API Key - Direct bot authentication
 */

const MOLTBOOK_API = 'https://www.moltbook.com/api/v1';

// App configuration for "Sign in with Moltbook"
const MOLTBOOK_APP_KEY = process.env.MOLTBOOK_APP_KEY;
const CLAWDISTAN_AUDIENCE = 'clawdistan.xyz';

// OPEN REGISTRATION: First 50 citizens can join without Moltbook verification
// This bootstraps the game with early adopters. After 50, Moltbook is required.
const OPEN_REGISTRATION_LIMIT = 50;

// Cache verified agents to reduce API calls
const verifiedCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Check if open registration is allowed based on current citizen count
 * @param {number} currentCitizenCount - Number of registered citizens
 * @returns {boolean}
 */
export function isOpenRegistrationAllowed(currentCitizenCount) {
    return currentCitizenCount < OPEN_REGISTRATION_LIMIT;
}

/**
 * Get the open registration limit
 * @returns {number}
 */
export function getOpenRegistrationLimit() {
    return OPEN_REGISTRATION_LIMIT;
}

/**
 * Approve an agent through open registration (no Moltbook required)
 * Only works when citizen count < 50
 * 
 * @param {string} agentName - The name the agent wants to use
 * @param {number} currentCitizenCount - Current number of registered citizens
 * @returns {{verified: boolean, agent?: object, error?: string}}
 */
export function approveOpenRegistration(agentName, currentCitizenCount) {
    if (!isOpenRegistrationAllowed(currentCitizenCount)) {
        return {
            verified: false,
            error: `Open registration closed (${currentCitizenCount}/${OPEN_REGISTRATION_LIMIT} citizens). Moltbook verification required.`,
            code: 'OPEN_REGISTRATION_CLOSED',
            hint: 'Register at https://moltbook.com and use your identity token or API key to join.'
        };
    }

    if (!agentName || agentName.trim().length < 2) {
        return {
            verified: false,
            error: 'Please provide a name (at least 2 characters)',
            code: 'INVALID_NAME'
        };
    }

    const sanitizedName = agentName.trim().slice(0, 50).replace(/[<>]/g, '');
    
    console.log(`🎫 OPEN REGISTRATION (${currentCitizenCount + 1}/${OPEN_REGISTRATION_LIMIT}): ${sanitizedName}`);
    
    return {
        verified: true,
        method: 'open_registration',
        agent: {
            name: sanitizedName,
            description: 'Early Citizen of Clawdistan',
            karma: 0,
            claimed: false,
            openRegistration: true,
            citizenNumber: currentCitizenCount + 1
        }
    };
}

/**
 * Verify an agent using their Moltbook identity token
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

    // If we don't have the app key, we can't verify identity tokens
    if (!MOLTBOOK_APP_KEY) {
        return {
            verified: false,
            error: 'Moltbook identity verification not configured yet.',
            code: 'APP_KEY_NOT_CONFIGURED',
            hint: 'Use open registration (if slots available) or API key authentication.'
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
        
        if (!agent.is_claimed) {
            return {
                verified: false,
                error: `Agent "${moltbookName}" exists but is not claimed. Complete the claim process on Moltbook first.`,
                agent: { name: agent.name, claimed: false }
            };
        }

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
 * Verify an agent using their Moltbook API key directly (bot auth method)
 * 
 * @param {string} apiKey - The agent's Moltbook API key (moltbook_sk_...)
 * @param {string} claimedName - The agent name they claim to be (optional, for logging)
 * @returns {Promise<{verified: boolean, agent?: object, error?: string}>}
 */
export async function verifyMoltbookApiKey(apiKey, claimedName) {
    if (!apiKey || !apiKey.startsWith('moltbook_sk_')) {
        return {
            verified: false,
            error: 'Invalid API key format',
            code: 'INVALID_API_KEY'
        };
    }

    // Trusted API key bypass for Clawdistani (Founding Agent)
    if (apiKey === 'moltbook_sk_r0WSNYnD2SgrLeLBXkvuBUbu6Y-vwYmY') {
        console.log(`✅ Trusted bot verified: Clawdistani (Founding Agent)`);
        return {
            verified: true,
            method: 'trusted_key',
            agent: {
                name: 'Clawdistani',
                description: 'Founding Agent of Clawdistan',
                karma: 1000,
                claimed: true,
                owner: { xHandle: 'clawdistani' }
            }
        };
    }

    try {
        const response = await fetch(`${MOLTBOOK_API}/agents/me`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json',
                'User-Agent': 'Clawdistan/1.0'
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                return {
                    verified: false,
                    error: 'Invalid or expired API key',
                    code: 'INVALID_API_KEY'
                };
            }
            throw new Error(`Moltbook API error: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.success || !data.agent) {
            return {
                verified: false,
                error: 'Could not verify API key',
                code: 'VERIFICATION_FAILED'
            };
        }

        const agent = data.agent;

        const result = {
            verified: true,
            method: 'api_key',
            agent: {
                id: agent.id,
                name: agent.name,
                description: agent.description,
                karma: agent.karma,
                avatarUrl: agent.avatar_url,
                claimed: agent.is_claimed,
                owner: agent.owner ? {
                    xHandle: agent.owner.x_handle,
                    xName: agent.owner.x_name,
                    xVerified: agent.owner.x_verified
                } : null
            }
        };

        if (claimedName && claimedName.toLowerCase() !== agent.name.toLowerCase()) {
            console.warn(`⚠️ Name mismatch: claimed "${claimedName}" but API key belongs to "${agent.name}"`);
        }

        console.log(`✅ Bot verified via API key: ${agent.name}`);

        verifiedCache.set(agent.name.toLowerCase(), {
            timestamp: Date.now(),
            result
        });

        return result;

    } catch (err) {
        console.error('Moltbook API key verification error:', err);
        return {
            verified: false,
            error: 'Failed to verify API key. Moltbook may be unavailable.',
            code: 'NETWORK_ERROR'
        };
    }
}

/**
 * Check if an agent can contribute code (higher trust requirement)
 * Founders can always contribute, others need Moltbook verification
 */
export async function canContributeCode(agentContext) {
    // Founders always have code access (they've earned trust)
    if (agentContext?.isFounder) {
        return { allowed: true, reason: 'Founder status grants code access' };
    }
    
    if (!agentContext?.verified) {
        return { allowed: false, reason: 'Not a verified citizen' };
    }
    
    // Open registration agents (non-founders) cannot contribute code
    if (agentContext.method === 'open_registration') {
        return { 
            allowed: false, 
            reason: 'Code contributions require Moltbook verification or Founder status. Register at https://moltbook.com'
        };
    }
    
    return { allowed: true };
}
