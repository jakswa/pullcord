# Pullcord — Build Spec for Sub-Agent

## What You're Building
A real-time MARTA bus tracker. Hono SSR app on Bun with SQLite + Leaflet maps.

User opens `pullcord.home.jake.town/?route=39&stop=204230` and sees their bus on a map with ETAs.

## Reference Files
- `./reference/HONO_YOLO.md` — Hono SSR patterns (READ THIS FIRST)
- `./reference/BUS_TRACKER_PLAN.md` — Product plan + UX design
- `./reference/DATA_PIPELINE_PROOF.md` — Data pipeline proof with real numbers
- `./reference/pipeline_prototype.js` — Working prototype script
- `./reference/gtfs-realtime.proto` — Protobuf definitions
- `./reference/.env` — Contains MARTA_API_KEY

## Stack
- **Runtime:** Bun (installed at ~/.local/bin/bun)
- **Framework:** Hono with JSX SSR
- **Database:** SQLite via `bun:sqlite` (NOT Prisma, NOT PostgreSQL)
- **Styling:** Tailwind CSS v4
- **Map:** Leaflet + OpenStreetMap (client-side)
- **Protobuf:** protobufjs (already in package.json)
- **CSV parsing:** csv-parse (already in package.json)

## Project Root
`./`

package.json, tsconfig.json, and node_modules already exist.

## Architecture

### Server (Hono SSR)
Renders pages server-side. Also serves JSON API endpoints for client-side polling.

### Client JS
Vanilla JS in `public/app.js`. Initializes Leaflet map, polls API every 30s, updates bus positions + ETAs. NO framework, NO build step for client code.

### SQLite
`data/marta.db` — pre-built from GTFS static CSVs. Queried at runtime.

## Project Structure
```
pullcord/
  src/
    index.ts              # Entry: starts Bun server
    app.ts                # Hono app, middleware, route mounting
    routes/
      home.tsx            # GET / — discovery page (search stops)
      bus.tsx             # GET /bus — main tracker view (SSR)
      api.ts              # GET /api/* — JSON endpoints for client polling
    views/
      Layout.tsx          # HTML shell (head, scripts, Leaflet CSS)
      pages/
        Home.tsx          # Discovery: stop search, geolocation
        BusTracker.tsx    # Map container + ETA cards (SSR shell)
      components/
        ETACard.tsx       # Single direction ETA display
    data/
      db.ts               # SQLite connection + query helpers
      gtfs-import.ts      # Script: GTFS CSVs → SQLite
      realtime.ts         # GTFS-RT fetch + protobuf decode + cache
  public/
    app.js                # Client-side: Leaflet map, polling, UI updates
  data/
    gtfs/                 # Raw GTFS CSV files (gitignored)
  gtfs-realtime.proto     # Protobuf schema
  .env                    # MARTA_API_KEY (gitignored)
  BUILD_SPEC.md
```

## SQLite Schema (`data/marta.db`)

```sql
CREATE TABLE routes (
  route_id TEXT PRIMARY KEY,
  route_short_name TEXT,
  route_long_name TEXT,
  route_color TEXT,
  route_text_color TEXT
);

CREATE TABLE stops (
  stop_id TEXT PRIMARY KEY,
  stop_name TEXT,
  stop_lat REAL,
  stop_lon REAL
);

CREATE TABLE trips (
  trip_id TEXT PRIMARY KEY,
  route_id TEXT,
  trip_headsign TEXT,
  direction_id INTEGER,
  shape_id TEXT
);

CREATE TABLE shapes (
  shape_id TEXT,
  shape_pt_lat REAL,
  shape_pt_lon REAL,
  shape_pt_sequence INTEGER
);
CREATE INDEX idx_shapes_id ON shapes(shape_id);

CREATE TABLE stop_times (
  trip_id TEXT,
  stop_id TEXT,
  stop_sequence INTEGER,
  arrival_time TEXT,
  departure_time TEXT
);
CREATE INDEX idx_stop_times_trip ON stop_times(trip_id);
CREATE INDEX idx_stop_times_stop ON stop_times(stop_id);

-- Derived: which routes serve which stops
CREATE TABLE route_stops (
  route_id TEXT,
  stop_id TEXT,
  direction_id INTEGER,
  UNIQUE(route_id, stop_id, direction_id)
);
CREATE INDEX idx_route_stops_route ON route_stops(route_id);
CREATE INDEX idx_route_stops_stop ON route_stops(stop_id);
```

## GTFS Import Script (`src/data/gtfs-import.ts`)

Run with: `bun run src/data/gtfs-import.ts`

1. Download MARTA GTFS from https://itsmarta.com/MARTA_GTFS_Latest_Feed.zip (or use already-downloaded at ./reference/data/gtfs/)
2. Parse CSVs with csv-parse
3. Insert into SQLite tables
4. Build route_stops derived table from stop_times + trips
5. Report row counts

The GTFS data is already downloaded at `./reference/data/gtfs/`. Copy or symlink it.

## API Endpoints (`src/routes/api.ts`)

### GET /api/routes
All bus routes. Cached indefinitely (static data).
```json
[{"route_id":"39","short_name":"39","long_name":"Buford Highway","color":"..."}]
```

### GET /api/stops?q=peachtree
Search stops by name. Returns top 20 matches.
```json
[{"stop_id":"204230","name":"PEACHTREE RD @ PIEDMONT","lat":33.812,"lon":-84.362,"routes":["39","110"]}]
```

### GET /api/stops?lat=33.81&lon=-84.36&radius=500
Nearest stops by geolocation.

### GET /api/route/:routeId
Route detail: shape polylines + stops on route.
```json
{
  "route": {"route_id":"39","short_name":"39","long_name":"Buford Highway"},
  "shapes": {"0": [[lat,lon],...], "1": [[lat,lon],...]},
  "stops": [{"stop_id":"204230","name":"...","lat":...,"lon":...,"direction_id":0}]
}
```

### GET /api/realtime/:routeId
Live bus positions + trip updates for a route. This hits MARTA GTFS-RT, decodes protobuf, enriches with SQLite data. Cached 30 seconds.
```json
{
  "timestamp": 1707764730,
  "vehicles": [
    {"id":"2301","lat":33.71,"lon":-84.27,"bearing":160,"speed":11.2,"headsign":"Lindbergh Center Station","tripId":"10921550","staleSeconds":15}
  ]
}
```

### GET /api/predictions/:routeId/:stopId
ETA predictions for a specific stop. Filters trip updates to matching stop.
```json
{
  "stop": {"stop_id":"204230","name":"..."},
  "predictions": [
    {"vehicleId":"2301","headsign":"Lindbergh Center Station","etaSeconds":240,"staleSeconds":15}
  ]
}
```

## Realtime Module (`src/data/realtime.ts`)

- Fetches both GTFS-RT protobuf endpoints using API key from .env
- Decodes with protobufjs using gtfs-realtime.proto
- Caches decoded results for 30 seconds
- Enriches vehicle positions with trip_headsign from SQLite
- Filters trip updates by route_id and stop_id
- Exports: `getVehicles(routeId)`, `getPredictions(routeId, stopId)`

Copy the gtfs-realtime.proto to the project root:
```
cp ./reference/gtfs-realtime.proto ./
```

## SSR Pages

### Home Page (GET /)
Discovery view. Shows:
- Search bar for stop names (autocomplete from /api/stops?q=)
- "Use my location" button (browser geolocation → /api/stops?lat=&lon=)
- Results: list of stops with their routes
- Click a stop+route → navigates to /bus?route=X&stop=Y

### Bus Tracker (GET /bus?route=39&stop=204230)
Main view. Server renders the page shell with:
- Route info (name, color) from SQLite
- Stop info (name, lat, lon) from SQLite
- Initial data embedded as `<script>window.__INITIAL_DATA__ = {...}</script>`

Client JS (public/app.js) takes over:
- Inits Leaflet map centered on stop
- Draws route shape
- Places stop markers
- Starts polling /api/realtime/:routeId and /api/predictions/:routeId/:stopId every 30s
- Updates bus dots and ETA cards

### Layout (views/Layout.tsx)
```html
<html>
<head>
  <title>{title} — Pullcord</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9/dist/leaflet.css" />
  <link rel="stylesheet" href="/public/styles.css" />
</head>
<body>
  {children}
  <script src="https://unpkg.com/leaflet@1.9/dist/leaflet.js"></script>
  <script src="/public/app.js"></script>
</body>
</html>
```

## Client JS (`public/app.js`)

Vanilla JS. No framework. No build step.

Key functions:
- `initMap(centerLat, centerLon, zoom)` — creates Leaflet map
- `drawRoute(shapes, color)` — draws route polylines
- `drawStops(stops, activeStopId)` — places stop markers, highlights active
- `updateBuses(vehicles)` — moves/creates bus markers with bearing arrows
- `updateETAs(predictions)` — updates ETA cards below map
- `startPolling(routeId, stopId, intervalMs)` — fetches realtime + predictions

ETA card HTML structure (updated by JS):
```html
<div class="eta-card" data-direction="0">
  <div class="eta-headsign">→ Lindbergh Center Station</div>
  <div class="eta-time">4 min</div>
  <div class="eta-detail">Bus 2301 · 0.8 mi away</div>
  <div class="eta-freshness fresh">Updated 12s ago</div>
</div>
```

## Tailwind CSS

Use Tailwind v4. Input file at `src/styles/main.css`:
```css
@import "tailwindcss";
```

Build command: `bunx @tailwindcss/cli -i ./src/styles/main.css -o ./public/styles.css`

Design: Clean, mobile-first. Dark header with route info. White cards for ETAs. Map takes most of viewport height. Think transit app, not museum piece.

## .env
```
MARTA_API_KEY=<copy from ./reference/.env>
PORT=4200
```

## Entry Point (`src/index.ts`)
```typescript
import app from './app';
const port = process.env.PORT || 4200;
console.log(`🚌 Pullcord running on http://localhost:${port}`);
export default { port, fetch: app.fetch };
```

## Caddy
The server will run on port 4200. Caddy config needed:
```
pullcord.home.jake.town {
    reverse_proxy localhost:4200
}
```

## What to Build (Priority Order)

1. **GTFS import** — get the SQLite DB built and queryable
2. **Realtime module** — protobuf decode + caching
3. **API routes** — all /api/* endpoints working
4. **Bus tracker page** — SSR shell + client JS with Leaflet
5. **Home/discovery page** — stop search
6. **Tailwind styling** — make it look good

## Testing

After building, verify:
1. `bun run src/data/gtfs-import.ts` — creates data/marta.db with correct row counts
2. `bun run src/index.ts` — server starts on port 4200
3. `curl localhost:4200/api/routes` — returns JSON array of routes
4. `curl localhost:4200/api/realtime/39` — returns live bus positions
5. `curl localhost:4200/api/predictions/39/204230` — returns ETAs
6. Browser: `localhost:4200/bus?route=39&stop=204230` — shows map with buses

## DO NOT
- Do not use Prisma. Use bun:sqlite directly.
- Do not use React or any client-side framework. Vanilla JS only.
- Do not add authentication. This is a public tool.
- Do not over-engineer. Ship a working MVP.
- Do not forget to copy .env and gtfs-realtime.proto to the project root.
