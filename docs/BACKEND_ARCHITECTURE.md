# Backend Data Architecture — Catalog & Simplification Notes

*2026-02-16 — inventory before custom ETA work*

---

## Files (2,000 lines total backend)

| File | Lines | Role |
|---|---|---|
| `db.ts` | 465 | SQLite queries (GTFS static data) |
| `realtime.ts` | 391 | MARTA GTFS-RT protobuf fetch + prediction logic |
| `push.ts` | 298 | Web Push / Pull the Cord server-side |
| `api.ts` | 294 | Hono API routes |
| `bus.tsx` | 161 | Bus tracker page SSR |
| `mock.ts` | 94 | Mock data for screenshots |
| `gtfs-import.ts` | 279 | One-shot GTFS import script |
| `app.js` | 1,562 | **Client — everything** |

---

## Data Flow

```
MARTA GTFS-RT (protobuf)
    ├── Vehicle Positions → 30s cache → getVehicles()
    └── Trip Updates      → 30s cache → getPredictions() / getStopArrivals()

MARTA GTFS (static, SQLite)
    └── marta.db (readonly) → routes, stops, trips, shapes, stop_times, route_stops
```

### Request paths:

**Single-route `/bus?route=X&stop=Y`:**
1. SSR renders page shell with `initialData` (route, stop, shapes, stops from db.ts)
2. Client polls `/api/realtime/:routeId` (vehicles) + `/api/predictions/:routeId/:stopId`
3. Predictions API: fetches trip updates → filters by route → matches stop → classifies tier (active/next/scheduled) → adherence lookup

**Multi-route `/bus?stop=Y`:**
1. SSR renders shell with stop info + route list
2. Client polls `/api/stops/:stopId/arrivals` (all routes)
3. On hero selection, client fetches `/api/route/:routeId` for that route's shapes/stops/vehicles

---

## Pain Points & Redundancy

### 1. Paired stop logic is everywhere (HIGH)
The "same physical stop, two IDs" problem has been patched in 5+ places:
- `getStopIdsByName()` in db.ts
- `getRoutesForStop()` merges paired IDs
- `getPredictions()` checks `allStopIds` set
- `getStopArrivals()` checks `allStopIds` set
- `getScheduledArrivals()` checks all paired IDs
- `prepareStopDirections()` client-side name fallback
- `searchStops()` GROUP BY stop_name
- `getNearbyStops()` dedup by name
- `getStopsForRoute()` GROUP BY stop_name

**Opportunity:** Resolve at the data layer. When we import GTFS, create a `stop_groups` table that maps stop IDs to a canonical group ID. All downstream code queries by group, not individual ID. One fix, everywhere.

### 2. Two prediction paths (MEDIUM)
- `getPredictions(routeId, stopId)` — single route, used by `/api/predictions`
- `getStopArrivals(stopId, routes)` — multi route, used by `/api/stops/:stopId/arrivals`

These do 80% the same work (iterate trip updates, match stops, compute ETA, adherence, dedup). Different in: route filtering and response shape.

**Opportunity:** Extract shared core: `findArrivalsAtStop(stopIds, routeFilter?, tripLookup) → raw arrivals`. Both paths call it with different filters. Eliminates duplicated logic for paired stops, staleness, adherence, dedup.

### 3. Tier classification lives in api.ts, not realtime.ts (MEDIUM)
`getPredictions()` returns raw predictions without tiers. The `/api/predictions` endpoint then classifies active/next/scheduled by cross-referencing vehicle positions. But `getStopArrivals()` doesn't classify tiers at all — multi-route view has no tier info.

**Opportunity:** Move tier classification into the prediction layer. Both paths get tiers for free.

### 4. Trip lookup is loaded twice per request (LOW)
- Single-route: `getTripLookup(routeId)` — filtered, fast
- Multi-route arrivals: `getTripLookup()` — ALL trips (~46k), cached after first call

The full lookup is 46k entries. Cached after first use, so only slow on cold start. Not a real problem but worth knowing.

### 5. `getPairedStops()` is now unused in API (LOW)
Was used for the old paired-stop expansion loop in `/api/predictions`. That loop was removed when `getPredictions()` got internal paired-stop merging. The function still exists in db.ts and is exported. Only consumer was the deleted API code.

**Opportunity:** Remove `getPairedStops()` or repurpose for client-side direction detection.

### 6. Client app.js is 1,562 lines in one file (HIGH)
Everything in one class: home page, tracker page, hero, progress strip, upcoming list, map, cord, favorites, search. Hard to reason about.

**Opportunity:** Not urgent for functionality, but when we add computed ETA, this class gets even bigger. Could split into modules (home.js, tracker.js, cord.js, map.js) but needs a bundler step or careful script loading.

---

## Completed Simplifications (2026-02-16)

### Phase 1: Consolidate prediction paths ✅ (41cffb5)
- New `findArrivals(opts)` in realtime.ts — single function for all prediction paths
- `getPredictions()` and `getStopArrivals()` are thin wrappers
- Tier classification (active/next/scheduled) moved from api.ts into findArrivals
- Adherence, dedup, paired stops handled once — ~80 lines of duplication eliminated
- Fixed latent bug in push.ts (redundant paired-stop expansion loop)

### Phase 2: Canonical stop groups ✅ (873a2dc)
- `stop_groups` table: `(stop_id PK, group_id)` — built at import, auto-migrated on startup
- 8724 stops → 6611 unique groups (2113 paired stops)
- `getStopIdsByName()` → indexed stop_groups lookup (was: runtime stop_name subquery)
- `getRoutesForStop()` → single query with stop_groups subquery (was: 2 queries)
- `getScheduledArrivals()` → single query (was: 2 queries)
- Removed dead `getPairedStops()` (60+ lines)

### Phase 3: Clean dead code ✅ (2df9b9f)
- Removed `getStopWithRoutes()` — defined but never imported
- `mock.ts` kept — still used for `?mock` screenshot param

### Phase 2b: stops.group_id replaces stop_groups table ✅ (b781c54)
- Jake's call: column on stops is simpler than a join table
- Dropped stop_groups table, added `stops.group_id` column
- Auto-migration on startup (adds column + populates, drops old table)
- -20 lines, one fewer table, same 6,611 groups

---

## Computed ETA Prototype (computed-eta branch)

*2026-02-16 — prototype, not merged to main yet*

### Problem
MARTA's GTFS-RT trip update arrival times are "treadmill" predictions — they advance with wall clock rather than reflecting real vehicle progress. Our Feb 16 analysis of 12,828 samples confirmed this pattern.

### Approach
Replace MARTA's treadmill ETA with our own for active-tier vehicles:

```
ETA = scheduled_time[your_stop] - scheduled_time[bus_nearest_stop] - interpolation - staleness
```

One subtraction + two small corrections. No ML, no history, no complexity.

### How it works
1. **Vehicle position** — lat/lon from GTFS-RT vehicle positions feed (94% are ≤30s stale, median 20s)
2. **Trip stop sequence** — ordered stops with scheduled arrival times from static GTFS
3. **Snap to nearest stop** — linear scan of ~50 stops, pick closest by distance
4. **Schedule delta** — subtract scheduled times (encodes all inter-stop travel time)
5. **Segment interpolation** — if bus is between stops, estimate fraction covered, subtract proportional time
6. **Staleness correction** — subtract `vehicle.timestamp` age from ETA (bus has been moving since GPS reading)

### Architecture
- `src/data/eta.ts` — pure computation function, no I/O, no dependencies
- `public/eta.js` — same algorithm for client-side use (shared logic, not shared module)
- Server: `findArrivals()` computes for push notifications
- Client: `computeClientETAs()` computes for display after each poll
- `etaSource` field: `'computed'` vs `'marta'` (API consumers can distinguish)
- Falls back to MARTA predictions for next/scheduled tier (no vehicle position)

### Data additions
- `arrival_time` added to route detail stops payload (from representative trip per direction)
- `getTripStopSequences(tripIds)` — batch query for trip stop sequences (one SQL call per poll)
- `stops.group_id` used for paired stop resolution in ETA computation

### What it doesn't do
- No historical averaging or ML — pure schedule + position math
- No bearing/speed extrapolation — MARTA's feed has unreliable values
- No prediction for next/scheduled tier — needs trip updates or calendar-based discovery (see issue #11)

### Commits
- `4d36f30` — core implementation (eta.ts, client eta.js, findArrivals integration)
- `17bd7ff` — cord UI desync fix (checkPullCord verifies cord existence server-side)
- `8b0a942` — staleness correction (subtract vehicle position age from ETA)

---

## Known Quirks

### Duplicate arrivals for same route at multi-route stops
At busy stops (e.g., Five Points 600031), you can see two entries for the same route with nearly identical ETAs but different vehicles/trips. Example:

```
Route 21 | 7m | Kensington Station | vid=3650 | trip=10923849
Route 21 | 7m | Kensington Station | vid=4684 | trip=10923834
```

This is **correct data, not a dedup bug** — two buses genuinely approaching at the same time. MARTA pre-assigns buses to their next trip before finishing their current one, so both show as "7 minutes to Kensington" even though both are still westbound.

The UI doesn't distinguish them visually (no vehicle ID shown in arrival cards). Not a priority to fix but could add a bus identifier or collapse into "2 buses in ~7 min" in the future.

---

## What stays

- **30s cache with stale-while-revalidate** — good pattern, keeps MARTA API calls minimal
- **SQLite for GTFS static** — fast, atomic import, zero-maintenance
- **Protobuf decode** — necessary for GTFS-RT, no alternative
- **SSR + client hydration** — right choice for mobile-first
- **Singleton RealtimeDataService** — shared cache across requests, correct
