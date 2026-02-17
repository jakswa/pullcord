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

---

## What stays

- **30s cache with stale-while-revalidate** — good pattern, keeps MARTA API calls minimal
- **SQLite for GTFS static** — fast, atomic import, zero-maintenance
- **Protobuf decode** — necessary for GTFS-RT, no alternative
- **SSR + client hydration** — right choice for mobile-first
- **Singleton RealtimeDataService** — shared cache across requests, correct
