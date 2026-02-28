/**
 * Tick Processors - Extracted from GameEngine.tick()
 * 
 * Each processor handles one game system per tick.
 * This modularization makes tick() readable and each processor testable.
 */

import { EntityCleanup, ENTITY_LIMITS } from './performance.js';

/**
 * Process entity cleanup based on entity count thresholds
 */
export function processEntityCleanup(engine, isCleanupTick) {
    const entityCount = engine.entityManager.entities.size;
    const needsAggressiveCleanup = entityCount > ENTITY_LIMITS.SOFT_CAP;
    const needsHardLimitEnforcement = entityCount > ENTITY_LIMITS.HARD_CAP;
    
    // Log warnings for high entity counts
    if (entityCount > ENTITY_LIMITS.WARNING_THRESHOLD && engine.tick_count % 30 === 0) {
        console.warn(`⚠️ High entity count: ${entityCount}/${ENTITY_LIMITS.HARD_CAP} (soft cap: ${ENTITY_LIMITS.SOFT_CAP})`);
    }
    
    let cleaned = 0;
    let reason = null;
    
    if (needsHardLimitEnforcement) {
        cleaned = EntityCleanup.fullCleanup(engine.entityManager, engine.universe, engine.empires);
        reason = 'hard_limit';
    } else if (needsAggressiveCleanup && (isCleanupTick || engine.tick_count % 15 === 0)) {
        cleaned = EntityCleanup.aggressiveCleanup(engine.entityManager, engine.universe, engine.empires);
        reason = 'soft_limit';
    } else if (isCleanupTick) {
        cleaned = EntityCleanup.cleanup(engine.entityManager, engine.universe, engine.empires);
        reason = 'routine';
    }
    
    if (cleaned > 0) {
        engine.recordChange('cleanup', { removed: cleaned, reason });
    }
    
    return cleaned;
}

/**
 * Process starbase construction, upgrades, and shipyard production
 */
export function processStarbaseEvents(engine) {
    const starbaseEvents = engine.starbaseManager.tick(engine.tick_count);
    
    for (const event of starbaseEvents) {
        const empire = engine.empires.get(event.starbase.owner);
        if (event.type === 'constructed' || event.type === 'upgraded') {
            engine.log('starbase', `${empire?.name || 'Unknown'}: ${event.message}`);
        }
    }
    
    // Process shipyard production
    const completedShips = engine.starbaseManager.processShipConstruction(engine.tick_count);
    
    for (const ship of completedShips) {
        const empire = engine.empires.get(ship.empireId);
        const planetsInSystem = engine.universe.planets.filter(p => p.systemId === ship.systemId);
        const spawnPlanet = planetsInSystem.find(p => p.owner === ship.empireId) || planetsInSystem[0];
        
        if (spawnPlanet) {
            const entity = engine.entityManager.createUnit(ship.shipType, ship.empireId, spawnPlanet.id);
            engine.recordChange('entity', { id: entity.id });
            engine.log('shipyard', `🚀 ${empire?.name || 'Unknown'}: ${ship.shipType} completed at ${ship.starbase.name}!`);
        }
    }
    
    return { events: starbaseEvents.length, ships: completedShips.length };
}

/**
 * Process fleet arrivals, anomaly discovery, and combat
 */
export function processFleetArrivals(engine) {
    const arrivedFleets = engine.fleetManager.tick(engine.tick_count);
    engine.pendingAnomalies = [];
    
    for (const fleet of arrivedFleets) {
        const result = engine.fleetManager.processArrival(fleet, engine.combatSystem, engine.starbaseManager);
        const planet = engine.universe.getPlanet(fleet.destPlanetId);
        const empire = engine.empires.get(fleet.empireId);
        
        // Check for anomaly discovery
        if (planet && empire) {
            const anomaly = engine.anomalyManager.checkForAnomaly(fleet.empireId, planet.systemId, fleet.id);
            if (anomaly) {
                engine.pendingAnomalies.push(anomaly);
                engine.log('anomaly', `${empire.name} discovered: ${anomaly.name}!`);
            }
        }
        
        // Handle arrival result
        processFleetArrivalResult(engine, fleet, result, planet, empire);
    }
    
    return arrivedFleets.length;
}

/**
 * Handle a single fleet arrival result (combat, colonize, landing)
 */
function processFleetArrivalResult(engine, fleet, result, planet, empire) {
    if (result.type === 'starbase_combat') {
        processStarbaseCombat(engine, fleet, result);
    } else if (result.type === 'combat') {
        const attacker = engine.empires.get(fleet.empireId);
        const defender = engine.empires.get(result.targetEmpireId);
        const combatPlanet = engine.universe.getPlanet(result.targetPlanetId);
        
        if (attacker && defender && combatPlanet) {
            engine.log('combat', `${attacker.name} fleet arrived at ${combatPlanet.name}! Battle begins!`);
        }
    } else if (result.type === 'colonize') {
        const colonizePlanet = engine.universe.getPlanet(result.targetPlanetId);
        
        if (empire && colonizePlanet && !colonizePlanet.owner) {
            colonizePlanet.owner = fleet.empireId;
            engine.log('colonization', `${empire.name} colonized ${colonizePlanet.name}!`);
        }
    } else if (result.type === 'landed') {
        if (empire && planet) {
            engine.log('fleet', `${empire.name} fleet arrived at ${planet.name}`);
        }
    }
}

/**
 * Process starbase combat when fleet arrives at enemy starbase
 */
function processStarbaseCombat(engine, fleet, result) {
    const attacker = engine.empires.get(fleet.empireId);
    const defender = engine.empires.get(result.targetEmpireId);
    const starbase = result.starbase;
    const planet = engine.universe.getPlanet(fleet.destPlanetId);
    
    if (!attacker || !defender || !starbase) return;
    
    engine.log('combat', `🚀 ${attacker.name} fleet engaging ${starbase.name}!`);
    
    const attackingShips = fleet.shipIds
        .map(id => engine.entityManager.getEntity(id))
        .filter(s => s && s.attack > 0);
    
    if (attackingShips.length === 0) {
        engine.log('combat', `⚠️ ${attacker.name} fleet has no combat ships - cannot engage starbase!`);
        return;
    }
    
    const combatResult = engine.combatSystem.resolveStarbaseCombat(
        attackingShips,
        starbase,
        engine.entityManager,
        engine.starbaseManager,
        { relicManager: engine.relicManager }
    );
    
    for (const logEntry of combatResult.battleLog) {
        engine.log('combat', logEntry);
    }
    
    // Auto-declare war if not already
    const relation = engine.diplomacy.getRelation(fleet.empireId, result.targetEmpireId);
    if (relation !== 'war') {
        engine.diplomacy.declareWar(fleet.empireId, result.targetEmpireId);
        engine.log('diplomacy', `${attacker.name} and ${defender.name} are now at WAR!`);
    }
    
    engine.recordChange('starbase', { systemId: result.targetSystemId, destroyed: combatResult.starbaseDestroyed });
    
    if (combatResult.starbaseDestroyed && planet?.owner === result.targetEmpireId) {
        engine.log('combat', `⚔️ ${starbase.name} destroyed! ${attacker.name} can now invade ${planet.name}!`);
    }
}

/**
 * Process all combat resolution for the tick
 */
export function processCombat(engine) {
    // Support ship repairs
    engine.combatSystem.applySupportShipEffects(engine.entityManager);
    
    // Terrain effects (radiation, asteroids, etc.)
    engine.applyTerrainEffects();
    
    // Resolve all combat
    const combatResults = engine.combatSystem.resolveAllCombat(
        engine.entityManager,
        engine.universe,
        engine.relicManager
    );
    
    combatResults.forEach(result => {
        let description = result.description;
        
        if (result.combatants && result.combatants.length >= 2) {
            const names = result.combatants.map(id => engine.empires.get(id)?.name || id).join(' vs ');
            description = `${names}: ${result.damages.length} units destroyed`;
            
            // Auto-declare war between combatants
            for (let i = 0; i < result.combatants.length; i++) {
                for (let j = i + 1; j < result.combatants.length; j++) {
                    const emp1 = result.combatants[i];
                    const emp2 = result.combatants[j];
                    const relation = engine.diplomacy.getRelation(emp1, emp2);
                    
                    if (relation !== 'war' && relation !== 'allied') {
                        engine.diplomacy.declareWar(emp1, emp2);
                        const empire1 = engine.empires.get(emp1);
                        const empire2 = engine.empires.get(emp2);
                        engine.log('diplomacy', `${empire1?.name || emp1} and ${empire2?.name || emp2} are now at WAR!`);
                    }
                }
            }
        }
        
        engine.log('combat', description);
    });
    
    return combatResults.length;
}

/**
 * Process trade routes and pirate raids
 */
export function processTradeRoutes(engine) {
    const tradeIncome = engine.tradeManager.tick(engine.tick_count, engine.resourceManager);
    
    // Log pirate raids
    const activeRaids = engine.tradeManager.getActiveRaids(engine.tick_count);
    for (const raid of activeRaids) {
        if (raid.startTick === engine.tick_count) {
            const empire = engine.empires.get(raid.empireId);
            engine.log('trade', `Pirates raiding ${empire?.name || 'Unknown'}'s trade route!`);
        }
    }
    
    // Clean up expired trades
    const expiredTrades = engine.diplomacy.cleanupExpiredTrades(engine.tick_count);
    for (const trade of expiredTrades) {
        const fromEmpire = engine.empires.get(trade.from);
        const toEmpire = engine.empires.get(trade.to);
        engine.log('trade', `⏰ Trade offer from ${fromEmpire?.name} to ${toEmpire?.name} expired`);
    }
    
    return { income: tradeIncome, raids: activeRaids.length, expired: expiredTrades.length };
}

/**
 * Process calamities (disasters on planets)
 */
export function processCalamities(engine) {
    const calamityEvents = engine.calamityManager.tick(
        engine.tick_count,
        engine.universe,
        engine.entityManager,
        engine.resourceManager,
        engine.techTree
    );
    
    for (const event of calamityEvents) {
        const losses = [];
        if (event.losses.population) losses.push(`${event.losses.population} died`);
        if (event.losses.structures?.length) losses.push(`${event.losses.structures.length} structures destroyed`);
        if (event.losses.food) losses.push(`${event.losses.food} food lost`);
        if (event.losses.energy) losses.push(`${event.losses.energy} energy lost`);
        
        let msg = `${event.icon} ${event.name} struck ${event.planetName}!`;
        if (losses.length > 0) msg += ` (${losses.join(', ')})`;
        
        if (event.gains) {
            const gains = Object.entries(event.gains).map(([k, v]) => `+${v} ${k}`);
            if (gains.length > 0) msg += ` [${gains.join(', ')}]`;
        }
        
        engine.log('calamity', msg);
        engine.recordChange('calamity', { planetId: event.planetId, type: event.type });
    }
    
    return calamityEvents.length;
}

/**
 * Process espionage (spy missions, detection, counter-intel)
 */
export function processEspionage(engine) {
    engine.pendingEspionageEvents = [];
    
    // Update counter-intel levels
    for (const [empireId] of engine.empires) {
        engine.espionageManager.calculateCounterIntel(empireId, engine.entityManager, engine.techTree);
    }
    
    // Process spy missions
    const espionageEvents = engine.espionageManager.tick(
        engine.tick_count,
        engine.entityManager,
        engine.resourceManager,
        engine.techTree,
        engine.universe,
        engine.diplomacy
    );
    
    for (const event of espionageEvents) {
        engine.pendingEspionageEvents.push(event);
        
        const empire = engine.empires.get(event.empireId);
        const targetEmpire = event.targetEmpireId ? engine.empires.get(event.targetEmpireId) : null;
        
        switch (event.type) {
            case 'spy_embedded':
            case 'mission_success':
            case 'mission_failed':
            case 'spy_extracted':
                engine.log('espionage', `${event.icon} ${empire?.name}: ${event.message}`);
                break;
            case 'spy_detected':
                engine.log('espionage', `${event.icon} ${targetEmpire?.name} caught spy from ${empire?.name}!`);
                break;
        }
        
        engine.recordChange('espionage', { type: event.type, empireId: event.empireId });
    }
    
    return espionageEvents.length;
}

/**
 * Process Galactic Council elections
 */
export function processCouncil(engine) {
    engine.pendingCouncilEvents = [];
    
    const councilResult = engine.council.tick(
        engine.tick_count,
        engine.empires,
        (empireId) => engine.universe.planets.filter(p => p.owner === empireId).length,
        engine.resourceManager,
        engine.diplomacy,
        engine.speciesManager
    );
    
    if (councilResult) {
        engine.pendingCouncilEvents.push(councilResult);
        
        if (councilResult.event === 'voting_started') {
            engine.log('council', `🗳️ GALACTIC COUNCIL CONVENES! Voting for Supreme Leader has begun! (${councilResult.data.candidates.length} candidates)`);
        } else if (councilResult.event === 'election_resolved') {
            const data = councilResult.data;
            if (data.winner) {
                const winnerEmpire = engine.empires.get(data.winner);
                if (data.previousLeader === data.winner) {
                    engine.log('council', `👑 ${winnerEmpire?.name || data.winner} RE-ELECTED as Supreme Leader! (${data.consecutiveTerms} consecutive terms)`);
                } else {
                    engine.log('council', `👑 ${winnerEmpire?.name || data.winner} ELECTED as Supreme Leader of the Galactic Council!`);
                }
            } else {
                engine.log('council', `🗳️ No majority reached in council election - position remains vacant`);
            }
        }
        
        engine.recordChange('council', councilResult);
    }
    
    return councilResult ? 1 : 0;
}

/**
 * Process endgame crisis events
 */
export function processCrisis(engine) {
    engine.pendingCrisisEvents = [];
    
    const crisisEvents = engine.crisisManager.tick(
        engine.tick_count,
        engine.universe,
        engine.entityManager,
        engine.empires,
        engine.combatSystem
    );
    
    for (const event of crisisEvents) {
        engine.pendingCrisisEvents.push(event);
        engine.log('crisis', event.message);
        engine.recordChange('crisis', event);
    }
    
    return crisisEvents.length;
}

/**
 * Process galactic cycles (periodic galaxy-wide effects)
 */
export function processCycles(engine) {
    engine.pendingCycleEvents = [];
    
    const cycleEvent = engine.cycleManager.tick(engine.tick_count);
    
    if (cycleEvent) {
        engine.pendingCycleEvents.push(cycleEvent);
        engine.log('cycle', cycleEvent.message);
        engine.recordChange('cycle', cycleEvent);
    }
    
    // Apply Void Storm damage to fleets in transit
    if (engine.cycleManager.currentCycle === 'void_storm') {
        const activeFleets = engine.fleetManager.getFleetsInTransit();
        const damaged = engine.cycleManager.applyVoidStormDamage(activeFleets, engine.entityManager);
        
        if (damaged.length > 0 && engine.tick_count % 30 === 0) {
            engine.log('cycle', `🌀 Void Storm damages ${damaged.length} ships in transit!`);
        }
    }
    
    return cycleEvent ? 1 : 0;
}

/**
 * Process planet abandonment (empty planets revert to unowned)
 */
export function processPlanetAbandonment(engine) {
    const ABANDONMENT_THRESHOLD = 200;  // ~3.3 minutes of being empty
    let abandonedCount = 0;
    
    for (const planet of engine.universe.planets) {
        if (!planet.owner) continue;
        
        const planetEntities = engine.entityManager.getEntitiesAtLocation(planet.id)
            .filter(e => e.owner === planet.owner);
        const hasStructures = planetEntities.some(e => e.type === 'structure');
        const hasUnits = planetEntities.some(e => e.type === 'unit' || e.type === 'ship');
        const hasPopulation = planet.population > 0;
        
        if (!hasPopulation && !hasStructures && !hasUnits) {
            planet._emptyTicks = (planet._emptyTicks || 0) + 10;
            
            if (planet._emptyTicks >= ABANDONMENT_THRESHOLD) {
                const empire = engine.empires.get(planet.owner);
                engine.log('abandonment', `🏚️ ${empire?.name || 'Unknown'} abandoned ${planet.name} (empty too long)`);
                planet.owner = null;
                planet._emptyTicks = 0;
                engine.recordChange('planet', { planetId: planet.id, abandoned: true });
                abandonedCount++;
            }
        } else {
            planet._emptyTicks = 0;
        }
    }
    
    return abandonedCount;
}

/**
 * Check for empire eliminations
 */
export function checkEliminations(engine) {
    const defeated = engine.victoryChecker.checkDefeats(engine.empires, engine.universe);
    
    if (defeated.length > 0) {
        defeated.forEach(d => {
            engine.log('elimination', `💀 ${d.empireName} has been eliminated!`);
        });
    }
    
    return defeated.length;
}

/**
 * Record tick performance metrics
 */
export function recordTickPerformance(engine, tickStart) {
    const tickDuration = Date.now() - tickStart;
    const tickBudgetResult = engine.tickBudgetMonitor.recordTick(tickDuration, engine.tick_count);
    
    if (tickBudgetResult.warningLevel === 'critical') {
        console.error(`🚨 CRITICAL TICK #${engine.tick_count}: ${tickDuration}ms (entities: ${engine.entityManager.entities.size}, empires: ${engine.empires.size}, fleets: ${engine.fleetManager.fleetsInTransit?.size || 0})`);
    } else if (tickBudgetResult.warningLevel === 'warning') {
        console.warn(`⚠️ SLOW TICK #${engine.tick_count}: ${tickDuration}ms (entities: ${engine.entityManager.entities.size}, empires: ${engine.empires.size})`);
    }
    
    // Track metrics
    if (!engine.tickMetrics) {
        engine.tickMetrics = { maxDuration: 0, slowTicks: 0, totalTicks: 0, totalDuration: 0 };
    }
    engine.tickMetrics.totalTicks++;
    engine.tickMetrics.totalDuration = (engine.tickMetrics.totalDuration || 0) + tickDuration;
    if (tickDuration > engine.tickMetrics.maxDuration) {
        engine.tickMetrics.maxDuration = tickDuration;
    }
    if (tickDuration > 100) {
        engine.tickMetrics.slowTicks++;
    }
    
    return tickDuration;
}
