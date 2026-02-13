export const HomePage = () => (
  <div class="home-shell">
    {/* Hero — location-first, action-forward */}
    <div class="home-hero">
      <div class="home-hero-inner">
        <div class="home-brand">
          <svg class="home-logo-icon" width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
            <line x1="22" y1="2" x2="22" y2="16" stroke="#E85D3A" stroke-width="3" stroke-linecap="round"/>
            <rect x="12" y="16" width="20" height="18" rx="6" fill="#E85D3A"/>
            <rect x="16" y="22" width="12" height="6" rx="3" fill="#fff" opacity="0.3"/>
            <circle cx="22" cy="40" r="2" fill="#F0A030" opacity="0.6"/>
          </svg>
          <span class="home-wordmark">Pullcord</span>
        </div>
        <p class="home-tagline">Where's my bus?</p>
        
        {/* Big location button — primary action */}
        <button id="location-btn" class="home-locate-btn">
          <svg class="home-locate-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Find Stops Near Me
        </button>

        {/* Search bar — secondary */}
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

    {/* Results area */}
    <div class="home-results-area">
      {/* Loading state */}
      <div id="search-loading" class="hidden home-status">
        <div class="tracker-spinner"></div>
        Finding stops near you...
      </div>

      {/* Results container */}
      <div id="search-results" class="hidden">
        <div class="home-results-header" id="results-header">Nearby Stops</div>
        <div id="results-list" class="home-results-list"></div>
      </div>
    </div>

    {/* Footer */}
    <div class="home-footer">
      <p>Real-time MARTA bus tracking · data updates every 30s</p>
      <p class="home-footer-sub">Built on MARTA GTFS-RT feeds</p>
    </div>
  </div>
);
