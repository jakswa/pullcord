# Transfer Stops — Bus ↔ Rail Integration

*Written: 2026-02-28*

## The Problem

You're on a bus heading toward Five Points. The bus ETA says 4 minutes. You know there's a Gold Line train at Five Points, but you have no idea if one leaves in 5 minutes or 15. Do you run? Do you chill? Right now, Pullcord can't tell you.

## What MARTA's GTFS Gives Us

**Nothing explicit.** No `transfers.txt`, no `pathways.txt`, no `parent_station` relationships, no `location_type` values. Every stop — bus and rail — is a flat row in `stops.txt` with coordinates and a name. 8,724 stops, zero hierarchy.

## What GPS Proximity Gives Us

**Everything we need.**

Rail stations exist as bus stops in the GTFS (buses serve them). Station names are consistent ("X STATION" pattern). Every stop has lat/lon. A simple haversine radius check produces clean, reliable matches:

| Radius | Bus Stops Matched | Rail Stations Covered |
|--------|------------------|-----------------------|
| 100m   | 11               | 8                     |
| 150m   | 22               | 13                    |
| 200m   | 55               | 21                    |
| 300m   | 142              | 32                    |
| 400m   | 278              | 35                    |

**200m is the sweet spot.** It catches stops that are genuinely walkable to the station entrance — across the street, on the same block. At 300m+ you start pulling in stops that are technically nearby but involve crossing highways or parking lots.

MARTA has 38 rail stations. At 200m we cover 21 of them (55%). The missing ones are stations with bus bays inside their own loops (the bus stops carry "STATION" in the name and get filtered as rail stops, not bus stops). That's actually fine — those bus stops already *are* at the station.

## Implementation Path

### Phase 1: Static Lookup Table (build time)

At GTFS refresh (weekly cron, Sunday 3am):

```
For each bus stop:
  Find nearest rail station centroid within 200m
  Store: bus_stop_id → { rail_station_name, distance_m }
```

This is a one-time spatial join. ~8,700 stops × ~38 stations = ~330K distance calculations. Takes milliseconds. Store as a JSON map or SQLite table.

### Phase 2: Bus Stop → Rail Pills

When rendering a bus stop page (e.g., `/stop/210709`):

1. Check if `stop_id` has a rail transfer in the lookup
2. If yes, fetch rail arrivals for that station (already have the API client in `src/rail/api.ts`)
3. Render rail pills below the bus predictions — same visual language as `/rail`, compact

**Zero new APIs.** The rail arrival endpoint is already cached (20s stale-while-revalidate). One extra fetch per transfer stop page load.

### Phase 3: Rail Station → Bus Arrivals

Reverse direction. When viewing a rail station on `/rail`:

1. Find all bus stops within 200m of that station
2. Fetch bus predictions for those stops
3. Group by route, show ETAs

This is heavier — multiple bus stops per station, multiple routes per stop. Might want a "Transfer Buses" expandable section rather than always-visible pills.

### Phase 4: Transfer Awareness in Predictions

The endgame: when you're viewing a bus route and your stop is a transfer point, show a small inline indicator: "🚇 Gold Line: 3 min" beneath the bus ETA. At a glance, you know whether to sprint when you get off.

## Why This Excites Me

1. **Zero external data needed.** It's all in the GTFS + the existing rail API. No new API keys, no new dependencies.
2. **Build-time computation, runtime lookup.** The spatial join happens once a week. The lookup is a hash map access.
3. **Solves a real daily commuter problem.** "Should I run for the transfer?" is a question people answer with guesswork and anxiety right now.
4. **Both directions work.** Bus→Rail is the obvious one, but Rail→Bus is equally valuable for the last-mile problem. "Train's arriving at Inman Park in 2 min — is my bus there?"
5. **Minimal code.** The rail API client exists. The bus prediction engine exists. The UI patterns exist. This is wiring, not inventing.
6. **It's the thing marta.io can't do.** They show rail arrivals. They show bus arrivals. They don't connect them. Pullcord could be the first MARTA app that treats the network as a *network*.

## Edge Cases to Handle

- **Multiple rail stations nearby** (only realistic in downtown): Pick closest, or show both
- **Bus stops that ARE the station** (name contains "STATION"): Already handled — these show up in the rail view naturally
- **Five Points** (4 lines): Rail pills already handle the 2×2 grid layout
- **Station name normalization**: GTFS uses "HAMILTON E HOLMES STATION", rail API returns "HAMILTON E HOLMES" — need a fuzzy matcher or canonical name map
- **Rate limiting**: Rail API calls per station could add up if many users hit transfer stops — the 20s cache helps but might need to batch

## Data Snapshot (200m radius)

21 rail stations with nearby bus stops. Top 5 by density:

- **Ashby** — 5 bus stops (closest: 69m)
- **Garnett** — 5 bus stops (closest: 132m)  
- **East Lake** — 4 bus stops (closest: 79m)
- **Oakland City** — 4 bus stops (closest: 69m)
- **West Lake** — 4 bus stops (closest: 92m)

Closest match overall: **Peachtree Center** — bus stop at 17m (literally across the street).
