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
     * Based on distance and ship speed
     */
    calculateTravelTime(originPlanet, destPlanet, shipSpeed) {
        // Get system positions
        const originSystem = this.universe.getSystem(originPlanet.systemId);
        const destSystem = this.universe.getSystem(destPlanet.systemId);
        
        if (!originSystem || !destSystem) return 100; // Default fallback
        
        // Same system = short warp
        if (originPlanet.systemId === destPlanet.systemId) {
            return Math.max(10, Math.floor(30 / shipSpeed));
        }
        
        // Different systems = longer warp based on distance
        const dx = (destSystem.x || 0) - (originSystem.x || 0);
        const dy = (destSystem.y || 0) - (originSystem.y || 0);
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Base time + distance factor, reduced by speed
        const baseTime = 50;
        const distanceFactor = distance * 5;
        return Math.max(20, Math.floor((baseTime + distanceFactor) / shipSpeed));
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
        
        // Create fleet movement record
        const fleetId = `fleet_${++this.fleetIdCounter}`;
        const fleet = {
            id: fleetId,
            empireId,
            originPlanetId,
            destPlanetId,
            originSystemId: originPlanet.systemId,
            destSystemId: destPlanet.systemId,
            shipIds: ships.map(s => s.id),
            cargoUnitIds: cargoUnits.map(u => u.id),
            departureTick: currentTick,
            arrivalTick,
            travelTime,
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
        
        return {
            success: true,
            fleetId,
            arrivalTick,
            travelTime,
            shipCount: ships.length,
            cargoCount: cargoUnits.length
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
