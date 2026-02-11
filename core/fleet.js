/**
 * Fleet Management System
 * Handles ship movement between planets with warp timers and visual tracking
 * 
 * HYPERLANE PATHFINDING: Fleets must follow hyperlane routes between systems.
 * - Same-system travel: Direct movement between planets (no hyperlane needed)
 * - Different-system travel: Must follow hyperlane network
 * - If no hyperlane path exists, movement is blocked
 */

export class FleetManager {
    constructor(universe, entityManager) {
        this.universe = universe;
        this.entityManager = entityManager;
        this.fleetsInTransit = new Map(); // fleetId -> FleetMovement
        this.fleetIdCounter = 0;
    }
    
    /**
     * Check if a hyperlane route exists between two systems
     * @returns {Object|null} Route info or null if unreachable
     */
    getHyperlaneRoute(originSystemId, destSystemId) {
        if (originSystemId === destSystemId) {
            return { path: [originSystemId], totalDistance: 0, hopCount: 0 };
        }
        
        return this.universe.findHyperlanePath(originSystemId, destSystemId);
    }

    /**
     * Calculate travel time between two planets (in ticks)
     * Based on HYPERLANE PATH distance, ship speed, and system crossings
     * 
     * Travel time tiers:
     * - Same system: 1-3 minutes (orbital positions matter!)
     * - Different system (same galaxy): Time based on hyperlane hops
     * - Different galaxy: Extra time for wormhole transitions
     * 
     * HYPERLANE PATHFINDING: Fleets follow the hyperlane network!
     * - Travel time is based on the sum of hyperlane distances
     * - Each system hop adds transition overhead
     * - Wormholes (inter-galaxy) add extra time
     */
    calculateTravelTime(originPlanet, destPlanet, shipSpeed, hyperlaneRoute = null) {
        // Get system positions
        const originSystem = this.universe.getSystem(originPlanet.systemId);
        const destSystem = this.universe.getSystem(destPlanet.systemId);
        
        if (!originSystem || !destSystem) return 100; // Default fallback
        
        // Same planet (edge case)
        if (originPlanet.id === destPlanet.id) return 0;
        
        // TIER 1: Same system = travel time based on ACTUAL orbital positions!
        // No hyperlane needed for intra-system travel
        if (originPlanet.systemId === destPlanet.systemId) {
            // Calculate actual distance between planets using orbital positions
            const planetDistance = this.universe.getPlanetDistance?.(originPlanet, destPlanet) ||
                this.calculateOrbitalDistance(originPlanet, destPlanet);
            
            // Base travel time scales with planet distance
            // Closer planets = faster travel (60-300 ticks / 1-5 min)
            const baseTime = 60; // 1 minute minimum
            const distanceFactor = planetDistance * 2; // Scale with actual distance
            
            return Math.max(60, Math.min(300, Math.floor((baseTime + distanceFactor) / shipSpeed)));
        }
        
        // TIER 2 & 3: Different system = HYPERLANE PATHFINDING
        // Get or calculate the hyperlane route
        const route = hyperlaneRoute || this.getHyperlaneRoute(originSystem.id, destSystem.id);
        
        if (!route) {
            // No hyperlane path exists - this should be blocked at launchFleet
            return Infinity;
        }
        
        // Base travel time from hyperlane distance
        // Each unit of hyperlane distance = ~3 ticks at speed 1
        const distanceFactor = route.totalDistance * 3;
        
        // Hop overhead: Each system transition adds time (entering/exiting hyperlane)
        // More hops = longer journey even if distance is similar
        const hopOverhead = route.hopCount * 60; // 1 minute per hop
        
        // Check for wormholes (inter-galaxy travel)
        let wormholeOverhead = 0;
        if (route.hyperlanes) {
            for (const laneId of route.hyperlanes) {
                const lane = this.universe.hyperlanes.find(h => h.id === laneId);
                if (lane?.type === 'wormhole') {
                    wormholeOverhead += 600; // 10 minutes extra per wormhole
                }
            }
        }
        
        // Calculate base time
        let travelTime = 120 + distanceFactor + hopOverhead + wormholeOverhead; // 2 min base
        
        // Apply ship speed
        travelTime = Math.floor(travelTime / shipSpeed);
        
        // Apply terrain speed modifiers for origin and destination
        travelTime = this.applyTerrainSpeedModifiers(travelTime, originSystem, destSystem);
        
        // Minimum 3 minutes for any inter-system travel, cap at 2 hours
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
     * Now includes hyperlane info!
     */
    getTravelType(originPlanet, destPlanet, hyperlaneRoute = null) {
        const originSystem = this.universe.getSystem(originPlanet.systemId);
        const destSystem = this.universe.getSystem(destPlanet.systemId);
        
        if (!originSystem || !destSystem) return 'unknown';
        
        if (originPlanet.systemId === destPlanet.systemId) {
            return 'intra-system';
        }
        
        // Check if route uses wormholes
        if (hyperlaneRoute?.hyperlanes) {
            for (const laneId of hyperlaneRoute.hyperlanes) {
                const lane = this.universe.hyperlanes.find(h => h.id === laneId);
                if (lane?.type === 'wormhole') {
                    return 'inter-galactic'; // Uses wormhole = inter-galactic
                }
            }
        }
        
        // No wormholes = standard inter-system FTL
        return 'inter-system';
    }

    /**
     * Launch a fleet from one planet to another
     * Returns the fleet ID for tracking
     * 
     * HYPERLANE REQUIREMENT: For inter-system travel, fleets must follow
     * hyperlane routes. If no path exists, movement is blocked.
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
        
        // ═══════════════════════════════════════════════════════════════════
        // HYPERLANE PATHFINDING - Must have valid route for inter-system travel
        // ═══════════════════════════════════════════════════════════════════
        let hyperlaneRoute = null;
        
        if (originPlanet.systemId !== destPlanet.systemId) {
            // Different systems = need hyperlane route
            hyperlaneRoute = this.getHyperlaneRoute(originSystem.id, destSystem.id);
            
            if (!hyperlaneRoute) {
                return { 
                    success: false, 
                    error: `No hyperlane route exists between ${originSystem.name} and ${destSystem.name}. Systems must be connected by hyperlanes for fleet travel.`
                };
            }
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
        // Pass hyperlane route for accurate distance calculation
        let travelTime = this.calculateTravelTime(originPlanet, destPlanet, minSpeed, hyperlaneRoute);
        
        // Apply travel time modifier (from galactic cycles - Warp Resonance = 0.5, Void Storm = 1.25)
        if (travelTimeModifier !== 1.0) {
            travelTime = Math.max(1, Math.floor(travelTime * travelTimeModifier));
        }
        
        const arrivalTick = currentTick + travelTime;
        
        // Determine travel type (uses wormhole info from route)
        const travelType = this.getTravelType(originPlanet, destPlanet, hyperlaneRoute);
        
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
            travelType, // 'intra-system', 'inter-system', or 'inter-galactic'
            progress: 0, // 0 to 1
            // Cache positions for rendering
            originPos: this.getPlanetPosition(originPlanet),
            destPos: this.getPlanetPosition(destPlanet),
            // ═══ NEW: Hyperlane route info for visualization ═══
            hyperlaneRoute: hyperlaneRoute ? {
                path: hyperlaneRoute.path,
                hyperlanes: hyperlaneRoute.hyperlanes || [],
                hopCount: hyperlaneRoute.hopCount || 0,
                totalDistance: hyperlaneRoute.totalDistance || 0
            } : null
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
        
        // Add hyperlane path info if applicable
        if (hyperlaneRoute) {
            routeInfo.hyperlaneHops = hyperlaneRoute.hopCount;
            routeInfo.waypoints = hyperlaneRoute.path.map(sysId => {
                const sys = this.universe.getSystem(sysId);
                return sys?.name || sysId;
            });
        }
        
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
     * Now includes hyperlane route for path visualization
     */
    getFleetsInTransit() {
        return Array.from(this.fleetsInTransit.values()).map(f => ({
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
            originPos: f.originPos,
            destPos: f.destPos,
            // Hyperlane route for path visualization
            hyperlaneRoute: f.hyperlaneRoute || null
        }));
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
