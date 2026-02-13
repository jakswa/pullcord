# MARTA GTFS-RT Timestamp Analysis

**Date:** 2026-02-12 (8:48–8:53 PM EST)  
**Method:** Sampled 5 random active buses every 30 seconds for 5 minutes (11 samples each, 55 total observations)  
**Buses tracked:** Vehicle 3524 (Route 181), 3623 (Route 55), 2385 (Route 27), 4725 (Route 36), 3539 (Route 89)

---

## Key Findings

### 1. How Often Do Vehicle Timestamps Update?

**Typical: every ~30 seconds.** Four of five tracked buses updated their `vehicle.timestamp` on every single 30-second sample (100% update rate). The fifth bus (3524) only updated 50% of the time — it went stale for multiple consecutive intervals twice during the 5-minute window.

| Bus | Route | Timestamp Update Rate | Pattern |
|-----|-------|-----------------------|---------|
| 3539 | 89 | 10/10 (100%) | Rock-solid 30s cadence |
| 2385 | 27 | 10/10 (100%) | Rock-solid 30s cadence |
| 4725 | 36 | 10/10 (100%) | Rock-solid 30s cadence |
| 3623 | 55 | 10/10 (100%) | Rock-solid 30s cadence |
| 3524 | 181 | 5/10 (50%) | Dropped out twice for 60-120s stretches |

**Conclusion:** The AVL (Automatic Vehicle Location) system reports approximately every 30 seconds. However, **individual buses can go silent for 1-2+ minutes**, likely due to cellular connectivity issues, hardware variability, or GPS signal loss.

### 2. Staleness Patterns

"Staleness" = `fetch_time - vehicle.timestamp` (how old the position data is when we receive it).

**Distribution across all 55 observations:**

| Staleness Bucket | Count | Percentage |
|------------------|-------|------------|
| 0–10s | 0 | 0% |
| 11–30s | 28 | 51% |
| 31–60s | 22 | 40% |
| 61–120s | 4 | 7% |
| 121–300s | 1 | 2% |

**Summary stats:** avg=36.8s, median=29s, min=23s, max=126s

**Key insight: Data is NEVER fresh.** Even under the best conditions, there's a baseline staleness of **23–28 seconds**. This consists of:
- ~6–14 seconds from vehicle report to feed header timestamp (server processing/aggregation lag)
- ~15–20 seconds from feed header to our fetch (feed caching/refresh interval)

**Per-bus staleness character:**
- **Best case buses (3539, 2385):** Very consistent 27-29s staleness. The system works like clockwork for these.
- **Typical buses (4725, 3623):** 34-39s staleness. Slightly more server-side lag.
- **Worst case bus (3524):** Ranged from 34s to **126s**. When the bus stopped reporting, the old data just sat there getting staler and staler.

### 3. Do Positions Change Without Timestamps Changing?

**No. Never observed.** The correlation is perfect in one direction:

| Scenario | Count | Percentage |
|----------|-------|------------|
| Both position AND timestamp changed | 44 | 88% |
| Position changed, timestamp didn't | **0** | **0%** |
| Timestamp changed, position didn't | 1 | 2% |
| Neither changed | 5 | 10% |

**This means `vehicle.timestamp` is a reliable signal.** If the timestamp hasn't changed since your last fetch, the position data hasn't changed either. You can safely skip re-rendering that bus.

The one case of "timestamp changed, position didn't" was bus 2385 which was stationary (speed=0) — the GPS was jittering at the 5th decimal place but the timestamp kept updating because the AVL was still reporting.

The 5 "neither changed" cases were all bus 3524 during its dropout periods — the feed kept serving the last known data with the same stale timestamp.

### 4. Feed Header Timestamp vs Vehicle Timestamps

The feed header timestamp updates on every fetch (11 unique values across 11 fetches), confirming the **feed itself refreshes every ~30 seconds**.

**Feed-to-vehicle lag** (feed_header.timestamp - vehicle.timestamp):
| Bus | Avg Lag | Range |
|-----|---------|-------|
| 3539 | 6.0s | 6–6s |
| 2385 | 6.9s | 6–8s |
| 3623 | 8.5s | 1–17s |
| 4725 | 13.2s | 13–14s |
| 3524 | 42.0s | 13–104s (skewed by dropouts) |

This means buses report to the server, and there's a **6-14 second processing delay** before the data appears in the feed. When a bus drops out, the gap grows because the feed header keeps advancing while the vehicle timestamp is frozen.

### 5. Trip Update Timestamps vs Vehicle Position Timestamps

**They are almost always identical.** The `TripUpdate.timestamp` matched `VehiclePosition.timestamp` exactly for 4 of 5 buses across all samples (delta = 0s).

Bus 3623 showed occasional minor discrepancies (up to 15s difference), where the trip update timestamp was *newer* than the vehicle position timestamp. This suggests trip updates can sometimes be refreshed independently of position reports — possibly server-side recalculation of arrival predictions.

**Bottom line:** You can treat `vehicle.timestamp` as the canonical "last heard from" time. The trip update timestamp doesn't add independent staleness information.

### 6. What Happens During a Dropout

Bus 3524 demonstrated the dropout pattern clearly:

```
01:48:19  Normal update (37s stale)
01:48:19  Same — no update for 30s (67s stale)
01:48:19  Same — no update for 60s (97s stale)  
01:49:52  Resumes! (34s stale) — jumped to new position
01:50:21  Normal update
01:50:21  Same — no update for 30s (66s stale)
01:50:21  Same — no update for 60s (96s stale)
01:50:21  Same — no update for 90s (126s stale)
01:52:21  Resumes! (36s stale) — jumped to new position
```

**Pattern:** The bus stops reporting for 60-120 seconds, then comes back. During the gap, the feed serves stale data — same position, same timestamp, same speed. When it returns, the position jumps (the bus was still moving, just not reporting). The speed field is NOT zeroed during dropout — it retains the last reported speed, which is misleading.

### 7. The Stationary Bus (2385)

Bus 2385 sat at essentially the same location for the entire 5 minutes (speed=0, GPS jitter at 5th decimal ~1 meter). Despite being stationary:
- Timestamps updated every 30 seconds without fail
- Position "changed" in 9/10 intervals due to GPS float (sub-meter jitter)
- Staleness was extremely consistent (28-29s)

**Implication:** A stationary bus still reports normally. You can't distinguish "stopped at a bus stop" from "dropped out" by position alone — you need the timestamp.

---

## Recommendations for Pullcord

### Staleness Display Tiers

Based on the observed patterns, here's how Pullcord should communicate data freshness:

| Staleness | Label | Visual | Meaning |
|-----------|-------|--------|---------|
| 0–45s | "Live" | Green dot / no indicator | Normal operating range. Don't distract the user. |
| 45–90s | "Delayed" | Yellow dot or dimmed | Missed one reporting cycle. Position may be slightly off. |
| 90–180s | "Stale" | Orange dot + "~Xm ago" | Missed 2-3 cycles. Bus has likely moved significantly from shown position. |
| 180s+ | "Last seen Xm ago" | Red/gray + text | Data is unreliable. Bus may be anywhere along the route. |

### Implementation Notes

1. **Use `vehicle.timestamp` as the single source of truth** for staleness. Don't bother comparing trip update timestamps — they're redundant.

2. **Don't show staleness below 45s.** The system has an inherent ~25-35s lag that's operating normally. Showing "32 seconds ago" would just alarm users unnecessarily. Treat anything under 45s as "live."

3. **When staleness > 90s, warn about position accuracy.** The bus was still moving during the gap, so the displayed position could be 0.5-1+ miles off. Consider showing a "confidence radius" or dimming the bus icon.

4. **Speed during dropout is misleading.** Bus 3524 showed speed=8.9 m/s (20 mph) for 2+ minutes while frozen at the same coordinates. Don't display speed if the timestamp is stale — or at least label it as "last reported speed."

5. **The feed refreshes every ~30 seconds.** Polling more frequently than that is wasted API calls. Polling every 30s is optimal; every 15s would catch some interstitial updates but doubles API load for marginal benefit.

6. **Position-based change detection works.** Since positions never change without timestamps changing, you can use timestamp comparison as a cheap "did anything change?" check before re-rendering bus markers.

7. **Expect occasional dropouts.** Even in a 5-minute window, 1 of 5 buses had significant dropout episodes. This isn't rare — it's normal MARTA behavior. Design the UI to handle it gracefully rather than treating it as an error.

---

*Raw data: `timestamp-raw-data.json` | Investigation script: `investigate-timestamps.ts`*
