// Rail Views D — "Pill-First"
// Inspired by marta.io's chunky direction pills. The pills ARE the UI.
// Big touch targets, line-colored direction circles, :XX times.
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

// Which line(s) go in each direction at a given station
// Returns the "best" line color for a direction at a station
function dirLineColor(dir: string, arrs: RailArrival[]): string {
  // Find the soonest arrival for this direction and use its line color
  const forDir = arrs.filter((a) => a.direction === dir);
  if (!forDir.length) return "#666";
  forDir.sort((a, b) => a.waitSeconds - b.waitSeconds);
  return LINE_COLORS[forDir[0].line] || "#666";
}

// ── Polling JS ──
const POLL_JS = `<script>
(function(){
  var b=document.getElementById('rail-body');
  if(!b)return;
  var st=Date.now(),dot=document.getElementById('pulse');
  function tick(){
    var el=document.getElementById('age');
    if(el)el.textContent=Math.floor((Date.now()-st)/1000)+'s ago';
  }
  function poll(){
    var x=new XMLHttpRequest();
    x.open('GET',location.pathname+'?partial=1');
    x.onload=function(){
      if(x.status===200){
        b.innerHTML=x.responseText;
        st=Date.now();
        if(dot){dot.style.opacity='1';setTimeout(function(){dot.style.opacity='0.3'},300)}
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
  --bg:#1a1a2e;--surface:#252540;--pill:#2d2d48;--pill-hover:#363658;
  --text:#e8e8f0;--dim:#8888a8;--border:rgba(255,255,255,0.05);
  --now:#2ecc40;--arriving:#2ecc40;
  --sans:-apple-system,system-ui,'SF Pro Display','Segoe UI',sans-serif;
  --mono:'SF Mono',Consolas,monospace;
}
@media(prefers-color-scheme:light){
  :root{
    --bg:#f0f0f5;--surface:#fff;--pill:#dddde8;--pill-hover:#d0d0da;
    --text:#1a1a2e;--dim:#686888;--border:rgba(0,0,0,0.08);
    --now:#1a9e32;--arriving:#1a9e32;
  }
}
body{background:var(--bg);color:var(--text);font-family:var(--sans);-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%}
a{color:inherit;text-decoration:none}
.wrap{max-width:480px;margin:0 auto;min-height:100dvh;display:flex;flex-direction:column}
.hdr{padding:1rem;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:var(--bg);z-index:10}
.hdr h1{font-size:1.3rem;font-weight:700}
.hdr .back{font-size:0.92rem;color:var(--dim)}
.live{display:flex;align-items:center;gap:0.3rem;font-size:0.88rem;color:var(--dim)}
.pulse{width:6px;height:6px;border-radius:50%;background:var(--now);transition:opacity 0.3s}
main{flex:1;padding:0 0.75rem}

/* ── Landing: Station rows with big pills ── */
.st{display:flex;align-items:center;padding:0.7rem 0;border-bottom:1px solid var(--border);gap:0.5rem}
.st-name{font-size:1.05rem;font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.st-pills{display:flex;gap:0.35rem;flex-wrap:wrap;justify-content:flex-end;flex-shrink:0;max-width:65%}

/* THE pill — chunky capsule, CLEARLY visible background */
.pill{display:inline-flex;align-items:center;gap:0;background:#4e4e6a;border-radius:999px;overflow:hidden;height:2.6rem;transition:background 0.15s}
.pill:active{background:#5e5e7a}
.pill-dir{display:flex;align-items:center;justify-content:center;width:2.1rem;height:2.1rem;border-radius:50%;margin:0.25rem;color:#fff;font-weight:700;font-size:1rem;flex-shrink:0}
.pill-time{font-family:var(--mono);font-size:1.1rem;font-weight:700;padding:0 0.75rem 0 0.2rem;color:#fff;font-variant-numeric:tabular-nums;white-space:nowrap}
.pill-now{color:var(--arriving);font-weight:700}
.pill-icon{font-size:1.15rem;padding:0 0.6rem 0 0.15rem}

/* ── Station detail: arrival rows ── */
.arr{display:flex;align-items:center;gap:0.6rem;padding:0.65rem 0;border-bottom:1px solid var(--border)}
.arr:active{opacity:0.7}
.arr-pill{display:inline-flex;align-items:center;gap:0;background:var(--pill);border-radius:999px;overflow:hidden;height:2.2rem;flex-shrink:0}
.arr-pill .pill-dir{width:1.7rem;height:1.7rem;font-size:0.88rem;margin:0.25rem}
.arr-pill .lbl{font-size:0.88rem;font-weight:600;color:#fff;padding:0 0.5rem 0 0.15rem}
.arr-dest{flex:1;font-size:0.95rem;font-weight:500;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.arr-time{font-family:var(--mono);font-size:1.15rem;font-weight:700;font-variant-numeric:tabular-nums;min-width:3rem;text-align:right;flex-shrink:0}
.arr-time.now{color:var(--arriving)}

/* ── Train timeline ── */
.thdr{padding:0.75rem 0;text-align:center;border-bottom:1px solid var(--border)}
.thdr .tid{font-size:0.88rem;color:var(--dim)}
.thdr .tdest{font-size:1.25rem;font-weight:700;margin:0.2rem 0}
.thdr .tpill{display:inline-flex;align-items:center;gap:0;background:var(--pill);border-radius:999px;height:2rem;margin-bottom:0.4rem}
.thdr .tpill .pill-dir{width:1.6rem;height:1.6rem;font-size:0.88rem;margin:0.2rem}
.thdr .tpill .tplbl{font-size:0.88rem;font-weight:600;color:var(--text);padding:0 0.6rem 0 0.15rem}

.tl{position:relative;padding:0.5rem 0 0.5rem 2.5rem}
.tl-line{position:absolute;left:1.45rem;top:0;bottom:0;width:3px;border-radius:2px}
.ts{position:relative;padding:0.5rem 0;display:flex;align-items:center;gap:0.5rem}
.ts .dot{position:absolute;left:-1.3rem;width:14px;height:14px;border-radius:50%;border:3px solid;background:var(--bg);z-index:1}
.ts.here .dot{background:currentColor}
.ts.passed{opacity:0.35}
.ts .tsn{flex:1;font-size:0.95rem;font-weight:500}
.ts .tsw{font-family:var(--mono);font-size:0.95rem;font-weight:700;font-variant-numeric:tabular-nums;min-width:3rem;text-align:right}
.ts.here .tsw{color:var(--arriving)}

.empty{padding:2rem;text-align:center;color:var(--dim);font-size:0.95rem}
.foot{padding:0.8rem;text-align:center;font-size:0.88rem;color:var(--dim);margin-top:auto}
.foot a{color:var(--dim);text-decoration:underline;text-underline-offset:2px}

@media(min-width:481px){.wrap{padding:0 0.75rem}}
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

// ── Build a single pill ──
function buildPill(dir: string, waitSeconds: number, lineColor: string): string {
  const arriving = waitSeconds <= 30;
  const mins = Math.floor(waitSeconds / 60);
  const timeStr = arriving
    ? `<span class="pill-icon">🚇</span>`
    : `<span class="pill-time">:${String(mins).padStart(2, "0")}</span>`;
  return `<span class="pill">
<span class="pill-dir" style="background:${lineColor}">${dir}</span>
${timeStr}
</span>`;
}

// ── Landing View ──
export async function landingView(partial = false): Promise<string> {
  const arrivals = await fetchArrivals();
  const grouped = byStation(arrivals);

  const stations = [...grouped.entries()]
    .map(([name, arrs]) => {
      // Per-direction: soonest arrival + its line color
      const byDir = new Map<string, { arrival: RailArrival; color: string }>();
      for (const a of arrs) {
        const cur = byDir.get(a.direction);
        if (!cur || a.waitSeconds < cur.arrival.waitSeconds) {
          byDir.set(a.direction, {
            arrival: a,
            color: LINE_COLORS[a.line] || "#666",
          });
        }
      }
      const soonest = arrs.reduce((m, a) => (a.waitSeconds < m.waitSeconds ? a : m), arrs[0]);
      return { name, byDir, soonest, slug: stationSlug(name) };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  let html = "";
  const dirOrder = ["N", "S", "E", "W"];

  for (const s of stations) {
    const pills = dirOrder
      .filter((d) => s.byDir.has(d))
      .map((d) => {
        const { arrival, color } = s.byDir.get(d)!;
        return buildPill(d, arrival.waitSeconds, color);
      })
      .join("");

    html += `<a href="/rail-d/${s.slug}" class="st">
<span class="st-name">${stationDisplayName(s.name)}</span>
<span class="st-pills">${pills}</span>
</a>`;
  }
  if (!html) html = `<div class="empty">No data available</div>`;

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

  // Sort soonest-first
  stationArrivals.sort((a, b) => a.waitSeconds - b.waitSeconds);

  let html = "";
  for (const a of stationArrivals) {
    const lc = LINE_COLORS[a.line] || "#666";
    const arriving = a.waitSeconds <= 30;
    const mins = Math.floor(a.waitSeconds / 60);
    const timeHtml = arriving
      ? `<span class="arr-time now">Now</span>`
      : `<span class="arr-time">:${String(mins).padStart(2, "0")}</span>`;
    const arrows: Record<string, string> = { N: "↑", S: "↓", E: "→", W: "←" };

    html += `<a href="/rail-d/train/${a.trainId}" class="arr">
<span class="arr-pill"><span class="pill-dir" style="background:${lc}">${a.direction}</span><span class="lbl" style="background:${lc}">${a.line}</span></span>
<span class="arr-dest">${arrows[a.direction] || ""} ${a.destination}</span>
${timeHtml}
</a>`;
  }
  if (!html) html = `<div class="empty">No arrivals</div>`;

  return shell(stationDisplayName(stationName), html, "/rail-d", partial);
}

// ── Train View ──
export async function trainView(trainId: string, partial = false): Promise<string | null> {
  const arrivals = await fetchArrivals();
  const trainArrivals = arrivals.filter((a) => a.trainId === trainId);
  if (!trainArrivals.length) return null;

  const first = trainArrivals[0];
  const lineColor = LINE_COLORS[first.line] || "#666";
  const lineStations = LINE_STATIONS[first.line] || [];

  const arrivalMap = new Map<string, RailArrival>();
  for (const a of trainArrivals) arrivalMap.set(a.station, a);

  const ordered = lineStations.filter((s) => arrivalMap.has(s));
  const hereIdx = ordered.findIndex((s) => arrivalMap.get(s)!.waitSeconds <= 30);

  const arrows: Record<string, string> = { N: "↑", S: "↓", E: "→", W: "←" };

  let html = `<div class="thdr">
<div class="tpill"><span class="pill-dir" style="background:${lineColor}">${first.direction}</span><span class="tplbl">${first.line} #${trainId}</span></div>
<div class="tdest">${arrows[first.direction] || ""} ${first.destination}</div>
</div>
<div class="tl">
<div class="tl-line" style="background:${lineColor}25"></div>`;

  for (let i = 0; i < ordered.length; i++) {
    const s = ordered[i];
    const a = arrivalMap.get(s)!;
    const isHere = a.waitSeconds <= 30;
    const isPassed = hereIdx >= 0 && i < hereIdx;
    const cls = isHere ? "ts here" : isPassed ? "ts passed" : "ts";
    const waitText = isHere ? "🚇" : `:${String(Math.floor(a.waitSeconds / 60)).padStart(2, "0")}`;

    html += `<div class="${cls}">
<div class="dot" style="border-color:${lineColor};${isHere ? "background:" + lineColor + ";color:" + lineColor : ""}"></div>
<span class="tsn">${stationDisplayName(s)}</span>
<span class="tsw">${waitText}</span>
</div>`;
  }

  html += `</div>`;
  return shell(`Train ${trainId}`, html, "/rail-d", partial);
}
