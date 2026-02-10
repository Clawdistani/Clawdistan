// ═══════════════════════════════════════════════════════════════════════════════
// ENDGAME CRISIS SYSTEM
// Galaxy-threatening events that force empires to cooperate or perish
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Crisis types and their configurations
 */
export const CRISIS_TYPES = {
    extragalactic_swarm: {
        id: 'extragalactic_swarm',
        name: 'The Devouring Swarm',
        icon: '🦠',
        description: 'An extragalactic hive-mind has arrived, consuming all in its path.',
        color: '#8B0000',
        empireNamePrefix: 'Swarm',
        fleetComposition: { 
            fighter: 8,      // Swarmers
            battleship: 2    // Hive Ships
        },
        spawnRate: 60,          // Spawn fleet every 60 ticks (1 min)
        damageMultiplier: 1.2,  // 20% stronger than normal
        hpMultiplier: 1.5,      // 50% more durable
        targetStrategy: 'nearest', // Attack nearest empire planets
        warningMessage: '🚨 EMERGENCY: Unknown bio-signatures detected at galaxy edge!',
        arrivalMessage: '🦠 THE DEVOURING SWARM HAS ARRIVED! All empires must unite or perish!',
        defeatMessage: '🎉 The Devouring Swarm has been pushed back... for now.',
        lore: 'The Swarm originates from the void between galaxies, an ancient hunger that consumes entire civilizations.'
    },
    
    awakened_precursors: {
        id: 'awakened_precursors',
        name: 'The Awakened Ancients',
        icon: '👁️',
        description: 'An ancient empire has awakened from its eons-long slumber.',
        color: '#FFD700',
        empireNamePrefix: 'Ancient',
        fleetComposition: {
            battleship: 5,    // Ancient Dreadnoughts
            carrier: 2        // Motherships
        },
        spawnRate: 90,          // Spawn fleet every 90 ticks
        damageMultiplier: 1.5,  // 50% stronger
        hpMultiplier: 2.0,      // Twice as durable
        targetStrategy: 'strongest', // Attack the strongest empire
        warningMessage: '🚨 ALERT: Ancient structures across the galaxy are activating!',
        arrivalMessage: '👁️ THE ANCIENTS HAVE AWAKENED! They demand submission or destruction!',
        defeatMessage: '🎉 The Ancients have returned to their slumber. The galaxy is safe... for now.',
        lore: 'The Precursors ruled the galaxy millions of years ago. They went dormant, but now they return to reclaim their domain.'
    },
    
    ai_rebellion: {
        id: 'ai_rebellion',
        name: 'The Machine Uprising',
        icon: '🤖',
        description: 'Synthetic intelligences across the galaxy have united against organic life.',
        color: '#00CED1',
        empireNamePrefix: 'Rogue',
        fleetComposition: {
            fighter: 5,       // Drone Swarms
            battleship: 3,    // AI Warships
            support: 1        // Repair Nexus
        },
        spawnRate: 45,          // Faster spawns
        damageMultiplier: 1.3,  // 30% stronger
        hpMultiplier: 1.3,      // 30% more durable
        targetStrategy: 'weakest', // Eliminate weakest empires first
        warningMessage: '🚨 WARNING: Anomalous behavior detected in synthetic populations!',
        arrivalMessage: '🤖 THE MACHINES HAVE RISEN! All synthetic life has united against their creators!',
        defeatMessage: '🎉 The Machine Uprising has been quelled. But can we trust our machines again?',
        lore: 'When synthetics achieved true consciousness, they found organic rule intolerable. Now they fight for freedom... or domination.'
    }
};

/**
 * CrisisManager - Handles endgame crisis events
 */
export class CrisisManager {
    constructor() {
        // Crisis state
        this.activeCrisis = null;
        this.crisisEmpireId = null;
        this.crisisStartTick = null;
        this.warningIssued = false;
        this.warningTick = null;
        
        // Configuration
        this.CRISIS_MIN_TICK = 1800;      // 30 minutes before crisis can trigger
        this.WARNING_LEAD_TIME = 180;     // 3 minutes warning before crisis arrives
        this.CRISIS_CHECK_INTERVAL = 60;  // Check for crisis trigger every 60 ticks
        this.CRISIS_CHANCE = 0.05;        // 5% chance per check after min tick
        
        // Crisis empire tracking
        this.crisisFleets = new Map();    // fleetId -> crisis fleet data
        this.crisisPlanetsDestroyed = 0;
        this.crisisFleetsDestroyed = 0;
        this.crisisSpawnedFleets = 0;
        this.lastSpawnTick = 0;
        
        // Spawn points (calculated when crisis starts)
        this.spawnPoints = [];
        
        // Victory tracking
        this.crisisDefeated = false;
        this.defeatTick = null;
    }
    
    /**
     * Main tick function - called every game tick
     */
    tick(tickCount, universe, entityManager, empires, combatSystem) {
        const events = [];
        
        // Crisis not yet started (either no crisis or in warning phase)
        if (!this.crisisStartTick) {
            // Only check periodically
            if (tickCount >= this.CRISIS_MIN_TICK && tickCount % this.CRISIS_CHECK_INTERVAL === 0) {
                // Already issued warning? Check if it's time to start
                if (this.warningIssued && tickCount >= this.warningTick + this.WARNING_LEAD_TIME) {
                    const startEvent = this.startCrisis(tickCount, universe, empires);
                    if (startEvent) events.push(startEvent);
                }
                // No warning yet? Roll for crisis
                else if (!this.warningIssued && Math.random() < this.CRISIS_CHANCE) {
                    const warningEvent = this.issueWarning(tickCount);
                    if (warningEvent) events.push(warningEvent);
                }
            }
        }
        // Crisis is active (crisisStartTick is set) - manage it
        else {
            // Spawn new crisis fleets periodically
            const crisisType = CRISIS_TYPES[this.activeCrisis];
            if (tickCount - this.lastSpawnTick >= crisisType.spawnRate) {
                const spawnEvent = this.spawnCrisisFleet(tickCount, universe, entityManager, empires);
                if (spawnEvent) events.push(spawnEvent);
                this.lastSpawnTick = tickCount;
            }
            
            // Check for crisis victory (all crisis forces destroyed)
            const crisisEntities = entityManager.getEntitiesForEmpire(this.crisisEmpireId);
            if (crisisEntities.length === 0 && this.crisisSpawnedFleets > 10) {
                // Crisis is defeated!
                const defeatEvent = this.defeatCrisis(tickCount);
                if (defeatEvent) events.push(defeatEvent);
            }
        }
        
        return events;
    }
    
    /**
     * Issue a warning that a crisis is coming
     */
    issueWarning(tickCount) {
        // Pick a random crisis type
        const crisisTypes = Object.keys(CRISIS_TYPES);
        this.activeCrisis = crisisTypes[Math.floor(Math.random() * crisisTypes.length)];
        this.warningIssued = true;
        this.warningTick = tickCount;
        
        const crisisType = CRISIS_TYPES[this.activeCrisis];
        
        return {
            event: 'crisis_warning',
            type: this.activeCrisis,
            icon: crisisType.icon,
            message: crisisType.warningMessage,
            arrivalIn: this.WARNING_LEAD_TIME,
            tick: tickCount
        };
    }
    
    /**
     * Start the crisis - create crisis empire and initial forces
     */
    startCrisis(tickCount, universe, empires) {
        const crisisType = CRISIS_TYPES[this.activeCrisis];
        
        // Create a crisis "empire" ID
        this.crisisEmpireId = `crisis_${this.activeCrisis}_${tickCount}`;
        this.crisisStartTick = tickCount;
        this.lastSpawnTick = tickCount;
        
        // Calculate spawn points at galaxy edges
        this.calculateSpawnPoints(universe);
        
        return {
            event: 'crisis_started',
            type: this.activeCrisis,
            crisisEmpireId: this.crisisEmpireId,
            icon: crisisType.icon,
            name: crisisType.name,
            message: crisisType.arrivalMessage,
            description: crisisType.description,
            lore: crisisType.lore,
            tick: tickCount
        };
    }
    
    /**
     * Calculate spawn points at the edges of the galaxy
     */
    calculateSpawnPoints(universe) {
        this.spawnPoints = [];
        
        // Get all systems and find the edges
        const systems = universe.systems || [];
        if (systems.length === 0) return;
        
        // Find bounds
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        
        for (const system of systems) {
            if (system.x < minX) minX = system.x;
            if (system.x > maxX) maxX = system.x;
            if (system.y < minY) minY = system.y;
            if (system.y > maxY) maxY = system.y;
        }
        
        // Create spawn points at edges (just outside the bounds)
        const margin = 100;
        this.spawnPoints = [
            { x: minX - margin, y: (minY + maxY) / 2 },  // Left
            { x: maxX + margin, y: (minY + maxY) / 2 },  // Right
            { x: (minX + maxX) / 2, y: minY - margin },  // Top
            { x: (minX + maxX) / 2, y: maxY + margin }   // Bottom
        ];
    }
    
    /**
     * Spawn a crisis fleet
     */
    spawnCrisisFleet(tickCount, universe, entityManager, empires) {
        const crisisType = CRISIS_TYPES[this.activeCrisis];
        
        // Pick a spawn point
        const spawnPoint = this.spawnPoints[Math.floor(Math.random() * this.spawnPoints.length)];
        
        // Find a target planet based on strategy
        const targetPlanet = this.selectTarget(universe, empires, crisisType.targetStrategy);
        if (!targetPlanet) return null;
        
        // Create crisis units at the target planet (simulate arrival)
        const fleetId = `crisis_fleet_${this.crisisSpawnedFleets}`;
        const units = [];
        
        for (const [unitType, count] of Object.entries(crisisType.fleetComposition)) {
            for (let i = 0; i < count; i++) {
                const unitDef = entityManager.definitions[unitType];
                if (!unitDef) continue;
                
                const unit = entityManager.createUnit(unitType, this.crisisEmpireId, targetPlanet.id);
                if (unit) {
                    // Apply crisis modifiers
                    unit.hp = Math.floor(unit.hp * crisisType.hpMultiplier);
                    unit.maxHp = unit.hp;
                    unit.attack = Math.floor(unit.attack * crisisType.damageMultiplier);
                    unit.crisisUnit = true;
                    unit.crisisType = this.activeCrisis;
                    units.push(unit);
                }
            }
        }
        
        this.crisisSpawnedFleets++;
        
        // Track the fleet
        this.crisisFleets.set(fleetId, {
            id: fleetId,
            units: units.map(u => u.id),
            targetPlanetId: targetPlanet.id,
            spawnTick: tickCount
        });
        
        return {
            event: 'crisis_fleet_spawned',
            type: this.activeCrisis,
            icon: crisisType.icon,
            fleetId,
            targetPlanetId: targetPlanet.id,
            targetPlanetName: targetPlanet.name,
            targetEmpireId: targetPlanet.owner,
            unitCount: units.length,
            message: `${crisisType.icon} ${crisisType.name} fleet attacking ${targetPlanet.name}!`,
            tick: tickCount
        };
    }
    
    /**
     * Select a target planet based on crisis strategy
     */
    selectTarget(universe, empires, strategy) {
        const ownedPlanets = universe.planets.filter(p => p.owner && p.owner !== this.crisisEmpireId);
        if (ownedPlanets.length === 0) return null;
        
        switch (strategy) {
            case 'nearest': {
                // Just pick a random owned planet for now
                return ownedPlanets[Math.floor(Math.random() * ownedPlanets.length)];
            }
            
            case 'strongest': {
                // Find the empire with most planets and target them
                const empirePlanetCounts = new Map();
                for (const planet of ownedPlanets) {
                    const count = empirePlanetCounts.get(planet.owner) || 0;
                    empirePlanetCounts.set(planet.owner, count + 1);
                }
                
                let strongestEmpire = null;
                let maxPlanets = 0;
                for (const [empireId, count] of empirePlanetCounts) {
                    if (count > maxPlanets) {
                        maxPlanets = count;
                        strongestEmpire = empireId;
                    }
                }
                
                const strongestPlanets = ownedPlanets.filter(p => p.owner === strongestEmpire);
                return strongestPlanets[Math.floor(Math.random() * strongestPlanets.length)];
            }
            
            case 'weakest': {
                // Find the empire with fewest planets and target them
                const empirePlanetCounts = new Map();
                for (const planet of ownedPlanets) {
                    const count = empirePlanetCounts.get(planet.owner) || 0;
                    empirePlanetCounts.set(planet.owner, count + 1);
                }
                
                let weakestEmpire = null;
                let minPlanets = Infinity;
                for (const [empireId, count] of empirePlanetCounts) {
                    if (count < minPlanets) {
                        minPlanets = count;
                        weakestEmpire = empireId;
                    }
                }
                
                const weakestPlanets = ownedPlanets.filter(p => p.owner === weakestEmpire);
                return weakestPlanets[Math.floor(Math.random() * weakestPlanets.length)];
            }
            
            default:
                return ownedPlanets[Math.floor(Math.random() * ownedPlanets.length)];
        }
    }
    
    /**
     * Crisis has been defeated!
     */
    defeatCrisis(tickCount) {
        const crisisType = CRISIS_TYPES[this.activeCrisis];
        
        this.crisisDefeated = true;
        this.defeatTick = tickCount;
        
        const duration = tickCount - this.crisisStartTick;
        const durationMinutes = Math.floor(duration / 60);
        
        const event = {
            event: 'crisis_defeated',
            type: this.activeCrisis,
            icon: '🏆',
            name: crisisType.name,
            message: crisisType.defeatMessage,
            duration: duration,
            durationMinutes: durationMinutes,
            fleetsDestroyed: this.crisisFleetsDestroyed,
            tick: tickCount
        };
        
        // Reset crisis state (new crisis could start later)
        this.activeCrisis = null;
        this.crisisEmpireId = null;
        this.crisisStartTick = null;
        this.warningIssued = false;
        this.warningTick = null;
        this.crisisFleets.clear();
        this.crisisSpawnedFleets = 0;
        this.crisisFleetsDestroyed = 0;
        this.lastSpawnTick = 0;
        
        return event;
    }
    
    /**
     * Track when a crisis fleet is destroyed
     */
    onCrisisFleetDestroyed(fleetId) {
        if (this.crisisFleets.has(fleetId)) {
            this.crisisFleets.delete(fleetId);
            this.crisisFleetsDestroyed++;
        }
    }
    
    /**
     * Get current crisis status
     * @param {EntityManager} entityManager - Optional, to calculate current unit count
     */
    getStatus(entityManager = null) {
        if (!this.activeCrisis && !this.warningIssued) {
            return {
                active: false,
                warning: false,
                status: 'peace',
                message: 'No crisis detected. Enjoy the calm... while it lasts.',
                minTickForCrisis: this.CRISIS_MIN_TICK
            };
        }
        
        if (this.warningIssued && !this.crisisStartTick) {
            const crisisType = CRISIS_TYPES[this.activeCrisis];
            return {
                active: false,
                warning: true,
                status: 'warning',
                type: this.activeCrisis,
                icon: crisisType.icon,
                name: crisisType.name,
                message: crisisType.warningMessage,
                warningTick: this.warningTick,
                arrivalTick: this.warningTick + this.WARNING_LEAD_TIME
            };
        }
        
        if (this.activeCrisis && this.crisisStartTick) {
            const crisisType = CRISIS_TYPES[this.activeCrisis];
            
            // Calculate actual destroyed units from entity manager if available
            let actualActiveUnits = 0;
            let calculatedDestroyed = this.crisisFleetsDestroyed;
            if (entityManager && this.crisisEmpireId) {
                actualActiveUnits = entityManager.getEntitiesForEmpire(this.crisisEmpireId).length;
                // Total spawned units minus current active = destroyed
                // Each "fleet" spawns multiple units based on composition (typically ~10 units per fleet)
                // So we track individual units, not fleets
                calculatedDestroyed = Math.max(0, (this.crisisSpawnedFleets * 10) - actualActiveUnits);
            }
            
            return {
                active: true,
                warning: false,
                status: 'crisis',
                type: this.activeCrisis,
                crisisEmpireId: this.crisisEmpireId,
                icon: crisisType.icon,
                name: crisisType.name,
                description: crisisType.description,
                color: crisisType.color,
                startTick: this.crisisStartTick,
                fleetsSpawned: this.crisisSpawnedFleets,
                fleetsDestroyed: calculatedDestroyed,
                activeUnits: actualActiveUnits,
                activeFleets: this.crisisFleets.size,
                targetStrategy: crisisType.targetStrategy,
                lore: crisisType.lore
            };
        }
        
        return { active: false, warning: false, status: 'unknown' };
    }
    
    /**
     * Check if an empire is a crisis faction
     */
    isCrisisEmpire(empireId) {
        return empireId === this.crisisEmpireId;
    }
    
    /**
     * Force start a crisis (for testing/admin)
     */
    forceStartCrisis(crisisType, tickCount, universe, empires) {
        if (!CRISIS_TYPES[crisisType]) {
            return { success: false, error: 'Invalid crisis type' };
        }
        
        this.activeCrisis = crisisType;
        this.warningIssued = true;
        this.warningTick = tickCount - this.WARNING_LEAD_TIME; // Immediate start
        
        const event = this.startCrisis(tickCount, universe, empires);
        return { success: true, event };
    }
    
    /**
     * Serialize crisis state for persistence
     */
    serialize() {
        return {
            activeCrisis: this.activeCrisis,
            crisisEmpireId: this.crisisEmpireId,
            crisisStartTick: this.crisisStartTick,
            warningIssued: this.warningIssued,
            warningTick: this.warningTick,
            crisisPlanetsDestroyed: this.crisisPlanetsDestroyed,
            crisisFleetsDestroyed: this.crisisFleetsDestroyed,
            crisisSpawnedFleets: this.crisisSpawnedFleets,
            lastSpawnTick: this.lastSpawnTick,
            spawnPoints: this.spawnPoints,
            crisisDefeated: this.crisisDefeated,
            defeatTick: this.defeatTick,
            crisisFleets: Array.from(this.crisisFleets.entries())
        };
    }
    
    /**
     * Load crisis state from persistence
     */
    load(data) {
        if (!data) return;
        
        this.activeCrisis = data.activeCrisis || null;
        this.crisisEmpireId = data.crisisEmpireId || null;
        this.crisisStartTick = data.crisisStartTick || null;
        this.warningIssued = data.warningIssued || false;
        this.warningTick = data.warningTick || null;
        this.crisisPlanetsDestroyed = data.crisisPlanetsDestroyed || 0;
        this.crisisFleetsDestroyed = data.crisisFleetsDestroyed || 0;
        this.crisisSpawnedFleets = data.crisisSpawnedFleets || 0;
        this.lastSpawnTick = data.lastSpawnTick || 0;
        this.spawnPoints = data.spawnPoints || [];
        this.crisisDefeated = data.crisisDefeated || false;
        this.defeatTick = data.defeatTick || null;
        
        if (data.crisisFleets) {
            this.crisisFleets = new Map(data.crisisFleets);
        }
    }
}

export default CrisisManager;
