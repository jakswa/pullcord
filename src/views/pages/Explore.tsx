export const ExplorePage = () => (
  <div class="explore-shell">
    {/* Header bar */}
    <div class="explore-header">
      <a href="/" class="explore-back" aria-label="Back to home">
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </a>
      <span class="explore-title">Explore Stops</span>
      <button id="explore-locate-btn" class="explore-locate" aria-label="Center on my location">
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3" stroke-width="2" />
          <path stroke-linecap="round" stroke-width="2" d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        </svg>
      </button>
    </div>

    {/* Search overlay */}
    <div class="explore-search-bar">
      <input
        type="text"
        id="explore-search"
        class="explore-search-input"
        placeholder="Filter by route number..."
        autocomplete="off"
      />
    </div>

    {/* Map fills the rest */}
    <div id="explore-map" class="explore-map"></div>

    {/* Loading state */}
    <div id="explore-loading" class="explore-loading">
      <div class="d-spinner"></div>
      <span>Loading stops...</span>
    </div>

    {/* Inline script to bootstrap the map */}
    <script src="/public/explore.js"></script>
  </div>
);
