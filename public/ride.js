// Ride view — live bus tracking with map following the bus
// GPS optional for rider position, bus position polled from server

(function () {
  'use strict';

  const config = window.__RIDE_CONFIG__ || {};
  const { tripId, stopId: destStopId, routeId } = config;

  if (!tripId) return;

  // State
  let map;
  let stops = [];
  let destIndex = -1;
  let busStopIndex = -1;
  let nearestIndex = -1;
  let userLatLon = null;
  let busLatLon = null;
  let busBearing = 0;
  let watchId = null;
  let userMarker = null;
  let busMarker = null;
  let routeLine = null;
  let stopMarkers = [];
  let cordZoneActive = false;
  let followBus = true; // map follows bus by default
  let routeShortName = '';
  let routeColor = '#E85D3A';
  const CORD_ZONE_STOPS = 2;
  const BUS_POLL_MS = 10000;

  // ─── Init ───

  async function init() {
    // Load trip stops
    try {
      const res = await fetch(`/api/trip/${tripId}/stops`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      stops = await res.json();
    } catch (err) {
      setStatus('Failed to load trip data');
      return;
    }

    if (stops.length === 0) {
      setStatus('No stops found for this trip');
      return;
    }

    // Find destination
    if (destStopId) {
      destIndex = stops.findIndex(s => s.stop_id === destStopId);
    }

    // Fetch route info for badge + color
    if (routeId) {
      try {
        const rRes = await fetch(`/api/realtime/${routeId}`);
        if (rRes.ok) {
          const rData = await rRes.json();
          if (rData.route?.route_short_name) {
            routeShortName = rData.route.route_short_name;
            const badge = document.getElementById('ride-route-badge');
            if (badge) {
              badge.textContent = routeShortName;
              badge.style.display = '';
            }
          }
          if (rData.route?.route_color) {
            routeColor = `#${rData.route.route_color}`;
          }
        }
      } catch (e) { /* silent */ }
    }

    // Headsign from last stop
    const headsign = document.getElementById('ride-headsign');
    if (headsign) {
      headsign.textContent = `→ ${stops[stops.length - 1].stop_name}`;
    }

    initMap();
    renderStopList();
    startTracking();

    // Poll bus position immediately + interval
    pollBus();
    setInterval(pollBus, BUS_POLL_MS);

    // If user pans/zooms, stop following bus
    map.on('dragstart', () => { followBus = false; });

    setStatus('Waiting for bus position...');
  }

  // ─── Map ───

  function initMap() {
    const center = stops.length > 0
      ? [stops[Math.floor(stops.length / 2)].lat, stops[Math.floor(stops.length / 2)].lon]
      : [33.749, -84.388];

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const tileUrl = prefersDark
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

    map = L.map('ride-map', {
      center,
      zoom: 16,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer(tileUrl, { maxZoom: 19, subdomains: 'abcd' }).addTo(map);
    L.control.zoom({ position: 'topleft' }).addTo(map);

    // Route line
    const coords = stops.map(s => [s.lat, s.lon]);
    // Outline
    L.polyline(coords, {
      color: prefersDark ? '#1e293b' : '#94a3b8',
      weight: 7, opacity: 0.5, lineCap: 'round', lineJoin: 'round',
    }).addTo(map);
    routeLine = L.polyline(coords, {
      color: routeColor, weight: 3.5, opacity: 0.7, lineCap: 'round', lineJoin: 'round',
    }).addTo(map);

    // Stop markers
    stops.forEach((stop, i) => {
      const isDest = i === destIndex;
      const marker = L.circleMarker([stop.lat, stop.lon], {
        radius: isDest ? 9 : 5,
        fillColor: isDest ? '#3B82F6' : routeColor,
        fillOpacity: isDest ? 1 : 0.7,
        color: '#fff',
        weight: isDest ? 3 : 1.5,
      }).addTo(map);

      // Tappable — show name + link to stop view
      marker.on('click', () => {
        const route = routeId ? `&route=${routeId}` : '';
        marker.bindPopup(
          `<div style="text-align:center">
            <strong style="font-size:13px">${esc(stop.stop_name)}</strong><br>
            <a href="/bus?stop=${stop.stop_id}${route}" style="
              display:inline-block;margin-top:6px;padding:6px 14px;
              background:${routeColor};color:#fff;border-radius:6px;
              font-size:12px;font-weight:600;text-decoration:none;
            ">View arrivals</a>
          </div>`,
          { closeButton: false, maxWidth: 220, offset: [0, -4] }
        ).openPopup();
      });

      if (isDest) {
        marker.bindTooltip(stop.stop_name, {
          permanent: true, direction: 'top',
          className: 'ride-dest-tooltip', offset: [0, -10],
        });
      }

      stopMarkers.push(marker);
    });

    // Recenter button
    addRecenterControl();
  }

  function addRecenterControl() {
    const ctrl = L.control({ position: 'bottomright' });
    ctrl.onAdd = function () {
      const div = L.DomUtil.create('div', 'ride-recenter-wrap');
      div.innerHTML = `<button class="ride-recenter-btn" aria-label="Follow bus">
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
          <circle cx="12" cy="12" r="3"/>
          <path stroke-linecap="round" d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
        </svg>
      </button>`;
      div.querySelector('button').addEventListener('click', (e) => {
        L.DomEvent.stopPropagation(e);
        followBus = true;
        if (busLatLon) {
          map.setView(busLatLon, Math.max(map.getZoom(), 16));
        }
      });
      return div;
    };
    ctrl.addTo(map);
  }

  function updateMapFading() {
    // Fade passed stops on the map
    stopMarkers.forEach((marker, i) => {
      const passed = busStopIndex >= 0 && i < busStopIndex;
      const isDest = i === destIndex;
      if (isDest) return; // never fade destination

      marker.setStyle({
        fillOpacity: passed ? 0.15 : 0.7,
        opacity: passed ? 0.3 : 1,
      });
    });
  }

  // ─── Bus Position ───

  async function pollBus() {
    if (!routeId) return;
    try {
      const res = await fetch(`/api/realtime/${routeId}`);
      if (!res.ok) return;
      const data = await res.json();
      const vehicles = data.vehicles || [];
      const bus = vehicles.find(v => v.tripId === tripId);
      if (!bus) return;

      busLatLon = [bus.lat, bus.lon];
      busBearing = bus.bearing || 0;

      // Bus marker with direction arrow
      if (!busMarker) {
        busMarker = L.marker(busLatLon, {
          icon: makeBusIcon(busBearing),
          zIndexOffset: 900,
        }).addTo(map);
      } else {
        busMarker.setLatLng(busLatLon);
        busMarker.setIcon(makeBusIcon(busBearing));
      }

      // Find nearest stop to bus
      let minDist = Infinity;
      stops.forEach((stop, i) => {
        const d = haversine(bus.lat, bus.lon, stop.lat, stop.lon);
        if (d < minDist) { minDist = d; busStopIndex = i; }
      });

      updateMapFading();
      updateStatus();
      updateStopList();
      checkCordZone();

      // Follow bus
      if (followBus) {
        map.setView(busLatLon, Math.max(map.getZoom(), 16), { animate: true });
      }
    } catch (err) { /* silent */ }
  }

  function makeBusIcon(bearing) {
    return L.divIcon({
      html: `<div class="ride-bus-icon" style="--bearing:${bearing}deg">
        <div class="ride-bus-arrow"></div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5">
          <rect x="3" y="2" width="18" height="16" rx="3"/>
          <path d="M8 6v6M16 6v6M2 12h20"/>
        </svg>
      </div>`,
      className: '',
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });
  }

  // ─── GPS Tracking ───

  function startTracking() {
    if (!navigator.geolocation) return;

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        userLatLon = [pos.coords.latitude, pos.coords.longitude];

        if (!userMarker) {
          userMarker = L.circleMarker(userLatLon, {
            radius: 8, fillColor: '#3B82F6', fillOpacity: 1,
            color: '#fff', weight: 3,
          }).addTo(map);
        } else {
          userMarker.setLatLng(userLatLon);
        }

        // Find nearest stop to user
        let minDist = Infinity;
        stops.forEach((stop, i) => {
          const d = haversine(userLatLon[0], userLatLon[1], stop.lat, stop.lon);
          if (d < minDist) { minDist = d; nearestIndex = i; }
        });
      },
      () => { /* silent — GPS is optional */ },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
  }

  // ─── Status ───

  function setStatus(text) {
    const el = document.getElementById('ride-status');
    if (el) el.innerHTML = text;
  }

  function updateStatus() {
    if (busStopIndex < 0) return;

    if (destIndex >= 0) {
      const remaining = destIndex - busStopIndex;
      if (remaining <= 0) {
        setStatus(`<strong>At your stop!</strong> ${esc(stops[destIndex].stop_name)}`);
      } else {
        setStatus(`<strong>${remaining} stop${remaining > 1 ? 's' : ''} away</strong> · Bus near ${esc(stops[busStopIndex].stop_name)}`);
      }
    } else {
      setStatus(`Bus near <strong>${esc(stops[busStopIndex].stop_name)}</strong>`);
    }
  }

  // ─── Cord Zone ───

  function checkCordZone() {
    if (destIndex < 0 || busStopIndex < 0) return;
    const remaining = destIndex - busStopIndex;
    const zoneEl = document.getElementById('ride-cord-zone');
    const cordStop = document.getElementById('ride-cord-stop');

    if (remaining > 0 && remaining <= CORD_ZONE_STOPS) {
      if (!cordZoneActive) {
        cordZoneActive = true;
        if (zoneEl) zoneEl.classList.remove('hidden');
        if (cordStop) cordStop.textContent = stops[destIndex].stop_name;
        if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
      }
    } else if (remaining <= 0) {
      if (zoneEl) {
        zoneEl.classList.remove('hidden');
        zoneEl.classList.add('ride-arrived');
      }
      if (cordStop) cordStop.textContent = `Arrived at ${stops[destIndex].stop_name}`;
      const txt = document.querySelector('.ride-cord-text span:last-child');
      if (txt) txt.textContent = "You're here!";
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
      const route = routeId ? `&route=${routeId}` : '';
      return `
        <a href="/bus?stop=${stop.stop_id}${route}" class="ride-stop ${isDest ? 'ride-stop-dest' : ''} ${inZone ? 'ride-stop-zone' : ''}" data-index="${i}">
          <div class="ride-stop-dot ${isDest ? 'ride-stop-dot-dest' : ''}"></div>
          <div class="ride-stop-info">
            <span class="ride-stop-name">${esc(stop.stop_name)}</span>
            <span class="ride-stop-time">${formatTime(stop.arrival_time)}</span>
          </div>
          ${isDest ? '<span class="ride-stop-flag">🏁</span>' : ''}
        </a>
      `;
    }).join('');
  }

  function updateStopList() {
    if (busStopIndex < 0) return;
    const items = document.querySelectorAll('.ride-stop');
    items.forEach((el, i) => {
      el.classList.toggle('ride-stop-passed', i < busStopIndex);
      el.classList.toggle('ride-stop-current', i === busStopIndex);
    });

    // Scroll bus's current stop into view
    const current = document.querySelector('.ride-stop-current');
    if (current) {
      current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // ─── Utilities ───

  function formatTime(timeStr) {
    if (!timeStr) return '';
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
