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
  let stopsById = new Map();

  // Route-map mode (#99): tap "Show routes" on a stop to draw every route
  // serving it, each in its own color, with dots for that route's stops.
  // Distinct hues (MARTA's own route_color repeats across dozens of routes).
  const ROUTE_PALETTE = ['#2563EB', '#DC2626', '#16A34A', '#9333EA', '#EA580C',
    '#0891B2', '#DB2777', '#65A30D', '#4F46E5', '#B45309'];
  let routeMap = null; // { stopId, routes, layer, isolated, legend }
  let routeMapToken = 0;

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

    // Tile layer — OpenStreetMap standard (CARTO basemaps now require an API key, #98)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: MAX_ZOOM,
    }).addTo(map);

    // Attribution in corner
    L.control.attribution({ position: 'bottomright', prefix: false })
      .addAttribution('© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>')
      .addTo(map);

    // Zoom control top-right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Load stops
    loadStops();

    // Re-render markers on zoom/pan
    map.on('moveend', renderMarkers);
    map.on('zoomend', () => { if (routeMap) styleRouteStops(); });

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

    // Center on the user's location at load when they've already granted it,
    // so nearby stops show without a tap. Never prompts on its own.
    if (!pendingFilter && navigator.permissions?.query) {
      navigator.permissions.query({ name: 'geolocation' })
        .then(p => { if (p.state === 'granted') locateUser(); })
        .catch(() => {});
    }
  }

  // ─── Data ───

  async function loadStops() {
    try {
      const res = await fetch('/api/stops/all');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      allStops = await res.json();
      stopsById = new Map(allStops.map(s => [s.stop_id, s]));
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
    if (routeMap) return; // route-map mode draws its own stops

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

  function getStopRadius(zoom) {
    if (zoom <= 15) return 7;
    if (zoom <= 16) return 10;
    if (zoom <= 17) return 13;
    return 16;
  }

  function renderIndividual(stops) {
    // Limit to avoid DOM overload
    const limit = 500;
    const toRender = stops.slice(0, limit);

    toRender.forEach(stop => {
      const marker = L.circleMarker([stop.stop_lat, stop.stop_lon], {
        radius: getStopRadius(map.getZoom()),
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

    const routeBadges = routes.map(r => {
      const color = routeMap && routeMap.colors.get(r);
      const style = color ? ` style="background:${color}"` : '';
      return `<span class="explore-popup-badge"${style}>${esc(r)}</span>`;
    }).join(' ');

    const showingThis = routeMap && routeMap.stopId === stop.stop_id;
    // A DOM node (not an HTML string) so the button's listener survives
    // Leaflet re-rendering the popup when the marker is tapped again
    const content = document.createElement('div');
    content.innerHTML = `
      <div class="explore-popup">
        <div class="explore-popup-name">${esc(stop.stop_name)}</div>
        <div class="explore-popup-routes">${routeBadges}</div>
        <a href="/bus?stop=${esc(stop.stop_id)}" class="explore-popup-link">
          View arrivals →
        </a>
        ${showingThis ? '' : `<button type="button" class="explore-popup-routes-btn">
          Show ${routes.length === 1 ? 'route' : 'routes'} on map
        </button>`}
      </div>
    `;

    marker.bindPopup(content, {
      className: 'explore-popup-container',
      maxWidth: 260,
      minWidth: 180,
      closeButton: false,
      offset: [0, -4],
    }).openPopup();

    content.querySelector('.explore-popup-routes-btn')
      ?.addEventListener('click', (e) => {
        L.DomEvent.stopPropagation(e);
        marker.closePopup();
        showRouteMap(stop);
      });
  }

  // ─── Route map (#99) ───

  async function showRouteMap(stop) {
    // A newer request, a filter change or closing the legend supersedes this one
    const token = ++routeMapToken;
    const loading = document.getElementById('explore-loading');
    if (loading) {
      loading.innerHTML = '<div class="d-spinner"></div><span>Loading routes...</span>';
      loading.classList.remove('hidden');
    }
    let data;
    try {
      const res = await fetch(`/api/stops/${encodeURIComponent(stop.stop_id)}/route-map`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = await res.json();
    } catch (err) {
      if (token !== routeMapToken) return;
      console.error('Failed to load route map:', err);
      if (loading) loading.innerHTML = '<span style="color:var(--coral)">Failed to load routes</span>';
      setTimeout(() => loading?.classList.add('hidden'), 2000);
      return;
    }
    if (token !== routeMapToken) return;
    loading?.classList.add('hidden');
    if (!data.routes.length) return;

    clearRouteMap();
    const renderer = L.canvas({ padding: 0.5 });
    const routes = data.routes.map((r, i) => ({
      ...r,
      color: ROUTE_PALETTE[i % ROUTE_PALETTE.length],
      lines: L.layerGroup(),
    }));

    // Stops shared by several routes get one neutral dot; others take the route color
    const stopRoutes = new Map(); // stop_id -> { stop, routes: [] }
    routes.forEach(r => r.stops.forEach(([id, name, lat, lon]) => {
      if (!stopRoutes.has(id)) stopRoutes.set(id, { id, name, lat, lon, routes: [] });
      stopRoutes.get(id).routes.push(r);
    }));

    const layer = L.layerGroup().addTo(map);
    routes.forEach(r => {
      r.shapes.forEach(pts => {
        L.polyline(pts, { renderer, color: '#fff', weight: 8, opacity: 0.9, interactive: false }).addTo(r.lines);
        L.polyline(pts, { renderer, color: r.color, weight: 4.5, opacity: 0.95, interactive: false }).addTo(r.lines);
      });
      r.lines.addTo(layer);
    });

    const dots = [];
    stopRoutes.forEach(sr => {
      const dot = L.circleMarker([sr.lat, sr.lon], {
        renderer,
        fillColor: sr.routes.length > 1 ? '#fff' : sr.routes[0].color,
        fillOpacity: 1,
        color: sr.routes.length > 1 ? '#1f2937' : '#fff',
        weight: 2,
      });
      dot.on('click', () => {
        const stop = stopsById.get(sr.id) ||
          { stop_id: sr.id, stop_name: sr.name, stop_lat: sr.lat, stop_lon: sr.lon,
            routes: sr.routes.map(r => r.route_short_name).join(',') };
        showStopPopup(stop, dot);
      });
      dot.addTo(layer);
      dots.push({ dot, sr });
    });

    // The tapped stop, drawn on top
    const focus = L.circleMarker([stop.stop_lat, stop.stop_lon], {
      renderer, radius: 11, fillColor: '#E85D3A', fillOpacity: 1, color: '#fff', weight: 3,
    }).addTo(layer);
    focus.on('click', () => showStopPopup(stop, focus));

    routeMap = {
      stopId: stop.stop_id,
      routes,
      dots,
      layer,
      isolated: null,
      colors: new Map(routes.map(r => [r.route_short_name, r.color])),
      legend: buildLegend(stop, routes),
    };
    renderMarkers(); // clears the regular stop markers
    styleRouteStops();

    const bounds = L.latLngBounds(routes.flatMap(r => r.shapes.flat()));
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
  }

  function buildLegend(stop, routes) {
    const el = document.createElement('div');
    el.className = 'explore-route-legend';
    el.innerHTML = `
      <div class="explore-route-legend-head">
        <span class="explore-route-legend-title">${esc(stop.stop_name)}</span>
        <button type="button" class="explore-route-legend-close" aria-label="Close routes">✕</button>
      </div>
      <div class="explore-route-legend-chips">
        ${routes.map((r, i) => `<button type="button" class="explore-route-chip" data-i="${i}"
            style="--chip-color:${r.color}" aria-pressed="false">${esc(r.route_short_name)}</button>`).join('')}
      </div>
      <div class="explore-route-legend-hint">${routes.length > 1 ? 'Tap a route to show only that line' : esc(routes[0].route_long_name || '')}</div>
    `;
    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);
    el.querySelector('.explore-route-legend-close').addEventListener('click', () => {
      clearRouteMap();
      renderMarkers();
    });
    el.querySelectorAll('.explore-route-chip').forEach(btn => {
      btn.title = routes[Number(btn.dataset.i)].route_long_name || '';
      btn.addEventListener('click', () => isolateRoute(Number(btn.dataset.i)));
    });
    const shell = document.querySelector('.explore-shell');
    shell.appendChild(el);
    shell.classList.add('explore-routes-open');
    liftControlsAboveLegend();
    window.addEventListener('resize', liftControlsAboveLegend);
    return el;
  }

  // Lift the bottom map controls (locate, attribution) clear of the legend
  function liftControlsAboveLegend() {
    const shell = document.querySelector('.explore-shell');
    const el = shell?.querySelector('.explore-route-legend');
    if (!el) return;
    const gap = shell.getBoundingClientRect().bottom - el.getBoundingClientRect().top;
    shell.style.setProperty('--route-legend-h', `${Math.ceil(gap) + 8}px`);
  }

  // Toggle showing a single route (helps at busy stops where lines overlap)
  function isolateRoute(i) {
    if (!routeMap || routeMap.routes.length < 2) return;
    routeMap.isolated = routeMap.isolated === i ? null : i;
    const only = routeMap.isolated === null ? null : routeMap.routes[i];
    routeMap.routes.forEach(r => {
      const show = !only || r === only;
      if (show && !routeMap.layer.hasLayer(r.lines)) routeMap.layer.addLayer(r.lines);
      if (!show) routeMap.layer.removeLayer(r.lines);
    });
    routeMap.legend.querySelectorAll('.explore-route-chip').forEach(btn => {
      const on = Number(btn.dataset.i) === routeMap.isolated;
      btn.setAttribute('aria-pressed', String(on));
      btn.classList.toggle('dimmed', !!only && !on);
    });
    styleRouteStops();
    if (only) {
      const b = L.latLngBounds(only.shapes.flat());
      if (b.isValid()) map.fitBounds(b, { padding: [24, 24], maxZoom: 15 });
    }
  }

  // Dot size tracks zoom; hidden route's dots drop out when one is isolated
  function styleRouteStops() {
    const z = map.getZoom();
    const radius = z >= 16 ? 7 : z >= 14 ? 5 : z >= 12 ? 3.5 : 2.5;
    const only = routeMap.isolated === null ? null : routeMap.routes[routeMap.isolated];
    routeMap.dots.forEach(({ dot, sr }) => {
      const visible = !only || sr.routes.includes(only);
      if (visible && !routeMap.layer.hasLayer(dot)) routeMap.layer.addLayer(dot);
      if (!visible) { routeMap.layer.removeLayer(dot); return; }
      const shared = !only && sr.routes.length > 1;
      dot.setStyle({
        radius,
        fillColor: shared ? '#fff' : (only || sr.routes[0]).color,
        color: shared ? '#1f2937' : '#fff',
        weight: z >= 14 ? 2 : 1,
      });
    });
  }

  function clearRouteMap() {
    routeMapToken++;
    document.getElementById('explore-loading')?.classList.add('hidden');
    if (!routeMap) return;
    window.removeEventListener('resize', liftControlsAboveLegend);
    map.removeLayer(routeMap.layer);
    routeMap.legend.remove();
    document.querySelector('.explore-shell')?.classList.remove('explore-routes-open');
    routeMap = null;
  }

  // ─── Filter ───

  function onFilterChange(e) {
    const query = e.target.value.trim().toLowerCase();
    // Auto-detect: all digits = route filter, otherwise name filter
    const type = /^\d+$/.test(query) ? 'route' : 'name';
    clearRouteMap();
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

  const esc = window.esc || function(s) { const e = document.createElement('span'); e.textContent = s; return e.innerHTML; };

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
