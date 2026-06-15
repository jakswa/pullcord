// Rail CSS island — self-contained, rail-prefixed, system fonts.
//
// Ported from the reimagine/ prototype (Archivo + Spline Sans Mono) but mapped
// onto system stacks to avoid shipping webfont weight. Tokens default to the
// dark ("night") theme and flip to light ("day") under prefers-color-scheme.
// Line colors are applied inline from src/data/rail-colors.ts — the single
// source of truth — so they are intentionally absent here.

export function railStyles(): string {
  return `
    *, *::before, *::after { box-sizing: border-box; }

    /* ── Design tokens ── */
    .rail-body {
      --bg: #0F0E0B;
      --glow: rgba(255, 150, 90, 0.06);
      --surface: #17150F;
      --surface2: #1E1B13;
      --hairline: rgba(236, 224, 196, 0.09);
      --text: #F2EEE3;
      --muted: #99917D;
      --faint: #685F4D;
      --chip-text: #15120B;
      --accent: #FF8E5E;
      --shadow: 0 18px 40px rgba(0, 0, 0, 0.5);
      --ui: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      --mono: ui-monospace, "SF Mono", "SFMono-Regular", "Cascadia Code", Menlo, Consolas, monospace;

      margin: 0;
      min-height: 100dvh;
      font-family: var(--ui);
      background:
        radial-gradient(120% 60% at 50% -5%, var(--glow), transparent 70%),
        var(--bg);
      color: var(--text);
      -webkit-font-smoothing: antialiased;
      overflow-x: hidden;
    }

    @media (prefers-color-scheme: light) {
      .rail-body {
        --bg: #EFEAE0;
        --glow: rgba(255, 130, 60, 0.08);
        --surface: #FAF7F0;
        --surface2: #FFFFFF;
        --hairline: rgba(46, 36, 12, 0.12);
        --text: #1C1810;
        --muted: #756C58;
        --faint: #A89F89;
        --chip-text: #17130A;
        --accent: #CC5421;
        --shadow: 0 14px 32px rgba(60, 48, 20, 0.14);
      }
    }

    .mono { font-family: var(--mono); }

    .rail-shell {
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      max-width: 480px;
      margin: 0 auto;
      width: 100%;
    }

    /* ── Header (landing wordmark + live) ── */
    .rail-header {
      padding: max(env(safe-area-inset-top), 18px) 18px 10px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .rail-header-top { display: flex; align-items: center; gap: 12px; width: 100%; }

    .rail-wordmark {
      font-weight: 900;
      font-size: 23px;
      letter-spacing: -0.04em;
      margin: 0;
      color: var(--text);
    }
    .rail-wordmark span { color: var(--muted); font-weight: 700; }

    .rail-live {
      margin-left: auto;
      font-family: var(--mono);
      font-size: 11px;
      color: var(--muted);
      display: flex;
      align-items: center;
      gap: 7px;
      letter-spacing: 0.04em;
      white-space: nowrap;
    }
    .rail-pulse {
      width: 7px; height: 7px; border-radius: 99px;
      background: var(--accent); color: var(--accent);
      display: inline-block; position: relative; flex-shrink: 0;
    }
    @media (prefers-reduced-motion: no-preference) {
      .rail-pulse::after {
        content: ""; position: absolute; inset: -3px; border-radius: 99px;
        border: 1.5px solid currentColor; opacity: 0;
        animation: rail-ping 2.4s ease-out infinite;
      }
      @keyframes rail-ping {
        0% { transform: scale(0.4); opacity: 0.8; }
        70% { transform: scale(1.6); opacity: 0; }
        100% { opacity: 0; }
      }
    }

    .rail-freshness { font-variant-numeric: tabular-nums; }

    /* ── Sub header (station / train detail) ── */
    .rail-topbar-sub { padding-bottom: 8px; align-items: center; }
    .rail-backbtn {
      appearance: none; border: none; background: none; padding: 0; cursor: pointer;
      color: var(--muted); display: flex; align-items: center; justify-content: center;
      text-decoration: none; flex-shrink: 0;
      width: 40px; height: 40px; margin-left: -8px; border-radius: 99px;
    }
    .rail-backbtn:active { background: var(--surface2); }
    .rail-topbar-title { display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; }
    .rail-topbar-name {
      font-weight: 800; font-size: 23px; letter-spacing: -0.025em; line-height: 1.2;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .rail-topbar-name.mono { font-weight: 700; letter-spacing: -0.04em; }
    .rail-topbar-chips { display: flex; align-items: center; gap: 6px; }
    .rail-topbar-dest { font-family: var(--mono); font-size: 11.5px; color: var(--muted); }

    /* ── Chips & dots ── */
    .rail-chip {
      display: inline-flex; align-items: center;
      font-family: var(--mono);
      font-size: 11px; font-weight: 700; letter-spacing: 0.02em;
      color: var(--chip-text); padding: 2.5px 8px 3px; border-radius: 5px; line-height: 1;
    }
    .rail-chip-sm { font-size: 10px; padding: 2px 6px 2.5px; }
    .rail-linedots { display: inline-flex; gap: 4px; align-items: center; }
    .rail-linedots span { width: 6px; height: 6px; border-radius: 99px; display: inline-block; }

    /* ── Main scroll body ── */
    .rail-main { flex: 1; padding: 4px 16px 28px; position: relative; }

    /* ── API-down banner ── */
    .rail-api-banner {
      margin: 6px 0 4px;
      padding: 0.8rem 1rem;
      background: #5a3410;
      color: #ffe2c8;
      font-size: 13px;
      line-height: 1.4;
      border: 1px solid #8a5018;
      border-radius: 14px;
      text-align: center;
    }
    @media (prefers-color-scheme: light) {
      .rail-api-banner { background: #fbe4c8; color: #6a3808; border-color: #e5b070; }
    }

    /* ── Hero cards (favorites) ── */
    #rail-heroes { display: flex; flex-direction: column; gap: 14px; margin: 8px 0 4px; }

    .rail-hero {
      display: block;
      padding: 20px 20px 16px;
      background: linear-gradient(160deg, var(--surface2), var(--surface) 65%);
      border: 1px solid var(--hairline); border-radius: 22px;
      box-shadow: var(--shadow);
      color: inherit; text-decoration: none;
      position: relative;
    }
    .rail-hero:active { transform: scale(0.99); }
    .rail-hero-eyebrow {
      font-family: var(--mono);
      font-size: 10px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase;
      color: var(--accent); display: flex; align-items: center; gap: 6px; white-space: nowrap;
    }
    .rail-hero-eyebrow svg { width: 12px; height: 12px; }
    .rail-hero-star {
      position: absolute; top: 8px; right: 12px;
      width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;
      color: var(--accent); cursor: pointer; -webkit-tap-highlight-color: transparent;
      border-radius: 99px;
    }
    .rail-hero-star:active { background: var(--surface2); }
    .rail-hero-name {
      font-size: 44px; font-weight: 800; letter-spacing: -0.035em; line-height: 0.95;
      margin: 10px 0 18px;
    }
    /* gap:0 + symmetric inner gutters → the dividers sit on the exact 50% track
       lines and meet in one continuous, centered cross (no per-cell corner gap,
       no left/right squish). Works for 2/3/4 directions and respects the card
       gradient, since cells aren't painted. */
    .rail-hero-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
    .rail-herodir { display: flex; flex-direction: column; gap: 6px; min-width: 0; padding-right: 14px; }
    .rail-herodir + .rail-herodir { border-left: 1px solid var(--hairline); padding-left: 14px; padding-right: 0; }
    .rail-hero-grid.is-quad .rail-herodir:nth-child(3) { border-left: none; padding-left: 0; padding-right: 14px; }
    .rail-hero-grid.is-quad .rail-herodir:nth-child(-n+2) { padding-bottom: 12px; }
    .rail-hero-grid.is-quad .rail-herodir:nth-child(n+3) { border-top: 1px solid var(--hairline); padding-top: 12px; }
    .rail-herodir-route {
      font-family: var(--mono);
      font-size: 13.5px; color: var(--muted); letter-spacing: 0.01em;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    /* direction marker: solid triangle (▲▼▶◀) — reads better than thin arrows */
    .rail-herodir-route b { color: var(--text); font-size: 1.15em; margin-right: 4px; }
    .rail-herodir-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .rail-herodir-then { font-family: var(--mono); font-size: 13px; color: var(--muted); white-space: nowrap; font-weight: 500; }
    .rail-hero-foot { font-family: var(--mono); margin-top: 16px; font-size: 10px; color: var(--faint); letter-spacing: 0.1em; }

    .rail-bigtime {
      font-family: var(--mono);
      font-size: 62px; font-weight: 600; line-height: 0.92; letter-spacing: -0.05em;
      display: flex; align-items: baseline; gap: 6px;
    }
    .rail-hero-grid.is-quad .rail-bigtime { font-size: 48px; }
    .rail-bigtime em { font-style: normal; font-size: 17px; font-weight: 500; color: var(--muted); letter-spacing: 0; }
    .rail-bigtime i { font-style: normal; font-size: 30px; color: var(--faint); align-self: center; }
    .rail-bigtime.is-approx { color: var(--muted); }
    .rail-bigtime.is-now { font-size: 50px; font-weight: 700; letter-spacing: -0.03em; }

    .is-now { animation: rail-nowpulse 1.3s ease-in-out infinite; }
    @media (prefers-reduced-motion: reduce) { .is-now { animation: none; } }
    @keyframes rail-nowpulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }

    /* Empty hero (no favorites yet) */
    .rail-hero-empty {
      padding: 22px 20px;
      background: var(--surface);
      border: 1px dashed var(--hairline); border-radius: 22px;
      text-align: center;
    }
    .rail-hero-empty-star { font-size: 26px; color: var(--accent); line-height: 1; }
    .rail-hero-empty-title { font-weight: 700; font-size: 18px; margin: 8px 0 4px; letter-spacing: -0.02em; }
    .rail-hero-empty-sub { font-size: 13px; color: var(--muted); line-height: 1.45; }

    /* ── Sections & list rows ── */
    .rail-sect { margin-top: 22px; }
    .rail-sect[hidden] { display: none; }
    .rail-sect-h {
      font-family: var(--mono);
      font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.18em;
      color: var(--muted); margin: 0 4px 8px;
    }
    .rail-rows { background: var(--surface); border: 1px solid var(--hairline); border-radius: 16px; overflow: hidden; }

    /* Compact rows — name + per-direction times, no line dots. */
    .rail-row {
      display: flex; align-items: center; gap: 10px;
      padding: 11px 16px 11px 6px; cursor: pointer;
      text-decoration: none; color: inherit;
      -webkit-tap-highlight-color: transparent;
    }
    .rail-row + .rail-row { border-top: 1px solid var(--hairline); }
    .rail-row:active { background: var(--surface2); }
    .rail-row[hidden] { display: none; }
    .rail-star {
      width: 36px; height: 36px; flex-shrink: 0; color: var(--faint);
      display: flex; align-items: center; justify-content: center;
      border-radius: 99px; cursor: pointer; -webkit-tap-highlight-color: transparent;
    }
    .rail-star.starred { color: var(--accent); }
    .rail-row-name {
      flex: 1; min-width: 0;
      font-weight: 600; font-size: 18px; letter-spacing: -0.015em;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .rail-row-times { display: flex; align-items: center; gap: 14px; flex-shrink: 0; }
    .rail-dirtoken {
      font-family: var(--mono);
      display: inline-flex; align-items: center; gap: 5px;
      font-size: 22px; font-weight: 600; letter-spacing: -0.03em; white-space: nowrap;
      line-height: 1;
    }
    .rail-dirtoken b { font-size: 14px; font-weight: 700; line-height: 1; }
    .rail-dirtoken.is-now span { font-size: 16px; letter-spacing: 0; }

    .rail-row-empty { padding: 16px; color: var(--faint); font-size: 13px; text-align: center; }

    /* ── Search ── */
    .rail-search {
      display: flex; align-items: center; gap: 9px; margin: 0 0 10px;
      background: var(--surface); border: 1px solid var(--hairline); border-radius: 13px;
      padding: 0 13px; color: var(--faint);
    }
    .rail-search svg { flex-shrink: 0; }
    .rail-search input {
      flex: 1; background: none; border: none; outline: none; color: var(--text);
      font-family: var(--ui); font-size: 15px; padding: 11px 0; min-width: 0;
    }
    .rail-search input::placeholder { color: var(--faint); }
    .rail-search-x {
      appearance: none; border: none; background: none; cursor: pointer;
      font-size: 16px; color: var(--muted); width: 28px; height: 28px;
    }

    /* Nearby enable prompt */
    .rail-geo-prompt {
      display: flex; align-items: center; gap: 8px; width: 100%;
      appearance: none; border: none; background: none; cursor: pointer;
      padding: 16px; color: var(--muted); font-family: var(--ui); font-size: 14px;
      text-align: left; -webkit-tap-highlight-color: transparent;
    }
    .rail-geo-prompt:active { background: var(--surface2); }
    .rail-geo-prompt svg { flex-shrink: 0; color: var(--accent); }

    /* Nearby skeleton while geolocating */
    .rail-skel-row {
      height: 3.7rem;
      border-top: 1px solid var(--hairline);
      background: linear-gradient(90deg, transparent 0%, var(--hairline) 50%, transparent 100%);
      background-size: 200% 100%;
      animation: rail-shimmer 1.5s ease-in-out infinite;
    }
    .rail-rows .rail-skel-row:first-child { border-top: none; }
    @keyframes rail-shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    .rail-footer {
      padding: 1.6rem 1rem 2.2rem;
      text-align: center;
      font-size: 12px;
      color: var(--faint);
      line-height: 1.5;
    }
    .rail-footer a { color: var(--muted); text-decoration: underline; text-underline-offset: 2px; }
    .rail-footer a:active { color: var(--accent); }

    /* ── Station board ── */
    .rail-seg {
      display: inline-flex; gap: 2px; margin: 6px 2px 12px; padding: 3px;
      background: var(--surface); border: 1px solid var(--hairline); border-radius: 11px;
    }
    .rail-seg button {
      appearance: none; border: none; background: none; cursor: pointer;
      font-family: var(--mono); font-size: 14px; font-weight: 600;
      color: var(--muted); padding: 8px 15px; border-radius: 8px; white-space: nowrap;
    }
    .rail-seg button.is-on { background: var(--surface2); color: var(--text); box-shadow: 0 1px 4px rgba(0,0,0,0.18); }

    .rail-board { background: var(--surface); border: 1px solid var(--hairline); border-radius: 16px; overflow: hidden; }
    .rail-brow {
      display: flex; align-items: center; gap: 13px; padding: 16px 18px 16px 0;
      cursor: pointer; text-decoration: none; color: inherit;
      -webkit-tap-highlight-color: transparent;
    }
    .rail-brow + .rail-brow { border-top: 1px solid var(--hairline); }
    .rail-brow:active { background: var(--surface2); }
    .rail-brow[hidden] { display: none; }
    .rail-brow-bar { width: 4px; align-self: stretch; border-radius: 0 3px 3px 0; flex-shrink: 0; }
    .rail-brow-dir {
      font-family: var(--mono);
      font-size: 17px; font-weight: 700; color: var(--muted); width: 18px;
      text-align: center; flex-shrink: 0; letter-spacing: -0.02em;
    }
    .rail-brow-dest {
      font-weight: 600; font-size: 21px; letter-spacing: -0.02em; flex: 1; min-width: 0;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .rail-boarding {
      font-family: var(--mono);
      font-style: normal; font-size: 11px; font-weight: 700; letter-spacing: 0.12em;
      text-transform: uppercase; margin-left: 10px;
    }
    .rail-brow.is-approx .rail-brow-dest, .rail-brow.is-approx .rail-brow-dir { color: var(--muted); font-weight: 500; }
    .rail-brow.is-approx .rail-brow-bar { opacity: 0.35; }
    .rail-rowtime {
      font-family: var(--mono);
      font-size: 30px; font-weight: 600; letter-spacing: -0.05em;
      flex-shrink: 0; white-space: nowrap; line-height: 1;
    }
    .rail-rowtime em { font-style: normal; font-size: 13px; font-weight: 500; color: var(--muted); letter-spacing: 0; }
    .rail-rowtime.is-approx { color: var(--muted); }
    .rail-rowtime.is-now { font-weight: 700; }

    .rail-empty { text-align: center; padding: 2rem 1rem; color: var(--muted); font-size: 15px; }

    /* ── Train timeline ──
       Dot and connector share an explicit x (--tl-x) so they can't drift apart.
       The spine is a solid line-tinted color (not a faint overlay) so it reads
       clearly as a connector between the dots on the dark/light background. */
    .rail-tl { position: relative; margin: 10px 4px 0; padding: 4px 0; --tl-x: 13px; }
    .rail-tl::before {
      content: ""; position: absolute; left: var(--tl-x); top: 28px; bottom: 28px;
      width: 3px; transform: translateX(-50%); border-radius: 2px;
      background: var(--lc, var(--accent)); /* fallback if color-mix unsupported */
      background: color-mix(in srgb, var(--lc, var(--accent)) 60%, var(--bg));
    }
    .rail-tlstop {
      position: relative; display: flex; align-items: center; gap: 14px;
      padding: 14px 0 14px calc(var(--tl-x) + 20px);
      text-decoration: none; color: inherit; -webkit-tap-highlight-color: transparent;
    }
    .rail-tldot {
      position: absolute; left: var(--tl-x); top: 50%;
      transform: translate(-50%, -50%);
      width: 13px; height: 13px; border-radius: 99px; background: var(--lc, var(--accent));
      box-shadow: 0 0 0 3px var(--bg); z-index: 1;
    }
    .rail-tlstop.is-passed { opacity: 0.4; }
    .rail-tlstop.is-passed .rail-tldot { background: var(--muted); }
    .rail-tlname { font-weight: 600; font-size: 20px; letter-spacing: -0.02em; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .rail-tlname em { font-style: normal; font-size: 11px; color: var(--faint); letter-spacing: 0.08em; text-transform: uppercase; }
    .rail-tleta {
      font-family: var(--mono);
      margin-left: auto; font-size: 25px; font-weight: 600; letter-spacing: -0.04em;
      flex-shrink: 0; line-height: 1;
    }
    .rail-tleta.is-passed-label { font-family: var(--mono); font-size: 10px; color: var(--faint); letter-spacing: 0.1em; text-transform: uppercase; font-weight: 500; }
    .rail-tlstop.is-next .rail-tlname { color: var(--lc, var(--accent)); font-weight: 700; }
    .rail-tlstop.is-next .rail-tldot { transform: translate(-50%, -50%) scale(1.3); }
    @media (prefers-reduced-motion: no-preference) {
      .rail-tlstop.is-next .rail-tldot::after {
        content: ""; position: absolute; inset: -5px; border-radius: 99px;
        border: 1.5px solid var(--lc, var(--accent)); animation: rail-ping 2s ease-out infinite;
      }
    }
    .rail-tlstop.is-end .rail-tlname { font-weight: 700; }

    /* Fresh-data tick: hero stars are rebuilt on each poll, so this entrance
       animation replays every refresh — the star advances one point (72°)
       clockwise and settles. Transform only → reduced-motion shows end state. */
    @media (prefers-reduced-motion: no-preference) {
      .rail-hero-star svg {
        transform-origin: 50% 50%;
        animation: rail-star-tick 0.55s cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
      }
    }
    @keyframes rail-star-tick { from { transform: rotate(-72deg); } to { transform: rotate(0); } }
  `;
}
