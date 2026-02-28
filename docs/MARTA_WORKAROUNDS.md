# MARTA GTFS-RT: What We Fix and Why

*Last updated: Feb 27, 2026*

Pullcord consumes two MARTA GTFS-RT feeds: **Vehicle Positions** (GPS) and **Trip Updates** (predicted arrival times). Neither is fully reliable. This doc covers what's broken, what we do about it, and what value each feed actually provides.

---

## The Prediction Pipeline

```
MARTA Trip Updates        MARTA Vehicle Positions
   (arrival times)              (GPS lat/lon)
         │                           │
         ▼                           ▼
   ┌─────────────────────────────────────┐
   │          findArrivals()             │
   │                                     │
   │  1. Parse trip update predictions   │
   │  2. Drop stale (> 120s past)        │
   │  3. Tier classify (active/next/     │
   │     scheduled) via vehicle GPS      │
   │  4. Computed ETA override           │
   │  5. Ghost vehicle rescue            │
   │  6. Drop stale next-tier (< 60s)    │
   │  7. Dedup + sort                    │
   └─────────────────────────────────────┘
                    │
                    ▼
            Arrival predictions
         (what the rider sees)
```

---

## Workaround 1: Computed ETAs (Feb 17)

### The Problem
MARTA's predicted arrival times in the Trip Updates feed are often just the static schedule ticking forward with the clock. Round 1 sampling showed they have a **mean error of 83 seconds** vs actual arrival. They don't reflect where the bus actually is — a bus stuck in traffic still shows its scheduled time.

### What We Do
For every `active`-tier prediction (bus confirmed on this trip via GPS), we compute our own ETA:

1. Get the bus's current GPS position from Vehicle Positions
2. Find the bus's nearest passed stop on the trip's stop sequence
3. Sum the scheduled inter-stop travel times from there to the target stop
4. Adjust for how ahead/behind schedule the bus is at its current position

This GPS-based ETA replaces MARTA's prediction. We keep MARTA's original as `martaEtaSeconds` for comparison.

### Results
**Round 1 (Route 21, 1 stop, Feb 17–21):**
- Computed ETA mean error: **50.7s** vs MARTA's 82.8s
- Computed wins head-to-head: **70.7%** of arrivals
- See `docs/ETA_SAMPLING_PLAN.md` for methodology and bias notes

### What Trip Updates Still Provide Here
The MARTA prediction is the **seed** — it tells us which trips are approaching which stops. We just replace the *time* with a better estimate. Without trip updates, we wouldn't know which trip a bus is on or which stops it will serve.

---

## Workaround 2: Ghost Vehicle Rescue (Feb 27)

### The Problem
MARTA's Trip Updates feed sometimes has **stale arrival times** for trips that are actively running. The predicted times can be hours in the past — a bus whose GPS shows it heading toward your stop at 6pm has trip update predictions timestamped from 2pm.

Our pipeline correctly drops predictions more than 120 seconds in the past. But this means real, active buses vanish from stop arrival lists entirely. GPS says the bus is coming; trip updates say it arrived 4 hours ago.

### What We Do
After processing all trip update predictions, we check: are there any vehicles broadcasting GPS on trips that serve this stop but have *no* prediction in our results?

For each "ghost" vehicle:
1. Look up the trip's stop sequence from static GTFS
2. Check if any of our target stops are on this trip
3. Compute an ETA from the vehicle's GPS position (same logic as Workaround 1)
4. Inject it as a rescued prediction with `rescued: true` and `tier: 'active'`

### Scope
This only fires for buses with live GPS that are missing from trip updates. It cannot fabricate buses that don't exist. If a bus has valid trip update predictions, the rescue code never touches it.

### What Trip Updates Provide Here
Nothing — that's the point. The trip update data is broken for these vehicles. We fall back entirely to Vehicle Positions + static GTFS schedule.

---

## Workaround 3: Ghost Prediction Filtering (Feb 17)

### The Problem
MARTA pre-assigns buses to their **next trip** before they finish the current one. A bus heading westbound to GA State already has trip update predictions for its upcoming eastbound run. This creates "ghost" predictions — a stop shows two buses arriving 1 minute apart, but one is real and one hasn't started yet.

### What We Do
Cross-reference Trip Updates with Vehicle Positions to classify predictions into tiers:

- **`active`**: Vehicle GPS confirms it's on this exact trip → high confidence
- **`next`**: Vehicle is broadcasting GPS but on a *different* trip → "next run" (lower confidence, shown differently in UI)
- **`scheduled`**: No live vehicle GPS at all → pure schedule

### What Trip Updates Provide Here
The trip assignment itself. Even "next" tier predictions are useful — they tell riders "this bus will come back on a future run in ~X minutes." We just label them honestly instead of showing them as active.

---

## Workaround 4: Stale Next-Tier Cleanup (Feb 27)

### The Problem
"Next" tier predictions with `etaSeconds` clamped to 0 (the scheduled arrival time is in the past). These are buses that already passed the stop on a completed trip. They render as "—" in the UI with no useful information.

### What We Do
Filter out any `next`-tier prediction with `etaSeconds < 60`. If the bus isn't on this trip and the scheduled time has passed, there's nothing to show.

---

## So What Value Are Trip Updates Actually Giving Us?

Good question. Here's the honest breakdown:

### What Trip Updates provide that we can't get elsewhere:
1. **Trip-to-stop mapping at runtime** — which trips are approaching which stops right now. Static GTFS has the schedule, but trip updates tell us which trips are *actually running* today (vs cancelled, added, etc.)
2. **Vehicle-to-trip assignment** — the `vehicle.id` field in trip updates often leads GPS data by telling us which bus is assigned to which trip before the Vehicle Positions feed catches up
3. **"Next run" predictions** — when a bus will return on its next trip (genuinely useful for low-frequency routes)
4. **Unassigned future trips** — ~96 trip updates have no vehicle ID, representing scheduled service not yet assigned to a bus. These give riders schedule info for the next few hours.
5. **Schedule adherence signal** — the *difference* between MARTA's prediction and the static schedule tells us if a bus is early/late, which we surface in the UI

### What Trip Updates fail at:
1. **Accurate ETAs** — mean error 83s, we beat it with GPS-based computation
2. **Freshness** — arrival times can go stale for hours while the bus keeps running
3. **Direction accuracy** — `direction_id` in both feeds is unreliable for out-and-back routes (Route 21 shows `direction_id: 0` for both directions)

### Could we drop Trip Updates entirely?
**Not yet.** We'd lose the trip-to-stop mapping (critical for knowing which buses serve which stops) and the "next run" tier (helpful for headway). We'd be reduced to "here's a bus on this route somewhere, and here's the static schedule" — a big step backward for stop-level predictions.

The dream scenario: if Vehicle Positions reliably included the current trip ID (they don't — it goes stale for 45+ minutes), we could cross-reference with static GTFS and ditch trip updates entirely. But MARTA's Vehicle Positions feed has its own staleness issues.

**Bottom line:** Trip updates are the skeleton (what's running, where it's going). Vehicle positions are the muscle (where it actually is). We need both, and we fix the bones where they're broken.

---

## Related Docs

| Doc | What It Covers |
|-----|---------------|
| `MARTA_FEED_BEHAVIOR.md` | Deep dive on feed disagreement patterns, real scenario timelines |
| `GHOST_PREDICTIONS.md` | Ghost prediction classification, the Feb 17 fix |
| `VEHICLE_VS_TRIPS_ANALYSIS.md` | Statistical analysis: why TU has 2.25x more entries than VP |
| `ETA_SAMPLING_PLAN.md` | Round 1 computed vs MARTA ETA accuracy results |
| `SCHEDULE_ADHERENCE_ANALYSIS.md` | How often MARTA's predictions differ from static schedule |

---

## Implementation

All workarounds live in `src/data/realtime.ts`, function `findArrivals()`. The client (`public/app.js`) shows rescued predictions with an amber pulsing dot for visual QA.
