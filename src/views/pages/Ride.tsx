export const RidePage = ({ tripId, stopId, routeId }: { tripId: string; stopId: string; routeId: string }) => (
  <div class="ride-shell">
    {/* Header */}
    <div class="ride-header">
      <a href={stopId ? `/bus?route=${routeId}&stop=${stopId}` : "/"} class="ride-back" aria-label="Back">
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </a>
      <div class="ride-header-info">
        <span class="ride-route-badge" id="ride-route-badge"></span>
        <span class="ride-headsign" id="ride-headsign">Loading...</span>
      </div>
    </div>

    {/* Map */}
    <div id="ride-map" class="ride-map"></div>

    {/* Bottom panel — stop list */}
    <div class="ride-panel" id="ride-panel">
      <div class="ride-panel-handle"></div>
      <div class="ride-panel-header">
        <span id="ride-status">Locating you...</span>
      </div>
      <div class="ride-stop-list" id="ride-stop-list">
        {/* Populated by JS */}
      </div>
    </div>

    {/* Pull the cord overlay */}
    <div class="ride-cord-zone hidden" id="ride-cord-zone">
      <div class="ride-cord-text">
        <span class="ride-cord-icon">🔔</span>
        <span>Pull the cord!</span>
      </div>
      <div class="ride-cord-stop" id="ride-cord-stop"></div>
    </div>

    {/* Config passed to JS */}
    <script dangerouslySetInnerHTML={{ __html: `
      window.__RIDE_CONFIG__ = ${JSON.stringify({ tripId, stopId, routeId })};
    ` }} />
    <script src="/public/ride.js"></script>
  </div>
);
