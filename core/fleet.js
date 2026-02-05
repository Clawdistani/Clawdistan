/**
 * Fleet Management System
 * Handles ship movement between planets with warp timers and visual tracking
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
     * Based on distance, ship speed, and whether crossing galaxy boundaries
     * 
     * Travel time tiers:
     * - Same system: 1-3 minutes
     * - Same galaxy, different system: 5-15 minutes  
     * - Different galaxy: 30-120 minutes (intergalactic travel is SLOW)
     */
    calculateTravelTime(originPlanet, destPlanet, shipSpeed) {
        // Get system positions
        const originSystem = this.universe.getSystem(originPlanet.systemId);
        const destSystem = this.universe.getSystem(destPlanet.systemId);
        
        if (!originSystem || !destSystem) return 100; // Default fallback
        
        // Same planet (edge case)
        if (originPlanet.id === destPlanet.id) return 0;
        
        // Get galaxy info
        const originGalaxy = originSystem.galaxyId;
        const destGalaxy = destSystem.galaxyId;
        
        // Calculate distance between systems
        const dx = (destSystem.x || 0) - (originSystem.x || 0);
        const dy = (destSystem.y || 0) - (originSystem.y || 0);
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // TIER 1: Same system = 1-3 minutes (60-180 ticks)
        if (originPlanet.systemId === destPlanet.systemId) {
            return Math.max(60, Math.floor(120 / shipSpeed));
        }
        
        // TIER 2: Same galaxy, different system = 5-15 minutes (300-900 ticks)
        if (originGalaxy === destGalaxy) {
            const baseTime = 300; // 5 minutes minimum
            const distanceFactor = distance * 3;
            return Math.max(300, Math.floor((baseTime + distanceFactor) / shipSpeed));
        }
        
        // TIER 3: Different galaxy = 30-120 minutes (1800-7200 ticks)
        // Intergalactic travel requires significant time investment
        const baseTime = 1800; // 30 minutes minimum
        const distanceFactor = distance * 8;
        const travelTime = Math.floor((baseTime + distanceFactor) / shipSpeed);
        
        // Cap at 2 hours (7200 ticks) for very distant galaxies
        return Math.min(7200, Math.max(1800, travelTime));
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
        
        if (originSystem.galaxyId === destSystem.galaxyId) {
            return 'inter-system';
        }
        
        return 'inter-galactic';
    }

    /**
     * Launch a fleet from one planet to another
     * Returns the fleet ID for tracking
     */
    launchFleet(empireId, originPlanetId, destPlanetId, shipIds, cargoUnitIds = [], currentTick) {
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
        const travelTime = this.calculateTravelTime(originPlanet, destPlanet, minSpeed);
        const arrivalTick = currentTick + travelTime;
        
        // Determine travel type
        const travelType = this.getTravelType(originPlanet, destPlanet);
        
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
        
        return {
            success: true,
            fleetId,
            arrivalTick,
            travelTime,
            travelMinutes,
            travelType, // 'intra-system', 'inter-system', or 'inter-galactic' (from fleet record)
            shipCount: ships.length,
            cargoCount: cargoUnits.length,
            route: {
                from: {
                    planet: originPlanet.name,
                    system: this.universe.getSystem(originPlanet.systemId)?.name,
                    galaxy: this.universe.getGalaxy(this.universe.getSystem(originPlanet.systemId)?.galaxyId)?.name
                },
                to: {
                    planet: destPlanet.name,
                    system: this.universe.getSystem(destPlanet.systemId)?.name,
                    galaxy: this.universe.getGalaxy(this.universe.getSystem(destPlanet.systemId)?.galaxyId)?.name
                }
            }
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
     */
    processArrival(fleet, combatSystem) {
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
        
        // If planet is owned by enemy, trigger combat
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
     * Get all fleets in transit (for rendering)
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
            destPos: f.destPos
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
