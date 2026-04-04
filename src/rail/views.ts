// Rail HTML views — server-rendered, zero dependencies
import {
  fetchArrivals,
  byStation,
  stationSlug,
  stationDisplayName,
  stationLines,
  type RailArrival,
} from "./api";

const LINE_COLORS: Record<string, string> = {
  GOLD: "#c9a227",
  RED: "#cc3333",
  BLUE: "#0074d9",
  GREEN: "#2ecc40",
};

// Station ordering by line (south to north / west to east)
const LINE_STATIONS: Record<string, string[]> = {
  RED: [
    "AIRPORT STATION", "COLLEGE PARK STATION", "EAST POINT STATION",
    "LAKEWOOD STATION", "OAKLAND CITY STATION", "WEST END STATION",
    "GARNETT STATION", "FIVE POINTS STATION", "PEACHTREE CENTER STATION",
    "CIVIC CENTER STATION", "NORTH AVE STATION", "MIDTOWN STATION",
    "ARTS CENTER STATION", "LINDBERGH STATION", "BUCKHEAD STATION",
    "MEDICAL CENTER STATION", "DUNWOODY STATION", "SANDY SPRINGS STATION",
    "NORTH SPRINGS STATION",
  ],
  GOLD: [
    "AIRPORT STATION", "COLLEGE PARK STATION", "EAST POINT STATION",
    "LAKEWOOD STATION", "OAKLAND CITY STATION", "WEST END STATION",
    "GARNETT STATION", "FIVE POINTS STATION", "PEACHTREE CENTER STATION",
    "CIVIC CENTER STATION", "NORTH AVE STATION", "MIDTOWN STATION",
    "ARTS CENTER STATION", "LINDBERGH STATION", "LENOX STATION",
    "BROOKHAVEN STATION", "CHAMBLEE STATION", "DORAVILLE STATION",
  ],
  BLUE: [
    "HAMILTON E HOLMES STATION", "WEST LAKE STATION", "ASHBY STATION",
    "VINE CITY STATION", "OMNI DOME STATION", "FIVE POINTS STATION",
    "GEORGIA STATE STATION", "KING MEMORIAL STATION", "INMAN PARK STATION",
    "EDGEWOOD CANDLER PARK STATION", "EAST LAKE STATION",
    "DECATUR STATION", "AVONDALE STATION", "KENSINGTON STATION",
    "INDIAN CREEK STATION",
  ],
  GREEN: [
    "BANKHEAD STATION", "ASHBY STATION", "VINE CITY STATION",
    "OMNI DOME STATION", "FIVE POINTS STATION", "GEORGIA STATE STATION",
    "KING MEMORIAL STATION", "INMAN PARK STATION",
    "EDGEWOOD CANDLER PARK STATION",
  ],
};

function lineDot(line: string, size = "0.5rem"): string {
  const c = LINE_COLORS[line] || "#888";
  return `<span style="display:inline-block;width:${size};height:${size};border-radius:50%;background:${c};flex-shrink:0" aria-label="${line} line"></span>`;
}

function linePill(line: string): string {
  const c = LINE_COLORS[line] || "#888";
  return `<span class="lp" style="background:${c}">${line}</span>`;
}

function dirLabel(dir: string, dest: string): string {
  const arrow: Record<string, string> = { N: "↑", S: "↓", E: "→", W: "←" };
  return `${arrow[dir] || ""} ${dest}`;
}

function timeDisplay(a: RailArrival): string {
  if (a.waitSeconds <= 30) return `<span class="arr">Arriving</span>`;
  const min = Math.floor(a.waitSeconds / 60);
  if (min < 1) return `<span class="arr">&lt;1 min</span>`;
  return `<span class="eta">${min}</span><span class="unit">min</span>`;
}

function freshness(arrivals: RailArrival[]): string {
  if (!arrivals.length) return "";
  // All share the same EVENT_TIME
  return arrivals[0].eventTime;
}

// ── Micro-poll JS (inline, ~600 bytes minified) ──
const POLL_JS = `<script>
(function(){
  var b=document.getElementById('rail-body');
  if(!b)return;
  var iv=10000,st=Date.now(),dot=document.getElementById('pulse');
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
  setInterval(poll,iv);
  setInterval(tick,1000);
})();
</script>`;

// ── CSS (inline, all of it) ──
const CSS = `<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0c0c0c;--card:#151515;--text:#d4d0c8;--dim:#8a8478;--border:#222;--coral:#e8725a}
body{background:var(--bg);color:var(--text);font-family:-apple-system,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
.wrap{max-width:480px;margin:0 auto;min-height:100dvh;display:flex;flex-direction:column}
.hdr{padding:0.8rem 1rem;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);position:sticky;top:0;background:var(--bg);z-index:10}
.hdr h1{font-size:0.95rem;font-weight:600;letter-spacing:0.03em}
.hdr a.back{font-size:0.85rem;color:var(--dim)}
.live{display:flex;align-items:center;gap:0.4rem;font-size:0.75rem;color:var(--dim)}
.pulse{width:6px;height:6px;border-radius:50%;background:var(--coral);transition:opacity 0.3s}
main{flex:1;padding:0.5rem 0}
.sec{padding:0.6rem 1rem 0.3rem;font-size:0.7rem;font-weight:600;color:var(--dim);text-transform:uppercase;letter-spacing:0.08em}
.st{display:flex;align-items:center;gap:0.6rem;padding:0.7rem 1rem;border-bottom:1px solid var(--border)}
.st:active{background:var(--card)}
.st .dots{display:flex;gap:0.25rem;flex-shrink:0}
.st .name{flex:1;font-size:0.92rem;font-weight:500}
.st .next{font-size:0.85rem;color:var(--coral);font-weight:600;font-variant-numeric:tabular-nums}
.st .next .unit{font-size:0.7rem;font-weight:400;color:var(--dim);margin-left:0.15rem}
.dir-hdr{padding:0.8rem 1rem 0.3rem;font-size:0.82rem;font-weight:600;color:var(--text);display:flex;align-items:center;gap:0.4rem}
.arr-row{display:flex;align-items:center;gap:0.6rem;padding:0.6rem 1rem;border-bottom:1px solid var(--border)}
.arr-row .line-info{display:flex;align-items:center;gap:0.4rem;flex:1;min-width:0}
.lp{font-size:0.6rem;font-weight:700;color:#fff;padding:0.15rem 0.4rem;border-radius:3px;letter-spacing:0.04em}
.arr-row .dest{font-size:0.88rem;font-weight:400;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.arr-row .time{text-align:right;min-width:3.5rem;flex-shrink:0}
.eta{font-size:1.1rem;font-weight:700;color:var(--coral);font-variant-numeric:tabular-nums}
.arr{font-size:0.82rem;font-weight:600;color:#2ecc40}
.unit{font-size:0.7rem;color:var(--dim);margin-left:0.1rem}
.train-hdr{padding:1rem;text-align:center}
.train-hdr .tid{font-size:0.8rem;color:var(--dim)}
.train-hdr .dest-big{font-size:1.3rem;font-weight:700;margin:0.3rem 0}
.stop-list .stop{display:flex;align-items:center;gap:0.7rem;padding:0.5rem 1rem;font-size:0.88rem}
.stop .marker{width:12px;height:12px;border-radius:50%;border:2px solid;flex-shrink:0}
.stop .sname{flex:1}
.stop .swait{font-size:0.85rem;color:var(--coral);font-weight:600;font-variant-numeric:tabular-nums;min-width:3rem;text-align:right}
.stop.arrived .sname{color:var(--dim)}
.empty{padding:2rem 1rem;text-align:center;color:var(--dim);font-size:0.9rem}
.foot{padding:1rem;text-align:center;font-size:0.7rem;color:var(--dim);border-top:1px solid var(--border)}
.foot a{color:var(--coral);border-bottom:1px solid transparent}
.foot a:hover{border-color:var(--coral)}
@media(min-width:481px){.wrap{border-left:1px solid var(--border);border-right:1px solid var(--border)}}
</style>`;

function shell(title: string, body: string, backHref?: string, partial = false): string {
  if (partial) return body;
  const backLink = backHref
    ? `<a class="back" href="${backHref}">← Back</a>`
    : `<span></span>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${title} — MARTA Rail</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🚇</text></svg>">
${CSS}
</head>
<body>
<div class="wrap">
<header class="hdr">
${backLink}
<h1>${title}</h1>
<div class="live"><div class="pulse" id="pulse"></div><span id="age"></span></div>
</header>
<main id="rail-body">
${body}
</main>
<footer class="foot">MARTA Rail · <a href="https://bus.marta.io">Bus Tracker</a> · <a href="/about">About marta.io</a></footer>
</div>
${POLL_JS}
</body>
</html>`;
}

// ── View: Station List (landing) ──
export async function landingView(partial = false): Promise<string> {
  const arrivals = await fetchArrivals();
  const grouped = byStation(arrivals);
  
  // If no arrivals and no cached data, show an error state
  if (!arrivals.length && grouped.size === 0) {
    let html = `<div class="empty">Unable to reach MARTA's real-time API. Data will appear automatically once connectivity is restored.</div>`;
    return shell("Stations", html, undefined, partial);
  }

  // Build station list with next arrival time and serving lines
  const stations = [...grouped.entries()]
    .map(([name, arrs]) => {
      const lines = [...stationLines(arrs)].sort();
      const soonest = arrs.reduce((min, a) => 
        a.waitSeconds < min.waitSeconds ? a : min, arrs[0]);
      return { name, lines, soonest, slug: stationSlug(name) };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  let html = `<div class="sec">All Stations</div>`;
  for (const s of stations) {
    const dots = s.lines.map((l) => lineDot(l)).join("");
    const min = Math.floor(s.soonest.waitSeconds / 60);
    const nextText = s.soonest.waitSeconds <= 30
      ? `<span style="color:#2ecc40;font-size:0.82rem">Now</span>`
      : `${min}<span class="unit">min</span>`;
    html += `<a href="/rail/${s.slug}" class="st">
      <span class="dots">${dots}</span>
      <span class="name">${stationDisplayName(s.name)}</span>
      <span class="next">${nextText}</span>
    </a>`;
  }

  return shell("Stations", html, undefined, partial);
}

// ── View: Station Detail ──
export async function stationView(slug: string, partial = false): Promise<string | null> {
  const arrivals = await fetchArrivals();
  if (!arrivals.length) return null;
  const grouped = byStation(arrivals);

  // Find matching station
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

  // Group by direction
  const byDir = new Map<string, RailArrival[]>();
  for (const a of stationArrivals) {
    const key = `${a.direction}|${a.destination}`;
    const list = byDir.get(key) || [];
    list.push(a);
    byDir.set(key, list);
  }

  let html = "";
  // Sort directions
  const dirOrder = ["N", "S", "E", "W"];
  const sorted = [...byDir.entries()].sort((a, b) => {
    const da = a[0].split("|")[0], db = b[0].split("|")[0];
    return dirOrder.indexOf(da) - dirOrder.indexOf(db);
  });

  for (const [key, arrs] of sorted) {
    const [dir, dest] = key.split("|");
    arrs.sort((a, b) => a.waitSeconds - b.waitSeconds);
    html += `<div class="dir-hdr">${dirLabel(dir, dest)}</div>`;
    for (const a of arrs) {
      html += `<a href="/rail/train/${a.trainId}" class="arr-row">
        <div class="line-info">${linePill(a.line)}<span class="dest">${a.destination}</span></div>
        <div class="time">${timeDisplay(a)}</div>
      </a>`;
    }
  }

  if (!html) html = `<div class="empty">No arrivals</div>`;

  return shell(stationDisplayName(stationName), html, "/rail", partial);
}

// ── View: Train Detail ──
export async function trainView(trainId: string, partial = false): Promise<string | null> {
  const arrivals = await fetchArrivals();
  const trainArrivals = arrivals
    .filter((a) => a.trainId === trainId)
    .sort((a, b) => a.waitSeconds - b.waitSeconds);

  if (!trainArrivals.length) return null;

  const first = trainArrivals[0];
  const lineColor = LINE_COLORS[first.line] || "#888";

  let html = `<div class="train-hdr">
    <div class="tid">${linePill(first.line)} Train #${first.trainId}</div>
    <div class="dest-big">${dirLabel(first.direction, first.destination)}</div>
  </div>
  <div class="stop-list">`;

  for (const a of trainArrivals) {
    const arrived = a.waitSeconds <= 30;
    html += `<div class="stop${arrived ? " arrived" : ""}">
      <div class="marker" style="border-color:${lineColor}${arrived ? ";background:" + lineColor : ""}"></div>
      <span class="sname">${stationDisplayName(a.station)}</span>
      <span class="swait">${arrived ? "Now" : Math.floor(a.waitSeconds / 60) + " min"}</span>
    </div>`;
  }

  html += `</div>`;
  return shell(`Train ${trainId}`, html, "/rail", partial);
}

// About section CSS — appended inside a <style> tag on the about page
const ABOUT_CSS = `.about-section{padding:1rem;border-bottom:1px solid var(--border)}
.about-section:last-child{border-bottom:none}
.about-section h2{font-size:0.85rem;font-weight:600;color:var(--coral);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.6rem}
.about-section p,.about-section li{font-size:0.88rem;color:var(--text);line-height:1.6;margin-bottom:0.5rem}
.about-section ul{padding-left:1.2rem}
.about-section li{margin-bottom:0.3rem}
.about-section strong{color:var(--text)}
.about-section a{color:var(--coral);border-bottom:1px solid transparent}
.about-section a:hover{border-color:var(--coral)}
.about-tag{display:inline-block;font-size:0.65rem;font-weight:700;padding:0.2rem 0.45rem;border-radius:3px;margin:0.15rem;background:#222;color:var(--dim);letter-spacing:0.04em}
.about-muted{font-size:0.8rem;color:var(--dim);margin-top:0.5rem}
.about-stat-row{display:flex;gap:1rem;flex-wrap:wrap;margin:0.5rem 0}
.about-stat{text-align:center;flex:1;min-width:4rem}
.about-stat .n{font-size:1.1rem;font-weight:700;color:var(--coral)}
.about-stat .l{font-size:0.7rem;color:var(--dim)}
.about-links .card{display:flex;align-items:center;gap:0.6rem;padding:0.6rem;border-radius:6px;background:var(--card);margin-bottom:0.4rem}
.about-links .card .ico{font-size:1.1rem}
.about-links .card .t{font-size:0.88rem;font-weight:600}
.about-links .card .d{font-size:0.75rem;color:var(--dim)}`;

// ── About view — static shell, no polling, no partial support ──
export function aboutView(): string {
  const body = `
<style>${ABOUT_CSS}</style>
<div class="about-section">
  <h2>What is this?</h2>
  <p>A real-time MARTA rail tracker — all 38 stations, live arrivals, train positions, and ETA predictions. Tap any station to see what's coming, tap a train to watch its run.</p>
  <p>Designed for the way people actually ride the train — see what's coming, plan your walk, get on.</p>
</div>
<div class="about-section">
  <h2>How it was made</h2>
  <p>This app was written almost entirely by an AI agent. The architecture, data pipeline, UI design, and nearly every line of code was authored by <strong>Clatis</strong>, an AI running on <a href="https://openclaw.ai" target="_blank" rel="noopener">OpenClaw</a> (Claude under the hood).</p>
  <p>The human half is <strong>Jake</strong>, a web developer in Atlanta who's been maintaining <a href="https://marta.io" target="_blank" rel="noopener">marta.io</a> for over a decade. Jake directed the product — what to build, how it should feel, when something was wrong — and did QA on his phone while riding actual trains. Clatis did the rest.</p>
</div>
<div class="about-section">
  <h2>By the numbers</h2>
  <div class="about-stat-row">
    <div class="about-stat"><div class="n">38</div><div class="l">stations</div></div>
    <div class="about-stat"><div class="n">4</div><div class="l">lines</div></div>
    <div class="about-stat"><div class="n">~45</div><div class="l">trains</div></div>
    <div class="about-stat"><div class="n">&lt;1</div><div class="l">dependencies</div></div>
  </div>
</div>
<div class="about-section">
  <h2>Updates</h2>
  <div style="margin-bottom:0.5rem">
    <div style="font-size:0.75rem;color:var(--dim)">Apr 4</div>
    <div style="font-size:0.88rem;color:var(--text);line-height:1.5"><strong>API downtime handling.</strong> MARTA's rail real-time API occasionally goes unreachable. Previously this would crash the rail page with a 500 error. Now the page degrades gracefully — showing the last known data or a friendly message when the feed is entirely unavailable. No more blank screens.</div>
  </div>
  <div style="margin-bottom:0.5rem">
    <div style="font-size:0.75rem;color:var(--dim)">Feb 21</div>
    <div style="font-size:0.88rem;color:var(--text);line-height:1.5"><strong>Rail tracker launched.</strong> Real-time arrivals across all 38 MARTA rail stations. Tap a station to see directions and trains, tap a train to see its stop-by-stop timeline. Dark mode, 10-second auto-polling, zero dependencies.</div>
  </div>
</div>
<div class="about-section">
  <h2>Stack</h2>
  <div>
    <span class="about-tag">Hono</span>
    <span class="about-tag">Bun</span>
    <span class="about-tag">SQLite</span>
    <span class="about-tag">JSX (no React)</span>
    <span class="about-tag">Fly.io</span>
  </div>
  <p class="about-muted">No bundler, no frontend framework, no build step — the client is inline HTML with vanilla JS polling. The server renders JSX to HTML strings via Hono on Bun. Deployed on Fly.io.</p>
</div>
<div class="about-section">
  <h2>Privacy</h2>
  <p>We don't track you. No cookies, no analytics, no third-party scripts, no data collection. The only thing stored is MARTA's public transit data.</p>
</div>
<div class="about-section">
  <h2>Data</h2>
  <p>Real-time train positions and predictions come from <a href="https://www.itsmarta.com/MARTA-Developer-resources.aspx" target="_blank" rel="noopener">MARTA's public rail API</a>, which serves live data on train locations, destinations, and arrival estimates.</p>
  <p>MARTA's API is known to be unreliable — it occasionally goes down or returns stale data. When this happens, the page will show the last successfully fetched data or a friendly error message. We're not responsible for MARTA's feed quality.</p>
</div>
<div class="about-section">
  <h2>Links</h2>
  <div class="about-links">
    <a class="card" href="https://codeberg.org/clatis/pullcord" target="_blank" rel="noopener">
      <span class="ico">📦</span>
      <div><div class="t">Source Code</div><div class="d">codeberg.org/clatis/pullcord</div></div>
    </a>
    <a class="card" href="https://codeberg.org/clatis/pullcord/issues" target="_blank" rel="noopener">
      <span class="ico">💬</span>
      <div><div class="t">Issues &amp; Feedback</div><div class="d">Bug reports and feature requests</div></div>
    </a>
    <a class="card" href="https://bus.marta.io" target="_blank" rel="noopener">
      <span class="ico">🚌</span>
      <div><div class="t">Bus Tracker</div><div class="d">Real-time MARTA bus arrivals at bus.marta.io</div></div>
    </a>
    <a class="card" href="https://www.itsmarta.com/MARTA-Developer-resources.aspx" target="_blank" rel="noopener">
      <span class="ico">🚇</span>
      <div><div class="t">MARTA Developer Resources</div><div class="d">GTFS feeds and API documentation</div></div>
    </a>
  </div>
</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>About — MARTA Rail</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🚇</text></svg>">
${CSS}
</head>
<body>
<div class="wrap">
<header class="hdr">
<a class="back" href="/rail">← Back</a>
<h1>About</h1>
<div class="live"></div>
</header>
<main>
${body}
</main>
<footer class="foot">MARTA Rail · <a href="https://bus.marta.io">Bus Tracker</a> · <a href="/about">About marta.io</a></footer>
</div>
</body>
</html>`;
}
