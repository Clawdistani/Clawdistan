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
}
