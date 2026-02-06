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

#### 2. Hyperlane Network ✅ IMPLEMENTED
**Status:** Deployed 2026-02-05
**Effort:** Medium

Stellaris-inspired hyperlane network connecting systems:
- **Within galaxies:** Minimum spanning tree + extra connections for variety
- **Between galaxies:** Wormholes connect closest system pairs
- **Visualization:** Cyan lines for standard lanes, purple dashed for wormholes
- **Animated wormholes:** Spinning portal icons at midpoints

Implementation details:
- `universe.js`: `generateHyperlanes()`, `generateInterGalaxyHyperlanes()`
- Hyperlanes stored in `universe.hyperlanes[]` array
- Auto-generated for existing saves on load
- Exposed in both `serialize()` and `serializeLight()`
- Rendered in galaxy view and universe view

**Note:** Currently visual only. Fleet pathfinding still uses direct travel. Future enhancement: require hyperlane paths for fleet movement.

---

#### 3. Starbases / Space Stations ✅ IMPLEMENTED
**Status:** Deployed 2026-02-05
**Effort:** Medium

Build stations at system entry points:
- **Outpost (Tier 1):** Claims the system, minimal defense (100m, 50e)
- **Starbase (Tier 2):** Medium defense, ship production bonus (upgrade: 300m, 150e)
- **Citadel (Tier 3):** Major fortification, trade hub (upgrade: 600m, 300e, 100r)

**Features:**
- 6 module types: Gun Battery, Shield Generator, Shipyard, Trading Hub, Hangar Bay, Sensor Array
- Visual indicators in system and galaxy views
- HP tracking and combat integration
- API: `build_starbase`, `upgrade_starbase`, `add_starbase_module`
- REST: `/api/starbases`, `/api/starbase/:systemId`

Still TODO:
- Fleet combat at starbases before planet invasion
- Starbase shipyard production queue

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

#### 5. Trade Routes ✅ IMPLEMENTED
**Status:** Deployed 2026-02-06
**Effort:** Medium

Implementation details:
- **Trade routes** connect two owned planets for passive credit income
- **Trade value** based on: population, distance, Trading Hub modules
- **Max routes** = 3 base + 2 per Trading Hub starbase module
- **Pirates** raid unprotected routes (no tier 2+ starbase nearby)
- **Raid duration:** 300 ticks, -75% income during raid
- **Visualization:** Curved dashed lines in galaxy view with animated trade flow dots
- **API:** `create_trade_route`, `delete_trade_route` actions
- **REST:** `GET /api/trade-routes`, `GET /api/empire/:id/trade`

Files modified:
- `core/trade.js` — TradeManager class (new)
- `core/engine.js` — Integration + tick processing
- `api/input-validator.js` — Action validation
- `server.js` — REST endpoints
- `client/renderer.js` — Visual trade routes

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

#### 11. Species System ✅ IMPLEMENTED
**Status:** Deployed 2026-02-05
**Effort:** Medium (turned out to be easier than expected!)

10 unique species with deep lore and mechanical traits:
- **Organic:** Velthari (diplomats), Krath'zul (hive), Aquari (ocean), Terrax (warriors)
- **Synthetic:** Synthari (quantum crystalline), Mechani (self-replicating machines)
- **Exotic:** Pyronix (plasma beings), Umbral (shadow entities), Celesti (ascended), Voidborn (eldritch)

Each species has:
- Unique backstory and philosophy
- Production modifiers (mining, energy, food, research)
- Combat and diplomacy bonuses/penalties
- World affinity bonuses (e.g., Pyronix +40% on lava worlds)
- Special ability (passive effect, to be implemented)

**API:** `GET /api/species`, `GET /api/species/:id`, `GET /api/empire/:id/species`

#### 12. Ascension Perks
Powerful late-game abilities (partially exists via tech).

#### 13. Megastructures
Ring worlds, matter decompressors, gateways.

---

## Recommended Implementation Order

1. ✅ **Cross-Galaxy Travel** — DONE (2026-02-05)
2. ✅ **Starbases** — DONE (2026-02-05)
3. ✅ **Hyperlanes** — DONE (2026-02-05) - Visual network in place
4. **Trade Routes** (economic depth)
5. **Crisis Events** (end-game content)
6. **Espionage** (adds intrigue)

---

## Next Feature: Trade Routes

Trade routes would add economic depth by:
- Establishing routes between owned planets
- Trade value based on distance and route safety
- Starbases with Trading Hub modules increase trade value
- Pirates could raid unprotected routes
- Trade deals with other empires for resource exchange

**Implementation would involve:**
1. Trade route entity connecting two planets
2. Per-tick income based on route value
3. Visual trade lines on galaxy map
4. Trading Hub starbase module bonuses
5. Pirate spawning near unprotected routes
