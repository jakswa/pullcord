# Rail Views Shootout V2 — Beat marta.io

You're competing against marta.io (Atlanta's existing MARTA rail tracker) and against 2 other AI agents writing the same thing. The human will pick ONE winner.

## What marta.io does well (and you must match or beat)
- **Big chunky pills** — each direction gets a capsule-shaped pill: colored circle with direction letter (N/S/E/W) on left, `:XX` time on right. Pills are ~44px tall, clearly visible background, feel like touch targets
- **Station name on left, pills on right** (same row for 2-direction stations, wrapping for 4-direction like Five Points)
- **Line colors in the direction circles** — Gold=#c9a227, Red=#cc3333, Blue=#0074d9, Green=#2ecc40
- **The pills ARE the entire design language** — not accessories, not afterthoughts. They're the hero element.

## What marta.io does poorly (your opportunity to WIN)
- No visual personality — it's functional but generic dark-mode web app
- Station detail view is just grouped lists, nothing special
- Train view is a basic vertical list
- No visual excitement — nothing makes you want to show it to someone

## API Contract (import from "../api" — do NOT modify)
```typescript
interface RailArrival {
  station: string; line: "GOLD"|"RED"|"BLUE"|"GREEN"; destination: string;
  direction: string; waitSeconds: number; waitTime: string; trainId: string;
  tripId: string; nextArr: string; isRealtime: boolean; hasStarted: boolean;
  isFirstStop: boolean; eventTime: string;
}
// Available: fetchArrivals(), byStation(arrivals), stationSlug(name), stationDisplayName(name), stationLines(arrivals)
```

## Required Exports
```typescript
export async function landingView(partial?: boolean): Promise<string>
export async function stationView(slug: string, partial?: boolean): Promise<string | null>
export async function trainView(trainId: string, partial?: boolean): Promise<string | null>
```

## Three Views

### 1. Landing — Station List
- All stations with per-direction pills (soonest train per direction)
- Station name + pills on same row (pills wrap for 4-direction stations)
- Each station links to `/rail-{X}/{slug}` (replace {X} with your letter)

### 2. Station Detail
- All arrivals sorted soonest-first (NOT grouped by direction)
- Direction badge per row + line pill + destination + time
- Each arrival links to `/rail-{X}/train/{trainId}`
- Back link to `/rail-{X}`

### 3. Train Detail
- Vertical timeline with visible line running through stops
- Station name + time, arrived marker for current stop
- Line color theming
- Back link to `/rail-{X}`

## Hard Constraints
- Single .ts file, zero external deps. Import ONLY from `"../api"`
- ALL CSS inline `<style>`. ALL JS inline `<script>`.
- Polling: 10s interval, GET `?partial=1`, replace `#rail-body`
- `partial=true` → return just inner content (no html/head/body)
- **MINIMUM font size 1rem for station names, 0.95rem for time values. NOTHING below 0.88rem anywhere.**
- Dark mode default + `@media (prefers-color-scheme: light)`
- WCAG AA contrast (4.5:1 min)
- 480px max-width, centered
- Live pulse + "Xs ago" freshness
- Footer: MARTA Rail · Bus link · home.jake.town link

## Line Station Ordering (for train timeline)
RED: Airport → College Park → East Point → Lakewood → Oakland City → West End → Garnett → Five Points → Peachtree Center → Civic Center → North Ave → Midtown → Arts Center → Lindbergh → Buckhead → Medical Center → Dunwoody → Sandy Springs → North Springs
GOLD: Airport → ... → Lindbergh → Lenox → Brookhaven → Chamblee → Doraville
BLUE: Hamilton E Holmes → West Lake → Ashby → Vine City → Omni Dome → Five Points → Georgia State → King Memorial → Inman Park → Edgewood Candler Park → East Lake → Decatur → Avondale → Kensington → Indian Creek
GREEN: Bankhead → Ashby → Vine City → Omni Dome → Five Points → Georgia State → King Memorial → Inman Park → Edgewood Candler Park
