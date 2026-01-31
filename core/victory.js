export class VictoryChecker {
    constructor() {
        this.conditions = {
            domination: {
                name: 'Galactic Domination',
                description: 'Control 75% of all planets',
                check: (empires, universe) => {
                    const totalPlanets = universe.planets.length;
                    const threshold = Math.floor(totalPlanets * 0.75);

                    for (const [id, empire] of empires) {
                        if (empire.defeated) continue;
                        const owned = universe.getPlanetsOwnedBy(id).length;
                        if (owned >= threshold) {
                            return { winner: empire, type: 'domination' };
                        }
                    }
                    return null;
                }
            },
            elimination: {
                name: 'Last Empire Standing',
                description: 'All other empires are defeated',
                check: (empires, universe) => {
                    const activeEmpires = Array.from(empires.values()).filter(e => !e.defeated);
                    if (activeEmpires.length === 1) {
                        return { winner: activeEmpires[0], type: 'elimination' };
                    }
                    return null;
                }
            },
            technological: {
                name: 'Technological Ascension',
                description: 'Research the Ascension technology',
                // This is checked via tech tree effects
                check: () => null
            },
            economic: {
                name: 'Economic Victory',
                description: 'Accumulate 100,000 credits',
                check: (empires, universe, resourceManager) => {
                    for (const [id, empire] of empires) {
                        if (empire.defeated) continue;
                        const resources = resourceManager?.getResources(id);
                        if (resources && resources.credits >= 100000) {
                            return { winner: empire, type: 'economic' };
                        }
                    }
                    return null;
                }
            }
        };
    }

    check(empires, universe, resourceManager) {
        // Check empire defeat conditions first
        empires.forEach((empire, id) => {
            if (empire.defeated) return;

            // Empire is defeated if they have no planets
            const planets = universe.getPlanetsOwnedBy(id);
            if (planets.length === 0) {
                empire.defeat();
                console.log(`${empire.name} has been eliminated!`);
            }
        });

        // Check victory conditions
        for (const condition of Object.values(this.conditions)) {
            const result = condition.check(empires, universe, resourceManager);
            if (result) {
                return result;
            }
        }

        return null;
    }

    getConditions() {
        return Object.entries(this.conditions).map(([id, condition]) => ({
            id,
            name: condition.name,
            description: condition.description
        }));
    }

    // Calculate progress towards each victory condition
    getProgress(empireId, empires, universe, resourceManager) {
        const totalPlanets = universe.planets.length;
        const ownedPlanets = universe.getPlanetsOwnedBy(empireId).length;
        const activeEmpires = Array.from(empires.values()).filter(e => !e.defeated).length;
        const resources = resourceManager?.getResources(empireId);

        return {
            domination: {
                current: ownedPlanets,
                required: Math.floor(totalPlanets * 0.75),
                percentage: (ownedPlanets / (totalPlanets * 0.75)) * 100
            },
            elimination: {
                current: activeEmpires - 1, // Empires to defeat
                required: 0,
                percentage: activeEmpires === 1 ? 100 : ((empires.size - activeEmpires) / (empires.size - 1)) * 100
            },
            economic: {
                current: resources?.credits || 0,
                required: 100000,
                percentage: ((resources?.credits || 0) / 100000) * 100
            }
        };
    }
}
