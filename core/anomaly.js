/**
 * Anomaly Exploration System
 * 
 * When fleets explore new areas, they can discover anomalies:
 * random events with choices that lead to rewards or dangers.
 */

let anomalyIdCounter = 0;

export class AnomalyManager {
    constructor() {
        // Tracks which systems have been explored by each empire
        this.exploredSystems = new Map(); // empireId -> Set of systemIds
        
        // Active anomalies waiting for player choices
        this.activeAnomalies = new Map(); // anomalyId -> anomaly data
        
        // Discovery chance: 35% when entering unexplored system
        this.discoveryChance = 0.35;
    }

    /**
     * Anomaly type definitions with choices and outcomes
     */
    static ANOMALY_TYPES = {
        // === DISCOVERIES ===
        ancient_ruins: {
            name: 'Ancient Ruins',
            icon: '🏛️',
            description: 'Your fleet has discovered the ruins of an ancient civilization on a nearby asteroid. Strange symbols cover the walls.',
            choices: [
                {
                    id: 'investigate',
                    text: 'Investigate thoroughly',
                    outcomes: [
                        { weight: 50, type: 'reward', rewards: { research: 100 }, message: 'Your scientists decode ancient texts, gaining valuable knowledge!' },
                        { weight: 30, type: 'reward', rewards: { research: 200, minerals: 50 }, message: 'A hidden chamber reveals advanced technology blueprints!' },
                        { weight: 20, type: 'danger', damage: 0.3, message: 'An ancient defense system activates! Some ships are damaged.' }
                    ]
                },
                {
                    id: 'salvage',
                    text: 'Salvage materials only',
                    outcomes: [
                        { weight: 70, type: 'reward', rewards: { minerals: 80 }, message: 'Your crews extract valuable materials from the ruins.' },
                        { weight: 30, type: 'reward', rewards: { minerals: 150 }, message: 'A cache of rare minerals is discovered!' }
                    ]
                },
                {
                    id: 'leave',
                    text: 'Mark location and leave',
                    outcomes: [
                        { weight: 100, type: 'neutral', message: 'Your fleet marks the location for future exploration.' }
                    ]
                }
            ]
        },

        derelict_ship: {
            name: 'Derelict Ship',
            icon: '🛸',
            description: 'A massive derelict vessel drifts silently in the void. Its origin is unknown, but power signatures flicker within.',
            choices: [
                {
                    id: 'board',
                    text: 'Board the vessel',
                    outcomes: [
                        { weight: 40, type: 'reward', rewards: { energy: 100, minerals: 50 }, message: 'The ship yields valuable salvage and intact power cells!' },
                        { weight: 25, type: 'reward', rewards: { research: 150 }, message: 'Your scientists recover alien research data!' },
                        { weight: 20, type: 'reward', grantUnit: 'fighter', message: 'The ship is repairable! You gain a new fighter!' },
                        { weight: 15, type: 'danger', damage: 0.4, message: 'Hostile automated defenses attack your boarding party!' }
                    ]
                },
                {
                    id: 'scan',
                    text: 'Scan from a distance',
                    outcomes: [
                        { weight: 60, type: 'reward', rewards: { research: 50 }, message: 'Long-range scans reveal some technical insights.' },
                        { weight: 40, type: 'neutral', message: 'The scans are inconclusive. The ship remains a mystery.' }
                    ]
                },
                {
                    id: 'destroy',
                    text: 'Destroy it (safety first)',
                    outcomes: [
                        { weight: 70, type: 'reward', rewards: { minerals: 30 }, message: 'The wreckage yields some salvageable materials.' },
                        { weight: 30, type: 'neutral', message: 'The ship is destroyed. Better safe than sorry.' }
                    ]
                }
            ]
        },

        resource_asteroid: {
            name: 'Rich Asteroid Field',
            icon: '☄️',
            description: 'Your sensors detect an unusually mineral-rich asteroid field. Initial scans show deposits of rare elements.',
            choices: [
                {
                    id: 'mine_aggressive',
                    text: 'Aggressive mining operation',
                    outcomes: [
                        { weight: 45, type: 'reward', rewards: { minerals: 200 }, message: 'An efficient mining operation extracts massive quantities!' },
                        { weight: 35, type: 'reward', rewards: { minerals: 120, energy: 30 }, message: 'Good yields and some crystalline energy sources found!' },
                        { weight: 20, type: 'danger', damage: 0.2, message: 'Unstable asteroids collide with your ships during mining!' }
                    ]
                },
                {
                    id: 'mine_careful',
                    text: 'Careful extraction',
                    outcomes: [
                        { weight: 80, type: 'reward', rewards: { minerals: 80 }, message: 'Careful mining yields steady resources.' },
                        { weight: 20, type: 'reward', rewards: { minerals: 100, research: 20 }, message: 'Unusual mineral formations provide scientific insights!' }
                    ]
                },
                {
                    id: 'survey',
                    text: 'Survey and catalog for later',
                    outcomes: [
                        { weight: 100, type: 'reward', rewards: { research: 30 }, message: 'The asteroid field is cataloged for future mining operations.' }
                    ]
                }
            ]
        },

        // === ENCOUNTERS ===
        refugee_fleet: {
            name: 'Refugee Fleet',
            icon: '👥',
            description: 'A small fleet of civilian vessels appears, fleeing from some distant conflict. They request asylum.',
            choices: [
                {
                    id: 'welcome',
                    text: 'Welcome them to your empire',
                    outcomes: [
                        { weight: 60, type: 'reward', rewards: { food: 100 }, boostPopulation: true, message: 'The grateful refugees join your empire, bringing supplies and skilled workers!' },
                        { weight: 25, type: 'reward', rewards: { research: 50, food: 50 }, message: 'Scientists among the refugees share valuable knowledge!' },
                        { weight: 15, type: 'danger', damage: 0.1, message: 'Unbeknownst to you, enemy agents were among the refugees. Minor sabotage occurs.' }
                    ]
                },
                {
                    id: 'trade',
                    text: 'Trade supplies for information',
                    outcomes: [
                        { weight: 70, type: 'reward', rewards: { research: 80 }, message: 'The refugees share star charts and regional intelligence.' },
                        { weight: 30, type: 'reward', rewards: { credits: 50 }, message: 'They pay well for your supplies.' }
                    ]
                },
                {
                    id: 'dismiss',
                    text: 'Turn them away',
                    outcomes: [
                        { weight: 100, type: 'neutral', message: 'The refugees depart, seeking shelter elsewhere.' }
                    ]
                }
            ]
        },

        space_creature: {
            name: 'Space Creature',
            icon: '🐙',
            description: 'A massive space-dwelling creature approaches your fleet! Its intentions are unclear.',
            choices: [
                {
                    id: 'communicate',
                    text: 'Attempt communication',
                    outcomes: [
                        { weight: 40, type: 'reward', rewards: { research: 150 }, message: 'The creature is intelligent! Its insights advance your xenobiology research.' },
                        { weight: 35, type: 'neutral', message: 'The creature seems indifferent and drifts away.' },
                        { weight: 25, type: 'danger', damage: 0.3, message: 'Your signals agitate the creature! It attacks!' }
                    ]
                },
                {
                    id: 'attack',
                    text: 'Attack preemptively',
                    outcomes: [
                        { weight: 50, type: 'reward', rewards: { food: 100, minerals: 50 }, message: 'The creature is slain. Its remains provide organic resources.' },
                        { weight: 30, type: 'reward', rewards: { research: 100 }, message: 'Victory! Studying the corpse yields scientific breakthroughs.' },
                        { weight: 20, type: 'danger', damage: 0.5, message: 'The creature is stronger than expected! Severe fleet damage!' }
                    ]
                },
                {
                    id: 'evade',
                    text: 'Evade and observe',
                    outcomes: [
                        { weight: 70, type: 'reward', rewards: { research: 30 }, message: 'Observation from a safe distance provides some data.' },
                        { weight: 30, type: 'neutral', message: 'The creature ignores you and moves on.' }
                    ]
                }
            ]
        },

        // === PHENOMENA ===
        wormhole_echo: {
            name: 'Wormhole Echo',
            icon: '🌀',
            description: 'Strange energy readings suggest a collapsed wormhole. Residual effects could be studied... or exploited.',
            choices: [
                {
                    id: 'study',
                    text: 'Study the phenomenon',
                    outcomes: [
                        { weight: 50, type: 'reward', rewards: { research: 180 }, message: 'Groundbreaking discoveries in spatial physics!' },
                        { weight: 30, type: 'reward', rewards: { research: 100, energy: 80 }, message: 'Energy harvesting from dimensional rifts!' },
                        { weight: 20, type: 'danger', damage: 0.25, message: 'A surge of energy damages nearby ships!' }
                    ]
                },
                {
                    id: 'harvest',
                    text: 'Harvest residual energy',
                    outcomes: [
                        { weight: 60, type: 'reward', rewards: { energy: 150 }, message: 'Massive energy reserves extracted!' },
                        { weight: 25, type: 'reward', rewards: { energy: 200 }, message: 'The echo contained more power than expected!' },
                        { weight: 15, type: 'danger', shipLost: true, message: 'A ship is pulled into a dimensional rift!' }
                    ]
                },
                {
                    id: 'avoid',
                    text: 'Keep a safe distance',
                    outcomes: [
                        { weight: 100, type: 'neutral', message: 'Your fleet gives the phenomenon a wide berth.' }
                    ]
                }
            ]
        },

        quantum_fluctuation: {
            name: 'Quantum Fluctuation',
            icon: '✨',
            description: 'Reality itself seems unstable here. Sensors report impossible readings.',
            choices: [
                {
                    id: 'probe',
                    text: 'Send a probe into the anomaly',
                    outcomes: [
                        { weight: 30, type: 'reward', rewards: { research: 250 }, message: 'The probe returns with data that revolutionizes physics!' },
                        { weight: 40, type: 'reward', rewards: { research: 100 }, message: 'Interesting data is collected before the probe is lost.' },
                        { weight: 30, type: 'neutral', message: 'The probe vanishes without a trace.' }
                    ]
                },
                {
                    id: 'ships',
                    text: 'Send ships through',
                    outcomes: [
                        { weight: 20, type: 'reward', grantUnit: 'battleship', rewards: { research: 100 }, message: 'Your ships emerge enhanced! One has been... upgraded.' },
                        { weight: 30, type: 'reward', rewards: { minerals: 100, energy: 100 }, message: 'Your ships return with exotic matter!' },
                        { weight: 50, type: 'danger', damage: 0.6, message: 'Reality tears your fleet apart!' }
                    ]
                },
                {
                    id: 'observe',
                    text: 'Observe from afar',
                    outcomes: [
                        { weight: 100, type: 'reward', rewards: { research: 50 }, message: 'Remote observation yields some insights.' }
                    ]
                }
            ]
        },

        abandoned_colony: {
            name: 'Abandoned Colony',
            icon: '🏚️',
            description: 'Ruins of a colony dot a nearby moon. No life signs, but infrastructure remains.',
            choices: [
                {
                    id: 'investigate',
                    text: 'Investigate what happened',
                    outcomes: [
                        { weight: 40, type: 'reward', rewards: { research: 80, minerals: 50 }, message: 'Records reveal the colony fled a plague. You salvage safely.' },
                        { weight: 30, type: 'reward', rewards: { food: 100, energy: 50 }, message: 'Supply caches are still intact!' },
                        { weight: 20, type: 'danger', damage: 0.2, message: 'Whatever killed them is still here! Quarantine initiated.' },
                        { weight: 10, type: 'danger', damage: 0.4, message: 'Automated defenses activate!' }
                    ]
                },
                {
                    id: 'salvage',
                    text: 'Strip for parts',
                    outcomes: [
                        { weight: 80, type: 'reward', rewards: { minerals: 100 }, message: 'Efficient salvage operations recover useful materials.' },
                        { weight: 20, type: 'reward', rewards: { minerals: 150, energy: 30 }, message: 'More intact than expected!' }
                    ]
                },
                {
                    id: 'quarantine',
                    text: 'Mark as hazardous and leave',
                    outcomes: [
                        { weight: 100, type: 'neutral', message: 'Better safe than sorry. The colony is marked as hazardous.' }
                    ]
                }
            ]
        }
    };

    /**
     * Check if a system has been explored by an empire
     */
    isExplored(empireId, systemId) {
        const explored = this.exploredSystems.get(empireId);
        return explored ? explored.has(systemId) : false;
    }

    /**
     * Mark a system as explored by an empire
     */
    markExplored(empireId, systemId) {
        if (!this.exploredSystems.has(empireId)) {
            this.exploredSystems.set(empireId, new Set());
        }
        this.exploredSystems.get(empireId).add(systemId);
    }

    /**
     * Called when a fleet arrives at a new system
     * Returns an anomaly if one is discovered, null otherwise
     */
    checkForAnomaly(empireId, systemId, fleetId) {
        // Already explored? No anomaly
        if (this.isExplored(empireId, systemId)) {
            return null;
        }

        // Mark as explored
        this.markExplored(empireId, systemId);

        // Roll for anomaly discovery
        if (Math.random() > this.discoveryChance) {
            return null;
        }

        // Pick a random anomaly type
        const types = Object.keys(AnomalyManager.ANOMALY_TYPES);
        const typeId = types[Math.floor(Math.random() * types.length)];
        const anomalyDef = AnomalyManager.ANOMALY_TYPES[typeId];

        // Create the anomaly
        const anomaly = {
            id: `anomaly_${++anomalyIdCounter}`,
            typeId,
            ...anomalyDef,
            empireId,
            systemId,
            fleetId,
            discoveredAt: Date.now(),
            resolved: false
        };

        // Store as active
        this.activeAnomalies.set(anomaly.id, anomaly);

        return anomaly;
    }

    /**
     * Get all active anomalies for an empire
     */
    getAnomaliesForEmpire(empireId) {
        return Array.from(this.activeAnomalies.values())
            .filter(a => a.empireId === empireId && !a.resolved);
    }

    /**
     * Get a specific anomaly
     */
    getAnomaly(anomalyId) {
        return this.activeAnomalies.get(anomalyId);
    }

    /**
     * Resolve an anomaly with a player's choice
     * Returns the outcome
     */
    resolveAnomaly(anomalyId, choiceId, entityManager, resourceManager, fleetManager) {
        const anomaly = this.activeAnomalies.get(anomalyId);
        if (!anomaly || anomaly.resolved) {
            return { success: false, error: 'Anomaly not found or already resolved' };
        }

        // Find the choice
        const choice = anomaly.choices.find(c => c.id === choiceId);
        if (!choice) {
            return { success: false, error: 'Invalid choice' };
        }

        // Roll for outcome based on weights
        const totalWeight = choice.outcomes.reduce((sum, o) => sum + o.weight, 0);
        let roll = Math.random() * totalWeight;
        let outcome = null;

        for (const o of choice.outcomes) {
            roll -= o.weight;
            if (roll <= 0) {
                outcome = o;
                break;
            }
        }

        if (!outcome) {
            outcome = choice.outcomes[choice.outcomes.length - 1];
        }

        // Apply outcome effects
        const result = {
            success: true,
            anomalyId,
            anomalyName: anomaly.name,
            choiceId,
            outcomeType: outcome.type,
            message: outcome.message,
            rewards: {},
            damage: 0,
            unitsLost: 0,
            unitsGained: []
        };

        // Apply rewards
        if (outcome.rewards) {
            for (const [resource, amount] of Object.entries(outcome.rewards)) {
                resourceManager.add(anomaly.empireId, resource, amount);
                result.rewards[resource] = amount;
            }
        }

        // Apply damage to fleet
        if (outcome.damage && outcome.damage > 0) {
            const fleet = fleetManager.getFleet(anomaly.fleetId);
            if (fleet && fleet.ships) {
                const damageRatio = outcome.damage;
                const shipsToCheck = [...fleet.ships];
                
                for (const shipId of shipsToCheck) {
                    if (Math.random() < damageRatio) {
                        const ship = entityManager.getEntity(shipId);
                        if (ship) {
                            const damage = Math.floor(ship.maxHp * damageRatio);
                            const destroyed = entityManager.damageEntity(shipId, damage);
                            if (destroyed) {
                                result.unitsLost++;
                                fleet.ships = fleet.ships.filter(id => id !== shipId);
                            }
                        }
                    }
                }
                result.damage = damageRatio;
            }
        }

        // Ship lost
        if (outcome.shipLost) {
            const fleet = fleetManager.getFleet(anomaly.fleetId);
            if (fleet && fleet.ships && fleet.ships.length > 0) {
                const shipId = fleet.ships[Math.floor(Math.random() * fleet.ships.length)];
                entityManager.removeEntity(shipId);
                fleet.ships = fleet.ships.filter(id => id !== shipId);
                result.unitsLost++;
            }
        }

        // Grant unit
        if (outcome.grantUnit) {
            const fleet = fleetManager.getFleet(anomaly.fleetId);
            if (fleet) {
                // Create the unit at the fleet's destination
                const unit = entityManager.createUnit(outcome.grantUnit, anomaly.empireId, fleet.destPlanetId);
                result.unitsGained.push({ type: outcome.grantUnit, id: unit.id });
            }
        }

        // Mark resolved
        anomaly.resolved = true;
        anomaly.resolution = {
            choiceId,
            outcome: result,
            resolvedAt: Date.now()
        };

        return result;
    }

    /**
     * Get all anomalies (for state serialization)
     */
    serialize() {
        return {
            exploredSystems: Array.from(this.exploredSystems.entries()).map(([empireId, systems]) => ({
                empireId,
                systems: Array.from(systems)
            })),
            activeAnomalies: Array.from(this.activeAnomalies.values())
        };
    }

    /**
     * Load state from saved data
     */
    loadState(savedData) {
        if (!savedData) return;

        // Restore explored systems
        if (savedData.exploredSystems) {
            this.exploredSystems.clear();
            for (const { empireId, systems } of savedData.exploredSystems) {
                this.exploredSystems.set(empireId, new Set(systems));
            }
        }

        // Restore active anomalies
        if (savedData.activeAnomalies) {
            this.activeAnomalies.clear();
            let maxId = 0;
            for (const anomaly of savedData.activeAnomalies) {
                this.activeAnomalies.set(anomaly.id, anomaly);
                const idNum = parseInt(anomaly.id.replace('anomaly_', ''));
                if (!isNaN(idNum) && idNum > maxId) maxId = idNum;
            }
            anomalyIdCounter = maxId;
        }
    }

    /**
     * Clean up old resolved anomalies (called periodically)
     */
    cleanup() {
        const now = Date.now();
        const maxAge = 1000 * 60 * 60; // 1 hour

        for (const [id, anomaly] of this.activeAnomalies) {
            if (anomaly.resolved && anomaly.resolution && 
                (now - anomaly.resolution.resolvedAt) > maxAge) {
                this.activeAnomalies.delete(id);
            }
        }
    }
}
