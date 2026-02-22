# Rail Views Shootout — Shared Spec

## Your Job
Write a COMPLETE `views.ts` file. Save it to the path specified in your task instructions.

## API Contract (import from "../api" — do NOT modify the API)
```typescript
interface RailArrival {
  station: string; line: "GOLD"|"RED"|"BLUE"|"GREEN"; destination: string;
  direction: string; waitSeconds: number; waitTime: string; trainId: string;
  tripId: string; nextArr: string; isRealtime: boolean; hasStarted: boolean;
  isFirstStop: boolean; eventTime: string;
}

// Available imports from "../api":
// fetchArrivals(): Promise<RailArrival[]>
// byStation(arrivals: RailArrival[]): Map<string, RailArrival[]>
// stationSlug(name: string): string
// stationDisplayName(name: string): string  
// stationLines(arrivals: RailArrival[]): Set<string>
// type RailArrival (re-export)
```

## Required Exports
```typescript
export async function landingView(partial?: boolean): Promise<string>
export async function stationView(slug: string, partial?: boolean): Promise<string | null>
export async function trainView(trainId: string, partial?: boolean): Promise<string | null>
```

## Three Views Required

### 1. Landing — Station List
- All stations, each with **per-direction pills** showing next arrival minutes
- Five Points worst case: 4 directions (N/S/E/W), one pill each
- Line color dots showing which lines serve each station
- At-a-glance: soonest train per direction, no scrolling needed for top stations
- Each station links to `/rail/{slug}`

### 2. Station Detail
- All upcoming arrivals at this station, **sorted soonest-first globally**
- Direction badge PER ROW (not section headers) — small badge like "↑N" or "→E"
- Line pill + destination + time per row
- Each arrival links to `/rail/train/{trainId}`
- Back link to `/rail`

### 3. Train Detail
- **Vertical timeline** — a visible line running through stops
- Station name on one side, time on the other
- Arrived/current-stop marker (filled dot vs hollow)
- Line color theming
- Back link to `/rail`

## Hard Constraints
- **Single file**, zero external dependencies
- Import ONLY from `"../api"` (note: relative path from candidates/)
- ALL CSS inline in a `<style>` tag — no external sheets
- Include inline polling JS: ~10s interval, `GET ?partial=1`, replace `#rail-body` innerHTML
- `partial=true` → return just `<main>` inner content (no html/head/body shell)
- **Mobile-first. Minimum readable font: 0.88rem. NOTHING smaller. Test this.**
- Dark mode default + `@media (prefers-color-scheme: light)` override
- WCAG AA contrast (4.5:1 minimum for text)
- Line colors: GOLD=#c9a227, RED=#cc3333, BLUE=#0074d9, GREEN=#2ecc40
- Max-width container ~480px, centered on desktop
- Include a live pulse indicator + "Xs ago" freshness counter
- Footer: `MARTA Rail · <a href="https://bus.marta.io">Bus</a> · <a href="https://home.jake.town">home.jake.town</a>`

## Competitor to BEAT (marta.io landing page pattern)
```
airport     N :09  S :16
arts center N :14  S :05
five points N :06  S :13  E :02  W :01
```
Direction letter + colon + minutes. Compact, scannable, glanceable. Match or exceed this.

## Line Station Ordering (for train timeline view)
```
RED: Airport → College Park → East Point → Lakewood → Oakland City → West End → Garnett → Five Points → Peachtree Center → Civic Center → North Ave → Midtown → Arts Center → Lindbergh → Buckhead → Medical Center → Dunwoody → Sandy Springs → North Springs
GOLD: Airport → ... → Lindbergh → Lenox → Brookhaven → Chamblee → Doraville
BLUE: Hamilton E Holmes → West Lake → Ashby → Vine City → Omni Dome → Five Points → Georgia State → King Memorial → Inman Park → Edgewood Candler Park → East Lake → Decatur → Avondale → Kensington → Indian Creek
GREEN: Bankhead → Ashby → Vine City → Omni Dome → Five Points → Georgia State → King Memorial → Inman Park → Edgewood Candler Park
```

## Quality Bar
This is a competitive shootout. 4 other agents are writing the same thing with different aesthetics. The human picks the winner. Make it count.
