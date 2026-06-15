import { raw } from "hono/html";
import type { RailArrival } from "../../../rail/api.js";
import { stationSlug, stationDisplayName, getRailApiError } from "../../../rail/api.js";

import {
  LINE_COLORS,
  LINE_STATIONS,
  STATION_COORDS,
  STATION_ORDER,
  DIR_ARROW,
  DIR_ORDER,
  formatTime,
  normalizeStation,
  buildStationRows,
} from "./data.js";
import type { DirArrival, StationRow } from "./data.js";
import { railStyles } from "./styles.js";
import { buildInlineJS } from "./client.js";

// Re-export sub-module API used by routes/tests.
export {
  LINE_COLORS,
  LINE_STATIONS,
  STATION_COORDS,
  STATION_ORDER,
  formatTime,
  normalizeStation,
  buildStationRows,
} from "./data.js";
export type { DirArrival, StationRow } from "./data.js";
export { railStyles } from "./styles.js";
export { buildInlineJS } from "./client.js";

// ── small server-side ETA classifier (mirrors client etaState) ──
type EtaKind = "now" | "min" | "approx";
function etaState(eta: number, rt: boolean): { kind: EtaKind; min: number } {
  if (eta < 60) return { kind: "now", min: 0 };
  const min = Math.max(1, Math.round(eta / 60));
  return { kind: rt ? "min" : "approx", min };
}

function lineColor(line: string): string {
  return LINE_COLORS[line as keyof typeof LINE_COLORS] || "#666";
}

// ── icons ──
function IconBack() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M13.5 4.5 7 11l6.5 6.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}
function IconStar({ filled }: { filled?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path
        d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.3L12 17.1l-5.7 3.1 1.2-6.3L2.8 9.5l6.4-.8L12 2.8z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linejoin="round"
      />
    </svg>
  );
}
function IconPin() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24">
      <path d="M12 21s7-5.8 7-11a7 7 0 1 0-14 0c0 5.2 7 11 7 11z" fill="currentColor" />
      <circle cx="12" cy="10" r="2.4" fill="var(--surface)" />
    </svg>
  );
}
function IconSearch() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" stroke-width="2" />
      <path d="M15.5 15.5 21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
  );
}

// ── atoms ──
function LineChip({ line, sm }: { line: string; sm?: boolean }) {
  return (
    <span class={`rail-chip mono${sm ? " rail-chip-sm" : ""}`} style={`background:${lineColor(line)}`}>
      {line.toLowerCase()}
    </span>
  );
}
// Compact per-direction token used in list rows: "N 4" colored by line.
function DirToken({ dir, a }: { dir: string; a: DirArrival }) {
  const s = etaState(a.eta, a.rt);
  return (
    <span class={`rail-dirtoken mono${s.kind === "now" ? " is-now" : ""}`}>
      <b style={`color:${lineColor(a.line)}`}>{dir}</b>
      <span>{s.kind === "now" ? "now" : s.min}</span>
    </span>
  );
}

// Banner shown when the MARTA rail API is unreachable.
function RailApiBanner() {
  if (!getRailApiError()) return null;
  return (
    <div class="rail-api-banner" role="status" aria-live="polite">
      MARTA's real-time rail API is currently unreachable. Live arrival times
      will return automatically once it recovers.
    </div>
  );
}

// Shared footer — present on every rail view.
function RailFooter() {
  return (
    <footer class="rail-footer">
      Real-time MARTA data via public API. Not affiliated with or endorsed by MARTA.
      <span> · <a href="/about">About marta.io</a></span>
    </footer>
  );
}

// ── Station list row (hidden source-of-truth; client projects into heroes + lists) ──
function StationRowEl({ row }: { row: StationRow }) {
  // Soonest arrival per direction in canonical order, for the compact tokens.
  const tokens = DIR_ORDER.filter((d) => row.dirs[d]?.length).map((d) => ({ dir: d, a: row.dirs[d][0] }));

  return (
    <a
      href={`/rail/${row.slug}`}
      class="rail-row"
      data-slug={row.slug}
      data-arr={JSON.stringify({ name: row.name.toLowerCase(), lines: row.lines, dirs: row.dirs })}
    >
      <span class="rail-row-name">{row.name.toLowerCase()}</span>
      <span class="rail-row-times">
        {tokens.map((t) => (
          <DirToken dir={t.dir} a={t.a} />
        ))}
      </span>
    </a>
  );
}

// Inner list — the single payload swapped on poll; lives hidden, projected by JS.
export function RailStationList({ arrivals }: { arrivals: RailArrival[] }) {
  const rows = buildStationRows(arrivals);
  return (
    <div class="rail-station-list">
      {rows.map((row) => (
        <StationRowEl row={row} />
      ))}
    </div>
  );
}

// ── Full landing page ──
export function RailLandingPage({ arrivals, standalone = false }: { arrivals: RailArrival[]; standalone?: boolean }) {
  const title = standalone ? "marta.io rail" : "MARTA Rail — Pullcord";

  return (
    <>
      {raw("<!DOCTYPE html>")}
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <title>{title}</title>
        <meta name="description" content="Real-time MARTA rail arrivals for all 38 stations." />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content="Real-time MARTA rail arrivals for all 38 stations." />
        <meta property="og:image" content="https://beta.marta.io/public/icons/og-rail.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        {standalone && <meta property="og:url" content="https://beta.marta.io/" />}
        <meta property="og:site_name" content="marta.io" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content="Real-time MARTA rail arrivals for all 38 stations." />
        <meta name="twitter:image" content="https://beta.marta.io/public/icons/og-rail.png" />
        {standalone && <link rel="manifest" href="/manifest.json" />}
        {standalone && <meta name="apple-mobile-web-app-capable" content="yes" />}
        {standalone && <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />}
        <meta name="apple-mobile-web-app-title" content="marta.io rail" />
        <link rel="apple-touch-icon" href="/public/icons/rail-192.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/public/icons/rail-favicon.png" />
        <meta name="theme-color" content="#0f0e0b" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#efeae0" media="(prefers-color-scheme: light)" />
        <style>{raw(railStyles())}</style>
      </head>
      <body class="rail-body">
        <div class="rail-shell">
          <header class="rail-header">
            <div class="rail-header-top">
              {!standalone && (
                <a href="/" class="rail-backbtn" aria-label="Back to home">
                  <IconBack />
                </a>
              )}
              <h1 class="rail-wordmark">marta<span>.io</span></h1>
              <span class="rail-live mono">
                <span class="rail-pulse"></span>
                <span class="rail-freshness" id="freshness">live</span>
              </span>
            </div>
          </header>
          <main class="rail-main">
            <RailApiBanner />
            {/* Hero cards (favorites) — built client-side from starred rows */}
            <div id="rail-heroes"></div>

            {/* Nearby — geo opt-in, hidden until populated */}
            <section class="rail-sect" id="rail-nearby-sect" hidden>
              <h2 class="rail-sect-h mono">nearby</h2>
              <div class="rail-rows" id="rail-nearby-rows"></div>
            </section>

            {/* All stations — searchable */}
            <section class="rail-sect">
              <h2 class="rail-sect-h mono">all stations</h2>
              <label class="rail-search">
                <IconSearch />
                <input id="rail-q" type="search" autocomplete="off" autocapitalize="off" spellcheck={false} placeholder="search stations" aria-label="Search stations" />
                <button class="rail-search-x" id="rail-q-x" type="button" aria-label="Clear search" hidden>×</button>
              </label>
              <div class="rail-rows" id="rail-all-rows"></div>
            </section>

            {/* Hidden source list — swapped wholesale on each poll, projected by reorder() */}
            <div id="rail-data" hidden>
              <RailStationList arrivals={arrivals} />
            </div>
          </main>
          <RailFooter />
        </div>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__COORDS=${JSON.stringify(STATION_COORDS)};window.__LC=${JSON.stringify(LINE_COLORS)};`,
          }}
        />
        <script dangerouslySetInnerHTML={{ __html: buildInlineJS(true) }} />
      </body>
      </html>
    </>
  );
}

// ── Station detail page (board) ──
export function RailStationPage({
  stationName,
  arrivals,
  standalone = false,
}: {
  stationName: string;
  arrivals: RailArrival[];
  standalone?: boolean;
}) {
  const displayName = stationDisplayName(stationName);
  const slug = stationSlug(stationName);
  const title = standalone
    ? `${displayName} — marta.io rail`
    : `${displayName} — MARTA Rail — Pullcord`;

  // Lines serving this station, canonical order, for the header chips.
  const lineSet = new Set(arrivals.map((a) => a.line));
  const lines = (["RED", "GOLD", "BLUE", "GREEN"] as const).filter((l) => lineSet.has(l));

  return (
    <>
      {raw("<!DOCTYPE html>")}
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <title>{title}</title>
        <meta name="description" content={`Real-time arrivals at ${displayName} station.`} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={`Real-time arrivals at ${displayName} station.`} />
        <meta property="og:image" content="https://beta.marta.io/public/icons/og-rail.png" />
        <meta name="twitter:card" content="summary_large_image" />
        {standalone && <link rel="manifest" href="/manifest.json" />}
        <link rel="apple-touch-icon" href="/public/icons/rail-192.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/public/icons/rail-favicon.png" />
        <meta name="theme-color" content="#0f0e0b" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#efeae0" media="(prefers-color-scheme: light)" />
        <style>{raw(railStyles())}</style>
      </head>
      <body class="rail-body">
        <div class="rail-shell">
          <header class="rail-header rail-topbar-sub">
            <a href="/rail" class="rail-backbtn" aria-label="Back to all stations" onclick="if(history.length>1){history.back();return false}">
              <IconBack />
            </a>
            <button class="rail-iconbtn" id="rail-fav" type="button" aria-label="Favorite this station">
              <IconStar />
            </button>
            <div class="rail-topbar-title">
              <span class="rail-topbar-name">{displayName.toLowerCase()}</span>
              <span class="rail-topbar-chips">
                {lines.map((l) => (
                  <LineChip line={l} sm />
                ))}
              </span>
            </div>
            <span class="rail-live mono">
              <span class="rail-pulse"></span>
              <span class="rail-freshness" id="freshness">live</span>
            </span>
          </header>
          <main class="rail-main">
            <RailApiBanner />
            <div id="rail-data">
              <RailStationDetail stationName={stationName} arrivals={arrivals} />
            </div>
          </main>
          <RailFooter />
        </div>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__RAIL_SLUG=${JSON.stringify(slug)};`,
          }}
        />
        <script dangerouslySetInnerHTML={{ __html: buildInlineJS(false) }} />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
var K="rail-starred",b=document.getElementById("rail-fav"),s=window.__RAIL_SLUG;
if(b&&s){function get(){try{return JSON.parse(localStorage.getItem(K))||[]}catch(e){return[]}}function on(){return get().indexOf(s)>-1}function paint(){b.classList.toggle("is-on",on());b.setAttribute("aria-pressed",on()?"true":"false")}b.addEventListener("click",function(){var a=get(),i=a.indexOf(s);if(i>-1)a.splice(i,1);else a.push(s);localStorage.setItem(K,JSON.stringify(a));paint()});paint()}
// direction filter — delegated so it survives poll swaps; re-applied via postUpdate
var curDir="all";
function applyFilter(){var seg=document.getElementById("rail-seg");if(seg)Array.prototype.forEach.call(seg.querySelectorAll("button"),function(x){x.classList.toggle("is-on",x.getAttribute("data-dir")===curDir)});Array.prototype.forEach.call(document.querySelectorAll("#rail-board .rail-brow"),function(r){r.hidden=curDir!=="all"&&r.getAttribute("data-dir")!==curDir})}
document.addEventListener("click",function(e){var t=e.target;var btn=t&&t.closest?t.closest("#rail-seg button"):null;if(!btn)return;curDir=btn.getAttribute("data-dir")||"all";applyFilter()});
window.postUpdate=function(){applyFilter()};
})();`,
          }}
        />
      </body>
      </html>
    </>
  );
}

// Station board inner (for partials) — chronological list with direction filter.
export function RailStationDetail({
  stationName,
  arrivals,
}: {
  stationName: string;
  arrivals: RailArrival[];
}) {
  const sorted = [...arrivals].sort((a, b) => a.waitSeconds - b.waitSeconds);
  const dirsPresent = DIR_ORDER.filter((d) => sorted.some((a) => a.direction === d));

  return (
    <div>
      {dirsPresent.length > 1 && (
        <div class="rail-seg mono" id="rail-seg" role="tablist">
          <button class="is-on" data-dir="all" type="button">all</button>
          {dirsPresent.map((d) => (
            <button data-dir={d} type="button">{DIR_ARROW[d]} {d}</button>
          ))}
        </div>
      )}

      <div class="rail-board" id="rail-board">
        {sorted.map((a) => {
          const s = etaState(a.waitSeconds, a.isRealtime);
          const isNow = s.kind === "now";
          const isApprox = s.kind === "approx";
          const isBoarding = a.isRealtime && !a.hasStarted && a.isFirstStop;
          const color = lineColor(a.line);

          const Tag = a.isRealtime ? "a" : "div";
          const linkProps = a.isRealtime ? { href: `/rail/train/${a.trainId}` } : {};

          return (
            <Tag
              {...linkProps}
              class={`rail-brow${isApprox ? " is-approx" : ""}${isNow ? " is-now" : ""}`}
              data-dir={a.direction}
            >
              <span class="rail-brow-bar" style={`background:${color}`}></span>
              <span class="rail-brow-dir mono">{a.direction}</span>
              <span class="rail-brow-dest">
                {stationDisplayName(a.destination).toLowerCase()}
                {isBoarding && <em class="rail-boarding mono" style={`color:${color}`}>boarding</em>}
              </span>
              <span class={`rail-rowtime mono${isApprox ? " is-approx" : ""}${isNow ? " is-now" : ""}`}>
                {isApprox && "~"}
                {isNow ? "now" : <>{s.min}<em> min</em></>}
              </span>
            </Tag>
          );
        })}
        {sorted.length === 0 && !getRailApiError() && (
          <div class="rail-empty">No upcoming trains at this station.</div>
        )}
      </div>
    </div>
  );
}

// ── Train timeline page ──
export function RailTrainPage({
  trainId,
  arrivals,
  standalone = false,
}: {
  trainId: string;
  arrivals: RailArrival[];
  standalone?: boolean;
}) {
  const trainArrivals = arrivals.filter((a) => a.trainId === trainId);
  const hasData = trainArrivals.length > 0;
  const line = hasData ? trainArrivals[0].line : "";
  const destination = hasData ? stationDisplayName(trainArrivals[0].destination) : "Unknown";
  const direction = hasData ? trainArrivals[0].direction : "";
  const color = hasData ? lineColor(line) : "#666";

  const title = standalone
    ? `Train ${trainId} — marta.io rail`
    : `Train ${trainId} — MARTA Rail — Pullcord`;

  return (
    <>
      {raw("<!DOCTYPE html>")}
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <title>{title}</title>
        <meta name="description" content={`Live tracking for MARTA train ${trainId} to ${destination}.`} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={`Live tracking for MARTA train ${trainId} to ${destination}.`} />
        <meta property="og:image" content="https://beta.marta.io/public/icons/og-rail.png" />
        <meta name="twitter:card" content="summary_large_image" />
        {standalone && <link rel="manifest" href="/manifest.json" />}
        <link rel="apple-touch-icon" href="/public/icons/rail-192.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/public/icons/rail-favicon.png" />
        <meta name="theme-color" content="#0f0e0b" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#efeae0" media="(prefers-color-scheme: light)" />
        <style>{raw(railStyles())}</style>
      </head>
      <body class="rail-body">
        <div class="rail-shell">
          <header class="rail-header rail-topbar-sub">
            <a href="/rail" class="rail-backbtn" aria-label="Back to all stations" onclick="if(history.length>1){history.back();return false}">
              <IconBack />
            </a>
            <div class="rail-topbar-title">
              <span class="rail-topbar-name mono">train {trainId}</span>
              {hasData && (
                <span class="rail-topbar-chips">
                  <LineChip line={line} sm />
                  <span class="rail-topbar-dest mono">{DIR_ARROW[direction] || ""} {destination.toLowerCase()}</span>
                </span>
              )}
            </div>
            <span class="rail-live mono">
              <span class="rail-pulse"></span>
              <span class="rail-freshness" id="freshness">live</span>
            </span>
          </header>
          <main class="rail-main">
            <RailApiBanner />
            <div id="rail-data">
              <RailTrainTimeline trainId={trainId} arrivals={arrivals} />
            </div>
          </main>
          <RailFooter />
        </div>
        <script dangerouslySetInnerHTML={{ __html: buildInlineJS(false) }} />
      </body>
      </html>
    </>
  );
}

// Train timeline inner (for partials) — passed stops dimmed, next stop pulses.
export function RailTrainTimeline({
  trainId,
  arrivals,
}: {
  trainId: string;
  arrivals: RailArrival[];
}) {
  const trainArrivals = arrivals.filter((a) => a.trainId === trainId);

  if (trainArrivals.length === 0) {
    if (getRailApiError()) {
      return <div class="rail-empty">Live tracking unavailable while MARTA's API is offline.</div>;
    }
    return (
      <div class="rail-empty">No data for train {trainId}. It may have completed its trip.</div>
    );
  }

  const line = trainArrivals[0].line;
  const direction = trainArrivals[0].direction;
  const color = lineColor(line);

  // Build ordered stop list from API data, using LINE_STATIONS for sort order.
  const lineOrder = LINE_STATIONS[line] || [];
  const orderIndex = new Map<string, number>();
  lineOrder.forEach((stn, i) => orderIndex.set(normalizeStation(stn), i));

  const seenStations = new Map<string, RailArrival>();
  for (const a of trainArrivals) {
    const norm = normalizeStation(a.station);
    if (!seenStations.has(norm)) seenStations.set(norm, a);
  }

  let apiStations = [...seenStations.entries()].sort((a, b) => {
    const idxA = orderIndex.get(a[0]) ?? 999;
    const idxB = orderIndex.get(b[0]) ?? 999;
    if (idxA !== idxB) return idxA - idxB;
    return a[1].waitSeconds - b[1].waitSeconds;
  });

  if (direction === "S" || direction === "W") {
    apiStations = apiStations.reverse();
  }

  // Soonest arrival = where the train is headed next (the "next" stop).
  const soonest = [...trainArrivals].sort((a, b) => a.waitSeconds - b.waitSeconds)[0];
  const currentNorm = normalizeStation(soonest.station);

  let foundCurrent = false;
  const lastIdx = apiStations.length - 1;

  return (
    <div class="rail-tl" style={`--lc:${color}`}>
      {apiStations.map(([stnNorm, arrival], i) => {
        const isNext = stnNorm === currentNorm;
        if (isNext) foundCurrent = true;
        const isPassed = !foundCurrent;
        const isEnd = i === lastIdx;

        const s = etaState(arrival.waitSeconds, arrival.isRealtime);
        const stnSlug = stationSlug(arrival.station);

        const cls = `rail-tlstop${isPassed ? " is-passed" : ""}${isNext ? " is-next" : ""}${isEnd ? " is-end" : ""}`;

        return (
          <a href={`/rail/${stnSlug}`} class={cls}>
            <span class="rail-tldot"></span>
            <span class="rail-tlname">
              {stationDisplayName(arrival.station).toLowerCase()}
              {isEnd && <em> · terminus</em>}
            </span>
            {isPassed ? (
              <span class="rail-tleta is-passed-label mono">departed</span>
            ) : (
              <span class={`rail-tleta mono${s.kind === "now" ? " is-now" : ""}`}>
                {s.kind === "now" ? "now" : `${s.min}m`}
              </span>
            )}
          </a>
        );
      })}
    </div>
  );
}
