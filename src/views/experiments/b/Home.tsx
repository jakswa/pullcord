export const HomePage = () => (
  <div class="home-shell">
    {/* Hero — dark header strip, transit kiosk feel */}
    <div class="home-hero">
      <div class="home-hero-inner">
        <div class="home-brand">
          <svg class="home-logo-icon" width="36" height="36" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="2" width="24" height="24" rx="4" fill="#ffffff"/>
            <rect x="8" y="6" width="16" height="8" rx="2" fill="#111827" opacity="0.85"/>
            <line x1="16" y1="6" x2="16" y2="14" stroke="#ffffff" stroke-width="1.5"/>
            <rect x="8" y="16" width="16" height="2" rx="1" fill="#111827" opacity="0.3"/>
            <circle cx="10" cy="22" r="2" fill="#111827"/>
            <circle cx="22" cy="22" r="2" fill="#111827"/>
          </svg>
          <span class="home-wordmark">Pullcord</span>
        </div>
        <p class="home-tagline">Real-time MARTA arrivals</p>
        
        {/* Big location button — primary action, white on dark for contrast */}
        <button id="location-btn" class="home-locate-btn">
          <svg class="home-locate-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Find Stops Near Me
        </button>

        {/* Search bar */}
        <div class="home-search-wrap">
          <input
            type="text"
            id="stop-search"
            class="home-search"
            placeholder="or search by stop name..."
            autocomplete="off"
          />
        </div>
      </div>
    </div>

    {/* Results area — white background, sunlight-readable */}
    <div class="home-results-area">
      {/* Loading state */}
      <div id="search-loading" class="hidden home-status">
        <div class="tracker-spinner"></div>
        Finding stops...
      </div>

      {/* Results container */}
      <div id="search-results" class="hidden">
        <div class="home-results-header" id="results-header">Nearby Stops</div>
        <div id="results-list" class="home-results-list"></div>
      </div>
    </div>

    {/* Footer */}
    <div class="home-footer">
      <p>MARTA bus tracking · data every 30s</p>
      <p class="home-footer-sub">Built on GTFS-RT feeds</p>
    </div>
  </div>
);
