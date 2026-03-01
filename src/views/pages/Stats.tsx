// Stats dashboard — MARTA operational health
// Server-rendered, inline SVG charts, polls for updates

import { getLatestSnapshot, getSystemTimeSeries, getLatestRouteSnapshots, getLatestRailSnapshots, type SystemSnapshot, type TimeSeriesPoint, type RouteSnapshot, type RailLineSnapshot } from "../../data/metrics.js";
import { getRoutes } from "../../data/db.js";

const LINE_COLORS: Record<string, string> = {
  RED: "#E05555", GOLD: "#D4A020", BLUE: "#4A9FE5", GREEN: "#3BAA6E",
};

// Build route_id → short_name lookup
function routeNameMap(): Map<string, string> {
  const routes = getRoutes();
  return new Map(routes.map(r => [r.route_id, r.route_short_name]));
}

// ── SVG Sparkline ──
function Sparkline({ points, width = 300, height = 60, color = "#4A9FE5", label = "" }: {
  points: number[]; width?: number; height?: number; color?: string; label?: string;
}) {
  if (points.length < 2) return <div class="stats-no-data">Collecting data...</div>;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const xStep = width / (points.length - 1);

  const pathPoints = points.map((v, i) => {
    const x = i * xStep;
    const y = height - 4 - ((v - min) / range) * (height - 8);
    return `${x},${y}`;
  });

  const linePath = `M${pathPoints.join(" L")}`;
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} class="stats-sparkline" style={`max-width:${width}px`}>
      <defs>
        <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color={color} stop-opacity="0.3" />
          <stop offset="100%" stop-color={color} stop-opacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#grad-${label})`} />
      <path d={linePath} fill="none" stroke={color} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx={String((points.length - 1) * xStep)} cy={String(height - 4 - ((points[points.length - 1] - min) / range) * (height - 8))} r="3" fill={color} />
    </svg>
  );
}

// ── Bar chart for route vehicles ──
function RouteBar({ routes, nameMap }: { routes: RouteSnapshot[]; nameMap: Map<string, string> }) {
  const top = routes.slice(0, 15);
  const maxVehicles = Math.max(...top.map(r => r.vehicles), 1);

  return (
    <div class="stats-bar-chart">
      {top.map(r => {
        const name = nameMap.get(r.routeId) || r.routeId;
        const pct = (r.vehicles / maxVehicles) * 100;
        return (
          <div class="stats-bar-row">
            <span class="stats-bar-label">{name}</span>
            <div class="stats-bar-track">
              <div class="stats-bar-fill" style={`width:${pct}%`}></div>
            </div>
            <span class="stats-bar-value">{r.vehicles}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Rail line cards ──
function RailCards({ lines }: { lines: RailLineSnapshot[] }) {
  return (
    <div class="stats-rail-grid">
      {lines.map(l => {
        const color = LINE_COLORS[l.line] || "#666";
        const total = l.realtime + l.scheduled;
        const realtimePct = total > 0 ? Math.round((l.realtime / total) * 100) : 0;
        return (
          <div class="stats-rail-card" style={`border-color:${color}`}>
            <div class="stats-rail-line" style={`color:${color}`}>{l.line}</div>
            <div class="stats-rail-trains">{l.trains}</div>
            <div class="stats-rail-sub">trains</div>
            <div class="stats-rail-bar">
              <div class="stats-rail-bar-fill" style={`width:${realtimePct}%; background:${color}`}></div>
            </div>
            <div class="stats-rail-pct">{realtimePct}% realtime</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main dashboard page ──
export function StatsPage() {
  const snapshot = getLatestSnapshot();
  const timeSeries = getSystemTimeSeries(6);
  const routeSnapshots = getLatestRouteSnapshots();
  const railSnapshots = getLatestRailSnapshots();
  const nameMap = routeNameMap();

  const busPoints = timeSeries.map(p => p.vehicles);
  const hasData = snapshot !== null;

  // Compute time range label
  const firstTs = timeSeries.length > 0 ? timeSeries[0].ts : 0;
  const lastTs = timeSeries.length > 0 ? timeSeries[timeSeries.length - 1].ts : 0;
  const hoursOfData = ((lastTs - firstTs) / 3600).toFixed(1);

  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <title>System Stats — Pullcord</title>
        <meta name="description" content="MARTA operational health dashboard — real-time bus and rail metrics." />
        <meta name="theme-color" content="#090e1a" />
        <link rel="icon" type="image/svg+xml" href="/public/icons/favicon.svg" />
        <style>{statsStyles()}</style>
      </head>
      <body class="stats-body">
        <div class="stats-shell">
          <header class="stats-header">
            <a href="/" class="stats-back" aria-label="Home" onclick="if(history.length>1){history.back();return false}">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"></path></svg>
            </a>
            <h1 class="stats-title">system stats</h1>
            <span class="stats-freshness" id="freshness">live</span>
          </header>

          <main class="stats-main" id="stats-data">
            <StatsContent
              snapshot={snapshot}
              busPoints={busPoints}
              routeSnapshots={routeSnapshots}
              railSnapshots={railSnapshots}
              nameMap={nameMap}
              hoursOfData={hoursOfData}
              dataPoints={timeSeries.length}
            />
          </main>
        </div>
        <script dangerouslySetInnerHTML={{ __html: statsJS() }} />
      </body>
    </html>
  );
}

// Partial for polling updates
export function StatsContent({
  snapshot,
  busPoints,
  routeSnapshots,
  railSnapshots,
  nameMap,
  hoursOfData,
  dataPoints,
}: {
  snapshot: SystemSnapshot | null;
  busPoints: number[];
  routeSnapshots: RouteSnapshot[];
  railSnapshots: RailLineSnapshot[];
  nameMap: Map<string, string>;
  hoursOfData: string;
  dataPoints: number;
}) {
  if (!snapshot) {
    return (
      <div class="stats-empty">
        <div class="stats-empty-icon">📊</div>
        <div class="stats-empty-title">Warming up</div>
        <div class="stats-empty-sub">Metrics collection started. First meaningful data in ~15 minutes.</div>
      </div>
    );
  }

  const totalRailTrains = railSnapshots.reduce((s, l) => s + l.trains, 0);

  return (
    <div class="stats-grid">
      {/* Hero numbers */}
      <section class="stats-hero">
        <div class="stats-hero-card">
          <div class="stats-hero-number">{snapshot.busVehicles}</div>
          <div class="stats-hero-label">buses active</div>
        </div>
        <div class="stats-hero-card">
          <div class="stats-hero-number">{totalRailTrains}</div>
          <div class="stats-hero-label">trains active</div>
        </div>
        <div class="stats-hero-card">
          <div class="stats-hero-number">{snapshot.busRoutes}</div>
          <div class="stats-hero-label">bus routes</div>
        </div>
        <div class="stats-hero-card">
          <div class="stats-hero-number">{railSnapshots.length}</div>
          <div class="stats-hero-label">rail lines</div>
        </div>
      </section>

      {/* Bus vehicle trend */}
      <section class="stats-section">
        <h2 class="stats-section-title">Bus fleet — last {hoursOfData}h <span class="stats-muted">({dataPoints} samples)</span></h2>
        <Sparkline points={busPoints} width={600} height={100} color="#E85D3A" label="buses" />
        <div class="stats-range">
          <span>{Math.min(...busPoints)} min</span>
          <span>{Math.max(...busPoints)} max</span>
        </div>
      </section>

      {/* Rail lines */}
      <section class="stats-section">
        <h2 class="stats-section-title">Rail lines</h2>
        <RailCards lines={railSnapshots} />
      </section>

      {/* Top routes by vehicle count */}
      <section class="stats-section">
        <h2 class="stats-section-title">Busiest routes <span class="stats-muted">(right now)</span></h2>
        <RouteBar routes={routeSnapshots} nameMap={nameMap} />
      </section>

      <div class="stats-meta">
        Sampling every 5 min · {dataPoints} data points · {hoursOfData}h of history
      </div>
    </div>
  );
}

function statsJS(): string {
  return `(function(){
    var d=document.getElementById("stats-data"),f=document.getElementById("freshness");
    if(!d||!f)return;
    var t=Date.now();
    function u(){var a=Math.floor((Date.now()-t)/1e3);f.textContent=a<5?"live":a+"s ago";f.style.color=a>60?"#E85D3A":""}
    setInterval(u,1e3);
    var p=setInterval(function(){
      fetch("/stats?partial=1",{signal:AbortSignal.timeout(8e3)}).then(function(r){if(r.ok)return r.text()}).then(function(h){if(h){d.innerHTML=h;t=Date.now();u()}}).catch(function(){});
    },30000);
    document.addEventListener("visibilitychange",function(){if(document.hidden)clearInterval(p);else p=setInterval(function(){fetch("/stats?partial=1",{signal:AbortSignal.timeout(8e3)}).then(function(r){if(r.ok)return r.text()}).then(function(h){if(h){d.innerHTML=h;t=Date.now();u()}}).catch(function(){})},30000)});
  })();`;
}

function statsStyles(): string {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    .stats-body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: #090e1a;
      color: #e8e8e8;
      -webkit-font-smoothing: antialiased;
    }
    .stats-shell { max-width: 960px; margin: 0 auto; padding: 0 1rem; }
    .stats-header {
      display: flex; align-items: center; gap: 0.75rem;
      padding: 1rem 0; border-bottom: 1px solid rgba(255,255,255,0.06);
      position: sticky; top: 0; background: #090e1a; z-index: 10;
    }
    .stats-back { color: #aaa; text-decoration: none; display: flex; }
    .stats-back:hover { color: #fff; }
    .stats-title { font-size: 1.25rem; font-weight: 600; letter-spacing: -0.02em; flex: 1; }
    .stats-freshness { font-size: 0.85rem; color: rgba(255,255,255,0.4); font-variant-numeric: tabular-nums; }
    .stats-main { padding: 1.5rem 0 3rem; }

    .stats-empty { text-align: center; padding: 4rem 1rem; }
    .stats-empty-icon { font-size: 3rem; margin-bottom: 1rem; }
    .stats-empty-title { font-size: 1.5rem; font-weight: 600; margin-bottom: 0.5rem; }
    .stats-empty-sub { color: rgba(255,255,255,0.4); max-width: 400px; margin: 0 auto; }

    .stats-grid { display: flex; flex-direction: column; gap: 2rem; }

    /* Hero numbers */
    .stats-hero { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; }
    @media (min-width: 640px) { .stats-hero { grid-template-columns: repeat(4, 1fr); } }
    .stats-hero-card {
      background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06);
      border-radius: 12px; padding: 1.25rem; text-align: center;
    }
    .stats-hero-number { font-size: 2.5rem; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1; }
    .stats-hero-label { font-size: 0.85rem; color: rgba(255,255,255,0.4); margin-top: 0.5rem; }

    /* Sections */
    .stats-section { }
    .stats-section-title { font-size: 1rem; font-weight: 600; margin-bottom: 1rem; color: rgba(255,255,255,0.7); }
    .stats-muted { font-weight: 400; color: rgba(255,255,255,0.3); }

    /* Sparkline */
    .stats-sparkline { width: 100%; height: auto; display: block; }
    .stats-range { display: flex; justify-content: space-between; font-size: 0.8rem; color: rgba(255,255,255,0.3); margin-top: 0.25rem; font-variant-numeric: tabular-nums; }
    .stats-no-data { color: rgba(255,255,255,0.3); font-size: 0.9rem; padding: 2rem; text-align: center; }

    /* Bar chart */
    .stats-bar-chart { display: flex; flex-direction: column; gap: 0.4rem; }
    .stats-bar-row { display: flex; align-items: center; gap: 0.5rem; }
    .stats-bar-label { width: 3rem; text-align: right; font-size: 0.9rem; font-weight: 600; font-variant-numeric: tabular-nums; color: rgba(255,255,255,0.6); flex-shrink: 0; }
    .stats-bar-track { flex: 1; height: 1.5rem; background: rgba(255,255,255,0.04); border-radius: 4px; overflow: hidden; }
    .stats-bar-fill { height: 100%; background: #E85D3A; border-radius: 4px; transition: width 0.3s; min-width: 2px; }
    .stats-bar-value { width: 2rem; text-align: left; font-size: 0.85rem; font-variant-numeric: tabular-nums; color: rgba(255,255,255,0.5); flex-shrink: 0; }

    /* Rail cards */
    .stats-rail-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; }
    @media (min-width: 640px) { .stats-rail-grid { grid-template-columns: repeat(4, 1fr); } }
    .stats-rail-card {
      background: rgba(255,255,255,0.04); border-radius: 12px; padding: 1rem; text-align: center;
      border-left: 4px solid;
    }
    .stats-rail-line { font-size: 0.85rem; font-weight: 700; letter-spacing: 1px; margin-bottom: 0.25rem; }
    .stats-rail-trains { font-size: 2rem; font-weight: 700; font-variant-numeric: tabular-nums; }
    .stats-rail-sub { font-size: 0.75rem; color: rgba(255,255,255,0.4); }
    .stats-rail-bar { height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px; margin: 0.5rem 0 0.25rem; overflow: hidden; }
    .stats-rail-bar-fill { height: 100%; border-radius: 2px; transition: width 0.3s; }
    .stats-rail-pct { font-size: 0.75rem; color: rgba(255,255,255,0.35); font-variant-numeric: tabular-nums; }

    .stats-meta { font-size: 0.8rem; color: rgba(255,255,255,0.2); text-align: center; padding: 1rem 0; }

    /* Desktop: let it breathe */
    @media (min-width: 960px) {
      .stats-hero-number { font-size: 3.5rem; }
      .stats-hero-card { padding: 2rem; }
      .stats-bar-row { gap: 1rem; }
      .stats-bar-label { width: 4rem; font-size: 1rem; }
      .stats-bar-track { height: 2rem; }
      .stats-bar-value { font-size: 1rem; }
    }
  `;
}
