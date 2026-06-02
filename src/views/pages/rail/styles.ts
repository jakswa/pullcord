// ── Dynamic train timeline styles (per-line color) ──
export function trainTimelineStyles(color: string): string {
  return `
    .rail-tl-stop.current .rail-tl-name {
      color: ${color};
      font-weight: 700;
    }
  `;
}

// ── Styles ──
export function railStyles(): string {
  return `
    /* ── CSS Variables (design system tokens) ── */
    :root {
      --bg-primary: #0f0f0f;
      --bg-surface: #1a1a18;
      --text-primary: #d4d0c8;
      --text-body: #b0a898;
      --text-muted: #807870;
      --border-color: #2a2a26;
      --border-subtle: #333330;
      --brand: #E85D3A;
      --font-sans: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif;
      --font-mono: ui-monospace, Cascadia Code, Source Code Pro, Menlo, Consolas, monospace;
    }

    @media (prefers-color-scheme: light) {
      :root {
        --bg-primary: #f5f0eb;
        --bg-surface: #ece5dc;
        --text-primary: #3B2820;
        --text-body: #5C4030;
        --text-muted: #A89282;
        --border-color: #d8cfc4;
        --border-subtle: #e0d8cf;
      }
    }

    /* ── Rail base ── */
    .rail-body {
      margin: 0;
      font-family: var(--font-sans);
      font-size: 17px;
      -webkit-font-smoothing: antialiased;
      background: var(--bg-primary);
      color: var(--text-primary);
      overflow-x: hidden;
    }

    .rail-shell {
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      max-width: 100vw;
      overflow-x: hidden;
    }
    .rail-footer {
      padding: 1.5rem 1rem 2rem;
      text-align: center;
      font-size: 0.9rem;
      color: var(--text-muted);
      line-height: 1.5;
    }
    .rail-footer a { color: var(--text-muted); text-decoration: none; }
    .rail-footer a:hover { color: var(--text-body); }

    *, *::before, *::after {
      box-sizing: border-box;
    }

    /* ── Header ── */
    .rail-header {
      position: sticky;
      top: 0;
      z-index: 10;
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border-color);
      padding: 0.65rem 0.75rem;
    }

    .rail-header-top {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      max-width: 600px;
      margin: 0 auto;
    }

    .rail-back {
      color: var(--text-muted);
      display: flex;
      align-items: center;
      text-decoration: none;
      padding: 0.2rem;
      border-radius: 0.25rem;
      flex-shrink: 0;
    }
    .rail-back:active { color: var(--brand); }

    .rail-title {
      font-size: 1.35rem;
      font-weight: 700;
      margin: 0;
      flex: 1;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .rail-freshness {
      font-family: var(--font-mono);
      font-size: 0.95rem;
      font-variant-numeric: tabular-nums;
      color: var(--text-muted);
      flex-shrink: 0;
      min-width: 3rem;
      text-align: right;
    }

    /* ── API-down banner ── */
    .rail-api-banner {
      max-width: 600px;
      margin: 0 auto;
      padding: 0.85rem 1rem;
      background: #7a4010;
      color: #ffe2c8;
      font-size: 0.95rem;
      line-height: 1.4;
      border-bottom: 1px solid #a35515;
      text-align: center;
    }
    @media (prefers-color-scheme: light) {
      .rail-api-banner {
        background: #fbe4c8;
        color: #6a3808;
        border-bottom-color: #e5b070;
      }
    }

    /* ── Train header extras ── */
    .rail-train-header-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex: 1;
      min-width: 0;
    }

    .rail-train-id {
      font-size: 1.35rem;
      font-weight: 700;
      font-family: var(--font-mono);
      font-variant-numeric: tabular-nums;
    }

    .rail-train-line-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.15rem 0.5rem;
      border-radius: 0.25rem;
      font-size: 0.95rem;
      font-weight: 800;
      color: #fff;
      letter-spacing: 0.04em;
      flex-shrink: 0;
    }

    .rail-train-dest {
      max-width: 600px;
      margin: 0.15rem auto 0;
      padding-left: 2rem;
      font-size: 1.15rem;
      color: var(--text-muted);
    }

    /* ── Main content ── */
    .rail-main {
      flex: 1;
      max-width: 600px;
      width: 100%;
      margin: 0 auto;
      padding: 0;
    }

    /* ── Station list ── */
    .rail-station-list {
      display: flex;
      flex-direction: column;
    }

    .rail-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.85rem 1rem;
      text-decoration: none;
      color: inherit;
      border-bottom: 1px solid var(--border-subtle);
      min-height: 2.25rem;
      -webkit-tap-highlight-color: transparent;
    }
    .rail-row:active {
      background: var(--border-subtle);
    }

    .rail-station-name {
      flex: 1;
      min-width: 0;
      font-size: 1.3rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.3;
    }

    .rail-pills-wrap {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: flex-end;
    }

    .rail-pills-inline {
      display: flex;
      gap: 0.25rem;
      align-items: center;
    }

    /* ── Pill ── */
    .rail-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 74px;
      height: 2.05rem;
      border-radius: 0.3rem;
      font-family: var(--font-mono);
      font-size: 1.1rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      color: #fff;
      white-space: nowrap;
      letter-spacing: 0.02em;
      line-height: 1;
    }

    .rail-pill-now {
      animation: rail-pulse 1.5s ease-in-out infinite;
    }

    .rail-pill-empty {
      background: var(--border-color);
      color: #555;
      width: 74px;
    }

    @media (prefers-color-scheme: light) {
      .rail-pill-empty {
        color: #aaa;
      }
    }

    /* ── Four-direction grid (Five Points) ── */
    .rail-pills-grid {
      display: grid;
      grid-template-columns: 74px 74px;
      gap: 0.2rem;
    }

    /* ── No data ── */
    .rail-no-data {
      color: #555;
      font-size: 1.1rem;
      min-width: 74px;
      text-align: center;
    }

    /* ── Star button ── */
    .rail-star {
      flex-shrink: 0;
      font-size: 1.2rem;
      line-height: 1;
      color: var(--text-muted);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      padding: 0.1rem 0.15rem;
      user-select: none;
    }
    .rail-star.starred {
      color: #D4A020;
    }

    /* ── Section headers (collapsible) ── */
    .rail-section {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 1.05rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      color: var(--text-muted);
      padding: 0.85rem 1rem;
      min-height: 3rem;
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border-color);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
    }
    .rail-section:active {
      background: var(--border-color);
    }
    .rail-toggle {
      margin-left: auto;
      width: 36px;
      height: 20px;
      border-radius: 10px;
      background: var(--border-color);
      position: relative;
      flex-shrink: 0;
      transition: background 0.15s;
    }
    .rail-toggle.on {
      background: #888;
    }
    .rail-toggle-knob {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #fff;
      transition: left 0.15s;
    }
    .rail-toggle.on .rail-toggle-knob {
      left: 18px;
    }
    .rail-section-items {
      display: flex;
      flex-direction: column;
    }

    /* Hide list until JS reorders (prevents unsorted flash) */
    .rail-loading {
      visibility: hidden;
    }

    /* Nearby skeleton rows */
    .rail-skel-row {
      height: 3.7rem;
      border-bottom: 1px solid var(--border-subtle);
      background: linear-gradient(90deg, transparent 0%, var(--border-subtle) 50%, transparent 100%);
      background-size: 200% 100%;
      animation: rail-shimmer 1.5s ease-in-out infinite;
    }
    @keyframes rail-shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    /* ── Animations ── */
    @keyframes rail-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    /* ── Station detail ── */
    .rail-station-detail {
      padding: 0.75rem 1rem;
    }

    .rail-detail-list {
      display: flex;
      flex-direction: column;
    }

    .rail-arrival-row {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.35rem 0;
      min-height: 2.75rem;
      text-decoration: none;
      color: inherit;
      border-bottom: 1px solid var(--border-subtle);
      -webkit-tap-highlight-color: transparent;
    }
    .rail-arrival-row:active {
      background: var(--border-subtle);
    }

    .rail-arrival-dir {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.75rem;
      height: 1.75rem;
      border-radius: 0.2rem;
      font-size: 1.2rem;
      font-weight: 800;
      color: var(--text-primary);
      background: var(--border-color);
      flex-shrink: 0;
    }

    .rail-arrival-line-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.1rem 0.35rem;
      border-radius: 0.2rem;
      font-size: 1.05rem;
      font-weight: 700;
      color: #fff;
      flex-shrink: 0;
      letter-spacing: 0.02em;
    }

    .rail-arrival-dest {
      flex: 1;
      font-size: 1.3rem;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .rail-arrival-time {
      font-family: var(--font-mono);
      font-size: 1.4rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      flex-shrink: 0;
      min-width: 3rem;
      text-align: right;
    }

    .rail-arrival-now {
      color: var(--brand);
      animation: rail-pulse 1.5s ease-in-out infinite;
    }

    /* Scheduled (non-realtime) — muted, not tappable */
    .rail-scheduled {
      opacity: 0.45;
      cursor: default;
    }
    .rail-scheduled:active {
      background: transparent;
    }

    /* Boarding — train at terminal, can board now */
    .rail-badge-boarding {
      display: inline-block;
      padding: 0.05rem 0.3rem;
      border-radius: 0.2rem;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      background: #2d8a4e;
      color: #fff;
      vertical-align: middle;
    }

    .rail-empty {
      text-align: center;
      padding: 2rem 1rem;
      color: var(--text-muted);
      font-size: 1.15rem;
    }

    /* ── Train timeline ── */
    .rail-train-main {
      padding: 0.75rem 1rem;
    }

    .rail-timeline {
      position: relative;
      padding: 0.5rem 1rem;
    }

    .rail-tl-line {
      position: absolute;
      left: 1.65rem;
      top: 0;
      bottom: 0;
      width: 3px;
      border-radius: 2px;
      opacity: 0.35;
    }

    .rail-tl-stop.visited {
      opacity: 0.3;
    }
    .rail-tl-stop.visited .rail-tl-dot {
      width: 8px;
      height: 8px;
    }

    .rail-tl-stop {
      position: relative;
      padding: 0.7rem 0 0.7rem 2.25rem;
      display: flex;
      align-items: center;
      text-decoration: none;
      color: inherit;
      -webkit-tap-highlight-color: transparent;
      min-height: 3rem;
    }

    .rail-tl-dot {
      position: absolute;
      left: 0.65rem;
      top: 50%;
      transform: translate(-50%, -50%);
      margin-left: 1.5px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      z-index: 1;
    }

    .rail-tl-stop.current .rail-tl-dot {
      width: 18px;
      height: 18px;
      animation: rail-tl-pulse 1.5s ease-in-out infinite;
      box-shadow: 0 0 8px var(--tl-color, #666);
    }

    @keyframes rail-tl-pulse {
      0%, 100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      50% { opacity: 0.7; transform: translate(-50%, -50%) scale(0.85); }
    }

    .rail-tl-name {
      font-size: 1.3rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
    }

    .rail-tl-time {
      font-family: var(--font-mono);
      font-size: 1.4rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      flex-shrink: 0;
      margin-left: 0.5rem;
      color: var(--text-primary);
    }

    .rail-tl-now {
      color: var(--brand);
      font-weight: 800;
    }
    @media (prefers-color-scheme: dark) {
      .rail-tl-now {
        color: #fff;
      }
    }
  `;
}
