# Pullcord Design System

*Documented: 2026-02-28*

---

## Fonts

### Bus Pages (full experience)
- **Sans:** Inter (400, 500, 600, 700, 800) — via Google Fonts
- **Mono:** JetBrains Mono (400, 500, 600, 700, 800) — via Google Fonts
- Loaded with `preconnect` + `display=swap`
- CSS vars: `--font-sans`, `--font-mono`

### Rail Pages (standalone)
- **Sans:** System stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`
- **Mono:** None (no data-heavy mono displays yet)
- Zero external font requests

### Cost Breakdown
| Asset | Size (woff2) | Round Trips |
|-------|-------------|-------------|
| Inter (5 weights) | ~100-120KB | 1 (gstatic) |
| JetBrains Mono (5 weights) | ~80-100KB | 1 (gstatic) |
| Google CSS | ~2KB | 1 (googleapis) |
| **Total** | **~200KB** | **3** |

Plus `preconnect` setup cost (~100ms DNS+TLS to two origins).

### What the Fonts Buy
- **Inter**: Tighter tracking than system sans at small sizes, cleaner at 0.85-1rem. Visible upgrade on Android (Roboto default is wider, looser).
- **JetBrains Mono**: Tabular-nums by default. All countdown numbers, ETAs, route badges, times — this is what makes the data feel "designed" vs. plain. The mono width means numbers don't jump around when they tick down.

### Cheaper Alternatives for Lightweight Pages
1. **System sans + system mono** — 0KB. Looks fine on iOS (SF Pro), rougher on Android.
2. **Inter only (2 weights: 400+700)** — ~40KB. Drop mono, use `font-variant-numeric: tabular-nums` on system sans.
3. **Self-host subset** — Strip to latin-only, 2 weights each. Inter drops to ~25KB, JetBrains Mono to ~20KB. ~45KB total, 1 round trip (same origin).

---

## Color System

### CSS Custom Properties
All colors defined as CSS vars on `:root`, overridden in `@media (prefers-color-scheme: dark)`.

### Brand
- **Primary:** `#E85D3A` (coral/orange) — used for CTAs, active states, the cord, logo
- **Brand hover:** `#D24A31`
- **Brand active:** `#BC3F28`

### Semantic Colors (Light / Dark)
| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--bg-primary` | `#FDF8F2` (warm cream) | `#090E1A` (near-black blue) | Page background |
| `--bg-surface` | `#FFF` | `#111827` | Cards, elevated surfaces |
| `--text-primary` | `#3B2820` (warm brown) | `#F1F5F9` | Headings, stop names |
| `--text-body` | `#5C4030` | `#CBD5E1` | Body text |
| `--text-muted` | `#A89282` | `#8896A8` | Secondary info, timestamps |
| `--live-green` | `#0D9488` (teal) | `#22C55E` (green) | Live status dots |
| `--live-delayed` | `#F0A030` (amber) | `#EAB308` (yellow) | Delayed/late |

### Rail-Specific Colors (Accessible)
Shifted from MARTA's official colors for CVD (color vision deficiency) safety:
| Line | Dark Mode | Light Mode |
|------|-----------|------------|
| Red | `#E05555` | `#B33030` |
| Gold | `#D4A020` | `#8B6D14` |
| Blue | `#4A9FE5` | `#1A6BB5` |
| Green | `#3BAA6E` | `#1B7A45` |

Direction letters (N/S/E/W) on pills as non-color backup.

---

## Typography Scale

### Bus Pages
| Element | Font | Size | Weight |
|---------|------|------|--------|
| Hero countdown | JetBrains Mono | `clamp(5rem, 22vw, 9rem)` | 800 |
| Hero unit (MIN) | JetBrains Mono | 1.5rem | 500 |
| Stop name (header) | Inter | 0.85rem | 600 |
| Arrival headsign | Inter | 0.95rem | 600 |
| ETA minutes | JetBrains Mono | 2rem | 800 |
| Route badge | JetBrains Mono | 1.15rem | 800 |
| Tier label | JetBrains Mono | 0.8rem | 600 |
| Meta/timestamp | JetBrains Mono | 0.85rem | — |
| Action buttons | JetBrains Mono | 0.9rem | 600 |

### Rail Pages
| Element | Font | Size | Weight |
|---------|------|------|--------|
| Station name | System sans | 1.15rem | — |
| Pill (direction + time) | System sans | 1rem | 700 |
| Station detail time | System sans | 1.1rem | 700 |
| Direction heading | System sans | 0.85rem | 700 |

### Design Rule
**Mono for numbers, sans for names.** Every countdown, ETA, route number, and timestamp uses `--font-mono`. Every stop name, headsign, and label uses `--font-sans`. This creates two visual "layers" — the data layer (mono, high-contrast, tabular) and the label layer (sans, natural reading).

---

## Data Presentation Patterns

### Arrival Rows
- Color-coded left border (5px, route color)
- Route number (mono, bold, colored) → Headsign (sans, truncated) → ETA (mono, right-aligned, large)
- Status line: dot (live/delayed/stale/rescued) + tier label + adherence + estimated time
- `font-variant-numeric: tabular-nums` on all numbers so columns don't shift

### Hero Countdown
- Huge center number (5-9rem responsive)
- Pulse animation when arriving (< 60s)
- Color shift: arriving (green) → soon (amber)
- Progress bar below: stop position along route

### Pills (Rail)
- Fixed 66px width — numbers don't reflow
- Direction letter + colon + minutes (`:03`)
- Background = line color, white text
- Pulse when arriving

### Status Dots
- 7px circles, color-coded
- `dot-live` (green, breathing animation)
- `dot-rescued` (amber, breathing) — GPS-computed ETAs
- `dot-stale` (orange, static)
- `dot-lost` (red, static)

---

## What Translates to marta.io's Weight Budget

marta.io target: **~35KB total** (currently 33KB: 3KB HTML + 9KB CSS + 21KB htmx).

### Translates Directly
- **CSS variable system** — the entire color palette is just `:root` declarations. ~2KB.
- **Dark/light mode** — single `@media (prefers-color-scheme: dark)` override block. ~1KB.
- **Data presentation patterns** — arrival rows, color-coded borders, status dots. These are pure CSS, no framework dependency.
- **Semantic token naming** — `--text-primary`, `--bg-surface`, etc. Portable across any CSS.
- **Tabular nums** — `font-variant-numeric: tabular-nums` works on system fonts. The columns still won't jump.

### Translates with Adaptation
- **Mono personality** — JetBrains Mono is 80-100KB. But `ui-monospace` (system mono) + tabular-nums gets 80% there. Or self-host a 2-weight latin subset (~20KB) for the real thing.
- **Inter** — System sans is honestly fine for marta.io's simpler layout. The difference is most visible at small sizes (0.85rem meta text), which marta.io has less of.

### Doesn't Translate
- **Tailwind CSS** — 62KB compiled. Overkill for marta.io. Hand-written CSS is the right call.
- **Component complexity** — Ride view (map + stop list + cord + push), explore (Leaflet). Too heavy. marta.io is a single-purpose view.

### Recommended Approach for marta.io
1. **Copy the CSS vars block** from Pullcord's `:root` — instant design consistency.
2. **Use system fonts** — `font-family: -apple-system, system-ui, sans-serif` for sans, `ui-monospace, monospace` for data numbers.
3. **Adopt the row pattern** — left border + route badge + headsign + right-aligned ETA. Works in plain HTML/CSS.
4. **If font personality matters**: self-host Inter latin 400+700 (~25KB woff2, one file). That's the single biggest visual upgrade per byte.

### Cost Table
| Option | Added Size | Visual Impact |
|--------|-----------|---------------|
| CSS vars only | ~2KB | Colors match, fonts don't |
| + system mono for numbers | 0KB | Numbers feel intentional |
| + Inter 400+700 (self-host, latin) | ~25KB | Full Pullcord sans feel |
| + JetBrains Mono 400+700 (self-host) | ~20KB | Full Pullcord mono feel |
| **Total "full vibe"** | **~47KB** | **Indistinguishable from Pullcord** |

At 47KB fonts + marta.io's existing 33KB = 80KB total. Still lighter than a single hero image on most transit apps.
