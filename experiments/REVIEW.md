# Experiment Review — Visual Comparison with Mock Data

## Screenshots taken at 4:20am EST with mock bus data (Route 4, Inman Park station)

## Overall Verdict
Jake was right — the sub-agents were too conservative. All three variants are essentially reskins of the same layout. None rethought the actual *experience* of the tracker page. The ETA cards, map, header, footer — all in the same positions with just different colors/fonts.

## Per-Experiment Notes

### A — Transit Pro (Dark Theme)
**Strengths:**
- Dark map (CartoDB Dark Matter) is genuinely better for route visibility — magenta route POPS on black
- Cohesive dark surface — no jarring brightness shift between header and content
- Best nighttime/indoor readability
- Route-colored glow on polylines is a nice touch

**Weaknesses:**
- It's just... dark mode. Same layout, same cards, same structure
- Single ETA card visible (mock data issue? or layout?)
- Doesn't reimagine anything about the information architecture

**Keep:** Dark map tiles as an option. Route glow effect.

### B — Departure Board
**Strengths:**
- HIDE MAP toggle is the only experiment that questioned the map's role — smart
- Monospace intent is right for transit data
- Most sunlight-readable (white bg, no shadows)

**Weaknesses:**
- Monospace font didn't actually render consistently (mixed type systems)
- Single ETA card visible — the "departure board" aesthetic needs ROWS of data to work
- Still the same layout underneath the type treatment

**Keep:** Collapsible map toggle. The idea of treating this like infrastructure signage.

### C — Warm & Playful
**Strengths:**
- Genuinely distinct personality — you notice it instantly
- Coral brand color is memorable and rare in transit apps
- Friendly copy ("No buses right now. Time for a walk?")
- Card design is pillowy and inviting

**Weaknesses:**
- Palette doesn't extend to the map — warm header, cold map, disconnect
- Teal accent barely visible
- Route line color (from MARTA data) clashes with coral header
- "On another run" status pill feels like a different design system

**Keep:** The personality. The friendly empty states. Coral as a brand option.

## What Experiment D Should Do Differently

The brief should NOT be "restyle these pages." It should be:

1. **Rethink information architecture** — what does someone at a bus stop actually need?
2. **Question the map** — is a tiny Leaflet map actually useful? What would be better?
3. **ETA as the entire experience** — not a card in a list, but the HERO of the screen
4. **Stop-centric, not route-centric** — show all routes at this stop
5. **Progress indicator** — where is the bus in its journey? (linear progress bar, not geographic map)
6. **Thumb zone** — everything interactive at bottom half of screen

The map problem: a zoomed-out route line with a tiny dot tells you almost nothing. 
The map value: when a bus is close (<5 min), seeing it on a map IS useful.
Resolution: map could be hidden by default, revealed on tap, or only shown when a bus is nearby.
