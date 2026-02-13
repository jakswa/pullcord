// Pullcord Client-Side JavaScript
// Mobile-first MARTA bus tracker

class PullcordApp {
  constructor() {
    this.map = null;
    this.busMarkers = new Map(); // vehicleId -> { marker, lat, lon, headsign }
    this.routePolylines = [];
    this.stopMarkers = [];
    this.pollTimer = null;
    this.refreshBar = null;
    this.focusedVehicleId = null;
    this.lastPredictions = []; // store for click-to-focus lookups
    
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
  }

  detectPage() {
    if (document.getElementById('map')) return 'tracker';
    if (document.getElementById('stop-search')) return 'home';
    return 'unknown';
  }

  // ===== HOME PAGE =====
  initHomePage() {
    const searchInput = document.getElementById('stop-search');
    const locationBtn = document.getElementById('location-btn');
    const resultsContainer = document.getElementById('search-results');
    const resultsList = document.getElementById('results-list');
    const loadingDiv = document.getElementById('search-loading');

    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      const query = e.target.value.trim();
      if (query.length < 2) { this.hideResults(); return; }
      searchTimeout = setTimeout(() => {
        this.searchStops(query, resultsList, resultsContainer, loadingDiv);
      }, 300);
    });

    locationBtn.addEventListener('click', () => {
      this.findNearbyStops(resultsList, resultsContainer, loadingDiv);
    });
  }

  async searchStops(query, resultsList, resultsContainer, loadingDiv) {
    try {
      this.showLoading(loadingDiv, resultsContainer);
      const response = await fetch(`/api/stops?q=${encodeURIComponent(query)}`);
      const stops = await response.json();
      this.displayStops(stops, resultsList, resultsContainer, loadingDiv);
    } catch (error) {
      console.error('Search error:', error);
      this.showError('Failed to search stops', resultsList, resultsContainer, loadingDiv);
    }
  }

  async findNearbyStops(resultsList, resultsContainer, loadingDiv) {
    if (!navigator.geolocation) {
      this.showError('Geolocation not supported', resultsList, resultsContainer, loadingDiv);
      return;
    }
    this.showLoading(loadingDiv, resultsContainer);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const response = await fetch(`/api/stops?lat=${latitude}&lon=${longitude}&radius=800`);
          const stops = await response.json();
          this.displayStops(stops, resultsList, resultsContainer, loadingDiv);
        } catch (error) {
          this.showError('Failed to find nearby stops', resultsList, resultsContainer, loadingDiv);
        }
      },
      () => this.showError('Location access denied', resultsList, resultsContainer, loadingDiv),
      { timeout: 10000, enableHighAccuracy: false }
    );
  }

  displayStops(stops, resultsList, resultsContainer, loadingDiv) {
    // Ensure loading is hidden and results are visible
    this.hideLoading();
    if (loadingDiv) loadingDiv.classList.add('hidden');
    if (resultsContainer) resultsContainer.classList.remove('hidden');
    
    const header = document.getElementById('results-header');
    if (header) {
      header.textContent = stops.length > 0 && stops[0].distance 
        ? `${stops.length} stops nearby`
        : `${stops.length} results`;
    }
    
    if (stops.length === 0) {
      resultsList.innerHTML = '<div class="home-status">No stops found</div>';
      return;
    }
    resultsList.innerHTML = stops.map(stop => `
      <div class="home-stop-card">
        <div class="home-stop-name">${this.esc(stop.stop_name)}</div>
        ${stop.distance ? `<div class="home-stop-distance">${Math.round(stop.distance)}m away</div>` : ''}
        <div class="home-stop-routes">
          ${stop.routes.map(route => `
            <a href="/bus?route=${route}&stop=${stop.stop_id}" class="home-route-chip">
              ${route}
            </a>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  showLoading(loadingDiv, resultsContainer) {
    if (loadingDiv) loadingDiv.classList.remove('hidden');
    if (resultsContainer) resultsContainer.classList.add('hidden');
  }

  hideLoading() {
    const ld = document.getElementById('search-loading');
    const rc = document.getElementById('search-results');
    if (ld) ld.classList.add('hidden');
    if (rc) rc.classList.remove('hidden');
  }

  showError(message, resultsList, resultsContainer, loadingDiv) {
    if (loadingDiv) loadingDiv.classList.add('hidden');
    if (resultsContainer) resultsContainer.classList.remove('hidden');
    if (resultsList) resultsList.innerHTML = `<div class="home-status" style="color:#ef4444">${message}</div>`;
  }

  hideResults() {
    const c = document.getElementById('search-results');
    if (c) c.classList.add('hidden');
  }

  // ===== TRACKER PAGE =====
  initTrackerPage() {
    if (!window.__INITIAL_DATA__ || !window.__CONFIG__) return;
    this.data = window.__INITIAL_DATA__;
    this.config = window.__CONFIG__;
    this.routeColor = this.data.route.color ? `#${this.data.route.color}` : '#2563eb';

    this.initRefreshBar();
    this.initMap();
    this.initControls();
    this.startPolling();
  }

  // --- Refresh progress bar ---
  initRefreshBar() {
    this.refreshBar = document.getElementById('refresh-bar');
  }

  startRefreshCycle() {
    if (!this.refreshBar) return;
    this.refreshBar.classList.remove('refreshing');
    void this.refreshBar.offsetWidth;
    this.refreshBar.classList.add('refreshing');
  }

  flashUpdate() {
    if (this.refreshBar) {
      this.refreshBar.classList.add('refresh-flash');
      setTimeout(() => this.refreshBar.classList.remove('refresh-flash'), 600);
    }
  }

  // --- Map ---
  initMap() {
    const { stop } = this.data;
    
    this.map = L.map('map', {
      zoomControl: false,
      attributionControl: false
    }).setView([stop.lat, stop.lon], 15);

    // CartoDB Positron — clean, minimal
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(this.map);

    L.control.attribution({ position: 'bottomright', prefix: false })
      .addAttribution('© <a href="https://carto.com">CARTO</a> · <a href="https://osm.org">OSM</a>')
      .addTo(this.map);

    L.control.zoom({ position: 'topleft' }).addTo(this.map);

    this.drawRouteShapes();
    this.addStopMarkers();
    this.addActiveStopMarker();
    // Start centered on the stop at a useful zoom — not the whole route
    this.map.setView([stop.lat, stop.lon], 15);
  }

  drawRouteShapes() {
    const { shapes } = this.data;
    
    Object.values(shapes).forEach(coordinates => {
      if (coordinates.length === 0) return;
      
      // White outline
      L.polyline(coordinates, {
        color: '#ffffff',
        weight: 9,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(this.map);
      
      // Route color
      const polyline = L.polyline(coordinates, {
        color: this.routeColor,
        weight: 5,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(this.map);
      
      this.routePolylines.push(polyline);
    });
  }

  addStopMarkers() {
    const { stops, stop: activeStop } = this.data;
    
    stops.forEach(s => {
      if (s.id === activeStop.id) return;
      
      const icon = L.divIcon({
        html: `<div class="route-stop-dot" style="--route-color: ${this.routeColor}"></div>`,
        className: '',
        iconSize: [8, 8],
        iconAnchor: [4, 4]
      });
      
      const marker = L.marker([s.lat, s.lon], { icon }).addTo(this.map);
      marker.bindPopup(`<b>${this.esc(s.name)}</b>`);
      this.stopMarkers.push(marker);
    });
  }

  addActiveStopMarker() {
    const { stop } = this.data;
    
    const icon = L.divIcon({
      html: '<div class="stop-pulse"></div>',
      className: '',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
    
    this.activeStopMarker = L.marker([stop.lat, stop.lon], { icon, zIndexOffset: 1000 })
      .addTo(this.map);
  }

  fitToRoute() {
    if (this.routePolylines.length > 0) {
      const group = L.featureGroup(this.routePolylines);
      this.map.fitBounds(group.getBounds().pad(0.05));
    }
  }

  focusOnBus(vehicleId) {
    const busInfo = this.busMarkers.get(vehicleId);
    if (!busInfo) return;
    
    // Highlight the focused bus
    this.focusedVehicleId = vehicleId;
    
    // Pan + zoom to show bus and stop
    const stopLat = this.data.stop.lat;
    const stopLon = this.data.stop.lon;
    const bounds = L.latLngBounds(
      [busInfo.lat, busInfo.lon],
      [stopLat, stopLon]
    );
    this.map.fitBounds(bounds.pad(0.3));
    
    // Open the bus popup
    busInfo.marker.openPopup();
    
    // Pulse the bus marker
    const el = busInfo.marker.getElement();
    if (el) {
      el.classList.add('bus-focused');
      setTimeout(() => el.classList.remove('bus-focused'), 3000);
    }
    
    // Scroll map into view on mobile
    const mapEl = document.getElementById('map');
    if (mapEl) {
      mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  initControls() {
    const btn = document.getElementById('recenter-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        this.focusedVehicleId = null;
        this.map.setView([this.data.stop.lat, this.data.stop.lon], 15);
      });
    }
  }

  async startPolling() {
    await this.updateData();
    this.pollTimer = setInterval(() => this.updateData(), this.config.pollInterval);
  }

  async updateData() {
    try {
      const [vRes, pRes] = await Promise.all([
        fetch(`/api/realtime/${this.config.routeId}`),
        fetch(`/api/predictions/${this.config.routeId}/${this.config.stopId}`)
      ]);
      
      const vehiclesData = await vRes.json();
      const predictionsData = await pRes.json();
      
      this.updateBusMarkers(vehiclesData.vehicles);
      this.lastPredictions = predictionsData.predictions || [];
      this.updateETAs(this.lastPredictions);
      this.updateStatus(vehiclesData.vehicles.length);
      this.flashUpdate();
      this.startRefreshCycle();
      this.hideOffline();
    } catch (e) {
      console.error('Update error:', e);
      this.showOffline();
    }
  }

  updateBusMarkers(vehicles) {
    // Remove old markers
    this.busMarkers.forEach(info => this.map.removeLayer(info.marker));
    this.busMarkers.clear();
    
    vehicles.forEach(v => {
      const isFocused = this.focusedVehicleId === v.id;
      const stale = v.staleSeconds >= 90;
      const lost = v.staleSeconds >= 180;
      
      const icon = L.divIcon({
        html: `
          <div class="bus-marker${isFocused ? ' bus-marker-focused' : ''}${stale ? ' bus-marker-stale' : ''}${lost ? ' bus-marker-lost' : ''}" style="--bus-color: ${this.routeColor}">
            <div class="bus-marker-arrow" style="--bearing: ${v.bearing || 0}deg; --bus-color: ${this.routeColor}"></div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="2" width="18" height="16" rx="3"/><path d="M8 6v6M16 6v6M2 12h20"/><circle cx="7" cy="16" r="1" fill="#fff"/><circle cx="17" cy="16" r="1" fill="#fff"/></svg>
          </div>`,
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });
      
      // Compass from bearing for popup
      const compass = this.bearingToCompass(v.bearing);
      const tier = this.staleTier(v.staleSeconds);
      const marker = L.marker([v.lat, v.lon], { icon, zIndexOffset: isFocused ? 900 : 500 }).addTo(this.map);
      marker.bindPopup(`
        <b>${this.esc(v.headsign || 'Unknown')}</b><br>
        <small>Heading ${compass} · ${tier.level === 'live' ? 'Live' : 
          tier.level === 'delayed' ? 'Signal delayed' :
          `Position ${Math.floor(v.staleSeconds/60)}m stale`}</small>
      `);
      
      // Store by both entity id AND internal vehicleId so predictions can find them
      const info = { marker, lat: v.lat, lon: v.lon, headsign: v.headsign };
      this.busMarkers.set(v.id, info);
      if (v.vehicleId && v.vehicleId !== v.id) {
        this.busMarkers.set(v.vehicleId, info);
      }
    });
  }

  updateETAs(predictions) {
    const container = document.getElementById('eta-cards');
    const loading = document.getElementById('eta-loading');
    const empty = document.getElementById('eta-empty');
    
    loading.style.display = 'none';
    
    if (!predictions || predictions.length === 0) {
      empty.style.display = '';
      const cards = container.querySelectorAll('.eta-group');
      cards.forEach(c => c.remove());
      return;
    }
    
    empty.style.display = 'none';
    
    // Group by headsign
    const grouped = {};
    predictions.forEach(pred => {
      const key = pred.headsign || 'Unknown';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(pred);
    });
    
    // Remove old
    const old = container.querySelectorAll('.eta-group');
    old.forEach(c => c.remove());
    
    Object.entries(grouped).forEach(([headsign, preds]) => {
      const group = document.createElement('div');
      group.className = 'eta-group';
      
      // Direction header
      const header = document.createElement('div');
      header.className = 'eta-group-header';
      header.innerHTML = `<span class="eta-group-arrow">→</span> ${this.esc(headsign)}`;
      group.appendChild(header);
      
      preds.forEach((pred) => {
        const minutes = Math.floor(pred.etaSeconds / 60);
        const tier = pred.tier || 'active';
        const isArriving = minutes < 2 && tier === 'active';
        const isClickable = (tier === 'active' || tier === 'next') && !!pred.vehicleId;
        
        // Arrival time estimate
        const arrivalTime = new Date(Date.now() + pred.etaSeconds * 1000);
        const timeStr = arrivalTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        
        const row = document.createElement('div');
        row.className = `eta-row eta-tier-${tier} eta-row-update${isClickable ? ' eta-clickable' : ''}`;
        row.style.setProperty('--route-color', this.routeColor);
        
        if (isClickable) {
          row.addEventListener('click', () => this.focusOnBus(pred.vehicleId));
        }
        
        // Status text based on tier
        let statusHtml;
        if (tier === 'active') {
          const staleness = this.staleTier(pred.staleSeconds);
          statusHtml = staleness.html;
        } else if (tier === 'next') {
          statusHtml = '<span class="eta-next-dot"></span> On another run';
        } else {
          statusHtml = '<span class="eta-sched-dot"></span> Scheduled';
        }
        
        row.innerHTML = `
          <div class="eta-direction">
            <div class="eta-meta">
              ${statusHtml}
              ${minutes >= 10 ? ` · ~${timeStr}` : ''}
            </div>
          </div>
          <div class="eta-time">
            <div class="eta-minutes${isArriving ? ' arriving' : ''}">${minutes < 1 ? 'NOW' : minutes}</div>
            <div class="eta-label">${minutes < 1 ? '' : 'min'}</div>
          </div>
          ${isClickable ? '<div class="eta-chevron">›</div>' : ''}
        `;
        group.appendChild(row);
      });
      
      container.appendChild(group);
    });
  }

  updateStatus(count) {
    const el = document.getElementById('last-updated');
    if (el) {
      el.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
    }
    const vc = document.getElementById('vehicle-count');
    if (vc) vc.textContent = count;
  }

  bearingToCompass(b) {
    if (b == null) return '';
    const dirs = ['N','NE','E','SE','S','SW','W','NW'];
    return dirs[Math.round(b / 45) % 8];
  }

  // Staleness tiers based on MARTA data analysis:
  // Baseline lag is 23-35s (normal), buses report every ~30s, dropouts common
  staleTier(s) {
    if (s < 45) {
      return { level: 'live', html: '<span class="eta-live-dot"></span> Live' };
    } else if (s < 90) {
      return { level: 'delayed', html: '<span class="eta-delayed-dot"></span> Delayed' };
    } else if (s < 180) {
      const m = Math.floor(s / 60);
      return { level: 'stale', html: `<span class="eta-stale-dot"></span> ~${m}m ago · position may be off` };
    } else {
      const m = Math.floor(s / 60);
      return { level: 'lost', html: `<span class="eta-lost-dot"></span> Last seen ${m}m ago` };
    }
  }

  fmtStale(s) {
    if (s < 60) return `${s}s ago`;
    return `${Math.floor(s / 60)}m ago`;
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
