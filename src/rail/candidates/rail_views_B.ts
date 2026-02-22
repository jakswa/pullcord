// Rail Views B — "Modern Native"
// Apple Maps meets Citymapper. Cards, rounded corners, warm polish.
// Feels like a native iOS app rendered in a browser.
import {
  fetchArrivals,
  byStation,
  stationSlug,
  stationDisplayName,
  stationLines,
  type RailArrival,
} from "../api";

const LINE_COLORS: Record<string, string> = {
  GOLD: "#c9a227",
  RED: "#cc3333",
  BLUE: "#0074d9",
  GREEN: "#2ecc40",
};

const LINE_STATIONS: Record<string, string[]> = {
  RED: [
    "AIRPORT STATION","COLLEGE PARK STATION","EAST POINT STATION","LAKEWOOD STATION",
    "OAKLAND CITY STATION","WEST END STATION","GARNETT STATION","FIVE POINTS STATION",
    "PEACHTREE CENTER STATION","CIVIC CENTER STATION","NORTH AVE STATION","MIDTOWN STATION",
    "ARTS CENTER STATION","LINDBERGH STATION","BUCKHEAD STATION","MEDICAL CENTER STATION",
    "DUNWOODY STATION","SANDY SPRINGS STATION","NORTH SPRINGS STATION",
  ],
  GOLD: [
    "AIRPORT STATION","COLLEGE PARK STATION","EAST POINT STATION","LAKEWOOD STATION",
    "OAKLAND CITY STATION","WEST END STATION","GARNETT STATION","FIVE POINTS STATION",
    "PEACHTREE CENTER STATION","CIVIC CENTER STATION","NORTH AVE STATION","MIDTOWN STATION",
    "ARTS CENTER STATION","LINDBERGH STATION","LENOX STATION","BROOKHAVEN STATION",
    "CHAMBLEE STATION","DORAVILLE STATION",
  ],
  BLUE: [
    "HAMILTON E HOLMES STATION","WEST LAKE STATION","ASHBY STATION","VINE CITY STATION",
    "OMNI DOME STATION","FIVE POINTS STATION","GEORGIA STATE STATION","KING MEMORIAL STATION",
    "INMAN PARK STATION","EDGEWOOD CANDLER PARK STATION","EAST LAKE STATION",
    "DECATUR STATION","AVONDALE STATION","KENSINGTON STATION","INDIAN CREEK STATION",
  ],
  GREEN: [
    "BANKHEAD STATION","ASHBY STATION","VINE CITY STATION","OMNI DOME STATION",
    "FIVE POINTS STATION","GEORGIA STATE STATION","KING MEMORIAL STATION",
    "INMAN PARK STATION","EDGEWOOD CANDLER PARK STATION",
  ],
};

// ── Helpers ──

function lineDot(line: string): string {
  const c = LINE_COLORS[line] || "#888";
  return `<span class="ldot" style="background:${c}"></span>`;
}

function dirPill(dir: string, mins: number, arriving: boolean): string {
  const arrows: Record<string, string> = { N: "↑", S: "↓", E: "→", W: "←" };
  if (arriving) return `<span class="dp dp-now"><span class="dp-arrow">${arrows[dir] || dir}</span><span class="dp-val">Now</span></span>`;
  return `<span class="dp"><span class="dp-arrow">${arrows[dir] || dir}</span><span class="dp-val">${mins}m</span></span>`;
}

function linePill(line: string): string {
  const c = LINE_COLORS[line] || "#888";
  return `<span class="lp" style="background:${c}">${line[0]}</span>`;
}

function dirBadge(dir: string): string {
  const arrows: Record<string, string> = { N: "↑", S: "↓", E: "→", W: "←" };
  return `<span class="dbadge">${arrows[dir] || ""}${dir}</span>`;
}

function timeDisplay(a: RailArrival): string {
  if (a.waitSeconds <= 30) return `<span class="t-now">Now</span>`;
  const min = Math.floor(a.waitSeconds / 60);
  return `<span class="t-min">${min}</span><span class="t-unit">min</span>`;
}

// ── Polling JS ──
const POLL_JS = `<script>
(function(){
  var b=document.getElementById('rail-body');
  if(!b)return;
  var st=Date.now(),dot=document.getElementById('pulse');
  function tick(){
    var el=document.getElementById('age');
    if(el)el.textContent=Math.floor((Date.now()-st)/1000)+'s';
  }
  function poll(){
    var x=new XMLHttpRequest();
    x.open('GET',location.pathname+'?partial=1');
    x.onload=function(){
      if(x.status===200){
        b.innerHTML=x.responseText;
        st=Date.now();
        if(dot){dot.style.opacity='1';setTimeout(function(){dot.style.opacity='0.4'},300)}
      }
    };
    x.send();
  }
  setInterval(poll,10000);
  setInterval(tick,1000);
})();
</script>`;

// ── CSS ──
const CSS = `<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --bg:#0f0f0f;--card:#1a1a1a;--card-hover:#222;--text:#eee;--dim:#999;
  --border:rgba(255,255,255,0.06);--shadow:0 1px 3px rgba(0,0,0,0.3);
  --radius:12px;--radius-sm:8px;--now:#34d058;
  --sans:-apple-system,system-ui,'SF Pro Display','Segoe UI',sans-serif;
}
@media(prefers-color-scheme:light){
  :root{
    --bg:#f2f2f7;--card:#fff;--card-hover:#f8f8fa;--text:#1c1c1e;--dim:#8e8e93;
    --border:rgba(0,0,0,0.06);--shadow:0 1px 3px rgba(0,0,0,0.08);--now:#28a745;
  }
}
body{background:var(--bg);color:var(--text);font-family:var(--sans);-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%}
a{color:inherit;text-decoration:none}
.wrap{max-width:480px;margin:0 auto;min-height:100dvh;display:flex;flex-direction:column;padding:0 0.5rem}
.hdr{padding:0.8rem 0.5rem;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:var(--bg);z-index:10}
.hdr h1{font-size:1.4rem;font-weight:700;letter-spacing:-0.02em}
.hdr .back{font-size:0.92rem;color:var(--dim);display:flex;align-items:center;gap:0.2rem}
.live{display:flex;align-items:center;gap:0.3rem;font-size:0.88rem;color:var(--dim)}
.pulse{width:6px;height:6px;border-radius:50%;background:var(--now);transition:opacity 0.3s}
main{flex:1}

/* Landing — station cards */
.scard{display:flex;align-items:center;gap:0.6rem;padding:0.75rem;margin:0 0 0.4rem;background:var(--card);border-radius:var(--radius-sm);box-shadow:var(--shadow);transition:background 0.15s}
.scard:active{background:var(--card-hover)}
.sdots{display:flex;flex-direction:column;gap:0.2rem;flex-shrink:0}
.ldot{display:block;width:8px;height:8px;border-radius:50%}
.sinfo{flex:1;min-width:0}
.sname{font-size:0.95rem;font-weight:600;margin-bottom:0.25rem}
.pills{display:flex;gap:0.3rem;flex-wrap:wrap}
.dp{display:inline-flex;align-items:center;gap:0.2rem;padding:0.2rem 0.45rem;border-radius:6px;background:var(--bg);font-size:0.88rem}
.dp-arrow{color:var(--dim);font-weight:600;font-size:0.88rem}
.dp-val{font-weight:700;font-variant-numeric:tabular-nums;font-size:0.88rem}
.dp-now .dp-val{color:var(--now)}

/* Station detail — arrival list */
.acard{display:flex;align-items:center;gap:0.5rem;padding:0.7rem 0.75rem;margin:0 0 0.35rem;background:var(--card);border-radius:var(--radius-sm);box-shadow:var(--shadow)}
.acard:active{background:var(--card-hover)}
.dbadge{font-size:0.88rem;font-weight:700;color:var(--dim);min-width:1.8rem;flex-shrink:0}
.lp{display:inline-flex;align-items:center;justify-content:center;width:1.6rem;height:1.6rem;border-radius:50%;font-size:0.88rem;font-weight:700;color:#fff;flex-shrink:0}
.adest{flex:1;font-size:0.92rem;font-weight:500;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.atime{text-align:right;min-width:3rem;flex-shrink:0}
.t-min{font-size:1.2rem;font-weight:700;font-variant-numeric:tabular-nums}
.t-unit{font-size:0.88rem;color:var(--dim);margin-left:0.1rem}
.t-now{font-size:0.95rem;font-weight:700;color:var(--now)}

/* Train timeline */
.thdr{padding:1.2rem 0.5rem 0.8rem;text-align:center}
.thdr .tid{font-size:0.88rem;color:var(--dim);display:flex;align-items:center;justify-content:center;gap:0.4rem}
.thdr .tdest{font-size:1.3rem;font-weight:700;margin-top:0.3rem}
.timeline{padding:0.5rem 0 0.5rem 2.2rem;position:relative;margin:0 0.5rem}
.timeline::before{content:'';position:absolute;left:0.85rem;top:0;bottom:0;width:3px;border-radius:2px}
.tstop{position:relative;padding:0.55rem 0.6rem;display:flex;align-items:center;gap:0.5rem}
.tstop .dot{position:absolute;left:-1.55rem;width:14px;height:14px;border-radius:50%;border:3px solid;background:var(--bg);z-index:1}
.tstop.here .dot{background:currentColor}
.tstop.passed .dot{opacity:0.4}
.tstop .tsname{flex:1;font-size:0.92rem;font-weight:500}
.tstop.passed .tsname{color:var(--dim)}
.tstop .tswait{font-size:0.92rem;font-weight:700;font-variant-numeric:tabular-nums;min-width:3rem;text-align:right}
.tstop.here .tswait{color:var(--now)}
.tstop.passed .tswait{color:var(--dim);font-weight:400}

.empty{padding:2rem;text-align:center;color:var(--dim);font-size:0.95rem}
.foot{padding:1rem 0.5rem;text-align:center;font-size:0.88rem;color:var(--dim)}
.foot a{color:var(--dim);text-decoration:underline;text-underline-offset:2px}

@media(min-width:481px){.wrap{padding:0}}
</style>`;

// ── Shell ──
function shell(title: string, body: string, back?: string, partial = false): string {
  if (partial) return body;
  const backLink = back ? `<a class="back" href="${back}">‹ Back</a>` : `<span></span>`;
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${title} — MARTA Rail</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🚇</text></svg>">
${CSS}</head><body>
<div class="wrap">
<header class="hdr">
${backLink}
<h1>${title}</h1>
<div class="live"><div class="pulse" id="pulse"></div><span id="age"></span></div>
</header>
<main id="rail-body">${body}</main>
<footer class="foot">MARTA Rail · <a href="https://bus.marta.io">Bus</a> · <a href="https://home.jake.town">home.jake.town</a></footer>
</div>
${POLL_JS}</body></html>`;
}

// ── Landing View ──
export async function landingView(partial = false): Promise<string> {
  const arrivals = await fetchArrivals();
  const grouped = byStation(arrivals);

  const stations = [...grouped.entries()]
    .map(([name, arrs]) => {
      const lines = [...stationLines(arrs)].sort();
      const byDir = new Map<string, RailArrival>();
      for (const a of arrs) {
        const cur = byDir.get(a.direction);
        if (!cur || a.waitSeconds < cur.waitSeconds) byDir.set(a.direction, a);
      }
      const dirOrder = ["N", "S", "E", "W"];
      const dirs = dirOrder
        .filter((d) => byDir.has(d))
        .map((d) => {
          const a = byDir.get(d)!;
          return dirPill(d, Math.floor(a.waitSeconds / 60), a.waitSeconds <= 30);
        });
      const soonest = arrs.reduce((m, a) => (a.waitSeconds < m.waitSeconds ? a : m), arrs[0]);
      return { name, lines, dirs, soonest, slug: stationSlug(name) };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  let html = "";
  for (const s of stations) {
    const dots = s.lines.map((l) => lineDot(l)).join("");
    html += `<a href="/rail-b/${s.slug}" class="scard">
<div class="sdots">${dots}</div>
<div class="sinfo">
<div class="sname">${stationDisplayName(s.name)}</div>
<div class="pills">${s.dirs.join("")}</div>
</div>
</a>`;
  }
  if (!html) html = `<div class="empty">No trains running</div>`;

  return shell("Stations", html, undefined, partial);
}

// ── Station View ──
export async function stationView(slug: string, partial = false): Promise<string | null> {
  const arrivals = await fetchArrivals();
  const grouped = byStation(arrivals);

  let stationName = "";
  let stationArrivals: RailArrival[] = [];
  for (const [name, arrs] of grouped) {
    if (stationSlug(name) === slug) {
      stationName = name;
      stationArrivals = arrs;
      break;
    }
  }
  if (!stationName) return null;

  stationArrivals.sort((a, b) => a.waitSeconds - b.waitSeconds);

  let html = "";
  for (const a of stationArrivals) {
    html += `<a href="/rail-b/train/${a.trainId}" class="acard">
${dirBadge(a.direction)}
${linePill(a.line)}
<span class="adest">${a.destination}</span>
<span class="atime">${timeDisplay(a)}</span>
</a>`;
  }
  if (!html) html = `<div class="empty">No arrivals</div>`;

  return shell(stationDisplayName(stationName), html, "/rail", partial);
}

// ── Train View ──
export async function trainView(trainId: string, partial = false): Promise<string | null> {
  const arrivals = await fetchArrivals();
  const trainArrivals = arrivals.filter((a) => a.trainId === trainId);
  if (!trainArrivals.length) return null;

  const first = trainArrivals[0];
  const lineColor = LINE_COLORS[first.line] || "#888";
  const lineStations = LINE_STATIONS[first.line] || [];

  const arrivalMap = new Map<string, RailArrival>();
  for (const a of trainArrivals) arrivalMap.set(a.station, a);

  const ordered = lineStations.filter((s) => arrivalMap.has(s));
  const hereIdx = ordered.findIndex((s) => arrivalMap.get(s)!.waitSeconds <= 30);

  const arrows: Record<string, string> = { N: "↑", S: "↓", E: "→", W: "←" };
  let html = `<div class="thdr">
<div class="tid">${linePill(first.line)} <span>Train ${trainId}</span></div>
<div class="tdest">${arrows[first.direction] || ""} ${first.destination}</div>
</div>
<div class="timeline" style="--lc:${lineColor}">
<style>.timeline::before{background:${lineColor}20}.tstop .dot{border-color:${lineColor};color:${lineColor}}</style>`;

  for (let i = 0; i < ordered.length; i++) {
    const s = ordered[i];
    const a = arrivalMap.get(s)!;
    const isHere = a.waitSeconds <= 30;
    const isPassed = hereIdx >= 0 && i < hereIdx;
    const cls = isHere ? "tstop here" : isPassed ? "tstop passed" : "tstop";
    const waitText = isHere ? "Now" : `${Math.floor(a.waitSeconds / 60)}m`;

    html += `<div class="${cls}">
<div class="dot"></div>
<span class="tsname">${stationDisplayName(s)}</span>
<span class="tswait">${waitText}</span>
</div>`;
  }

  html += `</div>`;
  return shell(`Train ${trainId}`, html, "/rail", partial);
}
