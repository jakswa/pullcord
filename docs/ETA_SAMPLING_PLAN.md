# ETA Sampling Plan

## Round 1 Results (Feb 17–21, 2026)

**Scope:** 1 route (Route 21), 1 stop (Memorial/Gibson #104064), sampled every 2 min via cron.

| Metric | Computed | MARTA |
|---|---|---|
| Arrivals sampled | 58 | 58 |
| Mean error | **50.7s** | 82.8s |
| Median error | **54s** | 84s |
| Head-to-head wins | **41 (70.7%)** | 15 (25.9%) |

**Raw log:** `data/eta_compare_round1.log` (18,887 lines)

### Known Biases
- Single route, single stop — no generalization
- MARTA 0s predictions (likely "arrived" or null) auto-lose
- 150m GPS threshold ≠ actual door-open arrival
- 2-min cron interval means predictions may be 0–120s stale at arrival time
- All hours of day — no rush-hour vs off-peak breakdown
- Route 21 runs through dense Midtown — may not represent suburban routes with longer stop spacing

---

## Round 2 Plan — Multi-Route, Multi-Stop

### Goal
Validate computed ETA accuracy across diverse routes and conditions. Enough data to confidently ship (or kill) the computed ETA feature.

### Methodology

**Route Selection (5–8 routes covering variety):**

| Route | Character | Why |
|---|---|---|
| 21 (Memorial) | Urban, frequent, short stops | Baseline (Round 1 route) |
| 2 (Ponce de Leon) | Crosstown, medium frequency | Different corridor |
| 39 (Buford Hwy) | Long suburban, infrequent | Tests long inter-stop times |
| 1 (Marietta Blvd) | Mixed urban/suburban | High ridership |
| 15 (Candler Rd) | South DeKalb, infrequent | Different geography |
| GOLD or BLUE | Rail | Validate rail ETA once integrated |

**Stop Selection (2–3 stops per route):**
- One near the start of the route (predictions mostly schedule-based)
- One mid-route (most GPS data available)
- One near the end (accumulated delay)

**Sampling Improvements:**
1. **Server-side sampler** — run inside pullcord process, not external cron. Can capture prediction + log arrival in one flow with exact timestamps.
2. **Per-prediction tracking** — log prediction at capture time, match to specific arrival event. No 2-min cron aliasing.
3. **Filter MARTA 0s** — exclude predictions where MARTA returns 0 or null. Report filtered and unfiltered stats.
4. **Time-of-day buckets** — morning rush (7–9), midday (10–3), evening rush (4–7), off-peak (7pm+).
5. **Weekday vs weekend** — service patterns differ significantly.
6. **Minimum prediction horizon** — only count predictions made >60s before arrival. Anything under 60s is trivially accurate for both sources.

**Data Schema:**
```
{
  timestamp: ISO string,
  route_id: string,
  stop_id: string,
  vehicle_id: string,
  trip_id: string,
  computed_eta_seconds: number | null,
  marta_eta_seconds: number | null,
  prediction_tier: string,
  actual_arrival_seconds: number | null,  // filled when vehicle arrives
  arrival_distance_m: number,
  day_type: "weekday" | "weekend",
  time_bucket: "am_rush" | "midday" | "pm_rush" | "off_peak"
}
```

Store in SQLite (new `eta_samples` table), not log files. Enables SQL analysis.

**Duration:** 2 weeks minimum. Need weekday + weekend coverage across multiple service periods.

**Success Criteria:**
- ≥500 matched arrivals across ≥5 routes
- Computed ETA wins head-to-head ≥60% (after filtering 0s)
- Mean error <90s across all routes (MARTA's current bar)
- No route where computed is significantly *worse* than MARTA

**If it fails:** Kill the computed ETA feature. Ship MARTA's predictions as-is. No shame in it.

### Implementation Notes
- Could be a Codeberg issue (#7 exists for custom ETA — extend it)
- Server-side sampler avoids the cron aliasing problem entirely
- Consider making it opt-in: `ENABLE_ETA_SAMPLING=true` env var
- Don't sample in production initially — run on dev (pullcord.home.jake.town) first
