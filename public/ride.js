// Ride view — track your position along the bus route
// Uses browser GPS (watchPosition) — no server dependency during ride

(function () {
  'use strict';

  const config = window.__RIDE_CONFIG__ || {};
  const { tripId, stopId: destStopId, routeId } = config;

  if (!tripId) return;

  // State
  let map;
  let stops = [];           // ordered stop sequence for this trip
  let destIndex = -1;       // index of destination stop
  let nearestIndex = -1;    // index of stop nearest to rider
  let userLatLon = null;
  let watchId = null;
  let userMarker = null;
  let routeLine = null;
  let stopMarkers = [];
  let destMarker = null;
  let cordZoneActive = false;
  const CORD_ZONE_STOPS = 2; // alert this many stops before destination

  // ─── Init ───

  async function init() {
    // Load trip stops
    try {
      const res = await fetch(`/api/trip/${tripId}/stops`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      stops = await res.json();
    } catch (err) {
      console.error('Failed to load trip:', err);
      document.getElementById('ride-status').textContent = 'Failed to load trip data';
      return;
    }

    if (stops.length === 0) {
      document.getElementById('ride-status').textContent = 'No stops found for this trip';
      return;
    }

    // Find destination
    if (destStopId) {
      destIndex = stops.findIndex(s => s.stop_id === destStopId);
    }

    // Set up header
    if (routeId) {
      const badge = document.getElementById('ride-route-badge');
      if (badge) {
        badge.textContent = routeId;
        badge.style.display = '';
      }
    }
    const headsign = document.getElementById('ride-headsign');
    if (headsign) {
      const lastStop = stops[stops.length - 1];
      headsign.textContent = `→ ${lastStop.stop_name}`;
    }

    // Init map
    initMap();

    // Render stop list
    renderStopList();

    // Start GPS
    startTracking();
  }

  // ─── Map ───

  function initMap() {
    const center = stops.length > 0
      ? [stops[Math.floor(stops.length / 2)].lat, stops[Math.floor(stops.length / 2)].lon]
      : [33.749, -84.388];

    map = L.map('ride-map', {
      center,
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 18,
      subdomains: 'abcd',
    }).addTo(map);

    // Route line
    const coords = stops.map(s => [s.lat, s.lon]);
    routeLine = L.polyline(coords, {
      color: '#E85D3A',
      weight: 4,
      opacity: 0.6,
    }).addTo(map);

    // Stop dots
    stops.forEach((stop, i) => {
      const isDest = i === destIndex;
      const marker = L.circleMarker([stop.lat, stop.lon], {
        radius: isDest ? 8 : 4,
        fillColor: isDest ? '#3B82F6' : '#E85D3A',
        fillOpacity: isDest ? 1 : 0.5,
        color: '#fff',
        weight: isDest ? 3 : 1,
      }).addTo(map);

      if (isDest) {
        destMarker = marker;
        marker.bindTooltip(stop.stop_name, {
          permanent: true,
          direction: 'top',
          className: 'ride-dest-tooltip',
          offset: [0, -10],
        });
      }

      stopMarkers.push(marker);
    });

    // Fit to route
    if (coords.length > 0) {
      map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });
    }
  }

  // ─── GPS Tracking ───

  function startTracking() {
    if (!navigator.geolocation) {
      document.getElementById('ride-status').textContent = 'GPS not available';
      return;
    }

    document.getElementById('ride-status').textContent = 'Locating you...';

    watchId = navigator.geolocation.watchPosition(
      onPosition,
      (err) => {
        console.error('GPS error:', err);
        document.getElementById('ride-status').textContent = 'GPS unavailable';
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      }
    );
  }

  function onPosition(pos) {
    userLatLon = [pos.coords.latitude, pos.coords.longitude];

    // Update user marker
    if (!userMarker) {
      userMarker = L.circleMarker(userLatLon, {
        radius: 10,
        fillColor: '#3B82F6',
        fillOpacity: 1,
        color: '#fff',
        weight: 3,
        className: 'ride-user-marker',
      }).addTo(map);
    } else {
      userMarker.setLatLng(userLatLon);
    }

    // Find nearest stop
    let minDist = Infinity;
    let minIdx = -1;
    stops.forEach((stop, i) => {
      const d = haversine(userLatLon[0], userLatLon[1], stop.lat, stop.lon);
      if (d < minDist) {
        minDist = d;
        minIdx = i;
      }
    });

    nearestIndex = minIdx;

    // Update status
    updateStatus(minDist);

    // Check cord zone
    checkCordZone();

    // Update stop list highlighting
    updateStopList();

    // Pan map to keep user visible
    if (!map.getBounds().contains(userLatLon)) {
      map.panTo(userLatLon);
    }
  }

  function updateStatus(distToNearest) {
    const status = document.getElementById('ride-status');
    if (!status) return;

    if (nearestIndex < 0) {
      status.textContent = 'Locating you...';
      return;
    }

    const nearStop = stops[nearestIndex];
    const distM = Math.round(distToNearest);

    if (destIndex >= 0) {
      const stopsRemaining = destIndex - nearestIndex;
      if (stopsRemaining <= 0) {
        status.innerHTML = `<strong>You're here!</strong> ${esc(stops[destIndex].stop_name)}`;
      } else {
        status.innerHTML = `<strong>${stopsRemaining} stop${stopsRemaining > 1 ? 's' : ''} away</strong> · near ${esc(nearStop.stop_name)}`;
      }
    } else {
      status.innerHTML = `Near <strong>${esc(nearStop.stop_name)}</strong> · ${distM}m`;
    }
  }

  // ─── Cord Zone ───

  function checkCordZone() {
    if (destIndex < 0 || nearestIndex < 0) return;

    const stopsRemaining = destIndex - nearestIndex;
    const zoneEl = document.getElementById('ride-cord-zone');
    const cordStop = document.getElementById('ride-cord-stop');

    if (stopsRemaining > 0 && stopsRemaining <= CORD_ZONE_STOPS) {
      if (!cordZoneActive) {
        cordZoneActive = true;
        if (zoneEl) zoneEl.classList.remove('hidden');
        if (cordStop) cordStop.textContent = stops[destIndex].stop_name;
        // Vibrate
        if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
      }
    } else if (stopsRemaining <= 0) {
      // Arrived
      if (zoneEl) {
        zoneEl.classList.remove('hidden');
        zoneEl.classList.add('ride-arrived');
      }
      if (cordStop) cordStop.textContent = `Arrived at ${stops[destIndex].stop_name}`;
      const cordText = document.querySelector('.ride-cord-text span:last-child');
      if (cordText) cordText.textContent = "You're here!";
    } else {
      cordZoneActive = false;
      if (zoneEl) zoneEl.classList.add('hidden');
    }
  }

  // ─── Stop List ───

  function renderStopList() {
    const list = document.getElementById('ride-stop-list');
    if (!list) return;

    list.innerHTML = stops.map((stop, i) => {
      const isDest = i === destIndex;
      const inZone = destIndex >= 0 && i > destIndex - CORD_ZONE_STOPS && i <= destIndex;
      return `
        <div class="ride-stop ${isDest ? 'ride-stop-dest' : ''} ${inZone ? 'ride-stop-zone' : ''}" data-index="${i}">
          <div class="ride-stop-dot ${isDest ? 'ride-stop-dot-dest' : ''}"></div>
          <div class="ride-stop-info">
            <span class="ride-stop-name">${esc(stop.stop_name)}</span>
            <span class="ride-stop-time">${formatTime(stop.arrival_time)}</span>
          </div>
          ${isDest ? '<span class="ride-stop-flag">🏁</span>' : ''}
        </div>
      `;
    }).join('');
  }

  function updateStopList() {
    const items = document.querySelectorAll('.ride-stop');
    items.forEach((el, i) => {
      el.classList.toggle('ride-stop-passed', i < nearestIndex);
      el.classList.toggle('ride-stop-current', i === nearestIndex);
    });

    // Scroll current stop into view
    const current = document.querySelector('.ride-stop-current');
    if (current) {
      current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // ─── Utilities ───

  function formatTime(timeStr) {
    if (!timeStr) return '';
    // GTFS times can be >24h (e.g. "25:30:00")
    const [h, m] = timeStr.split(':').map(Number);
    const hour = h % 24;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
  }

  function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function esc(str) {
    const el = document.createElement('span');
    el.textContent = str;
    return el.innerHTML;
  }

  // ─── Boot ───
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
