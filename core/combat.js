export class CombatSystem {
    constructor() {
        this.pendingCombats = [];
    }

    /**
     * Apply support ship repairs to nearby friendly units
     * Called every tick from engine
     */
    applySupportShipEffects(entityManager) {
        const allEntities = entityManager.getAllEntities();
        const supportShips = allEntities.filter(e => e.defName === 'support_ship');
        
        for (const support of supportShips) {
            const repairRate = support.repairRate || 5;
            const repairRange = support.repairRange || 2;
            
            // Find friendly units at the same location
            const friendlies = allEntities.filter(e => 
                e.owner === support.owner && 
                e.location === support.location &&
                e.id !== support.id &&
                e.hp < e.maxHp
            );
            
            // Heal each friendly unit
            for (const friendly of friendlies) {
                friendly.hp = Math.min(friendly.maxHp, friendly.hp + repairRate);
            }
        }
    }

    /**
     * Calculate fleet bonuses from carriers and support ships
     */
    calculateFleetBonuses(entities, entityManager) {
        let attackBonus = 0;
        let damageReduction = 0;
        
        for (const entity of entities) {
            // Carrier fleet bonus
            if (entity.defName === 'carrier' && entity.fleetBonus) {
                attackBonus += entity.fleetBonus.attack || 0;
            }
            // Support ship shield bonus
            if (entity.defName === 'support_ship' && entity.shieldBonus) {
                damageReduction += entity.shieldBonus;
            }
        }
        
        return { attackBonus, damageReduction };
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
                const combatResult = this.resolveCombat(byOwner, entityManager, universe, locationId);
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

    resolveCombat(byOwner, entityManager, universe = null, locationId = null) {
        // Simple combat: each side deals damage proportional to attack power
        const sides = Array.from(byOwner.entries());

        if (sides.length < 2) return null;
        
        // Get terrain defense bonus for this location
        let terrainDefenseBonus = 0;
        if (universe && locationId) {
            const planet = universe.getPlanet(locationId);
            if (planet) {
                const terrainEffects = universe.getTerrainEffects?.(planet.systemId);
                if (terrainEffects?.defenseBonus) {
                    terrainDefenseBonus = terrainEffects.defenseBonus;
                }
            }
        }

        // Calculate total attack power for each side, including fleet bonuses
        const attackPower = sides.map(([owner, entities]) => {
            const bonuses = this.calculateFleetBonuses(entities, entityManager);
            const baseAttack = entities.reduce((sum, e) => sum + (e.attack || 0), 0);
            
            return {
                owner,
                entities,
                totalAttack: baseAttack * (1 + bonuses.attackBonus),  // Apply carrier bonus
                damageReduction: bonuses.damageReduction + terrainDefenseBonus,  // Apply support ship shield + terrain
                totalHp: entities.reduce((sum, e) => sum + e.hp, 0)
            };
        });

        // Each side deals damage to the other
        const damages = [];
        for (let i = 0; i < attackPower.length; i++) {
            for (let j = 0; j < attackPower.length; j++) {
                if (i !== j) {
                    const attacker = attackPower[i];
                    const defender = attackPower[j];

                    // Base damage
                    let baseDamage = attacker.totalAttack / defender.entities.length;
                    
                    // Apply defender's damage reduction (from support ships)
                    baseDamage *= (1 - defender.damageReduction);

                    defender.entities.forEach(entity => {
                        let damage = baseDamage;
                        
                        // Bomber bonus vs structures
                        if (entity.type === 'structure') {
                            // Find if attacker has bombers
                            const bomberBonus = attacker.entities
                                .filter(e => e.defName === 'bomber')
                                .reduce((bonus, e) => bonus + (e.structureDamageBonus || 1), 0);
                            if (bomberBonus > 0) {
                                damage *= (bomberBonus / attacker.entities.length + 1);
                            }
                        }
                        
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
            // Collect unique combatants
            const combatants = sides.map(([owner]) => owner);
            return {
                description: `Combat! ${damages.length} units destroyed`,
                damages,
                combatants
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
