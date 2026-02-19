// Explore map — browse all MARTA bus stops
// Uses Leaflet with lightweight client-side clustering

(function () {
  'use strict';

  // Atlanta center
  const ATL_CENTER = [33.749, -84.388];
  const DEFAULT_ZOOM = 12;
  const CLUSTER_ZOOM = 15; // Below this, show clusters; at/above, show individual stops
  const MIN_ZOOM = 10;
  const MAX_ZOOM = 18;

  let map;
  let allStops = [];
  let filteredStops = null; // null = show all
  let markers = []; // currently rendered markers
  let userMarker = null;
  let pendingFilter = null;

  // ─── Init ───

  function init() {
    map = L.map('explore-map', {
      center: ATL_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      zoomControl: false,
      attributionControl: false,
    });

    // Tile layer — CartoDB Positron for clean look
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: MAX_ZOOM,
      subdomains: 'abcd',
    }).addTo(map);

    // Attribution in corner
    L.control.attribution({ position: 'bottomright', prefix: false })
      .addAttribution('© <a href="https://www.openstreetmap.org/copyright">OSM</a> · <a href="https://carto.com/">CARTO</a>')
      .addTo(map);

    // Zoom control top-right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Load stops
    loadStops();

    // Re-render markers on zoom/pan
    map.on('moveend', renderMarkers);

    // Geolocation — header button
    document.getElementById('explore-locate-btn')?.addEventListener('click', locateUser);

    // On-map locate button (bottom-right, like Google Maps)
    const mapLocateBtn = L.control({ position: 'bottomleft' });
    mapLocateBtn.onAdd = function () {
      const div = L.DomUtil.create('div', 'explore-map-locate-wrap');
      div.innerHTML = `<button class="explore-map-locate" aria-label="Center on my location">
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3" stroke-width="2" />
          <path stroke-linecap="round" stroke-width="2" d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        </svg>
      </button>`;
      div.querySelector('button').addEventListener('click', function (e) {
        L.DomEvent.stopPropagation(e);
        locateUser();
      });
      return div;
    };
    mapLocateBtn.addTo(map);

    // Route/name filter — check URL params first
    const searchInput = document.getElementById('explore-search');
    if (searchInput) {
      searchInput.addEventListener('input', debounce(onFilterChange, 200));
      const params = new URLSearchParams(window.location.search);
      const urlRoute = params.get('route');
      const urlQuery = params.get('q');
      if (urlRoute) {
        searchInput.value = urlRoute;
        pendingFilter = { type: 'route', value: urlRoute.trim().toLowerCase() };
      } else if (urlQuery) {
        searchInput.value = urlQuery;
        pendingFilter = { type: 'name', value: urlQuery.trim().toLowerCase() };
      }
      if (pendingFilter) {
        searchInput.placeholder = 'Filter by route or stop name...';
      }
    }
  }

  // ─── Data ───

  async function loadStops() {
    try {
      const res = await fetch('/api/stops/all');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      allStops = await res.json();
      document.getElementById('explore-loading')?.classList.add('hidden');

      // Apply pending filter from URL param
      if (pendingFilter) {
        applyFilter(pendingFilter.value, pendingFilter.type);
        pendingFilter = null;
      }

      renderMarkers();
    } catch (err) {
      console.error('Failed to load stops:', err);
      const loading = document.getElementById('explore-loading');
      if (loading) loading.innerHTML = '<span style="color:var(--coral)">Failed to load stops</span>';
    }
  }

  // ─── Rendering ───

  function renderMarkers() {
    // Clear existing
    markers.forEach(m => map.removeLayer(m));
    markers = [];

    const bounds = map.getBounds();
    const zoom = map.getZoom();
    const stops = filteredStops || allStops;

    // Filter to visible bounds
    const visible = stops.filter(s =>
      s.stop_lat >= bounds.getSouth() &&
      s.stop_lat <= bounds.getNorth() &&
      s.stop_lon >= bounds.getWest() &&
      s.stop_lon <= bounds.getEast()
    );

    if (zoom >= CLUSTER_ZOOM) {
      // Individual stop markers
      renderIndividual(visible);
    } else {
      // Cluster markers
      renderClusters(visible, zoom);
    }
  }

  function renderIndividual(stops) {
    // Limit to avoid DOM overload
    const limit = 500;
    const toRender = stops.slice(0, limit);

    toRender.forEach(stop => {
      const marker = L.circleMarker([stop.stop_lat, stop.stop_lon], {
        radius: 6,
        fillColor: '#E85D3A',
        fillOpacity: 0.85,
        color: '#fff',
        weight: 1.5,
        className: 'explore-stop-marker',
      });

      marker.on('click', () => showStopPopup(stop, marker));
      marker.addTo(map);
      markers.push(marker);
    });

    if (stops.length > limit) {
      console.log(`Showing ${limit}/${stops.length} stops (zoom in for more)`);
    }
  }

  function renderClusters(stops, zoom) {
    // Simple grid-based clustering
    // Grid size decreases as zoom increases (tighter clusters when zoomed in)
    const gridSize = getGridSize(zoom);
    const clusters = new Map();

    stops.forEach(stop => {
      const key = `${Math.floor(stop.stop_lat / gridSize)}_${Math.floor(stop.stop_lon / gridSize)}`;
      if (!clusters.has(key)) {
        clusters.set(key, { lat: 0, lon: 0, count: 0, stops: [] });
      }
      const c = clusters.get(key);
      c.lat += stop.stop_lat;
      c.lon += stop.stop_lon;
      c.count++;
      if (c.stops.length < 5) c.stops.push(stop); // Keep a few for preview
    });

    clusters.forEach(c => {
      const lat = c.lat / c.count;
      const lon = c.lon / c.count;
      const radius = Math.min(8 + Math.log2(c.count) * 4, 24);

      const marker = L.circleMarker([lat, lon], {
        radius,
        fillColor: '#E85D3A',
        fillOpacity: 0.7,
        color: '#fff',
        weight: 2,
      });

      // Cluster label
      if (c.count > 1) {
        const icon = L.divIcon({
          className: 'explore-cluster-label',
          html: `<span>${c.count}</span>`,
          iconSize: [radius * 2, radius * 2],
          iconAnchor: [radius, radius],
        });
        const labelMarker = L.marker([lat, lon], { icon, interactive: false });
        labelMarker.addTo(map);
        markers.push(labelMarker);
      }

      marker.on('click', () => {
        // Zoom into cluster
        map.setView([lat, lon], Math.min(zoom + 2, MAX_ZOOM));
      });

      marker.addTo(map);
      markers.push(marker);
    });
  }

  function getGridSize(zoom) {
    // Larger grid = bigger clusters at low zoom
    // Aggressive clustering keeps the map readable
    if (zoom <= 10) return 0.06;
    if (zoom <= 11) return 0.03;
    if (zoom <= 12) return 0.015;
    if (zoom <= 13) return 0.008;
    return 0.004;
  }

  // ─── Popup ───

  function showStopPopup(stop, marker) {
    const routes = stop.routes.split(',');

    const routeBadges = routes.map(r =>
      `<span class="explore-popup-badge">${esc(r)}</span>`
    ).join(' ');

    const content = `
      <div class="explore-popup">
        <div class="explore-popup-name">${esc(stop.stop_name)}</div>
        <div class="explore-popup-routes">${routeBadges}</div>
        <a href="/bus?stop=${esc(stop.stop_id)}" class="explore-popup-link">
          View arrivals →
        </a>
      </div>
    `;

    marker.bindPopup(content, {
      className: 'explore-popup-container',
      maxWidth: 260,
      minWidth: 180,
      closeButton: false,
      offset: [0, -4],
    }).openPopup();
  }

  // ─── Filter ───

  function onFilterChange(e) {
    const query = e.target.value.trim().toLowerCase();
    // Auto-detect: all digits = route filter, otherwise name filter
    const type = /^\d+$/.test(query) ? 'route' : 'name';
    applyFilter(query, type);
    renderMarkers();
  }

  function applyFilter(query, type) {
    if (!query) {
      filteredStops = null;
      return;
    }
    if (type === 'route') {
      filteredStops = allStops.filter(stop => {
        const routes = stop.routes.toLowerCase().split(',');
        return routes.some(r => r.includes(query));
      });
    } else {
      filteredStops = allStops.filter(stop =>
        stop.stop_name.toLowerCase().includes(query)
      );
    }

    // Fit map to filtered stops
    if (filteredStops.length > 0) {
      const lats = filteredStops.map(s => s.stop_lat);
      const lons = filteredStops.map(s => s.stop_lon);
      const bounds = L.latLngBounds(
        [Math.min(...lats), Math.min(...lons)],
        [Math.max(...lats), Math.max(...lons)]
      );
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
    }
  }

  // ─── Geolocation ───

  function locateUser() {
    const btn = document.getElementById('explore-locate-btn');
    if (btn) btn.classList.add('explore-locating');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        map.setView([latitude, longitude], 16);

        if (userMarker) map.removeLayer(userMarker);
        userMarker = L.circleMarker([latitude, longitude], {
          radius: 8,
          fillColor: '#3B82F6',
          fillOpacity: 1,
          color: '#fff',
          weight: 3,
        }).addTo(map);

        if (btn) btn.classList.remove('explore-locating');
      },
      (err) => {
        console.error('Geolocation failed:', err);
        if (btn) btn.classList.remove('explore-locating');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // ─── Utilities ───

  function esc(str) {
    const el = document.createElement('span');
    el.textContent = str;
    return el.innerHTML;
  }

  function debounce(fn, ms) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  // ─── Boot ───
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
