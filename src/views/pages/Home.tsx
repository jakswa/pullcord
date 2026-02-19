export const HomePage = () => (
  <div class="home-shell">
    {/* Compact header — brand + search + actions */}
    <div class="home-header">
      <div class="home-header-inner">
        <div class="home-header-top">
          <div class="home-brand">
            <svg class="home-logo-icon" width="32" height="32" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
              <line x1="22" y1="2" x2="22" y2="16" stroke="#E85D3A" stroke-width="3" stroke-linecap="round"/>
              <rect x="12" y="16" width="20" height="18" rx="6" fill="#E85D3A"/>
              <rect x="16" y="22" width="12" height="6" rx="3" fill="#fff" opacity="0.3"/>
              <circle cx="22" cy="40" r="2" fill="#F0A030" opacity="0.6"/>
            </svg>
            <span class="home-wordmark">Pullcord</span>
          </div>
          <div class="home-header-links">
            <a href="/about" class="home-about-link">About</a>
          </div>
        </div>

        {/* Search bar */}
        <div class="home-search-wrap">
          <input
            type="text"
            id="stop-search"
            class="home-search"
            placeholder="search stop name or route number"
            autocomplete="off"
          />
        </div>

        {/* Location + Map row — collapses when searching */}
        <div class="home-locate-row">
          <button id="location-btn" class="home-locate-btn">
            <svg class="home-locate-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Find My Stop
          </button>
          <a href="/explore" class="home-map-btn">
            <svg class="home-locate-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            Map
          </a>
        </div>
      </div>
    </div>

    {/* Content — results appear directly below header */}
    <div class="home-content">
      {/* Favorites */}
      <div id="favorites-section" class="hidden">
        <div class="home-results-header">⭐ Saved Stops</div>
        <div id="favorites-list" class="home-fav-list"></div>
      </div>

      {/* Search / nearby results */}
      <div id="search-loading" class="hidden home-status">
        <div class="d-spinner"></div>
        Finding stops near you...
      </div>
      <div id="search-results" class="hidden">
        <div class="home-results-header" id="results-header">Nearby Stops</div>
        <div id="results-list" class="home-results-list"></div>
      </div>
    </div>

    {/* Footer */}
    <div class="home-footer">
      <p>Real-time MARTA bus tracking · data updates every 30s</p>
    </div>
  </div>
);
