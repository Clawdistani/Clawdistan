/**
 * Battle Arena System
 * 
 * Transforms combat from instant resolution into timed arena events.
 * When fleets meet, a battle arena is created with a gathering phase
 * where additional fleets can join before resolution.
 * 
 * Phase 1: Timer + Multi-Fleet Joining
 * - Battle initiation with countdown
 * - Reinforcement window for nearby fleets
 * - Resolution when timer ends
 */

import { log } from '../api/logger.js';

// Battle configuration
export const BATTLE_CONFIG = {
    // Gathering phase duration in ticks (90 seconds default)
    BASE_GATHERING_TIME: 90,
    
    // Minimum gathering time
    MIN_GATHERING_TIME: 60,
    
    // Maximum gathering time (scales with fleet size)
    MAX_GATHERING_TIME: 180,
    
    // Ticks per ship for gathering time scaling
    TICKS_PER_SHIP: 2,
    
    // Range in which fleets can join (in systems)
    JOIN_RANGE_SAME_SYSTEM: true,
    JOIN_RANGE_ADJACENT_SYSTEMS: true,
    
    // Time to warp in when joining (ticks)
    REINFORCE_WARP_TIME: 15,
    
    // Phase 4: Wormhole Battle Config
    WORMHOLE_DEFENDER_BONUS: 0.25,      // +25% damage for defender at wormhole
    WORMHOLE_CHOKE_PENALTY: 0.15,       // -15% damage for attacker (limited approach)
    WORMHOLE_BLOCKADE_DURATION: 300,    // 5 minutes blockade after winning
    WORMHOLE_CONTROL_BONUS: 0.10        // +10% damage for wormhole owner
};

/**
 * Battle types
 */
export const BATTLE_TYPE = {
    STANDARD: 'standard',
    WORMHOLE: 'wormhole'
};

/**
 * Battle states
 */
export const BATTLE_STATE = {
    GATHERING: 'gathering',
    RESOLVING: 'resolving',
    COMPLETE: 'complete'
};

/**
 * Battle participant sides
 */
export const BATTLE_SIDE = {
    ATTACKER: 'attacker',
    DEFENDER: 'defender'
};

export class BattleArenaManager {
    constructor() {
        this.battles = new Map();
        this.nextBattleId = 1;
        this.battleLog = log.combat || console;
    }

    /**
     * Create a new battle arena when fleets/units meet
     */
    createBattle(options) {
        const {
            location,
            attackerEmpireId,
            defenderEmpireId,
            attackerShipIds,
            defenderShipIds,
            currentTick,
            battleType = BATTLE_TYPE?.STANDARD || 'standard',  // Phase 4: battle type
            wormholeId = null,         // Phase 4: wormhole reference
            wormholeOwnerId = null     // Phase 4: who owns the wormhole
        } = options;

        const totalShips = (attackerShipIds?.length || 0) + (defenderShipIds?.length || 0);
        const gatheringTime = Math.min(
            BATTLE_CONFIG.MAX_GATHERING_TIME,
            Math.max(
                BATTLE_CONFIG.MIN_GATHERING_TIME,
                BATTLE_CONFIG.BASE_GATHERING_TIME + (totalShips * BATTLE_CONFIG.TICKS_PER_SHIP)
            )
        );

        const battleId = `battle_${this.nextBattleId++}`;
        
        const battle = {
            id: battleId,
            location: {
                planetId: location.planetId,
                systemId: location.systemId,
                galaxyId: location.galaxyId,
                x: location.x || 0,
                y: location.y || 0
            },
            state: BATTLE_STATE.GATHERING,
            startTick: currentTick,
            gatheringDuration: gatheringTime,
            resolveTick: currentTick + gatheringTime,
            participants: {
                [BATTLE_SIDE.ATTACKER]: [{
                    empireId: attackerEmpireId,
                    shipIds: [...(attackerShipIds || [])],
                    joinedAt: currentTick,
                    isOriginal: true
                }],
                [BATTLE_SIDE.DEFENDER]: [{
                    empireId: defenderEmpireId,
                    shipIds: [...(defenderShipIds || [])],
                    joinedAt: currentTick,
                    isOriginal: true
                }]
            },
            empireSides: {
                [attackerEmpireId]: BATTLE_SIDE.ATTACKER,
                [defenderEmpireId]: BATTLE_SIDE.DEFENDER
            },
            result: null,
            replay: []
        };

        this.battles.set(battleId, battle);
        
        this.battleLog.info('Battle arena created', {
            battleId,
            location: battle.location,
            attacker: attackerEmpireId,
            defender: defenderEmpireId,
            gatheringTime,
            resolveTick: battle.resolveTick
        });

        return {
            success: true,
            battle,
            event: {
                type: 'battle_started',
                battleId,
                location: battle.location,
                attackerEmpireId,
                defenderEmpireId,
                gatheringDuration: gatheringTime,
                resolveTick: battle.resolveTick
            }
        };
    }

    getBattleAtLocation(planetId) {
        for (const [, battle] of this.battles) {
            if (battle.location.planetId === planetId && 
                battle.state === BATTLE_STATE.GATHERING) {
                return battle;
            }
        }
        return null;
    }

    canJoinBattle(battle, empireId, fleetSystemId, universe, diplomacy) {
        if (battle.state !== BATTLE_STATE.GATHERING) {
            return { canJoin: false, reason: 'Battle has already started resolving' };
        }

        if (battle.empireSides[empireId]) {
            return { canJoin: false, reason: 'Already participating in this battle' };
        }

        const battleSystemId = battle.location.systemId;
        
        if (fleetSystemId === battleSystemId) {
            // Same system - OK
        } else if (BATTLE_CONFIG.JOIN_RANGE_ADJACENT_SYSTEMS) {
            const isAdjacent = universe.areSystemsAdjacent?.(fleetSystemId, battleSystemId);
            if (!isAdjacent) {
                return { canJoin: false, reason: 'Fleet too far from battle' };
            }
        } else {
            return { canJoin: false, reason: 'Fleet must be in the same system' };
        }

        let side = null;
        const attackerEmpires = battle.participants[BATTLE_SIDE.ATTACKER].map(p => p.empireId);
        const defenderEmpires = battle.participants[BATTLE_SIDE.DEFENDER].map(p => p.empireId);

        for (const attackerEmpire of attackerEmpires) {
            const relation = diplomacy.getRelation(empireId, attackerEmpire);
            if (relation === 'allied') { side = BATTLE_SIDE.ATTACKER; break; }
            if (relation === 'war') { side = BATTLE_SIDE.DEFENDER; break; }
        }

        if (!side) {
            for (const defenderEmpire of defenderEmpires) {
                const relation = diplomacy.getRelation(empireId, defenderEmpire);
                if (relation === 'allied') { side = BATTLE_SIDE.DEFENDER; break; }
                if (relation === 'war') { side = BATTLE_SIDE.ATTACKER; break; }
            }
        }

        if (!side) {
            return { canJoin: true, side: null, reason: 'Neutral - can choose side', canChooseSide: true };
        }

        return { canJoin: true, side, reason: `Joining ${side} side based on diplomacy` };
    }

    joinBattle(battleId, empireId, shipIds, side, currentTick) {
        const battle = this.battles.get(battleId);
        if (!battle) return { success: false, error: 'Battle not found' };
        if (battle.state !== BATTLE_STATE.GATHERING) return { success: false, error: 'Cannot join - battle resolving' };
        if (!shipIds || shipIds.length === 0) return { success: false, error: 'No ships to join with' };
        if (side !== BATTLE_SIDE.ATTACKER && side !== BATTLE_SIDE.DEFENDER) return { success: false, error: 'Invalid side' };

        battle.participants[side].push({
            empireId,
            shipIds: [...shipIds],
            joinedAt: currentTick,
            isOriginal: false,
            warpingIn: true,
            availableAt: currentTick + BATTLE_CONFIG.REINFORCE_WARP_TIME
        });
        battle.empireSides[empireId] = side;

        return {
            success: true,
            event: {
                type: 'fleet_joined_battle',
                battleId,
                empireId,
                side,
                shipCount: shipIds.length,
                warpTime: BATTLE_CONFIG.REINFORCE_WARP_TIME
            }
        };
    }

    tick(currentTick, combatSystem, entityManager, universe, relicManager) {
        const events = [];
        const completedBattles = [];

        for (const [battleId, battle] of this.battles) {
            if (battle.state === BATTLE_STATE.COMPLETE) {
                completedBattles.push(battleId);
                continue;
            }

            // Update warping reinforcements
            for (const side of [BATTLE_SIDE.ATTACKER, BATTLE_SIDE.DEFENDER]) {
                for (const participant of battle.participants[side]) {
                    if (participant.warpingIn && currentTick >= participant.availableAt) {
                        participant.warpingIn = false;
                        events.push({
                            type: 'reinforcements_arrived',
                            battleId,
                            empireId: participant.empireId,
                            side,
                            shipCount: participant.shipIds.length
                        });
                    }
                }
            }

            if (battle.state === BATTLE_STATE.GATHERING && currentTick >= battle.resolveTick) {
                battle.state = BATTLE_STATE.RESOLVING;
                const result = this.resolveBattle(battle, combatSystem, entityManager, universe, relicManager);
                battle.state = BATTLE_STATE.COMPLETE;
                battle.result = result;
                battle.completedAt = currentTick;

                events.push({
                    type: 'battle_resolved',
                    battleId,
                    location: battle.location,
                    result: {
                        winner: result.winner,
                        attackerLosses: result.attackerLosses,
                        defenderLosses: result.defenderLosses,
                        totalDestroyed: result.destroyed.length
                    },
                    replay: battle.replay
                });
            }
        }

        for (const battleId of completedBattles) {
            const battle = this.battles.get(battleId);
            if (battle && currentTick - battle.completedAt > 300) {
                this.battles.delete(battleId);
            }
        }

        return events;
    }

    resolveBattle(battle, combatSystem, entityManager, universe, relicManager) {
        const replay = [];
        const destroyed = [];
        let attackerLosses = 0;
        let defenderLosses = 0;

        const attackerShips = [];
        const defenderShips = [];

        for (const participant of battle.participants[BATTLE_SIDE.ATTACKER]) {
            if (!participant.warpingIn) {
                for (const shipId of participant.shipIds) {
                    const ship = entityManager.getEntity(shipId);
                    if (ship && ship.hp > 0) attackerShips.push({ ...ship, participantEmpire: participant.empireId });
                }
            }
        }

        for (const participant of battle.participants[BATTLE_SIDE.DEFENDER]) {
            if (!participant.warpingIn) {
                for (const shipId of participant.shipIds) {
                    const ship = entityManager.getEntity(shipId);
                    if (ship && ship.hp > 0) defenderShips.push({ ...ship, participantEmpire: participant.empireId });
                }
            }
        }

        if (attackerShips.length === 0 && defenderShips.length === 0) {
            return { winner: 'draw', attackerLosses: 0, defenderLosses: 0, destroyed: [], replay: [{ tick: 0, event: 'draw' }] };
        }
        if (attackerShips.length === 0) {
            return { winner: BATTLE_SIDE.DEFENDER, attackerLosses: 0, defenderLosses: 0, destroyed: [], replay: [{ tick: 0, event: 'victory', winner: BATTLE_SIDE.DEFENDER }] };
        }
        if (defenderShips.length === 0) {
            return { winner: BATTLE_SIDE.ATTACKER, attackerLosses: 0, defenderLosses: 0, destroyed: [], replay: [{ tick: 0, event: 'victory', winner: BATTLE_SIDE.ATTACKER }] };
        }

        const getFleetPower = (ships) => ({
            totalAttack: ships.reduce((sum, s) => sum + (s.attack || 0), 0),
            totalHp: ships.reduce((sum, s) => sum + (s.hp || 0), 0),
            count: ships.length
        });

        let remainingAttackers = [...attackerShips];
        let remainingDefenders = [...defenderShips];

        replay.push({ tick: 0, event: 'battle_start', attacker: getFleetPower(remainingAttackers), defender: getFleetPower(remainingDefenders) });

        for (let round = 1; round <= 20 && remainingAttackers.length > 0 && remainingDefenders.length > 0; round++) {
            const roundEvents = [];
            const attackerPower = getFleetPower(remainingAttackers);
            const defenderPower = getFleetPower(remainingDefenders);

            // Phase 4: Calculate damage modifiers for wormhole battles
            let attackerDamageMod = 1.0;
            let defenderDamageMod = 1.0;
            
            if (battle.battleType === 'wormhole') {
                // Attacker penalty for limited approach vectors
                attackerDamageMod -= BATTLE_CONFIG.WORMHOLE_CHOKE_PENALTY;
                // Defender bonus for positional advantage
                defenderDamageMod += BATTLE_CONFIG.WORMHOLE_DEFENDER_BONUS;
                
                // Additional bonus if wormhole owner is defending
                const defenderEmpires = battle.participants[BATTLE_SIDE.DEFENDER].map(p => p.empireId);
                if (defenderEmpires.includes(battle.wormholeOwnerId)) {
                    defenderDamageMod += BATTLE_CONFIG.WORMHOLE_CONTROL_BONUS;
                }
            }
            
            if (attackerPower.totalAttack > 0) {
                const baseDamagePerDefender = attackerPower.totalAttack / remainingDefenders.length;
                const damagePerDefender = baseDamagePerDefender * attackerDamageMod;
                for (const defender of [...remainingDefenders]) {
                    const damage = damagePerDefender * (0.8 + Math.random() * 0.4);
                    entityManager.damageEntity(defender.id, damage);
                    const currentShip = entityManager.getEntity(defender.id);
                    if (!currentShip || currentShip.hp <= 0) {
                        remainingDefenders = remainingDefenders.filter(d => d.id !== defender.id);
                        defenderLosses++;
                        destroyed.push({ id: defender.id, name: defender.name, side: BATTLE_SIDE.DEFENDER });
                        roundEvents.push({ event: 'destroyed', shipId: defender.id, side: BATTLE_SIDE.DEFENDER });
                    }
                }
            }

            if (defenderPower.totalAttack > 0 && remainingAttackers.length > 0) {
                const baseDamagePerAttacker = defenderPower.totalAttack / remainingAttackers.length;
                const damagePerAttacker = baseDamagePerAttacker * defenderDamageMod;
                for (const attacker of [...remainingAttackers]) {
                    const damage = damagePerAttacker * (0.8 + Math.random() * 0.4);
                    entityManager.damageEntity(attacker.id, damage);
                    const currentShip = entityManager.getEntity(attacker.id);
                    if (!currentShip || currentShip.hp <= 0) {
                        remainingAttackers = remainingAttackers.filter(a => a.id !== attacker.id);
                        attackerLosses++;
                        destroyed.push({ id: attacker.id, name: attacker.name, side: BATTLE_SIDE.ATTACKER });
                        roundEvents.push({ event: 'destroyed', shipId: attacker.id, side: BATTLE_SIDE.ATTACKER });
                    }
                }
            }

            replay.push({ tick: round, event: 'round', attackersRemaining: remainingAttackers.length, defendersRemaining: remainingDefenders.length, events: roundEvents });
        }

        let winner;
        if (remainingAttackers.length === 0 && remainingDefenders.length === 0) winner = 'draw';
        else if (remainingAttackers.length === 0) winner = BATTLE_SIDE.DEFENDER;
        else if (remainingDefenders.length === 0) winner = BATTLE_SIDE.ATTACKER;
        else {
            const attackerHp = remainingAttackers.reduce((sum, s) => sum + (entityManager.getEntity(s.id)?.hp || 0), 0);
            const defenderHp = remainingDefenders.reduce((sum, s) => sum + (entityManager.getEntity(s.id)?.hp || 0), 0);
            winner = attackerHp > defenderHp ? BATTLE_SIDE.ATTACKER : BATTLE_SIDE.DEFENDER;
        }

        replay.push({ tick: replay.length, event: 'victory', winner });
        battle.replay = replay;
        
        // Phase 4: Set blockade for wormhole battles
        let blockadeInfo = null;
        if (battle.battleType === 'wormhole' && battle.wormholeId) {
            // Winner gets temporary blockade control
            const blockadeUntil = Date.now() + (BATTLE_CONFIG.WORMHOLE_BLOCKADE_DURATION * 1000);
            battle.blockadeUntil = blockadeUntil;
            
            // Determine which empire controls the blockade
            const winningSide = winner === BATTLE_SIDE.ATTACKER ? 
                battle.participants[BATTLE_SIDE.ATTACKER] : 
                battle.participants[BATTLE_SIDE.DEFENDER];
            
            const blockadeController = winningSide.length > 0 ? winningSide[0].empireId : null;
            
            blockadeInfo = {
                wormholeId: battle.wormholeId,
                controlledBy: blockadeController,
                blockadeUntil: blockadeUntil,
                duration: BATTLE_CONFIG.WORMHOLE_BLOCKADE_DURATION
            };
            
            replay.push({ 
                tick: replay.length, 
                event: 'blockade_established',
                wormholeId: battle.wormholeId,
                controller: blockadeController,
                durationSeconds: BATTLE_CONFIG.WORMHOLE_BLOCKADE_DURATION
            });
        }

        return { 
            winner, 
            attackerLosses, 
            defenderLosses, 
            attackerSurvivors: remainingAttackers.map(s => s.id), 
            defenderSurvivors: remainingDefenders.map(s => s.id), 
            destroyed, 
            replay,
            blockade: blockadeInfo  // Phase 4: Include blockade info
        };
    }

    getBattle(battleId) { return this.battles.get(battleId); }
    
    getActiveBattles() {
        return Array.from(this.battles.values()).filter(b => 
            b.state !== BATTLE_STATE.COMPLETE || (b.completedAt && Date.now() - b.completedAt < 60000)
        );
    }

    getBattlesForEmpire(empireId) {
        return Array.from(this.battles.values()).filter(b => b.empireSides[empireId]);
    }

    isInBattle(entityId) {
        for (const [, battle] of this.battles) {
            if (battle.state === BATTLE_STATE.GATHERING || battle.state === BATTLE_STATE.RESOLVING) {
                for (const side of [BATTLE_SIDE.ATTACKER, BATTLE_SIDE.DEFENDER]) {
                    for (const participant of battle.participants[side]) {
                        if (participant.shipIds.includes(entityId)) return battle.id;
                    }
                }
            }
        }
        return null;
    }

    /**
     * Phase 4: Check if a wormhole is blockaded
     * Returns the blockade info if active, null otherwise
     */
    getWormholeBlockade(wormholeId) {
        for (const [, battle] of this.battles) {
            if (battle.battleType === 'wormhole' && 
                battle.wormholeId === wormholeId && 
                battle.blockadeUntil && 
                Date.now() < battle.blockadeUntil) {
                
                // Find who controls the blockade
                const winner = battle.result?.winner;
                const winningSide = winner === BATTLE_SIDE.ATTACKER ? 
                    battle.participants[BATTLE_SIDE.ATTACKER] : 
                    battle.participants[BATTLE_SIDE.DEFENDER];
                
                return {
                    wormholeId: wormholeId,
                    controlledBy: winningSide.length > 0 ? winningSide[0].empireId : null,
                    blockadeUntil: battle.blockadeUntil,
                    remainingMs: battle.blockadeUntil - Date.now()
                };
            }
        }
        return null;
    }

    /**
     * Phase 4: Check if an empire can use a wormhole (not blockaded by enemy)
     */
    canUseWormhole(wormholeId, empireId) {
        const blockade = this.getWormholeBlockade(wormholeId);
        if (!blockade) return { canUse: true };
        
        // Owner of blockade can always use
        if (blockade.controlledBy === empireId) {
            return { canUse: true, hasBlockadeControl: true };
        }
        
        // Enemy empires cannot use
        return { 
            canUse: false, 
            reason: 'Wormhole is blockaded',
            blockedBy: blockade.controlledBy,
            remainingSeconds: Math.ceil(blockade.remainingMs / 1000)
        };
    }

    /**
     * Phase 4: Get all active blockades
     */
    getActiveBlockades() {
        const blockades = [];
        for (const [, battle] of this.battles) {
            if (battle.battleType === 'wormhole' && 
                battle.blockadeUntil && 
                Date.now() < battle.blockadeUntil) {
                blockades.push(this.getWormholeBlockade(battle.wormholeId));
            }
        }
        return blockades;
    }

    serialize() {
        return { battles: Array.from(this.battles.values()), nextBattleId: this.nextBattleId };
    }

    loadState(savedState) {
        if (!savedState) return;
        this.battles.clear();
        if (savedState.battles) {
            for (const battle of savedState.battles) this.battles.set(battle.id, battle);
        }
        this.nextBattleId = savedState.nextBattleId || 1;
    }
}
