// Stats dashboard — MARTA operational health
// Hero: schedule adherence. Secondary: delay, ghosts. SVG sparklines.

import { getLatestSnapshot, getSystemTimeSeries, getLatestRouteSnapshots, getLatestRailSnapshots, type SystemSnapshot, type TimeSeriesPoint, type RouteSnapshot, type RailLineSnapshot } from "../../data/metrics.js";
import { getRoutes } from "../../data/db.js";

const LINE_COLORS: Record<string, string> = {
  RED: "#E05555", GOLD: "#D4A020", BLUE: "#4A9FE5", GREEN: "#3BAA6E",
};

function routeNameMap(): Map<string, string> {
  const routes = getRoutes();
  return new Map(routes.map(r => [r.route_id, r.route_short_name]));
}

// ── SVG Sparkline ──
function Sparkline({ points, width = 600, height = 80, color = "#4A9FE5", label = "", unit = "", yMin, yMax }: {
  points: number[]; width?: number; height?: number; color?: string; label?: string; unit?: string; yMin?: number; yMax?: number;
}) {
  if (points.length < 2) return <div class="s-nodata">Collecting data…</div>;
  const min = yMin ?? Math.min(...points);
  const max = yMax ?? Math.max(...points);
  const range = max - min || 1;
  const pad = 4;
  const xStep = width / (points.length - 1);

  const pathPoints = points.map((v, i) => {
    const x = i * xStep;
    const y = height - pad - ((v - min) / range) * (height - pad * 2);
    return `${x},${y}`;
  });

  const linePath = `M${pathPoints.join(" L")}`;
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;
  const lastY = height - pad - ((points[points.length - 1] - min) / range) * (height - pad * 2);

  return (
    <div class="s-spark-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} class="s-spark" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`g-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color={color} stop-opacity="0.25" />
            <stop offset="100%" stop-color={color} stop-opacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#g-${label})`} />
        <path d={linePath} fill="none" stroke={color} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        <circle cx={String((points.length - 1) * xStep)} cy={String(lastY)} r="3.5" fill={color} />
      </svg>
      <div class="s-spark-range">
        <span>{formatVal(Math.min(...points), unit)}</span>
        <span>{formatVal(Math.max(...points), unit)}</span>
      </div>
    </div>
  );
}

function formatVal(v: number, unit: string): string {
  if (unit === "%") return `${Math.round(v)}%`;
  if (unit === "min") return `${v.toFixed(1)}m`;
  return String(Math.round(v));
}

function adherenceColor(pct: number): string {
  if (pct >= 0.85) return "#3BAA6E";
  if (pct >= 0.65) return "#D4A020";
  return "#E05555";
}

function delayColor(sec: number): string {
  if (Math.abs(sec) < 120) return "#3BAA6E";
  if (Math.abs(sec) < 360) return "#D4A020";
  return "#E05555";
}

// ── Route table ──
const RAIL_IDS = new Set(["BLUE", "GREEN", "RED", "GOLD"]);

function RouteTable({ routes, nameMap }: { routes: RouteSnapshot[]; nameMap: Map<string, string> }) {
  // Filter out rail routes that leak into bus metrics
  const busRoutes = routes.filter(r => !RAIL_IDS.has(nameMap.get(r.routeId) || r.routeId));

  // Three groups: underserved (has buses but below 100%), missing (0 buses, scheduled), surplus (no schedule data)
  const underserved = busRoutes.filter(r => r.tripsScheduled > 0 && r.vehicles > 0 && (r.adherence ?? 1) < 1);
  const missing = busRoutes.filter(r => r.tripsScheduled > 0 && r.vehicles === 0);
  const surplus = busRoutes.filter(r => r.tripsScheduled === 0 && r.vehicles > 0);

  // Sort underserved by adherence (worst first), missing by scheduled count, surplus by vehicles
  underserved.sort((a, b) => (a.adherence ?? 0) - (b.adherence ?? 0));
  missing.sort((a, b) => b.tripsScheduled - a.tripsScheduled);
  surplus.sort((a, b) => b.vehicles - a.vehicles);

  const top = [...underserved, ...missing.slice(0, 10), ...surplus.slice(0, 5)].slice(0, 25);

  return (
    <div class="s-table">
      <div class="s-table-head">
        <span class="s-th s-th-route">Route</span>
        <span class="s-th s-th-num">Buses</span>
        <span class="s-th s-th-num">Sched</span>
        <span class="s-th s-th-num">Adherence</span>
        <span class="s-th s-th-num">Delay</span>
      </div>
      {top.map(r => {
        const name = nameMap.get(r.routeId) || r.routeId;
        const adhPct = r.adherence !== null ? Math.round(r.adherence * 100) : null;
        const adhColor = adhPct !== null ? adherenceColor(r.adherence!) : "rgba(255,255,255,0.15)";
        const delayMin = r.avgDelay !== null ? Math.abs(r.avgDelay / 60).toFixed(1) : null;
        const delSign = r.avgDelay !== null ? (r.avgDelay >= 0 ? "+" : "-") : "";
        const delColor = r.avgDelay !== null ? delayColor(r.avgDelay) : "rgba(255,255,255,0.15)";
        const dimRow = r.vehicles === 0;

        return (
          <div class={`s-table-row${dimRow ? " s-dim" : ""}`}>
            <span class="s-td s-td-route">{name}</span>
            <span class="s-td s-td-num">{r.vehicles}</span>
            <span class="s-td s-td-num">{r.tripsScheduled || "—"}</span>
            <span class="s-td s-td-num" style={`color:${adhColor}`}>{adhPct !== null ? `${adhPct}%` : "—"}</span>
            <span class="s-td s-td-num" style={`color:${delColor}`}>{delayMin !== null ? `${delSign}${delayMin}m` : "—"}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Rail cards ──
function RailCards({ lines }: { lines: RailLineSnapshot[] }) {
  return (
    <div class="s-rail-grid">
      {lines.map(l => {
        const color = LINE_COLORS[l.line] || "#666";
        const avgMin = l.avgWait > 0 ? (l.avgWait / 60).toFixed(0) : "—";
        return (
          <div class="s-rail-card" style={`border-color:${color}`}>
            <div class="s-rail-line" style={`color:${color}`}>{l.line}</div>
            <div class="s-rail-trains">{l.trains}</div>
            <div class="s-rail-sub">trains</div>
            <div class="s-rail-wait">{avgMin}m avg wait</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ──
export function StatsPage() {
  const snapshot = getLatestSnapshot();
  const timeSeries = getSystemTimeSeries(6);
  const routeSnapshots = getLatestRouteSnapshots();
  const railSnapshots = getLatestRailSnapshots();
  const nameMap = routeNameMap();

  const firstTs = timeSeries.length > 0 ? timeSeries[0].ts : 0;
  const lastTs = timeSeries.length > 0 ? timeSeries[timeSeries.length - 1].ts : 0;
  const hoursOfData = ((lastTs - firstTs) / 3600).toFixed(1);

  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <title>System Stats — Pullcord</title>
        <meta name="description" content="MARTA schedule adherence and operational health." />
        <meta name="theme-color" content="#090e1a" />
        <link rel="icon" type="image/svg+xml" href="/public/icons/favicon.svg" />
        <style>{statsCSS()}</style>
      </head>
      <body>
        <div class="s-shell">
          <header class="s-header">
            <a href="/" class="s-back" aria-label="Home" onclick="if(history.length>1){history.back();return false}">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </a>
            <h1 class="s-h1">system stats</h1>
            <span class="s-fresh" id="fresh">live</span>
          </header>

          <main id="stats-data">
            <StatsContent
              snapshot={snapshot}
              timeSeries={timeSeries}
              routeSnapshots={routeSnapshots}
              railSnapshots={railSnapshots}
              nameMap={nameMap}
              hoursOfData={hoursOfData}
            />
          </main>
        </div>
        <script dangerouslySetInnerHTML={{ __html: statsJS() }} />
      </body>
    </html>
  );
}

// ── Content partial (for polling) ──
export function StatsContent({
  snapshot,
  timeSeries,
  routeSnapshots,
  railSnapshots,
  nameMap,
  hoursOfData,
}: {
  snapshot: SystemSnapshot | null;
  timeSeries: TimeSeriesPoint[];
  routeSnapshots: RouteSnapshot[];
  railSnapshots: RailLineSnapshot[];
  nameMap: Map<string, string>;
  hoursOfData: string;
}) {
  if (!snapshot) {
    return (
      <div class="s-empty">
        <div class="s-empty-icon">📊</div>
        <div class="s-empty-h">Warming up</div>
        <div class="s-empty-sub">Metrics start collecting when riders use the app.</div>
      </div>
    );
  }

  const adhPct = snapshot.busAdherence !== null ? Math.round(snapshot.busAdherence * 100) : null;
  const adhColor = adhPct !== null ? adherenceColor(snapshot.busAdherence!) : "#666";
  const delayMin = snapshot.busAvgDelay !== null ? (snapshot.busAvgDelay / 60).toFixed(1) : null;

  // Time series data
  const adhPoints = timeSeries
    .filter(p => p.scheduled > 0)
    .map(p => (p.vehicles / p.scheduled) * 100);
  const delayPoints = timeSeries
    .filter(p => p.avgDelay !== null)
    .map(p => (p.avgDelay as number) / 60);

  return (
    <div class="s-content">
      {/* ── Hero: Adherence ── */}
      <section class="s-hero">
        <div class="s-hero-big" style={`color:${adhColor}`}>
          {adhPct !== null ? `${adhPct}%` : "—"}
        </div>
        <div class="s-hero-label">schedule adherence</div>
        <div class="s-hero-sub">
          {snapshot.busVehicles} of {snapshot.busScheduled} scheduled buses running
        </div>
      </section>

      {/* ── Secondary metrics ── */}
      <section class="s-cards">
        <div class="s-card">
          <div class="s-card-val" style={delayMin ? `color:${delayColor(snapshot.busAvgDelay!)}` : ""}>
            {delayMin !== null ? `+${delayMin}m` : "—"}
          </div>
          <div class="s-card-label">avg delay</div>
        </div>
        <div class="s-card">
          <div class="s-card-val">{snapshot.busGhosts}</div>
          <div class="s-card-label">ghost buses</div>
        </div>
        <div class="s-card">
          <div class="s-card-val">{snapshot.busRoutes}</div>
          <div class="s-card-label">routes active</div>
        </div>
        <div class="s-card">
          <div class="s-card-val">{railSnapshots.reduce((s, l) => s + l.trains, 0)}</div>
          <div class="s-card-label">trains</div>
        </div>
      </section>

      {/* ── Adherence trend ── */}
      {adhPoints.length >= 2 && (
        <section class="s-section">
          <h2 class="s-h2">Adherence — last {hoursOfData}h</h2>
          <Sparkline points={adhPoints} color={adhColor} label="adh" unit="%" yMin={0} yMax={100} />
        </section>
      )}

      {/* ── Delay trend ── */}
      {delayPoints.length >= 2 && (
        <section class="s-section">
          <h2 class="s-h2">Avg delay — last {hoursOfData}h</h2>
          <Sparkline points={delayPoints} color="#D4A020" label="delay" unit="min" yMin={0} />
        </section>
      )}

      {/* ── Rail lines ── */}
      <section class="s-section">
        <h2 class="s-h2">Rail</h2>
        <RailCards lines={railSnapshots} />
      </section>

      {/* ── Route breakdown ── */}
      <section class="s-section">
        <h2 class="s-h2">Routes — worst adherence first</h2>
        <RouteTable routes={routeSnapshots} nameMap={nameMap} />
      </section>

      <div class="s-meta">
        Samples only when riders are active · {timeSeries.length} data points · {hoursOfData}h
      </div>
    </div>
  );
}

// ── Client JS: freshness timer + partial polling ──
function statsJS(): string {
  return `(function(){
    var d=document.getElementById("stats-data"),f=document.getElementById("fresh");
    if(!d||!f)return;
    var t=Date.now();
    function u(){var a=Math.floor((Date.now()-t)/1e3);f.textContent=a<5?"live":a+"s ago";f.style.color=a>60?"#E85D3A":""}
    setInterval(u,1e3);
    function poll(){fetch("/stats?partial=1",{signal:AbortSignal.timeout(8e3)}).then(function(r){if(r.ok)return r.text()}).then(function(h){if(h){d.innerHTML=h;t=Date.now();u()}}).catch(function(){})}
    var p=setInterval(poll,30000);
    document.addEventListener("visibilitychange",function(){if(document.hidden)clearInterval(p);else{poll();p=setInterval(poll,30000)}});
  })();`;
}

// ── Styles ──
function statsCSS(): string {
  return `
    *{box-sizing:border-box;margin:0;padding:0}
    body{
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
      background:#090e1a;color:#e8e8e8;-webkit-font-smoothing:antialiased;
    }
    .s-shell{max-width:960px;margin:0 auto;padding:0 1rem}
    .s-header{
      display:flex;align-items:center;gap:.75rem;padding:1rem 0;
      border-bottom:1px solid rgba(255,255,255,.06);
      position:sticky;top:0;background:#090e1a;z-index:10;
    }
    .s-back{color:#aaa;text-decoration:none;display:flex}.s-back:hover{color:#fff}
    .s-h1{font-size:1.25rem;font-weight:600;letter-spacing:-.02em;flex:1}
    .s-fresh{font-size:.85rem;color:rgba(255,255,255,.4);font-variant-numeric:tabular-nums}
    .s-content{padding:1.5rem 0 3rem;display:flex;flex-direction:column;gap:2rem}

    .s-empty{text-align:center;padding:4rem 1rem}
    .s-empty-icon{font-size:3rem;margin-bottom:1rem}
    .s-empty-h{font-size:1.5rem;font-weight:600;margin-bottom:.5rem}
    .s-empty-sub{color:rgba(255,255,255,.4);max-width:400px;margin:0 auto}

    /* Hero */
    .s-hero{text-align:center;padding:1.5rem 0}
    .s-hero-big{font-size:5rem;font-weight:800;line-height:1;font-variant-numeric:tabular-nums;letter-spacing:-.04em}
    .s-hero-label{font-size:1.1rem;color:rgba(255,255,255,.5);margin-top:.25rem;font-weight:500}
    .s-hero-sub{font-size:.95rem;color:rgba(255,255,255,.3);margin-top:.5rem;font-variant-numeric:tabular-nums}

    /* Cards row */
    .s-cards{display:grid;grid-template-columns:repeat(2,1fr);gap:.75rem}
    @media(min-width:640px){.s-cards{grid-template-columns:repeat(4,1fr)}}
    .s-card{
      background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);
      border-radius:12px;padding:1.25rem;text-align:center;
    }
    .s-card-val{font-size:1.75rem;font-weight:700;font-variant-numeric:tabular-nums;line-height:1}
    .s-card-label{font-size:.85rem;color:rgba(255,255,255,.4);margin-top:.5rem}

    /* Sections */
    .s-section{}
    .s-h2{font-size:1rem;font-weight:600;margin-bottom:1rem;color:rgba(255,255,255,.7)}

    /* Sparkline */
    .s-spark-wrap{}
    .s-spark{width:100%;height:80px;display:block}
    .s-spark-range{display:flex;justify-content:space-between;font-size:.8rem;color:rgba(255,255,255,.3);margin-top:.25rem;font-variant-numeric:tabular-nums}
    .s-nodata{color:rgba(255,255,255,.3);font-size:.9rem;padding:2rem;text-align:center}

    /* Route table */
    .s-table{font-variant-numeric:tabular-nums;font-size:.9rem}
    .s-table-head{display:flex;gap:.5rem;padding:.5rem 0;border-bottom:1px solid rgba(255,255,255,.08);color:rgba(255,255,255,.35);font-size:.8rem;font-weight:600}
    .s-table-row{display:flex;gap:.5rem;padding:.6rem 0;border-bottom:1px solid rgba(255,255,255,.04)}
    .s-table-row:last-child{border-bottom:none}
    .s-table-row.s-dim{opacity:.4}
    .s-th,.s-td{min-width:0}
    .s-th-route,.s-td-route{width:4rem;flex-shrink:0;font-weight:600}
    .s-th-num,.s-td-num{flex:1;text-align:right}
    .s-td-route{color:rgba(255,255,255,.7)}

    /* Rail cards */
    .s-rail-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:.75rem}
    @media(min-width:640px){.s-rail-grid{grid-template-columns:repeat(4,1fr)}}
    .s-rail-card{background:rgba(255,255,255,.04);border-radius:12px;padding:1rem;text-align:center;border-left:4px solid}
    .s-rail-line{font-size:.85rem;font-weight:700;letter-spacing:1px;margin-bottom:.25rem}
    .s-rail-trains{font-size:2rem;font-weight:700;font-variant-numeric:tabular-nums}
    .s-rail-sub{font-size:.75rem;color:rgba(255,255,255,.4)}
    .s-rail-wait{font-size:.8rem;color:rgba(255,255,255,.4);margin-top:.5rem;font-variant-numeric:tabular-nums}

    .s-meta{font-size:.8rem;color:rgba(255,255,255,.2);text-align:center;padding:1rem 0}

    /* Desktop: bigger hero, wider table */
    @media(min-width:960px){
      .s-hero-big{font-size:7rem}
      .s-hero-label{font-size:1.3rem}
      .s-card-val{font-size:2.25rem}
      .s-card{padding:1.75rem}
      .s-table{font-size:1rem}
      .s-th-route,.s-td-route{width:5rem}
    }
  `;
}
