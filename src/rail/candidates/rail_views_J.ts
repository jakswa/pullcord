import {
  fetchArrivals,
  byStation,
  stationSlug,
  stationDisplayName,
  stationLines,
  type RailArrival,
} from "../api";

// ── MARTA line colors ──
const LINE_COLOR: Record<string, string> = {
  GOLD: "#c9a227",
  RED: "#cc3333",
  BLUE: "#0074d9",
  GREEN: "#2ecc40",
};

// ── Light mode color overrides — darker for accessibility ──
const LINE_COLOR_LIGHT: Record<string, string> = {
  GOLD: "#7a5e08",
  RED: "#991111",
  BLUE: "#004a8a",
  GREEN: "#0a5518",
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
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  if (m === 0) return '<span class="crt-now">NOW</span>';
  return `<span class="crt-val">${m}</span><span class="crt-unit">m</span>`;
}

function sortByWait(a: RailArrival, b: RailArrival): number {
  return a.waitSeconds - b.waitSeconds;
}

function directionLabel(d: string): string {
  const map: Record<string, string> = { N: "NORTH", S: "SOUTH", E: "EAST", W: "WEST" };
  return map[d] || d;
}

// ── CSS — Brutalized CRT ──
const CSS = `
  :root {
    --bg: #050a05;
    --bg-screen: #080f08;
    --phosphor: #33ff33;
    --phosphor-dim: #1a9f1a;
    --phosphor-bright: #55ff55;
    --phosphor-glow: rgba(51, 255, 51, 0.25);
    --amber: #ffb833;
    --amber-dim: #996b1a;
    --text: #30ee30;
    --text-dim: #1a8a1a;
    --border: #143014;
    --border-heavy: #1e5a1e;
    --gold: #c9a227;
    --red: #cc3333;
    --blue: #0074d9;
    --green: #2ecc40;
  }

  @media (prefers-color-scheme: light) {
    :root {
      --bg: #e8ebe8;
      --bg-screen: #dce0dc;
      --phosphor: #1a6b1a;
      --phosphor-dim: #2d8f2d;
      --phosphor-bright: #0d4d0d;
      --phosphor-glow: rgba(26, 107, 26, 0.08);
      --amber: #8a5e10;
      --amber-dim: #6b4a10;
      --text: #1a5a1a;
      --text-dim: #3a7a3a;
      --border: #90a890;
      --border-heavy: #6a8a6a;
    }
    .scanlines { display: none !important; }
    .crt-vignette { display: none !important; }
    body { text-shadow: none !important; }
    .crt-glow { text-shadow: none !important; }
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'SF Mono', 'Menlo', 'Consolas', 'DejaVu Sans Mono', 'Courier New', monospace;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    -webkit-font-smoothing: none;
    position: relative;
    overflow-x: hidden;
  }

  .scanlines {
    pointer-events: none;
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    z-index: 9999;
    background: repeating-linear-gradient(
      to bottom,
      transparent 0px,
      transparent 1px,
      rgba(0,0,0,0.25) 1px,
      rgba(0,0,0,0.25) 3px
    );
  }

  .crt-vignette {
    pointer-events: none;
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    z-index: 9998;
    background: radial-gradient(
      ellipse at center,
      transparent 50%,
      rgba(0,0,0,0.55) 100%
    );
  }

  .crt-glow {
    text-shadow:
      0 0 4px rgba(51, 255, 51, 0.35),
      0 0 12px rgba(51, 255, 51, 0.1);
  }

  .wrap {
    max-width: 480px;
    margin: 0 auto;
    padding: 0 10px;
    position: relative;
    z-index: 1;
    background: linear-gradient(
      180deg,
      rgba(51, 255, 51, 0.01) 0%,
      transparent 15%,
      transparent 85%,
      rgba(51, 255, 51, 0.01) 100%
    );
  }

  /* ── Header — single line, brutal ── */
  .hdr {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 12px 0 6px;
    flex-wrap: nowrap;
  }
  .hdr h1 {
    font-size: 1.8rem;
    font-weight: 900;
    letter-spacing: 0.12em;
    color: var(--phosphor-bright);
    text-shadow:
      0 0 6px rgba(51, 255, 51, 0.6),
      0 0 20px rgba(51, 255, 51, 0.25),
      0 0 40px rgba(51, 255, 51, 0.1);
    white-space: nowrap;
  }
  .hdr-stat {
    font-size: 1rem;
    color: var(--text-dim);
    display: inline-flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
    margin-left: auto;
  }

  /* Blinking cursor */
  .cursor {
    display: inline-block;
    width: 0.55em;
    height: 1.1em;
    background: var(--phosphor);
    vertical-align: text-bottom;
    animation: blink 1s step-end infinite;
    margin-left: 2px;
    opacity: 0.9;
  }
  @keyframes blink {
    0%, 100% { opacity: 0.9; }
    50% { opacity: 0; }
  }

  .pulse-dot {
    display: inline-block;
    width: 7px; height: 7px;
    background: var(--phosphor);
    border-radius: 50%;
    box-shadow: 0 0 6px var(--phosphor), 0 0 14px rgba(51,255,51,0.3);
    animation: pulse 2s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(0.75); }
  }

  /* ── Heavy divider — brutal ── */
  .divider {
    border: none;
    border-top: 3px solid var(--border-heavy);
    margin: 4px 0;
    box-shadow: 0 1px 0 var(--phosphor-glow);
  }
  .divider-thin {
    border: none;
    border-top: 2px solid var(--border);
    margin: 0;
  }

  /* ── Station list (landing) ── */
  .stn-list {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .stn-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 6px;
    background: none;
    border: none;
    border-bottom: 2px solid var(--border-heavy);
    text-decoration: none;
    color: var(--text);
    transition: background 0.12s;
    position: relative;
  }
  .stn-row:first-child {
    border-top: 2px solid var(--border-heavy);
  }
  .stn-row:hover, .stn-row:active {
    background: rgba(51, 255, 51, 0.05);
  }

  /* Line indicator — left bracket */
  .line-ind {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex-shrink: 0;
    width: 5px;
  }
  .line-ind-seg {
    width: 5px;
    height: 12px;
    border-radius: 1px;
  }

  .stn-name {
    font-size: 1.3rem;
    font-weight: 800;
    flex: 1 1 auto;
    min-width: 0;
    color: var(--phosphor-bright);
    text-shadow: 0 0 5px rgba(51, 255, 51, 0.35);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* 3+ directions: pills as 2x2 grid, right-aligned, row grows taller */
  .stn-row.stn-wrap .pills {
    display: grid;
    grid-template-columns: 96px 96px;
    gap: 3px;
    justify-content: end;
  }

  .pills {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    justify-content: flex-end;
    flex-shrink: 0;
  }

  /* ── CRT Pills — brutal bordered capsules ── */
  .pill {
    display: inline-flex;
    align-items: center;
    height: 38px;
    width: 96px;
    border-radius: 2px;
    border: 2px solid;
    overflow: hidden;
    font-size: 1.15rem;
    flex-shrink: 0;
  }

  .pill-dir {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 100%;
    font-size: 1.15rem;
    font-weight: 900;
    color: #000;
    border-right: 1px solid rgba(0,0,0,0.3);
  }
  .pill-time {
    flex: 1;
    text-align: center;
    padding: 0 5px 0 4px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
  .crt-val { font-size: 1.15rem; }
  .crt-unit {
    font-size: 1rem;
    opacity: 0.85;
    margin-left: 1px;
  }
  .crt-now {
    font-size: 1.15rem;
    font-weight: 900;
    animation: now-pulse 1.5s ease-in-out infinite;
  }
  @keyframes now-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  /* Line-colored pills — dark mode */
  .pill-GOLD { border-color: #c9a227; box-shadow: 0 0 6px rgba(201,162,39,0.25); }
  .pill-GOLD .pill-dir { background: #c9a227; }
  .pill-GOLD .pill-time { color: #ddb832; text-shadow: 0 0 6px rgba(201,162,39,0.4); }

  .pill-RED { border-color: #cc3333; box-shadow: 0 0 6px rgba(204,51,51,0.25); border-style: solid; }
  .pill-RED .pill-dir { background: #cc3333; }
  .pill-RED .pill-time { color: #ff5555; text-shadow: 0 0 6px rgba(255,85,85,0.4); }

  .pill-BLUE { border-color: #0074d9; box-shadow: 0 0 6px rgba(0,116,217,0.25); }
  .pill-BLUE .pill-dir { background: #0074d9; }
  .pill-BLUE .pill-time { color: #3399ee; text-shadow: 0 0 6px rgba(0,116,217,0.4); }

  .pill-GREEN { border-color: #2ecc40; box-shadow: 0 0 6px rgba(46,204,64,0.25); border-style: dashed; }
  .pill-GREEN .pill-dir { background: #2ecc40; }
  .pill-GREEN .pill-time { color: #44dd55; text-shadow: 0 0 6px rgba(46,204,64,0.4); }

  @media (prefers-color-scheme: light) {
    .pill-GOLD .pill-time { color: #7a5e08; text-shadow: none; }
    .pill-RED .pill-time { color: #991111; text-shadow: none; }
    .pill-BLUE .pill-time { color: #004a8a; text-shadow: none; }
    .pill-GREEN .pill-time { color: #0a5518; text-shadow: none; }
    .pill { background: rgba(255,255,255,0.5); box-shadow: none; }
    .pill-RED { border-style: solid; }
    .pill-GREEN { border-style: dashed; }

    /* Arrival time colors in detail/train views */
    .arr-time-GOLD { color: #7a5e08 !important; }
    .arr-time-RED { color: #991111 !important; }
    .arr-time-BLUE { color: #004a8a !important; }
    .arr-time-GREEN { color: #0a5518 !important; }

    .tl-time-GOLD { color: #7a5e08 !important; }
    .tl-time-RED { color: #991111 !important; }
    .tl-time-BLUE { color: #004a8a !important; }
    .tl-time-GREEN { color: #0a5518 !important; }
  }

  /* ── Station detail ── */
  .detail-hdr {
    padding: 12px 0 6px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .back-link {
    color: var(--phosphor-dim);
    text-decoration: none;
    font-size: 1.2rem;
    font-weight: 900;
    padding: 2px 6px;
    border: 2px solid var(--border-heavy);
    border-radius: 2px;
    transition: color 0.12s, border-color 0.12s;
    flex-shrink: 0;
  }
  .back-link:hover {
    color: var(--phosphor-bright);
    border-color: var(--phosphor-dim);
  }
  .detail-hdr h2 {
    font-size: 1.4rem;
    font-weight: 900;
    color: var(--phosphor-bright);
    text-shadow: 0 0 8px rgba(51,255,51,0.3);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .line-badge-sm {
    font-size: 1rem;
    font-weight: 800;
    padding: 2px 8px;
    border-radius: 2px;
    color: #000;
    flex-shrink: 0;
  }
  .hdr-fresh {
    font-size: 1rem;
    color: var(--text-dim);
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin-left: auto;
    flex-shrink: 0;
  }

  /* Arrival rows */
  .arr-list {
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .arr-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 6px;
    background: none;
    border-bottom: 2px solid var(--border-heavy);
    text-decoration: none;
    color: var(--text);
    transition: background 0.12s;
  }
  .arr-row:first-child {
    border-top: 2px solid var(--border-heavy);
  }
  .arr-row:hover { background: rgba(51, 255, 51, 0.05); }

  .arr-line-dot {
    width: 10px; height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
    box-shadow: 0 0 6px currentColor;
  }

  .arr-info {
    flex: 1;
    min-width: 0;
  }
  .arr-dest {
    font-size: 1.25rem;
    font-weight: 800;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--phosphor-bright);
  }
  .arr-meta {
    font-size: 1rem;
    color: var(--text-dim);
    display: flex;
    align-items: center;
    gap: 5px;
    margin-top: 1px;
  }
  .arr-dir-tag {
    font-weight: 800;
    letter-spacing: 0.04em;
  }

  .arr-time {
    font-size: 1.5rem;
    font-weight: 900;
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
    text-align: right;
    min-width: 50px;
  }

  /* ── Train timeline ── */
  .train-hdr {
    padding: 12px 0 6px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .train-hdr h2 {
    font-size: 1.4rem;
    font-weight: 900;
    color: var(--phosphor-bright);
    text-shadow: 0 0 8px rgba(51,255,51,0.3);
  }
  .train-line-tag {
    font-size: 1rem;
    font-weight: 800;
    padding: 2px 10px;
    border-radius: 2px;
    color: #000;
    flex-shrink: 0;
  }
  .train-dest {
    padding: 1px 0 6px;
    font-size: 1.1rem;
    color: var(--text-dim);
    font-weight: 800;
  }

  .timeline {
    position: relative;
    padding: 0 0 0 28px;
    margin-left: 14px;
  }
  .tl-line {
    position: absolute;
    left: 13px;
    top: 0;
    bottom: 0;
    width: 4px;
    border-radius: 1px;
    opacity: 0.7;
  }

  .tl-stop {
    position: relative;
    padding: 8px 0 8px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .tl-stop::before {
    content: '';
    position: absolute;
    left: -20px;
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
    left: -22px;
    animation: tl-pulse 1.5s ease-in-out infinite;
  }
  @keyframes tl-pulse {
    0%, 100% { opacity: 1; transform: translateY(-50%) scale(1); }
    50% { opacity: 0.6; transform: translateY(-50%) scale(0.85); }
  }
  .tl-stop.visited { opacity: 0.3; }

  .tl-left {
    display: flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
    flex: 1;
  }
  .tl-name {
    font-size: 1.25rem;
    font-weight: 800;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .tl-stop.current .tl-name {
    font-weight: 900;
  }
  .tl-here-tag {
    font-size: 1rem;
    font-weight: 900;
    padding: 1px 5px;
    border-radius: 2px;
    color: #000;
    animation: blink 1.2s step-end infinite;
    flex-shrink: 0;
  }
  .tl-time {
    font-size: 1.25rem;
    font-weight: 900;
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
    margin-left: 8px;
  }

  /* ── Footer ── */
  .ftr {
    text-align: center;
    padding: 24px 0 16px;
    font-size: 1rem;
    color: var(--text-dim);
    letter-spacing: 0.04em;
  }
  .ftr a {
    color: var(--text-dim);
    text-decoration: none;
    border-bottom: 1px dashed var(--border);
    transition: color 0.12s;
  }
  .ftr a:hover { color: var(--phosphor-bright); }

  /* ── No-data ── */
  .no-data {
    text-align: center;
    padding: 32px 12px;
    color: var(--text-dim);
    font-size: 1rem;
  }

  /* ── CRT power-on animation ── */
  @keyframes crt-on {
    0% { opacity: 0; filter: brightness(0); }
    5% { opacity: 1; filter: brightness(2); }
    10% { opacity: 0.3; filter: brightness(0.5); }
    15% { opacity: 1; filter: brightness(1.5); }
    20% { opacity: 0.8; filter: brightness(0.8); }
    30% { opacity: 1; filter: brightness(1); }
  }
  .wrap { animation: crt-on 0.7s ease-out; }

  @keyframes crt-flicker {
    0%, 100% { opacity: 1; }
    92% { opacity: 1; }
    93% { opacity: 0.96; }
    94% { opacity: 1; }
  }
  body { animation: crt-flicker 8s linear infinite; }
`;

// ── Render helpers ──

function renderPill(dir: string, secs: number, line: string): string {
  return `<div class="pill pill-${esc(line)}"><div class="pill-dir">${esc(dir)}</div><div class="pill-time">${minsDisplay(secs)}</div></div>`;
}

function renderLineIndicator(lines: Set<string>): string {
  const arr = [...lines];
  return `<div class="line-ind">${arr.map(l => `<div class="line-ind-seg" style="background:${LINE_COLOR[l] || '#888'};box-shadow:0 0 4px ${LINE_COLOR[l] || '#888'}66"></div>`).join("")}</div>`;
}

function directionPills(arrivals: RailArrival[]): { dir: string; secs: number; line: string }[] {
  const byDir = new Map<string, RailArrival>();
  for (const a of arrivals) {
    const existing = byDir.get(a.direction);
    if (!existing || a.waitSeconds < existing.waitSeconds) {
      byDir.set(a.direction, a);
    }
  }
  return ["N", "S", "E", "W"]
    .filter(d => byDir.has(d))
    .map(d => {
      const a = byDir.get(d)!;
      return { dir: d, secs: a.waitSeconds, line: a.line };
    });
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
    ageEl=document.getElementById('fresh-age');
    if(ageEl)ageEl.textContent=age+'s';
  }
  iv=setInterval(function(){age++;updateAge()},1000);
  piv=setInterval(poll,10000);
})();
`;

function shell(title: string, body: string, partial: boolean): string {
  if (partial) return body;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#0a0a0a">
<title>${esc(title)}</title>
<style>${CSS}</style>
</head>
<body>
<div class="scanlines"></div>
<div class="crt-vignette"></div>
<div class="wrap crt-glow">
${body}
</div>
<script>${POLL_JS}</script>
</body>
</html>`;
}

// ── LANDING VIEW ──
export async function landingView(partial?: boolean): Promise<string> {
  let arrivals: RailArrival[];
  try {
    arrivals = await fetchArrivals();
  } catch {
    const body = `<div class="hdr"><h1>MARTA RAIL<span class="cursor"></span></h1><span class="hdr-stat">offline</span></div><div class="no-data">CONNECTION LOST... RETRYING<span class="cursor"></span></div>`;
    return shell("MARTA Rail", body, !!partial);
  }

  const stations = byStation(arrivals);
  const sorted = [...stations.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  let rows = "";
  for (const [name, arr] of sorted) {
    const slug = stationSlug(name);
    const display = stationDisplayName(name);
    const lines = stationLines(arr);
    const pills = directionPills(arr);

    const lineInd = renderLineIndicator(lines);
    const pillsHtml = pills.map(p => renderPill(p.dir, p.secs, p.line)).join("");
    const wrapClass = pills.length >= 3 ? " stn-wrap" : "";

    rows += `<a href="/rail-j/${esc(slug)}" class="stn-row${wrapClass}">${lineInd}<div class="stn-name">${esc(display)}</div><div class="pills">${pillsHtml}</div></a>\n`;
  }

  const innerContent = `<div class="stn-list">\n${rows}</div>`;
  if (partial) return innerContent;

  const body = `
<div class="hdr">
  <h1>MARTA RAIL<span class="cursor"></span></h1>
  <span class="hdr-stat"><span class="pulse-dot"></span> <span id="fresh-age">0s</span></span>
</div>
<hr class="divider">
<div id="rail-body">
${innerContent}
</div>
<div class="ftr">
  MARTA Rail · <a href="/bus">Bus</a> · <a href="https://home.jake.town">home.jake.town</a>
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

  const lineBadges = [...lines].map(l =>
    `<span class="line-badge-sm" style="background:${LINE_COLOR[l] || '#888'};box-shadow:0 0 6px ${LINE_COLOR[l] || '#888'}55">${esc(l)}</span>`
  ).join("");

  let rows = "";
  for (const a of sorted) {
    const color = LINE_COLOR[a.line] || "#888";
    const dest = stationDisplayName(a.destination);
    const m = Math.max(0, Math.floor(a.waitSeconds / 60));
    const timeClass = `arr-time-${a.line}`;
    const timeStr = m === 0
      ? `<span class="crt-now ${timeClass}" style="color:${color}">NOW</span>`
      : `<span class="${timeClass}" style="color:${color}">${m}<span class="crt-unit">m</span></span>`;

    rows += `<a href="/rail-j/train/${esc(a.trainId)}" class="arr-row">
  <div class="arr-line-dot" style="background:${color};color:${color}"></div>
  <div class="arr-info">
    <div class="arr-dest">${esc(dest)}</div>
    <div class="arr-meta"><span class="arr-dir-tag">${esc(directionLabel(a.direction))}</span>${a.isRealtime ? "" : " · sched"}</div>
  </div>
  <div class="arr-time">${timeStr}</div>
</a>\n`;
  }

  const innerContent = `<div class="arr-list">\n${rows || '<div class="no-data">NO ARRIVALS SCHEDULED<span class="cursor"></span></div>'}\n</div>`;
  if (partial) return innerContent;

  const body = `
<div class="detail-hdr">
  <a href="/rail-j" class="back-link">&lt;-</a>
  <h2>${esc(display)}</h2>
  ${lineBadges}
  <span class="hdr-fresh"><span class="pulse-dot"></span> <span id="fresh-age">0s</span></span>
</div>
<hr class="divider">
<div id="rail-body">
${innerContent}
</div>
<div class="ftr">
  MARTA Rail · <a href="/bus">Bus</a> · <a href="https://home.jake.town">home.jake.town</a>
</div>`;

  return shell(`${display} — MARTA Rail`, body, !!partial);
}

// ── TRAIN VIEW ──
export async function trainView(trainId: string, partial?: boolean): Promise<string | null> {
  let arrivals: RailArrival[];
  try {
    arrivals = await fetchArrivals();
  } catch {
    return null;
  }

  const trainArrivals = arrivals.filter(a => a.trainId === trainId);
  if (trainArrivals.length === 0) return null;

  const line = trainArrivals[0].line;
  const direction = trainArrivals[0].direction;
  const destination = stationDisplayName(trainArrivals[0].destination);
  const color = LINE_COLOR[line] || "#888";

  let stationOrder = LINE_STATIONS[line] || [];
  if (direction === "S" || direction === "W") {
    stationOrder = [...stationOrder].reverse();
  }

  function normalize(s: string) { return s.toUpperCase().replace(/ STATION$/i, "").trim(); }

  const soonest = [...trainArrivals].sort(sortByWait)[0];
  const currentNorm = normalize(soonest.station);

  let stops = "";
  let foundCurrent = false;

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
      const timeClass = `tl-time-${line}`;
      timeHtml = m === 0
        ? `<span class="tl-time ${timeClass}" style="color:${color}">NOW</span>`
        : `<span class="tl-time ${timeClass}" style="color:${color}">${m}m</span>`;
    }

    const hereTag = isCurrent
      ? `<span class="tl-here-tag" style="background:${color}">HERE</span>`
      : "";

    stops += `<div class="${cls}" style="--line-color:${color}">
  <div class="tl-left"><span class="tl-name">${esc(stationDisplayName(stn))}</span>${hereTag}</div>
  ${timeHtml}
</div>\n`;
  }

  const timelineCSS = `
    .tl-line { background: ${color}; box-shadow: 0 0 8px ${color}55; }
    .tl-stop::before { border-color: ${color}; }
    .tl-stop.current::before { background: ${color}; border-color: ${color}; box-shadow: 0 0 10px ${color}88; }
    .tl-stop.current .tl-name { color: ${color}; text-shadow: 0 0 8px ${color}44; }
  `;

  const innerContent = `<div class="timeline">\n  <div class="tl-line"></div>\n  ${stops}\n</div>`;
  if (partial) return innerContent;

  const body = `
<style>${timelineCSS}</style>
<div class="train-hdr">
  <a href="/rail-j" class="back-link">&lt;-</a>
  <h2>${esc(trainId)}</h2>
  <span class="train-line-tag" style="background:${color};box-shadow:0 0 8px ${color}55">${esc(line)}</span>
  <span style="color:var(--text-dim);font-size:1.1rem;font-weight:800">→ ${esc(destination)}</span>
  <span class="hdr-fresh"><span class="pulse-dot"></span> <span id="fresh-age">0s</span></span>
</div>
<hr class="divider">
<div id="rail-body">
${innerContent}
</div>
<div class="ftr">
  MARTA Rail · <a href="/bus">Bus</a> · <a href="https://home.jake.town">home.jake.town</a>
</div>`;

  return shell(`Train ${trainId} — MARTA Rail`, body, !!partial);
}
