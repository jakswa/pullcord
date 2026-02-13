import type { Child } from "hono/jsx";
import { Layout } from "../Layout.js";

interface StopViewProps {
  stop: {
    stop_id: string;
    stop_name: string;
    stop_lat: number;
    stop_lon: number;
  };
  routes: Array<{
    route_id: string;
    route_short_name: string;
    route_long_name: string;
    route_color: string;
  }>;
}

export const StopViewPage = (props: StopViewProps) => {
  const { stop, routes } = props;

  return (
    <Layout title={`${stop.stop_name} — Pullcord`} description={`Live bus arrivals at ${stop.stop_name}. Routes: ${routes.map(r => r.route_short_name).join(', ')}.`}>
      <div class="d-shell stop-shell">
        {/* Header */}
        <div class="stop-header">
          <a href="/" class="d-back">← Back</a>
          <h1 class="stop-name">{stop.stop_name}</h1>
          <div class="stop-routes">
            {routes.map(r => (
              <span class="stop-route-chip" style={`background:#${r.route_color};color:#fff`}>
                {r.route_short_name}
              </span>
            ))}
          </div>
        </div>

        {/* Arrivals list — filled by JS */}
        <div id="arrivals-list" class="stop-arrivals">
          <div class="stop-loading">Loading arrivals...</div>
        </div>

        {/* Action bar */}
        <div class="d-action-bar">
          <div id="cord-section" class="d-cord-section">
            <div id="cord-idle" class="d-cord-idle">
              <div class="d-cord-label" id="cord-label">🔔 Alert me</div>
              <div id="cord-options" class="d-cord-options">
                <button class="d-cord-option" data-minutes="2" type="button">2m</button>
                <button class="d-cord-option" data-minutes="5" type="button">5m</button>
                <button class="d-cord-option" data-minutes="10" type="button">10m</button>
                <button class="d-cord-option" data-minutes="15" type="button">15m</button>
              </div>
            </div>
            <div id="cord-active-display" class="d-cord-active hidden">
              <button id="cord-cancel-btn" class="d-cord-cancel" type="button">
                <svg class="d-cord-inline-icon" width="18" height="26" viewBox="0 0 32 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <line x1="16" y1="0" x2="16" y2="18" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
                  <rect x="8" y="18" width="16" height="14" rx="5" fill="currentColor"/>
                  <circle cx="16" cy="37" r="2" fill="currentColor" opacity="0.5"/>
                </svg>
                <span id="cord-status-text">Watching...</span>
                <span class="d-cord-x">✕</span>
              </button>
            </div>
          </div>
          <div class="d-action-row">
            <button id="save-stop-btn" class="d-action-btn" type="button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              <span>Save Stop</span>
            </button>
            <button id="refresh-btn" class="d-action-btn" type="button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      <script dangerouslySetInnerHTML={{__html: `
        window.__STOP_DATA__ = ${JSON.stringify({ stop, routes })};
      `}} />
      <script src="/public/stop.js"></script>
    </Layout>
  );
};
