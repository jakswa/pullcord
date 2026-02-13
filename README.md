# Pullcord 🚌

Real-time MARTA bus tracker. Pull the cord. Catch your ride.

**Live:** [pullcord.home.jake.town](https://pullcord.home.jake.town)

## Features

- **Live GPS tracking** — bus positions updated every 30s via MARTA GTFS-RT
- **ETA predictions** — three-tier system (active, next trip, scheduled)
- **Hero countdown** — biggest bus ticks every second
- **Pull the Cord** — web push notification when your bus is close (2/5/10/15 min threshold)
- **Direction swap** — tap any prediction to track the other way
- **Favorites** — save stops for quick access
- **Light/dark mode** — follows system preference
- **Mobile-first** — designed for standing at a bus stop in the sun

## Stack

- **Runtime:** [Bun](https://bun.sh)
- **Server:** [Hono](https://hono.dev) (SSR JSX)
- **Database:** SQLite (bun:sqlite) — GTFS static data
- **Map:** Leaflet + CartoDB tiles
- **CSS:** Tailwind v4
- **Fonts:** Inter (body) + JetBrains Mono (data)
- **Push:** Web Push API + VAPID

## Setup

```bash
# Install dependencies
bun install

# Download GTFS data and build database
./tools/refresh-gtfs.sh

# Copy env template
cp .env.example .env
# Edit .env with your MARTA API key and VAPID keys

# Build CSS
bun x @tailwindcss/cli -i src/styles/app.css -o public/styles.css

# Run
bun run src/index.ts
```

## Environment Variables

```
MARTA_API_KEY=       # MARTA GTFS-RT API key
PORT=4200            # Server port
VAPID_PUBLIC_KEY=    # Web Push VAPID public key (generate with web-push)
VAPID_PRIVATE_KEY=   # Web Push VAPID private key
VAPID_EMAIL=         # Contact email for VAPID (mailto:you@example.com)
```

## GTFS Refresh

MARTA publishes schedule updates periodically. Refresh with:

```bash
./tools/refresh-gtfs.sh
```

This downloads the latest GTFS feed, rebuilds the SQLite database, and restarts the service. Consider running weekly via cron.

## Docs

- `docs/BUILD_SPEC.md` — original build specification
- `docs/DEV_FLOW.md` — development workflow patterns
- `docs/TIMESTAMP_ANALYSIS.md` — MARTA data freshness analysis
- `docs/VEHICLE_VS_TRIPS_ANALYSIS.md` — vehicle vs trip update feed analysis
- `docs/EXPERIMENTS_REVIEW.md` — UI experiment comparison notes

## License

MIT
