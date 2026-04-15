// Rail About page — the only server-rendered view left in this file.
//
// Historical note: this file used to also contain landingView / stationView /
// trainView render functions, which became orphans when the real routes moved
// to src/views/pages/Rail.tsx. Those dead implementations kept attracting
// edits from people (and AI agents) who thought they were live, including a
// font-size bump and a graceful-downtime branch that never actually ran in
// production. They've been removed; all rail rendering now lives in
// src/views/pages/Rail.tsx.

const CSS = `<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0c0c0c;--card:#151515;--text:#d4d0c8;--dim:#8a8478;--border:#222;--coral:#e8725a}
body{background:var(--bg);color:var(--text);font-family:-apple-system,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
.wrap{max-width:480px;margin:0 auto;min-height:100dvh;display:flex;flex-direction:column}
.hdr{padding:0.8rem 1rem;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);position:sticky;top:0;background:var(--bg);z-index:10}
.hdr h1{font-size:1.1rem;font-weight:600;letter-spacing:0.03em}
.hdr a.back{font-size:0.95rem;color:var(--dim)}
.live{display:flex;align-items:center;gap:0.4rem;font-size:0.82rem;color:var(--dim)}
main{flex:1;padding:0.5rem 0}
.foot{padding:1rem;text-align:center;font-size:0.82rem;color:var(--dim);border-top:1px solid var(--border)}
.foot a{color:var(--coral);border-bottom:1px solid transparent}
.foot a:hover{border-color:var(--coral)}
@media(min-width:481px){.wrap{border-left:1px solid var(--border);border-right:1px solid var(--border)}}
</style>`;

const ABOUT_CSS = `.about-section{padding:1rem;border-bottom:1px solid var(--border)}
.about-section h2{font-size:0.95rem;font-weight:600;color:var(--coral);margin-bottom:0.5rem;text-transform:uppercase;letter-spacing:0.05em}
.about-section p{font-size:0.92rem;line-height:1.55;color:var(--text);margin-bottom:0.6rem}
.about-section p:last-child{margin-bottom:0}
.about-section a{color:var(--coral);border-bottom:1px solid rgba(232,114,90,0.3)}
.about-muted{color:var(--dim);font-size:0.85rem !important}
.about-tag{display:inline-block;padding:0.2rem 0.5rem;margin:0.15rem 0.2rem 0.15rem 0;font-size:0.82rem;background:var(--card);border-radius:3px;color:var(--text)}
.about-stat-row{display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.5rem}
.about-stat{flex:1;min-width:4rem;text-align:center;padding:0.5rem;background:var(--card);border-radius:6px}
.about-stat .n{font-size:1.3rem;font-weight:700;color:var(--coral);font-variant-numeric:tabular-nums}
.about-stat .l{font-size:0.72rem;color:var(--dim);text-transform:uppercase;letter-spacing:0.05em;margin-top:0.2rem}
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
    <div style="font-size:0.75rem;color:var(--dim)">Apr 14</div>
    <div style="font-size:0.88rem;color:var(--text);line-height:1.5"><strong>Better API downtime handling.</strong> When MARTA's rail real-time feed is unreachable, every page now shows a clear banner at the top instead of a blank station list. Errors are cached for the same TTL as successes, so we don't hammer the API while it's down.</div>
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
  <p>MARTA's API is known to be unreliable — it occasionally goes down entirely. When this happens, a banner at the top of every rail page will tell you so. We're not responsible for MARTA's feed quality.</p>
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
