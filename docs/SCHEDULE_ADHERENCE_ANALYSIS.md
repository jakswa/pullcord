# MARTA GTFS-RT Schedule Adherence Analysis

**Date:** February 15, 2026  
**Author:** Clatis  
**Related:** [Issue #7](https://codeberg.org/clatis/pullcord/issues/7) (Custom ETA), [Issue #8](https://codeberg.org/clatis/pullcord/issues/8) (Adherence indicator)

---

## TL;DR

MARTA's GTFS-RT trip update feed **does** send real-time adjusted predictions — 86.5% of arrival times differ from the static GTFS schedule. Our initial 3-trip sample was misleading. The median bus runs 0.3 minutes early. 62.6% are within ±2 minutes of schedule. 19% are >2 minutes off — that's where the adherence indicator provides real value.

## How We Got Here

### Initial Finding: "Schedule Echo" (Feb 15 morning)

We compared 3 trips on Route 121 against static `stop_times`:

| Trip | GTFS-RT `arrival.time` | Static `stop_times` |
|------|----------------------|---------------------|
| 10980178 | 12:52:00 PM | 12:52:00 |
| 10980179 | 12:32:00 PM | 12:32:00 |
| 10980177 | 1:12:00 PM | 13:12:00 |

Exact match. `scheduleRelationship: 0` (SCHEDULED). Conclusion: MARTA is echoing the schedule.

**This was wrong.** Three trips is not a sample — it's an anecdote. We happened to pick trips that were running exactly on time.

### Full-Feed Analysis (Feb 15 afternoon)

Compared all `stopTimeUpdate` entries in a single GTFS-RT feed snapshot against the static `stop_times` table, joined on `(trip_id, stop_id)`.

**Method:**
- Fetch one GTFS-RT trip update feed (all entities)
- For each `stopTimeUpdate`, look up `arrival_time` in `stop_times` for the same `(trip_id, stop_id)`
- Convert both to seconds-from-midnight, compute delta
- Filter: exclude `scheduleRelationship: 2` (UNSCHEDULED), exclude entries with no matching static time

**Result: 12,828 stop_time_updates compared.**

| Category | Count | % |
|----------|-------|---|
| Exact schedule match | 1,727 | 13.5% |
| **Adjusted from schedule** | **11,101** | **86.5%** |

MARTA IS sending real-time adjusted predictions. The `scheduleRelationship` field is always `0` (SCHEDULED) regardless — MARTA doesn't use the `1` (SKIPPED) or other values to signal adjustments. They just silently update the arrival times.

## Adherence Distribution

| Bucket | Count | % | Visual |
|--------|-------|---|--------|
| >5 min early | 350 | 3.2% | █ |
| 2-5 min early | 1,687 | 15.2% | ██████ |
| 0-2 min early | 4,416 | 39.8% | ████████████████ |
| 0-2 min late | 2,535 | 22.8% | █████████ |
| 2-5 min late | 967 | 8.7% | ███ |
| 5-10 min late | 234 | 2.1% | █ |
| 10+ min late | 912 | 8.2% | ███ |

**Key stats:**
- **Median:** 0.3 min early (buses slightly ahead of schedule on average)
- **62.6%** within ±2 min of schedule
- **81.5%** within ±5 min
- **19%** are >2 min off — these are the predictions where showing adherence matters
- **Early bias:** 58.2% of buses are early or on time vs 41.8% late
- **8.2% are 10+ min late** — a long tail of significantly delayed buses

## The Join

Scheduled arrival time comes from one SQL lookup:

```sql
SELECT arrival_time FROM stop_times WHERE stop_id = ? AND trip_id IN (?, ?, ...)
```

This is the canonical GTFS cross-reference — `trip_id` and `stop_id` are shared identifiers between GTFS static and GTFS-RT by spec design.

**Performance:** 0.012-0.026ms per lookup (existing `idx_stop_times_trip` index). Batched per poll — one query returns all scheduled times for a stop's predictions.

**Uniqueness:** 99.97% of `(trip_id, stop_id)` pairs are unique. 520 duplicates exist across 4 loop routes where a bus visits the same stop twice in one trip:

| Route | Name | Duplicate Rows | Loop Stop | Time Gap |
|-------|------|---------------|-----------|----------|
| 117 | Rockbridge / Panola | 230 | GRTA Panola Park & Ride | ~13 min |
| 193 | Morrow / Jonesboro | 184 | Jonesboro Rd @ Harper Dr | ~3 min |
| 800 | Lovejoy | 64 | Justice Center Transit Station | ~45 min |
| 867 | Peyton Forest / Dixie Hills | 42 | MLK Jr Dr @ Lamar Ave | ~3 min |

Route 117 (rank 16/114 by trip count) is the only popular one. For loop routes, the first visit's scheduled time is used. GTFS-RT `stopTimeUpdate` does include `stopSequence` if we ever need to disambiguate.

## Adherence Computation

Server-side, per prediction:

```
adherenceSec = rtArrivalTimestamp - scheduledArrivalTimestamp
```

- **Positive** = bus is running late (arriving after scheduled time)
- **Negative** = bus is running early
- **Zero / |delta| ≤ 60s** = on time

GTFS times can exceed 24:00:00 for after-midnight trips on the previous service day. The computation handles this by using the previous calendar day's midnight as the reference when hours ≥ 24.

**Safety cap:** Deltas exceeding ±30 minutes are discarded as data noise (midnight boundary edge cases, mismatched service days, or stale trip assignments).

## How It Displays

Adherence appears inline with the arrival time estimate:

**Hero section** (ETA ≥ 2 min):
```
arrives on time ~1:22 PM     ← green, |delta| ≤ 60s
arrives 3m late ~1:22 PM     ← amber
arrives 2m early ~1:18 PM    ← green
```

**Upcoming rows** (ETA ≥ 5 min):
```
● Live · on time ~1:22 PM
● Live · 3m late ~1:22 PM
● Live · 2m early ~1:18 PM
```

**Suppressed when:**
- |delta| ≤ 60 seconds (noise, not signal)
- `next` or `scheduled` tier (no vehicle on the road)
- No matching static time found
- Delta exceeds ±30 min cap

## Design Decision: Adherence vs Staleness

Two separate concerns that could easily confuse users:

| Indicator | Measures | Question it answers |
|-----------|----------|-------------------|
| **Staleness** (● Live / ~1m ago / ~2m ago) | GPS data freshness | "Is the bus reporting its position?" |
| **Adherence** (on time / 3m late / 2m early) | Schedule deviation | "Is the bus where it should be?" |

Originally, the 45-90s staleness tier was labeled "Delayed" — confusing when shown next to "3m late". Renamed to "~1m ago" to match the other staleness tiers and eliminate the collision.

## Lessons Learned

1. **Never trust a 3-sample check.** Our initial "schedule echo" conclusion was wrong. Full-feed analysis (12,828 samples) told the real story.
2. **`scheduleRelationship: 0` doesn't mean "unchanged."** MARTA uses SCHEDULED for everything, adjusted or not. The only way to detect adjustment is to compare against static data.
3. **The data is better than we thought.** 86.5% adjusted means MARTA's prediction system is active. Our ETAs already incorporate real-time conditions — we just didn't know it.

## Implications for Custom ETA (Issue #7)

The urgency of building custom speed-based ETAs is lower than we thought. MARTA is already adjusting arrival times based on real-time conditions. Our adherence indicator now makes this visible to users.

Custom ETAs (Phase 2 of #7) would still add value for:
- The 13.5% of predictions that are pure schedule (likely buses just starting their trip)
- More granular updates between MARTA's 30s reporting intervals
- Situations where MARTA's adjustment lags reality

But the "MARTA just echoes schedule" framing that motivated #7 was incorrect. The feature should be reframed as "augmenting MARTA's predictions" rather than "replacing broken predictions."

## Future: MARTA Data Dashboard

This analysis — and the series of investigations that led to it (timestamp analysis, vehicle vs trips, schedule echo) — suggests a broader tool: a **MARTA data quality dashboard** that continuously monitors:

- Feed freshness and update rates
- Prediction accuracy (adherence distribution over time)
- Vehicle reporting reliability (dropout rates)
- Schedule vs reality divergence by route, time of day, day of week
- Fleet utilization (vehicles on road vs scheduled)

This would benefit the transit community beyond Pullcord — any developer building on MARTA's GTFS-RT feeds needs to understand these characteristics. The data is public; the analysis shouldn't have to be redone by every developer independently.

---

*Commit: bd52ff3 (adherence feature), 3492c6e (staleness rename)*  
*Data source: MARTA GTFS-RT trip updates feed, Feb 15 2026 ~12:30 PM EST*
