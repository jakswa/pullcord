# MARTA GTFS-RT Feed Behavior

*Documented 2026-02-19 from live observation of Route 21*

MARTA provides two GTFS-RT feeds: **Vehicle Positions** and **Trip Updates**. They frequently disagree, and neither is fully reliable.

---

## The Two Feeds

### Vehicle Positions
- Reports: vehicle ID, lat/lon, bearing, speed, trip ID, headsign, direction ID
- Updates every ~20-60 seconds
- **Known issue:** Trip ID and direction ID can go stale. We observed a bus drive half its return route (25+ stops) while the vehicle feed still reported the *previous* trip ID and the wrong direction. This staleness lasted 45+ minutes.

### Trip Updates
- Reports: predicted arrival/departure times at stops for a given trip
- Often "looks ahead" — assigns a vehicle to its *next* trip before the current one finishes
- **Known issue:** Publishes predictions with `etaSeconds: 0` for trips the bus hasn't started yet (ghost predictions, see `GHOST_PREDICTIONS.md`)

---

## Observed Scenario: Route 21, 2026-02-19 ~5:30-6:25 PM

### Timeline

**5:30 PM** — Bus 2312 approaching GA State Station (terminal) on trip 10923741 (westbound, dir 0). Scheduled arrival: 5:35 PM.

**5:35 PM** — Trip Update feed already shows bus 2312 assigned to return trip 10923857 (Kensington-bound, dir 1) with `etaSeconds: 0`. Vehicle Position feed still shows trip 10923741, dir 0. Ghost prediction logic classifies this as "next run" tier.

**5:40 PM** — Bus at the terminal doing its turnaround loop. Vehicle feed: still trip 10923741, dir 0. Trip Update: still 10923857, `etaSeconds: 0`.

**5:57 PM** — Bus clearly heading east on Memorial Dr (bearing 92, lon -84.388). Vehicle feed: **still** trip 10923741, dir 0, headsign "Georgia State Station (West Loop)." The bus is driving away from GA State toward Kensington but the feed says it's going the other way.

**6:18 PM** — Bus at lon -84.302 (Memorial Dr @ Lake Dr area), roughly stop 24 of 69 on the Kensington route. **43 minutes** since the old trip should have ended. Vehicle feed: still trip 10923741, dir 0. Never flipped.

**6:23 PM** — Kensington Station predictions show bus 2312 as "Next run · 39 min." The bus is actively driving toward Kensington with a real ETA, but classified as a ghost because the vehicle feed disagrees with the trip update feed.

### What the Rider Saw
- GA State Station: "Next run · —" (etaSeconds 0, our code suppresses NOW for non-active tier)
- Kensington Station: "Next run · 39 min" (real ETA but wrong tier label)
- No live bus indicator despite the bus actively running the route
- No vehicle shown on map for Kensington direction (both vehicles tagged dir 0)

### What Should Have Happened
- GA State: "Departing" or "Live · NOW" as bus left terminal
- Kensington: "Live · 39 min" with active bus tracking
- Map showing bus position heading east on Memorial Dr

---

## Feed Disagreement Patterns

### Pattern 1: Trip Update Looks Ahead (Ghost Predictions)
- **Trip Update** assigns vehicle to next trip before current trip finishes
- **Vehicle Position** still shows current trip
- **Result:** Prediction exists for a trip the bus isn't on yet
- **Current handling:** Classified as "next" tier (see `GHOST_PREDICTIONS.md`)
- **Problem:** When the bus actually starts the next trip, the vehicle feed may never update, so it stays "next" forever

### Pattern 2: Vehicle Feed Goes Stale
- Bus finishes a trip, starts the next one
- **Trip Update** has correct new trip predictions
- **Vehicle Position** still reports the old trip ID and old direction
- **Result:** Our ghost detection sees vehicle on trip A, prediction for trip B, classifies as "next" even though the bus is actively running trip B
- **Duration:** Observed 45+ minutes of stale trip ID. May persist for the entire trip.

### Pattern 3: Direction Never Flips
- Route 21 is an out-and-back route (Kensington ↔ GA State via Memorial Dr)
- Both directions show `directionId: 0` in the vehicle feed
- The "(returning)" suffix appears in headsign but direction ID stays 0
- **Result:** Cannot filter vehicles by direction using MARTA's direction field

---

## Implications for Pullcord

### Current Ghost Detection is Too Strict
The tier classification compares vehicle trip ID to prediction trip ID. If they don't match, it's "next." This was designed for Pattern 1 (look-ahead ghosts) but breaks on Pattern 2 (stale vehicle feed). A bus actively running a trip gets classified as a ghost because the vehicle feed never caught up.

### Possible Fixes (Not Yet Implemented)
1. **Position-based tier override:** If vehicle is on the route shape, heading in the right direction, and the trip update has a nonzero ETA — trust the trip update regardless of what the vehicle feed says about trip ID.
2. **Bearing + shape matching:** Use vehicle bearing and position against the route's GTFS shape to infer actual direction of travel, ignoring MARTA's direction ID.
3. **Terminal proximity detection:** When vehicle is near a terminal and a "next" prediction exists with ETA ~0, show "At terminal" / "Departing" instead of "Next run · —".
4. **Stale trip detection:** If a vehicle's trip ID corresponds to a trip that should have ended N minutes ago (based on schedule), consider the trip update feed more authoritative.

### Direction ID is Unreliable
For Route 21 (and possibly other loop/out-and-back routes), `directionId` from the vehicle feed cannot be trusted. Direction inference needs to come from bearing + position on shape, not from MARTA metadata.

---

## Raw Data Reference

```
Vehicle Position feed entity:
  vehicle.trip.trip_id    → may be stale (old trip)
  vehicle.trip.direction_id → may never flip on return trips
  vehicle.position.latitude/longitude → reliable, updates regularly
  vehicle.position.bearing → reliable

Trip Update feed entity:
  trip_update.trip.trip_id → usually correct (the upcoming/current trip)
  trip_update.stop_time_update[].arrival.time → ETA predictions
  trip_update.vehicle.id → vehicle assignment (often correct before vehicle feed catches up)
```

## See Also
- `GHOST_PREDICTIONS.md` — ghost prediction classification and "next run" tier
- `BACKEND_ARCHITECTURE.md` — prediction pipeline architecture
