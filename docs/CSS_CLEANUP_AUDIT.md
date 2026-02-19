# Pullcord CSS Cleanup Audit

**Date:** 2026-02-19  
**File:** `src/styles/app.css` (2545 lines)  
**Method:** Grep-based cross-reference of every class selector against all TSX templates (`src/views/**/*.tsx`) and client JS files (`public/*.js`)

---

## Summary

| Category | Count |
|---|---|
| Total class selectors | 242 |
| **Confirmed used** | 209 |
| **Dead classes** | 26 |
| **Dead keyframe animations** | 2 |
| **Undefined CSS custom properties** | 3 |
| **Estimated removable lines** | ~200 |

---

## 1. Dead CSS Classes (Safe to Remove)

### 🔴 Entire Dead Section: Multi-Stop View (`stop-*`)

The `/* ===== STOP VIEW (multi-route) ===== */` section (~90 lines) is **completely dead**. No TSX view file exists for this feature, and none of these classes appear in any JS file. This appears to be a removed/never-shipped feature.

| Selector | CSS rules | In TSX? | In JS? | Confidence |
|---|---|---|---|---|
| `.stop-shell` | 1 | ❌ | ❌ | 🔴 HIGH — remove |
| `.stop-header` | 1 | ❌ | ❌ | 🔴 HIGH — remove |
| `.stop-name` | 1 | ❌ (only `d-stop-name` exists) | ❌ | 🔴 HIGH — remove |
| `.stop-routes` | 1 | ❌ | ❌ | 🔴 HIGH — remove |
| `.stop-route-chip` | 1 | ❌ | ❌ | 🔴 HIGH — remove |
| `.stop-arrivals` | 1 | ❌ | ❌ | 🔴 HIGH — remove |
| `.stop-loading` | 1 | ❌ | ❌ | 🔴 HIGH — remove |
| `.stop-empty` | 1 | ❌ | ❌ | 🔴 HIGH — remove |
| `.stop-row` | 7 (incl. pseudo-states) | ❌ | ❌ | 🔴 HIGH — remove |
| `.stop-row-selected` | 1 | ❌ | ❌ | 🔴 HIGH — remove |
| `.stop-row-badge` | 2 (incl. animation ref) | ❌ | ❌ | 🔴 HIGH — remove |
| `.stop-row-headsign` | 1 | ❌ | ❌ | 🔴 HIGH — remove |
| `.stop-eta` | 3 | ❌ | ❌ | 🔴 HIGH — remove |
| `.stop-eta-abs` | 1 | ❌ | ❌ | 🔴 HIGH — remove |
| `.stop-eta-now` | 1 | ❌ | ❌ | 🔴 HIGH — remove |
| `.stop-row-arriving` | 2 | ❌ | ❌ | 🔴 HIGH — remove |

> **Note:** `.stop-pulse` is NOT dead — it's used in `public/app.js` for map markers.

### 🔴 Dead Tracker Classes (Direction Swap Feature)

These belong to a direction-swap UI that was apparently removed:

| Selector | CSS rules | In TSX? | In JS? | Confidence |
|---|---|---|---|---|
| `.d-swap-row` | 3 (main + active + chevron) | ❌ | ❌ | 🔴 HIGH — remove |
| `.d-upcoming-dir-header` | 1 | ❌ | ❌ | 🔴 HIGH — remove |
| `.d-dir-arrow` | 1 | ❌ | ❌ | 🔴 HIGH — remove |
| `.d-dir-tap-hint` | 1 | ❌ | ❌ | 🔴 HIGH — remove |
| `.d-upcoming-chevron` | 3 (incl. active/swap refs) | ❌ | ❌ | 🔴 HIGH — remove |

### 🔴 Other Dead Classes

| Selector | CSS rules | In TSX? | In JS? | Confidence |
|---|---|---|---|---|
| `.d-badge-mini` | 1 | ❌ | ❌ | 🔴 HIGH — smaller route badge variant never used |
| `.d-header-routes` | 1 | ❌ | ❌ | 🔴 HIGH — route chip container in header |
| `.d-hero-map-link` | 2 (main + active) | ❌ | ❌ | 🔴 HIGH — "view on map" pill, replaced by map panel |
| `.d-ride-link` | 2 (main + hover) | ❌ | ❌ | 🔴 HIGH — ride link in progress meta |
| `.d-route-tab-active` | 1 | ❌ | ❌ | 🔴 HIGH — active state applied differently now |
| `.row-flash` | 1 (as modifier) | ❌ | ❌ | 🔴 HIGH — ETA flash animation never triggered |
| `.explore-title` | 1 | ❌ | ❌ | 🔴 HIGH — replaced by search bar |
| `.home-footer-sub` | 1 | ❌ | ❌ | 🔴 HIGH — sub-footer text |
| `.tracker-spinner` | 1 | ❌ | ❌ | 🔴 HIGH — legacy alias, `.d-spinner` is used instead |

---

## 2. Dead Keyframe Animations

| Animation | Referenced by CSS? | In TSX/JS? | Confidence |
|---|---|---|---|
| `d-cord-fire` | ❌ (0 CSS refs) | ❌ | 🔴 HIGH — cord pull animation, never wired up |
| `cord-yank` | ❌ (0 CSS refs) | ❌ | 🔴 HIGH — cord yank animation, never wired up |

> All other keyframes are actively referenced by CSS rules that are themselves in use.

---

## 3. Undefined CSS Custom Properties

These `var()` references point to custom properties that are **never defined in `:root`** or anywhere in the stylesheet:

| Variable | Where Used | Impact | Note |
|---|---|---|---|
| `--coral` | 20+ rules across Explore, Ride, Home, Tracker | 🟡 MEDIUM | Falls back to `initial` (transparent). Many of these use it for `color` and `background`, meaning they render invisible/transparent. Some have fallbacks like `var(--coral, #E85D3A)`. **Should be defined as `--coral: #E85D3A;` in `:root`, or replaced with `var(--brand)`.** |
| `--surface-raised` | `.home-map-btn`, `.explore-search-input` | 🟡 LOW | Background color falls back to transparent. Only 2 occurrences. Should be `var(--bg-surface)` or defined. |
| `--live-indicator` | `.stop-eta-now` | ⚪ NONE | Only used in dead `.stop-eta-now` — remove with stop view. |

These variables are **set via inline styles in JS** and are NOT bugs:
- `--bearing` (bus arrow rotation)
- `--bus-color` (per-route marker color)
- `--row-color` (per-route row border)
- `--tab-color` (per-route tab background)
- `--eta-flash` (flash color on update)
- `--route-color` (set on `.d-shell`)

---

## 4. Observations & Recommendations

### The `--coral` Problem
`--coral` is used extensively but never defined. It appears to be a legacy name for the brand color (`#E85D3A`). The new system uses `--brand`. Two fixes:
1. **Quick:** Add `--coral: #E85D3A;` to both light/dark `:root`.
2. **Clean:** Find-replace `var(--coral)` → `var(--brand)` everywhere. Some already use `var(--brand)` consistently.

### Duplicate Spinner
`.tracker-spinner` and `.d-spinner` are identical rules (same dimensions, colors, animation). `.d-spinner` is the active one; `.tracker-spinner` is dead. Remove it.

### Stop View — Remove Entire Section
The `/* ===== STOP VIEW (multi-route) ===== */` section is ~90 lines of dead CSS for a feature that was never shipped or was removed. Safe to delete the entire block from `.stop-shell` through `.stop-row-arriving`.

### Direction Swap Feature — Dead
The direction swap UI (`.d-swap-row`, `.d-upcoming-dir-header`, `.d-dir-arrow`, `.d-dir-tap-hint`, `.d-upcoming-chevron`) totals ~30 lines. All dead.

### Empty Comment Block
`.stop-row-arriving` has an empty comment `/* subtle pulse on the left border */` with no actual styles — just the child selector `.stop-row-arriving .stop-row-badge` matters, and it's dead anyway.

---

## 5. Full Cross-Reference Table (Confirmed Used)

<details>
<summary>Click to expand — 209 used selectors</summary>

All of the following were confirmed referenced in at least one TSX template or JS file:

**About page:** `about-back`, `about-brand`, `about-chip`, `about-content`, `about-footer`, `about-h2`, `about-header`, `about-link`, `about-link-card`, `about-link-desc`, `about-link-icon`, `about-links`, `about-link-title`, `about-list`, `about-logo`, `about-muted`, `about-section`, `about-shell`, `about-stack`, `about-stat`, `about-stat-label`, `about-stat-number`, `about-stats`, `about-update`, `about-update-date`, `about-update-img`, `about-update-text`, `about-wordmark`

**Bus tracker:** `d-action-bar`, `d-action-btn`, `d-action-divider`, `d-action-row`, `d-adherence`, `d-adherence-early`, `d-adherence-late`, `d-adherence-ontime`, `d-back`, `d-badge`, `d-content`, `d-cord-active`, `d-cord-cancel`, `d-cord-idle`, `d-cord-inline-icon`, `d-cord-install-hint`, `d-cord-label`, `d-cord-option`, `d-cord-options`, `d-cord-section`, `d-cord-x`, `d-empty-icon`, `d-empty-sub`, `d-empty-title`, `d-header`, `d-header-info`, `d-header-row`, `d-hero`, `d-hero-countdown`, `d-hero-empty`, `d-hero-eta`, `d-hero-headsign`, `d-hero-loading`, `d-hero-loading-text`, `d-hero-meta`, `d-hero-number`, `d-hero-route`, `d-hero-tier`, `d-hero-unit`, `d-live`, `d-live-dot`, `d-live-time`, `d-map`, `d-map-bar`, `d-map-close`, `d-map-panel`, `d-map-title`, `d-map-wrap`, `d-offline`, `d-progress`, `d-progress-label`, `d-progress-meta`, `d-progress-strip`, `d-recenter`, `d-refresh-bar`, `d-route-tab`, `d-route-tab-label`, `d-route-tabs`, `d-shell`, `d-spinner`, `d-stop-name`, `d-upcoming`, `d-upcoming-header`, `d-upcoming-headsign`, `d-upcoming-hero`, `d-upcoming-info`, `d-upcoming-label`, `d-upcoming-list`, `d-upcoming-meta`, `d-upcoming-minutes`, `d-upcoming-route`, `d-upcoming-row`, `d-upcoming-time`

**Home page:** `home-about-link`, `home-brand`, `home-content`, `home-fav-card`, `home-fav-link`, `home-fav-list`, `home-fav-name`, `home-fav-remove`, `home-fav-routes-inline`, `home-footer`, `home-header`, `home-header-inner`, `home-header-links`, `home-header-top`, `home-locate-btn`, `home-locate-hidden`, `home-locate-icon`, `home-locate-row`, `home-logo-icon`, `home-map-btn`, `home-map-toggle`, `home-results-header`, `home-results-list`, `home-search`, `home-search-wrap`, `home-shell`, `home-status`, `home-stop-arrow`, `home-stop-card`, `home-stop-distance`, `home-stop-info`, `home-stop-meta`, `home-stop-name`, `home-stop-routes-inline`, `home-wordmark`

**Explore map:** `explore-back`, `explore-cluster-label`, `explore-header`, `explore-loading`, `explore-locate`, `explore-locating`, `explore-map`, `explore-map-locate`, `explore-map-locate-wrap`, `explore-popup`, `explore-popup-badge`, `explore-popup-container`, `explore-popup-link`, `explore-popup-name`, `explore-popup-routes`, `explore-search-bar`, `explore-search-input`, `explore-shell`

**Ride view:** `ride-arrived`, `ride-back`, `ride-bus-arrow`, `ride-bus-icon`, `ride-cord-icon`, `ride-cord-stop`, `ride-cord-text`, `ride-cord-zone`, `ride-dest-tooltip`, `ride-header`, `ride-header-info`, `ride-headsign`, `ride-map`, `ride-panel`, `ride-panel-handle`, `ride-panel-header`, `ride-recenter-btn`, `ride-recenter-wrap`, `ride-route-badge`, `ride-shell`, `ride-stop`, `ride-stop-current`, `ride-stop-dest`, `ride-stop-dot`, `ride-stop-dot-dest`, `ride-stop-flag`, `ride-stop-info`, `ride-stop-list`, `ride-stop-name`, `ride-stop-passed`, `ride-stop-time`, `ride-stop-zone`

**Shared/utility:** `arriving`, `arriving-soon`, `bus-focused`, `bus-icon`, `bus-marker`, `bus-marker-arrow`, `bus-marker-focused`, `bus-marker-lost`, `bus-marker-stale`, `clickable`, `dot-delayed`, `dot-live`, `dot-lost`, `dot-next`, `dot-sched`, `dot-stale`, `fav-active`, `hidden`, `map-visible`, `refresh-flash`, `refreshing`, `route-stop-dot`, `stop-pulse`, `tier-active`, `tier-next`, `tier-scheduled`

</details>

---

## Cleanup Action Plan (Priority Order)

1. **Define `--coral`** — add `--coral: #E85D3A;` to `:root` (both modes), or better: replace all `var(--coral)` with `var(--brand)`. (~20 occurrences)
2. **Delete stop view section** — remove `.stop-shell` through `.stop-row-arriving` and the empty `.stop-row-arriving` comment block. (~90 lines)
3. **Delete direction swap classes** — remove `.d-swap-row`, `.d-upcoming-dir-header`, `.d-dir-arrow`, `.d-dir-tap-hint`, `.d-upcoming-chevron`. (~30 lines)
4. **Delete other dead classes** — `d-badge-mini`, `d-header-routes`, `d-hero-map-link`, `d-ride-link`, `d-route-tab-active`, `row-flash`, `explore-title`, `home-footer-sub`, `tracker-spinner`. (~30 lines)
5. **Delete dead keyframes** — `d-cord-fire`, `cord-yank`. (~12 lines)
6. **Define or replace `--surface-raised`** — 2 occurrences, should probably be `var(--bg-surface)`.

**Estimated total removal: ~160-200 lines (~8% of file)**
