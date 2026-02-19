// Pullcord — Real-time MARTA bus tracker
// Hero countdown, linear progress strip, map on demand, pull the cord, favorites

class PullcordApp {
  constructor() {
    // Map state
    this.map = null;
    this.mapVisible = false;
    this.busMarkers = new Map();
    this.routePolylines = [];
    this.stopMarkersList = [];
    this.activeStopMarker = null;
    this.focusedVehicleId = null;

    // Data state
    this.lastPredictions = [];
    this.lastVehicles = [];
    this.heroEtaSeconds = null;
    this.heroVehicleId = null;
    this.heroPrediction = null;

    // Countdown timer (ticks every second between polls)
    this.countdownTimer = null;

    // Pull cord state
    this.cordActive = false;
    this.cordId = null;
    this.cordThreshold = null;
    this.cordTripId = null;
    this.cordVehicleId = null;
    this.cordDirectionId = null;
    this.cordRouteId = null;
    this.cordStopId = null;
    this.cordStopName = null;

    // Timers
    this.pollTimer = null;
    this.refreshBar = null;

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
    } else {
      this.init();
    }
  }

  init() {
    const page = this.detectPage();
    if (page === 'home') this.initHomePage();
    else if (page === 'tracker') this.initTrackerPage();

    // Listen for SW navigation messages (notification click → navigate)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'navigate' && event.data.url) {
          window.location.href = event.data.url;
        }
      });
    }
  }

  detectPage() {
    if (document.getElementById('hero-section')) return 'tracker';
    if (document.getElementById('stop-search')) return 'home';
    return 'unknown';
  }

  // ═══════════════════════════════════
  // HOME PAGE (similar to production)
  // ═══════════════════════════════════

  initHomePage() {
    const searchInput = document.getElementById('stop-search');
    const locationBtn = document.getElementById('location-btn');
    const resultsContainer = document.getElementById('search-results');
    const resultsList = document.getElementById('results-list');
    const loadingDiv = document.getElementById('search-loading');
    const basePath = window.__BASE_PATH__ || '';

    const locateRow = document.querySelector('.home-locate-row');

    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      const q = e.target.value.trim();
      if (q.length < 2) {
        this.hideResults();
        this.renderFavorites(basePath);
        if (locateRow) locateRow.classList.remove('home-locate-hidden');
        return;
      }
      // Collapse locate row to make room for results
      if (locateRow) locateRow.classList.add('home-locate-hidden');
      searchTimeout = setTimeout(() => {
        this.searchStops(q, resultsList, resultsContainer, loadingDiv, basePath);
      }, 300);
    });

    locationBtn.addEventListener('click', () => {
      this.findNearbyStops(resultsList, resultsContainer, loadingDiv, basePath);
    });

    // Render favorites on load
    this.renderFavorites(basePath);
  }

  // ── Favorites ──
  getFavorites() {
    try {
      return JSON.parse(localStorage.getItem('pullcord_favorites') || '[]');
    } catch { return []; }
  }

  saveFavorites(favs) {
    localStorage.setItem('pullcord_favorites', JSON.stringify(favs));
  }

  addFavorite(stopId, stopName, routes) {
    const favs = this.getFavorites();
    if (favs.find(f => f.stopId === stopId)) return; // already saved
    favs.push({ stopId, stopName, routes, addedAt: Date.now() });
    this.saveFavorites(favs);
  }

  removeFavorite(stopId) {
    const favs = this.getFavorites().filter(f => f.stopId !== stopId);
    this.saveFavorites(favs);
  }

  isFavorite(stopId) {
    return this.getFavorites().some(f => f.stopId === stopId);
  }

  renderFavorites(basePath) {
    const container = document.getElementById('favorites-section');
    const list = document.getElementById('favorites-list');
    if (!container || !list) return;

    const favs = this.getFavorites();
    const shell = document.querySelector('.home-shell');
    if (favs.length === 0) {
      container.classList.add('hidden');
      if (shell) shell.classList.remove('has-content');
      return;
    }

    container.classList.remove('hidden');
    if (shell) shell.classList.add('has-content');
    list.innerHTML = favs.map(fav => {
      const favLink = fav.routes.length > 1
        ? `${basePath}/bus?stop=${fav.stopId}`
        : `${basePath}/bus?route=${fav.routes[0]}&stop=${fav.stopId}`;
      return `
      <div class="home-fav-card">
        <a href="${favLink}" class="home-fav-link">
          <div class="home-fav-name">${this.esc(fav.stopName)}</div>
          <div class="home-fav-routes-inline">${fav.routes.join(' · ')}</div>
        </a>
        <button class="home-fav-remove" data-stop="${this.esc(fav.stopId)}" aria-label="Remove favorite">✕</button>
      </div>
    `}).join('');

    // Wire up remove buttons
    list.querySelectorAll('.home-fav-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.removeFavorite(btn.dataset.stop);
        this.renderFavorites(basePath);
      });
    });
  }

  async searchStops(query, resultsList, resultsContainer, loadingDiv, basePath) {
    try {
      this.showLoading(loadingDiv, resultsContainer);
      const res = await fetch(`/api/stops?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      // API returns { routeMatch, stops } for route matches, or plain array for stop matches
      const stops = data.stops || data;
      const routeMatch = data.routeMatch || null;
      this.displayStops(stops, resultsList, resultsContainer, loadingDiv, basePath, routeMatch);
    } catch (e) {
      this.showError('Failed to search stops', resultsList, resultsContainer, loadingDiv);
    }
  }

  async findNearbyStops(resultsList, resultsContainer, loadingDiv, basePath) {
    if (!navigator.geolocation) {
      this.showError('Geolocation not supported', resultsList, resultsContainer, loadingDiv);
      return;
    }

    // Inline loading state on button
    const btn = document.getElementById('location-btn');
    const btnOriginal = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<div class="d-spinner"></div> Finding you...';
    }

    // Try coarse position first (fast, cell/wifi), fall back to fine
    const getPosition = (opts) => new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, opts);
    });

    const resetBtn = () => {
      if (btn) { btn.disabled = false; btn.innerHTML = btnOriginal; }
    };

    let pos;
    try {
      // Fast attempt: coarse, cached up to 5 min, 5s timeout
      pos = await getPosition({ enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 });
    } catch (e1) {
      try {
        // Slower attempt: high accuracy, fresh, 15s timeout
        pos = await getPosition({ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
      } catch (e2) {
        const msg = e2.code === 1 ? 'Location access denied'
          : e2.code === 3 ? 'Location timed out — try again or search instead'
          : 'Could not determine location';
        resetBtn();
        this.showError(msg, resultsList, resultsContainer, loadingDiv);
        return;
      }
    }

    try {
      const { latitude, longitude } = pos.coords;
      const res = await fetch(`/api/stops?lat=${latitude}&lon=${longitude}&radius=800`);
      const stops = await res.json();
      resetBtn();
      this.displayStops(stops, resultsList, resultsContainer, loadingDiv, basePath);
    } catch (e) {
      resetBtn();
      this.showError('Failed to find nearby stops', resultsList, resultsContainer, loadingDiv);
    }
  }

  displayStops(stops, resultsList, resultsContainer, loadingDiv, basePath, routeMatch) {
    this.hideLoadingEl(loadingDiv);
    if (resultsContainer) resultsContainer.classList.remove('hidden');
    document.querySelector('.home-shell')?.classList.add('has-content');

    // Scroll results into view above keyboard on mobile
    requestAnimationFrame(() => {
      resultsContainer?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    const header = document.getElementById('results-header');
    if (header) {
      const searchVal = document.getElementById('stop-search')?.value?.trim() || '';
      if (routeMatch) {
        const color = routeMatch.route_color ? `#${routeMatch.route_color}` : 'var(--color-brand)';
        const routeNum = this.esc(routeMatch.route_short_name);
        header.innerHTML = `<span style="color:${color};font-weight:800">Route ${routeNum}</span> · ${stops.length} stops`
          + ` <a href="/explore?route=${encodeURIComponent(routeMatch.route_short_name)}" class="home-map-toggle">Map ↗</a>`;
      } else if (stops.length > 0 && stops[0].distance) {
        header.innerHTML = `${stops.length} stops nearby`
          + ` <a href="/explore" class="home-map-toggle">Map ↗</a>`;
      } else if (stops.length > 0 && searchVal) {
        header.innerHTML = `${stops.length} results`
          + ` <a href="/explore?q=${encodeURIComponent(searchVal)}" class="home-map-toggle">Map ↗</a>`;
      } else {
        header.textContent = `${stops.length} results`;
      }
    }

    if (stops.length === 0) {
      resultsList.innerHTML = '<div class="home-status">No stops found</div>';
      return;
    }

    resultsList.innerHTML = stops.map(stop => {
      const stopLink = stop.routes.length > 1
        ? `${basePath}/bus?stop=${stop.stop_id}`
        : `${basePath}/bus?route=${stop.routes[0]}&stop=${stop.stop_id}`;
      return `
      <a href="${stopLink}" class="home-stop-card">
        <div class="home-stop-info">
          <div class="home-stop-name">${this.esc(stop.stop_name)}</div>
          <div class="home-stop-meta">
            <span class="home-stop-routes-inline">${stop.routes.join(' · ')}</span>
            ${stop.distance ? `<span class="home-stop-distance">${Math.round(stop.distance)}m</span>` : ''}
          </div>
        </div>
        <svg class="home-stop-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </a>
    `}).join('');
  }

  showLoading(loadingDiv, resultsContainer) {
    if (loadingDiv) loadingDiv.classList.remove('hidden');
    if (resultsContainer) resultsContainer.classList.add('hidden');
  }

  hideLoadingEl(el) {
    if (el) el.classList.add('hidden');
  }

  hideResults() {
    const c = document.getElementById('search-results');
    if (c) c.classList.add('hidden');
  }

  showError(msg, resultsList, resultsContainer, loadingDiv) {
    this.hideLoadingEl(loadingDiv);
    if (resultsContainer) resultsContainer.classList.remove('hidden');
    if (resultsList) resultsList.innerHTML = `<div class="home-status" style="color:#ef4444">${msg}</div>`;
  }

  // ═══════════════════════════════════════
  // TRACKER PAGE — the reimagined experience
  // ═══════════════════════════════════════

  initTrackerPage() {
    if (!window.__INITIAL_DATA__ || !window.__CONFIG__) return;
    this.data = window.__INITIAL_DATA__;
    this.config = window.__CONFIG__;
    this.multiRoute = !!this.config.multiRoute;
    this.routeColor = this.data.route?.color ? `#${this.data.route.color}` : '#E85D3A';
    const params = new URLSearchParams(window.location.search);
    this.mockMode = params.has('mock');

    // Direction preference from URL (persists on refresh, shareable)
    this.selectedDirection = params.has('dir') ? parseInt(params.get('dir'), 10) : null;

    // Tracked vehicle/trip — persisted in URL via &vid=
    // Falls back: tripId → vehicleId → direction → first prediction
    this.trackedTripId = null;
    this.trackedVehicleId = params.get('vid') || null;
    this.trackedPredictionIdx = null;

    // Set route color CSS variable on shell
    const shell = document.querySelector('.d-shell');
    if (shell && !this.multiRoute) shell.style.setProperty('--route-color', this.routeColor);

    // Fix back link for experiments
    const basePath = window.__BASE_PATH__ || '';
    const backLink = document.querySelector('.d-back');
    if (backLink && basePath) backLink.href = basePath + '/';

    this.refreshBar = document.getElementById('refresh-bar');
    if (!this.multiRoute) this.prepareStopDirections();
    this.checkCordFired(params);
    this.initPullCord();
    this.initMapToggle();
    this.initRefreshBtn();
    this.initFavoriteBtn();

    // Multi-route: track which route is currently loaded for map/progress
    if (this.multiRoute) {
      this.loadedRouteId = null;
      this.routeDetailCache = {};
    }
    if (!this.multiRoute) this.discoverOtherRoutes();
    this.startPolling();
  }

  // Load route-specific data (shapes, stops, vehicles) for multi-route map/progress
  async loadRouteData(routeId) {
    if (!this.multiRoute) return;
    if (this.loadedRouteId === routeId && this.lastVehicles.length > 0) {
      // Just refresh vehicles for the same route
      try {
        const vRes = await fetch(`/api/realtime/${routeId}`);
        const vData = await vRes.json();
        this.lastVehicles = vData.vehicles || [];
      } catch (e) { /* keep stale */ }
      return;
    }

    try {
      // Fetch route detail (shapes + stops) and vehicles in parallel
      const [rdRes, vRes] = await Promise.all([
        this.routeDetailCache[routeId]
          ? Promise.resolve(null)
          : fetch(`/api/route/${routeId}`),
        fetch(`/api/realtime/${routeId}`)
      ]);

      if (rdRes) {
        const rd = await rdRes.json();
        this.routeDetailCache[routeId] = rd;
      }
      const rd = this.routeDetailCache[routeId];

      const vData = await vRes.json();
      this.lastVehicles = vData.vehicles || [];

      // Update local data for progress strip + map
      this.data.stops = (rd.stops || []).map(s => ({
        id: s.stop_id, name: s.stop_name, lat: s.stop_lat, lon: s.stop_lon,
        direction: s.direction_id, sequence: s.stop_sequence ?? 0
      }));
      this.data.shapes = rd.shapes || [];
      this.routeColor = rd.route?.route_color ? `#${rd.route.route_color}` : '#E85D3A';
      this.loadedRouteId = routeId;

      // Re-prepare stop directions for progress strip
      this.prepareStopDirections();

      // Update map title
      const titleEl = document.getElementById('map-title-text');
      if (titleEl) titleEl.textContent = `Route ${rd.route?.route_short_name || routeId}`;

      // Clear and redraw map route lines if map is visible
      if (this.map) {
        this.clearMapRoute();
        this.drawMapRoute();
      }
    } catch (e) {
      console.error('Failed to load route data:', e);
    }
  }

  // Pre-compute direction stop lists for progress strip + ETA computation
  prepareStopDirections() {
    const stops = this.data.stops || [];
    const myId = this.data.stop.id;
    const myName = this.data.stop.name;

    // Group by direction and sort by stop_sequence
    this.dirStops = {};
    stops.forEach(s => {
      const d = String(s.direction);
      if (!this.dirStops[d]) this.dirStops[d] = [];
      // Parse arrivalTime once for ETA computation
      const entry = { ...s };
      if (s.arrivalTime && typeof parseTimeToSec === 'function') {
        entry.arrivalSec = parseTimeToSec(s.arrivalTime);
      }
      this.dirStops[d].push(entry);
    });

    // Sort each direction by sequence (from GTFS stop_times)
    for (const dir of Object.keys(this.dirStops)) {
      this.dirStops[dir].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
    }

    // Find which direction(s) have our stop
    // Match by ID first, then by name (paired stops have different IDs but same name)
    this.myStopDirections = {};
    for (const [dir, list] of Object.entries(this.dirStops)) {
      let idx = list.findIndex(s => s.id === myId);
      if (idx === -1 && myName) {
        idx = list.findIndex(s => s.name === myName);
      }
      if (idx !== -1) this.myStopDirections[dir] = idx;
    }
  }

  // ── Client-side computed ETA ──
  // For active-tier vehicles with known positions, compute ETA from
  // vehicle position + scheduled inter-stop deltas. Falls back to
  // server-provided ETA if computation fails.
  computeClientETAs() {
    if (typeof computeClientETA !== 'function') return;
    if (!this.lastVehicles || !this.lastPredictions || !this.dirStops) return;

    const vehicleMap = new Map(this.lastVehicles.map(v => [v.vehicleId, v]));

    for (const pred of this.lastPredictions) {
      // Only compute for active vehicles (on the road, current trip)
      if (pred.tier !== 'active' || !pred.vehicleId) continue;
      const veh = vehicleMap.get(pred.vehicleId);
      if (!veh) continue;

      // Find the direction stops for this vehicle's direction
      const dir = String(pred.directionId);
      const stops = this.dirStops[dir];
      if (!stops || stops.length < 2 || !stops[0].arrivalSec) continue;

      const eta = computeClientETA(
        veh.lat, veh.lon, stops,
        this.data.stop.id, this.data.stop.name,
        veh.staleSeconds || 0
      );
      if (eta !== null) {
        pred.etaSeconds = eta;
        pred.etaSource = 'computed';
      }
    }

    // Re-sort by ETA after recomputation
    this.lastPredictions.sort((a, b) => a.etaSeconds - b.etaSeconds);
  }

  // ── Refresh Bar ──
  startRefreshCycle() {
    if (!this.refreshBar) return;
    this.refreshBar.classList.remove('refreshing', 'refresh-flash');
    void this.refreshBar.offsetWidth;
    this.refreshBar.classList.add('refreshing');
  }

  flashRefresh() {
    if (!this.refreshBar) return;
    this.refreshBar.classList.remove('refreshing');
    this.refreshBar.classList.add('refresh-flash');
    setTimeout(() => this.refreshBar.classList.remove('refresh-flash'), 500);
  }

  // ── Polling ──
  async startPolling() {
    await this.updateData();
    this.pollTimer = setInterval(() => this.updateData(), this.config.pollInterval);
  }

  async updateData() {
    try {
      const qs = this.mockMode ? '?mock=1' : '';

      if (this.multiRoute) {
        // Multi-route: fetch all arrivals at this stop
        const res = await fetch(`/api/stops/${this.config.stopId}/arrivals`);
        const data = await res.json();
        this.lastPredictions = (data.arrivals || []).map(a => ({
          ...a,
          routeBadge: a.routeShortName,
          routeColor: a.routeColor,
        }));

        // Fetch vehicles + route detail for hero's route (for map + progress strip)
        const heroRoute = this.lastPredictions[0]?.routeId;
        if (heroRoute) {
          await this.loadRouteData(heroRoute);
        }
      } else {
        // Single route: fetch vehicles + predictions
        const [vRes, pRes] = await Promise.all([
          fetch(`/api/realtime/${this.config.routeId}${qs}`),
          fetch(`/api/predictions/${this.config.routeId}/${this.config.stopId}${qs}`)
        ]);
        const vehiclesData = await vRes.json();
        const predictionsData = await pRes.json();
        this.lastVehicles = vehiclesData.vehicles || [];
        this.lastPredictions = predictionsData.predictions || [];

        // Client-side computed ETA for active vehicles with known positions
        this.computeClientETAs();
      }

      this.renderHero(this.lastPredictions);
      this.renderProgressStrip(this.lastPredictions, this.lastVehicles);
      this.renderUpcoming(this.lastPredictions);
      this.updateMapMarkers(this.lastVehicles);
      this.updateTimestamp();
      this.checkPullCord();
      this.flashRefresh();
      this.startRefreshCycle();
      this.hideOffline();
    } catch (e) {
      console.error('Update error:', e);
      this.showOffline();
    }
  }

  initRefreshBtn() {
    const btn = document.getElementById('refresh-btn');
    if (btn) btn.addEventListener('click', () => this.updateData());
  }

  initFavoriteBtn() {
    const btn = document.getElementById('fav-btn');
    if (!btn) return;

    const stopId = this.config.stopId;
    const update = () => {
      const isFav = this.isFavorite(stopId);
      btn.innerHTML = isFav
        ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Saved'
        : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Save Stop';
      btn.classList.toggle('fav-active', isFav);
    };

    btn.addEventListener('click', () => {
      const stopId = this.config.stopId;
      if (this.isFavorite(stopId)) {
        this.removeFavorite(stopId);
      } else {
        // Gather routes — multi-route mode has full route list in initial data
        const routes = this.multiRoute
          ? (this.data.routes || []).map(r => r.shortName)
          : [this.config.routeShortName].filter(Boolean);
        this.addFavorite(stopId, this.data.stop.name, routes);
      }
      update();
    });

    update();
  }

  updateTimestamp() {
    const el = document.getElementById('last-updated');
    if (el) el.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  // ──────────────────────────────
  // HERO — massive ETA countdown
  // ──────────────────────────────

  renderHero(predictions) {
    const loading = document.getElementById('hero-loading');
    const empty = document.getElementById('hero-empty');
    const eta = document.getElementById('hero-eta');

    loading.style.display = 'none';

    const cordSection = document.getElementById('cord-section');

    if (!predictions || predictions.length === 0) {
      empty.style.display = '';
      eta.style.display = 'none';
      if (cordSection) cordSection.style.display = 'none';
      this.heroPrediction = null;
      this.heroEtaSeconds = null;
      this.stopCountdown();
      return;
    }

    empty.style.display = 'none';
    eta.style.display = '';
    if (cordSection) cordSection.style.display = '';

    // Hero selection priority:
    // 1. Tracked vehicle (user tapped a specific bus)
    // 2. First prediction in selected direction
    // 3. First prediction overall (auto-select direction)
    let hero;

    // 1a. Match by exact trip (most specific — handles same vehicle, different trips)
    if (this.trackedTripId) {
      hero = predictions.find(p => p.tripId === this.trackedTripId);
      if (!hero) {
        this.trackedTripId = null;
        // Fall through to vehicleId match
      }
    }

    // 1b. Match by vehicle (if trip disappeared but vehicle still active)
    if (!hero && this.trackedVehicleId) {
      hero = predictions.find(p => p.vehicleId === this.trackedVehicleId);
      if (!hero) {
        this.trackedVehicleId = null;
        this.updateVehicleUrl(null);
      }
    }

    // Fallback: track by index for vehicleless predictions (next-run/scheduled)
    if (!hero && this.trackedPredictionIdx != null) {
      hero = predictions[this.trackedPredictionIdx];
      if (!hero) this.trackedPredictionIdx = null;
    }

    if (!hero && this.selectedDirection !== null) {
      hero = predictions.find(p => p.directionId === this.selectedDirection);
    }

    if (!hero) {
      hero = predictions[0];
      if (this.selectedDirection === null && hero.directionId != null) {
        this.selectedDirection = hero.directionId;
        this.updateDirectionUrl(hero.directionId);
      }
    }
    this.heroPrediction = hero;
    this.heroEtaSeconds = hero.etaSeconds;
    this.heroVehicleId = hero.vehicleId;

    this.renderHeroDisplay();
    this.startCountdown();

    // Track live hero for map focus
    if (hero.vehicleId && hero.tier === 'active') {
      this.focusedVehicleId = hero.vehicleId;
    } else {
      this.focusedVehicleId = null;
    }

    // Update map button text based on hero state
    const mapText = document.getElementById('map-toggle-text');
    if (mapText) {
      mapText.textContent = (hero.vehicleId && hero.tier === 'active') ? 'Live Map' : 'Map';
    }
  }

  renderHeroDisplay() {
    if (this.heroEtaSeconds === null || !this.heroPrediction) return;

    const seconds = Math.max(0, this.heroEtaSeconds);
    const minutes = Math.floor(seconds / 60);
    const tier = this.heroPrediction.tier || 'active';
    const isArriving = minutes < 1 && tier === 'active';
    const isSoon = minutes < 5 && minutes >= 1 && tier === 'active';

    // Number
    const numEl = document.getElementById('hero-number');
    const unitEl = document.getElementById('hero-unit');

    if (isArriving) {
      // Show seconds countdown for last minute
      numEl.textContent = seconds < 30 ? 'NOW' : `<1`;
      unitEl.textContent = seconds < 30 ? '' : 'min';
    } else {
      numEl.textContent = minutes;
      unitEl.textContent = 'min';
    }

    // Style modifiers
    numEl.className = 'd-hero-number';
    unitEl.className = 'd-hero-unit';
    if (isArriving) {
      numEl.classList.add('arriving');
      unitEl.classList.add('arriving');
    } else if (isSoon) {
      numEl.classList.add('arriving-soon');
    } else if (tier === 'next') {
      numEl.classList.add('tier-next');
    } else if (tier === 'scheduled') {
      numEl.classList.add('tier-scheduled');
    }

    // Tier label
    const tierEl = document.getElementById('hero-tier');
    if (tier === 'active') {
      const stale = this.staleTier(this.heroPrediction.staleSeconds);
      tierEl.innerHTML = stale.html;
      tierEl.className = 'd-hero-tier tier-active';
    } else if (tier === 'next') {
      tierEl.innerHTML = '<span class="dot-next"></span> On another run';
      tierEl.className = 'd-hero-tier tier-next';
    } else {
      tierEl.innerHTML = '<span class="dot-sched"></span> Scheduled';
      tierEl.className = 'd-hero-tier tier-scheduled';
    }

    // Hide the old badge element
    const badgeEl = document.getElementById('hero-badge');
    if (badgeEl) badgeEl.style.display = 'none';

    // Headsign with inline route number for multi-route
    const hsEl = document.getElementById('hero-headsign');
    const routePrefix = this.multiRoute && this.heroPrediction.routeBadge
      ? `${this.heroPrediction.routeBadge} `
      : '';
    const fullHeadsign = this.heroPrediction.headsign || 'Unknown';
    hsEl.innerHTML = this.multiRoute && this.heroPrediction.routeBadge
      ? `<span class="d-hero-route" style="color:#${this.heroPrediction.routeColor || 'E85D3A'}">${this.esc(this.heroPrediction.routeBadge)}</span> <span class="d-hero-headsign-text">${this.esc(fullHeadsign)}</span>`
      : `<span class="d-hero-headsign-text">${this.esc(fullHeadsign)}</span>`;

    // Measure actual overflow, then middle-truncate if needed
    const textSpan = hsEl.querySelector('.d-hero-headsign-text');
    if (textSpan && hsEl.scrollWidth > hsEl.clientWidth) {
      textSpan.textContent = this.truncateMiddle(fullHeadsign, fullHeadsign.length - 1);
      // Shrink until it fits
      let maxLen = fullHeadsign.length - 2;
      while (hsEl.scrollWidth > hsEl.clientWidth && maxLen > 15) {
        textSpan.textContent = this.truncateMiddle(fullHeadsign, maxLen);
        maxLen -= 3;
      }
    }

    // Meta (arrival time + adherence)
    const metaEl = document.getElementById('hero-meta');
    if (minutes >= 2) {
      const arrival = new Date(Date.now() + seconds * 1000);
      const timeStr = arrival.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      const adherenceHtml = this.formatAdherence(this.heroPrediction.adherenceSec);
      metaEl.innerHTML = `arrives ${adherenceHtml}~${this.esc(timeStr)}`;
    } else {
      metaEl.innerHTML = '';
    }

  }

  // Countdown timer — ticks every second between polls
  startCountdown() {
    this.stopCountdown();
    this.countdownTimer = setInterval(() => {
      if (this.heroEtaSeconds !== null && this.heroEtaSeconds > 0) {
        this.heroEtaSeconds--;
        this.renderHeroDisplay();
      }
    }, 1000);
  }

  stopCountdown() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  // ─────────────────────────────────
  // PROGRESS STRIP — linear route viz
  // ─────────────────────────────────

  renderProgressStrip(predictions, vehicles) {
    const section = document.getElementById('progress-section');
    const strip = document.getElementById('progress-strip');
    const label = document.getElementById('progress-label');
    if (!section || !strip) return;

    // Use the current hero prediction (respects tracked vehicle / direction)
    const hero = this.heroPrediction;
    if (!hero || hero.tier === 'scheduled' || hero.tier === 'next' || !hero.vehicleId) {
      this.renderEmptyStrip(strip, label);
      return;
    }

    // Find the vehicle
    const vehicle = vehicles.find(v => v.id === hero.vehicleId || v.vehicleId === hero.vehicleId);
    if (!vehicle) {
      this.renderEmptyStrip(strip, label);
      return;
    }

    // Determine direction: find which direction list the vehicle is closest to
    let bestDir = null;
    let bestMyIdx = -1;
    let bestBusIdx = -1;
    let bestDist = Infinity;

    for (const [dir, myIdx] of Object.entries(this.myStopDirections)) {
      const stops = this.dirStops[dir];
      const nearest = this.findNearestStop(stops, vehicle.lat, vehicle.lon);
      if (nearest.distance < bestDist) {
        bestDist = nearest.distance;
        bestDir = dir;
        bestMyIdx = myIdx;
        bestBusIdx = nearest.index;
      }
    }

    if (bestDir === null || bestMyIdx < 0 || bestBusIdx < 0) {
      this.renderEmptyStrip(strip, label);
      return;
    }

    const stops = this.dirStops[bestDir];
    const n = stops.length;
    if (n < 2) { this.renderEmptyStrip(strip, label); return; }

    // Calculate bus fractional position between stops
    let busFrac = 0;
    if (bestBusIdx < n - 1) {
      const curr = stops[bestBusIdx];
      const next = stops[bestBusIdx + 1];
      const dTotal = this.dist(curr.lat, curr.lon, next.lat, next.lon);
      const dBus = this.dist(curr.lat, curr.lon, vehicle.lat, vehicle.lon);
      busFrac = dTotal > 0 ? Math.min(1, dBus / dTotal) : 0;
    }

    // Only care about the gap between bus and me
    const stopsAway = bestMyIdx - bestBusIdx;
    const betweenCount = Math.max(0, stopsAway - 1); // stops strictly between

    // Render: bus pinned left, me pinned right, only between-stops shown
    const w = strip.clientWidth || 340;
    const h = 48;
    const pad = 28;
    const uw = w - pad * 2;
    const lineY = 14;
    const rc = this.routeColor;

    // Adaptive colors
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const stripLine = dark ? '#1e293b' : '#EDE5D8';
    const stopDot = dark ? '#475569' : '#C4B4A4';
    const myStopStroke = dark ? '#090e1a' : '#FFFFFF';
    const labelFill = dark ? '#94a3b8' : '#7C6354';
    const busFill = dark ? '#f8fafc' : '#3B2820';

    // Positions: bus at left, me at right, between-stops evenly spaced
    const totalSlots = betweenCount + 1; // segments between bus and me
    const busXBase = pad;
    const myXBase = w - pad;
    const fracOffset = totalSlots > 0 ? (busFrac / totalSlots) * uw : 0;
    const busX = busXBase + fracOffset; // bus slides right within first segment
    const xBetween = (i) => busXBase + ((i + 1) / totalSlots) * uw;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;

    // Glow filter
    svg += `<defs><filter id="pg"><feGaussianBlur stdDeviation="2" result="b"/>` +
           `<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;

    // Background line spans bus to me
    svg += `<line x1="${busXBase}" y1="${lineY}" x2="${myXBase}" y2="${lineY}" stroke="${stripLine}" stroke-width="2" stroke-linecap="round"/>`;

    // Active segment: bus current position → me
    svg += `<line x1="${busX}" y1="${lineY}" x2="${myXBase}" y2="${lineY}" ` +
           `stroke="${rc}" stroke-width="3" stroke-linecap="round" opacity="0.35"/>`;

    // Between-stop dots
    for (let i = 0; i < betweenCount; i++) {
      svg += `<circle cx="${xBetween(i)}" cy="${lineY}" r="2" fill="${stopDot}"/>`;
    }

    // Me — destination pin (right side, always fixed)
    svg += `<circle cx="${myXBase}" cy="${lineY}" r="6" fill="${rc}" stroke="${myStopStroke}" stroke-width="2.5"/>`;
    svg += `<circle cx="${myXBase}" cy="${lineY}" r="2" fill="${myStopStroke}"/>`;

    // Bus — GPS dot (left side, slides right within segment)
    svg += `<circle cx="${busX}" cy="${lineY}" r="7" fill="${rc}" opacity="0.2" filter="url(#pg)"/>`;
    svg += `<circle cx="${busX}" cy="${lineY}" r="4" fill="${busFill}" stroke="${rc}" stroke-width="1.5"/>`;

    // Label
    let stopsText = '';
    if (stopsAway > 0) {
      stopsText = `${stopsAway} stop${stopsAway === 1 ? '' : 's'} away`;
    } else if (stopsAway === 0) {
      stopsText = 'At your stop';
    }
    if (stopsText) {
      svg += `<text x="${w/2}" y="${h - 2}" text-anchor="middle" fill="${labelFill}" font-size="13" font-weight="700" font-family="'JetBrains Mono',monospace" letter-spacing="0.5">${stopsText.toUpperCase()}</text>`;
    }

    svg += '</svg>';
    strip.innerHTML = svg;
    label.textContent = '';
  }

  // Empty progress strip — reserves space, shows just the track line
  renderEmptyStrip(strip, label) {
    if (!strip) return;
    const w = strip.clientWidth || 340;
    const h = 40;
    const pad = 20;
    const lineY = 16;
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const stripLine = dark ? '#1e293b' : '#EDE5D8';

    strip.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
      `<line x1="${pad}" y1="${lineY}" x2="${w-pad}" y2="${lineY}" stroke="${stripLine}" stroke-width="2" stroke-linecap="round"/>` +
      `</svg>`;
    if (label) label.textContent = '';
  }

  // ─────────────────────────────
  // UPCOMING — other predictions
  // ─────────────────────────────

  renderUpcoming(predictions) {
    const section = document.getElementById('upcoming-section');
    const list = document.getElementById('upcoming-list');
    if (!section || !list) return;

    if (predictions.length === 0) {
      section.style.display = 'none';
      return;
    }

    // Single prediction = hero already shows it, no need for redundant list
    if (predictions.length <= 1) {
      section.style.display = 'none';
      return;
    }

    section.style.display = '';

    // Flat list sorted by arrival time — hero stays in list, highlighted
    const sorted = [...predictions].sort((a, b) => a.etaSeconds - b.etaSeconds);
    const heroVid = this.heroPrediction?.vehicleId;
    const heroTripId = this.heroPrediction?.tripId;

    list.innerHTML = sorted.map(pred => {
      const isHero = heroVid
        ? (pred.vehicleId === heroVid && pred.tripId === heroTripId)
        : (pred === this.heroPrediction);
      return this.renderUpcomingRow(pred, isHero);
    }).join('');

    // ALL rows are tappable → promote to hero
    list.querySelectorAll('.d-upcoming-row').forEach((row, idx) => {
      row.addEventListener('click', () => {
        const vid = row.dataset.vehicle || null;
        const tid = row.dataset.trip || null;
        const dir = row.dataset.dir != null ? parseInt(row.dataset.dir, 10) : null;

        // Track this specific trip (or vehicle, or index for vehicleless predictions)
        this.trackedTripId = tid;
        this.trackedVehicleId = vid;
        this.trackedPredictionIdx = vid ? null : idx;
        this.updateVehicleUrl(vid);

        // Update direction if switching
        if (dir !== null && dir !== this.selectedDirection) {
          this.selectedDirection = dir;
          this.updateDirectionUrl(dir);
        }

        // Load route data if hero switched to a different route (multi-route)
        const newRouteId = row.dataset.route || null;
        if (this.multiRoute && newRouteId && newRouteId !== this.loadedRouteId) {
          this.loadRouteData(newRouteId).then(() => {
            this.renderHero(this.lastPredictions);
            this.renderProgressStrip(this.lastPredictions, this.lastVehicles);
            this.renderUpcoming(this.lastPredictions);
          });
        } else {
          // Re-render everything with new hero (hero is sticky, no scroll needed)
          this.renderHero(this.lastPredictions);
          this.renderProgressStrip(this.lastPredictions, this.lastVehicles);
          this.renderUpcoming(this.lastPredictions);
        }
      });
    });
  }

  renderUpcomingRow(pred, isHero = false) {
    const minutes = Math.floor(pred.etaSeconds / 60);
    const tier = pred.tier || 'active';

    // Status
    let statusHtml;
    if (tier === 'active') {
      const st = this.staleTier(pred.staleSeconds);
      statusHtml = st.html;
    } else if (tier === 'next') {
      statusHtml = '<span class="dot-next"></span> Next run';
    } else {
      statusHtml = '<span class="dot-sched"></span> Scheduled';
    }

    // Arrival time + adherence — always present to prevent row height shifts
    let arrivalStr = '';
    if (minutes >= 5) {
      const arr = new Date(Date.now() + pred.etaSeconds * 1000);
      const adherenceHtml = tier === 'active' ? this.formatAdherence(pred.adherenceSec) : '';
      arrivalStr = ` · ${adherenceHtml}~${this.esc(arr.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))}`;
    }
    // Meta always has content (statusHtml) so height is stable

    // Row color — use route color in multi-route, otherwise by tier
    const predColor = pred.routeColor ? `#${pred.routeColor}` : this.routeColor;
    const rowColor = tier === 'next' ? '#60a5fa' : tier === 'scheduled' ? '#334155' : predColor;

    // Route badge for multi-route mode
    // Route number for multi-route mode — bold colored text, no pill
    const routeNum = this.multiRoute && pred.routeBadge
      ? `<span class="d-upcoming-route" style="color:#${pred.routeColor || 'E85D3A'}">${this.esc(pred.routeBadge)}</span>`
      : '';

    return `
      <div class="d-upcoming-row clickable tier-${tier}${isHero ? ' d-upcoming-hero' : ''}"
           style="--row-color:${rowColor}"
           data-vehicle="${this.esc(pred.vehicleId || '')}"
           data-trip="${this.esc(pred.tripId || '')}"
           data-dir="${pred.directionId != null ? pred.directionId : ''}"
           data-route="${this.esc(pred.routeId || '')}">
        <div class="d-upcoming-info">
          <div class="d-upcoming-headsign">${routeNum}${routeNum ? ' ' : ''}${this.esc(pred.headsign || 'Unknown')}</div>
          <div class="d-upcoming-meta">${statusHtml}${arrivalStr}</div>
        </div>
        <div class="d-upcoming-time">
          <div class="d-upcoming-minutes${tier !== 'active' ? ` tier-${tier}` : ''}">${minutes < 1 ? 'NOW' : minutes}</div>
          <div class="d-upcoming-label">${minutes < 1 ? '' : 'min'}</div>
        </div>
      </div>
    `;
  }

  // Update URL with direction preference (no page reload)
  updateDirectionUrl(dir) {
    const url = new URL(window.location);
    url.searchParams.set('dir', dir);
    window.history.replaceState({}, '', url);
  }

  updateVehicleUrl(vid) {
    const url = new URL(window.location);
    if (vid) {
      url.searchParams.set('vid', vid);
    } else {
      url.searchParams.delete('vid');
    }
    window.history.replaceState({}, '', url);
  }

  // ────────────────────────
  // PULL THE CORD
  // ────────────────────────

  checkCordFired(params) {
    const firedId = params.get('cordFired');
    if (!firedId) return;

    // Clean up server-side (best-effort, may already be gone)
    fetch(`/api/push/cord/${firedId}`, { method: 'DELETE' }).catch(() => {});

    // Reset local cord state
    this.cordActive = false;
    this.cordId = null;
    this.cordFiredId = firedId; // flag so initPullCord shows "delivered" briefly
    try { sessionStorage.removeItem('pullcord_cord'); } catch (e) {}

    // Strip cordFired from URL so refresh doesn't re-trigger
    params.delete('cordFired');
    const clean = params.toString();
    const path = window.location.pathname + (clean ? '?' + clean : '');
    history.replaceState(null, '', path);
  }

  initPullCord() {
    const section = document.getElementById('cord-section');
    if (!section) return;

    // Detect iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;

    // Check if push is supported
    this.pushSupported = 'serviceWorker' in navigator && 'PushManager' in window;

    // iOS Safari (not installed as PWA) — show install prompt
    if (isIOS && !isStandalone) {
      const label = document.getElementById('cord-label');
      const options = document.getElementById('cord-options');
      if (options) options.style.display = 'none';
      if (label) {
        label.innerHTML = '📲 <button class="d-cord-install-hint" type="button">Add to Home Screen for alerts</button>';
        label.querySelector('.d-cord-install-hint')?.addEventListener('click', () => {
          label.innerHTML = 'Tap <strong>Share</strong> → <strong>Add to Home Screen</strong>, then open from there';
        });
      }
      return;
    }

    if (!this.pushSupported) {
      section.style.display = 'none';
      return;
    }

    // Wire up minute option buttons
    section.querySelectorAll('.d-cord-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const minutes = parseInt(btn.dataset.minutes, 10);
        this.activateCord(minutes);
      });
    });

    // Wire up cancel button
    const cancelBtn = document.getElementById('cord-cancel-btn');
    if (cancelBtn) cancelBtn.addEventListener('click', () => this.cancelCord());

    // Restore cord state from sessionStorage (survives page refresh)
    if (!this.cordFiredId) {
      this.restoreCordState();
    }

    // If we arrived from a fired notification, flash confirmation then reset
    if (this.cordFiredId) {
      const label = document.getElementById('cord-label');
      if (label) label.textContent = '✅ Notification delivered!';
      setTimeout(() => {
        if (label) label.textContent = '🔔 Alert me';
      }, 3000);
      this.cordFiredId = null;
    }
  }

  async activateCord(thresholdMinutes) {
    if (!this.heroPrediction) return;

    const cordIdle = document.getElementById('cord-idle');
    const label = document.getElementById('cord-label');
    const activeDisplay = document.getElementById('cord-active-display');

    // Show setting up state
    if (label) label.textContent = 'Setting up...';

    try {
      // 1. Register push-only service worker
      const reg = await navigator.serviceWorker.register('/push-sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;

      // 2. Get VAPID public key from server
      const vapidRes = await fetch('/api/push/vapid');
      const { publicKey } = await vapidRes.json();
      if (!publicKey) throw new Error('No VAPID key');

      // 3. Request notification permission
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        if (label) label.textContent = 'Notifications blocked — check settings';
        setTimeout(() => { if (label) label.textContent = '🔔 Alert me'; }, 3000);
        return;
      }

      // 4. Subscribe to push
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(publicKey),
      });

      // 5. Register cord on server with threshold
      const cordRes = await fetch('/api/push/cord', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          routeId: this.heroPrediction.routeId || this.config.routeId,
          stopId: this.config.stopId,
          vehicleId: this.heroPrediction.vehicleId || null,
          tripId: this.heroPrediction.tripId || null,
          directionId: this.heroPrediction.directionId ?? this.selectedDirection ?? null,
          thresholdMinutes,
        }),
      });

      if (!cordRes.ok) throw new Error(`Server error ${cordRes.status}`);
      const { cordId } = await cordRes.json();
      if (!cordId) throw new Error('No cordId returned');

      // Success — save cord context (trip-first, matches server fallback priority)
      this.cordActive = true;
      this.cordId = cordId;
      this.cordThreshold = thresholdMinutes;
      this.cordTripId = this.heroPrediction.tripId || null;
      this.cordVehicleId = this.heroPrediction.vehicleId || null;
      this.cordDirectionId = this.heroPrediction.directionId ?? this.selectedDirection ?? null;
      this.cordRouteId = this.heroPrediction.routeId || this.config.routeId;
      this.cordStopId = this.config.stopId;
      this.cordStopName = this.data?.stop?.name || this.config.stopId;

      // Persist to sessionStorage (survives page refresh)
      try {
        sessionStorage.setItem('pullcord_cord', JSON.stringify({
          cordId, threshold: thresholdMinutes,
          tripId: this.cordTripId, vehicleId: this.cordVehicleId,
          directionId: this.cordDirectionId, routeId: this.cordRouteId,
          stopId: this.cordStopId, stopName: this.cordStopName,
        }));
      } catch (e) { /* private mode / quota */ }

      if (cordIdle) cordIdle.classList.add('hidden');
      if (activeDisplay) activeDisplay.classList.remove('hidden');

      if (navigator.vibrate) navigator.vibrate([50, 30, 100]);

      this.updateCordStatus();

    } catch (err) {
      console.error('Pull cord setup failed:', err);
      if (label) label.textContent = 'Setup failed — try again';
      setTimeout(() => { if (label) label.textContent = '🔔 Alert me'; }, 3000);
    }
  }

  cancelCord() {
    if (this.cordId) {
      fetch(`/api/push/cord/${this.cordId}`, { method: 'DELETE' }).catch(() => {});
    }
    this.cordActive = false;
    this.cordId = null;
    this.cordTripId = null;
    this.cordVehicleId = null;
    this.cordDirectionId = null;
    this.cordRouteId = null;
    this.cordStopId = null;
    this.cordStopName = null;
    try { sessionStorage.removeItem('pullcord_cord'); } catch (e) {}

    const cordIdle = document.getElementById('cord-idle');
    const activeDisplay = document.getElementById('cord-active-display');
    const label = document.getElementById('cord-label');

    if (label) label.textContent = '🔔 Alert me';
    if (cordIdle) cordIdle.classList.remove('hidden');
    if (activeDisplay) activeDisplay.classList.add('hidden');
  }

  restoreCordState() {
    try {
      const raw = sessionStorage.getItem('pullcord_cord');
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved.cordId) return;

      this.cordActive = true;
      this.cordId = saved.cordId;
      this.cordThreshold = saved.threshold;
      this.cordTripId = saved.tripId || null;
      this.cordVehicleId = saved.vehicleId || null;
      this.cordDirectionId = saved.directionId ?? null;
      this.cordRouteId = saved.routeId || null;
      this.cordStopId = saved.stopId || null;
      this.cordStopName = saved.stopName || saved.stopId || null;

      const cordIdle = document.getElementById('cord-idle');
      const activeDisplay = document.getElementById('cord-active-display');
      if (cordIdle) cordIdle.classList.add('hidden');
      if (activeDisplay) activeDisplay.classList.remove('hidden');
    } catch (e) { /* corrupt data or private mode */ }
  }

  updateCordStatus() {
    const statusText = document.getElementById('cord-status-text');
    if (!statusText || !this.cordActive) return;

    // Only use local predictions if we're viewing the cord's stop
    const onCordStop = this.cordStopId && this.config.stopId === this.cordStopId;

    if (onCordStop) {
      // Find prediction matching cord context (trip-first, same priority as server)
      const preds = this.lastPredictions;
      let pred;
      if (this.cordTripId) pred = preds.find(p => p.tripId === this.cordTripId);
      if (!pred && this.cordVehicleId) pred = preds.find(p => p.vehicleId === this.cordVehicleId);
      if (!pred && this.cordDirectionId != null) pred = preds.find(p => p.directionId === this.cordDirectionId);
      if (!pred && preds.length > 0) pred = preds[0];

      if (pred) {
        const mins = Math.floor(pred.etaSeconds / 60);
        statusText.textContent = `${this.cordThreshold}m alert · bus ${mins}m away`;
      } else {
        statusText.textContent = `${this.cordThreshold}m alert · waiting for bus`;
      }
    } else {
      // Viewing a different stop — show static cord info, don't use wrong predictions
      const name = this.cordStopName || 'another stop';
      statusText.textContent = `${this.cordThreshold}m alert active for ${name}`;
    }
  }

  checkPullCord() {
    if (!this.cordActive) return;

    // Periodically verify cord still exists server-side (every 30s)
    // Catches fired/expired cords that the client missed (e.g., notification clicked
    // outside the app, or app was backgrounded when the push arrived)
    const now = Date.now();
    if (this.cordId && (!this._lastCordCheck || now - this._lastCordCheck > 30000)) {
      this._lastCordCheck = now;
      fetch(`/api/push/cord/${this.cordId}`, { method: 'HEAD' })
        .then(res => {
          if (res.status === 404) {
            // Cord is gone — fired or expired
            console.log('Cord no longer exists server-side, clearing local state');
            this.cancelCord();
          }
        })
        .catch(() => {}); // network error — leave state alone
    }

    this.updateCordStatus();
  }

  // Convert VAPID key from base64url to Uint8Array
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }

  // ───────────────────────
  // MAP (on demand)
  // ───────────────────────

  initMapToggle() {
    const toggleBtn = document.getElementById('map-toggle-btn');
    const closeBtn = document.getElementById('map-close-btn');
    const toggleText = document.getElementById('map-toggle-text');

    if (toggleBtn) toggleBtn.addEventListener('click', () => {
      // Live hero → navigate to ride view
      if (this.focusedVehicleId && this.heroPrediction?.tier === 'active' && this.heroPrediction.tripId) {
        const tripId = this.heroPrediction.tripId;
        const stopId = this.config.stopId;
        const routeId = this.heroPrediction.routeId || this.config.routeId;
        window.location.href = `/ride?trip=${encodeURIComponent(tripId)}&stop=${encodeURIComponent(stopId)}&route=${encodeURIComponent(routeId)}`;
        return;
      }
      this.showMap();
    });
    if (closeBtn) closeBtn.addEventListener('click', () => this.hideMap());
  }

  showMap() {
    if (this.mapVisible) return;
    this.mapVisible = true;
    const panel = document.getElementById('map-panel');
    if (panel) panel.classList.add('map-visible');

    if (!this.map) {
      // Delay init slightly for animation to start
      setTimeout(() => this.initMap(), 100);
    } else {
      this.map.invalidateSize();
    }
  }

  hideMap() {
    this.mapVisible = false;
    const panel = document.getElementById('map-panel');
    if (panel) panel.classList.remove('map-visible');
  }

  initMap() {
    const { stop } = this.data;

    this.map = L.map('map', {
      zoomControl: false,
      attributionControl: false
    }).setView([stop.lat, stop.lon], 15);

    // Adaptive map tiles — dark for dark mode, light positron for light mode
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const tileUrl = prefersDark
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
    L.tileLayer(tileUrl, {
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(this.map);

    L.control.attribution({ position: 'bottomright', prefix: false })
      .addAttribution('© <a href="https://carto.com" style="color:#64748b">CARTO</a>')
      .addTo(this.map);

    L.control.zoom({ position: 'topleft' }).addTo(this.map);

    this.drawRouteShapes();
    this.addStopMarkers();
    this.addActiveStopMarker();
    this.updateMapMarkers(this.lastVehicles);

    // If tracking a live bus, focus between bus and stop; otherwise center on stop
    if (this.focusedVehicleId) {
      this.focusOnBus(this.focusedVehicleId);
    } else {
      this.map.setView([stop.lat, stop.lon], 15);
    }

    // Recenter button
    const btn = document.getElementById('recenter-btn');
    if (btn) btn.addEventListener('click', () => {
      this.focusedVehicleId = null;
      this.map.setView([stop.lat, stop.lon], 15);
    });
  }

  clearMapRoute() {
    if (!this.map) return;
    this.routePolylines.forEach(p => this.map.removeLayer(p));
    this.routePolylines = [];
    this.stopMarkersList.forEach(m => this.map.removeLayer(m));
    this.stopMarkersList = [];
  }

  drawMapRoute() {
    if (!this.map || !this.data.shapes) return;
    this.drawRouteShapes();
    this.addStopMarkers();
  }

  drawRouteShapes() {
    const shapes = this.data.shapes;
    if (!shapes) return;
    Object.values(shapes).forEach(coords => {
      if (coords.length === 0) return;
      // Outline
      L.polyline(coords, {
        color: '#1e293b', weight: 8, opacity: 0.8,
        lineCap: 'round', lineJoin: 'round'
      }).addTo(this.map);
      // Route color
      const poly = L.polyline(coords, {
        color: this.routeColor, weight: 4, opacity: 0.9,
        lineCap: 'round', lineJoin: 'round'
      }).addTo(this.map);
      this.routePolylines.push(poly);
    });
  }

  addStopMarkers() {
    const stops = this.data.stops;
    const active = this.data.stop;
    if (!stops || !active) return;
    stops.forEach(s => {
      if (s.id === active.id) return;
      const icon = L.divIcon({
        html: `<div class="route-stop-dot" style="--route-color:${this.routeColor}"></div>`,
        className: '', iconSize: [8, 8], iconAnchor: [4, 4]
      });
      const m = L.marker([s.lat, s.lon], { icon }).addTo(this.map);
      m.bindPopup(`<b>${this.esc(s.name)}</b>`);
      this.stopMarkersList.push(m);
    });
  }

  addActiveStopMarker() {
    const { stop } = this.data;
    const icon = L.divIcon({
      html: '<div class="stop-pulse"></div>',
      className: '', iconSize: [20, 20], iconAnchor: [10, 10]
    });
    this.activeStopMarker = L.marker([stop.lat, stop.lon], { icon, zIndexOffset: 1000 }).addTo(this.map);
  }

  updateMapMarkers(vehicles) {
    if (!this.map) return;

    this.busMarkers.forEach(info => this.map.removeLayer(info.marker));
    this.busMarkers.clear();

    vehicles.forEach(v => {
      const isFocused = this.focusedVehicleId === v.id;
      const stale = v.staleSeconds >= 90;
      const lost = v.staleSeconds >= 180;

      const icon = L.divIcon({
        html: `<div class="bus-marker${isFocused ? ' bus-marker-focused' : ''}${stale ? ' bus-marker-stale' : ''}${lost ? ' bus-marker-lost' : ''}" style="--bus-color:${this.routeColor}">
          <div class="bus-marker-arrow" style="--bearing:${v.bearing || 0}deg;--bus-color:${this.routeColor}"></div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="2" width="18" height="16" rx="3"/><path d="M8 6v6M16 6v6M2 12h20"/><circle cx="7" cy="16" r="1" fill="#fff"/><circle cx="17" cy="16" r="1" fill="#fff"/></svg>
        </div>`,
        className: '', iconSize: [32, 32], iconAnchor: [16, 16]
      });

      const compass = this.bearingToCompass(v.bearing);
      const tier = this.staleTier(v.staleSeconds);
      const marker = L.marker([v.lat, v.lon], { icon, zIndexOffset: isFocused ? 900 : 500 }).addTo(this.map);
      marker.bindPopup(`<b>${this.esc(v.headsign || 'Unknown')}</b><br><small>Heading ${compass} · ${tier.level === 'live' ? 'Live' : tier.level === 'delayed' ? 'Signal delayed' : `${Math.floor(v.staleSeconds/60)}m stale`}</small>`);

      const info = { marker, lat: v.lat, lon: v.lon, headsign: v.headsign };
      this.busMarkers.set(v.id, info);
      if (v.vehicleId && v.vehicleId !== v.id) this.busMarkers.set(v.vehicleId, info);
    });
  }

  focusOnBus(vehicleId) {
    if (!this.map) return;
    const info = this.busMarkers.get(vehicleId);
    if (!info) return;

    this.focusedVehicleId = vehicleId;
    const stopLat = this.data.stop.lat;
    const stopLon = this.data.stop.lon;
    const bounds = L.latLngBounds([info.lat, info.lon], [stopLat, stopLon]);
    this.map.fitBounds(bounds.pad(0.3));
    info.marker.openPopup();

    const el = info.marker.getElement();
    if (el) {
      el.classList.add('bus-focused');
      setTimeout(() => el.classList.remove('bus-focused'), 3000);
    }
  }

  // ────────────────────────────────
  // MULTI-ROUTE DISCOVERY
  // ────────────────────────────────

  async discoverOtherRoutes() {
    try {
      const stopName = this.data.stop.name;
      const res = await fetch(`/api/stops?q=${encodeURIComponent(stopName)}&limit=5`);
      const stops = await res.json();

      // Find our stop
      const myStop = stops.find(s => s.stop_id === this.data.stop.id);
      if (!myStop || !myStop.routes) return;

      const currentRoute = this.config.routeShortName || this.data.route.shortName;
      const otherRoutes = myStop.routes.filter(r => r !== currentRoute);
      if (otherRoutes.length === 0) return;

      this.renderRouteTabs(currentRoute, otherRoutes);
    } catch (e) { /* silent */ }
  }

  renderRouteTabs(current, others) {
    const container = document.getElementById('route-tabs');
    if (!container) return;

    // Only show tabs if there ARE other routes — no need to show just the current one
    if (others.length === 0) {
      container.innerHTML = '';
      return;
    }

    const basePath = window.__BASE_PATH__ || '';
    const stopId = this.config.stopId;

    let html = `<span class="d-route-tab-label">Also here:</span>`;
    others.forEach(r => {
      html += `<a href="${basePath}/bus?route=${r}&stop=${stopId}" class="d-route-tab">${this.esc(r)}</a>`;
    });

    container.innerHTML = html;
  }

  // ──────────────
  // UTILITIES
  // ──────────────

  // Middle-truncate long text: "Inman Park/Reynoldstown Station via Woodland Hills" → "Inman Park…Woodland Hills"
  // Cuts at word boundaries (space, /, parens) when possible
  truncateMiddle(text, maxLen) {
    if (!text || text.length <= maxLen) return text;
    const budget = maxLen - 1; // 1 char for ellipsis
    const startBudget = Math.ceil(budget * 0.5);
    const endBudget = Math.floor(budget * 0.5);

    // Find break point for start (search backward from cut point)
    // Break on space, /, or opening paren
    let startEnd = -1;
    for (let i = startBudget; i >= startBudget * 0.3; i--) {
      if (' /('.includes(text[i])) { startEnd = i; break; }
    }
    if (startEnd < 0) startEnd = startBudget; // no good break, hard cut
    const startPart = text.substring(0, startEnd).trim();

    // Find break point for end (search forward from cut point)
    const endCutFrom = text.length - endBudget;
    let endStart = -1;
    for (let i = endCutFrom; i < text.length - endBudget * 0.3; i++) {
      if (' /('.includes(text[i])) { endStart = i; break; }
    }
    if (endStart < 0) endStart = endCutFrom;
    const endPart = text.substring(endStart).trim();

    return startPart + '…' + endPart;
  }

  // Format adherence delta for display
  // adherenceSec: positive = late, negative = early, null/undefined = unknown
  formatAdherence(adherenceSec) {
    if (adherenceSec == null) return '';
    const absSec = Math.abs(adherenceSec);
    // Suppress noise: |delta| <= 60s is basically on time
    if (absSec <= 60) return '<span class="d-adherence d-adherence-ontime">on time </span>';
    const mins = Math.round(absSec / 60);
    if (adherenceSec > 0) {
      return `<span class="d-adherence d-adherence-late">${mins}m late </span>`;
    } else {
      return `<span class="d-adherence d-adherence-early">${mins}m early </span>`;
    }
  }

  staleTier(s) {
    if (s == null || s < 45) return { level: 'live', html: '<span class="dot-live"></span> Live' };
    if (s < 90) return { level: 'delayed', html: '<span class="dot-delayed"></span> ~1m ago' };
    if (s < 180) {
      const m = Math.floor(s / 60);
      return { level: 'stale', html: `<span class="dot-stale"></span> ~${m}m ago` };
    }
    const m = Math.floor(s / 60);
    return { level: 'lost', html: `<span class="dot-lost"></span> Last seen ${m}m ago` };
  }

  bearingToCompass(b) {
    if (b == null) return '';
    const dirs = ['N','NE','E','SE','S','SW','W','NW'];
    return dirs[Math.round(b / 45) % 8];
  }

  findNearestStop(stops, lat, lon) {
    let minDist = Infinity;
    let minIdx = -1;
    for (let i = 0; i < stops.length; i++) {
      const d = this.dist(lat, lon, stops[i].lat, stops[i].lon);
      if (d < minDist) { minDist = d; minIdx = i; }
    }
    return { index: minIdx, distance: minDist };
  }

  dist(lat1, lon1, lat2, lon2) {
    // Simple equirectangular approximation (fine for short distances)
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const mLat = (lat1 + lat2) / 2 * Math.PI / 180;
    const dx = dLon * Math.cos(mLat) * R;
    const dy = dLat * R;
    return Math.sqrt(dx * dx + dy * dy);
  }

  showOffline() {
    const el = document.getElementById('connection-status');
    if (el) el.style.display = '';
  }

  hideOffline() {
    const el = document.getElementById('connection-status');
    if (el) el.style.display = 'none';
  }

  esc(s) {
    if (!s) return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
}

new PullcordApp();
