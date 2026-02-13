# Experiment B — Departure Board

## Design Philosophy

**"What if a bus stop had a screen?"**

This design treats Pullcord as infrastructure, not an app. The reference points are airport departure boards, NYC subway countdown clocks, and train station platform displays — systems designed for one thing: telling you when the next thing arrives.

Everything is subordinate to the number.

## Key Decisions

### 1. The Number Is Everything

ETA minutes render at **3.75rem (60px) in JetBrains Mono** for active predictions. That's roughly 15mm on a phone screen — readable from several feet away. The visual hierarchy cascades by tier:

| Tier | Size | Color | Purpose |
|------|------|-------|---------|
| Active (live tracked) | 3.75rem | `#111827` (near-black) | Tracked bus, GPS confirmed |
| Next (another run) | 2.75rem | `#1e40af` (blue) | Bus exists but on a different trip |
| Scheduled (timetable) | 2.25rem | `#9CA3AF` (gray) | No GPS, schedule-based fallback |

The size cascade communicates confidence without words. Your eyes go to the biggest number first — that's the one you trust most.

### 2. Monospace for Data

**JetBrains Mono** handles all numeric and status text. Transit infrastructure uses monospace/tabular type because:
- Numbers align vertically across rows
- Width is predictable (tabular-nums)
- It signals "this is system data, not marketing copy"

Applied to: ETA numbers, arrival times, status labels, header update time, route badges, footer, results headers on home page.

### 3. High Contrast, Sunlight-First

White background (#FFFFFF) with near-black text (#111827). No gray backgrounds for content areas. This is designed for:
- Direct sunlight on a phone screen
- Glare and reflections
- Quick glance-ability

The only dark surface is the header strip — a thin identifier bar like a platform indicator, not a toolbar.

### 4. Flat Rows, Not Cards

Original design uses rounded cards with shadows. Departure boards don't have shadows. This experiment uses:
- **Thin 1px borders** between rows (not around them)
- **Route color as 6px left border** — the only accent
- **No border-radius** on rows (implied by default)
- **No box-shadows** anywhere in the ETA section

The visual effect is a table/ledger, not a feed of cards.

### 5. Status Through Color, Not Labels

Staleness is communicated primarily through colored dots:
- 🟢 Green (blinking): Live GPS data, <45s old
- 🟡 Yellow (blinking): Delayed, 45-90s
- 🟠 Orange: Stale, 90-180s
- 🔴 Red: Lost, >180s

Short text labels accompany dots but are secondary — the color is what you read first. Stale/lost messages are terser than the original ("~2m ago" vs "~2m ago · position may be off") because the departure board is no-nonsense.

### 6. Collapsible Map

The map exists for context ("where IS the bus?") but it's not the primary interface. A thin toggle bar between ETAs and map lets users collapse it entirely. When collapsed, the ETA section expands to fill available space — a pure departure board.

- Map starts visible (it provides value, especially for click-to-focus)
- Toggle bar uses monospace uppercase "HIDE MAP ▼" / "SHOW MAP ▲"
- Clicking an ETA row when the map is collapsed auto-expands it
- Leaflet `invalidateSize()` called after expand animation

### 7. Home Page: Light Theme Kiosk

The home page flips the original's dark background to white for the results area while keeping the dark hero for brand identity. Stop results render as flat rows (no card borders) — consistent with the departure board aesthetic on the tracker page.

Route chips use actual route colors and monospace font.

### 8. Typography Hierarchy

| Element | Font | Weight | Size |
|---------|------|--------|------|
| ETA number (active) | JetBrains Mono | 800 | 3.75rem |
| ETA number (next) | JetBrains Mono | 800 | 2.75rem |
| ETA number (sched) | JetBrains Mono | 800 | 2.25rem |
| Route badge | JetBrains Mono | 800 | 1.3rem |
| Stop name | Inter | 700 | 0.9rem |
| Status text | JetBrains Mono | - | 0.7rem |
| Section headers | JetBrains Mono | 700 | 0.65rem |
| Footer | JetBrains Mono | 500 | 0.6rem |

## Changes from Original

### HTML/Component Changes
- **Back arrow**: SVG chevron icon instead of `←` text character
- **Map toggle**: New `<button id="map-toggle">` between ETAs and map
- **Empty state**: Added info icon SVG
- **Connection status**: "CONNECTION LOST" (uppercase, no emoji)
- **Home logo**: Inverted colors (white bus on dark) to match light theme

### JavaScript Changes
- **Map toggle**: `toggleMap()` method with `invalidateSize()` on expand
- **Auto-expand**: `focusOnBus()` expands collapsed map before panning
- **Always show arrival time**: Removed `minutes >= 10` gate — departure boards always show the clock time
- **Terser staleness**: "~2m ago" instead of "~2m ago · position may be off"
- **All existing functionality preserved**: 30s polling, staleness tiers, three prediction tiers, click-to-focus, bidirectional grouping, bus markers, route shapes

### CSS Changes
- **White background** throughout tracker (was `#f8fafc`)
- **JetBrains Mono** for all data/numeric elements
- **3.75rem ETA numbers** (was 2.25rem) — 67% larger
- **No shadows** on ETA rows (was `box-shadow: 0 1px 3px...`)
- **6px route accent** border-left (was 4px)
- **Flat borders** between rows instead of card margins
- **Collapsible map** CSS with `.map-collapsed` and `.etas-expanded`
- **Uppercase monospace** for labels, headers, footer — infrastructure aesthetic
- **Stop pulse** uses dark (#111827) instead of red — less alarming, more structural

## Layout Requirements

### Layout.tsx Addition
Add JetBrains Mono to the Google Fonts link in Layout.tsx:
```html
<link 
  href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700;800&display=swap" 
  rel="stylesheet" 
/>
```

And update the theme-color meta tag for the light theme:
```html
<meta name="theme-color" content="#111827" />
```

## What This Optimizes For

1. **Speed of comprehension** — how fast can you answer "when's the next bus?"
2. **Sunlight readability** — white background, maximum contrast
3. **Distance readability** — 60px monospace numbers visible from 6+ feet
4. **Trust signal** — infrastructure aesthetic says "this is official data"
5. **Focus** — collapsible map keeps the departure board central

## What This Trades Away

1. **Visual warmth** — this is cold, functional, utilitarian by design
2. **Discovery** — first-time users get less visual guidance
3. **Map prominence** — map users need an extra tap to get their context
4. **Personality** — departure boards don't have personality; they have reliability
