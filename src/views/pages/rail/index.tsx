import type { RailArrival } from "../../../rail/api.js";
import { stationSlug, stationDisplayName, getRailApiError } from "../../../rail/api.js";

import {
  LINE_COLORS,
  LINE_STATIONS,
  STATION_COORDS,
  STATION_ORDER,
  formatTime,
  normalizeStation,
  buildStationRows,
} from "./data.js";
import type { StationPill, StationRow } from "./data.js";
import { railStyles, trainTimelineStyles } from "./styles.js";
import { buildInlineJS } from "./client.js";

// Re-export everything from sub-modules for backward compatibility
export {
  LINE_COLORS,
  LINE_STATIONS,
  STATION_COORDS,
  STATION_ORDER,
  formatTime,
  normalizeStation,
  buildStationRows,
} from "./data.js";
export type { StationPill, StationRow } from "./data.js";
export { railStyles, trainTimelineStyles } from "./styles.js";
export { buildInlineJS } from "./client.js";

// Banner shown at the top of any rail page when the MARTA rail API is
// unreachable. Kept dead simple — no icons, no dismiss, just a clear
// explanation so empty station lists aren't mistaken for "no trains running".
function RailApiBanner() {
  if (!getRailApiError()) return null;
  return (
    <div class="rail-api-banner" role="status" aria-live="polite">
      MARTA's real-time rail API is currently unreachable. Live arrival times
      will return automatically once it recovers.
    </div>
  );
}

// ── Pill component ──
function Pill({ pill }: { pill: StationPill }) {
  const bg = LINE_COLORS[pill.line as keyof typeof LINE_COLORS] || "#666";
  const isNow = pill.waitSeconds < 60;
  const label = `${pill.direction} ${formatTime(pill.waitSeconds)}`;

  return (
    <span
      class={`rail-pill${isNow ? " rail-pill-now" : ""}`}
      style={`background:${bg}`}
      aria-label={`${pill.direction} direction: ${isNow ? "arriving now" : Math.floor(pill.waitSeconds / 60) + " minutes"}`}
    >
      {label}
    </span>
  );
}

// ── Four-direction pill grid (Five Points) ──
function FourPillGrid({ pills }: { pills: StationPill[] }) {
  const byDir = new Map(pills.map((p) => [p.direction, p]));
  const grid = [
    ["N", "E"],
    ["S", "W"],
  ];

  return (
    <span class="rail-pills-grid">
      {grid.flat().map((dir) => {
        const p = byDir.get(dir);
        return p ? (
          <Pill pill={p} />
        ) : (
          <span class="rail-pill rail-pill-empty">—</span>
        );
      })}
    </span>
  );
}

// ── Station row ──
function StationRowEl({ row }: { row: StationRow }) {
  return (
    <a href={`/rail/${row.slug}`} class="rail-row" aria-label={`${row.name} station`}>
      <span class="rail-station-name">{row.name.toLowerCase()}</span>
      <span class="rail-pills-wrap">
        {row.pills.length === 0 ? (
          <span class="rail-no-data">—</span>
        ) : row.isFourDir ? (
          <FourPillGrid pills={row.pills} />
        ) : (
          <span class="rail-pills-inline">
            {row.pills.map((p) => (
              <Pill pill={p} />
            ))}
          </span>
        )}
      </span>
    </a>
  );
}

// ── Landing page inner HTML (used for partial updates) ──
export function RailStationList({ arrivals }: { arrivals: RailArrival[] }) {
  const rows = buildStationRows(arrivals);

  return (
    <div class="rail-station-list rail-loading">
      {rows.map((row) => (
        <StationRowEl row={row} />
      ))}
    </div>
  );
}

// ── Full landing page ──
export function RailLandingPage({ arrivals, standalone = false }: { arrivals: RailArrival[]; standalone?: boolean }) {
  const title = standalone ? "marta.io rail" : "MARTA Rail — Pullcord";
  const backHref = standalone ? "/rail" : "/";
  const backLabel = standalone ? "Refresh" : "Back to home";

  return (
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
        <meta name="theme-color" content="#1a1a2e" />
        <style>{railStyles()}</style>
      </head>
      <body class="rail-body">
        <div class="rail-shell">
          <header class="rail-header">
            <div class="rail-header-top">
              {!standalone && (
                <a href={backHref} class="rail-back" aria-label={backLabel}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M15 10H5M5 10L10 5M5 10L10 15" />
                  </svg>
                </a>
              )}
              <h1 class="rail-title">marta.io <span style="opacity:0.5">rail</span></h1>
              <span class="rail-freshness" id="freshness">—</span>
            </div>
          </header>
          <RailApiBanner />
          <main class="rail-main">
            <div id="rail-data">
              <RailStationList arrivals={arrivals} />
            </div>
          </main>
          <footer class="rail-footer">
            Real-time MARTA data via public API. Not affiliated with or endorsed by MARTA.
            <span> · <a href="/about">About marta.io</a></span>
          </footer>
        </div>
        <script dangerouslySetInnerHTML={{ __html: `window.__COORDS=${JSON.stringify(STATION_COORDS)};` }} />
        <script dangerouslySetInnerHTML={{ __html: buildInlineJS(true) }} />
      </body>
    </html>
  );
}

// ── Station detail page ──
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
  const title = standalone
    ? `${displayName} — marta.io rail`
    : `${displayName} — MARTA Rail — Pullcord`;

  return (
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
        <meta name="theme-color" content="#1a1a2e" />
        <style>{railStyles()}</style>
      </head>
      <body class="rail-body">
        <div class="rail-shell">
          <header class="rail-header">
            <div class="rail-header-top">
              <a href="/rail" class="rail-back" aria-label="Back to all stations" onclick="if(history.length>1){history.back();return false}">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M15 10H5M5 10L10 5M5 10L10 15" />
                </svg>
              </a>
              <h1 class="rail-title">{displayName.toLowerCase()}</h1>
              <span class="rail-freshness" id="freshness">—</span>
            </div>
          </header>
          <RailApiBanner />
          <main class="rail-main rail-station-detail">
            <div id="rail-data">
              <RailStationDetail stationName={stationName} arrivals={arrivals} />
            </div>
          </main>
        </div>
        <script dangerouslySetInnerHTML={{ __html: `window.__RAIL_STATION = ${JSON.stringify(stationName)};` }} />
        <script dangerouslySetInnerHTML={{ __html: buildInlineJS(false) }} />
      </body>
    </html>
  );
}

// Station detail inner (for partials) — flat list, soonest first
export function RailStationDetail({
  stationName,
  arrivals,
}: {
  stationName: string;
  arrivals: RailArrival[];
}) {
  const sorted = [...arrivals].sort((a, b) => a.waitSeconds - b.waitSeconds);

  return (
    <div class="rail-detail-list">
      {sorted.map((a) => {
        const bg = LINE_COLORS[a.line as keyof typeof LINE_COLORS] || "#666";
        const isNow = a.waitSeconds < 60;
        const isScheduled = !a.isRealtime;
        const isBoarding = a.isRealtime && !a.hasStarted && a.isFirstStop;
        const rowClass = `rail-arrival-row${isScheduled ? " rail-scheduled" : ""}${isBoarding ? " rail-boarding" : ""}`;

        // Scheduled entries have no trainId — render as div (not tappable)
        const Tag = isScheduled ? "div" : "a";
        const linkProps = isScheduled ? {} : { href: `/rail/train/${a.trainId}` };

        return (
          <Tag {...linkProps} class={rowClass}>
            <span class="rail-arrival-dir">
              {a.direction}
            </span>
            <span class="rail-arrival-line-pill" style={`background:${bg}`}>
              {a.line.toLowerCase()}
            </span>
            {isBoarding && <span class="rail-badge-boarding">boarding</span>}
            <span class="rail-arrival-dest">
              {stationDisplayName(a.destination).toLowerCase()}
            </span>
            <span class={`rail-arrival-time${isNow ? " rail-arrival-now" : ""}`}>
              {isScheduled ? "~" : ""}{isNow ? "NOW" : `${Math.floor(a.waitSeconds / 60)} min`}
            </span>
          </Tag>
        );
      })}
      {sorted.length === 0 && !getRailApiError() && (
        <div class="rail-empty">No arrivals currently available for this station.</div>
      )}
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
  const color = hasData ? (LINE_COLORS[line as keyof typeof LINE_COLORS] || "#666") : "#666";

  const title = standalone
    ? `Train ${trainId} — marta.io rail`
    : `Train ${trainId} — MARTA Rail — Pullcord`;

  return (
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
        <meta name="theme-color" content="#1a1a2e" />
        <style>{railStyles()}</style>
        <style>{trainTimelineStyles(color)}</style>
      </head>
      <body class="rail-body">
        <div class="rail-shell">
          <header class="rail-header">
            <div class="rail-header-top">
              <a href="/rail" class="rail-back" aria-label="Back to all stations" onclick="if(history.length>1){history.back();return false}">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M15 10H5M5 10L10 5M5 10L10 15" />
                </svg>
              </a>
              <div class="rail-train-header-info">
                <span class="rail-train-id">Train {trainId}</span>
                {hasData && (
                  <span class="rail-train-line-badge" style={`background:${color}`}>
                    {line}
                  </span>
                )}
              </div>
              <span class="rail-freshness" id="freshness">—</span>
            </div>
            {hasData && (
              <div class="rail-train-dest">→ {destination.toLowerCase()}</div>
            )}
          </header>
          <RailApiBanner />
          <main class="rail-main rail-train-main">
            <div id="rail-data">
              <RailTrainTimeline trainId={trainId} arrivals={arrivals} />
            </div>
          </main>
        </div>
        <script dangerouslySetInnerHTML={{ __html: buildInlineJS(false) }} />
        <script dangerouslySetInnerHTML={{ __html: `
          // First load: record initially-visited stops and hide them.
          // On poll updates, re-hide those same stops (but newly-visited ones stay visible).
          (function(){
            window._initialVisited = new Set();
            var visited = document.querySelectorAll(".rail-tl-stop.visited");
            for(var i=0;i<visited.length;i++){
              var name = visited[i].querySelector(".rail-tl-name");
              if(name) window._initialVisited.add(name.textContent);
              visited[i].style.display="none";
            }
            window.postUpdate = function(){
              var stops = document.querySelectorAll(".rail-tl-stop.visited");
              for(var i=0;i<stops.length;i++){
                var n = stops[i].querySelector(".rail-tl-name");
                if(n && window._initialVisited.has(n.textContent)){
                  stops[i].style.display="none";
                }
              }
            };
          })();
        ` }} />
      </body>
    </html>
  );
}

// Train timeline inner (for partials)
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
      // Banner already explains the outage — don't also tell the user the
      // train "may have completed its trip", which would be wrong and confusing.
      return <div class="rail-empty">Live tracking unavailable while MARTA's API is offline.</div>;
    }
    return (
      <div class="rail-empty">
        No data for train {trainId}. It may have completed its trip.
      </div>
    );
  }

  const line = trainArrivals[0].line;
  const direction = trainArrivals[0].direction;
  const color = LINE_COLORS[line as keyof typeof LINE_COLORS] || "#666";

  // Build ordered stop list from API data, using LINE_STATIONS for sort order
  const lineOrder = LINE_STATIONS[line] || [];
  const orderIndex = new Map<string, number>();
  lineOrder.forEach((stn, i) => orderIndex.set(normalizeStation(stn), i));

  // Deduplicate API stations by normalized name, keep the arrival data
  const seenStations = new Map<string, RailArrival>();
  for (const a of trainArrivals) {
    const norm = normalizeStation(a.station);
    if (!seenStations.has(norm)) seenStations.set(norm, a);
  }

  // Sort by line order (known stations first), then unknowns by waitSeconds
  let apiStations = [...seenStations.entries()].sort((a, b) => {
    const idxA = orderIndex.get(a[0]) ?? 999;
    const idxB = orderIndex.get(b[0]) ?? 999;
    if (idxA !== idxB) return idxA - idxB;
    return a[1].waitSeconds - b[1].waitSeconds;
  });

  // Reverse for S/W direction
  if (direction === "S" || direction === "W") {
    apiStations = apiStations.reverse();
  }

  // Find the soonest arrival — that's where the train is
  const soonest = [...trainArrivals].sort((a, b) => a.waitSeconds - b.waitSeconds)[0];
  const currentNorm = normalizeStation(soonest.station);

  let foundCurrent = false;

  return (
    <div class="rail-timeline" style={`--tl-color:${color}`}>
      <div class="rail-tl-line" style={`background:${color}`}></div>
      {apiStations.map(([stnNorm, arrival]) => {
        const isCurrent = stnNorm === currentNorm;
        if (isCurrent) foundCurrent = true;
        const visited = !foundCurrent;

        const cls = isCurrent ? "rail-tl-stop current" : visited ? "rail-tl-stop visited" : "rail-tl-stop";

        const isNow = arrival.waitSeconds < 60;
        const mins = Math.floor(arrival.waitSeconds / 60);

        const stnSlug = stationSlug(arrival.station);

        return (
          <a href={`/rail/${stnSlug}`} class={cls} id={isCurrent ? "rail-current" : undefined}>
            <span class="rail-tl-dot" style={`background:${color}`}></span>
            <span class="rail-tl-name">{stationDisplayName(arrival.station).toLowerCase()}</span>
            {!visited && (
              <span class={`rail-tl-time${isNow ? " rail-tl-now" : ""}`}>
                {isNow ? "NOW" : `${mins}m`}
              </span>
            )}
          </a>
        );
      })}
    </div>
  );
}
