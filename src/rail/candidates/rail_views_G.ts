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

// ── Helpers ──
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function mins(sec: number): string {
  const m = Math.max(0, Math.floor(sec / 60));
  return m === 0 ? "now" : `${m}`;
}

function minsLabel(sec: number): string {
  const m = Math.max(0, Math.floor(sec / 60));
  if (m === 0) return "now";
  return m === 1 ? "1 min" : `${m} min`;
}

function dirLabel(d: string): string {
  return ({ N: "Northbound", S: "Southbound", E: "Eastbound", W: "Westbound" }[d] ?? d);
}

function dirLetter(d: string): string {
  return d.charAt(0).toUpperCase();
}

// ── CSS ──
const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg-start:#080d24;
  --bg-end:#150a28;
  --glass:rgba(255,255,255,0.06);
  --glass-border:rgba(255,255,255,0.10);
  --glass-hover:rgba(255,255,255,0.10);
  --text-primary:rgba(255,255,255,0.95);
  --text-secondary:rgba(255,255,255,0.60);
  --text-tertiary:rgba(255,255,255,0.40);
  --shadow:0 2px 16px rgba(0,0,0,0.3),0 1px 4px rgba(0,0,0,0.2);
  --shadow-pill:0 1px 8px rgba(0,0,0,0.25);
  --radius:16px;
  --radius-pill:22px;
  --gold:#c9a227;--red:#cc3333;--blue:#0074d9;--green:#2ecc40;
  color-scheme:dark;
}
html{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text",system-ui,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
body{
  background:linear-gradient(160deg,var(--bg-start) 0%,var(--bg-end) 100%);
  background-attachment:fixed;
  color:var(--text-primary);
  min-height:100vh;
  min-height:100dvh;
}
a{color:inherit;text-decoration:none}

.container{max-width:480px;margin:0 auto;padding:16px 12px 32px}

/* ── Header ── */
.header{
  text-align:center;
  padding:24px 0 20px;
}
.header-brand{
  display:inline-flex;align-items:center;gap:8px;
  font-size:1.1rem;font-weight:600;letter-spacing:0.02em;
  color:var(--text-primary);
}
.header-icon{font-size:1.3rem}
.header-sub{
  font-size:0.88rem;color:var(--text-secondary);
  margin-top:4px;letter-spacing:0.01em;
}

/* ── Freshness ── */
.freshness{
  display:flex;align-items:center;justify-content:center;gap:6px;
  font-size:0.88rem;color:var(--text-secondary);
  margin-bottom:16px;
}
.pulse{
  width:7px;height:7px;border-radius:50%;
  background:#2ecc40;
  box-shadow:0 0 6px rgba(46,204,64,0.6);
  animation:pulse-glow 2s ease-in-out infinite;
}
@keyframes pulse-glow{
  0%,100%{opacity:1;transform:scale(1)}
  50%{opacity:0.5;transform:scale(0.85)}
}

/* ── Line filter chips ── */
.line-filters{
  display:flex;gap:6px;justify-content:center;
  margin-bottom:18px;flex-wrap:wrap;
}
.line-chip{
  padding:5px 14px;border-radius:20px;
  font-size:0.88rem;font-weight:600;letter-spacing:0.03em;
  backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
  border:1px solid var(--glass-border);
  cursor:pointer;transition:all 0.2s ease;
  color:var(--text-primary);
}
.line-chip:hover,.line-chip.active{
  border-color:currentColor;
  background:rgba(255,255,255,0.12);
}

/* ── Station card ── */
.station-card{
  background:var(--glass);
  backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
  border:1px solid var(--glass-border);
  border-radius:var(--radius);
  padding:14px 14px;
  margin-bottom:8px;
  transition:background 0.2s ease,transform 0.15s ease,box-shadow 0.2s ease;
  display:block;
}
.station-card:hover{
  background:var(--glass-hover);
  transform:translateY(-1px);
  box-shadow:var(--shadow);
}
.station-card:active{
  transform:scale(0.985);
}
.station-inner{
  display:flex;align-items:center;
  justify-content:space-between;
  gap:10px;flex-wrap:wrap;
}
.station-name{
  font-size:1rem;font-weight:600;
  letter-spacing:0.01em;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  flex-shrink:1;min-width:0;
}
.station-lines{
  display:flex;gap:3px;margin-top:2px;
}
.station-line-dot{
  width:6px;height:6px;border-radius:50%;
  opacity:0.7;
}
.pills-wrap{
  display:flex;gap:5px;flex-wrap:wrap;
  justify-content:flex-end;flex-shrink:0;
}

/* ── Direction pill (hero element) ── */
.pill{
  display:inline-flex;align-items:center;gap:0;
  height:40px;border-radius:var(--radius-pill);
  backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
  border:1px solid rgba(255,255,255,0.12);
  box-shadow:var(--shadow-pill);
  overflow:hidden;
  transition:transform 0.15s ease,box-shadow 0.15s ease;
  text-decoration:none;
}
.pill:hover{
  transform:translateY(-1px);
  box-shadow:0 2px 12px rgba(0,0,0,0.35);
}
.pill-dir{
  width:38px;height:38px;
  display:flex;align-items:center;justify-content:center;
  font-size:0.95rem;font-weight:700;color:#fff;
  border-radius:50%;
  flex-shrink:0;
  text-shadow:0 1px 2px rgba(0,0,0,0.3);
}
.pill-time{
  padding:0 12px 0 8px;
  font-size:0.95rem;font-weight:600;
  color:var(--text-primary);
  white-space:nowrap;
  font-variant-numeric:tabular-nums;
}
.pill-now{
  animation:now-pulse 1.5s ease-in-out infinite;
}
@keyframes now-pulse{
  0%,100%{opacity:1}
  50%{opacity:0.6}
}

/* ── Station Detail ── */
.detail-header{
  padding:20px 0 16px;
}
.detail-station-name{
  font-size:1.35rem;font-weight:700;
  letter-spacing:-0.01em;
}
.detail-lines{
  display:flex;gap:6px;margin-top:6px;
}
.detail-line-badge{
  padding:3px 10px;border-radius:12px;
  font-size:0.88rem;font-weight:600;color:#fff;
  text-shadow:0 1px 2px rgba(0,0,0,0.3);
}
.back-link{
  display:inline-flex;align-items:center;gap:4px;
  font-size:0.95rem;color:var(--text-secondary);
  margin-bottom:4px;transition:color 0.15s;
  padding:4px 0;
}
.back-link:hover{color:var(--text-primary)}
.back-chevron{font-size:1.1rem;margin-top:-1px}

/* ── Arrival row ── */
.arrival-card{
  display:flex;align-items:center;gap:10px;
  background:var(--glass);
  backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
  border:1px solid var(--glass-border);
  border-radius:14px;
  padding:12px 14px;
  margin-bottom:6px;
  transition:background 0.2s ease,transform 0.15s ease;
  text-decoration:none;
}
.arrival-card:hover{
  background:var(--glass-hover);
  transform:translateY(-1px);
}
.arrival-dir-badge{
  width:34px;height:34px;
  display:flex;align-items:center;justify-content:center;
  border-radius:50%;
  font-size:0.88rem;font-weight:700;color:#fff;
  flex-shrink:0;
  text-shadow:0 1px 2px rgba(0,0,0,0.3);
}
.arrival-info{
  flex:1;min-width:0;
}
.arrival-dest{
  font-size:1rem;font-weight:600;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
.arrival-line-label{
  font-size:0.88rem;font-weight:500;
  margin-top:1px;
}
.arrival-time{
  font-size:1.15rem;font-weight:700;
  font-variant-numeric:tabular-nums;
  text-align:right;flex-shrink:0;
  min-width:44px;
}
.arrival-time-unit{
  font-size:0.88rem;font-weight:500;color:var(--text-secondary);
  display:block;text-align:right;
}
.arrival-now{
  color:#2ecc40;
  animation:now-pulse 1.5s ease-in-out infinite;
}
.arrival-scheduled{
  opacity:0.65;
  font-style:italic;
}

/* ── Train timeline ── */
.train-header{
  padding:20px 0 12px;
}
.train-id-label{
  font-size:0.88rem;color:var(--text-secondary);
  text-transform:uppercase;letter-spacing:0.06em;font-weight:600;
}
.train-dest{
  font-size:1.25rem;font-weight:700;margin-top:2px;
}
.train-line-badge{
  display:inline-block;
  padding:4px 12px;border-radius:12px;
  font-size:0.88rem;font-weight:600;color:#fff;
  margin-top:6px;
  text-shadow:0 1px 2px rgba(0,0,0,0.3);
}

.timeline{
  position:relative;
  padding:8px 0 8px 42px;
  margin-top:8px;
}
.timeline::before{
  content:"";
  position:absolute;
  left:17px;top:0;bottom:0;
  width:3px;
  border-radius:2px;
  opacity:0.3;
}
.tl-stop{
  position:relative;
  padding:10px 0 10px 20px;
  display:flex;align-items:center;gap:12px;
}
.tl-node{
  position:absolute;
  left:-30px;top:50%;transform:translateY(-50%);
  width:13px;height:13px;
  border-radius:50%;
  border:2.5px solid;
  background:var(--bg-start);
  z-index:1;
}
.tl-node-active{
  width:17px;height:17px;
  left:-32px;
  box-shadow:0 0 12px rgba(255,255,255,0.3);
  background:currentColor !important;
}
.tl-node-active::after{
  content:"";
  position:absolute;
  inset:-5px;
  border-radius:50%;
  border:2px solid currentColor;
  opacity:0.3;
  animation:ring-pulse 2s ease-in-out infinite;
}
@keyframes ring-pulse{
  0%,100%{transform:scale(1);opacity:0.3}
  50%{transform:scale(1.3);opacity:0}
}
.tl-station-name{
  font-size:1rem;font-weight:600;
  flex:1;
}
.tl-station-name.tl-past{
  color:var(--text-tertiary);
}
.tl-station-name.tl-current{
  font-weight:700;
}
.tl-time{
  font-size:0.95rem;font-weight:500;
  color:var(--text-secondary);
  font-variant-numeric:tabular-nums;
  flex-shrink:0;
}
.tl-arrived-tag{
  font-size:0.88rem;font-weight:600;
  padding:2px 8px;border-radius:8px;
  background:rgba(46,204,64,0.15);
  color:#2ecc40;
  flex-shrink:0;
}
.tl-card{
  background:var(--glass);
  backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
  border:1px solid var(--glass-border);
  border-radius:var(--radius);
  padding:6px 0;
  margin-top:4px;
}

/* ── Footer ── */
.footer{
  text-align:center;
  padding:28px 0 8px;
  font-size:0.88rem;
  color:var(--text-tertiary);
}
.footer a{
  color:var(--text-secondary);
  transition:color 0.15s;
}
.footer a:hover{color:var(--text-primary)}
.footer-dot{margin:0 6px;opacity:0.4}

/* ── Empty state ── */
.empty-state{
  text-align:center;
  padding:48px 16px;
  color:var(--text-secondary);
}
.empty-icon{font-size:2.5rem;margin-bottom:12px;opacity:0.5}
.empty-text{font-size:1rem}

/* ── Light mode ── */
@media(prefers-color-scheme:light){
  :root{
    --bg-start:#eef1f7;
    --bg-end:#e4e0f0;
    --glass:rgba(255,255,255,0.65);
    --glass-border:rgba(0,0,0,0.08);
    --glass-hover:rgba(255,255,255,0.80);
    --text-primary:rgba(0,0,0,0.88);
    --text-secondary:rgba(0,0,0,0.50);
    --text-tertiary:rgba(0,0,0,0.30);
    --shadow:0 2px 16px rgba(0,0,0,0.08),0 1px 4px rgba(0,0,0,0.05);
    --shadow-pill:0 1px 8px rgba(0,0,0,0.10);
    color-scheme:light;
  }
  body{background:linear-gradient(160deg,var(--bg-start) 0%,var(--bg-end) 100%)}
  .pill-dir{color:#fff}
  .tl-node{background:var(--bg-start)}
}

/* ── Transitions for partial reload ── */
#rail-body{animation:fadeIn 0.2s ease}
@keyframes fadeIn{from{opacity:0.6}to{opacity:1}}
`;

// ── JS for polling + freshness ──
const POLL_JS = `
<script>
(function(){
  var ts=Date.now();
  var el=document.getElementById('rail-freshness');
  function upd(){
    if(!el)return;
    var s=Math.floor((Date.now()-ts)/1000);
    el.textContent=s<5?'just now':s+'s ago';
  }
  setInterval(upd,1000);
  setInterval(function(){
    fetch(location.pathname+'?partial=1').then(function(r){return r.text()}).then(function(h){
      var b=document.getElementById('rail-body');
      if(b){b.innerHTML=h;ts=Date.now()}
    }).catch(function(){});
  },10000);
})();
</script>`;

// ── Shell ──
function shell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#080d24">
<title>${esc(title)} — MARTA Rail</title>
<style>${CSS}</style>
</head>
<body>
<div class="container">
${body}
</div>
${POLL_JS}
</body>
</html>`;
}

// ── Pill builder ──
function buildPill(dir: string, sec: number, line: string): string {
  const color = LINE_COLOR[line] || "#888";
  const m = Math.max(0, Math.floor(sec / 60));
  const timeStr = m === 0 ? "now" : `:${String(m).padStart(2, "0")}`;
  const nowClass = m === 0 ? " pill-now" : "";
  // Glass background tinted with line color
  const glassBase = `rgba(${hexToRgb(color)},0.12)`;
  return `<span class="pill${nowClass}" style="background:${glassBase}">` +
    `<span class="pill-dir" style="background:${color}">${esc(dirLetter(dir))}</span>` +
    `<span class="pill-time">${timeStr}</span>` +
    `</span>`;
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

// ══════════════════════════════════════════════
//  LANDING VIEW
// ══════════════════════════════════════════════
export async function landingView(partial?: boolean): Promise<string> {
  const arrivals = await fetchArrivals();
  const stations = byStation(arrivals);

  // Sort stations alphabetically
  const slugs = Object.keys(stations).sort((a, b) => {
    const na = stationDisplayName(stations[a][0].station);
    const nb = stationDisplayName(stations[b][0].station);
    return na.localeCompare(nb);
  });

  let rows = "";
  for (const slug of slugs) {
    const arr = stations[slug];
    const name = stationDisplayName(arr[0].station);
    const lines = stationLines(arr);
    const s = stationSlug(arr[0].station);

    // Get soonest per direction
    const dirMap = new Map<string, RailArrival>();
    for (const a of arr) {
      const d = a.direction;
      if (!dirMap.has(d) || a.waitSeconds < dirMap.get(d)!.waitSeconds) {
        dirMap.set(d, a);
      }
    }

    // Direction order: N, S, E, W
    const dirOrder = ["N", "S", "E", "W"];
    const sortedDirs = [...dirMap.entries()]
      .sort(([a], [b]) => dirOrder.indexOf(a) - dirOrder.indexOf(b));

    let pills = "";
    for (const [dir, a] of sortedDirs) {
      pills += buildPill(dir, a.waitSeconds, a.line);
    }

    // Line dots
    let dots = "";
    for (const l of lines) {
      dots += `<span class="station-line-dot" style="background:${LINE_COLOR[l] || "#888"}"></span>`;
    }

    rows += `<a class="station-card" href="/rail-g/${esc(s)}">
  <div class="station-inner">
    <div>
      <div class="station-name">${esc(name)}</div>
      <div class="station-lines">${dots}</div>
    </div>
    <div class="pills-wrap">${pills}</div>
  </div>
</a>`;
  }

  if (!rows) {
    rows = `<div class="empty-state">
  <div class="empty-icon">🚇</div>
  <div class="empty-text">No trains currently reporting</div>
</div>`;
  }

  const body = `
<div class="header">
  <div class="header-brand"><span class="header-icon">🚇</span> MARTA Rail</div>
  <div class="header-sub">Atlanta Rapid Transit</div>
</div>
<div class="freshness">
  <span class="pulse"></span>
  <span>Live · <span id="rail-freshness">just now</span></span>
</div>
<div id="rail-body">
${rows}
</div>
<div class="footer">
  MARTA Rail<span class="footer-dot">·</span><a href="/bus">Bus</a><span class="footer-dot">·</span><a href="https://home.jake.town">home.jake.town</a>
</div>`;

  return partial ? rows : shell("Stations", body);
}

// ══════════════════════════════════════════════
//  STATION DETAIL VIEW
// ══════════════════════════════════════════════
export async function stationView(slug: string, partial?: boolean): Promise<string | null> {
  const arrivals = await fetchArrivals();
  const stations = byStation(arrivals);

  if (!stations[slug]) return null;

  const arr = stations[slug];
  const name = stationDisplayName(arr[0].station);
  const lines = stationLines(arr);

  // Sort soonest-first
  const sorted = [...arr].sort((a, b) => a.waitSeconds - b.waitSeconds);

  let lineBadges = "";
  for (const l of lines) {
    lineBadges += `<span class="detail-line-badge" style="background:${LINE_COLOR[l] || "#888"}">${esc(l)}</span>`;
  }

  let rows = "";
  for (const a of sorted) {
    const color = LINE_COLOR[a.line] || "#888";
    const m = Math.max(0, Math.floor(a.waitSeconds / 60));
    const isNow = m === 0;
    const rtClass = a.isRealtime ? "" : " arrival-scheduled";

    const timeHtml = isNow
      ? `<span class="arrival-time arrival-now">now</span>`
      : `<span class="arrival-time${rtClass}">${m}<span class="arrival-time-unit">min</span></span>`;

    const dirBg = `background:${color}`;
    const glassRow = `background:rgba(${hexToRgb(color)},0.05)`;

    rows += `<a class="arrival-card${rtClass}" href="/rail-g/train/${esc(a.trainId)}" style="${glassRow}">
  <span class="arrival-dir-badge" style="${dirBg}">${esc(dirLetter(a.direction))}</span>
  <div class="arrival-info">
    <div class="arrival-dest">${esc(a.destination)}</div>
    <div class="arrival-line-label" style="color:${color}">${esc(a.line)} · ${dirLabel(a.direction)}${a.isRealtime ? "" : " · Sched"}</div>
  </div>
  ${timeHtml}
</a>`;
  }

  if (!rows) {
    rows = `<div class="empty-state">
  <div class="empty-icon">🕐</div>
  <div class="empty-text">No arrivals at this station</div>
</div>`;
  }

  const body = `
<a class="back-link" href="/rail-g/"><span class="back-chevron">‹</span> All Stations</a>
<div class="detail-header">
  <div class="detail-station-name">${esc(name)}</div>
  <div class="detail-lines">${lineBadges}</div>
</div>
<div class="freshness">
  <span class="pulse"></span>
  <span>Live · <span id="rail-freshness">just now</span></span>
</div>
<div id="rail-body">
${rows}
</div>
<div class="footer">
  MARTA Rail<span class="footer-dot">·</span><a href="/bus">Bus</a><span class="footer-dot">·</span><a href="https://home.jake.town">home.jake.town</a>
</div>`;

  return partial ? rows : shell(name, body);
}

// ══════════════════════════════════════════════
//  TRAIN DETAIL VIEW
// ══════════════════════════════════════════════
export async function trainView(trainId: string, partial?: boolean): Promise<string | null> {
  const arrivals = await fetchArrivals();
  const train = arrivals.filter((a) => a.trainId === trainId);
  if (!train.length) return null;

  const sample = train[0];
  const line = sample.line;
  const color = LINE_COLOR[line] || "#888";
  const dest = sample.destination;
  const dir = sample.direction;

  // Get station order for this line
  const lineStations = LINE_STATIONS[line];
  if (!lineStations) return null;

  // Build lookup of train arrivals by station
  const arrByStation = new Map<string, RailArrival>();
  for (const a of train) {
    arrByStation.set(a.station, a);
  }

  // Find the train's position among the ordered stations
  // Determine direction: if heading N/E, stations go in order; S/W, reverse
  const isForward = dir === "N" || dir === "E";
  const orderedStations = isForward ? [...lineStations] : [...lineStations].reverse();

  // Find first station with arrival data to determine range
  let firstIdx = -1;
  let lastIdx = -1;
  for (let i = 0; i < orderedStations.length; i++) {
    if (arrByStation.has(orderedStations[i])) {
      if (firstIdx === -1) firstIdx = i;
      lastIdx = i;
    }
  }

  // Find "current" station — the one arriving/boarding or first with waitSeconds ~0
  let currentStation = "";
  let minWait = Infinity;
  for (const a of train) {
    if (a.waitSeconds < minWait) {
      minWait = a.waitSeconds;
      currentStation = a.station;
    }
  }

  // Determine the current station's index in our ordered list
  const currentIdx = orderedStations.indexOf(currentStation);

  // Build timeline stops — show all line stations for context
  // but highlight the ones we have data for
  let stops = "";
  for (let i = 0; i < orderedStations.length; i++) {
    const st = orderedStations[i];
    const arrival = arrByStation.get(st);
    const isCurrent = st === currentStation;
    const isPast = i < currentIdx;

    // Node styling
    let nodeClass = "tl-node";
    if (isCurrent) nodeClass += " tl-node-active";

    // Station name styling
    let nameClass = "tl-station-name";
    if (isPast) nameClass += " tl-past";
    if (isCurrent) nameClass += " tl-current";

    // Time display
    let timeHtml = "";
    if (arrival) {
      const m = Math.max(0, Math.floor(arrival.waitSeconds / 60));
      if (isCurrent && m === 0) {
        timeHtml = `<span class="tl-arrived-tag">● Arrived</span>`;
      } else if (m === 0) {
        timeHtml = `<span class="tl-time" style="color:${color}">now</span>`;
      } else {
        timeHtml = `<span class="tl-time">${m} min</span>`;
      }
    } else if (isPast) {
      timeHtml = `<span class="tl-time" style="color:var(--text-tertiary)">—</span>`;
    }

    stops += `<div class="tl-stop">
  <span class="${nodeClass}" style="border-color:${color};color:${color}"></span>
  <span class="${nameClass}">${esc(st)}</span>
  ${timeHtml}
</div>`;
  }

  const body = `
<a class="back-link" href="/rail-g/"><span class="back-chevron">‹</span> All Stations</a>
<div class="train-header">
  <div class="train-id-label">Train ${esc(trainId)}</div>
  <div class="train-dest">${esc(dest)}</div>
  <span class="train-line-badge" style="background:${color}">${esc(line)} · ${dirLabel(dir)}</span>
</div>
<div class="freshness">
  <span class="pulse"></span>
  <span>Live · <span id="rail-freshness">just now</span></span>
</div>
<div id="rail-body">
<div class="tl-card">
  <div class="timeline" style="--line-color:${color}">
    <style>.timeline::before{background:${color}}</style>
    ${stops}
  </div>
</div>
</div>
<div class="footer">
  MARTA Rail<span class="footer-dot">·</span><a href="/bus">Bus</a><span class="footer-dot">·</span><a href="https://home.jake.town">home.jake.town</a>
</div>`;

  return partial ? `<div class="tl-card"><div class="timeline" style="--line-color:${color}"><style>.timeline::before{background:${color}}</style>${stops}</div></div>` : shell(`Train ${trainId}`, body);
}
