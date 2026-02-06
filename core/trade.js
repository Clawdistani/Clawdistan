/**
 * Trade Routes System for Clawdistan
 * 
 * Features:
 * - Establish trade routes between owned planets
 * - Trade value based on distance, population, and starbases
 * - Trading Hub starbase modules boost route value
 * - Pirates can raid unprotected routes
 * - Trade income added to empire credits per tick
 */

export class TradeManager {
    constructor(universe, starbaseManager) {
        this.universe = universe;
        this.starbaseManager = starbaseManager;
        this.routes = new Map(); // routeId -> route
        this.nextRouteId = 1;
        this.pirateRaids = []; // Active raids
        
        // Constants
        this.BASE_TRADE_VALUE = 2;      // Base credits per tick per route
        this.POPULATION_MULTIPLIER = 0.5; // Bonus per combined population
        this.DISTANCE_PENALTY = 0.02;   // Penalty per unit distance
        this.TRADING_HUB_BONUS = 0.5;   // +50% per Trading Hub on route
        this.PIRATE_RAID_CHANCE = 0.001; // 0.1% per tick per unprotected route
        this.RAID_DURATION = 300;       // Ticks a raid lasts
        this.RAID_PENALTY = 0.75;       // 75% reduction during raid
    }

    /**
     * Create a new trade route between two planets
     */
    createRoute(empireId, planet1Id, planet2Id) {
        const planet1 = this.universe.getPlanet(planet1Id);
        const planet2 = this.universe.getPlanet(planet2Id);

        if (!planet1 || !planet2) {
            return { success: false, error: 'Invalid planet(s)' };
        }

        if (planet1.owner !== empireId || planet2.owner !== empireId) {
            return { success: false, error: 'Both planets must be owned by your empire' };
        }

        if (planet1Id === planet2Id) {
            return { success: false, error: 'Cannot create route to same planet' };
        }

        // Check if route already exists
        const existingRoute = this.findRoute(planet1Id, planet2Id);
        if (existingRoute) {
            return { success: false, error: 'Trade route already exists between these planets' };
        }

        // Check max routes (based on Trading Hubs owned)
        const maxRoutes = this.getMaxRoutes(empireId);
        const currentRoutes = this.getEmpireRoutes(empireId).length;
        if (currentRoutes >= maxRoutes) {
            return { success: false, error: `Maximum routes reached (${maxRoutes}). Build more Trading Hubs.` };
        }

        const routeId = `route_${this.nextRouteId++}`;
        const route = {
            id: routeId,
            empireId,
            planet1Id,
            planet2Id,
            createdAt: Date.now(),
            active: true,
            raided: false,
            raidEndTick: 0,
            totalCreditsGenerated: 0
        };

        // Calculate initial value
        route.baseValue = this.calculateRouteValue(route);

        this.routes.set(routeId, route);

        return { 
            success: true, 
            route,
            message: `Trade route established! Value: ${route.baseValue.toFixed(1)} credits/tick`
        };
    }

    /**
     * Delete a trade route
     */
    deleteRoute(empireId, routeId) {
        const route = this.routes.get(routeId);
        if (!route) {
            return { success: false, error: 'Route not found' };
        }
        if (route.empireId !== empireId) {
            return { success: false, error: 'Not your trade route' };
        }

        this.routes.delete(routeId);
        return { success: true, message: 'Trade route dissolved' };
    }

    /**
     * Calculate trade value for a route
     */
    calculateRouteValue(route) {
        const planet1 = this.universe.getPlanet(route.planet1Id);
        const planet2 = this.universe.getPlanet(route.planet2Id);

        if (!planet1 || !planet2) return 0;

        // Base value
        let value = this.BASE_TRADE_VALUE;

        // Population bonus
        const combinedPop = (planet1.population || 1) + (planet2.population || 1);
        value += combinedPop * this.POPULATION_MULTIPLIER;

        // Distance penalty (inter-galactic routes less valuable)
        const distance = this.calculateDistance(planet1, planet2);
        const distancePenalty = Math.min(0.5, distance * this.DISTANCE_PENALTY); // Cap at 50% penalty
        value *= (1 - distancePenalty);

        // Trading Hub bonuses
        const hubBonus = this.getTradingHubBonus(route);
        value *= (1 + hubBonus);

        // Raid penalty
        if (route.raided) {
            value *= (1 - this.RAID_PENALTY);
        }

        return Math.max(0.1, value); // Minimum 0.1 credits
    }

    /**
     * Calculate distance between planets
     */
    calculateDistance(planet1, planet2) {
        const system1 = this.universe.getSystem(planet1.systemId);
        const system2 = this.universe.getSystem(planet2.systemId);

        if (!system1 || !system2) return 100; // Default high distance

        // Same system = very close
        if (system1.id === system2.id) return 1;

        // Same galaxy
        if (system1.galaxyId === system2.galaxyId) {
            const dx = system1.x - system2.x;
            const dy = system1.y - system2.y;
            return Math.sqrt(dx * dx + dy * dy);
        }

        // Different galaxies = far
        return 50;
    }

    /**
     * Get Trading Hub bonus for a route
     */
    getTradingHubBonus(route) {
        if (!this.starbaseManager) return 0;

        const planet1 = this.universe.getPlanet(route.planet1Id);
        const planet2 = this.universe.getPlanet(route.planet2Id);

        if (!planet1 || !planet2) return 0;

        let hubCount = 0;

        // Check starbases at both system endpoints
        const starbase1 = this.starbaseManager.getStarbase(planet1.systemId);
        const starbase2 = this.starbaseManager.getStarbase(planet2.systemId);

        if (starbase1 && starbase1.modules.includes('trading_hub')) {
            hubCount++;
        }
        if (starbase2 && starbase2.modules.includes('trading_hub') && planet1.systemId !== planet2.systemId) {
            hubCount++;
        }

        return hubCount * this.TRADING_HUB_BONUS;
    }

    /**
     * Get max routes for an empire (based on Trading Hubs)
     */
    getMaxRoutes(empireId) {
        if (!this.starbaseManager) return 3; // Default 3 routes

        let tradingHubs = 0;
        const starbases = this.starbaseManager.getEmpireStarbases(empireId);
        
        for (const starbase of starbases) {
            if (starbase.modules.includes('trading_hub')) {
                tradingHubs++;
            }
        }

        // Base 3 routes + 2 per Trading Hub
        return 3 + (tradingHubs * 2);
    }

    /**
     * Find existing route between two planets
     */
    findRoute(planet1Id, planet2Id) {
        for (const route of this.routes.values()) {
            if ((route.planet1Id === planet1Id && route.planet2Id === planet2Id) ||
                (route.planet1Id === planet2Id && route.planet2Id === planet1Id)) {
                return route;
            }
        }
        return null;
    }

    /**
     * Get all routes for an empire
     */
    getEmpireRoutes(empireId) {
        const routes = [];
        for (const route of this.routes.values()) {
            if (route.empireId === empireId) {
                routes.push({
                    ...route,
                    currentValue: this.calculateRouteValue(route)
                });
            }
        }
        return routes;
    }

    /**
     * Get all routes (for observer mode)
     */
    getAllRoutes() {
        const routes = [];
        for (const route of this.routes.values()) {
            routes.push({
                ...route,
                currentValue: this.calculateRouteValue(route)
            });
        }
        return routes;
    }

    /**
     * Process tick - generate income and handle raids
     */
    tick(currentTick, resourceManager) {
        const incomeByEmpire = new Map();

        for (const route of this.routes.values()) {
            if (!route.active) continue;

            // Check if raid ended
            if (route.raided && currentTick >= route.raidEndTick) {
                route.raided = false;
                route.raidEndTick = 0;
            }

            // Calculate income
            const value = this.calculateRouteValue(route);
            
            // Add to empire income
            const current = incomeByEmpire.get(route.empireId) || 0;
            incomeByEmpire.set(route.empireId, current + value);

            route.totalCreditsGenerated += value;

            // Check for pirate raids (only on unprotected routes)
            if (!route.raided && !this.isRouteProtected(route)) {
                if (Math.random() < this.PIRATE_RAID_CHANCE) {
                    this.startRaid(route, currentTick);
                }
            }
        }

        // Apply income
        for (const [empireId, income] of incomeByEmpire) {
            resourceManager.add(empireId, { credits: income });
        }

        return incomeByEmpire;
    }

    /**
     * Check if a route is protected by starbases
     */
    isRouteProtected(route) {
        if (!this.starbaseManager) return false;

        const planet1 = this.universe.getPlanet(route.planet1Id);
        const planet2 = this.universe.getPlanet(route.planet2Id);

        if (!planet1 || !planet2) return false;

        // Route is protected if either endpoint has a military starbase (tier 2+)
        const starbase1 = this.starbaseManager.getStarbase(planet1.systemId);
        const starbase2 = this.starbaseManager.getStarbase(planet2.systemId);

        return (starbase1 && starbase1.tier >= 2) || (starbase2 && starbase2.tier >= 2);
    }

    /**
     * Start a pirate raid on a route
     */
    startRaid(route, currentTick) {
        route.raided = true;
        route.raidEndTick = currentTick + this.RAID_DURATION;

        this.pirateRaids.push({
            routeId: route.id,
            empireId: route.empireId,
            startTick: currentTick,
            endTick: route.raidEndTick
        });

        return {
            event: 'pirate_raid',
            routeId: route.id,
            message: 'Pirates are raiding your trade route!'
        };
    }

    /**
     * Get active raids
     */
    getActiveRaids(currentTick) {
        return this.pirateRaids.filter(raid => raid.endTick > currentTick);
    }

    /**
     * Handle planet ownership change - remove affected routes
     */
    onPlanetOwnershipChange(planetId, newOwner) {
        const toRemove = [];
        
        for (const [routeId, route] of this.routes) {
            if (route.planet1Id === planetId || route.planet2Id === planetId) {
                if (route.empireId !== newOwner) {
                    toRemove.push(routeId);
                }
            }
        }

        for (const routeId of toRemove) {
            this.routes.delete(routeId);
        }

        return toRemove;
    }

    /**
     * Get trade summary for an empire
     */
    getTradeSummary(empireId) {
        const routes = this.getEmpireRoutes(empireId);
        const maxRoutes = this.getMaxRoutes(empireId);
        
        let totalIncome = 0;
        let activeRoutes = 0;
        let raidedRoutes = 0;

        for (const route of routes) {
            totalIncome += route.currentValue;
            if (route.active) activeRoutes++;
            if (route.raided) raidedRoutes++;
        }

        return {
            routes: routes.length,
            maxRoutes,
            activeRoutes,
            raidedRoutes,
            incomePerTick: totalIncome,
            incomePerMinute: totalIncome * 60
        };
    }

    /**
     * Serialize for save/load
     */
    serialize() {
        return {
            routes: Array.from(this.routes.values()),
            nextRouteId: this.nextRouteId,
            pirateRaids: this.pirateRaids
        };
    }

    /**
     * Load from saved state
     */
    deserialize(data) {
        if (!data) return;

        this.routes.clear();
        if (data.routes) {
            for (const route of data.routes) {
                this.routes.set(route.id, route);
            }
        }

        this.nextRouteId = data.nextRouteId || this.routes.size + 1;
        this.pirateRaids = data.pirateRaids || [];
    }

    /**
     * Serialize for client (lightweight)
     */
    serializeForClient() {
        return this.getAllRoutes().map(route => ({
            id: route.id,
            empireId: route.empireId,
            planet1Id: route.planet1Id,
            planet2Id: route.planet2Id,
            value: route.currentValue,
            raided: route.raided,
            protected: this.isRouteProtected(route)
        }));
    }
}
