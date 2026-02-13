# Experiment D — "The Bus Stop Screen"

## The Core Insight

Previous experiments (A/B/C) were reskins. Same layout, different colors. Experiment D starts from a different question: **What does someone standing at a bus stop actually need on their phone?**

The answer is almost never "a tiny geographic map showing a route line." The answer is:
1. **How long until my bus arrives** (the number, BIG)
2. **Is the bus actually moving toward me** (progress, not geography)
3. **What else is coming** (other buses at this stop)
4. **Let me know when it's close** (alert, not staring)

## What Changed and Why

### 1. ETA as Hero (the giant countdown)

The entire top half of the screen is now a single massive number. If your bus is 7 minutes away, you see **7** in ~128px type. Not a card in a list. THE thing.

Between polls (every 30s), a local countdown timer ticks the number down second by second. This makes the display feel alive and real-time, not stale. When a new poll arrives, it corrects to the server value.

**Why:** At a bus stop, the only question is "how long?" Make the answer impossible to miss. Glanceable from arm's length. Readable while walking. The countdown timer eliminates the jarring 30-second stale feeling.

**Arriving states:**
- `< 5 min`: number turns yellow (arriving soon)
- `< 1 min`: turns green and pulses, shows "NOW"
- The tier label above shows Live/Delayed/Scheduled status

### 2. Linear Progress Strip (SVG, no Leaflet)

Below the hero, a horizontal SVG strip shows the bus's position along the route as a progress bar. Small dots for stops, your stop prominently marked ("YOU"), and the bus as a glowing dot.

**Why:** "Your bus is 3 stops away" is more useful than a dot on a map 2 miles away. The linear representation strips away geographic noise and shows what matters: relative position and progress. The glowing segment between bus and your stop makes the remaining distance viscerally clear.

**Technical:** The strip is direction-aware. It splits the route's stops by direction_id, finds which direction matches the tracked vehicle, and renders only those stops. Bus position is calculated by finding the nearest stop and interpolating the fractional position between stops.

### 3. Map on Demand (not default)

The Leaflet map is **hidden by default**. It lives behind a "See on Map" button in the thumb zone. When tapped, it slides up as a full-screen overlay (dark CartoDB tiles to match the UI). Close button returns to the main view.

**Why:** A tiny, always-visible map showing a zoomed-out route line tells you almost nothing useful. But when a bus is close and you want to see exactly where it is, the map IS useful. Making it on-demand means:
- Screen space goes to the hero countdown (what matters most)
- When you DO open the map, it's full-screen (actually useful, not a 200px strip)
- Loading Leaflet tiles doesn't block the initial experience

The map initializes lazily on first open, not on page load.

### 4. Thumb Zone Layout

ALL interactive elements are in the bottom 40% of the screen:
- **Pull the Cord** button (full-width, prominent)
- **See on Map** and **Refresh** secondary buttons
- Upcoming prediction rows (tappable to see bus on map)

The top is for reading: hero number, progress strip, status information. This respects how people hold phones — thumbs reach the bottom naturally.

### 5. Pull the Cord

The namesake feature. A big red button at the bottom that says "Pull the Cord." Tapping it:
1. Requests browser notification permission
2. Enters "watching" mode — the button turns green and shows live ETA
3. When the bus is ≤ 2 minutes away, fires a browser notification + vibration
4. Tapping again cancels

**Why:** This solves the "staring at phone" problem. Pull the cord, pocket your phone, and you'll get buzzed when it's time to look up. It also gives the app its personality — the name "Pullcord" finally has a literal interaction.

### 6. Multi-Route at One Stop

Route tabs appear automatically when other routes serve this stop. Discovered client-side via the existing stops API (no server changes). Tapping a different route navigates to the same stop with that route.

**Why:** The user's real question is stop-centric ("what's coming to WHERE I AM?"), not route-centric. Showing all available routes makes the answer complete.

### 7. Dark Transit Display Aesthetic

The entire tracker uses a dark theme (#090e1a background) that looks like an electronic transit information display. High contrast white text, route-color accents, green for live status.

**Why:** This isn't a style preference — it's functional. At a bus stop (often outdoors, varying light), high-contrast dark displays are more readable than light UIs with subtle shadows. It also reduces battery usage on OLED screens. And it makes the giant green "NOW" unmissable.

### 8. Real-Time Countdown Between Polls

Rather than showing a number that's stale for up to 30 seconds, a local timer decrements the displayed ETA every second. The number smoothly counts down: 7... 6... 5... Every 30s when fresh data arrives, it corrects to the server value.

**Why:** The existing 30-second polling is a backend constraint. The frontend shouldn't feel constrained by it. A live-ticking countdown feels dramatically more real-time, even though the underlying data granularity is the same.

## What Was Kept

- 30-second polling cycle (unchanged API contract)
- All three prediction tiers (active/next/scheduled) with staleness dots
- Click-to-focus (tap an upcoming row to see its bus on map)
- Route shapes, stop data, vehicle markers (all available in map panel)
- Mock mode (?mock=1)
- Same endpoints, same response format

## Information Hierarchy (top to bottom)

```
┌──────────────────────────────┐
│  ← 4  Inman Park    ● 4:21  │  ← Compact header (context)
├──────────────────────────────┤
│           Tracker data tabs  │  ← Route tabs (if multi-route)
│                              │
│            7                 │  ← HERO: giant countdown
│           min                │
│      → Lindbergh Station     │
│         arrives ~4:28am      │
│                              │
│  ○─○─○─○─◆═══●─○─○─○─○     │  ← Progress strip
│           BUS    YOU         │
│        "3 stops away"        │
│                              │
│  Coming up                   │
│  → Midtown     ● Live  14m  │  ← Upcoming predictions
│  → Inbound     ○ Sched 60m  │
│                              │
├──────────────────────────────┤
│  ┌─────────────────────────┐ │
│  │   🔔 PULL THE CORD     │ │  ← THUMB ZONE
│  └─────────────────────────┘ │
│  [See on Map]    [Refresh]   │
└──────────────────────────────┘
```

## Files

- **BusTracker.tsx** — Complete structural reimagination. Dark shell, hero countdown, progress strip section, upcoming list, action bar with pull cord, map panel overlay.
- **app.js** — New rendering engine. Hero display with live countdown timer, SVG progress strip generator with direction-aware stop matching, pull cord notification system, lazy map initialization, multi-route discovery.
- **app.css** — Full Tailwind v4 input. Dark transit-display palette, massive hero typography with clamp() responsive sizing, progress strip styling, thumb zone action bar, map panel with slide-up animation, all staleness indicators.
- **Home.tsx** — Same structure, adapted to match the dark aesthetic.
- **DESIGN.md** — This file.
