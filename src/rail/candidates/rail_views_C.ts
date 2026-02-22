// Rail Views C — "Dense & Fast"
// Maximum information per pixel. Power-user transit.
// Bloomberg meets departure board. Zero wasted space.
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

function lineBar(line: string): string {
  const c = LINE_COLORS[line] || "#555";
  return `<span class="lbar" style="background:${c}"></span>`;
}

function dirCell(dir: string, mins: number, arriving: boolean): string {
  if (arriving) return `<td class="dc"><span class="ddir">${dir}</span><span class="dval now">0</span></td>`;
  return `<td class="dc"><span class="ddir">${dir}</span><span class="dval">${mins}</span></td>`;
}

function linePill(line: string): string {
  const c = LINE_COLORS[line] || "#555";
  return `<span class="lp" style="background:${c}">${line}</span>`;
}

function dirTag(dir: string): string {
  const arrows: Record<string, string> = { N: "↑", S: "↓", E: "→", W: "←" };
  return `<span class="dtag">${arrows[dir] || ""}${dir}</span>`;
}

function fmtWait(secs: number): string {
  if (secs <= 30) return `<span class="now">ARR</span>`;
  const m = Math.floor(secs / 60);
  return `<span class="mins">${m}</span><span class="mlab">m</span>`;
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
  --bg:#0b0b0b;--row:#0f0f0f;--row-alt:#111;--text:#d0d0d0;--bright:#f0f0f0;
  --dim:#707070;--border:#1c1c1c;--now:#00e676;
  --mono:'SF Mono',Consolas,'Liberation Mono',monospace;
  --sans:-apple-system,system-ui,sans-serif;
}
@media(prefers-color-scheme:light){
  :root{
    --bg:#fafafa;--row:#fff;--row-alt:#f5f5f5;--text:#333;--bright:#111;
    --dim:#888;--border:#e0e0e0;--now:#00a152;
  }
}
body{background:var(--bg);color:var(--text);font-family:var(--sans);-webkit-font-smoothing:antialiased;font-size:0.92rem}
a{color:inherit;text-decoration:none}
.wrap{max-width:480px;margin:0 auto;min-height:100dvh;display:flex;flex-direction:column}
.hdr{padding:0.5rem 0.75rem;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);position:sticky;top:0;background:var(--bg);z-index:10}
.hdr h1{font-size:0.92rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em}
.hdr .back{font-size:0.88rem;color:var(--dim)}
.live{display:flex;align-items:center;gap:0.3rem;font-size:0.88rem;color:var(--dim);font-family:var(--mono)}
.pulse{width:5px;height:5px;border-radius:50%;background:var(--now);transition:opacity 0.3s}
main{flex:1}

/* Landing — dense table */
.stable{width:100%;border-collapse:collapse}
.stable tr{border-bottom:1px solid var(--border)}
.stable tr:nth-child(even){background:var(--row-alt)}
.stable tr:active{background:var(--border)}
.stable td{padding:0.45rem 0.4rem;vertical-align:middle}
.slbars{display:flex;gap:2px;flex-shrink:0}
.lbar{display:block;width:4px;height:18px;border-radius:1px}
.sn{font-size:0.92rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px}
.dc{text-align:center;white-space:nowrap;min-width:2.2rem}
.ddir{font-size:0.88rem;color:var(--dim);font-weight:600;margin-right:1px}
.dval{font-family:var(--mono);font-size:0.95rem;font-weight:700;color:var(--bright);font-variant-numeric:tabular-nums}
.dval.now{color:var(--now)}

/* Station — compact rows */
.arow{display:flex;align-items:center;gap:0.4rem;padding:0.45rem 0.75rem;border-bottom:1px solid var(--border)}
.arow:nth-child(even){background:var(--row-alt)}
.arow:active{background:var(--border)}
.dtag{font-size:0.88rem;font-weight:700;color:var(--dim);font-family:var(--mono);min-width:1.8rem;flex-shrink:0}
.lp{font-size:0.88rem;font-weight:700;color:#fff;padding:0.05rem 0.3rem;border-radius:2px;font-family:var(--mono);flex-shrink:0;line-height:1.4}
.adest{flex:1;font-size:0.92rem;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.await{text-align:right;min-width:2.5rem;flex-shrink:0;font-family:var(--mono)}
.mins{font-size:1.1rem;font-weight:700;color:var(--bright);font-variant-numeric:tabular-nums}
.mlab{font-size:0.88rem;color:var(--dim)}
.now{font-size:0.92rem;font-weight:700;color:var(--now);font-family:var(--mono)}

/* Train timeline — compact vertical */
.thdr{padding:0.6rem 0.75rem;display:flex;align-items:center;gap:0.5rem;border-bottom:1px solid var(--border)}
.thdr .tid{font-family:var(--mono);font-size:0.88rem;color:var(--dim)}
.thdr .tdest{font-size:1rem;font-weight:700;flex:1}
.tl{padding:0.3rem 0}
.ts{display:flex;align-items:center;padding:0.3rem 0.75rem 0.3rem 2rem;position:relative;min-height:2rem}
.ts::before{content:'';position:absolute;left:1.35rem;top:0;bottom:0;width:2px}
.ts:first-child::before{top:50%}
.ts:last-child::before{bottom:50%}
.ts .mk{position:absolute;left:1rem;width:10px;height:10px;border-radius:50%;border:2px solid;background:var(--bg);z-index:1}
.ts.here .mk{background:currentColor}
.ts.passed{opacity:0.4}
.ts .tn{flex:1;font-size:0.92rem}
.ts .tw{font-family:var(--mono);font-size:0.92rem;font-weight:700;font-variant-numeric:tabular-nums;min-width:2.5rem;text-align:right}
.ts.here .tw{color:var(--now)}

.empty{padding:1.5rem;text-align:center;color:var(--dim);font-size:0.92rem}
.foot{padding:0.5rem 0.75rem;text-align:center;font-size:0.88rem;color:var(--dim);border-top:1px solid var(--border)}
.foot a{color:var(--dim);text-decoration:underline}

@media(min-width:481px){.wrap{border-left:1px solid var(--border);border-right:1px solid var(--border)}}
</style>`;

// ── Shell ──
function shell(title: string, body: string, back?: string, partial = false): string {
  if (partial) return body;
  const backLink = back ? `<a class="back" href="${back}">←</a>` : `<span></span>`;
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
      return { name, lines, byDir, slug: stationSlug(name) };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // Build table — station name + direction columns
  let html = `<table class="stable">`;
  for (const s of stations) {
    const bars = s.lines.map((l) => lineBar(l)).join("");
    const dirOrder = ["N", "S", "E", "W"];
    const dirCells = dirOrder
      .map((d) => {
        const a = s.byDir.get(d);
        if (!a) return `<td class="dc"></td>`;
        return dirCell(d, Math.floor(a.waitSeconds / 60), a.waitSeconds <= 30);
      })
      .join("");
    html += `<tr onclick="location='/rail/${s.slug}'">
<td><span class="slbars">${bars}</span></td>
<td><span class="sn">${stationDisplayName(s.name)}</span></td>
${dirCells}
</tr>`;
  }
  html += `</table>`;
  if (!stations.length) html = `<div class="empty">No data</div>`;

  return shell("RAIL", html, undefined, partial);
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
    html += `<a href="/rail-c/train/${a.trainId}" class="arow">
${dirTag(a.direction)}
${linePill(a.line)}
<span class="adest">${a.destination}</span>
<span class="await">${fmtWait(a.waitSeconds)}</span>
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
  const lineColor = LINE_COLORS[first.line] || "#555";
  const lineStations = LINE_STATIONS[first.line] || [];

  const arrivalMap = new Map<string, RailArrival>();
  for (const a of trainArrivals) arrivalMap.set(a.station, a);

  const ordered = lineStations.filter((s) => arrivalMap.has(s));
  const hereIdx = ordered.findIndex((s) => arrivalMap.get(s)!.waitSeconds <= 30);

  const arrows: Record<string, string> = { N: "↑", S: "↓", E: "→", W: "←" };
  let html = `<div class="thdr">
${linePill(first.line)}
<span class="tdest">${arrows[first.direction] || ""} ${first.destination}</span>
<span class="tid">#${trainId}</span>
</div><div class="tl">`;

  for (let i = 0; i < ordered.length; i++) {
    const s = ordered[i];
    const a = arrivalMap.get(s)!;
    const isHere = a.waitSeconds <= 30;
    const isPassed = hereIdx >= 0 && i < hereIdx;
    const cls = isHere ? "ts here" : isPassed ? "ts passed" : "ts";
    const waitText = isHere ? "ARR" : `${Math.floor(a.waitSeconds / 60)}m`;

    html += `<div class="${cls}">
<div class="mk" style="border-color:${lineColor};${isHere ? "background:" + lineColor + ";color:" + lineColor : ""}"></div>
<span class="tn">${stationDisplayName(s)}</span>
<span class="tw">${waitText}</span>
</div>`;
  }

  // Inline the line color for the timeline rail
  html = `<style>.ts::before{background:${lineColor}30}</style>` + html;
  html += `</div>`;
  return shell(stationDisplayName(first.station), html, "/rail", partial);
}
