# GTFS-RT / Static Schedule Mismatch Investigation

Date: 2026-05-05

## Scope

Investigated why buses appear to disappear on `bus.marta.io` around MARTA static GTFS schedule publication/refresh.

Constraint from Jake: do **not** update or refresh GTFS data while investigating. This investigation used read-only DB/API checks and did not run the importer.

## Main finding

The live GTFS-RT feeds were compatible with the currently extracted static GTFS files at the time of investigation, but the SQLite DB contained rows from more than one static GTFS publication. Because route short names are not scoped to a feed/version, short-name route lookups can resolve to stale route IDs with no live buses.

This is a data/modeling problem, not simply a protobuf compatibility problem.

## Evidence

### Local repo / process

Repo path:

```text
/home/jake/workspace/pullcord
```

Local app was running:

```text
/home/jake/.local/bin/bun run --hot src/index.ts
```

It listens on port 4200 and has a weekly GTFS refresh cron in `src/index.ts`:

```ts
new Cron("0 3 * * 0", { timezone: "America/New_York" }, async () => {
  await refreshGTFS();
});
```

A local `MARTA_API_KEY` exists in `.env` and was also present in the running process environment. Key value was not recorded here.

### Static DB contains more rows than current extracted GTFS files

Command summary:

```text
routes.txt: 86 rows; DB routes: 204 rows; extra in DB: 118
trips.txt: 52401 rows; DB trips: 98615 rows; extra in DB: 46214
```

So the DB is not just the current extracted feed. It contains historical/stale rows.

### Duplicate route short names in DB

Examples:

```text
route_short_name  c  route_ids
121               2  27386,26956
15                2  27333,26913
2                 2  27324,26904
```

Comparison against current `data/gtfs/routes.txt`:

```text
27386 NOT in current routes.txt
26956 in current routes.txt

27324 NOT in current routes.txt
26904 in current routes.txt

27333 NOT in current routes.txt
26913 in current routes.txt
```

### Production API symptom

Production `bus.marta.io` showed live vehicles for the canonical/current internal route IDs, but none for ambiguous short-name route IDs:

```text
/api/realtime/121:   0 vehicles
/api/realtime/26956: 6 vehicles

/api/realtime/2:     0 vehicles
/api/realtime/26904: 8 vehicles
```

This supports the hypothesis that buses “disappear” when the app resolves a short route name to a stale route row.

### MARTA developer page effective date

The hosting page is:

```text
https://itsmarta.com/app-developer-resources.aspx
```

It does specify an effective date for the current zip link. As of this investigation, raw page HTML showed:

```html
<a href="google_transit_feed/google_transit.zip">google_transit.zip</a>
(20MB, ZIP) <em>Effective Date: 4/18/2026</em>
<a href="google_transit_feed/April18_2026_google_transit.zip"></a>
```

This matches the local current extracted feed calendar start (`20260418`).

### GTFS-RT compatibility check

Decoded live protobufs using local `gtfs-realtime.proto` and local API key.

At time of check:

```text
vehiclepositions.pb: 216 entities
tripupdates.pb:      ~428-431 entities depending on poll
```

Live trip IDs matched current extracted static `data/gtfs/trips.txt`:

```text
vehicle trip_ids in trips.txt:     216/216 (100.0%)
trip update trip_ids in trips.txt: ~431/431 (100.0%)
```

Live GTFS-RT `route_id` fields are short/display IDs such as `"121"`, `"2"`, etc., while SQLite `routes.route_id` contains internal IDs such as `26956`, `26904`. Direct route ID comparison is therefore not a valid compatibility check for MARTA; trip ID matching is the reliable signal.

## Code paths implicated

### Importer merges feeds

`src/data/gtfs-import.ts` imports static GTFS using `INSERT OR REPLACE` into shared tables:

- `routes`
- `stops`
- `trips`
- `shapes`
- `stop_times`
- `calendar`
- `calendar_dates`

It does not maintain a feed/version boundary. It also does not clear old rows that disappear from a newly published GTFS feed, except for limited expired-service cleanup.

Important nuance: MARTA may publish a new static feed while the old schedule is still active. Therefore, blindly deleting old rows immediately on download may be wrong. The real issue is merging snapshots without versioning/scoping.

### Short-name lookups are ambiguous in polluted DB

`getRoute(routeIdentifier)` accepts either `route_id` or `route_short_name`:

```sql
WHERE route_id = ? OR route_short_name = ?
```

Once stale and current route rows coexist, this can select the wrong generation.

### Frontend stores/uses route short names as route IDs in some links

In `public/app.js`, stop cards with one route build links with `stop.routes[0]`, where `stop.routes` is an array of short names:

```js
const stopLink = stop.routes.length > 1
  ? `${basePath}/bus?stop=${stop.stop_id}`
  : `${basePath}/bus?route=${stop.routes[0]}&stop=${stop.stop_id}`;
```

This can create URLs like:

```text
/bus?route=121&stop=...
```

which then rely on ambiguous short-name backend resolution.

Favorites have a similar risk because they store/display route short names.

### Backend route detail uses raw input after resolving route

`getRouteDetail(routeId)` calls:

```ts
const route = this.getRoute(routeId);
```

but subsequent queries use the original `routeId` parameter rather than the resolved `route.route_id`. For short-name inputs, this can produce empty route details even if `getRoute()` found a route row.

## What is proven vs not proven

Proven:

1. The DB contains stale route/trip rows not present in current extracted GTFS files.
2. Duplicate route short names exist across stale/current internal route IDs.
3. Production returns zero buses for ambiguous short-name API calls while returning live buses for current canonical route IDs.
4. Live GTFS-RT trip IDs matched current extracted `trips.txt` at the time of testing.

Not yet proven:

1. Exact best architecture for handling MARTA publishing new schedules before cutover.
2. Whether Fly production volume has exactly the same stale/current mix as local beyond observed API behavior.
3. The safest promotion threshold/algorithm for switching active static snapshots.
4. Whether fixing frontend route IDs alone masks most symptoms without addressing the underlying feed-version problem.

## Sane next step before fixing

Do not start by deleting old data. First design and test a schedule snapshot boundary.

A minimal safe design to evaluate:

- Build/import each downloaded static GTFS feed as a complete separate snapshot, not merged rows.
- Determine the active snapshot by comparing live GTFS-RT trip IDs against candidate snapshots.
- Resolve route short names only inside the active snapshot.
- Ensure frontend/API links use canonical route IDs from the active snapshot.
- Keep backward compatibility for old short-name URLs, but resolve them within active snapshot only.

Potential implementation shapes:

1. Separate DB files: `marta-active.db`, `marta-next.db`, with promotion after live GTFS-RT matches `next`.
2. Single DB with `feed_id` columns on static GTFS tables and queries scoped to active `feed_id`.

No implementation was done in this investigation.

## Reproduction snippets

Read-only checks used during investigation:

```bash
cd /home/jake/workspace/pullcord

python3 - <<'PY'
import csv, sqlite3
con=sqlite3.connect('data/marta.db')
for table,file in [('routes','routes.txt'),('trips','trips.txt')]:
    csv_rows=sum(1 for _ in csv.DictReader(open('data/gtfs/'+file)))
    db_rows=con.execute(f'select count(*) from {table}').fetchone()[0]
    print(f'{file}: {csv_rows} rows; DB {table}: {db_rows} rows; extra in DB: {db_rows-csv_rows}')
PY
```

```bash
sqlite3 -readonly data/marta.db <<'SQL'
.headers on
.mode column
SELECT route_short_name, COUNT(*) c, GROUP_CONCAT(route_id) route_ids
FROM routes
WHERE route_short_name IN ('121','2','15')
GROUP BY route_short_name;
SQL
```

```bash
python3 - <<'PY'
import urllib.request,json
base='https://bus.marta.io'
for rid in ['121','26956','2','26904']:
    with urllib.request.urlopen(f'{base}/api/realtime/{rid}', timeout=10) as r:
        d=json.load(r)
    print(f'/api/realtime/{rid}: {len(d.get("vehicles",[]))} vehicles')
PY
```
