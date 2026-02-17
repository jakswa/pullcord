# Ghost Predictions — MARTA Trip Pre-Assignment

*Documented: 2026-02-17, observed on Route 21 field test*

## What Happens

MARTA's GTFS-RT trip update feed pre-assigns buses to their **next trip** before they finish the current one. A bus heading westbound to GA State already has trip update entries for its upcoming eastbound run.

This means the feed contains stop time predictions for a trip the bus **hasn't started yet**. From our perspective, it looks like two buses arriving at the same stop 1-2 minutes apart — but one is real and one is a ghost.

## Example (2026-02-17 ~09:36 EST)

**Bus 2327:**
- Vehicle position feed: trip `10923742` (westbound, 7:20→8:05 schedule), position 33.747, -84.294 — still 10km from GA State, heading west
- Trip update feed entry 1: trip `10923742` (current, westbound) — valid
- Trip update feed entry 2: trip `10923858` (NEXT, eastbound to Kensington) — predicting Forsyth arrival at 9:51 AM on a trip it hasn't started

**Result:** Two "Live" Route 21 entries at Forsyth, 7 min and 8 min, looking nearly identical. In reality, one is Jake's bus (3665, genuinely approaching) and the other is 2327 still heading the opposite direction.

## Root Cause

`getStopArrivals()` wasn't passing vehicle positions to `findArrivals()`, so **tier classification never ran**. Without vehicle position data, we can't tell which trip a bus is *actually* on, so everything defaults to `active` → shows as "Live."

## Fix (commit 1e58af8)

`getStopArrivals()` now fetches vehicles for all routes at the stop and passes them to `findArrivals()`. The tier classifier cross-references:

- **Vehicle position feed** → tells us the bus's *current* trip
- **Trip update feed** → may contain predictions for current AND next trip

If a vehicle has predictions for a trip that doesn't match its current vehicle position trip, it's classified as `next` tier ("Next run") instead of `active` ("Live").

## How to Verify

```bash
# Check a bus's current trip vs its trip updates
curl -s "http://localhost:4200/api/realtime/27335"   # vehicle positions
curl -s "http://localhost:4200/api/stops/600031/arrivals"  # should show different tiers
```

## Risk

Low. We're just classifying the prediction differently, not hiding it. "Next run" predictions are still shown — riders can see a bus is coming, just that it's on another run. If we ever misclassify a real active bus as "next," the ETA and prediction are still visible.

## Related

- Terminal fallback (same commit day): buses at first stop of trip fall back to MARTA ETA instead of computed, since schedule deltas don't account for layover time.
- Cancelled trips: MARTA publishes `CANCELED` schedule relationship in trip updates. 167 cancelled trips observed Feb 17 (Presidents Day service), none on Route 21 despite Google Maps showing cancellations — those come from service alerts, not trip updates.
