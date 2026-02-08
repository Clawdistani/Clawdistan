/**
 * EspionageManager - Handles spy deployment, intel gathering, sabotage, and counter-intel
 * 
 * MECHANICS:
 * - Spies infiltrate enemy planets and can perform missions
 * - Detection chance increases over time and with counter-intel structures
 * - Caught spies cause diplomatic incidents
 * - Intel reveals enemy resources, tech, and fleet positions
 */

let missionIdCounter = 0;

export class EspionageManager {
    constructor() {
        // Active spies: Map<spyId, SpyData>
        this.spies = new Map();
        
        // Completed missions log for history/UI
        this.missionLog = [];
        
        // Empire intel data: what each empire knows about others
        this.intel = new Map();  // Map<empireId, Map<targetEmpireId, IntelData>>
        
        // Counter-intel levels: how good each empire is at detecting spies
        this.counterIntelLevels = new Map();  // Map<empireId, number>
    }
    
    /**
     * MISSION TYPES:
     * 
     * gather_intel - Reveals enemy resources, tech progress, and unit counts
     * sabotage_structure - Damages a random enemy structure
     * sabotage_production - Temporarily reduces resource production
     * steal_tech - Chance to steal an enemy's researched tech
     * incite_unrest - Reduces enemy planet population/morale
     */
    static MISSION_TYPES = {
        gather_intel: {
            name: 'Gather Intelligence',
            description: 'Reveal enemy resources, technologies, and military strength',
            baseDuration: 30,  // ticks to complete
            baseDetectionChance: 0.1,  // 10% chance per tick to be detected
            baseSuccessChance: 0.8,    // 80% success if not detected
            effects: {
                revealResources: true,
                revealTech: true,
                revealUnits: true,
                revealFleets: true
            },
            icon: '🔍'
        },
        sabotage_structure: {
            name: 'Sabotage Structure',
            description: 'Damage or destroy an enemy building',
            baseDuration: 45,
            baseDetectionChance: 0.15,
            baseSuccessChance: 0.6,
            effects: {
                structureDamage: { min: 30, max: 80 }  // HP damage
            },
            icon: '💥'
        },
        sabotage_production: {
            name: 'Disrupt Production',
            description: 'Temporarily reduce enemy resource output',
            baseDuration: 40,
            baseDetectionChance: 0.12,
            baseSuccessChance: 0.7,
            effects: {
                productionPenalty: 0.25,  // 25% reduction
                penaltyDuration: 60       // ticks
            },
            icon: '⚙️'
        },
        steal_tech: {
            name: 'Steal Technology',
            description: 'Attempt to steal an enemy research breakthrough',
            baseDuration: 60,
            baseDetectionChance: 0.2,
            baseSuccessChance: 0.4,  // Hard to pull off
            effects: {
                stealTech: true
            },
            icon: '🧪'
        },
        incite_unrest: {
            name: 'Incite Unrest',
            description: 'Stir rebellion, reducing planet population',
            baseDuration: 50,
            baseDetectionChance: 0.15,
            baseSuccessChance: 0.5,
            effects: {
                populationLoss: { min: 5, max: 15 }  // % of planet pop
            },
            icon: '📢'
        }
    };
    
    /**
     * Deploy a spy to an enemy planet
     */
    deployspy(spyEntityId, empireId, targetPlanetId, universe, entityManager) {
        const spy = entityManager.getEntity(spyEntityId);
        if (!spy || spy.owner !== empireId || spy.defName !== 'spy') {
            return { success: false, error: 'Invalid spy unit' };
        }
        
        const targetPlanet = universe.getPlanet(targetPlanetId);
        if (!targetPlanet) {
            return { success: false, error: 'Target planet not found' };
        }
        
        if (targetPlanet.owner === empireId) {
            return { success: false, error: 'Cannot spy on your own planet' };
        }
        
        if (!targetPlanet.owner) {
            return { success: false, error: 'Cannot spy on unclaimed planets' };
        }
        
        // Check if spy is already deployed
        if (this.spies.has(spyEntityId)) {
            return { success: false, error: 'Spy is already on a mission' };
        }
        
        // Create spy deployment record
        const spyData = {
            id: spyEntityId,
            empireId: empireId,
            targetEmpireId: targetPlanet.owner,
            targetPlanetId: targetPlanetId,
            planetName: targetPlanet.name,
            status: 'infiltrating',  // infiltrating -> embedded -> mission -> exfiltrating
            deployedTick: null,  // Set when tick() is called
            embeddedTick: null,
            mission: null,
            missionStartTick: null,
            missionProgress: 0,
            coverStrength: 100,  // Degrades over time, affects detection
            detected: false
        };
        
        this.spies.set(spyEntityId, spyData);
        
        // Remove spy from normal entity tracking (it's now covert)
        spy.location = null;
        spy.covert = true;
        spy.infiltratingPlanet = targetPlanetId;
        
        return { 
            success: true, 
            message: `Spy deployed to ${targetPlanet.name}`,
            spyId: spyEntityId
        };
    }
    
    /**
     * Assign a mission to an embedded spy
     */
    assignMission(spyEntityId, empireId, missionType) {
        const spyData = this.spies.get(spyEntityId);
        if (!spyData) {
            return { success: false, error: 'Spy not found or not deployed' };
        }
        
        if (spyData.empireId !== empireId) {
            return { success: false, error: 'This spy belongs to another empire' };
        }
        
        if (spyData.status !== 'embedded') {
            return { success: false, error: `Spy is currently ${spyData.status}, cannot assign mission` };
        }
        
        if (spyData.mission) {
            return { success: false, error: 'Spy already has an active mission' };
        }
        
        const missionDef = EspionageManager.MISSION_TYPES[missionType];
        if (!missionDef) {
            return { success: false, error: 'Unknown mission type' };
        }
        
        spyData.mission = missionType;
        spyData.status = 'mission';
        spyData.missionProgress = 0;
        // missionStartTick will be set by tick()
        
        return {
            success: true,
            message: `${missionDef.name} mission assigned`,
            missionType,
            estimatedDuration: missionDef.baseDuration
        };
    }
    
    /**
     * Recall a spy (extract them)
     */
    recallSpy(spyEntityId, empireId, entityManager) {
        const spyData = this.spies.get(spyEntityId);
        if (!spyData) {
            return { success: false, error: 'Spy not found' };
        }
        
        if (spyData.empireId !== empireId) {
            return { success: false, error: 'This spy belongs to another empire' };
        }
        
        // Start extraction
        if (spyData.status === 'mission') {
            // Abort current mission
            spyData.mission = null;
            spyData.missionProgress = 0;
        }
        
        spyData.status = 'exfiltrating';
        
        return {
            success: true,
            message: 'Spy extraction initiated'
        };
    }
    
    /**
     * Update counter-intel level for an empire
     * Higher levels = better at detecting enemy spies
     */
    updateCounterIntel(empireId, level) {
        this.counterIntelLevels.set(empireId, Math.max(0, level));
    }
    
    /**
     * Calculate counter-intel level based on structures and tech
     */
    calculateCounterIntel(empireId, entityManager, techTree) {
        let level = 0;
        
        // Intelligence agencies add counter-intel
        const entities = entityManager.getEntitiesForEmpire(empireId);
        const agencies = entities.filter(e => e.defName === 'intelligence_agency');
        level += agencies.length * 15;  // Each agency adds 15
        
        // Counter-intel tech adds bonus
        if (techTree.hasResearched(empireId, 'counter_intelligence')) {
            level += 25;
        }
        if (techTree.hasResearched(empireId, 'advanced_counter_intel')) {
            level += 40;
        }
        
        this.counterIntelLevels.set(empireId, level);
        return level;
    }
    
    /**
     * Process espionage actions each tick
     */
    tick(currentTick, entityManager, resourceManager, techTree, universe, diplomacy) {
        const events = [];
        const toRemove = [];
        
        for (const [spyId, spyData] of this.spies) {
            // Check spy still exists
            const spy = entityManager.getEntity(spyId);
            if (!spy) {
                toRemove.push(spyId);
                continue;
            }
            
            const targetCounterIntel = this.counterIntelLevels.get(spyData.targetEmpireId) || 0;
            
            switch (spyData.status) {
                case 'infiltrating':
                    // Spy is traveling to target - takes 10 ticks
                    if (!spyData.deployedTick) {
                        spyData.deployedTick = currentTick;
                    }
                    
                    if (currentTick - spyData.deployedTick >= 10) {
                        spyData.status = 'embedded';
                        spyData.embeddedTick = currentTick;
                        events.push({
                            type: 'spy_embedded',
                            empireId: spyData.empireId,
                            targetEmpireId: spyData.targetEmpireId,
                            planetName: spyData.planetName,
                            message: `Spy successfully embedded on ${spyData.planetName}`,
                            icon: '🕵️'
                        });
                    }
                    break;
                    
                case 'embedded':
                    // Spy is waiting for orders - cover degrades slowly
                    spyData.coverStrength = Math.max(0, spyData.coverStrength - 0.5);
                    
                    // Detection check
                    if (this.checkDetection(spyData, targetCounterIntel, 0.02)) {
                        const incident = this.handleDetection(spyData, spy, entityManager, diplomacy);
                        events.push(incident);
                        toRemove.push(spyId);
                    }
                    break;
                    
                case 'mission':
                    // Spy is executing a mission
                    if (!spyData.missionStartTick) {
                        spyData.missionStartTick = currentTick;
                    }
                    
                    const missionDef = EspionageManager.MISSION_TYPES[spyData.mission];
                    spyData.missionProgress++;
                    spyData.coverStrength = Math.max(0, spyData.coverStrength - 1);  // Faster degradation
                    
                    // Higher detection chance during missions
                    const missionDetectionChance = missionDef.baseDetectionChance * 
                        (1 + targetCounterIntel / 100) * 
                        (1 - spyData.coverStrength / 200);
                    
                    if (this.checkDetection(spyData, targetCounterIntel, missionDetectionChance)) {
                        const incident = this.handleDetection(spyData, spy, entityManager, diplomacy);
                        events.push(incident);
                        toRemove.push(spyId);
                        break;
                    }
                    
                    // Check mission completion
                    if (spyData.missionProgress >= missionDef.baseDuration) {
                        // Success roll
                        const successChance = missionDef.baseSuccessChance * 
                            (spyData.coverStrength / 100);
                        
                        if (Math.random() < successChance) {
                            // Mission success!
                            const result = this.executeMission(
                                spyData, 
                                missionDef, 
                                entityManager, 
                                resourceManager, 
                                techTree,
                                universe
                            );
                            events.push({
                                type: 'mission_success',
                                empireId: spyData.empireId,
                                targetEmpireId: spyData.targetEmpireId,
                                missionType: spyData.mission,
                                planetName: spyData.planetName,
                                message: result.message,
                                data: result.data,
                                icon: missionDef.icon
                            });
                            
                            // Log mission
                            this.logMission(spyData, true, result);
                        } else {
                            // Mission failed (but not detected)
                            events.push({
                                type: 'mission_failed',
                                empireId: spyData.empireId,
                                targetEmpireId: spyData.targetEmpireId,
                                missionType: spyData.mission,
                                planetName: spyData.planetName,
                                message: `${missionDef.name} failed on ${spyData.planetName}`,
                                icon: '❌'
                            });
                            
                            this.logMission(spyData, false, { message: 'Mission failed' });
                        }
                        
                        // Reset to embedded
                        spyData.mission = null;
                        spyData.missionProgress = 0;
                        spyData.missionStartTick = null;
                        spyData.status = 'embedded';
                        spyData.coverStrength = Math.max(20, spyData.coverStrength - 20);
                    }
                    break;
                    
                case 'exfiltrating':
                    // Spy is extracting - takes 5 ticks
                    if (!spyData.extractionStartTick) {
                        spyData.extractionStartTick = currentTick;
                    }
                    
                    // Can still be detected during extraction
                    if (this.checkDetection(spyData, targetCounterIntel, 0.05)) {
                        const incident = this.handleDetection(spyData, spy, entityManager, diplomacy);
                        events.push(incident);
                        toRemove.push(spyId);
                        break;
                    }
                    
                    if (currentTick - spyData.extractionStartTick >= 5) {
                        // Successfully extracted
                        const homePlanet = this.findHomePlanet(spyData.empireId, universe);
                        if (homePlanet) {
                            spy.location = homePlanet.id;
                        }
                        spy.covert = false;
                        spy.infiltratingPlanet = null;
                        
                        events.push({
                            type: 'spy_extracted',
                            empireId: spyData.empireId,
                            planetName: spyData.planetName,
                            message: `Spy successfully extracted from ${spyData.planetName}`,
                            icon: '🏃'
                        });
                        
                        toRemove.push(spyId);
                    }
                    break;
            }
        }
        
        // Clean up removed spies
        for (const spyId of toRemove) {
            this.spies.delete(spyId);
        }
        
        return events;
    }
    
    /**
     * Check if spy is detected
     */
    checkDetection(spyData, counterIntelLevel, baseChance) {
        const coverModifier = 1 - (spyData.coverStrength / 150);
        const counterIntelModifier = 1 + (counterIntelLevel / 100);
        const detectionChance = baseChance * coverModifier * counterIntelModifier;
        
        return Math.random() < detectionChance;
    }
    
    /**
     * Handle spy detection
     */
    handleDetection(spyData, spy, entityManager, diplomacy) {
        spyData.detected = true;
        
        // Spy is captured/killed
        entityManager.removeEntity(spy.id);
        
        // Diplomatic incident
        if (diplomacy) {
            diplomacy.recordIncident(
                spyData.empireId, 
                spyData.targetEmpireId, 
                'espionage',
                -30  // Relation penalty
            );
        }
        
        return {
            type: 'spy_detected',
            empireId: spyData.empireId,
            targetEmpireId: spyData.targetEmpireId,
            planetName: spyData.planetName,
            message: `Spy captured on ${spyData.planetName}! Diplomatic incident!`,
            icon: '🚨',
            diplomaticPenalty: -30
        };
    }
    
    /**
     * Execute a successful mission
     */
    executeMission(spyData, missionDef, entityManager, resourceManager, techTree, universe) {
        const result = {
            message: '',
            data: {}
        };
        
        const effects = missionDef.effects;
        
        // Gather Intel mission
        if (effects.revealResources || effects.revealTech || effects.revealUnits) {
            const intel = this.gatherIntel(
                spyData.empireId,
                spyData.targetEmpireId,
                entityManager,
                resourceManager,
                techTree,
                effects
            );
            result.data.intel = intel;
            result.message = `Intelligence gathered on ${spyData.planetName}`;
        }
        
        // Sabotage structure
        if (effects.structureDamage) {
            const damage = this.sabotageStructure(
                spyData.targetEmpireId,
                spyData.targetPlanetId,
                effects.structureDamage,
                entityManager
            );
            result.data.damage = damage;
            result.message = damage.destroyed 
                ? `${damage.structureName} destroyed on ${spyData.planetName}!`
                : `${damage.structureName} damaged on ${spyData.planetName} (${damage.damage} HP)`;
        }
        
        // Production sabotage
        if (effects.productionPenalty) {
            // Apply temporary production penalty
            resourceManager.applyTemporaryPenalty(
                spyData.targetEmpireId,
                effects.productionPenalty,
                effects.penaltyDuration
            );
            result.data.productionPenalty = effects.productionPenalty;
            result.message = `Production disrupted on ${spyData.planetName} (${effects.productionPenalty * 100}% reduction)`;
        }
        
        // Steal tech
        if (effects.stealTech) {
            const stolenTech = this.stealTechnology(
                spyData.empireId,
                spyData.targetEmpireId,
                techTree
            );
            if (stolenTech) {
                result.data.stolenTech = stolenTech;
                result.message = `Stole "${stolenTech.name}" technology from ${spyData.planetName}!`;
            } else {
                result.message = `No stealable technologies found`;
            }
        }
        
        // Incite unrest
        if (effects.populationLoss) {
            const planet = universe.getPlanet(spyData.targetPlanetId);
            if (planet && planet.population) {
                const lossPercent = effects.populationLoss.min + 
                    Math.random() * (effects.populationLoss.max - effects.populationLoss.min);
                const populationLost = Math.floor(planet.population * lossPercent / 100);
                planet.population = Math.max(1, planet.population - populationLost);
                result.data.populationLost = populationLost;
                result.message = `Unrest on ${spyData.planetName}! ${populationLost} population lost`;
            }
        }
        
        return result;
    }
    
    /**
     * Gather intel on target empire
     */
    gatherIntel(spyEmpireId, targetEmpireId, entityManager, resourceManager, techTree, effects) {
        const intel = {
            empireId: targetEmpireId,
            gatheredAt: Date.now(),
            expiresAt: Date.now() + (3600 * 1000)  // Intel expires after 1 hour
        };
        
        if (effects.revealResources) {
            intel.resources = resourceManager.getResources(targetEmpireId);
        }
        
        if (effects.revealTech) {
            intel.technologies = techTree.getResearched(targetEmpireId);
            intel.currentResearch = techTree.getCurrentResearch?.(targetEmpireId);
        }
        
        if (effects.revealUnits) {
            const entities = entityManager.getEntitiesForEmpire(targetEmpireId);
            intel.militaryStrength = {
                totalUnits: entities.filter(e => e.type === 'unit').length,
                structures: entities.filter(e => e.type === 'structure').length,
                spaceUnits: entities.filter(e => e.spaceUnit).length,
                groundUnits: entities.filter(e => e.type === 'unit' && !e.spaceUnit).length
            };
        }
        
        if (effects.revealFleets) {
            // This would need fleet manager access - simplified for now
            intel.hasFleets = true;
        }
        
        // Store intel for later access
        if (!this.intel.has(spyEmpireId)) {
            this.intel.set(spyEmpireId, new Map());
        }
        this.intel.get(spyEmpireId).set(targetEmpireId, intel);
        
        return intel;
    }
    
    /**
     * Sabotage a structure on target planet
     */
    sabotageStructure(targetEmpireId, planetId, damageRange, entityManager) {
        const entities = entityManager.getEntitiesAtLocation(planetId);
        const structures = entities.filter(e => 
            e.type === 'structure' && 
            e.owner === targetEmpireId
        );
        
        if (structures.length === 0) {
            return { structureName: 'None', damage: 0, destroyed: false };
        }
        
        // Pick random structure
        const target = structures[Math.floor(Math.random() * structures.length)];
        const damage = damageRange.min + Math.random() * (damageRange.max - damageRange.min);
        
        const destroyed = entityManager.damageEntity(target.id, damage);
        
        return {
            structureId: target.id,
            structureName: target.name,
            damage: Math.round(damage),
            destroyed
        };
    }
    
    /**
     * Steal technology from target empire
     */
    stealTechnology(spyEmpireId, targetEmpireId, techTree) {
        const targetTechs = techTree.getResearched(targetEmpireId);
        const spyTechs = techTree.getResearched(spyEmpireId);
        
        // Find techs the target has but spy doesn't
        const stealable = targetTechs.filter(t => !spyTechs.includes(t));
        
        if (stealable.length === 0) return null;
        
        // Steal random tech
        const stolenTechId = stealable[Math.floor(Math.random() * stealable.length)];
        const tech = techTree.getTech(stolenTechId);
        
        // Grant tech to spy empire
        techTree.complete(spyEmpireId, stolenTechId);
        
        return tech;
    }
    
    /**
     * Find home planet for an empire
     */
    findHomePlanet(empireId, universe) {
        return universe.planets.find(p => p.owner === empireId);
    }
    
    /**
     * Log completed mission
     */
    logMission(spyData, success, result) {
        this.missionLog.push({
            id: `mission_${++missionIdCounter}`,
            spyId: spyData.id,
            empireId: spyData.empireId,
            targetEmpireId: spyData.targetEmpireId,
            planetName: spyData.planetName,
            missionType: spyData.mission,
            success,
            result,
            timestamp: Date.now()
        });
        
        // Keep only last 100 missions
        if (this.missionLog.length > 100) {
            this.missionLog = this.missionLog.slice(-80);
        }
    }
    
    /**
     * Get deployed spies for an empire
     */
    getSpiesForEmpire(empireId) {
        return Array.from(this.spies.values())
            .filter(s => s.empireId === empireId)
            .map(s => ({
                id: s.id,
                targetEmpireId: s.targetEmpireId,
                planetName: s.planetName,
                status: s.status,
                mission: s.mission,
                missionProgress: s.missionProgress,
                coverStrength: s.coverStrength
            }));
    }
    
    /**
     * Get intel that an empire has gathered
     */
    getIntelForEmpire(empireId) {
        const empireIntel = this.intel.get(empireId);
        if (!empireIntel) return [];
        
        const now = Date.now();
        const validIntel = [];
        
        for (const [targetId, intel] of empireIntel) {
            if (intel.expiresAt > now) {
                validIntel.push(intel);
            }
        }
        
        return validIntel;
    }
    
    /**
     * Get mission log for empire
     */
    getMissionLog(empireId) {
        return this.missionLog.filter(m => m.empireId === empireId);
    }
    
    /**
     * Serialize for persistence
     */
    serialize() {
        return {
            spies: Array.from(this.spies.entries()),
            intel: Array.from(this.intel.entries()).map(([empireId, intelMap]) => [
                empireId,
                Array.from(intelMap.entries())
            ]),
            counterIntelLevels: Array.from(this.counterIntelLevels.entries()),
            missionLog: this.missionLog
        };
    }
    
    /**
     * Load from persistence
     */
    loadState(savedState) {
        if (!savedState) return;
        
        if (savedState.spies) {
            this.spies = new Map(savedState.spies);
        }
        
        if (savedState.intel) {
            this.intel = new Map(
                savedState.intel.map(([empireId, intelEntries]) => [
                    empireId,
                    new Map(intelEntries)
                ])
            );
        }
        
        if (savedState.counterIntelLevels) {
            this.counterIntelLevels = new Map(savedState.counterIntelLevels);
        }
        
        if (savedState.missionLog) {
            this.missionLog = savedState.missionLog;
        }
        
        console.log(`   📂 Espionage: ${this.spies.size} active spies loaded`);
    }
}
