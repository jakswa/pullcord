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

// ── Direction arrows ──
const DIR_ARROW: Record<string, string> = {
  N: "↑", S: "↓", E: "→", W: "←",
};

// ── Helpers ──
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function mins(sec: number): string {
  const m = Math.max(0, Math.floor(sec / 60));
  return m === 0 ? "now" : String(m);
}

function minsDisplay(sec: number): string {
  const m = Math.max(0, Math.floor(sec / 60));
  if (m === 0) return '<span class="blink">now</span>';
  return `<span class="t-min">${m}</span><span class="t-unit">m</span>`;
}

function sortByWait(a: RailArrival, b: RailArrival): number {
  return a.waitSeconds - b.waitSeconds;
}

/** Get soonest arrival per direction at a station */
function directionSummary(arrivals: RailArrival[]): { dir: string; mins: number; line: string; secs: number }[] {
  const byDir = new Map<string, RailArrival>();
  for (const a of arrivals) {
    const d = a.direction;
    const existing = byDir.get(d);
    if (!existing || a.waitSeconds < existing.waitSeconds) {
      byDir.set(d, a);
    }
  }
  const order = ["N", "S", "E", "W"];
  return order
    .filter((d) => byDir.has(d))
    .map((d) => {
      const a = byDir.get(d)!;
      return { dir: d, mins: Math.max(0, Math.floor(a.waitSeconds / 60)), line: a.line, secs: a.waitSeconds };
    });
}

// ── Shell (dark transit display aesthetic) ──
function shell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en" data-ts="${Date.now()}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Inter:wght@400;500;600&display=swap');

:root {
  --bg: #0a0a0a;
  --surface: #111111;
  --border: #1a1a1a;
  --text: #e8e0d0;
  --text-dim: #786e5e;
  --text-muted: #4a4438;
  --amber: #e8a820;
  --amber-dim: #a07818;
  --red: #cc3333;
  --blue: #0074d9;
  --green: #2ecc40;
  --gold: #c9a227;
  --mono: 'JetBrains Mono', 'SF Mono', 'Consolas', monospace;
  --sans: 'Inter', -apple-system, system-ui, sans-serif;
  --radius: 2px;
}

@media (prefers-color-scheme: light) {
  :root {
    --bg: #e8e0d0;
    --surface: #f0ebe0;
    --border: #d0c8b8;
    --text: #1a1408;
    --text-dim: #5a5040;
    --text-muted: #8a8070;
    --amber: #b07800;
    --amber-dim: #806020;
  }
}

* { margin: 0; padding: 0; box-sizing: border-box; }

html { background: var(--bg); }

body {
  font-family: var(--sans);
  background: var(--bg);
  color: var(--text);
  min-height: 100dvh;
  -webkit-font-smoothing: antialiased;
}

.wrap {
  max-width: 480px;
  margin: 0 auto;
  padding: 0;
}

/* ── Header bar ── */
.hdr {
  background: var(--surface);
  border-bottom: 2px solid var(--amber);
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.hdr-title {
  font-family: var(--mono);
  font-size: 1rem;
  font-weight: 700;
  color: var(--amber);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.hdr a {
  color: var(--amber);
  text-decoration: none;
}

.pulse-box {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--mono);
  font-size: 0.88rem;
  color: var(--text-dim);
}

.pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--green);
  animation: pulse-anim 2s ease-in-out infinite;
}

@keyframes pulse-anim {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.2; }
}

.blink { animation: blink 1.2s step-end infinite; }

/* ── Station rows (landing) ── */
.board {
  padding: 0;
}

.st-row {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
  text-decoration: none;
  color: var(--text);
  transition: background 0.15s;
  gap: 10px;
}

.st-row:active, .st-row:hover {
  background: var(--surface);
}

.st-lines {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex-shrink: 0;
  width: 6px;
}

.st-dot {
  width: 6px;
  height: 6px;
  border-radius: 1px;
}

.st-name {
  font-family: var(--sans);
  font-size: 0.92rem;
  font-weight: 500;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text);
}

.st-dirs {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
  align-items: center;
}

.dir-pill {
  font-family: var(--mono);
  font-size: 0.92rem;
  font-weight: 600;
  display: flex;
  align-items: baseline;
  gap: 1px;
  white-space: nowrap;
}

.dir-letter {
  color: var(--text-dim);
  font-size: 0.88rem;
  font-weight: 400;
}

.dir-colon {
  color: var(--text-muted);
}

.dir-time {
  color: var(--amber);
  min-width: 2ch;
  text-align: right;
}

.dir-time-now {
  color: var(--green);
}

/* ── Station detail ── */
.stn-hdr {
  padding: 14px 16px;
  background: var(--surface);
  border-bottom: 2px solid var(--amber);
}

.stn-name {
  font-family: var(--mono);
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--amber);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.stn-lines {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}

.stn-line-badge {
  font-family: var(--mono);
  font-size: 0.88rem;
  font-weight: 600;
  padding: 1px 8px;
  border-radius: var(--radius);
  color: #000;
  letter-spacing: 0.04em;
}

.back-link {
  font-family: var(--mono);
  font-size: 0.88rem;
  color: var(--text-dim);
  text-decoration: none;
  padding: 10px 16px;
  display: block;
  border-bottom: 1px solid var(--border);
}

.back-link:hover { color: var(--amber); }

.arr-row {
  display: grid;
  grid-template-columns: 6px 28px 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
  text-decoration: none;
  color: var(--text);
  transition: background 0.15s;
}

.arr-row:active, .arr-row:hover {
  background: var(--surface);
}

.arr-line-pip {
  width: 6px;
  height: 24px;
  border-radius: 1px;
}

.arr-dir {
  font-family: var(--mono);
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-dim);
  text-align: center;
  background: var(--border);
  border-radius: var(--radius);
  padding: 2px 0;
  line-height: 1;
}

.arr-dest {
  font-family: var(--sans);
  font-size: 0.92rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.arr-time {
  font-family: var(--mono);
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--amber);
  white-space: nowrap;
  text-align: right;
}

.arr-time-now {
  color: var(--green);
}

.t-min {
  font-variant-numeric: tabular-nums;
}

.t-unit {
  font-size: 0.82rem;
  font-weight: 400;
  color: var(--text-dim);
  margin-left: 1px;
}

.rt-badge {
  display: inline-block;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--green);
  margin-left: 4px;
  vertical-align: middle;
}

.sched-badge {
  display: inline-block;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--text-muted);
  margin-left: 4px;
  vertical-align: middle;
}

/* ── Train timeline ── */
.train-hdr {
  padding: 14px 16px;
  background: var(--surface);
  border-bottom: 2px solid var(--amber);
}

.train-id {
  font-family: var(--mono);
  font-size: 0.92rem;
  color: var(--text-dim);
  margin-bottom: 4px;
}

.train-dest {
  font-family: var(--mono);
  font-size: 1.1rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.train-line-label {
  font-family: var(--mono);
  font-size: 0.88rem;
  font-weight: 600;
  display: inline-block;
  padding: 1px 8px;
  border-radius: var(--radius);
  color: #000;
  margin-top: 6px;
}

.timeline {
  padding: 8px 16px 16px;
  position: relative;
}

.tl-stop {
  display: grid;
  grid-template-columns: 1fr 20px 1fr;
  align-items: center;
  min-height: 38px;
  position: relative;
}

.tl-name {
  font-family: var(--sans);
  font-size: 0.92rem;
  font-weight: 500;
  text-align: right;
  padding-right: 12px;
  color: var(--text);
}

.tl-name-dim {
  color: var(--text-dim);
}

.tl-name-current {
  color: var(--amber);
  font-weight: 700;
}

.tl-track {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  height: 100%;
  justify-content: center;
}

.tl-line-seg {
  position: absolute;
  width: 2px;
  top: 0;
  bottom: 0;
}

.tl-line-seg-past {
  opacity: 0.3;
}

.tl-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  z-index: 1;
  border: 2px solid;
  background: var(--bg);
}

.tl-dot-past {
  opacity: 0.4;
}

.tl-dot-current {
  width: 14px;
  height: 14px;
  animation: pulse-anim 1.5s ease-in-out infinite;
}

.tl-dot-filled {
  /* background filled with line color via inline style */
}

.tl-time {
  font-family: var(--mono);
  font-size: 0.88rem;
  padding-left: 12px;
  color: var(--text-dim);
}

.tl-time-active {
  color: var(--amber);
  font-weight: 600;
}

/* ── Empty state ── */
.empty {
  padding: 40px 16px;
  text-align: center;
  font-family: var(--mono);
  color: var(--text-dim);
  font-size: 0.92rem;
}

.empty-icon {
  font-size: 1.8rem;
  margin-bottom: 8px;
  opacity: 0.4;
}

/* ── Footer ── */
.ftr {
  padding: 20px 16px;
  text-align: center;
  font-family: var(--mono);
  font-size: 0.88rem;
  color: var(--text-muted);
  border-top: 1px solid var(--border);
  margin-top: 16px;
}

.ftr a {
  color: var(--text-dim);
  text-decoration: none;
}

.ftr a:hover { color: var(--amber); }

/* ── Scanline overlay (subtle CRT feel) ── */
.board::after {
  content: '';
  pointer-events: none;
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0,0,0,0.03) 2px,
    rgba(0,0,0,0.03) 4px
  );
  z-index: 999;
}

/* ── No arrivals for direction ── */
.no-svc {
  font-family: var(--mono);
  font-size: 0.88rem;
  color: var(--text-muted);
  padding: 20px 16px;
  text-align: center;
}

</style>
</head>
<body>
<div class="wrap">
${body}
</div>
<script>
(function(){
  var iv=10000,el=document.getElementById('rail-body'),
      ts=document.querySelector('[data-ts]'),
      age=document.getElementById('age');
  if(!el) return;
  var last=Date.now();
  function poll(){
    fetch(location.pathname+'?partial=1',{headers:{'Accept':'text/html'}})
      .then(function(r){return r.ok?r.text():null})
      .then(function(h){if(h){el.innerHTML=h;last=Date.now();}})
      .catch(function(){});
  }
  setInterval(poll,iv);
  setInterval(function(){
    if(age){
      var s=Math.floor((Date.now()-last)/1000);
      age.textContent=s+'s ago';
    }
  },1000);
})();
</script>
</body>
</html>`;
}

function header(title: string, backHref?: string): string {
  let left = `<span class="hdr-title">${esc(title)}</span>`;
  if (backHref) {
    left = `<a href="${backHref}" class="hdr-title">◂ ${esc(title)}</a>`;
  }
  return `<div class="hdr">
  ${left}
  <div class="pulse-box"><div class="pulse"></div><span id="age">0s ago</span></div>
</div>`;
}

function footer(): string {
  return `<div class="ftr">MARTA Rail · <a href="https://bus.marta.io">Bus</a> · <a href="https://home.jake.town">home.jake.town</a></div>`;
}

// ════════════════════════════════════════
// 1. LANDING VIEW
// ════════════════════════════════════════
export async function landingView(partial?: boolean): Promise<string> {
  const arrivals = await fetchArrivals();
  const stations = byStation(arrivals);

  // Sort stations alphabetically
  const sortedStations = [...stations.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  let rows = "";

  if (sortedStations.length === 0) {
    rows = `<div class="empty"><div class="empty-icon">▦</div>NO SERVICE DATA</div>`;
  }

  for (const [name, arrs] of sortedStations) {
    const slug = stationSlug(name);
    const display = stationDisplayName(name);
    const lines = stationLines(arrs);
    const dirs = directionSummary(arrs);

    // Line dots
    const dots = [...lines]
      .map((l) => `<div class="st-dot" style="background:${LINE_COLOR[l] || "#666"}"></div>`)
      .join("");

    // Direction pills: N:03  S:16 style — like departure boards
    const dirPills = dirs
      .map((d) => {
        const isNow = d.mins === 0;
        const timeVal = isNow ? "now" : String(d.mins).padStart(2, "\u2007");
        const timeCls = isNow ? "dir-time dir-time-now blink" : "dir-time";
        return `<span class="dir-pill"><span class="dir-letter">${d.dir}</span><span class="dir-colon">:</span><span class="${timeCls}">${timeVal}</span></span>`;
      })
      .join("");

    rows += `<a class="st-row" href="/rail-a/${esc(slug)}">
  <div class="st-lines">${dots}</div>
  <span class="st-name">${esc(display)}</span>
  <div class="st-dirs">${dirPills}</div>
</a>\n`;
  }

  const body = `${header("DEPARTURES")}
<div id="rail-body">
<div class="board">${rows}</div>
${footer()}
</div>`;

  return partial ? `<div class="board">${rows}</div>\n${footer()}` : shell("MARTA Rail", body);
}

// ════════════════════════════════════════
// 2. STATION VIEW
// ════════════════════════════════════════
export async function stationView(slug: string, partial?: boolean): Promise<string | null> {
  const arrivals = await fetchArrivals();
  const stations = byStation(arrivals);

  // Find matching station
  let stationName: string | null = null;
  let stationArrivals: RailArrival[] = [];
  for (const [name, arrs] of stations) {
    if (stationSlug(name) === slug) {
      stationName = name;
      stationArrivals = arrs;
      break;
    }
  }

  if (!stationName) return null;

  const display = stationDisplayName(stationName);
  const lines = stationLines(stationArrivals);
  const sorted = [...stationArrivals].sort(sortByWait);

  // Line badges
  const lineBadges = [...lines]
    .map(
      (l) =>
        `<span class="stn-line-badge" style="background:${LINE_COLOR[l] || "#666"}">${esc(l)}</span>`
    )
    .join("");

  let rows = "";

  if (sorted.length === 0) {
    rows = `<div class="empty"><div class="empty-icon">▦</div>NO ARRIVALS</div>`;
  }

  for (const a of sorted) {
    const color = LINE_COLOR[a.line] || "#666";
    const arrow = DIR_ARROW[a.direction] || a.direction;
    const m = Math.max(0, Math.floor(a.waitSeconds / 60));
    const isNow = m === 0;
    const timeCls = isNow ? "arr-time arr-time-now" : "arr-time";
    const timeStr = isNow
      ? '<span class="blink">now</span>'
      : `<span class="t-min">${m}</span><span class="t-unit">m</span>`;
    const rtDot = a.isRealtime
      ? '<span class="rt-badge"></span>'
      : '<span class="sched-badge"></span>';

    rows += `<a class="arr-row" href="/rail-a/train/${esc(a.trainId)}">
  <div class="arr-line-pip" style="background:${color}"></div>
  <div class="arr-dir">${arrow}${a.direction}</div>
  <span class="arr-dest">${esc(a.destination)}${rtDot}</span>
  <span class="${timeCls}">${timeStr}</span>
</a>\n`;
  }

  const inner = `<div class="stn-hdr">
  <div class="stn-name">${esc(display)}</div>
  <div class="stn-lines">${lineBadges}</div>
</div>
<a class="back-link" href="/rail-a">◂ ALL STATIONS</a>
${rows}
${footer()}`;

  const bodyContent = `${header(display, "/rail")}
<div id="rail-body">
${inner}
</div>`;

  return partial ? inner : shell(`${display} — MARTA Rail`, bodyContent);
}

// ════════════════════════════════════════
// 3. TRAIN VIEW
// ════════════════════════════════════════
export async function trainView(trainId: string, partial?: boolean): Promise<string | null> {
  const arrivals = await fetchArrivals();

  // Find all arrivals for this train
  const trainArrivals = arrivals.filter((a) => a.trainId === trainId);
  if (trainArrivals.length === 0) return null;

  const sample = trainArrivals[0];
  const line = sample.line;
  const color = LINE_COLOR[line] || "#666";
  const dest = sample.destination;

  // Get the full station list for this line
  const lineStations = LINE_STATIONS[line] || [];

  // Build a map of station → arrival for this train
  const arrivalMap = new Map<string, RailArrival>();
  for (const a of trainArrivals) {
    arrivalMap.set(a.station, a);
  }

  // Find the current station (lowest wait time)
  let currentStation = "";
  let minWait = Infinity;
  for (const a of trainArrivals) {
    if (a.waitSeconds < minWait) {
      minWait = a.waitSeconds;
      currentStation = a.station;
    }
  }

  // Determine which stations to show — find the range of stations this train covers
  // The train is heading toward `dest`. We show all line stations and mark past/current/future.
  const currentIdx = lineStations.findIndex(
    (s) => s.toUpperCase() === currentStation.toUpperCase()
  );

  // Build timeline stops
  let timelineHtml = "";

  for (let i = 0; i < lineStations.length; i++) {
    const sName = lineStations[i];
    const arrival = arrivalMap.get(sName.toUpperCase()) || arrivalMap.get(sName);
    
    // Try case-insensitive match
    let matchedArrival: RailArrival | undefined;
    for (const [key, val] of arrivalMap) {
      if (key.toUpperCase() === sName.toUpperCase()) {
        matchedArrival = val;
        break;
      }
    }

    const isPast = currentIdx >= 0 && i < currentIdx;
    const isCurrent = currentIdx >= 0 && i === currentIdx;
    const isFuture = currentIdx >= 0 && i > currentIdx;

    // Dot styling
    let dotClass = "tl-dot";
    let dotStyle = `border-color:${color};`;
    if (isPast) {
      dotClass += " tl-dot-past tl-dot-filled";
      dotStyle += `background:${color};`;
    } else if (isCurrent) {
      dotClass += " tl-dot-current tl-dot-filled";
      dotStyle += `background:${color};`;
    }

    // Line segment
    const segClass = isPast ? "tl-line-seg tl-line-seg-past" : "tl-line-seg";

    // Name styling
    let nameClass = "tl-name";
    if (isPast) nameClass += " tl-name-dim";
    if (isCurrent) nameClass += " tl-name-current";

    // Time display
    let timeHtml = "";
    if (matchedArrival) {
      const m = Math.max(0, Math.floor(matchedArrival.waitSeconds / 60));
      const timeCls = isCurrent ? "tl-time tl-time-active" : "tl-time";
      if (m === 0) {
        timeHtml = `<span class="${timeCls}"><span class="blink">now</span></span>`;
      } else {
        timeHtml = `<span class="${timeCls}">${m}m</span>`;
      }
    } else if (isPast) {
      timeHtml = `<span class="tl-time">──</span>`;
    } else {
      timeHtml = `<span class="tl-time"></span>`;
    }

    const displayName = stationDisplayName(sName);
    const sSlug = stationSlug(sName);

    timelineHtml += `<div class="tl-stop">
  <a href="/rail-a/${esc(sSlug)}" class="${nameClass}" style="text-decoration:none;color:inherit">${esc(displayName)}</a>
  <div class="tl-track">
    <div class="${segClass}" style="background:${color}"></div>
    <div class="${dotClass}" style="${dotStyle}"></div>
  </div>
  ${timeHtml}
</div>\n`;
  }

  const inner = `<div class="train-hdr">
  <div class="train-id">TRAIN ${esc(trainId)}</div>
  <div class="train-dest" style="color:${color}">→ ${esc(dest)}</div>
  <span class="train-line-label" style="background:${color}">${esc(line)} LINE</span>
</div>
<a class="back-link" href="/rail-a">◂ ALL STATIONS</a>
<div class="timeline">
${timelineHtml}
</div>
${footer()}`;

  const bodyContent = `${header(`TRAIN ${trainId}`, "/rail")}
<div id="rail-body">
${inner}
</div>`;

  return partial ? inner : shell(`Train ${trainId} — MARTA Rail`, bodyContent);
}
