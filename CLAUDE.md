# Pullcord

MARTA real-time transit tracker. Hono SSR/JSX server on Bun; client is vanilla JS in `public/`.

## Quick Start

```sh
bun install
bun run dev        # builds CSS then starts server with --hot reload
bun test           # runs tests via bun's built-in runner
```

## CSS Build

`public/styles.css` is generated from `src/styles/app.css` via Tailwind:

```sh
bun run build:css          # one-shot build
bun run dev:css            # watch mode
```

**Never hand-edit `public/styles.css`** -- it is gitignored and rebuilt on every deploy.

## Project Layout

- `src/index.ts` -- entry point: runs migrations, starts Hono server, schedules cron jobs (GTFS refresh, metrics)
- `src/app.ts` -- Hono app with routes, static serving, security headers, health check
- `src/routes/` -- page and API route handlers (JSX views)
- `src/data/` -- SQLite data layer (`bun:sqlite`)
  - `push.ts` -- Web Push subscription store; creates `cords.db` lazily on first subscription
  - `db.ts` / `realtime.ts` -- GTFS + MARTA realtime queries against `marta.db`
  - `migrate.ts` -- schema migrations run at startup
- `public/` -- static assets (JS, icons, service worker); served at `/public/*`
- `tools/` -- offline scripts: `gen-icons.mjs`, `gen-og.mjs`, `generate-rail-assets.mjs`, `refresh-gtfs.sh`, `screenshot.mjs`
- `tests/` -- test files
- `docs/` -- design docs and plans

## Databases

- **`marta.db`** -- GTFS schedule data (read-only at runtime). Seeded in Docker via `entrypoint.sh`; refreshed weekly by cron.
- **`cords.db`** -- push notification subscriptions ("cords"). Created lazily by `src/data/push.ts` on first Web Push registration. Separate DB so GTFS refreshes don't lock push writes.

Both live under `data/` locally and `/data/` (Fly volume) in production.

## Deploy

Fly.io via `fly.toml` + `Dockerfile` (base: `oven/bun:1-alpine`). `entrypoint.sh` seeds `marta.db` to the persistent volume on first boot, then runs `bun run src/index.ts`.

## Key Dependencies

- **hono** -- HTTP framework (SSR JSX)
- **web-push** -- VAPID push notifications
- **protobufjs** -- decode GTFS-realtime protobuf feeds
- **croner** -- cron scheduling (GTFS refresh, metrics)
- **tailwindcss / @tailwindcss/cli** -- CSS build
- **playwright** -- browser tests (dev dependency)
