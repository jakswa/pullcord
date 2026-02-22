import {
  fetchArrivals,
  byStation,
  stationSlug,
  stationDisplayName,
  stationLines,
  type RailArrival,
} from "../api";

// ── MARTA line colors — cranked to neon brightness ──
const LINE_COLOR: Record<string, string> = {
  GOLD: "#c9a227",
  RED: "#cc3333",
  BLUE: "#0074d9",
  GREEN: "#2ecc40",
};

// Brighter neon variants for glows and accents
const NEON: Record<string, string> = {
  GOLD: "#ffd633",
  RED: "#ff3344",
  BLUE: "#33bbff",
  GREEN: "#33ff66",
};

// Glow shadow values
const GLOW: Record<string, string> = {
  GOLD: "0 0 8px #ffd63388, 0 0 20px #ffd63344",
  RED: "0 0 8px #ff334488, 0 0 20px #ff334444",
  BLUE: "0 0 8px #33bbff88, 0 0 20px #33bbff44",
  GREEN: "0 0 8px #33ff6688, 0 0 20px #33ff6644",
};

// ── Station orderings for train timeline ──
const LINE_STATIONS: Record<string, string[]> = {
  RED: [
    "Airport","College Park","East Point","Lakewood","Oakland City","West End",
    "Garnett","Five Points","Peachtree Center","Civic Center","North Ave",
    "Midtown","Arts Center","Lindbergh","Buckhead","Medical Center","Dunwoody",
    "Sandy Springs","North Springs",
  ],
  GOLD: [
    "Airport","College Park","East Point","Lakewood","Oakland City","West End",
    "Garnett","Five Points","Peachtree Center","Civic Center","North Ave",
    "Midtown","Arts Center","Lindbergh","Lenox","Brookhaven","Chamblee","Doraville",
  ],
  BLUE: [
    "Hamilton E Holmes","West Lake","Ashby","Vine City","Omni Dome",
    "Five Points","Georgia State","King Memorial","Inman Park",
    "Edgewood Candler Park","East Lake","Decatur","Avondale","Kensington",
    "Indian Creek",
  ],
  GREEN: [
    "Bankhead","Ashby","Vine City","Omni Dome","Five Points","Georgia State",
    "King Memorial","Inman Park","Edgewood Candler Park",
  ],
};

// ── Helpers ──
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function minsDisplay(sec: number): string {
  const m = Math.max(0, Math.floor(sec / 60));
  if (m === 0) return '<span class="arriving">NOW</span>';
  return `<span class="t-val">${m}</span><span class="t-unit">m</span>`;
}

function sortByWait(a: RailArrival, b: RailArrival): number {
  return a.waitSeconds - b.waitSeconds;
}

/** Get soonest arrival per direction at a station */
function directionPills(arrivals: RailArrival[]): { dir: string; secs: number; line: string }[] {
  const byDir = new Map<string, RailArrival>();
  for (const a of arrivals) {
    const existing = byDir.get(a.direction);
    if (!existing || a.waitSeconds < existing.waitSeconds) {
      byDir.set(a.direction, a);
    }
  }
  return ["N", "S", "E", "W"]
    .filter((d) => byDir.has(d))
    .map((d) => {
      const a = byDir.get(d)!;
      return { dir: d, secs: a.waitSeconds, line: a.line };
    });
}

// ── CSS ──
const CSS = `
  :root {
    --bg: #08080f;
    --bg-card: #0e0e1a;
    --bg-card-hover: #141428;
    --border: #1a1a2e;
    --text: #e8e8f0;
    --text-dim: #8888aa;
    --gold: #c9a227;
    --red: #cc3333;
    --blue: #0074d9;
    --green: #2ecc40;
    --neon-gold: #ffd633;
    --neon-red: #ff3344;
    --neon-blue: #33bbff;
    --neon-green: #33ff66;
    --radius: 10px;
    --radius-pill: 24px;
  }

  @media (prefers-color-scheme: light) {
    :root {
      --bg: #f0f0f5;
      --bg-card: #ffffff;
      --bg-card-hover: #f5f5fa;
      --border: #d0d0dd;
      --text: #111122;
      --text-dim: #666688;
    }
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
  }

  .wrap {
    max-width: 480px;
    margin: 0 auto;
    padding: 0 12px;
  }

  /* ── Header ── */
  .hdr {
    text-align: center;
    padding: 24px 0 8px;
  }
  .hdr h1 {
    font-size: 1.6rem;
    font-weight: 800;
    letter-spacing: 0.04em;
    margin-bottom: 2px;
  }
  .hdr h1 .neon-m { color: var(--neon-red); text-shadow: 0 0 12px #ff334466; }
  .hdr h1 .neon-a { color: var(--neon-gold); text-shadow: 0 0 12px #ffd63366; }
  .hdr h1 .neon-r { color: var(--neon-blue); text-shadow: 0 0 12px #33bbff66; }
  .hdr h1 .neon-t2 { color: var(--neon-green); text-shadow: 0 0 12px #33ff6666; }
  .hdr h1 .neon-a2 { color: var(--neon-red); text-shadow: 0 0 12px #ff334466; }

  .hdr-sub {
    font-size: 0.95rem;
    color: var(--text-dim);
    letter-spacing: 0.15em;
    text-transform: uppercase;
  }

  /* ── Freshness bar ── */
  .fresh-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 0 14px;
    font-size: 0.9rem;
    color: var(--text-dim);
  }
  .pulse-dot {
    width: 8px; height: 8px;
    background: var(--neon-green);
    border-radius: 50%;
    box-shadow: 0 0 6px var(--neon-green), 0 0 14px #33ff6644;
    animation: pulse 2s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.8); }
  }

  /* ── Station list ── */
  .stn-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .stn-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: var(--bg-card);
    border-radius: var(--radius);
    border: 1px solid var(--border);
    text-decoration: none;
    color: var(--text);
    transition: background 0.15s, border-color 0.15s;
    position: relative;
    overflow: hidden;
  }
  .stn-row:hover, .stn-row:active {
    background: var(--bg-card-hover);
  }

  /* Neon line stripe on left edge */
  .line-stripe {
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 4px;
    flex-shrink: 0;
  }
  .line-stripe.multi {
    width: 4px;
  }

  .stn-name {
    font-size: 1rem;
    font-weight: 600;
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-left: 8px;
  }

  .pills {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    justify-content: flex-end;
    flex-shrink: 0;
  }

  /* ── The hero: NEON PILLS ── */
  .pill {
    display: inline-flex;
    align-items: center;
    height: 38px;
    border-radius: var(--radius-pill);
    background: #12121f;
    border: 1.5px solid;
    overflow: hidden;
    transition: transform 0.1s;
  }
  .pill:active { transform: scale(0.96); }

  .pill-dir {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 100%;
    font-size: 1rem;
    font-weight: 800;
    color: #fff;
    border-radius: var(--radius-pill) 0 0 var(--radius-pill);
    text-shadow: 0 0 6px rgba(255,255,255,0.5);
  }
  .pill-time {
    padding: 0 10px 0 8px;
    font-size: 1rem;
    font-weight: 700;
    color: #fff;
  }
  .pill-time .t-val { font-variant-numeric: tabular-nums; }
  .pill-time .t-unit {
    font-size: 0.88rem;
    opacity: 0.7;
    margin-left: 1px;
  }
  .pill-time .arriving {
    font-size: 0.95rem;
    font-weight: 800;
    animation: pulse 1.5s ease-in-out infinite;
  }

  /* Line-colored pills */
  .pill-GOLD { border-color: var(--neon-gold); box-shadow: 0 0 8px #ffd63355, 0 0 18px #ffd63322; }
  .pill-GOLD .pill-dir { background: var(--gold); }
  .pill-GOLD .pill-time { color: var(--neon-gold); }

  .pill-RED { border-color: var(--neon-red); box-shadow: 0 0 8px #ff334455, 0 0 18px #ff334422; }
  .pill-RED .pill-dir { background: var(--red); }
  .pill-RED .pill-time { color: var(--neon-red); }

  .pill-BLUE { border-color: var(--neon-blue); box-shadow: 0 0 8px #33bbff55, 0 0 18px #33bbff22; }
  .pill-BLUE .pill-dir { background: var(--blue); }
  .pill-BLUE .pill-time { color: var(--neon-blue); }

  .pill-GREEN { border-color: var(--neon-green); box-shadow: 0 0 8px #33ff6655, 0 0 18px #33ff6622; }
  .pill-GREEN .pill-dir { background: var(--green); }
  .pill-GREEN .pill-time { color: var(--neon-green); }

  @media (prefers-color-scheme: light) {
    .pill { background: #f8f8fd; }
    .pill-GOLD .pill-time { color: #8a6e10; }
    .pill-RED .pill-time { color: #aa2222; }
    .pill-BLUE .pill-time { color: #005baa; }
    .pill-GREEN .pill-time { color: #1a9930; }
    .pill-GOLD { box-shadow: 0 0 4px #c9a22733; }
    .pill-RED { box-shadow: 0 0 4px #cc333333; }
    .pill-BLUE { box-shadow: 0 0 4px #0074d933; }
    .pill-GREEN { box-shadow: 0 0 4px #2ecc4033; }
  }

  /* ── Station detail ── */
  .detail-hdr {
    padding: 20px 0 6px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .back-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px; height: 36px;
    border-radius: 50%;
    background: var(--bg-card);
    border: 1px solid var(--border);
    color: var(--text);
    text-decoration: none;
    font-size: 1.2rem;
    transition: background 0.15s;
  }
  .back-link:hover { background: var(--bg-card-hover); }
  .detail-hdr h2 {
    font-size: 1.35rem;
    font-weight: 800;
  }

  /* Line indicator dots under station name */
  .line-dots {
    display: flex;
    gap: 5px;
    padding: 0 0 16px 46px;
  }
  .line-dot {
    width: 22px; height: 6px;
    border-radius: 3px;
  }

  /* Arrival rows */
  .arr-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .arr-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: var(--bg-card);
    border-radius: var(--radius);
    border: 1px solid var(--border);
    text-decoration: none;
    color: var(--text);
    transition: background 0.15s;
  }
  .arr-row:hover { background: var(--bg-card-hover); }

  .arr-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px; height: 34px;
    border-radius: 50%;
    font-size: 1rem;
    font-weight: 800;
    color: #fff;
    flex-shrink: 0;
  }

  .arr-info {
    flex: 1;
    min-width: 0;
  }
  .arr-dest {
    font-size: 1rem;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .arr-meta {
    font-size: 0.9rem;
    color: var(--text-dim);
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .arr-line-tag {
    font-size: 0.88rem;
    font-weight: 700;
    padding: 1px 7px;
    border-radius: 4px;
    color: #fff;
  }

  .arr-time {
    font-size: 1.15rem;
    font-weight: 800;
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
  }

  /* ── Train timeline ── */
  .train-hdr {
    padding: 20px 0 4px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .train-hdr h2 {
    font-size: 1.25rem;
    font-weight: 800;
  }
  .train-line-badge {
    font-size: 0.9rem;
    font-weight: 700;
    padding: 3px 12px;
    border-radius: 14px;
    color: #fff;
  }
  .train-dest {
    padding: 2px 0 16px 46px;
    font-size: 0.95rem;
    color: var(--text-dim);
  }

  .timeline {
    position: relative;
    padding: 0 0 0 30px;
    margin-left: 18px;
  }
  .tl-line {
    position: absolute;
    left: 18px;
    top: 0;
    bottom: 0;
    width: 4px;
    border-radius: 2px;
  }

  .tl-stop {
    position: relative;
    padding: 12px 0 12px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .tl-stop::before {
    content: '';
    position: absolute;
    left: -19px;
    top: 50%;
    transform: translateY(-50%);
    width: 14px; height: 14px;
    border-radius: 50%;
    border: 3px solid;
    background: var(--bg);
    z-index: 1;
  }
  .tl-stop.current::before {
    width: 18px; height: 18px;
    left: -21px;
    animation: pulse 1.5s ease-in-out infinite;
  }
  .tl-stop.visited { opacity: 0.45; }

  .tl-name {
    font-size: 1rem;
    font-weight: 600;
  }
  .tl-stop.current .tl-name {
    font-weight: 800;
  }
  .tl-time {
    font-size: 0.95rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
    margin-left: 12px;
  }
  .tl-current-tag {
    font-size: 0.88rem;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 10px;
    color: #fff;
    margin-left: 8px;
  }

  /* ── Footer ── */
  .ftr {
    text-align: center;
    padding: 28px 0 20px;
    font-size: 0.9rem;
    color: var(--text-dim);
  }
  .ftr a {
    color: var(--text-dim);
    text-decoration: none;
    transition: color 0.15s;
  }
  .ftr a:hover { color: var(--text); }
  .ftr .sep { margin: 0 6px; opacity: 0.4; }

  /* ── Animations ── */
  @keyframes glow-sweep {
    0% { opacity: 0.7; }
    50% { opacity: 1; }
    100% { opacity: 0.7; }
  }

  /* ── No-data state ── */
  .no-data {
    text-align: center;
    padding: 40px 20px;
    color: var(--text-dim);
    font-size: 1.05rem;
  }
`;

// ── Render helpers ──

function renderPill(dir: string, secs: number, line: string): string {
  return `<div class="pill pill-${esc(line)}"><div class="pill-dir">${esc(dir)}</div><div class="pill-time">${minsDisplay(secs)}</div></div>`;
}

function renderLineStripe(lines: Set<string>): string {
  const arr = [...lines];
  if (arr.length === 1) {
    const c = NEON[arr[0]] || "#888";
    return `<div class="line-stripe" style="background:${c};box-shadow:0 0 8px ${c}66"></div>`;
  }
  // Multi-line gradient stripe
  const stops = arr.map((l, i) => {
    const c = NEON[l] || "#888";
    const pct1 = (i / arr.length * 100).toFixed(0);
    const pct2 = ((i + 1) / arr.length * 100).toFixed(0);
    return `${c} ${pct1}%, ${c} ${pct2}%`;
  }).join(", ");
  return `<div class="line-stripe multi" style="background:linear-gradient(to bottom,${stops})"></div>`;
}

function renderLineDots(lines: Set<string>): string {
  return [...lines].map(l => {
    const c = NEON[l] || "#888";
    return `<div class="line-dot" style="background:${c};box-shadow:0 0 6px ${c}88"></div>`;
  }).join("");
}

function shell(title: string, body: string, partial: boolean): string {
  if (partial) return body;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#08080f">
<title>${esc(title)} — MARTA Rail</title>
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
${body}
</div>
<script>${POLL_JS}</script>
</body>
</html>`;
}

const POLL_JS = `
(function(){
  var age=0, ageEl, iv, piv;
  function poll(){
    fetch(location.pathname+'?partial=1').then(function(r){return r.text()}).then(function(h){
      var el=document.getElementById('rail-body');
      if(el){el.innerHTML=h; age=0; updateAge();}
    }).catch(function(){});
  }
  function updateAge(){
    ageEl=ageEl||document.getElementById('fresh-age');
    if(ageEl)ageEl.textContent=age+'s ago';
  }
  iv=setInterval(function(){age++;updateAge()},1000);
  piv=setInterval(poll,10000);
})();
`;

// ── LANDING VIEW ──
export async function landingView(partial?: boolean): Promise<string> {
  let arrivals: RailArrival[];
  try {
    arrivals = await fetchArrivals();
  } catch {
    const body = `<div class="hdr"><h1><span class="neon-m">M</span><span class="neon-a">A</span><span class="neon-r">R</span><span class="neon-t2">T</span><span class="neon-a2">A</span></h1><div class="hdr-sub">Rail Tracker</div></div><div class="no-data">⚡ Waiting for signal...</div>`;
    return shell("MARTA Rail", body, !!partial);
  }

  const stations = byStation(arrivals);
  // Sort stations alphabetically
  const sorted = [...stations.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  let rows = "";
  for (const [name, arr] of sorted) {
    const slug = stationSlug(name);
    const display = stationDisplayName(name);
    const lines = stationLines(arr);
    const pills = directionPills(arr);

    const stripe = renderLineStripe(lines);
    const pillsHtml = pills.map(p => renderPill(p.dir, p.secs, p.line)).join("");

    rows += `<a href="/rail-e/${esc(slug)}" class="stn-row">${stripe}<div class="stn-name">${esc(display)}</div><div class="pills">${pillsHtml}</div></a>\n`;
  }

  const body = `
<div class="hdr">
  <h1><span class="neon-m">M</span><span class="neon-a">A</span><span class="neon-r">R</span><span class="neon-t2">T</span><span class="neon-a2">A</span></h1>
  <div class="hdr-sub">Rail Tracker</div>
</div>
<div class="fresh-bar"><div class="pulse-dot"></div><span id="fresh-age">0s ago</span></div>
<div id="rail-body">
<div class="stn-list">
${rows}
</div>
</div>
<div class="ftr">
  MARTA Rail<span class="sep">·</span><a href="/bus">Bus</a><span class="sep">·</span><a href="https://home.jake.town">home.jake.town</a>
</div>`;

  return shell("MARTA Rail", body, !!partial);
}

// ── STATION VIEW ──
export async function stationView(slug: string, partial?: boolean): Promise<string | null> {
  let arrivals: RailArrival[];
  try {
    arrivals = await fetchArrivals();
  } catch {
    return null;
  }

  const stations = byStation(arrivals);
  // Find station matching slug
  let stationName: string | null = null;
  let stationArrivals: RailArrival[] = [];
  for (const [name, arr] of stations) {
    if (stationSlug(name) === slug) {
      stationName = name;
      stationArrivals = arr;
      break;
    }
  }

  if (!stationName) return null;

  const display = stationDisplayName(stationName);
  const lines = stationLines(stationArrivals);
  const sorted = [...stationArrivals].sort(sortByWait);

  let rows = "";
  for (const a of sorted) {
    const color = LINE_COLOR[a.line] || "#888";
    const neon = NEON[a.line] || "#888";
    const glow = GLOW[a.line] || "";
    const m = Math.max(0, Math.floor(a.waitSeconds / 60));
    const timeStr = m === 0
      ? `<span class="arriving" style="color:${neon}">NOW</span>`
      : `<span style="color:${neon}">${m}<span style="font-size:0.88rem;opacity:0.7">m</span></span>`;
    const dest = stationDisplayName(a.destination);

    rows += `<a href="/rail-e/train/${esc(a.trainId)}" class="arr-row">
  <div class="arr-badge" style="background:${color};box-shadow:${glow}">${esc(a.direction)}</div>
  <div class="arr-info">
    <div class="arr-dest">${esc(dest)}</div>
    <div class="arr-meta"><span class="arr-line-tag" style="background:${color}">${esc(a.line)}</span>${a.isRealtime ? "" : '<span style="opacity:0.5">scheduled</span>'}</div>
  </div>
  <div class="arr-time">${timeStr}</div>
</a>\n`;
  }

  const body = `
<div class="detail-hdr">
  <a href="/rail-e" class="back-link">←</a>
  <h2>${esc(display)}</h2>
</div>
<div class="line-dots">${renderLineDots(lines)}</div>
<div class="fresh-bar"><div class="pulse-dot"></div><span id="fresh-age">0s ago</span></div>
<div id="rail-body">
<div class="arr-list">
${rows || '<div class="no-data">No arrivals right now</div>'}
</div>
</div>
<div class="ftr">
  MARTA Rail<span class="sep">·</span><a href="/bus">Bus</a><span class="sep">·</span><a href="https://home.jake.town">home.jake.town</a>
</div>`;

  return shell(display, body, !!partial);
}

// ── TRAIN VIEW ──
export async function trainView(trainId: string, partial?: boolean): Promise<string | null> {
  let arrivals: RailArrival[];
  try {
    arrivals = await fetchArrivals();
  } catch {
    return null;
  }

  // Find all arrivals for this train
  const trainArrivals = arrivals.filter(a => a.trainId === trainId);
  if (trainArrivals.length === 0) return null;

  const line = trainArrivals[0].line;
  const direction = trainArrivals[0].direction;
  const destination = stationDisplayName(trainArrivals[0].destination);
  const color = LINE_COLOR[line] || "#888";
  const neon = NEON[line] || "#888";
  const glow = GLOW[line] || "";

  // Get ordered stations for this line
  let stationOrder = LINE_STATIONS[line] || [];
  // Reverse if heading S or W (toward start of the line)
  if (direction === "S" || direction === "W") {
    stationOrder = [...stationOrder].reverse();
  }

  // Map of station arrivals for this train
  const trainStationMap = new Map<string, RailArrival>();
  for (const a of trainArrivals) {
    trainStationMap.set(a.station.toUpperCase(), a);
  }

  // Normalize station names for matching
  function normalize(s: string) { return s.toUpperCase().replace(/ STATION$/i, "").trim(); }

  // Find current station (soonest arrival)
  const soonest = [...trainArrivals].sort(sortByWait)[0];
  const currentNorm = normalize(soonest.station);

  // Build timeline stops
  let stops = "";
  let foundCurrent = false;
  let pastCurrent = false;

  for (const stn of stationOrder) {
    const stnNorm = normalize(stn);
    const match = trainArrivals.find(a => normalize(a.station) === stnNorm);
    const isCurrent = stnNorm === currentNorm;

    if (isCurrent) foundCurrent = true;

    const visited = !foundCurrent;
    const cls = isCurrent ? "tl-stop current" : visited ? "tl-stop visited" : "tl-stop";

    let timeHtml = "";
    if (match) {
      const m = Math.max(0, Math.floor(match.waitSeconds / 60));
      if (m === 0) {
        timeHtml = `<span class="tl-time" style="color:${neon}">NOW</span>`;
      } else {
        timeHtml = `<span class="tl-time" style="color:${neon}">${m}m</span>`;
      }
    }

    const currentTag = isCurrent
      ? `<span class="tl-current-tag" style="background:${color};box-shadow:${glow}">●</span>`
      : "";

    stops += `<div class="${cls}" style="--line-color:${neon}">
  <div><span class="tl-name">${esc(stationDisplayName(stn))}</span>${currentTag}</div>
  ${timeHtml}
</div>\n`;

    if (isCurrent) pastCurrent = true;
  }

  // Dynamic CSS for line-colored timeline
  const timelineCSS = `
    .tl-line { background: ${color}; box-shadow: 0 0 12px ${neon}55, 0 0 24px ${neon}22; }
    .tl-stop::before { border-color: ${neon}; }
    .tl-stop.current::before { background: ${neon}; border-color: ${neon}; box-shadow: 0 0 10px ${neon}88, 0 0 24px ${neon}44; }
    .tl-stop.current .tl-name { color: ${neon}; text-shadow: 0 0 8px ${neon}44; }
  `;

  const body = `
<style>${timelineCSS}</style>
<div class="train-hdr">
  <a href="/rail-e" class="back-link">←</a>
  <h2>Train ${esc(trainId)}</h2>
  <span class="train-line-badge" style="background:${color};box-shadow:${glow}">${esc(line)}</span>
</div>
<div class="train-dest">→ ${esc(destination)}</div>
<div class="fresh-bar"><div class="pulse-dot"></div><span id="fresh-age">0s ago</span></div>
<div id="rail-body">
<div class="timeline">
  <div class="tl-line"></div>
  ${stops}
</div>
</div>
<div class="ftr">
  MARTA Rail<span class="sep">·</span><a href="/bus">Bus</a><span class="sep">·</span><a href="https://home.jake.town">home.jake.town</a>
</div>`;

  return shell(`Train ${trainId}`, body, !!partial);
}
