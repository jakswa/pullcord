// Pullcord Client-Side JavaScript
// Handles Leaflet map, polling, and real-time updates

class PullcordApp {
  constructor() {
    this.map = null;
    this.busMarkers = new Map(); // vehicleId -> marker
    this.routePolylines = [];
    this.stopMarkers = [];
    this.pollTimer = null;
    this.lastUpdate = null;
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
    } else {
      this.init();
    }
  }

  init() {
    const page = this.detectPage();
    
    if (page === 'home') {
      this.initHomePage();
    } else if (page === 'tracker') {
      this.initTrackerPage();
    }
  }

  detectPage() {
    if (document.getElementById('map')) return 'tracker';
    if (document.getElementById('stop-search')) return 'home';
    return 'unknown';
  }

  // HOME PAGE FUNCTIONALITY
  initHomePage() {
    const searchInput = document.getElementById('stop-search');
    const locationBtn = document.getElementById('location-btn');
    const resultsContainer = document.getElementById('search-results');
    const resultsList = document.getElementById('results-list');
    const loadingDiv = document.getElementById('search-loading');

    // Search input handler with debouncing
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      const query = e.target.value.trim();
      
      if (query.length < 2) {
        this.hideResults();
        return;
      }
      
      searchTimeout = setTimeout(() => {
        this.searchStops(query, resultsList, resultsContainer, loadingDiv);
      }, 300);
    });

    // Location button handler
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
          console.error('Location search error:', error);
          this.showError('Failed to find nearby stops', resultsList, resultsContainer, loadingDiv);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        this.showError('Location access denied', resultsList, resultsContainer, loadingDiv);
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  }

  displayStops(stops, resultsList, resultsContainer, loadingDiv) {
    loadingDiv.classList.add('hidden');
    resultsContainer.classList.remove('hidden');
    
    if (stops.length === 0) {
      resultsList.innerHTML = '<p class="text-gray-500 text-center py-4">No stops found</p>';
      return;
    }
    
    resultsList.innerHTML = stops.map(stop => `
      <div class="border rounded-lg p-4 hover:bg-gray-50">
        <div class="font-medium text-gray-900 mb-1">${this.escapeHtml(stop.stop_name)}</div>
        <div class="text-sm text-gray-600 mb-3">Routes: ${stop.routes.join(', ')}</div>
        <div class="space-y-2">
          ${stop.routes.map(route => `
            <a href="/bus?route=${route}&stop=${stop.stop_id}" 
               class="inline-block bg-blue-600 text-white px-3 py-1 text-sm rounded hover:bg-blue-700 mr-2">
              Route ${route}
            </a>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  showLoading(loadingDiv, resultsContainer) {
    loadingDiv.classList.remove('hidden');
    resultsContainer.classList.add('hidden');
  }

  showError(message, resultsList, resultsContainer, loadingDiv) {
    loadingDiv.classList.add('hidden');
    resultsContainer.classList.remove('hidden');
    resultsList.innerHTML = `<p class="text-red-600 text-center py-4">${message}</p>`;
  }

  hideResults() {
    const resultsContainer = document.getElementById('search-results');
    if (resultsContainer) {
      resultsContainer.classList.add('hidden');
    }
  }

  // TRACKER PAGE FUNCTIONALITY
  initTrackerPage() {
    if (!window.__INITIAL_DATA__ || !window.__CONFIG__) {
      console.error('Missing initial data');
      return;
    }

    this.initialData = window.__INITIAL_DATA__;
    this.config = window.__CONFIG__;

    // Initialize map
    this.initMap();
    
    // Setup polling
    this.startPolling();
    
    // Setup controls
    this.initControls();
  }

  initMap() {
    const { stop } = this.initialData;
    
    // Create map centered on the stop
    this.map = L.map('map').setView([stop.lat, stop.lon], 15);
    
    // Add tile layer (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(this.map);
    
    // Draw route shapes
    this.drawRouteShapes();
    
    // Add stop markers
    this.addStopMarkers();
    
    // Add active stop marker
    this.addActiveStopMarker();
  }

  drawRouteShapes() {
    const { route, shapes } = this.initialData;
    const color = route.color ? `#${route.color}` : '#1f2937';
    
    Object.entries(shapes).forEach(([direction, coordinates]) => {
      if (coordinates.length > 0) {
        const polyline = L.polyline(coordinates, {
          color: color,
          weight: 4,
          opacity: 0.7
        }).addTo(this.map);
        
        this.routePolylines.push(polyline);
      }
    });
  }

  addStopMarkers() {
    const { stops, stop: activeStop } = this.initialData;
    
    stops.forEach(stop => {
      if (stop.id === activeStop.id) return; // Skip active stop, will add separately
      
      const marker = L.circleMarker([stop.lat, stop.lon], {
        radius: 6,
        fillColor: '#6B7280',
        color: 'white',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
      }).addTo(this.map);
      
      marker.bindPopup(stop.name);
      this.stopMarkers.push(marker);
    });
  }

  addActiveStopMarker() {
    const { stop } = this.initialData;
    
    // Create a larger, highlighted marker for the active stop
    const marker = L.circleMarker([stop.lat, stop.lon], {
      radius: 12,
      fillColor: '#EF4444',
      color: 'white',
      weight: 3,
      opacity: 1,
      fillOpacity: 0.9
    }).addTo(this.map);
    
    marker.bindPopup(`<strong>${stop.name}</strong><br/>Your stop`).openPopup();
    this.activeStopMarker = marker;
  }

  initControls() {
    // Recenter button
    const recenterBtn = document.getElementById('recenter-btn');
    if (recenterBtn) {
      recenterBtn.addEventListener('click', () => {
        const { stop } = this.initialData;
        this.map.setView([stop.lat, stop.lon], 15);
      });
    }
  }

  async startPolling() {
    // Initial load
    await this.updateData();
    
    // Set up recurring updates
    this.pollTimer = setInterval(() => {
      this.updateData();
    }, this.config.pollInterval);
  }

  async updateData() {
    try {
      // Fetch realtime data
      const [vehiclesResponse, predictionsResponse] = await Promise.all([
        fetch(`/api/realtime/${this.config.routeId}`),
        fetch(`/api/predictions/${this.config.routeId}/${this.config.stopId}`)
      ]);
      
      const vehiclesData = await vehiclesResponse.json();
      const predictionsData = await predictionsResponse.json();
      
      // Update map
      this.updateBusMarkers(vehiclesData.vehicles);
      
      // Update ETAs
      this.updateETACards(predictionsData.predictions);
      
      // Update status
      this.updateStatus(vehiclesData.vehicles.length);
      
      // Hide connection error if shown
      this.hideConnectionError();
      
    } catch (error) {
      console.error('Update error:', error);
      this.showConnectionError();
    }
  }

  updateBusMarkers(vehicles) {
    // Remove old markers
    this.busMarkers.forEach(marker => this.map.removeLayer(marker));
    this.busMarkers.clear();
    
    // Add new markers
    vehicles.forEach(vehicle => {
      const marker = L.marker([vehicle.lat, vehicle.lon], {
        icon: this.createBusIcon(vehicle.bearing)
      }).addTo(this.map);
      
      marker.bindPopup(`
        <strong>Bus ${vehicle.id}</strong><br/>
        ${vehicle.headsign}<br/>
        <small>Updated ${vehicle.staleSeconds}s ago</small>
      `);
      
      this.busMarkers.set(vehicle.id, marker);
    });
  }

  createBusIcon(bearing) {
    return L.divIcon({
      html: `<div style="transform: rotate(${bearing || 0}deg); font-size: 16px;">🚌</div>`,
      className: 'bus-icon',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
  }

  updateETACards(predictions) {
    const container = document.getElementById('eta-cards');
    const loading = document.getElementById('eta-loading');
    const empty = document.getElementById('eta-empty');
    
    loading.classList.add('hidden');
    
    if (predictions.length === 0) {
      empty.classList.remove('hidden');
      container.innerHTML = '';
      return;
    }
    
    empty.classList.add('hidden');
    
    container.innerHTML = predictions.map(pred => {
      const minutes = Math.floor(pred.etaSeconds / 60);
      const isStale = pred.staleSeconds > 300;
      
      return `
        <div class="eta-card bg-white border rounded-lg p-4 ${isStale ? 'border-red-200' : 'border-gray-200'}">
          <div class="flex items-start justify-between mb-2">
            <div class="text-sm font-medium text-gray-900 flex-1">
              → ${this.escapeHtml(pred.headsign)}
            </div>
            <div class="text-2xl font-bold text-blue-600 ml-4">
              ${this.formatETA(minutes)}
            </div>
          </div>
          <div class="flex items-center justify-between text-xs">
            <div class="text-gray-500">
              ${pred.vehicleId ? `Bus ${pred.vehicleId}` : ''}
            </div>
            <div class="${this.getStalenessClass(pred.staleSeconds)}">
              Updated ${this.formatStaleness(pred.staleSeconds)}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  formatETA(minutes) {
    if (minutes < 1) return "Now";
    if (minutes === 1) return "1 min";
    return `${minutes} min`;
  }

  formatStaleness(seconds) {
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes === 1) return "1 min ago";
    return `${minutes} min ago`;
  }

  getStalenessClass(seconds) {
    if (seconds < 60) return "text-green-600";
    if (seconds < 300) return "text-yellow-600";
    return "text-red-600";
  }

  updateStatus(vehicleCount) {
    const lastUpdated = document.getElementById('last-updated');
    const vehicleCountSpan = document.getElementById('vehicle-count');
    
    if (lastUpdated) {
      lastUpdated.textContent = new Date().toLocaleTimeString();
    }
    
    if (vehicleCountSpan) {
      vehicleCountSpan.textContent = vehicleCount;
    }
  }

  showConnectionError() {
    const status = document.getElementById('connection-status');
    if (status) {
      status.classList.remove('hidden');
    }
  }

  hideConnectionError() {
    const status = document.getElementById('connection-status');
    if (status) {
      status.classList.add('hidden');
    }
  }

  escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

// Initialize the app
new PullcordApp();