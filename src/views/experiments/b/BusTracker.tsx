import type { Route, Stop, RouteDetail } from "../../data/db.js";

export interface BusTrackerPageProps {
  route: Route;
  stop: Stop;
  routeDetail: RouteDetail;
  initialData: any;
}

export const BusTrackerPage = (props: BusTrackerPageProps) => {
  const { route, stop, routeDetail, initialData } = props;
  const routeColor = route.route_color ? `#${route.route_color}` : '#2563eb';
  
  return (
    <div class="tracker-shell">
      {/* Header — thin dark strip, platform indicator style */}
      <header class="tracker-header" style={`border-bottom: 3px solid ${routeColor}`}>
        <a href="/" class="tracker-home" aria-label="Home">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
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
        <div class="tracker-updated" id="last-updated">--:--</div>
      </header>

      {/* Refresh progress bar */}
      <div id="refresh-bar" class="refresh-bar"></div>

      {/* ETAs — THE departure board. This is the whole point. */}
      <div class="tracker-etas" id="eta-section">
        <div id="eta-cards">
          <div id="eta-loading" class="tracker-eta-status">
            <div class="tracker-spinner"></div>
            Loading arrivals...
          </div>
          <div id="eta-empty" class="tracker-eta-status" style="display:none">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            No buses predicted right now
          </div>
        </div>
      </div>

      {/* Map toggle — thin bar to show/hide map */}
      <button id="map-toggle" class="map-toggle">
        <span id="map-toggle-label">Hide Map</span>
        <span class="map-toggle-arrow">&#9660;</span>
      </button>

      {/* Map — secondary context, collapsible */}
      <div class="tracker-map-wrap">
        <div id="map" class="tracker-map"></div>
        
        {/* Recenter button */}
        <button id="recenter-btn" class="tracker-recenter" title="Center on stop">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
          </svg>
        </button>
        
        {/* Connection status */}
        <div id="connection-status" class="tracker-offline" style="display:none">
          CONNECTION LOST
        </div>
      </div>

      {/* Footer — minimal data line */}
      <div class="tracker-footer">
        <span id="vehicle-count">-</span> buses on route {route.route_short_name} · 30s refresh
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
