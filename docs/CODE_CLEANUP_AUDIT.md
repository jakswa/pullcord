# Pullcord Code Cleanup Audit

Generated: 2026-02-19

---

## 1. public/app.js

### 1.1 `routePrefix` variable set but never read
- **Line 745**: `const routePrefix = this.multiRoute && this.heroPrediction.routeBadge ? ... : '';`
- The variable is assigned but never referenced. The headsign rendering on lines 747–749 builds its own inline HTML with `this.heroPrediction.routeBadge` directly, making `routePrefix` dead.
- **Confidence: Certain**

### 1.2 `window.__BASE_PATH__` referenced but never set
- **Lines 78, 340, 1588**: `const basePath = window.__BASE_PATH__ || '';`
- No server-side code sets `window.__BASE_PATH__` — it always resolves to `''`. All three usages are effectively dead code; basePath is always empty string. The variable itself is harmless (no-op), but the three const declarations are unnecessary indirection.
- **Confidence: Certain** (no `__BASE_PATH__` in any server-side `.tsx` or `.ts` file)

### 1.3 `hero-badge` element hidden but never used
- **Line ~734**: `const badgeEl = document.getElementById('hero-badge'); if (badgeEl) badgeEl.style.display = 'none';`
- The `hero-badge` span is created in `BusTracker.tsx` (line ~64), immediately hidden by JS, and never shown. The old badge was replaced by inline route numbers in the headsign. Both the HTML element and the JS that hides it are dead.
- **Confidence: Certain**

### 1.4 `mockMode` read from URL but mock paths are API-side only
- **Line 345**: `this.mockMode = params.has('mock');`
- **Line 386**: `const qs = this.mockMode ? '?mock=1' : '';`
- `mockMode` is only appended to the single-route fetch path. In the multi-route branch (line 394), mock is never sent. The single-route path does use it, so it's partially live. Not dead code per se, but the `this.mockMode` property is set on every tracker init even when never used (home page, multi-route mode).
- **Confidence: Uncertain** (works for single-route, but the multi-route path ignores it)

### 1.5 `activeStopMarker` — assigned but never updated or removed
- **Line 12**: `this.activeStopMarker = null;`
- Set once in `addActiveStopMarker()` (line ~1483), never referenced again. The marker is added to the map and forgotten. If the map were re-initialized or the stop changed, the old marker would leak.
- **Confidence: Likely** (minor; map is init-once so no actual leak today)

### 1.6 `var eta` in `computeClientETA` (eta.js, used by app.js)
- **public/eta.js line 63**: `var eta = deltaSec;` — uses `var` instead of `let`/`const` in an otherwise modern codebase. Not dead, but inconsistent style.
- **Confidence: Certain** (style issue, not dead code)

---

## 2. public/explore.js

### 2.1 `activePopupStopId` set but never read
- **Line 19**: `let activePopupStopId = null;`
- **Line 238**: `activePopupStopId = stop.stop_id;`
- Written to when a popup opens, but never read anywhere (no conditional logic uses it). Dead variable.
- **Confidence: Certain**

### 2.2 No other dead code found
- `pendingFilter` looks dead at first glance but is consumed on lines 105–107 after data loads.
- `filteredStops`, `markers`, `userMarker` are all actively used.
- The IIFE pattern is clean with no unused functions.

---

## 3. public/ride.js

### 3.1 `nearestIndex` — set but never read
- **Line 11**: `let nearestIndex = -1;`
- **Line ~243**: `if (d < minDist) { minDist = d; nearestIndex = i; }` (in the geolocation watchPosition handler)
- Written to in `startTracking()` whenever the user's GPS updates, but never used for any logic, rendering, or display. Dead variable — likely a vestige of planned "your nearest stop" feature.
- **Confidence: Certain**

### 3.2 `watchId` — set but never cleared
- **Line 12**: `let watchId = null;`
- **Line ~225**: `watchId = navigator.geolocation.watchPosition(...)`
- Assigned the watch ID but never passed to `clearWatch()`. The ride view is a full page, so the watch just dies on navigation — not a bug, but the variable is technically write-only.
- **Confidence: Certain** (dead variable, not a bug)

### 3.3 `routeLine` — assigned but never read
- **Line 14**: `let routeLine = null;`
- **Line ~131**: `routeLine = L.polyline(coords, {...}).addTo(map);`
- Saved to a variable but never referenced afterwards (no removal, no style update). Dead variable.
- **Confidence: Certain**

### 3.4 No cleanup on page exit
- No `beforeunload` listener to clear the geolocation watch or intervals. Not dead code, but a minor resource concern on SPA-style navigations (though this app is MPA so it's fine).
- **Confidence: Uncertain** (not a bug in MPA)

---

## 4. src/routes/*.tsx and src/views/**/*.tsx

### 4.1 `ETACard` component — entirely unused
- **File: `src/views/components/ETACard.tsx`**
- Exports `ETACard` and `ETACardProps`. Grep across the entire `src/` tree shows zero imports. This component is dead — likely from an earlier iteration before the hero countdown design.
- **Confidence: Certain**

### 4.2 `BusTrackerPage` — `hero-badge` span is dead HTML
- **File: `src/views/pages/BusTracker.tsx`, line ~64**
- `<span class="d-hero-badge" id="hero-badge"></span>` — rendered in multi-route mode but immediately hidden by `app.js` line ~734 (`badgeEl.style.display = 'none'`). The badge was replaced by inline route numbers in the headsign text. Dead element.
- **Confidence: Certain**

### 4.3 `BusTrackerPage` — Tailwind utility classes on error pages
- **File: `src/routes/bus.tsx`, lines ~56–82**
- Error divs use Tailwind utility classes (`min-h-screen bg-gray-50 flex items-center justify-center`, `bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700`) but the app uses a custom CSS approach (styles.css). These Tailwind classes may not be compiled/present in styles.css, making them dead styling. Same pattern in `src/app.ts` error/404 handlers.
- **Confidence: Likely** (depends on Tailwind config — if using `@source` scanning, they may compile, but they look like leftovers from a framework template)

### 4.4 Layout — `description` prop passed by bus.tsx but not by home.tsx
- Not dead code — just noting that `home.tsx` relies on the Layout default description. This is fine.
- **Confidence: N/A** (not a finding)

---

## 5. src/data/*.ts

### 5.1 `checkCords` — exported but never imported externally
- **File: `src/data/push.ts`, line 182**
- `export async function checkCords(...)` — exported, but only called internally within `push.ts` (line 293 in `pollForCords()`). No other file imports it. The `export` keyword is unnecessary.
- **Confidence: Certain**

### 5.2 `martaEtaSeconds` — set server-side, never consumed
- **File: `src/data/realtime.ts`, lines 47, 380**
- `arr.martaEtaSeconds = arr.etaSeconds;` — saved onto the prediction object for "comparison" but nothing ever reads it. Not consumed by the API response handlers, not referenced in client JS. Dead data field.
- **Confidence: Certain**

### 5.3 `PredictionUpdate` interface — legacy, identical to `ArrivalPrediction`
- **File: `src/data/realtime.ts`, lines 25–34 vs 37–52**
- The `PredictionUpdate` interface is noted as "Legacy type — kept for backward compatibility. Identical to ArrivalPrediction." It's used as the return type of `getPredictions()`, which itself is only called by `push.ts`. Could be consolidated into `ArrivalPrediction`.
- **Confidence: Likely** (low-risk cleanup)

### 5.4 `gtfs-import.ts` — standalone script, not part of app
- **File: `src/data/gtfs-import.ts`**
- This is a standalone import script (has `#!/usr/bin/env bun` shebang), not imported by any app code. Not dead code — it's a utility. But worth noting it lives in `src/data/` rather than a `scripts/` directory.
- **Confidence: N/A** (not dead, just organizational)

### 5.5 `getNearbyStops` return type mismatch
- **File: `src/data/db.ts`, line ~429**
- `export function getNearbyStops(...)` typed as returning `Stop[]` but the class method returns `(Stop & { distance: number })[]`. The convenience wrapper drops the `distance` field from the type signature. Not dead code but a type inaccuracy.
- **Confidence: Certain** (type bug, works at runtime via JS duck-typing)

---

## 6. src/app.ts — Route Registration Check

All registered routes are actively used:

| Registration | Route File | Serves | Status |
|---|---|---|---|
| `app.route("/api", apiRoutes)` | `routes/api.ts` | 14 API endpoints | ✅ Active |
| `app.route("/", homeRoutes)` | `routes/home.tsx` | `GET /` | ✅ Active |
| `app.route("/", busRoutes)` | `routes/bus.tsx` | `GET /bus`, `GET /stop` | ✅ Active |
| `app.route("/", aboutRoutes)` | `routes/about.tsx` | `GET /about` | ✅ Active |
| `app.route("/", exploreRoutes)` | `routes/explore.tsx` | `GET /explore` | ✅ Active |
| `app.route("/", rideRoutes)` | `routes/ride.tsx` | `GET /ride` | ✅ Active |
| `app.get("/push-sw.js", ...)` | inline | Service Worker | ✅ Active |
| `app.get("/health", ...)` | inline | Health check | ✅ Active |

**No orphan routes found.**

### 6.1 `GET /stop` redirect — possibly stale
- **File: `src/routes/bus.tsx`, lines ~121–124**
- `app.get("/stop", ...)` redirects old `/stop?id=` URLs to `/bus?stop=`. This is a compatibility redirect. If no external links use `/stop?id=` anymore, it's dead. Hard to verify without access logs.
- **Confidence: Uncertain**

---

## 7. Root-level Files

### 7.1 `index.ts` — dead root file
- **File: `/pullcord/index.ts`**
- Contains only `console.log("Hello via Bun!");` — a leftover from project init. The actual entry point is `src/index.ts`.
- **Confidence: Certain**

### 7.2 `investigate-feeds.ts` and `investigate-timestamps.ts`
- Debug/investigation scripts at the root. Not imported by any app code.
- **Confidence: Certain** (dead for production, but may be useful dev utilities)

---

## Summary — Priority Cleanup List

### Quick wins (certain, safe to remove):
1. **`public/app.js:745`** — Delete `routePrefix` variable
2. **`public/explore.js:19`** — Delete `activePopupStopId` variable and line 238 assignment
3. **`public/ride.js:11`** — Delete `nearestIndex` variable and assignment in watchPosition
4. **`public/ride.js:12,225`** — Delete `watchId` variable (or use it for cleanup)
5. **`public/ride.js:14,131`** — Delete `routeLine` variable (keep the `L.polyline().addTo()` call)
6. **`src/views/components/ETACard.tsx`** — Delete entire file
7. **`src/views/pages/BusTracker.tsx:~64`** — Delete `hero-badge` span + corresponding app.js hide logic
8. **`public/app.js:734`** — Delete `hero-badge` hide code
9. **`src/data/realtime.ts:47,380`** — Remove `martaEtaSeconds` field (set but never read)
10. **`/pullcord/index.ts`** — Delete root-level hello-world file

### Medium effort (likely, review before removing):
11. **`src/data/push.ts:182`** — Remove `export` from `checkCords` (internal only)
12. **`src/data/realtime.ts:25–34`** — Consolidate `PredictionUpdate` into `ArrivalPrediction`
13. **`public/app.js:78,340,1588`** — Remove `__BASE_PATH__` references (always empty string)
14. **`public/eta.js:63`** — Change `var eta` to `let eta`
15. **`src/data/db.ts:~429`** — Fix `getNearbyStops` return type to include `distance`

### Investigate further:
16. **`src/routes/bus.tsx:~56–82`** — Verify Tailwind classes in error pages actually compile
17. **`src/routes/bus.tsx:121–124`** — Check if `/stop?id=` redirect is still needed
18. **Root-level `investigate-*.ts`** — Move to `scripts/` or delete if no longer needed
