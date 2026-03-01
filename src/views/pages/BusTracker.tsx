import type { Route, Stop, RouteDetail } from "../../data/db.js";

export interface BusTrackerPageProps {
  route: Route | null;
  stop: Stop;
  routeDetail: RouteDetail | null;
  initialData: any;
}

export const BusTrackerPage = (props: BusTrackerPageProps) => {
  const { route, stop, routeDetail, initialData } = props;
  const multiRoute = !route;
  const routeColor = route?.route_color ? `#${route.route_color}` : '#E85D3A';

  return (
    <div class="d-shell" style={`--route-color: ${routeColor}`}>
      {/* === Thin refresh progress at very top === */}
      <div id="refresh-bar" class="d-refresh-bar"></div>

      {/* === Compact Header === */}
      <header class="d-header">
        <div class="d-header-row">
          <a href="/" class="d-back" aria-label="Home" onclick="if(history.length>1){history.back();return false}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </a>
          {route && (
            <div class="d-badge" style={`background:${routeColor}`}>
              {route.route_short_name}
            </div>
          )}
          <div class="d-header-info">
            <div class="d-stop-name">{stop.stop_name}</div>
          </div>
          <div class="d-live" id="live-indicator">
            <span class="d-live-dot"></span>
            <span class="d-live-time" id="last-updated"></span>
          </div>
        </div>
      </header>

      {/* === Route tabs — other routes at this stop === */}
      {!multiRoute && <div id="route-tabs" class="d-route-tabs"></div>}

      {/* === Scrollable content area === */}
      <div class="d-content" id="tracker-content">

        {/* HERO — The massive countdown */}
        <section class="d-hero" id="hero-section">
          {/* Loading state */}
          <div id="hero-loading" class="d-hero-loading">
            <div class="d-spinner"></div>
            <div class="d-hero-loading-text">Finding your bus...</div>
          </div>

          {/* Empty state */}
          <div id="hero-empty" class="d-hero-empty" style="display:none">
            <svg class="d-empty-icon" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            <div class="d-empty-title">No buses in sight</div>
            <div class="d-empty-sub">Buses may not be running on this route right now. Check back during service hours.</div>
          </div>

          {/* The countdown display */}
          <div id="hero-eta" class="d-hero-eta" style="display:none">
            <div class="d-hero-tier" id="hero-tier"></div>
            <div class="d-hero-countdown">
              <span class="d-hero-number" id="hero-number">--</span>
              <span class="d-hero-unit" id="hero-unit">min</span>
            </div>
            <div class="d-hero-headsign" id="hero-headsign"></div>
            <div class="d-hero-meta" id="hero-meta"></div>
          </div>
        </section>

        {/* PROGRESS STRIP */}
        <section class="d-progress" id="progress-section">
          <div class="d-progress-strip" id="progress-strip"></div>
          <div class="d-progress-meta">
            <div class="d-progress-label" id="progress-label"></div>
          </div>
        </section>

        {/* UPCOMING — remaining predictions */}
        <section class="d-upcoming" id="upcoming-section" style="display:none">
          <div class="d-upcoming-header">
            Arriving
            {stop.nearest_rail_station && (
              <button id="rail-toggle" class="d-rail-toggle" type="button"
                data-station={stop.nearest_rail_station}>
                🚇
              </button>
            )}
          </div>
          <div id="upcoming-list" class="d-upcoming-list"></div>
        </section>

      </div>

      {/* === Bottom Action Bar (thumb zone) === */}
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
          <button id="refresh-btn" class="d-action-btn" type="button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
            </svg>
            Refresh
          </button>
          <span class="d-action-divider"></span>
          <button id="fav-btn" class="d-action-btn" type="button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            Save Stop
          </button>
          <span class="d-action-divider"></span>
          <button id="map-toggle-btn" class="d-action-btn" type="button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
              <line x1="8" y1="2" x2="8" y2="18"/>
              <line x1="16" y1="6" x2="16" y2="22"/>
            </svg>
            <span id="map-toggle-text">Map</span>
          </button>
        </div>
      </div>

      {/* === Map Panel === */}
      <div id="map-panel" class="d-map-panel">
        <div class="d-map-bar">
          <div class="d-map-title" id="map-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
              <line x1="8" y1="2" x2="8" y2="18"/>
              <line x1="16" y1="6" x2="16" y2="22"/>
            </svg>
            <span id="map-title-text">{route ? `Route ${route.route_short_name}` : 'Map'}</span>
          </div>
          <button id="map-close-btn" class="d-map-close" type="button" aria-label="Close map">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="d-map-wrap">
          <div id="map" class="d-map"></div>
          <button id="recenter-btn" class="d-recenter" title="Center on stop" type="button">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
            </svg>
          </button>
          <div id="connection-status" class="d-offline" style="display:none">
            Connection lost — retrying
          </div>
        </div>
      </div>

      {/* Data injection */}
      <script dangerouslySetInnerHTML={{ __html: multiRoute
        ? `window.__INITIAL_DATA__ = ${JSON.stringify(initialData)};
           window.__CONFIG__ = { stopId: '${stop.stop_id}', multiRoute: true, pollInterval: 30000 };`
        : `window.__INITIAL_DATA__ = ${JSON.stringify(initialData)};
           window.__CONFIG__ = { routeId: '${route!.route_id}', stopId: '${stop.stop_id}', routeShortName: '${route!.route_short_name}', pollInterval: 30000 };`
      }} />
    </div>
  );
};
