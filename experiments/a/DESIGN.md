# Experiment A: Transit Pro — Design Decisions

## Design Philosophy

Transit Pro draws from professional transit apps like Transit (transitapp.com) and Citymapper: **dark themes that work outdoors, information density without clutter, and confident typography.** The goal is to make Pullcord feel like a polished, production transit app — the kind a city would want to white-label.

The core principle: **respect the user's time and context.** Someone at a bus stop in Atlanta sun needs big numbers, high contrast, and zero friction. Everything else supports that.

## Color System

### Dark Palette
```
Background:     #0d1117  — near-black with slight blue undertone
Surface:        #161b22  — cards, elevated elements
Surface hover:  #222c3a  — interaction feedback
Border:         rgba(255,255,255,0.08) — subtle structure
Text primary:   #e6edf3  — high contrast for readability
Text secondary: #8b949e  — supporting info
Text muted:     #6e7681  — labels, less important
```

Inspired by GitHub's dark theme — proven at scale for information-dense, long-session UIs. The slight blue undertone feels modern and techy without being cold.

### Why Dark Throughout?
1. **Outdoor readability** — counterintuitive, but high-contrast dark themes work well on OLED screens in sunlight (the black pixels are truly off, making light text pop)
2. **Battery life** — OLED screens use less power for dark UIs
3. **Night use** — transit doesn't stop at sunset; dark UI doesn't blind users at night
4. **Professional feel** — dark interfaces project confidence and premium quality
5. **Map integration** — dark UI blends seamlessly with CartoDB Dark Matter tiles

### Route Colors as Accent
Route colors (`routeColor` from MARTA data) appear as:
- Left border accent on ETA cards (4px strip)
- Route badge in header
- Map polyline with glow effect
- Bus marker backgrounds

On the dark canvas, these accents pop without overwhelming. The original design had route colors competing with white backgrounds; here they're the stars.

## Typography

**Inter** at weights 400/500/600/700/800 — the same font, just used with more intentionality:

| Element | Weight | Size | Purpose |
|---------|--------|------|---------|
| ETA numbers | 800 | 2.25rem | **The answer** — biggest, boldest |
| Route badge | 800 | 1.2rem | Route identity |
| Stop name | 600 | 0.9rem | Context |
| Meta info | 400 | 0.78rem | Supporting data |
| Labels | 500+uppercase | 0.65-0.7rem | Structure |

Key decisions:
- `font-variant-numeric: tabular-nums` on all numbers — prevents layout shift as ETAs tick down
- `letter-spacing: 0.05em` on uppercase labels — improves readability of small caps
- ETA numbers get a subtle `text-shadow` glow on dark backgrounds — adds depth without being flashy

## Map Changes

### Dark Matter Tiles
Switched from CartoDB Positron (light) to **CartoDB Dark Matter** (`dark_all`). This:
- Eliminates the jarring light/dark transition between ETAs and map
- Makes route polylines and bus markers pop more
- Creates a cohesive dark experience

### Route Shape Glow
Replaced the white outline + route color approach with a **glow effect**:
```
Wide layer:  routeColor, weight: 10, opacity: 0.2  (glow)
Narrow layer: routeColor, weight: 4, opacity: 0.9  (crisp line)
```
On dark tiles, this creates a neon-like glow that's both beautiful and functional — you can trace the route at a glance.

### Leaflet Dark Overrides
All Leaflet chrome (popups, zoom controls, attribution) is restyled dark:
- Popups: dark background, light text, matching border-radius
- Zoom controls: dark surface with subtle borders
- Attribution: semi-transparent dark background

## ETA Cards

### Structure (unchanged logic, refined presentation)
The three-tier prediction system stays exactly the same:
- **Active** — standard dark surface, bright white ETA numbers
- **Next** — blue-tinted background, blue ETA numbers (bus on another run)
- **Scheduled** — gray-tinted background, muted numbers, smaller text

### Staleness Indicators
Status dots gain a subtle `box-shadow` glow on dark backgrounds:
- 🟢 Live: green with green glow
- 🟡 Delayed: yellow with yellow glow
- 🟠 Stale: orange with orange glow
- 🔴 Lost: red with red glow

These are small (7px) but the glow effect makes them more visible on the dark surface — important information shouldn't be hard to find.

### Update Flash
Changed from `background: green-tint → white` to an **inset box-shadow** approach:
```css
@keyframes eta-flash {
  0% { box-shadow: inset 0 0 30px rgba(34, 197, 94, 0.08); }
  100% { box-shadow: none; }
}
```
This works regardless of the card's base background color (active, next, or scheduled tier), avoiding the need to hardcode background returns.

### Click-to-Focus
Clickable rows get an SVG chevron (replacing the `›` text character) for a more polished look. Active state darkens the card slightly and scales down 2% for tactile feedback.

## SVG Icons

All emoji/text-character icons replaced with SVG:
- **Back arrow** (←) → Chevron-left SVG
- **Recenter** (◎) → Crosshair/target SVG
- **Connection lost** (⚠️) → Warning triangle SVG
- **Direction arrow** (→ in group headers) → Arrow-right SVG
- **ETA chevron** (› text) → Chevron-right SVG

Consistent 2-2.5px stroke weight across all icons for visual harmony.

## Spacing & Density

Slightly tightened compared to the original:
- ETA card padding: 0.7rem (was 0.75rem)
- Card margin-bottom: 0.3rem (was 0.375rem)
- Group margin-bottom: 0.375rem (was 0.5rem)
- Section padding: 0.375rem 0.5rem (was 0.5rem)

These small reductions add up — more predictions visible without scrolling on a phone screen. Still comfortable touch targets (min-height: 3.25rem maintained).

## Home Page

Minimal changes — the original was already dark and clean. Refinements:
- Brand color updated to `#3b82f6` (slightly brighter blue for dark backgrounds)
- Locate button gets a subtle `box-shadow` glow in brand color
- Search input border uses the defined border variables for consistency
- Wordmark bumped to 2.5rem with tighter letter-spacing (-0.035em)

## What Stayed the Same

Everything functional:
- 30-second polling cycle with progress bar
- Three prediction tiers (active, next, scheduled)
- Four staleness tiers (live, delayed, stale, lost)
- Click-to-focus: tap an ETA card to zoom map to that bus
- Bidirectional predictions grouped by headsign
- Route shapes and stop dots on map
- Recenter button
- Offline indicator
- `window.__INITIAL_DATA__` and `window.__CONFIG__` consumed as-is
- All API routes and data structures unchanged

## What's Different (Summary)

| Aspect | Original | Transit Pro |
|--------|----------|-------------|
| Theme | Light body, dark header | Dark throughout |
| Map tiles | CartoDB Positron | CartoDB Dark Matter |
| Route shapes | White outline + color | Color glow effect |
| Card backgrounds | White | Dark surface (#161b22) |
| Card shadows | box-shadow | Border (1px solid) |
| Icons | Text chars + emoji | SVG throughout |
| Staleness dots | Flat color | Color + glow |
| Leaflet chrome | Default (white) | Dark-themed |
| Spacing | Standard | Slightly denser |
| Brand blue | #2563eb | #3b82f6 (brighter on dark) |
