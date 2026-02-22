import {
  fetchArrivals,
  byStation,
  stationSlug,
  stationDisplayName,
  stationLines,
  type RailArrival,
} from "../api";

const LC: Record<string, string> = {
  GOLD: "#c9a227", RED: "#cc3333", BLUE: "#0074d9", GREEN: "#2ecc40",
};

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

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtMin(sec: number): number {
  return Math.max(0, Math.floor(sec / 60));
}

const CSS = `<style>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700;800&display=swap');

:root {
  --bg: #000;
  --fg: #bbb;
  --hi: #fff;
  --dim: #555;
  --mute: #222;
  --border: #444;
  --mono: 'JetBrains Mono','SF Mono','Consolas',monospace;
}
@media(prefers-color-scheme:light){
  :root{--bg:#e8e4de;--fg:#444;--hi:#000;--dim:#888;--mute:#ccc;--border:#999}
}
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:var(--bg);color:var(--fg);font-family:var(--mono);-webkit-font-smoothing:antialiased;min-height:100dvh}
a{color:inherit;text-decoration:none}

.f{max-width:480px;margin:0 auto;border-left:5px solid var(--border);border-right:5px solid var(--border);min-height:100dvh}

/* ══ MASTHEAD ══ */
.mh{border-bottom:6px double var(--hi);padding:8px 10px;display:flex;justify-content:space-between;align-items:center}
.mh-b{font-size:1.5rem;font-weight:800;letter-spacing:.3em;text-transform:uppercase;color:var(--hi);line-height:1}
.mh-s{font-size:0.88rem;font-weight:400;letter-spacing:.12em;color:var(--dim);margin-left:2px}
.li{display:flex;align-items:center;gap:5px;font-size:0.88rem;color:var(--dim);font-weight:500}
.ld{width:8px;height:8px;background:#2ecc40;border-radius:50%;animation:throb 2s ease-in-out infinite}
@keyframes throb{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.2;transform:scale(.5)}}

/* ══ NAV ══ */
.nb{display:block;padding:5px 10px;font-size:0.95rem;font-weight:700;color:var(--dim);border-bottom:3px solid var(--mute);letter-spacing:.06em;text-transform:uppercase}
.nb:active{color:var(--hi);background:var(--mute)}

/* ══ LANDING ROW ══ */
.sr{display:block;border-bottom:3px solid var(--mute);padding:8px 10px 7px}
.sr:active{background:#0d0d0d}
@media(prefers-color-scheme:light){.sr:active{background:#d4d0ca}}

.sn{
  font-size:1.5rem;font-weight:800;text-transform:uppercase;
  letter-spacing:.02em;color:var(--hi);line-height:1.1;
  margin-bottom:5px;
}

.tk{display:flex;flex-wrap:wrap;gap:4px}

/* ══ PILL — hard-edged color slab ══ */
.pl{
  display:inline-flex;align-items:stretch;
  background:var(--mute);font-weight:700;line-height:1;
}
.pl-c{
  width:30px;display:flex;align-items:center;justify-content:center;
  flex-shrink:0;color:#000;font-weight:800;font-size:0.95rem;
}
.pl-t{
  padding:4px 8px 4px 5px;font-variant-numeric:tabular-nums;
  color:var(--hi);font-weight:800;font-size:1rem;
  display:flex;align-items:center;
}
/* Urgent: <=1 min — inverted flash */
.pl-urgent{
  background:var(--hi);color:var(--bg);
  animation:flash 0.6s step-end infinite;
}
.pl-now{color:#2ecc40;animation:flash 0.8s step-end infinite}
@keyframes flash{0%,100%{opacity:1}50%{opacity:0}}

/* ══ STATION DETAIL ══ */
.dh{padding:10px 10px 8px;border-bottom:6px double var(--hi);background:var(--mute)}
.dn{font-size:1.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.03em;color:var(--hi);line-height:1.05}
.dl{display:flex;gap:5px;margin-top:8px}
.lt{font-size:0.88rem;font-weight:800;padding:2px 10px;letter-spacing:.1em;color:#000}

/* ══ ARRIVAL ROW ══ */
.ar{
  display:grid;grid-template-columns:8px 1fr auto;gap:8px;
  align-items:center;padding:8px 10px;
  border-bottom:2px solid var(--mute);color:var(--fg);
}
.ar:active{background:#0d0d0d}
@media(prefers-color-scheme:light){.ar:active{background:#d4d0ca}}

.ab{width:8px;align-self:stretch;min-height:32px}
.ai{min-width:0}
.ad{font-size:1.1rem;font-weight:800;text-transform:uppercase;letter-spacing:.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--hi)}
.am{font-size:0.88rem;color:var(--dim);margin-top:1px;letter-spacing:.03em}
.rt{display:inline-block;width:5px;height:5px;background:#2ecc40;border-radius:50%;margin-left:4px;vertical-align:middle}
.sc{display:inline-block;width:5px;height:5px;background:var(--dim);border-radius:50%;margin-left:4px;vertical-align:middle}
.at{font-size:1.6rem;font-weight:800;font-variant-numeric:tabular-nums;text-align:right;color:var(--hi);white-space:nowrap;letter-spacing:-.02em}
.au{font-size:0.95rem;font-weight:500;color:var(--dim)}
.an{color:#2ecc40;animation:flash 0.8s step-end infinite}
/* Urgent arrival */
.at-urg{background:var(--hi);color:var(--bg);padding:2px 6px;animation:flash 0.6s step-end infinite}

/* ══ TRAIN ══ */
.th{padding:10px 10px 8px;border-bottom:6px double var(--hi);background:var(--mute)}
.tl-lab{font-size:0.95rem;color:var(--dim);letter-spacing:.12em;font-weight:500}
.td-big{font-size:1.4rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em;line-height:1.1;margin-top:2px}
.tl-tag{display:inline-block;font-size:0.88rem;font-weight:800;padding:2px 10px;letter-spacing:.1em;color:#000;margin-top:8px}

/* ══ TIMELINE ══ */
.tl{padding:2px 10px 16px}
.tr{display:grid;grid-template-columns:1fr 28px 1fr;align-items:center;min-height:38px}
.ts{text-align:right;padding-right:12px;font-size:1rem;font-weight:700;text-transform:uppercase;letter-spacing:.02em;color:var(--fg);text-decoration:none;line-height:1.1}
.ts:hover{text-decoration:underline}
.ts-p{color:var(--mute);font-weight:500}
.ts-h{font-weight:800;font-size:1.1rem}
.tt{position:relative;display:flex;justify-content:center;align-items:center;height:100%}
.trl{position:absolute;width:6px;top:0;bottom:0}
.trl-p{opacity:.15}
.tn{width:14px;height:14px;z-index:1;border:4px solid;background:var(--bg)}
.tn-p{opacity:.2}
.tn-h{width:18px;height:18px;border-width:0;animation:throb 1.5s ease-in-out infinite}
.te{padding-left:12px;font-size:0.95rem;font-weight:700;font-variant-numeric:tabular-nums;color:var(--dim)}
.te-a{color:var(--hi)}
.te-n{color:#2ecc40;animation:flash 0.8s step-end infinite}
.te-p{color:var(--mute);font-weight:400}

.em{padding:40px 10px;text-align:center;font-size:1rem;color:var(--dim);letter-spacing:.12em}
.ft{border-top:3px solid var(--mute);padding:14px 10px;font-size:0.88rem;color:var(--dim);text-align:center;letter-spacing:.05em}
.ft a{color:var(--fg)}.ft a:hover{text-decoration:underline}
</style>`;

const JS = `<script>
(function(){
  var el=document.getElementById('rail-body');
  if(!el)return;
  var last=Date.now();
  function poll(){
    fetch(location.pathname+'?partial=1',{headers:{'Accept':'text/html'}})
      .then(function(r){return r.ok?r.text():null})
      .then(function(h){if(h){el.innerHTML=h;last=Date.now();}})
      .catch(function(){});
  }
  setInterval(poll,10000);
  setInterval(function(){
    var a=document.getElementById('age');
    if(a){var s=Math.floor((Date.now()-last)/1000);a.textContent=s+'s ago';}
  },1000);
})();
</script>`;

function shell(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>${CSS}</head>
<body><div class="f">${body}</div>${JS}</body></html>`;
}

function masthead(back?: string): string {
  const b = back ? `<a href="${back}" class="mh-b">MARTA</a>` : `<span class="mh-b">MARTA</span>`;
  return `<div class="mh"><div>${b}<span class="mh-s">RAIL</span></div><div class="li"><div class="ld"></div><span id="age">0s ago</span></div></div>`;
}

function footer(): string {
  return `<div class="ft">MARTA Rail · <a href="/bus">Bus</a> · <a href="https://home.jake.town">home.jake.town</a></div>`;
}

// ════════════════════════════════════════
// 1. LANDING
// ════════════════════════════════════════
export async function landingView(partial?: boolean): Promise<string> {
  const arrivals = await fetchArrivals();
  const stations = byStation(arrivals);
  const sorted = [...stations.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  let rows = "";
  if (sorted.length === 0) rows = `<div class="em">// NO DATA //</div>`;

  for (const [name, arrs] of sorted) {
    const slug = stationSlug(name);
    const display = stationDisplayName(name);

    const byDir = new Map<string, RailArrival>();
    for (const a of arrs) {
      const existing = byDir.get(a.direction);
      if (!existing || a.waitSeconds < existing.waitSeconds) byDir.set(a.direction, a);
    }

    let pills = "";
    for (const d of ["N","S","E","W"]) {
      const a = byDir.get(d);
      if (!a) continue;
      const m = fmtMin(a.waitSeconds);
      const color = LC[a.line] || "#666";
      const isNow = m === 0;
      const isUrgent = m <= 1 && !isNow;
      let timeCls = "pl-t";
      let timeStr = `${m}m`;
      if (isNow) { timeCls = "pl-t pl-now"; timeStr = "NOW"; }
      else if (isUrgent) { timeCls = "pl-t pl-urgent"; timeStr = "1m"; }
      pills += `<span class="pl"><span class="pl-c" style="background:${color}">${d}</span><span class="${timeCls}">${timeStr}</span></span>`;
    }

    rows += `<a class="sr" href="/rail-i/${esc(slug)}"><div class="sn">${esc(display)}</div><div class="tk">${pills}</div></a>\n`;
  }

  const inner = `${rows}${footer()}`;
  if (partial) return inner;
  return shell("MARTA Rail", `${masthead()}<div id="rail-body">${inner}</div>`);
}

// ════════════════════════════════════════
// 2. STATION DETAIL
// ════════════════════════════════════════
export async function stationView(slug: string, partial?: boolean): Promise<string | null> {
  const arrivals = await fetchArrivals();
  const stations = byStation(arrivals);

  let stationName: string | null = null;
  let stationArrivals: RailArrival[] = [];
  for (const [name, arrs] of stations) {
    if (stationSlug(name) === slug) { stationName = name; stationArrivals = arrs; break; }
  }
  if (!stationName) return null;

  const display = stationDisplayName(stationName);
  const lines = stationLines(stationArrivals);
  const sorted = [...stationArrivals].sort((a, b) => a.waitSeconds - b.waitSeconds);

  const lineTags = [...lines].map(l => `<span class="lt" style="background:${LC[l]||"#666"}">${l}</span>`).join("");

  let rows = "";
  if (sorted.length === 0) rows = `<div class="em">// NO ARRIVALS //</div>`;

  for (const a of sorted) {
    const color = LC[a.line] || "#666";
    const m = fmtMin(a.waitSeconds);
    const isNow = m === 0;
    const isUrgent = m <= 1 && !isNow;
    const rtBadge = a.isRealtime ? '<span class="rt"></span>' : '<span class="sc"></span>';

    let timeHtml: string;
    if (isNow) timeHtml = `<span class="at an">NOW</span>`;
    else if (isUrgent) timeHtml = `<span class="at at-urg">1m</span>`;
    else timeHtml = `<span class="at">${m}<span class="au">m</span></span>`;

    rows += `<a class="ar" href="/rail-i/train/${esc(a.trainId)}">
<div class="ab" style="background:${color}"></div>
<div class="ai"><div class="ad">${esc(a.destination)}${rtBadge}</div><div class="am">${a.direction} · ${esc(a.line)} · #${esc(a.trainId)}</div></div>
${timeHtml}</a>\n`;
  }

  const inner = `<div class="dh"><div class="dn">${esc(display)}</div><div class="dl">${lineTags}</div></div>
<a class="nb" href="/rail-i/">← ALL</a>${rows}${footer()}`;

  if (partial) return inner;
  return shell(`${display} — MARTA`, `${masthead("/rail-i/")}<div id="rail-body">${inner}</div>`);
}

// ════════════════════════════════════════
// 3. TRAIN
// ════════════════════════════════════════
export async function trainView(trainId: string, partial?: boolean): Promise<string | null> {
  const arrivals = await fetchArrivals();
  const trainArrivals = arrivals.filter(a => a.trainId === trainId);
  if (trainArrivals.length === 0) return null;

  const sample = trainArrivals[0];
  const line = sample.line;
  const color = LC[line] || "#666";
  const dest = sample.destination;
  const lineStations = LINE_STATIONS[line] || [];

  const arrivalMap = new Map<string, RailArrival>();
  for (const a of trainArrivals) arrivalMap.set(a.station.toUpperCase(), a);

  let currentIdx = -1;
  let minWait = Infinity;
  for (const a of trainArrivals) {
    if (a.waitSeconds < minWait) {
      minWait = a.waitSeconds;
      for (let i = 0; i < lineStations.length; i++) {
        if (lineStations[i].toUpperCase() === a.station.toUpperCase()) { currentIdx = i; break; }
      }
    }
  }

  let tl = "";
  for (let i = 0; i < lineStations.length; i++) {
    const sName = lineStations[i];
    const arrival = arrivalMap.get(sName.toUpperCase());
    const isPast = currentIdx >= 0 && i < currentIdx;
    const isHere = currentIdx >= 0 && i === currentIdx;

    let stnCls = "ts";
    if (isPast) stnCls += " ts-p";
    if (isHere) stnCls += " ts-h";
    const stnColor = isHere ? `color:${color}` : "";

    let nodeCls = "tn"; let nodeStyle = `border-color:${color};`;
    if (isPast) { nodeCls += " tn-p"; nodeStyle += `background:${color};`; }
    else if (isHere) { nodeCls += " tn-h"; nodeStyle += `background:${color};border-color:${color};`; }

    const railCls = isPast ? "trl trl-p" : "trl";

    let eta = "";
    if (arrival) {
      const m = fmtMin(arrival.waitSeconds);
      if (m === 0) eta = `<div class="te te-n">NOW</div>`;
      else eta = `<div class="te${isHere?" te-a":""}">${m}m</div>`;
    } else if (isPast) eta = `<div class="te te-p">——</div>`;
    else eta = `<div class="te"></div>`;

    tl += `<div class="tr"><a href="/rail-i/${esc(stationSlug(sName))}" class="${stnCls}" style="${stnColor}">${esc(stationDisplayName(sName))}</a><div class="tt"><div class="${railCls}" style="background:${color}"></div><div class="${nodeCls}" style="${nodeStyle}"></div></div>${eta}</div>\n`;
  }

  const inner = `<div class="th"><div class="tl-lab">TRAIN ${esc(trainId)}</div><div class="td-big" style="color:${color}">→ ${esc(dest)}</div><span class="tl-tag" style="background:${color}">${esc(line)}</span></div>
<a class="nb" href="/rail-i/">← ALL</a><div class="tl">${tl}</div>${footer()}`;

  if (partial) return inner;
  return shell(`Train ${trainId} — MARTA`, `${masthead("/rail-i/")}<div id="rail-body">${inner}</div>`);
}
