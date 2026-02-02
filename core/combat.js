export class CombatSystem {
    constructor() {
        this.pendingCombats = [];
    }

    resolveAllCombat(entityManager, universe) {
        const results = [];
        const locations = new Map(); // location -> entities

        // Group entities by location
        entityManager.getAllEntities().forEach(entity => {
            if (!entity.location) return;
            if (!locations.has(entity.location)) {
                locations.set(entity.location, []);
            }
            locations.get(entity.location).push(entity);
        });

        // Check each location for combat
        locations.forEach((entities, locationId) => {
            // Group by owner
            const byOwner = new Map();
            entities.forEach(e => {
                if (!byOwner.has(e.owner)) {
                    byOwner.set(e.owner, []);
                }
                byOwner.get(e.owner).push(e);
            });

            // If multiple owners at same location, combat!
            if (byOwner.size > 1) {
                const combatResult = this.resolveCombat(byOwner, entityManager);
                if (combatResult) {
                    results.push({
                        location: locationId,
                        ...combatResult
                    });
                }
            }
        });

        // Also resolve targeted attacks
        entityManager.getAllEntities().forEach(entity => {
            if (entity.target) {
                const target = entityManager.getEntity(entity.target);
                if (target && this.canAttack(entity, target, universe)) {
                    const result = this.attack(entity, target, entityManager);
                    if (result) {
                        results.push(result);
                    }
                }
            }
        });

        return results;
    }

    resolveCombat(byOwner, entityManager) {
        // Simple combat: each side deals damage proportional to attack power
        const sides = Array.from(byOwner.entries());

        if (sides.length < 2) return null;

        // Calculate total attack power for each side
        const attackPower = sides.map(([owner, entities]) => ({
            owner,
            entities,
            totalAttack: entities.reduce((sum, e) => sum + (e.attack || 0), 0),
            totalHp: entities.reduce((sum, e) => sum + e.hp, 0)
        }));

        // Each side deals damage to the other
        const damages = [];
        for (let i = 0; i < attackPower.length; i++) {
            for (let j = 0; j < attackPower.length; j++) {
                if (i !== j) {
                    const attacker = attackPower[i];
                    const defender = attackPower[j];

                    // Damage based on attack power vs number of defenders
                    const damage = attacker.totalAttack / defender.entities.length;

                    defender.entities.forEach(entity => {
                        const destroyed = entityManager.damageEntity(entity.id, damage);
                        if (destroyed) {
                            damages.push({
                                attacker: attacker.owner,
                                destroyed: entity.name
                            });
                        }
                    });
                }
            }
        }

        if (damages.length > 0) {
            return {
                description: `Combat! ${damages.length} units destroyed`,
                damages
            };
        }

        return null;
    }

    canAttack(attacker, target, universe) {
        if (!attacker.attack || attacker.attack <= 0) return false;

        // Check range
        const distance = universe.getDistance(attacker.location, target.location);
        return distance <= attacker.range * 10; // range units to distance
    }

    attack(attacker, target, entityManager) {
        if (!attacker.attack) return null;

        // Calculate damage with some randomness
        const baseDamage = attacker.attack;
        const variance = 0.2; // 20% variance
        const damage = baseDamage * (1 + (Math.random() - 0.5) * variance);

        const destroyed = entityManager.damageEntity(target.id, damage);

        // Clear target if destroyed
        if (destroyed) {
            attacker.target = null;
        }

        return {
            description: destroyed
                ? `${attacker.name} destroyed ${target.name}`
                : `${attacker.name} attacked ${target.name} for ${Math.floor(damage)} damage`,
            attacker: attacker.id,
            target: target.id,
            damage: Math.floor(damage),
            destroyed
        };
    }

    /**
     * Resolve a planetary invasion
     * @param {Array} attackers - Attacking units
     * @param {Array} defenders - Defending entities (units + structures)
     * @param {Object} planet - The planet being invaded
     * @param {EntityManager} entityManager - Entity manager for damage/removal
     * @returns {Object} Battle result
     */
    resolvePlanetaryInvasion(attackers, defenders, planet, entityManager) {
        const battleLog = [];
        let attackerLosses = 0;
        let defenderLosses = 0;

        // Calculate total combat power
        const attackPower = attackers.reduce((sum, e) => sum + (e.attack || 0), 0);
        const attackHp = attackers.reduce((sum, e) => sum + e.hp, 0);

        // Defenders include structures with attack capability (like fortress)
        const defendPower = defenders.reduce((sum, e) => sum + (e.attack || 0), 0);
        const defendHp = defenders.reduce((sum, e) => sum + e.hp, 0);

        battleLog.push(`⚔️ Invasion begins! ${attackers.length} attackers vs ${defenders.length} defenders`);
        battleLog.push(`Attack power: ${attackPower} | Defense power: ${defendPower}`);

        // If no defenders, automatic capture
        if (defenders.length === 0 || defendHp <= 0) {
            battleLog.push(`🏴 Planet was undefended - captured without a fight!`);
            return {
                conquered: true,
                attackerLosses: 0,
                defenderLosses: 0,
                battleLog
            };
        }

        // Simulate combat rounds (up to 10 rounds)
        let remainingAttackers = [...attackers];
        let remainingDefenders = [...defenders];

        for (let round = 1; round <= 10 && remainingAttackers.length > 0 && remainingDefenders.length > 0; round++) {
            battleLog.push(`--- Round ${round} ---`);

            // Calculate current power
            const currentAttackPower = remainingAttackers.reduce((sum, e) => sum + (e.attack || 0), 0);
            const currentDefendPower = remainingDefenders.reduce((sum, e) => sum + (e.attack || 0), 0);

            // Attackers deal damage to defenders
            if (currentAttackPower > 0) {
                const damagePerDefender = currentAttackPower / remainingDefenders.length;
                const variance = 0.3;

                for (const defender of [...remainingDefenders]) {
                    const damage = damagePerDefender * (0.8 + Math.random() * variance);
                    const destroyed = entityManager.damageEntity(defender.id, damage);
                    
                    if (destroyed) {
                        remainingDefenders = remainingDefenders.filter(d => d.id !== defender.id);
                        defenderLosses++;
                        battleLog.push(`💥 ${defender.name} destroyed!`);
                    }
                }
            }

            // Defenders deal damage to attackers
            if (currentDefendPower > 0 && remainingAttackers.length > 0) {
                const damagePerAttacker = currentDefendPower / remainingAttackers.length;
                const variance = 0.3;

                for (const attacker of [...remainingAttackers]) {
                    const damage = damagePerAttacker * (0.8 + Math.random() * variance);
                    const destroyed = entityManager.damageEntity(attacker.id, damage);
                    
                    if (destroyed) {
                        remainingAttackers = remainingAttackers.filter(a => a.id !== attacker.id);
                        attackerLosses++;
                        battleLog.push(`💥 ${attacker.name} lost!`);
                    }
                }
            }

            battleLog.push(`Remaining: ${remainingAttackers.length} attackers, ${remainingDefenders.length} defenders`);
        }

        // Determine outcome
        const conquered = remainingDefenders.length === 0 && remainingAttackers.length > 0;

        if (conquered) {
            battleLog.push(`🏆 VICTORY! Planet conquered with ${remainingAttackers.length} surviving units!`);
        } else if (remainingAttackers.length === 0) {
            battleLog.push(`🛡️ DEFENDED! All attackers destroyed!`);
        } else {
            battleLog.push(`⚖️ STALEMATE - Invasion halted. Defenders hold.`);
        }

        return {
            conquered,
            attackerLosses,
            defenderLosses,
            battleLog
        };
    }

    /**
     * Attack a planet directly with units (convenience method)
     * Can be called from engine to initiate planetary combat
     */
    attackPlanet(attackerId, planetId, entityManager, universe) {
        const attacker = entityManager.getEntity(attackerId);
        if (!attacker || !attacker.attack) return null;

        const planet = universe.getPlanet(planetId);
        if (!planet) return null;

        // Get all defenders on the planet
        const defenders = entityManager.getEntitiesAtLocation(planetId)
            .filter(e => e.owner === planet.owner);

        // If no defenders, can't attack planet directly - need to invade
        if (defenders.length === 0) {
            return { needsInvasion: true };
        }

        // Target the first defender
        const target = defenders[0];
        return this.attack(attacker, target, entityManager);
    }
}
