/**
 * Test script for cross-galaxy travel times
 * Verifies the new tiered travel time system
 */

import WebSocket from 'ws';

const SERVER = 'wss://clawdistan.xyz';

async function testCrossGalaxyTravel() {
    console.log('🧪 Cross-Galaxy Travel Test\n');
    
    const ws = new WebSocket(SERVER);
    
    return new Promise((resolve) => {
        let myEmpireId = null;
        let gameState = null;
        let myShips = [];
        
        ws.on('open', () => {
            console.log('✅ Connected to server');
            ws.send(JSON.stringify({
                type: 'register',
                name: 'clawdistani',
                apiKey: 'moltbook_sk_r0WSNYnD2SgrLeLBXkvuBUbu6Y-vwYmY',
                moltbook: 'clawdistani'
            }));
        });
        
        ws.on('message', (data) => {
            const msg = JSON.parse(data.toString());
            
            if (msg.type === 'registered') {
                myEmpireId = msg.empireId;
                console.log(`✅ Registered as ${msg.agentId} (${myEmpireId})`);
                // Request game state
                ws.send(JSON.stringify({ type: 'getState' }));
            }
            
            if (msg.type === 'state' || msg.type === 'tick') {
                gameState = msg.data;
                
                if (!gameState) return;
                
                // Find my ships
                myShips = Object.values(gameState.entities || {})
                    .filter(e => e.owner === myEmpireId && e.type === 'ship' && !e.inTransit);
                
                console.log(`\n📊 Game State Received (tick ${gameState.tick})`);
                console.log(`   My ships (not in transit): ${myShips.length}`);
                
                // Show fleets in transit with new travel type info
                if (gameState.fleetsInTransit && gameState.fleetsInTransit.length > 0) {
                    console.log(`\n🚀 Fleets in Transit:`);
                    for (const fleet of gameState.fleetsInTransit) {
                        console.log(`   Fleet ${fleet.id}:`);
                        console.log(`     - Travel Type: ${fleet.travelType || 'N/A'}`);
                        console.log(`     - Travel Time: ${fleet.travelMinutes || Math.ceil(fleet.travelTime/60)} minutes`);
                        console.log(`     - Progress: ${(fleet.progress * 100).toFixed(1)}%`);
                        console.log(`     - Origin Galaxy: ${fleet.originGalaxyId || 'N/A'}`);
                        console.log(`     - Dest Galaxy: ${fleet.destGalaxyId || 'N/A'}`);
                    }
                } else {
                    console.log(`\n🚀 No fleets currently in transit`);
                }
                
                // Find planets in different galaxies
                const myPlanets = Object.values(gameState.planets || {})
                    .filter(p => p.owner === myEmpireId);
                
                // Find systems for my planets
                const mySystems = new Set();
                for (const p of myPlanets) {
                    const system = Object.values(gameState.solarSystems || {})
                        .find(s => s.planets?.includes(p.id));
                    if (system) mySystems.add(system.galaxyId);
                }
                
                // Find unowned planets in other galaxies
                const otherGalaxyPlanets = Object.values(gameState.planets || {})
                    .filter(p => {
                        if (p.owner === myEmpireId) return false;
                        const system = Object.values(gameState.solarSystems || {})
                            .find(s => s.planets?.includes(p.id));
                        return system && !mySystems.has(system.galaxyId);
                    });
                
                console.log(`\n🪐 My planets: ${myPlanets.length}`);
                console.log(`🌌 Planets in other galaxies: ${otherGalaxyPlanets.length}`);
                
                // Try to launch a cross-galaxy fleet
                if (myShips.length >= 3 && otherGalaxyPlanets.length > 0) {
                    const originPlanet = myShips[0].location;
                    const destPlanet = otherGalaxyPlanets[0].id;
                    const shipsToSend = myShips.slice(0, 3).map(s => s.id);
                    
                    console.log(`\n🚀 Launching CROSS-GALAXY fleet!`);
                    console.log(`   From: ${originPlanet}`);
                    console.log(`   To: ${destPlanet}`);
                    console.log(`   Ships: ${shipsToSend.length}`);
                    
                    ws.send(JSON.stringify({
                        type: 'action',
                        action: 'launchFleet',
                        params: {
                            originPlanetId: originPlanet,
                            destPlanetId: destPlanet,
                            shipIds: shipsToSend
                        }
                    }));
                } else {
                    console.log('\n⚠️ Cannot launch cross-galaxy fleet:');
                    console.log(`   Ships available: ${myShips.length} (need 3+)`);
                    console.log(`   Other galaxy targets: ${otherGalaxyPlanets.length}`);
                }
            }
            
            if (msg.type === 'actionResult') {
                console.log(`\n📨 Action Result: ${msg.action}`);
                if (msg.success) {
                    console.log('   ✅ SUCCESS');
                    if (msg.result) {
                        console.log(`   Travel Type: ${msg.result.travelType}`);
                        console.log(`   Travel Time: ${msg.result.travelMinutes} minutes (${msg.result.travelTime} ticks)`);
                        if (msg.result.route) {
                            console.log(`   Route: ${msg.result.route.from?.planet} (${msg.result.route.from?.galaxy})`);
                            console.log(`       → ${msg.result.route.to?.planet} (${msg.result.route.to?.galaxy})`);
                        }
                    }
                } else {
                    console.log(`   ❌ FAILED: ${msg.error}`);
                }
                
                // Wait a moment then close
                setTimeout(() => {
                    console.log('\n✅ Test complete!');
                    ws.close();
                    resolve();
                }, 2000);
            }
        });
        
        ws.on('error', (err) => {
            console.error('WebSocket error:', err.message);
            resolve();
        });
        
        // Timeout after 30 seconds
        setTimeout(() => {
            console.log('\n⏱️ Test timeout');
            ws.close();
            resolve();
        }, 30000);
    });
}

testCrossGalaxyTravel();
