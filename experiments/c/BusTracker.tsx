import type { Route, Stop, RouteDetail } from "../../data/db.js";

export interface BusTrackerPageProps {
  route: Route;
  stop: Stop;
  routeDetail: RouteDetail;
  initialData: any;
}

export const BusTrackerPage = (props: BusTrackerPageProps) => {
  const { route, stop, routeDetail, initialData } = props;
  const routeColor = route.route_color ? `#${route.route_color}` : '#E85D3A';
  
  return (
    <div class="tracker-shell">
      {/* Warm header */}
      <header class="tracker-header" style={`border-bottom: 3px solid ${routeColor}`}>
        <a href="/" class="tracker-home" aria-label="Home">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </a>
        <div class="tracker-route-badge" style={`background: ${routeColor}`}>
          {route.route_short_name}
        </div>
        <div class="tracker-header-info">
          <div class="tracker-stop-name">{stop.stop_name}</div>
          <div class="tracker-route-name">{route.route_long_name}</div>
        </div>
        <div class="tracker-updated" id="last-updated">...</div>
      </header>

      {/* Refresh progress bar */}
      <div id="refresh-bar" class="refresh-bar"></div>

      {/* ETAs first — the thing you need at a bus stop */}
      <div class="tracker-etas" id="eta-section">
        <div id="eta-cards">
          <div id="eta-loading" class="tracker-eta-status">
            <div class="tracker-spinner"></div>
            Checking arrivals...
          </div>
          <div id="eta-empty" class="tracker-eta-status" style="display:none">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.5">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
            No buses right now. Time for a walk?
          </div>
        </div>
      </div>

      {/* Map below — context, not primary */}
      <div class="tracker-map-wrap">
        <div id="map" class="tracker-map"></div>
        
        {/* Recenter button */}
        <button id="recenter-btn" class="tracker-recenter" title="Center on stop">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
          </svg>
        </button>
        
        {/* Connection status */}
        <div id="connection-status" class="tracker-offline" style="display:none">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          Connection lost
        </div>
      </div>

      {/* Friendly footer */}
      <div class="tracker-footer">
        <span id="vehicle-count">-</span> buses on Route {route.route_short_name} · updates every 30s
      </div>

      {/* Initial data */}
      <script dangerouslySetInnerHTML={{ __html: `
        window.__INITIAL_DATA__ = ${JSON.stringify(initialData)};
        window.__CONFIG__ = {
          routeId: '${route.route_id}',
          stopId: '${stop.stop_id}',
          pollInterval: 30000
        };
      `}} />
    </div>
  );
};
