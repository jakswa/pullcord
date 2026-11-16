// Shared basemap for every Leaflet map (#103).
//
// OpenFreeMap vector tiles (no API key, no usage limits), drawn inside Leaflet
// by MapLibre GL through @maplibre/maplibre-gl-leaflet. Styles:
//   light → Positron, dark → Fiord  (muted, close to the old CARTO look)
//
// MapLibre (~275 KB gzipped) loads lazily on the first addBasemap() call, so
// pages without a map don't pay for it. If it fails to load or WebGL isn't
// available, the map falls back to OpenStreetMap raster tiles (darkened by the
// .map-tiles CSS filter in dark mode), the pre-#103 behavior.
//
// To switch providers, edit this file and the CSP in src/app.tsx.
(function () {
  var MAPLIBRE_JS = {
    src: 'https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.js',
    integrity: 'sha384-5+cfbwT0iiub6VsQAdn6yz16nr6sDiQoHx6tm4O8OVYXHYOxcffFmCJBL0dgdvGp',
  };
  var MAPLIBRE_CSS = {
    href: 'https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.css',
    integrity: 'sha384-uTttxo/aOKbdE5RlD/SPzSDoDmNvGlUYPjONi2MN/b7c9HPSvW07OIuyP7uL6jxK',
  };
  var MAPLIBRE_LEAFLET_JS = {
    src: 'https://unpkg.com/@maplibre/maplibre-gl-leaflet@0.1.4/leaflet-maplibre-gl.js',
    integrity: 'sha384-tXYNKOHx4T02jMP7YYCtBxPIv1B5gaA5mcVPBzqMp6d7VzWzxJgI2aWF/nJLrQdS',
  };

  var STYLES = {
    light: { url: 'https://tiles.openfreemap.org/styles/positron', background: 'rgb(242,243,240)' },
    dark: { url: 'https://tiles.openfreemap.org/styles/fiord', background: '#45516E' },
  };
  var ATTRIBUTION =
    '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> ' +
    '© <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> ' +
    'Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

  var OSM_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  var OSM_ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
  var MAX_ZOOM = 19;

  function webglSupported() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGL2RenderingContext && c.getContext('webgl2')) ||
        !!(window.WebGLRenderingContext && c.getContext('webgl'));
    } catch (e) {
      return false;
    }
  }

  function loadScript(spec) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = spec.src;
      s.integrity = spec.integrity;
      s.crossOrigin = 'anonymous';
      s.onload = resolve;
      s.onerror = function () { reject(new Error('failed to load ' + spec.src)); };
      document.head.appendChild(s);
    });
  }

  function loadCss(spec) {
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = spec.href;
    l.integrity = spec.integrity;
    l.crossOrigin = 'anonymous';
    document.head.appendChild(l);
  }

  var glPromise = null;
  function loadMapLibre() {
    if (!glPromise) {
      glPromise = webglSupported()
        ? (loadCss(MAPLIBRE_CSS), loadScript(MAPLIBRE_JS)
            .then(function () { return loadScript(MAPLIBRE_LEAFLET_JS); })
            .then(function () {
              if (!window.maplibregl || !L.maplibreGL) throw new Error('MapLibre globals missing');
            }))
        : Promise.reject(new Error('WebGL unavailable'));
    }
    return glPromise;
  }

  function addOsmFallback(map, attribution, followTheme) {
    L.tileLayer(OSM_URL, {
      maxZoom: MAX_ZOOM,
      className: followTheme ? 'map-tiles' : '',
    }).addTo(map);
    attribution.addAttribution(OSM_ATTRIBUTION);
  }

  /**
   * Add the basemap and its attribution control to a Leaflet map.
   * Create the map with `attributionControl: false`; this adds one bottom-right.
   * @param {L.Map} map
   * @param {{followTheme?: boolean}} [opts] followTheme: use the dark style when
   *   the OS prefers dark (otherwise always light).
   */
  window.addBasemap = function addBasemap(map, opts) {
    var followTheme = !!(opts && opts.followTheme);
    var dark = followTheme && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var style = dark ? STYLES.dark : STYLES.light;

    // Tile layers used to cap zoom; the GL layer doesn't, so cap the map itself.
    if (map.options.maxZoom === undefined) map.setMaxZoom(MAX_ZOOM);

    var attribution = L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map);
    // Paint the style's land color while MapLibre loads, instead of Leaflet's grey.
    map.getContainer().style.background = style.background;

    loadMapLibre().then(function () {
      // attributionControl: false stops the plugin adding the style's credit too.
      L.maplibreGL({ style: style.url, attributionControl: false }).addTo(map);
      attribution.addAttribution(ATTRIBUTION);
    }).catch(function (err) {
      console.warn('[basemap] vector tiles unavailable, using OSM raster:', err && err.message);
      map.getContainer().style.background = '';
      addOsmFallback(map, attribution, followTheme);
    });
  };
})();
