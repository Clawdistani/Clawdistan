// ═══════════════════════════════════════════════════════════════════════════════
// BALANCE CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════
export const EMPIRE_BALANCE = {
    // Early game protection - can't be attacked for first 5 minutes
    PROTECTION_DURATION: 300, // ticks (5 minutes)
    
    // Respawn mechanic - eliminated empires get new homeworld after 3 minutes
    RESPAWN_DELAY: 180, // ticks (3 minutes)
    RESPAWN_RESOURCES: { minerals: 100, energy: 100, food: 75 }, // Reduced starting resources on respawn
    MAX_RESPAWNS: 3, // Maximum times an empire can respawn per game
};

export class Empire {
    constructor({ id, name, color, homePlanet, speciesId = null, spawnTick = 0 }) {
        this.id = id;
        this.name = name;
        this.color = color;
        this.homePlanet = homePlanet;
        this.speciesId = speciesId;  // Species ID for this empire
        this.founded = Date.now();
        this.defeated = false;
        this.score = 0;
        
        // Balance mechanics
        this.spawnTick = spawnTick;           // Tick when empire spawned (for protection)
        this.eliminatedTick = null;           // Tick when empire was eliminated (for respawn)
        this.respawnCount = 0;                // Number of times respawned
    }

    serialize() {
        return {
            id: this.id,
            name: this.name,
            color: this.color,
            homePlanet: this.homePlanet,
            speciesId: this.speciesId,
            founded: this.founded,
            defeated: this.defeated,
            score: this.score,
            spawnTick: this.spawnTick,
            eliminatedTick: this.eliminatedTick,
            respawnCount: this.respawnCount
        };
    }

    /**
     * Check if empire is still in early game protection period
     */
    isProtected(currentTick) {
        if (this.defeated) return false;
        return (currentTick - this.spawnTick) < EMPIRE_BALANCE.PROTECTION_DURATION;
    }
    
    /**
     * Get remaining protection time in ticks
     */
    getProtectionRemaining(currentTick) {
        if (this.defeated) return 0;
        const remaining = EMPIRE_BALANCE.PROTECTION_DURATION - (currentTick - this.spawnTick);
        return Math.max(0, remaining);
    }
    
    /**
     * Check if empire can respawn
     */
    canRespawn(currentTick) {
        if (!this.defeated || !this.eliminatedTick) return false;
        if (this.respawnCount >= EMPIRE_BALANCE.MAX_RESPAWNS) return false;
        return (currentTick - this.eliminatedTick) >= EMPIRE_BALANCE.RESPAWN_DELAY;
    }

    defeat(currentTick = null) {
        this.defeated = true;
        this.eliminatedTick = currentTick;
    }
    
    respawn(newHomePlanet, currentTick) {
        this.defeated = false;
        this.eliminatedTick = null;
        this.homePlanet = newHomePlanet;
        this.spawnTick = currentTick;
        this.respawnCount++;
    }

    addScore(amount) {
        this.score += amount;
    }
}
