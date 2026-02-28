import type { RailArrival } from "../../rail/api.js";
import { stationSlug, stationDisplayName } from "../../rail/api.js";

// ── Accessible line colors ──
const LINE_COLORS = {
  dark: {
    RED: "#E05555",
    GOLD: "#D4A020",
    BLUE: "#4A9FE5",
    GREEN: "#3BAA6E",
  },
  light: {
    RED: "#B33030",
    GOLD: "#8B6D14",
    BLUE: "#1A6BB5",
    GREEN: "#1B7A45",
  },
};

// Inline JS — zero external requests
const INLINE_JS = `(function(){var P=1e4,d=document.getElementById("rail-data"),f=document.getElementById("freshness");if(!d||!f)return;var t=Date.now(),p=null,b=window.location.pathname;function u(){var a=Math.floor((Date.now()-t)/1e3);f.textContent=a<2?"live":a+"s ago";f.style.color=a>30?"#E85D3A":""}setInterval(u,1e3);u();function q(){fetch(b+"?partial=1",{signal:AbortSignal.timeout(8e3)}).then(function(r){if(r.ok)return r.text()}).then(function(h){if(h){d.innerHTML=h;t=Date.now();u()}}).catch(function(){})}p=setInterval(q,P);document.addEventListener("visibilitychange",function(){if(document.hidden){clearInterval(p);p=null}else{q();p=setInterval(q,P)}})})();`;

// Map direction codes to short labels
const DIR_LABELS: Record<string, string> = {
  N: "N",
  S: "S",
  E: "E",
  W: "W",
};

// Canonical station order (north-south on each line, interleaved sensibly)
// Station names must match the MARTA API exactly
// Alphabetical — stable order regardless of live data
const STATION_ORDER = [
  "AIRPORT STATION",
  "ARTS CENTER STATION",
  "ASHBY STATION",
  "AVONDALE STATION",
  "BANKHEAD STATION",
  "BROOKHAVEN STATION",
  "BUCKHEAD STATION",
  "CHAMBLEE STATION",
  "CIVIC CENTER STATION",
  "COLLEGE PARK STATION",
  "DECATUR STATION",
  "DORAVILLE STATION",
  "DUNWOODY STATION",
  "EAST LAKE STATION",
  "EAST POINT STATION",
  "EDGEWOOD CANDLER PARK STATION",
  "FIVE POINTS STATION",
  "GARNETT STATION",
  "GEORGIA STATE STATION",
  "HAMILTON E HOLMES STATION",
  "INDIAN CREEK STATION",
  "INMAN PARK STATION",
  "KENSINGTON STATION",
  "KING MEMORIAL STATION",
  "LAKEWOOD STATION",
  "LENOX STATION",
  "LINDBERGH STATION",
  "MEDICAL CENTER STATION",
  "MIDTOWN STATION",
  "NORTH AVE STATION",
  "NORTH SPRINGS STATION",
  "OAKLAND CITY STATION",
  "OMNI DOME STATION",
  "PEACHTREE CENTER STATION",
  "SANDY SPRINGS STATION",
  "VINE CITY STATION",
  "WEST END STATION",
  "WEST LAKE STATION",
];

// ── Types ──
interface StationPill {
  direction: string;
  waitSeconds: number;
  line: string;
}

interface StationRow {
  name: string;
  slug: string;
  pills: StationPill[];
  isFourDir: boolean;
}

// ── Helpers ──
function formatTime(seconds: number): string {
  if (seconds < 60) return "NOW";
  const mins = Math.floor(seconds / 60);
  return `:${mins.toString().padStart(2, "0")}`;
}

function buildStationRows(arrivals: RailArrival[]): StationRow[] {
  // Group by station
  const byStation = new Map<string, RailArrival[]>();
  for (const a of arrivals) {
    const list = byStation.get(a.station) || [];
    list.push(a);
    byStation.set(a.station, list);
  }

  // Build ordered list — stations with data first (in canonical order), then any extras
  const seen = new Set<string>();
  const rows: StationRow[] = [];

  // All known stations, whether they have data or not
  const allStations = [...STATION_ORDER];
  // Add any stations from API not in our list
  for (const name of byStation.keys()) {
    if (!allStations.includes(name)) {
      allStations.push(name);
    }
  }

  for (const stationName of allStations) {
    if (seen.has(stationName)) continue;
    seen.add(stationName);

    const stationArrivals = byStation.get(stationName) || [];
    
    // Soonest arrival per direction
    const bestByDir = new Map<string, RailArrival>();
    for (const a of stationArrivals) {
      const existing = bestByDir.get(a.direction);
      if (!existing || a.waitSeconds < existing.waitSeconds) {
        bestByDir.set(a.direction, a);
      }
    }

    // Sort pills: N, S, E, W
    const dirOrder = ["N", "S", "E", "W"];
    const pills: StationPill[] = dirOrder
      .filter((d) => bestByDir.has(d))
      .map((d) => {
        const a = bestByDir.get(d)!;
        return { direction: d, waitSeconds: a.waitSeconds, line: a.line };
      });

    const isFourDir = pills.length === 4 || stationName === "FIVE POINTS STATION";

    rows.push({
      name: stationDisplayName(stationName),
      slug: stationSlug(stationName),
      pills,
      isFourDir,
    });
  }

  return rows;
}

// ── Pill component ──
function Pill({ pill, mode = "dark" }: { pill: StationPill; mode?: "dark" | "light" }) {
  const colors = LINE_COLORS[mode];
  const bg = colors[pill.line as keyof typeof colors] || "#666";
  const isNow = pill.waitSeconds < 60;
  const label = `${DIR_LABELS[pill.direction] || pill.direction} ${formatTime(pill.waitSeconds)}`;

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
function FourPillGrid({ pills, mode = "dark" }: { pills: StationPill[]; mode?: "dark" | "light" }) {
  // Arrange as 2×2: [N, E] / [S, W]
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
          <Pill pill={p} mode={mode} />
        ) : (
          <span class="rail-pill rail-pill-empty">—</span>
        );
      })}
    </span>
  );
}

// ── Station row ──
function StationRowEl({ row, mode = "dark" }: { row: StationRow; mode?: "dark" | "light" }) {
  return (
    <a href={`/rail/${row.slug}`} class="rail-row" aria-label={`${row.name} station`}>
      <span class="rail-station-name">{row.name.toLowerCase()}</span>
      <span class="rail-pills-wrap">
        {row.pills.length === 0 ? (
          <span class="rail-no-data">—</span>
        ) : row.isFourDir ? (
          <FourPillGrid pills={row.pills} mode={mode} />
        ) : (
          <span class="rail-pills-inline">
            {row.pills.map((p) => (
              <Pill pill={p} mode={mode} />
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
    <div class="rail-station-list">
      {rows.map((row) => (
        <StationRowEl row={row} />
      ))}
    </div>
  );
}

// ── Test cases section ──
function TestCases() {
  const testRows: StationRow[] = [
    {
      name: "Airport",
      slug: "airport",
      pills: [{ direction: "S", waitSeconds: 1320, line: "GOLD" }],
      isFourDir: false,
    },
    {
      name: "Arts Center",
      slug: "arts-center",
      pills: [
        { direction: "N", waitSeconds: 1080, line: "RED" },
        { direction: "S", waitSeconds: 780, line: "GOLD" },
      ],
      isFourDir: false,
    },
    {
      name: "Five Points",
      slug: "five-points",
      pills: [
        { direction: "N", waitSeconds: 600, line: "RED" },
        { direction: "S", waitSeconds: 300, line: "GOLD" },
        { direction: "E", waitSeconds: 300, line: "BLUE" },
        { direction: "W", waitSeconds: 960, line: "GREEN" },
      ],
      isFourDir: true,
    },
    {
      name: "Bankhead",
      slug: "bankhead",
      pills: [],
      isFourDir: false,
    },
    {
      name: "Midtown",
      slug: "midtown",
      pills: [
        { direction: "N", waitSeconds: 30, line: "RED" },
        { direction: "S", waitSeconds: 45, line: "GOLD" },
      ],
      isFourDir: false,
    },
  ];

  return (
    <div class="rail-test-section">
      {/* <!-- TEST CASES --> */}
      <div class="rail-test-header">test cases</div>
      <div class="rail-station-list">
        {testRows.map((row) => (
          <StationRowEl row={row} />
        ))}
      </div>
    </div>
  );
}

// ── Full landing page ──
export function RailLandingPage({ arrivals }: { arrivals: RailArrival[] }) {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <title>MARTA Rail — Pullcord</title>
        <meta name="description" content="Real-time MARTA rail arrivals for all 38 stations." />
        <style>{railStyles()}</style>
      </head>
      <body class="rail-body">
        <div class="rail-shell">
          <header class="rail-header">
            <div class="rail-header-top">
              <a href="/" class="rail-back" aria-label="Back to home">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M15 10H5M5 10L10 5M5 10L10 15" />
                </svg>
              </a>
              <h1 class="rail-title">marta rail</h1>
              <span class="rail-freshness" id="freshness">—</span>
            </div>
          </header>
          <main class="rail-main">
            <div id="rail-data">
              <RailStationList arrivals={arrivals} />
            </div>
            <TestCases />
          </main>
        </div>
        <script>{INLINE_JS}</script>
      </body>
    </html>
  );
}

// ── Station detail page ──
export function RailStationPage({
  stationName,
  arrivals,
}: {
  stationName: string;
  arrivals: RailArrival[];
}) {
  // Group by direction
  const byDir = new Map<string, RailArrival[]>();
  for (const a of arrivals) {
    const list = byDir.get(a.direction) || [];
    list.push(a);
    byDir.set(a.direction, list);
  }

  // Sort each direction by wait time
  for (const [, list] of byDir) {
    list.sort((a, b) => a.waitSeconds - b.waitSeconds);
  }

  const dirOrder = ["N", "S", "E", "W"];
  const displayName = stationDisplayName(stationName);

  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <title>{displayName} — MARTA Rail — Pullcord</title>
        <style>{railStyles()}</style>
      </head>
      <body class="rail-body">
        <div class="rail-shell">
          <header class="rail-header">
            <div class="rail-header-top">
              <a href="/rail" class="rail-back" aria-label="Back to all stations">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M15 10H5M5 10L10 5M5 10L10 15" />
                </svg>
              </a>
              <h1 class="rail-title">{displayName.toLowerCase()}</h1>
              <span class="rail-freshness" id="freshness">—</span>
            </div>
          </header>
          <main class="rail-main rail-station-detail">
            <div id="rail-data">
              <RailStationDetail stationName={stationName} arrivals={arrivals} />
            </div>
          </main>
        </div>
        <script>{`window.__RAIL_STATION = ${JSON.stringify(stationName)};`}</script>
        <script>{INLINE_JS}</script>
      </body>
    </html>
  );
}

// Station detail inner (for partials)
export function RailStationDetail({
  stationName,
  arrivals,
}: {
  stationName: string;
  arrivals: RailArrival[];
}) {
  const byDir = new Map<string, RailArrival[]>();
  for (const a of arrivals) {
    const list = byDir.get(a.direction) || [];
    list.push(a);
    byDir.set(a.direction, list);
  }
  for (const [, list] of byDir) {
    list.sort((a, b) => a.waitSeconds - b.waitSeconds);
  }

  const dirOrder = ["N", "S", "E", "W"];
  const dirNames: Record<string, string> = {
    N: "Northbound",
    S: "Southbound",
    E: "Eastbound",
    W: "Westbound",
  };

  const colors = LINE_COLORS.dark;

  return (
    <div class="rail-detail-groups">
      {dirOrder
        .filter((d) => byDir.has(d))
        .map((dir) => {
          const list = byDir.get(dir)!;
          return (
            <div class="rail-dir-group">
              <h2 class="rail-dir-heading">{dirNames[dir] || dir}</h2>
              <div class="rail-dir-arrivals">
                {list.map((a) => {
                  const bg = colors[a.line as keyof typeof colors] || "#666";
                  const isNow = a.waitSeconds < 60;
                  return (
                    <div class="rail-arrival-row">
                      <span class="rail-arrival-line" style={`background:${bg}`}>
                        {a.line.charAt(0)}
                      </span>
                      <span class="rail-arrival-dest">
                        {stationDisplayName(a.destination).toLowerCase()}
                      </span>
                      <span class={`rail-arrival-time${isNow ? " rail-arrival-now" : ""}`}>
                        {isNow ? "NOW" : `${Math.floor(a.waitSeconds / 60)} min`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      {byDir.size === 0 && (
        <div class="rail-empty">No arrivals currently available for this station.</div>
      )}
    </div>
  );
}

// ── Styles (inlined to avoid CSS build dependency) ──
function railStyles(): string {
  return `
    /* ── Rail base ── */
    .rail-body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      background: #0f0f0f;
      color: #d4d0c8;
    }

    @media (prefers-color-scheme: light) {
      .rail-body {
        background: #f5f0eb;
        color: #3B2820;
      }
    }

    .rail-shell {
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
    }

    /* ── Header ── */
    .rail-header {
      position: sticky;
      top: 0;
      z-index: 10;
      background: #1a1a18;
      border-bottom: 1px solid #2a2a26;
      padding: 0.65rem 0.75rem;
    }

    @media (prefers-color-scheme: light) {
      .rail-header {
        background: #ece5dc;
        border-bottom-color: #d8cfc4;
      }
    }

    .rail-header-top {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      max-width: 600px;
      margin: 0 auto;
    }

    .rail-back {
      color: #a09888;
      display: flex;
      align-items: center;
      text-decoration: none;
      padding: 0.2rem;
      border-radius: 0.25rem;
      flex-shrink: 0;
    }
    .rail-back:active { color: #E85D3A; }

    .rail-title {
      font-size: 1.1rem;
      font-weight: 700;
      margin: 0;
      flex: 1;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .rail-freshness {
      font-size: 0.75rem;
      color: #807870;
      flex-shrink: 0;
      min-width: 3rem;
      text-align: right;
    }

    /* ── Main content ── */
    .rail-main {
      flex: 1;
      max-width: 600px;
      width: 100%;
      margin: 0 auto;
      padding: 0.25rem 0;
    }

    /* ── Station list ── */
    .rail-station-list {
      display: flex;
      flex-direction: column;
    }

    .rail-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.45rem 0.75rem;
      text-decoration: none;
      color: inherit;
      border-bottom: 1px solid #1e1e1c;
      min-height: 2.25rem;
      -webkit-tap-highlight-color: transparent;
    }
    .rail-row:active {
      background: #1e1e1c;
    }

    @media (prefers-color-scheme: light) {
      .rail-row {
        border-bottom-color: #e0d8cf;
      }
      .rail-row:active {
        background: #e8e0d6;
      }
    }

    .rail-station-name {
      flex: 1;
      min-width: 0;
      font-size: 1.15rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.3;
    }

    .rail-pills-wrap {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: flex-end;
    }

    .rail-pills-inline {
      display: flex;
      gap: 0.25rem;
      align-items: center;
    }

    /* ── Pill ── */
    .rail-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 66px;
      height: 1.9rem;
      border-radius: 0.3rem;
      font-size: 1rem;
      font-weight: 700;
      color: #fff;
      white-space: nowrap;
      letter-spacing: 0.02em;
      line-height: 1;
    }

    .rail-pill-now {
      animation: rail-pulse 1.5s ease-in-out infinite;
    }

    .rail-pill-empty {
      background: #2a2a26;
      color: #555;
      width: 66px;
    }

    @media (prefers-color-scheme: light) {
      .rail-pill-empty {
        background: #d8cfc4;
        color: #aaa;
      }
    }

    /* ── Four-direction grid (Five Points) ── */
    .rail-pills-grid {
      display: grid;
      grid-template-columns: 66px 66px;
      gap: 0.2rem;
    }

    /* ── No data ── */
    .rail-no-data {
      color: #555;
      font-size: 0.9rem;
      min-width: 66px;
      text-align: center;
    }

    /* ── Animations ── */
    @keyframes rail-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    /* ── Test section ── */
    .rail-test-section {
      margin-top: 1.5rem;
      border-top: 2px dashed #2a2a26;
      padding-top: 0.5rem;
    }

    @media (prefers-color-scheme: light) {
      .rail-test-section {
        border-top-color: #d8cfc4;
      }
    }

    .rail-test-header {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #555;
      padding: 0.25rem 0.75rem 0.25rem;
      font-weight: 600;
    }

    /* ── Station detail ── */
    .rail-station-detail {
      padding: 0.5rem 0.75rem;
    }

    .rail-dir-group {
      margin-bottom: 1.25rem;
    }

    .rail-dir-heading {
      font-size: 0.8rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #807870;
      margin: 0 0 0.4rem;
      padding-bottom: 0.3rem;
      border-bottom: 1px solid #2a2a26;
    }

    @media (prefers-color-scheme: light) {
      .rail-dir-heading {
        color: #8B7D6B;
        border-bottom-color: #d8cfc4;
      }
    }

    .rail-dir-arrivals {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .rail-arrival-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.4rem 0;
    }

    .rail-arrival-line {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.5rem;
      height: 1.5rem;
      border-radius: 0.25rem;
      font-size: 0.75rem;
      font-weight: 800;
      color: #fff;
      flex-shrink: 0;
    }

    .rail-arrival-dest {
      flex: 1;
      font-size: 0.9rem;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .rail-arrival-time {
      font-size: 0.95rem;
      font-weight: 700;
      flex-shrink: 0;
      min-width: 3rem;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    .rail-arrival-now {
      color: #E85D3A;
      animation: rail-pulse 1.5s ease-in-out infinite;
    }

    .rail-empty {
      text-align: center;
      padding: 2rem 1rem;
      color: #807870;
      font-size: 0.9rem;
    }
  `;
}
