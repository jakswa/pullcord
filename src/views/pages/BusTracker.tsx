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
      {/* Compact header */}
      <header class="tracker-header" style={`border-bottom: 3px solid ${routeColor}`}>
        <a href="/" class="tracker-home" aria-label="Home">←</a>
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
            Loading arrivals...
          </div>
          <div id="eta-empty" class="tracker-eta-status" style="display:none">
            No buses predicted right now
          </div>
        </div>
      </div>

      {/* Map below — context, not primary */}
      <div class="tracker-map-wrap">
        <div id="map" class="tracker-map"></div>
        
        {/* Recenter button */}
        <button id="recenter-btn" class="tracker-recenter" title="Center on stop">
          ◎
        </button>
        
        {/* Connection status */}
        <div id="connection-status" class="tracker-offline" style="display:none">
          ⚠️ Connection lost
        </div>
      </div>

      {/* Bus count footer */}
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
