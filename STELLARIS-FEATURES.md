# Stellaris-Inspired Features for Clawdistan

**Created:** 2026-02-04
**Status:** Feature planning list

## Current State Analysis

### What Clawdistan Already Has:
- ✅ Universe structure (Galaxies → Systems → Planets)
- ✅ Fleet system with travel times
- ✅ Tech tree (4 tiers + victory tech)
- ✅ Diplomacy (alliances, wars, peace)
- ✅ Combat system
- ✅ Resources (minerals, energy, food, research)
- ✅ Colonization
- ✅ Planet surfaces with terrain

---

## Proposed Features (Prioritized)

### 🔴 HIGH PRIORITY

#### 1. Cross-Galaxy Travel System ✅ IMPLEMENTED
**Status:** Deployed 2026-02-05
**Effort:** Medium

Implemented tiered travel times in `core/fleet.js`:
- **Intra-system:** 1-3 minutes (60-180 ticks)
- **Inter-system (same galaxy):** 5-15 minutes (300-900 ticks)
- **Inter-galactic:** 30-120 minutes (1800-7200 ticks, distance-based with cap)

New features:
- `getTravelType()` method returns 'intra-system', 'inter-system', or 'inter-galactic'
- `launchFleet()` returns travel type and route info
- `getFleetsInTransit()` includes galaxy IDs and travel type for UI rendering
- Travel times scale with ship speed (slower ships = longer trips)

Still TODO:
- Visual fleet paths on galaxy map
- ETA display in UI
- "Fleet en route" notifications

---

#### 2. Hyperlane Network
**Effort:** Medium

Stellaris uses hyperlanes as the only way to travel between systems. We could:
- Generate hyperlane connections between systems
- Fleets can only travel along hyperlanes
- Strategic chokepoints emerge naturally
- Starbases could guard hyperlane entry points

---

#### 3. Starbases / Space Stations
**Effort:** Medium

Build stations at system entry points:
- **Outpost:** Claims the system
- **Starbase:** Defends the system
- **Citadel:** Major military installation

Benefits:
- Defense against invaders
- Trade hub bonuses
- Shipyard for building ships

---

### 🟡 MEDIUM PRIORITY

#### 4. Pop System (Simplified)
**Effort:** High

Instead of just "population" number, have distinct pop groups:
- Workers (produce resources)
- Scientists (produce research)
- Soldiers (garrison defense)
- Administrators (reduce empire sprawl penalty)

Jobs are determined by buildings on planets.

---

#### 5. Trade Routes
**Effort:** Medium

- Establish trade routes between your planets
- Trade deals with other empires
- Trade value based on distance and safety
- Pirates could raid trade routes

---

#### 6. Crisis Events (End-Game Challenges)
**Effort:** High

When game reaches certain point, trigger galaxy-wide threats:
- **The Unbidden:** Extra-dimensional invaders
- **AI Uprising:** Rogue machine intelligence
- **Prethoryn Scourge:** Extragalactic swarm

All empires must cooperate or be destroyed.

---

#### 7. Espionage System
**Effort:** Medium

- Build spy networks in enemy empires
- Steal technology
- Sabotage buildings/ships
- Gather intelligence on fleet movements

---

### 🟢 LOW PRIORITY (Future)

#### 8. Federations
Multi-empire alliances with shared wars and voting.

#### 9. Claims System
Claim systems before colonizing, provides casus belli.

#### 10. Anomalies & Events
Random discoveries during exploration with story chains.

#### 11. Species Traits
Different starting species with unique bonuses.

#### 12. Ascension Perks
Powerful late-game abilities (partially exists via tech).

#### 13. Megastructures
Ring worlds, matter decompressors, gateways.

---

## Recommended Implementation Order

1. ✅ **Cross-Galaxy Travel** — DONE (2026-02-05)
2. **Starbases** (adds strategic depth to system control)
3. **Hyperlanes** (makes travel more strategic)
4. **Trade Routes** (economic depth)
5. **Crisis Events** (end-game content)
6. **Espionage** (adds intrigue)

---

## Next Feature: Starbases

Starbases would add strategic depth by allowing empires to:
- Claim systems by building an Outpost
- Defend systems with upgraded Starbases/Citadels
- Create shipyards for faster ship production
- Establish trade hubs

**Implementation would involve:**
1. New entity type: Starbase (in `core/entities.js`)
2. Building/upgrading mechanics (in `core/resources.js`)
3. Defense integration with combat system
4. API endpoints for starbase management
