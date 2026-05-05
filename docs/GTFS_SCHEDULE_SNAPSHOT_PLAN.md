# GTFS Schedule Snapshot Plan

**Goal:** survive MARTA publishing a future GTFS zip before that schedule is live, without breaking user-facing route-number URLs/bookmarks.

## Core model

- Users/bookmarks use stable public identity: `route_short_name` + `stop_id`.
  - Example: `/bus?route=121&stop=500212`
- Internal `routes.route_id` is not durable and may change between GTFS publications.
- Each GTFS zip is a complete schedule snapshot. Do not upsert snapshots into one DB namespace.
- MARTA developer page provides the zip effective date. Use that as the primary activation signal.

## Target filesystem layout

```text
data/
  schedules/
    2026-04-18/
      marta.db
      gtfs/
      manifest.json
    2026-08-xx/
      marta.db
      gtfs/
      manifest.json
  active-schedule -> schedules/2026-04-18
  previous-schedule -> schedules/...
  candidate-schedule -> schedules/2026-08-xx   # optional symlink
  cords.db
```

`manifest.json`:

```json
{
  "effectiveDate": "20260418",
  "downloadedAt": "2026-05-05T...Z",
  "sourceUrl": "https://itsmarta.com/google_transit_feed/google_transit.zip",
  "pageUrl": "https://itsmarta.com/app-developer-resources.aspx",
  "routeCount": 86,
  "tripCount": 52401
}
```

## Implementation tasks

### 1. Add effective-date scraper

Create `src/data/gtfs-effective-date.ts`.

- Fetch `https://itsmarta.com/app-developer-resources.aspx`.
- Parse `Effective Date: 4/18/2026` near `google_transit.zip`.
- Normalize to `YYYYMMDD`.
- Fail closed if missing/unparseable; do not import blind.

### 2. Change refresh to build a new snapshot DB

Modify `src/data/gtfs-import.ts`.

- Add a function like `buildGTFSDatabase({ dbPath, gtfsDir })`.
- It should create a brand-new SQLite DB file.
- Import static tables into that empty DB.
- No live DB writes during build.
- Validate row counts and required tables before marking snapshot usable.

### 3. Add schedule manager

Create `src/data/schedules.ts`.

Responsibilities:

- Resolve current active DB path: `data/active-schedule/marta.db`.
- List available snapshots by `manifest.effectiveDate`.
- Promote newest snapshot whose `effectiveDate <= today`.
- Keep `previous-schedule` before switching.
- Refuse promotion if DB validation fails.

### 4. Make DB connection reopenable

Modify `src/data/db.ts`.

Current singleton opens DB once. Add a lightweight schedule-aware opener:

- Read active DB path on startup.
- Expose `reloadDatabaseIfActiveChanged()` or restart process after promotion.
- Simplest production-safe option: promote symlink, then restart app.

### 5. Keep route URLs user-facing

Do **not** require users to bookmark internal IDs.

Update server route resolution:

- `/bus?route=121&stop=500212` remains valid.
- `getRoute("121")` resolves within the active schedule DB only.
- Remove ambiguity by ensuring active DB contains only one GTFS snapshot.

### 6. Clean up search/favorite shape later, not first

Frontend may keep storing route short names for favorites. That is okay.

Optional improvement:

```json
{
  "routeShortName": "121",
  "stopId": "500212",
  "stopName": "GOLDSMITH PARK & RIDE",
  "lastResolvedRouteId": "26956"
}
```

`lastResolvedRouteId` is a cache only; always resolve route short name against active schedule on load.

### 7. Health check

Modify `/health` to include:

```json
{
  "schedule": {
    "activeEffectiveDate": "20260418",
    "activeDb": "/data/schedules/2026-04-18/marta.db",
    "candidateEffectiveDate": null,
    "duplicateRouteShortNames": 0,
    "routeCount": 86,
    "tripCount": 52401
  }
}
```

Active DB should have zero duplicate `route_short_name` for normal bus routes unless MARTA actually publishes duplicates in one feed.

### 8. Production-safe rollout

1. Deploy code that can read old `data/marta.db` and new `active-schedule` layout.
2. On first run, if no `active-schedule`, create snapshot from existing `data/gtfs` + `data/marta.db` or current zip, but do not overwrite old DB.
3. Verify health shows active effective date and no duplicate route short names.
4. Only then disable direct weekly in-place import.
5. Keep old `data/marta.db` as rollback until new path is stable.

## Promotion rule

Primary rule:

```text
promote snapshot when effectiveDate <= local Atlanta service date
```

Because MARTA page publishes an effective date, RT comparison is not needed for normal switching.

Safety check only:

- If effectiveDate <= today but live GTFS-RT trip match is near zero, do not auto-promote; alert/log loudly.
- This is a guardrail, not the main decision mechanism.

## Tests

Add tests for:

1. Effective date parser handles MARTA's messy HTML.
2. Two snapshots with route `121` resolve to different internal route IDs depending on active symlink.
3. `/bus?route=121&stop=...` still works after active snapshot switch.
4. Importing candidate snapshot does not alter active DB.
5. Promotion updates active symlink and preserves previous symlink.

## Non-goals

- No user-facing internal route IDs.
- No calendar hacking.
- No merging rows from multiple GTFS zips into one DB.
- No RT-driven switching unless MARTA effective date is missing or contradictory.
