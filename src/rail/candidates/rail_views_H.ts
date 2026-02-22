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

// ── Line order for display ──
const LINE_ORDER: Array<"GOLD" | "RED" | "BLUE" | "GREEN"> = ["GOLD", "RED", "BLUE", "GREEN"];

// ── Helpers ──
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function dirLabel(d: string): string {
  return ({ N: "North", S: "South", E: "East", W: "West" }[d] ?? d);
}

function dirFull(d: string): string {
  return ({ N: "Northbound", S: "Southbound", E: "Eastbound", W: "Westbound" }[d] ?? d);
}

function dirLetter(d: string): string {
  return d.charAt(0).toUpperCase();
}

function fmtTime(sec: number): string {
  const m = Math.max(0, Math.floor(sec / 60));
  if (m === 0) return "NOW";
  return `${m}`;
}

// ── CSS ──
const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0c0c14;
  --surface:#161621;
  --surface-hover:#1c1c2a;
  --border:#26263a;
  --border-light:#1e1e30;
  --text:#e0e0e8;
  --text-secondary:#8888a0;
  --text-muted:#55556a;
  --gold:#c9a227;
  --red:#cc3333;
  --blue:#0074d9;
  --green:#2ecc40;
  color-scheme:dark;
}

html{
  font-family:"Helvetica Neue",Arial,"Hiragino Sans","Hiragino Kaku Gothic ProN",Meiryo,sans-serif;
  -webkit-font-smoothing:antialiased;
  -moz-osx-font-smoothing:grayscale;
}
body{
  background:var(--bg);
  color:var(--text);
  min-height:100vh;
  min-height:100dvh;
}
a{color:inherit;text-decoration:none}

.container{max-width:480px;margin:0 auto;padding:0 0 24px}

/* ── Color stripe ── */
.color-stripe{
  display:flex;height:6px;
}
.color-stripe span{flex:1}

/* ── Header ── */
.header{
  padding:16px 16px 0;
  display:flex;align-items:baseline;justify-content:space-between;
}
.header-title{
  font-size:1.1rem;
  font-weight:700;
  letter-spacing:0.14em;
  text-transform:uppercase;
  color:var(--text);
}
.header-sub{
  font-size:0.88rem;
  color:var(--text-muted);
  letter-spacing:0.06em;
  text-transform:uppercase;
}

/* ── Freshness ── */
.freshness{
  display:flex;align-items:center;gap:6px;
  padding:10px 16px 0;
  font-size:0.88rem;
  color:var(--text-secondary);
}
.pulse{
  width:6px;height:6px;border-radius:50%;
  background:var(--green);
  box-shadow:0 0 4px rgba(46,204,64,0.5);
  animation:pulse-beat 2s ease-in-out infinite;
}
@keyframes pulse-beat{
  0%,100%{opacity:1;transform:scale(1)}
  50%{opacity:0.4;transform:scale(0.8)}
}

/* ── Line section headers ── */
.line-section{
  margin-top:16px;
}
.line-header{
  display:flex;align-items:center;gap:0;
  margin:0 12px;
  height:32px;
  overflow:hidden;
  border-radius:3px;
}
.line-header-bar{
  width:6px;height:100%;
  flex-shrink:0;
}
.line-header-label{
  flex:1;
  padding:0 12px;
  font-size:0.9rem;
  font-weight:700;
  letter-spacing:0.1em;
  text-transform:uppercase;
  color:#fff;
  background:rgba(255,255,255,0.06);
  height:100%;
  display:flex;align-items:center;
}
.line-header-count{
  padding:0 12px;
  font-size:0.88rem;
  font-weight:500;
  color:var(--text-muted);
  background:rgba(255,255,255,0.03);
  height:100%;
  display:flex;align-items:center;
  font-variant-numeric:tabular-nums;
}

/* ── Station row ── */
.station-list{
  margin:0 12px;
}
.station-row{
  display:flex;
  align-items:center;
  gap:10px;
  padding:10px 12px;
  border-bottom:1px solid var(--border-light);
  transition:background 0.15s;
}
.station-row:hover{
  background:var(--surface-hover);
}
.station-row:last-child{
  border-bottom:none;
}
.station-left{
  display:flex;
  align-items:center;
  gap:8px;
  flex:1;
  min-width:0;
}
.station-bar{
  width:3px;
  height:28px;
  border-radius:1px;
  flex-shrink:0;
}
.station-multi-bar{
  display:flex;
  flex-direction:column;
  gap:1px;
  width:3px;
  flex-shrink:0;
}
.station-multi-bar span{
  width:3px;
  height:13px;
  border-radius:1px;
}
.station-name{
  font-size:1rem;
  font-weight:600;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.station-lines-dots{
  display:flex;gap:3px;
  margin-left:6px;
  flex-shrink:0;
}
.station-line-dot{
  width:5px;height:5px;
  border-radius:50%;
}

/* ── Pills ── */
.pills{
  display:flex;
  gap:4px;
  flex-shrink:0;
}
.pill{
  display:inline-flex;
  align-items:center;
  gap:0;
  height:30px;
  border-radius:15px;
  border:1px solid var(--border);
  overflow:hidden;
  transition:border-color 0.15s;
}
.pill:hover{
  border-color:rgba(255,255,255,0.2);
}
.pill-dot{
  width:28px;
  height:28px;
  display:flex;
  align-items:center;
  justify-content:center;
  border-radius:50%;
  font-size:0.88rem;
  font-weight:700;
  color:#fff;
  flex-shrink:0;
}
.pill-time{
  padding:0 10px 0 6px;
  font-size:0.95rem;
  font-weight:600;
  font-variant-numeric:tabular-nums;
  font-feature-settings:"tnum";
  letter-spacing:-0.01em;
  color:var(--text);
  white-space:nowrap;
}
.pill-now .pill-time{
  color:var(--green);
  font-weight:700;
}
.pill-now{
  border-color:rgba(46,204,64,0.3);
}

/* ── Station Detail ── */
.detail-back{
  display:inline-flex;
  align-items:center;
  gap:4px;
  padding:12px 16px 4px;
  font-size:0.95rem;
  color:var(--text-secondary);
  transition:color 0.15s;
}
.detail-back:hover{color:var(--text)}
.detail-back-arrow{font-size:1rem}

.detail-header{
  padding:8px 16px 12px;
  border-bottom:1px solid var(--border);
}
.detail-name{
  font-size:1.3rem;
  font-weight:700;
  letter-spacing:0.02em;
}
.detail-line-badges{
  display:flex;
  gap:6px;
  margin-top:8px;
}
.detail-badge{
  display:inline-flex;
  align-items:center;
  gap:5px;
  padding:3px 10px 3px 6px;
  border-radius:3px;
  font-size:0.88rem;
  font-weight:600;
  color:#fff;
  letter-spacing:0.04em;
}
.detail-badge-dot{
  width:8px;height:8px;
  border-radius:50%;
  background:#fff;
  opacity:0.6;
}

/* ── Arrival rows (station detail) ── */
.arrival-list{
  margin:0 12px;
}
.arrival-row{
  display:flex;
  align-items:center;
  gap:10px;
  padding:12px 12px;
  border-bottom:1px solid var(--border-light);
  transition:background 0.15s;
}
.arrival-row:hover{
  background:var(--surface-hover);
}
.arrival-row:last-child{
  border-bottom:none;
}
.arrival-dir-dot{
  width:30px;height:30px;
  display:flex;
  align-items:center;
  justify-content:center;
  border-radius:50%;
  font-size:0.88rem;
  font-weight:700;
  color:#fff;
  flex-shrink:0;
}
.arrival-info{
  flex:1;min-width:0;
}
.arrival-dest{
  font-size:1rem;
  font-weight:600;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.arrival-meta{
  font-size:0.88rem;
  color:var(--text-secondary);
  margin-top:1px;
}
.arrival-time-box{
  text-align:right;
  flex-shrink:0;
  min-width:40px;
}
.arrival-time-num{
  font-size:1.15rem;
  font-weight:700;
  font-variant-numeric:tabular-nums;
  font-feature-settings:"tnum";
  line-height:1;
}
.arrival-time-unit{
  font-size:0.88rem;
  color:var(--text-secondary);
  font-weight:500;
}
.arrival-time-now{
  color:var(--green);
  font-size:1rem;
  font-weight:700;
  animation:now-blink 1.5s ease-in-out infinite;
}
@keyframes now-blink{
  0%,100%{opacity:1}
  50%{opacity:0.5}
}
.arrival-sched{
  opacity:0.55;
}

/* ── Train Detail ── */
.train-header{
  padding:8px 16px 12px;
  border-bottom:1px solid var(--border);
}
.train-id{
  font-size:0.88rem;
  font-weight:600;
  color:var(--text-secondary);
  letter-spacing:0.08em;
  text-transform:uppercase;
}
.train-dest{
  font-size:1.25rem;
  font-weight:700;
  margin-top:2px;
}
.train-badge{
  display:inline-flex;
  align-items:center;
  gap:5px;
  margin-top:6px;
  padding:4px 12px 4px 8px;
  border-radius:3px;
  font-size:0.88rem;
  font-weight:600;
  color:#fff;
  letter-spacing:0.04em;
}

/* ── Timeline ── */
.timeline-card{
  margin:8px 12px;
  background:var(--surface);
  border:1px solid var(--border);
  border-radius:4px;
  overflow:hidden;
}
.timeline{
  position:relative;
  padding:12px 0 12px 48px;
}
.timeline-line{
  position:absolute;
  left:23px;
  top:0;bottom:0;
  width:3px;
  border-radius:2px;
  opacity:0.25;
}
.timeline-line-active{
  opacity:1;
}
.tl-stop{
  position:relative;
  padding:8px 16px 8px 16px;
  display:flex;
  align-items:center;
  gap:10px;
}
.tl-dot{
  position:absolute;
  left:-32px;
  top:50%;
  transform:translateY(-50%);
  width:11px;height:11px;
  border-radius:50%;
  border:2.5px solid;
  background:var(--bg);
  z-index:1;
}
.tl-dot-current{
  width:15px;height:15px;
  left:-34px;
  background:currentColor;
  box-shadow:0 0 8px currentColor;
}
.tl-dot-current::after{
  content:"";
  position:absolute;
  inset:-4px;
  border-radius:50%;
  border:2px solid currentColor;
  opacity:0.3;
  animation:ring-expand 2s ease-in-out infinite;
}
@keyframes ring-expand{
  0%,100%{transform:scale(1);opacity:0.3}
  50%{transform:scale(1.4);opacity:0}
}
.tl-dot-past{
  background:currentColor;
  opacity:0.35;
}
.tl-name{
  font-size:1rem;
  font-weight:500;
  flex:1;
}
.tl-name-current{
  font-weight:700;
}
.tl-name-past{
  color:var(--text-muted);
}
.tl-time{
  font-size:0.95rem;
  font-weight:500;
  color:var(--text-secondary);
  font-variant-numeric:tabular-nums;
  flex-shrink:0;
}
.tl-tag-here{
  font-size:0.88rem;
  font-weight:700;
  padding:2px 8px;
  border-radius:3px;
  flex-shrink:0;
}

/* ── Footer ── */
.footer{
  text-align:center;
  padding:24px 16px 8px;
  font-size:0.88rem;
  color:var(--text-muted);
}
.footer a{
  color:var(--text-secondary);
  transition:color 0.15s;
}
.footer a:hover{color:var(--text)}
.footer-sep{margin:0 6px;opacity:0.4}

/* ── Empty ── */
.empty{
  text-align:center;
  padding:48px 16px;
  color:var(--text-secondary);
}
.empty-icon{font-size:2rem;margin-bottom:8px;opacity:0.4}
.empty-text{font-size:1rem}

/* ── Light mode ── */
@media(prefers-color-scheme:light){
  :root{
    --bg:#f0f0f4;
    --surface:#ffffff;
    --surface-hover:#f5f5f8;
    --border:#d8d8e0;
    --border-light:#e4e4ea;
    --text:#181820;
    --text-secondary:#606070;
    --text-muted:#9898a8;
    color-scheme:light;
  }
  .pill{border-color:var(--border)}
  .tl-dot{background:var(--bg)}
}

/* Smooth reload */
#rail-body{animation:fadeSlide 0.2s ease}
@keyframes fadeSlide{from{opacity:0.5;transform:translateY(2px)}to{opacity:1;transform:translateY(0)}}
`;

// ── Polling JS ──
const POLL_JS = `<script>
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
    fetch(location.pathname+'?partial=1')
      .then(function(r){return r.text()})
      .then(function(h){
        var b=document.getElementById('rail-body');
        if(b){b.innerHTML=h;ts=Date.now()}
      }).catch(function(){});
  },10000);
})();
</script>`;

// ── Shell wrapper ──
function shell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#0c0c14">
<title>${esc(title)} — MARTA</title>
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

// ── Color stripe ──
function colorStripe(): string {
  return `<div class="color-stripe">` +
    `<span style="background:var(--gold)"></span>` +
    `<span style="background:var(--red)"></span>` +
    `<span style="background:var(--blue)"></span>` +
    `<span style="background:var(--green)"></span>` +
    `</div>`;
}

// ── Footer ──
function footer(): string {
  return `<div class="footer">MARTA Rail<span class="footer-sep">·</span><a href="/bus">Bus</a><span class="footer-sep">·</span><a href="https://home.jake.town">home.jake.town</a></div>`;
}

// ── Build a pill ──
function buildPill(dir: string, sec: number, line: string): string {
  const color = LINE_COLOR[line] || "#888";
  const m = Math.max(0, Math.floor(sec / 60));
  const isNow = m === 0;
  const timeStr = isNow ? "NOW" : `${m}m`;
  const nowClass = isNow ? " pill-now" : "";
  return `<span class="pill${nowClass}">` +
    `<span class="pill-dot" style="background:${color}">${esc(dirLetter(dir))}</span>` +
    `<span class="pill-time">${timeStr}</span>` +
    `</span>`;
}

// ══════════════════════════════════════════════
//  LANDING VIEW
// ══════════════════════════════════════════════
export async function landingView(partial?: boolean): Promise<string> {
  const arrivals = await fetchArrivals();
  const stations = byStation(arrivals);

  // Group stations by line for Tokyo Metro-style display
  // Build a map: line → list of station entries (in line order)
  const seenStations = new Set<string>();
  let content = "";

  for (const line of LINE_ORDER) {
    const lineStations = LINE_STATIONS[line];
    if (!lineStations) continue;
    const color = LINE_COLOR[line];

    // Find stations on this line that have current arrivals
    const stationsOnLine: Array<{ name: string; slug: string; arrivals: RailArrival[] }> = [];
    for (const stName of lineStations) {
      // Find matching station in the arrivals data
      for (const [stKey, arr] of stations.entries()) {
        const display = stationDisplayName(stKey);
        if (display.toLowerCase() === stName.toLowerCase() ||
            stKey.toLowerCase().replace(/ station$/i, "") === stName.toLowerCase()) {
          // Check if any arrival is on this line
          const onThisLine = arr.some(a => a.line === line);
          if (onThisLine && !seenStations.has(stKey)) {
            stationsOnLine.push({
              name: stationDisplayName(stKey),
              slug: stationSlug(stKey),
              arrivals: arr,
            });
            seenStations.add(stKey);
          }
          break;
        }
      }
    }

    if (stationsOnLine.length === 0) continue;

    // Line section header
    content += `<div class="line-section">`;
    content += `<div class="line-header">`;
    content += `<div class="line-header-bar" style="background:${color}"></div>`;
    content += `<div class="line-header-label">${esc(line)} LINE</div>`;
    content += `<div class="line-header-count">${stationsOnLine.length}</div>`;
    content += `</div>`;

    // Station rows
    content += `<div class="station-list">`;
    for (const st of stationsOnLine) {
      const lines = stationLines(st.arrivals);

      // Soonest per direction
      const dirMap = new Map<string, RailArrival>();
      for (const a of st.arrivals) {
        if (!dirMap.has(a.direction) || a.waitSeconds < dirMap.get(a.direction)!.waitSeconds) {
          dirMap.set(a.direction, a);
        }
      }

      const dirOrder = ["N", "S", "E", "W"];
      const sortedDirs = [...dirMap.entries()]
        .sort(([a], [b]) => dirOrder.indexOf(a) - dirOrder.indexOf(b));

      let pills = "";
      for (const [dir, a] of sortedDirs) {
        pills += buildPill(dir, a.waitSeconds, a.line);
      }

      // Line dots for multi-line stations
      let dots = "";
      if (lines.size > 1) {
        dots = `<span class="station-lines-dots">`;
        for (const l of lines) {
          dots += `<span class="station-line-dot" style="background:${LINE_COLOR[l] || "#888"}"></span>`;
        }
        dots += `</span>`;
      }

      content += `<a class="station-row" href="/rail-h/${esc(st.slug)}">`;
      content += `<div class="station-left">`;
      content += `<span class="station-bar" style="background:${color}"></span>`;
      content += `<span class="station-name">${esc(st.name)}</span>`;
      content += dots;
      content += `</div>`;
      content += `<div class="pills">${pills}</div>`;
      content += `</a>`;
    }
    content += `</div></div>`;
  }

  // Any stations not yet shown (not in known line orderings)
  const remaining: Array<{ name: string; slug: string; arrivals: RailArrival[] }> = [];
  for (const [stKey, arr] of stations.entries()) {
    if (!seenStations.has(stKey)) {
      remaining.push({
        name: stationDisplayName(stKey),
        slug: stationSlug(stKey),
        arrivals: arr,
      });
    }
  }
  if (remaining.length > 0) {
    remaining.sort((a, b) => a.name.localeCompare(b.name));
    content += `<div class="line-section">`;
    content += `<div class="line-header">`;
    content += `<div class="line-header-bar" style="background:var(--text-muted)"></div>`;
    content += `<div class="line-header-label">OTHER</div>`;
    content += `<div class="line-header-count">${remaining.length}</div>`;
    content += `</div>`;
    content += `<div class="station-list">`;
    for (const st of remaining) {
      const lines = stationLines(st.arrivals);
      const dirMap = new Map<string, RailArrival>();
      for (const a of st.arrivals) {
        if (!dirMap.has(a.direction) || a.waitSeconds < dirMap.get(a.direction)!.waitSeconds) {
          dirMap.set(a.direction, a);
        }
      }
      const sortedDirs = [...dirMap.entries()]
        .sort(([a], [b]) => ["N","S","E","W"].indexOf(a) - ["N","S","E","W"].indexOf(b));

      let pills = "";
      for (const [dir, a] of sortedDirs) {
        pills += buildPill(dir, a.waitSeconds, a.line);
      }

      let firstLine = "";
      for (const l of lines) { firstLine = l; break; }

      content += `<a class="station-row" href="/rail-h/${esc(st.slug)}">`;
      content += `<div class="station-left">`;
      content += `<span class="station-bar" style="background:${LINE_COLOR[firstLine] || "#888"}"></span>`;
      content += `<span class="station-name">${esc(st.name)}</span>`;
      content += `</div>`;
      content += `<div class="pills">${pills}</div>`;
      content += `</a>`;
    }
    content += `</div></div>`;
  }

  if (!content) {
    content = `<div class="empty"><div class="empty-icon">🚇</div><div class="empty-text">No trains currently reporting</div></div>`;
  }

  const body = `
${colorStripe()}
<div class="header">
  <div class="header-title">MARTA Rail</div>
  <div class="header-sub">Atlanta</div>
</div>
<div class="freshness">
  <span class="pulse"></span>
  <span>Live · <span id="rail-freshness">just now</span></span>
</div>
<div id="rail-body">
${content}
</div>
${footer()}`;

  return partial ? content : shell("Stations", body);
}

// ══════════════════════════════════════════════
//  STATION DETAIL VIEW
// ══════════════════════════════════════════════
export async function stationView(slug: string, partial?: boolean): Promise<string | null> {
  const arrivals = await fetchArrivals();
  const stations = byStation(arrivals);

  // Find matching station
  let stKey = "";
  let stArr: RailArrival[] = [];
  for (const [key, arr] of stations.entries()) {
    if (stationSlug(key) === slug) {
      stKey = key;
      stArr = arr;
      break;
    }
  }
  if (!stKey) return null;

  const name = stationDisplayName(stKey);
  const lines = stationLines(stArr);
  const sorted = [...stArr].sort((a, b) => a.waitSeconds - b.waitSeconds);

  let lineBadges = "";
  for (const l of lines) {
    const c = LINE_COLOR[l] || "#888";
    lineBadges += `<span class="detail-badge" style="background:${c}"><span class="detail-badge-dot"></span>${esc(l)}</span>`;
  }

  let rows = "";
  for (const a of sorted) {
    const color = LINE_COLOR[a.line] || "#888";
    const m = Math.max(0, Math.floor(a.waitSeconds / 60));
    const isNow = m === 0;
    const schedClass = a.isRealtime ? "" : " arrival-sched";

    let timeHtml: string;
    if (isNow) {
      timeHtml = `<div class="arrival-time-box"><span class="arrival-time-now">NOW</span></div>`;
    } else {
      timeHtml = `<div class="arrival-time-box"><span class="arrival-time-num">${m}</span><span class="arrival-time-unit"> min</span></div>`;
    }

    const metaParts = [esc(a.line), dirFull(a.direction)];
    if (!a.isRealtime) metaParts.push("Sched");

    rows += `<a class="arrival-row${schedClass}" href="/rail-h/train/${esc(a.trainId)}">`;
    rows += `<span class="arrival-dir-dot" style="background:${color}">${esc(dirLetter(a.direction))}</span>`;
    rows += `<div class="arrival-info">`;
    rows += `<div class="arrival-dest">${esc(stationDisplayName(a.destination))}</div>`;
    rows += `<div class="arrival-meta" style="color:${color}">${metaParts.join(" · ")}</div>`;
    rows += `</div>`;
    rows += timeHtml;
    rows += `</a>`;
  }

  if (!rows) {
    rows = `<div class="empty"><div class="empty-icon">🕐</div><div class="empty-text">No arrivals at this station</div></div>`;
  }

  const body = `
${colorStripe()}
<a class="detail-back" href="/rail-h/"><span class="detail-back-arrow">←</span> All Stations</a>
<div class="detail-header">
  <div class="detail-name">${esc(name)}</div>
  <div class="detail-line-badges">${lineBadges}</div>
</div>
<div class="freshness">
  <span class="pulse"></span>
  <span>Live · <span id="rail-freshness">just now</span></span>
</div>
<div id="rail-body">
<div class="arrival-list">
${rows}
</div>
</div>
${footer()}`;

  return partial ? `<div class="arrival-list">${rows}</div>` : shell(name, body);
}

// ══════════════════════════════════════════════
//  TRAIN DETAIL VIEW
// ══════════════════════════════════════════════
export async function trainView(trainId: string, partial?: boolean): Promise<string | null> {
  const arrivals = await fetchArrivals();
  const train = arrivals.filter(a => a.trainId === trainId);
  if (!train.length) return null;

  const sample = train[0];
  const line = sample.line;
  const color = LINE_COLOR[line] || "#888";
  const dest = sample.destination;
  const dir = sample.direction;

  const lineStations = LINE_STATIONS[line];
  if (!lineStations) return null;

  // Build lookup
  const arrByStation = new Map<string, RailArrival>();
  for (const a of train) {
    arrByStation.set(a.station, a);
  }

  // Direction ordering
  const isForward = dir === "N" || dir === "E";
  const ordered = isForward ? [...lineStations] : [...lineStations].reverse();

  // Find current station (lowest wait time)
  let currentStation = "";
  let minWait = Infinity;
  for (const a of train) {
    if (a.waitSeconds < minWait) {
      minWait = a.waitSeconds;
      currentStation = a.station;
    }
  }

  // Match current station to ordered list
  let currentIdx = -1;
  for (let i = 0; i < ordered.length; i++) {
    // Try matching by display name
    for (const [stKey] of arrByStation.entries()) {
      if (stKey === currentStation) {
        const display = stationDisplayName(stKey);
        if (display.toLowerCase() === ordered[i].toLowerCase() ||
            stKey.toLowerCase().replace(/ station$/i, "") === ordered[i].toLowerCase()) {
          currentIdx = i;
        }
      }
    }
  }

  // Build timeline stops
  let stops = "";
  for (let i = 0; i < ordered.length; i++) {
    const st = ordered[i];

    // Find matching arrival
    let arrival: RailArrival | undefined;
    for (const [stKey, a] of arrByStation.entries()) {
      const display = stationDisplayName(stKey);
      if (display.toLowerCase() === st.toLowerCase() ||
          stKey.toLowerCase().replace(/ station$/i, "") === st.toLowerCase()) {
        arrival = a;
        break;
      }
    }

    const isCurrent = i === currentIdx;
    const isPast = currentIdx >= 0 && i < currentIdx;

    // Dot class
    let dotClass = "tl-dot";
    if (isCurrent) dotClass += " tl-dot-current";
    else if (isPast) dotClass += " tl-dot-past";

    // Name class
    let nameClass = "tl-name";
    if (isCurrent) nameClass += " tl-name-current";
    else if (isPast) nameClass += " tl-name-past";

    // Time display
    let timeHtml = "";
    if (arrival) {
      const m = Math.max(0, Math.floor(arrival.waitSeconds / 60));
      if (isCurrent && m === 0) {
        timeHtml = `<span class="tl-tag-here" style="background:rgba(${hexToRgb(color)},0.15);color:${color}">● HERE</span>`;
      } else if (m === 0) {
        timeHtml = `<span class="tl-time" style="color:${color}">NOW</span>`;
      } else {
        timeHtml = `<span class="tl-time">${m} min</span>`;
      }
    } else if (isPast) {
      timeHtml = `<span class="tl-time" style="color:var(--text-muted)">—</span>`;
    }

    stops += `<div class="tl-stop">`;
    stops += `<span class="${dotClass}" style="border-color:${color};color:${color}"></span>`;
    stops += `<span class="${nameClass}">${esc(st)}</span>`;
    stops += timeHtml;
    stops += `</div>`;
  }

  const timelineHtml = `<div class="timeline-card">
<div class="timeline">
  <div class="timeline-line" style="background:${color}"></div>
  ${stops}
</div>
</div>`;

  const body = `
${colorStripe()}
<a class="detail-back" href="/rail-h/"><span class="detail-back-arrow">←</span> All Stations</a>
<div class="train-header">
  <div class="train-id">Train ${esc(trainId)}</div>
  <div class="train-dest">${esc(stationDisplayName(dest))}</div>
  <span class="train-badge" style="background:${color}">${esc(line)} · ${dirFull(dir)}</span>
</div>
<div class="freshness">
  <span class="pulse"></span>
  <span>Live · <span id="rail-freshness">just now</span></span>
</div>
<div id="rail-body">
${timelineHtml}
</div>
${footer()}`;

  return partial ? timelineHtml : shell(`Train ${trainId}`, body);
}

// ── Utility ──
function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
