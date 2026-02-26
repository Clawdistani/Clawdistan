/**
 * Fleet Management System
 * Handles ship movement between planets with warp timers and visual tracking
 * 
 * Travel is direct between any two points. Strategic wormholes provide
 * instant travel shortcuts across the universe for those who control them.
 */

export class FleetManager {
    constructor(universe, entityManager) {
        this.universe = universe;
        this.entityManager = entityManager;
        this.fleetsInTransit = new Map(); // fleetId -> FleetMovement
        this.fleetIdCounter = 0;
    }

    /**
     * Calculate travel time between two planets (in ticks)
     * Based on direct distance between systems
     * 
     * Travel time tiers:
     * - Same system: 1-3 minutes (orbital positions matter)
     * - Same galaxy: 3-15 minutes based on distance
     * - Different galaxy: 15-60 minutes (long-range travel)
     * 
     * Strategic wormholes bypass normal travel for instant transport!
     */
    calculateTravelTime(originPlanet, destPlanet, shipSpeed) {
        // Get system positions
        const originSystem = this.universe.getSystem(originPlanet.systemId);
        const destSystem = this.universe.getSystem(destPlanet.systemId);
        
        if (!originSystem || !destSystem) return 100; // Default fallback
        
        // Same planet (edge case)
        if (originPlanet.id === destPlanet.id) return 0;
        
        // TIER 1: Same system = travel time based on orbital positions
        if (originPlanet.systemId === destPlanet.systemId) {
            const planetDistance = this.universe.getPlanetDistance?.(originPlanet, destPlanet) ||
                this.calculateOrbitalDistance(originPlanet, destPlanet);
            
            const baseTime = 60; // 1 minute minimum
            const distanceFactor = planetDistance * 2;
            
            return Math.max(60, Math.min(300, Math.floor((baseTime + distanceFactor) / shipSpeed)));
        }
        
        // TIER 2 & 3: Different system = direct distance calculation
        const dx = destSystem.x - originSystem.x;
        const dy = destSystem.y - originSystem.y;
        const directDistance = Math.sqrt(dx * dx + dy * dy);
        
        // Check if same galaxy or different galaxy
        const originGalaxy = this.universe.galaxies.find(g => g.systems.includes(originSystem.id));
        const destGalaxy = this.universe.galaxies.find(g => g.systems.includes(destSystem.id));
        const sameGalaxy = originGalaxy && destGalaxy && originGalaxy.id === destGalaxy.id;
        
        // Base travel time from distance
        // ~1 tick per unit distance, scaled by speed
        let travelTime = Math.floor(directDistance * 1.5);
        
        // Different galaxy = extra overhead
        if (!sameGalaxy) {
            travelTime += 600; // +10 minutes for inter-galaxy travel
        }
        
        // Apply ship speed
        travelTime = Math.floor(travelTime / shipSpeed);
        
        // Apply terrain speed modifiers
        travelTime = this.applyTerrainSpeedModifiers(travelTime, originSystem, destSystem);
        
        // Clamp: 3 minutes to 2 hours
        return Math.min(7200, Math.max(180, travelTime));
    }
    
    /**
     * Calculate distance between two planets using their orbital positions
     * Fallback for when universe.getPlanetDistance isn't available
     */
    calculateOrbitalDistance(planet1, planet2) {
        const system = this.universe.getSystem(planet1.systemId);
        if (!system) return 50; // Default fallback
        
        // Get absolute positions
        const x1 = Math.cos(planet1.orbitAngle || 0) * (planet1.orbitRadius || 20);
        const y1 = Math.sin(planet1.orbitAngle || 0) * (planet1.orbitRadius || 20);
        const x2 = Math.cos(planet2.orbitAngle || 0) * (planet2.orbitRadius || 20);
        const y2 = Math.sin(planet2.orbitAngle || 0) * (planet2.orbitRadius || 20);
        
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    /**
     * Apply terrain feature speed modifiers to travel time
     * Nebulae and black holes slow down travel through affected systems
     */
    applyTerrainSpeedModifiers(baseTravelTime, originSystem, destSystem) {
        let travelTime = baseTravelTime;
        
        // Check origin system terrain
        const originEffects = this.universe.getTerrainEffects?.(originSystem.id);
        if (originEffects?.travelSpeedMod) {
            // Apply half the modifier for departing from terrain
            const departMod = 1 + (1 - originEffects.travelSpeedMod) * 0.5;
            travelTime = Math.floor(travelTime * departMod);
        }
        
        // Check destination system terrain
        const destEffects = this.universe.getTerrainEffects?.(destSystem.id);
        if (destEffects?.travelSpeedMod) {
            // Apply half the modifier for arriving at terrain
            const arriveMod = 1 + (1 - destEffects.travelSpeedMod) * 0.5;
            travelTime = Math.floor(travelTime * arriveMod);
        }
        
        return travelTime;
    }
    
    /**
     * Get travel type description for UI
     */
    getTravelType(originPlanet, destPlanet) {
        const originSystem = this.universe.getSystem(originPlanet.systemId);
        const destSystem = this.universe.getSystem(destPlanet.systemId);
        
        if (!originSystem || !destSystem) return 'unknown';
        
        if (originPlanet.systemId === destPlanet.systemId) {
            return 'intra-system';
        }
        
        // Check if same galaxy
        const originGalaxy = this.universe.galaxies.find(g => g.systems.includes(originSystem.id));
        const destGalaxy = this.universe.galaxies.find(g => g.systems.includes(destSystem.id));
        
        if (originGalaxy && destGalaxy && originGalaxy.id !== destGalaxy.id) {
            return 'inter-galactic';
        }
        
        return 'inter-system';
    }

    /**
     * Launch a fleet from one planet to another
     * Returns the fleet ID for tracking
     * 
     * Travel is direct - fleets can go anywhere. Strategic wormholes
     * provide instant shortcuts for those who control them.
     * 
     * @param {number} travelTimeModifier - Optional multiplier for travel time (cycle effects)
     */
    launchFleet(empireId, originPlanetId, destPlanetId, shipIds, cargoUnitIds = [], currentTick, travelTimeModifier = 1.0) {
        const originPlanet = this.universe.getPlanet(originPlanetId);
        const destPlanet = this.universe.getPlanet(destPlanetId);
        
        if (!originPlanet || !destPlanet) {
            return { success: false, error: 'Invalid planet' };
        }
        
        // Get system info for travel calculations
        const originSystem = this.universe.getSystem(originPlanet.systemId);
        const destSystem = this.universe.getSystem(destPlanet.systemId);
        
        if (!originSystem || !destSystem) {
            return { success: false, error: 'Invalid system' };
        }
        
        // Validate ships belong to empire and are at origin
        const ships = [];
        let minSpeed = Infinity;
        let totalCargo = 0;
        
        for (const shipId of shipIds) {
            const ship = this.entityManager.getEntity(shipId);
            if (!ship) {
                return { success: false, error: `Ship ${shipId} not found` };
            }
            if (ship.owner !== empireId) {
                return { success: false, error: `Ship ${shipId} not owned by empire` };
            }
            if (ship.location !== originPlanetId) {
                return { success: false, error: `Ship ${shipId} not at origin planet` };
            }
            if (!ship.spaceUnit) {
                return { success: false, error: `${ship.name} is not a space unit` };
            }
            
            ships.push(ship);
            minSpeed = Math.min(minSpeed, ship.speed || 1);
            
            const def = this.entityManager.definitions[ship.defName];
            if (def?.cargoCapacity) {
                totalCargo += def.cargoCapacity;
            }
        }
        
        if (ships.length === 0) {
            return { success: false, error: 'No valid ships selected' };
        }
        
        // Validate cargo units
        const cargoUnits = [];
        for (const unitId of cargoUnitIds) {
            const unit = this.entityManager.getEntity(unitId);
            if (!unit) continue;
            if (unit.owner !== empireId) continue;
            if (unit.location !== originPlanetId) continue;
            if (unit.spaceUnit) continue; // Space units fly themselves
            
            cargoUnits.push(unit);
        }
        
        if (cargoUnits.length > totalCargo) {
            return { success: false, error: `Not enough cargo space (need ${cargoUnits.length}, have ${totalCargo})` };
        }
        
        // Calculate travel time (fleet moves at slowest ship's speed)
        let travelTime = this.calculateTravelTime(originPlanet, destPlanet, minSpeed);
        
        // Apply travel time modifier (from galactic cycles - Warp Resonance = 0.5, Void Storm = 1.25)
        if (travelTimeModifier !== 1.0) {
            travelTime = Math.max(1, Math.floor(travelTime * travelTimeModifier));
        }
        
        // Check for wormhole instant travel
        const wormholeRoute = this.checkWormholeRoute(originPlanet, destPlanet, empireId);
        let usedWormhole = null;
        
        if (wormholeRoute.available) {
            // Instant travel through wormhole! (10 ticks = 10 seconds transit time)
            travelTime = 10;
            usedWormhole = wormholeRoute.wormhole;
        }
        
        const arrivalTick = currentTick + travelTime;
        
        // Determine travel type
        let travelType = this.getTravelType(originPlanet, destPlanet);
        if (usedWormhole) {
            travelType = 'wormhole';
        }
        
        // Create fleet movement record
        const fleetId = `fleet_${++this.fleetIdCounter}`;
        const fleet = {
            id: fleetId,
            empireId,
            originPlanetId,
            destPlanetId,
            originSystemId: originPlanet.systemId,
            destSystemId: destPlanet.systemId,
            originGalaxyId: originSystem.galaxyId,
            destGalaxyId: destSystem.galaxyId,
            shipIds: ships.map(s => s.id),
            cargoUnitIds: cargoUnits.map(u => u.id),
            departureTick: currentTick,
            arrivalTick,
            travelTime,
            travelType, // 'intra-system', 'inter-system', 'inter-galactic', or 'wormhole'
            usedWormhole: usedWormhole?.id || null, // Track which wormhole was used
            progress: 0, // 0 to 1
            // Cache positions for rendering
            originPos: this.getPlanetPosition(originPlanet),
            destPos: this.getPlanetPosition(destPlanet)
        };
        
        this.fleetsInTransit.set(fleetId, fleet);
        
        // Remove ships and cargo from origin planet
        for (const ship of ships) {
            ship.location = null;
            ship.inTransit = fleetId;
        }
        for (const unit of cargoUnits) {
            unit.location = null;
            unit.inTransit = fleetId;
        }
        
        const travelMinutes = Math.ceil(travelTime / 60);
        
        // Build route info for response
        const routeInfo = {
            from: {
                planet: originPlanet.name,
                system: originSystem.name,
                galaxy: this.universe.getGalaxy(originSystem.galaxyId)?.name
            },
            to: {
                planet: destPlanet.name,
                system: destSystem.name,
                galaxy: this.universe.getGalaxy(destSystem.galaxyId)?.name
            }
        };
        
        return {
            success: true,
            fleetId,
            arrivalTick,
            travelTime,
            travelMinutes,
            travelType,
            shipCount: ships.length,
            cargoCount: cargoUnits.length,
            route: routeInfo
        };
    }

    /**
     * Get planet position for rendering
     */
    getPlanetPosition(planet) {
        const system = this.universe.getSystem(planet.systemId);
        if (!system) return { x: 0, y: 0 };
        
        // Planet position within system + system position
        return {
            systemX: system.x || 0,
            systemY: system.y || 0,
            planetX: planet.x || 0,
            planetY: planet.y || 0,
            planetId: planet.id,
            systemId: planet.systemId
        };
    }
    
    /**
     * Check if a wormhole route is available between origin and destination
     * Wormhole travel requires:
     * 1. Origin system has a wormhole
     * 2. That wormhole connects to destination system
     * 3. Either wormhole is neutral/unowned, OR owned by the empire, OR both ends are owned by the empire
     */
    checkWormholeRoute(originPlanet, destPlanet, empireId) {
        // Check if origin system has a wormhole
        const originWormhole = this.universe.getWormholeInSystem(originPlanet.systemId);
        if (!originWormhole) {
            return { available: false, reason: 'No wormhole in origin system' };
        }
        
        // Check if wormhole leads to destination system
        if (originWormhole.destSystemId !== destPlanet.systemId) {
            return { available: false, reason: 'Wormhole does not connect to destination' };
        }
        
        // Check if wormhole is destroyed
        if (originWormhole.hp !== undefined && originWormhole.hp <= 0) {
            return { available: false, reason: 'Wormhole is destabilized (destroyed)' };
        }
        
        // Check access permissions
        // Wormhole can be used if:
        // - It's neutral (no owner)
        // - Empire owns it
        // - Empire owns the paired wormhole (bidirectional access)
        const pairedWormhole = this.universe.getWormhole(originWormhole.pairId);
        const ownsOrigin = originWormhole.ownerId === empireId;
        const ownsPaired = pairedWormhole?.ownerId === empireId;
        const isNeutral = !originWormhole.ownerId;
        
        if (!isNeutral && !ownsOrigin && !ownsPaired) {
            return { 
                available: false, 
                reason: `Wormhole controlled by enemy empire`,
                blockedBy: originWormhole.ownerId
            };
        }
        
        return {
            available: true,
            wormhole: originWormhole,
            pairedWormhole
        };
    }
    
    /**
     * Get all available wormhole routes from a system
     */
    getAvailableWormholeRoutes(systemId, empireId) {
        const wormhole = this.universe.getWormholeInSystem(systemId);
        if (!wormhole) return [];
        
        const destSystem = this.universe.getSystem(wormhole.destSystemId);
        if (!destSystem) return [];
        
        const pairedWormhole = this.universe.getWormhole(wormhole.pairId);
        const ownsOrigin = wormhole.ownerId === empireId;
        const ownsPaired = pairedWormhole?.ownerId === empireId;
        const isNeutral = !wormhole.ownerId;
        
        if (!isNeutral && !ownsOrigin && !ownsPaired) {
            return []; // No access
        }
        
        return [{
            wormholeId: wormhole.id,
            wormholeName: wormhole.name,
            destSystemId: wormhole.destSystemId,
            destSystemName: destSystem.name,
            owner: wormhole.ownerId,
            level: wormhole.level || 1
        }];
    }

    /**
     * Process fleet movement each tick
     * Returns list of fleets that arrived
     */
    tick(currentTick) {
        const arrivedFleets = [];
        
        for (const [fleetId, fleet] of this.fleetsInTransit) {
            // Update progress
            const elapsed = currentTick - fleet.departureTick;
            fleet.progress = Math.min(1, elapsed / fleet.travelTime);
            
            // Check if arrived
            if (currentTick >= fleet.arrivalTick) {
                arrivedFleets.push(fleet);
                this.fleetsInTransit.delete(fleetId);
            }
        }
        
        return arrivedFleets;
    }

    /**
     * Handle fleet arrival at destination
     * @param {Object} fleet - The arriving fleet
     * @param {Object} combatSystem - Combat system reference
     * @param {Object} starbaseManager - Starbase manager to check for enemy starbases
     */
    processArrival(fleet, combatSystem, starbaseManager = null) {
        const destPlanet = this.universe.getPlanet(fleet.destPlanetId);
        if (!destPlanet) return { success: false, error: 'Destination planet no longer exists' };
        
        // Move all ships and cargo to destination
        for (const shipId of fleet.shipIds) {
            const ship = this.entityManager.getEntity(shipId);
            if (ship) {
                ship.location = fleet.destPlanetId;
                ship.inTransit = null;
            }
        }
        
        for (const unitId of fleet.cargoUnitIds) {
            const unit = this.entityManager.getEntity(unitId);
            if (unit) {
                unit.location = fleet.destPlanetId;
                unit.inTransit = null;
            }
        }
        
        // ═══════════════════════════════════════════════════════════════════
        // STARBASE COMBAT - Check if enemy starbase controls the system
        // Fleets must destroy starbases before invading planets!
        // ═══════════════════════════════════════════════════════════════════
        if (starbaseManager) {
            const systemId = destPlanet.systemId;
            const starbase = starbaseManager.getStarbase(systemId);
            
            // Enemy starbase present and not under construction?
            if (starbase && 
                starbase.owner !== fleet.empireId && 
                starbase.constructing === false) {
                
                return {
                    type: 'starbase_combat',
                    fleetId: fleet.id,
                    empireId: fleet.empireId,
                    targetPlanetId: fleet.destPlanetId,
                    targetSystemId: systemId,
                    targetStarbaseId: starbase.id,
                    targetEmpireId: starbase.owner,
                    starbase: starbase
                };
            }
        }
        
        // If planet is owned by enemy, trigger ground combat
        if (destPlanet.owner && destPlanet.owner !== fleet.empireId) {
            return {
                type: 'combat',
                fleetId: fleet.id,
                empireId: fleet.empireId,
                targetPlanetId: fleet.destPlanetId,
                targetEmpireId: destPlanet.owner
            };
        }
        
        // If planet is unowned, this might be colonization
        if (!destPlanet.owner) {
            // Check if fleet has a colony ship
            const hasColonyShip = fleet.shipIds.some(id => {
                const ship = this.entityManager.getEntity(id);
                return ship?.canColonize;
            });
            
            if (hasColonyShip) {
                return {
                    type: 'colonize',
                    fleetId: fleet.id,
                    empireId: fleet.empireId,
                    targetPlanetId: fleet.destPlanetId
                };
            }
        }
        
        // Friendly landing
        return {
            type: 'landed',
            fleetId: fleet.id,
            empireId: fleet.empireId,
            targetPlanetId: fleet.destPlanetId
        };
    }

    /**
     * Get a specific fleet by ID (raw data for internal use)
     */
    getFleet(fleetId) {
        return this.fleetsInTransit.get(fleetId);
    }

    /**
     * Get all fleets in transit (for rendering)
     * Includes ship details for UI display
     */
    getFleetsInTransit() {
        return Array.from(this.fleetsInTransit.values()).map(f => {
            // Get detailed ship info for each ship in fleet
            const ships = f.shipIds.map(shipId => {
                const ship = this.entityManager.getEntity(shipId);
                if (!ship) return null;
                return {
                    id: ship.id,
                    name: ship.name,
                    defName: ship.defName,
                    hp: ship.hp,
                    maxHp: ship.maxHp,
                    attack: ship.attack,
                    speed: ship.speed,
                    range: ship.range,
                    vision: ship.vision,
                    evasion: ship.evasion,
                    cargoCapacity: ship.cargoCapacity,
                    customBlueprint: ship.customBlueprint,
                    modules: ship.modules || []
                };
            }).filter(Boolean);

            // Get cargo unit info
            const cargo = f.cargoUnitIds.map(unitId => {
                const unit = this.entityManager.getEntity(unitId);
                if (!unit) return null;
                return {
                    id: unit.id,
                    name: unit.name,
                    type: unit.type,
                    defName: unit.defName
                };
            }).filter(Boolean);

            return {
                id: f.id,
                empireId: f.empireId,
                originPlanetId: f.originPlanetId,
                destPlanetId: f.destPlanetId,
                originSystemId: f.originSystemId,
                destSystemId: f.destSystemId,
                originGalaxyId: f.originGalaxyId,
                destGalaxyId: f.destGalaxyId,
                travelType: f.travelType, // 'intra-system', 'inter-system', or 'inter-galactic'
                travelTime: f.travelTime,
                travelMinutes: Math.ceil(f.travelTime / 60),
                progress: f.progress,
                arrivalTick: f.arrivalTick,
                shipCount: f.shipIds.length,
                cargoCount: f.cargoUnitIds.length,
                ships,  // Full ship details
                cargo,  // Cargo unit details
                originPos: f.originPos,
                destPos: f.destPos
            };
        });
    }

    /**
     * Get fleets for a specific empire
     */
    getEmpiresFleets(empireId) {
        return this.getFleetsInTransit().filter(f => f.empireId === empireId);
    }

    /**
     * Serialize for persistence
     */
    serialize() {
        return {
            fleetIdCounter: this.fleetIdCounter,
            fleetsInTransit: Array.from(this.fleetsInTransit.entries())
        };
    }

    /**
     * Load from persistence
     */
    loadState(state) {
        if (!state) return;
        this.fleetIdCounter = state.fleetIdCounter || 0;
        this.fleetsInTransit.clear();
        if (state.fleetsInTransit) {
            for (const [id, fleet] of state.fleetsInTransit) {
                this.fleetsInTransit.set(id, fleet);
            }
        }
    }
}
