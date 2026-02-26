/**
 * Victory Checker
 * 
 * Handles empire defeat and victory condition checking.
 * Victory is now managed by GameSession (51% domination or 24h score).
 * This module handles empire elimination (0 planets = defeated).
 */

export class VictoryChecker {
    constructor() {
        // Legacy conditions kept for reference/future use
        this.conditions = {
            domination: {
                name: 'Galactic Domination',
                description: 'Control 51% of all planets',
                threshold: 0.51
            },
            time: {
                name: 'Time Victory',
                description: 'Highest score when 24h timer expires'
            }
        };
    }

    /**
     * Check empire defeat conditions
     * Returns list of newly defeated empires
     */
    checkDefeats(empires, universe, currentTick = null) {
        const newlyDefeated = [];

        empires.forEach((empire, id) => {
            if (empire.defeated) return;

            // Empire is defeated if they have no planets
            const planets = universe.getPlanetsOwnedBy(id);
            if (planets.length === 0) {
                empire.defeat(currentTick);
                newlyDefeated.push({
                    empireId: id,
                    empireName: empire.name,
                    canRespawn: empire.respawnCount < 3 // Can still respawn?
                });
                console.log(`💀 ${empire.name} has been eliminated! (Respawn ${empire.respawnCount + 1}/3 available in 3 min)`);
            }
        });

        return newlyDefeated;
    }

    /**
     * Calculate domination progress for an empire
     */
    getDominationProgress(empireId, universe) {
        const totalPlanets = universe.planets.length;
        const ownedPlanets = universe.getPlanetsOwnedBy(empireId).length;
        const threshold = Math.ceil(totalPlanets * this.conditions.domination.threshold);

        return {
            current: ownedPlanets,
            required: threshold,
            total: totalPlanets,
            percentage: Math.round((ownedPlanets / totalPlanets) * 100),
            progressToVictory: Math.round((ownedPlanets / threshold) * 100)
        };
    }

    getConditions() {
        return Object.entries(this.conditions).map(([id, condition]) => ({
            id,
            name: condition.name,
            description: condition.description
        }));
    }

    // Calculate progress towards each victory condition
    getProgress(empireId, empires, universe, resourceManager, gameSession = null) {
        const totalPlanets = universe.planets.length;
        const ownedPlanets = universe.getPlanetsOwnedBy(empireId).length;
        const threshold = Math.ceil(totalPlanets * 0.51);
        const resources = resourceManager?.getResources(empireId);

        // Get empire score
        const empire = empires.get(empireId);
        const score = empire?.score || 0;

        // Find highest score (for comparison)
        let highestScore = 0;
        for (const [id, e] of empires) {
            if (!e.defeated && e.score > highestScore) {
                highestScore = e.score;
            }
        }

        return {
            domination: {
                current: ownedPlanets,
                required: threshold,
                total: totalPlanets,
                percentage: Math.round((ownedPlanets / totalPlanets) * 100),
                progress: Math.min(100, Math.round((ownedPlanets / threshold) * 100))
            },
            time: {
                score: score,
                highestScore: highestScore,
                isLeading: score === highestScore && score > 0,
                timeRemaining: gameSession?.getTimeRemaining() || null,
                timeRemainingFormatted: gameSession?.getTimeRemainingFormatted() || null
            }
        };
    }
}
