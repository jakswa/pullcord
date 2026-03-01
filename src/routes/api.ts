import { Hono } from "hono";
import { getRoutes, getRoute, searchStops, getStopsForRoute, getNearbyStops, getStop, getRouteDetail, getTripLookup, getRoutesForStop, getRouteHeadsigns, getAllStopsWithRoutes, getTripStopSequences } from "../data/db.js";
import { getVehicles, findArrivals, getStopArrivals } from "../data/realtime.js";
import { getMockVehicles, getMockPredictions } from "../data/mock.js";
import { getVapidPublicKey, registerCord, cancelCord, cordExists, getActiveCordCount, testFireAll } from "../data/push.js";

const app = new Hono();

// ── Input validation helpers ──

const ROUTE_ID_RE = /^[a-zA-Z0-9_-]{1,20}$/;
const STOP_ID_RE = /^[a-zA-Z0-9]{1,20}$/;

function validRouteId(id: string): boolean {
  return ROUTE_ID_RE.test(id);
}

function validStopId(id: string): boolean {
  return STOP_ID_RE.test(id);
}

function sanitizeQuery(q: string): string {
  return q.trim().slice(0, 200);
}

function clampLimit(raw: string | undefined, fallback = 20): number {
  const n = parseInt(raw || String(fallback));
  if (isNaN(n)) return fallback;
  return Math.max(1, Math.min(50, n));
}

function validLat(n: number): boolean {
  return !isNaN(n) && n >= -90 && n <= 90;
}

function validLon(n: number): boolean {
  return !isNaN(n) && n >= -180 && n <= 180;
}

// GET /api/routes - All bus routes
app.get("/routes", (c) => {
  try {
    const routes = getRoutes();
    return c.json(routes);
  } catch (error) {
    console.error("Error fetching routes:", error);
    return c.json({ error: "Failed to fetch routes" }, 500);
  }
});

// GET /api/stops?q=query - Search stops by name
// GET /api/stops?lat=33.81&lon=-84.36&radius=500 - Search stops by location
app.get("/stops", (c) => {
  try {
    const rawQuery = c.req.query("q");
    const lat = c.req.query("lat");
    const lon = c.req.query("lon");
    const radius = parseInt(c.req.query("radius") || "500");
    const limit = clampLimit(c.req.query("limit"));

    if (rawQuery) {
      const query = sanitizeQuery(rawQuery);
      if (query.length === 0) {
        return c.json({ error: "Query must not be empty" }, 400);
      }
      let routeMatch: { route_short_name: string; route_color: string } | null = null;
      let routeStops: any[] = [];

      // If query looks like a route number, try matching a route
      if (/^\d+$/.test(query)) {
        const route = getRoute(query);
        if (route) {
          routeMatch = route;
          const stops = getStopsForRoute(route.route_id, 60);
          routeStops = stops.map(stop => {
            const routes = getRoutesForStop(stop.stop_id);
            return { ...stop, routes: routes.map(r => r.route_short_name) };
          }).filter(stop => stop.routes.length > 0);
        }
      }

      // Also do normal stop name search
      const stops = searchStops(query, limit);
      
      // Enrich with bus routes, filter out rail-only stops
      const enrichedStops = stops.map(stop => {
        const routes = getRoutesForStop(stop.stop_id);
        return { ...stop, routes: routes.map(r => r.route_short_name) };
      }).filter(stop => stop.routes.length > 0);

      // Combine: route stops first (deduplicated), then name matches
      if (routeStops.length > 0) {
        const routeStopIds = new Set(routeStops.map(s => s.stop_id));
        const extra = enrichedStops.filter(s => !routeStopIds.has(s.stop_id));
        return c.json({ routeMatch, stops: [...routeStops, ...extra] });
      }
      
      return c.json(enrichedStops);
      
    } else if (lat && lon) {
      // Location search
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lon);
      
      if (!validLat(latitude) || !validLon(longitude)) {
        return c.json({ error: "Invalid lat/lon parameters" }, 400);
      }
      
      const stops = getNearbyStops(latitude, longitude, radius, limit);
      
      // Enrich with bus routes, filter out rail-only stops
      const enrichedStops = stops.map(stop => {
        const routes = getRoutesForStop(stop.stop_id);
        return { ...stop, routes: routes.map(r => r.route_short_name) };
      }).filter(stop => stop.routes.length > 0);
      
      return c.json(enrichedStops);
      
    } else {
      return c.json({ error: "Either 'q' or 'lat'+'lon' parameters required" }, 400);
    }
    
  } catch (error) {
    console.error("Error searching stops:", error);
    return c.json({ error: "Failed to search stops" }, 500);
  }
});

// GET /api/stops/all - All bus stops with routes (for explore map)
// Returns compact JSON; ~760KB raw, ~190KB gzipped
app.get("/stops/all", (c) => {
  try {
    const stops = getAllStopsWithRoutes();
    c.header("Cache-Control", "public, max-age=3600");
    return c.json(stops);
  } catch (error) {
    console.error("Error fetching all stops:", error);
    return c.json({ error: "Failed to fetch stops" }, 500);
  }
});

// GET /api/route/:routeId - Route detail with shapes and stops
app.get("/route/:routeId", (c) => {
  try {
    const routeId = c.req.param("routeId");
    if (!validRouteId(routeId)) {
      return c.json({ error: "Invalid routeId" }, 400);
    }
    const routeDetail = getRouteDetail(routeId);
    
    if (!routeDetail) {
      return c.json({ error: "Route not found" }, 404);
    }
    
    return c.json(routeDetail);
    
  } catch (error) {
    console.error("Error fetching route detail:", error);
    return c.json({ error: "Failed to fetch route detail" }, 500);
  }
});

// GET /api/realtime/:routeId - Live bus positions for a route
app.get("/realtime/:routeId", async (c) => {
  try {
    const routeId = c.req.param("routeId");
    if (!validRouteId(routeId)) {
      return c.json({ error: "Invalid routeId" }, 400);
    }
    
    // Verify route exists
    const route = getRoute(routeId);
    if (!route) {
      return c.json({ error: "Route not found" }, 404);
    }
    
    // Mock mode for testing/screenshots
    const mock = c.req.query("mock");
    if (mock) {
      const detail = getRouteDetail(route.route_id);
      const stops = detail?.stops || [];
      const headsigns = getRouteHeadsigns(route.route_id);
      return c.json({ timestamp: Math.floor(Date.now() / 1000), vehicles: getMockVehicles(route.route_id, stops, headsigns) });
    }

    // Get trip lookup for this route
    const tripLookup = getTripLookup(route.route_id);
    
    // Get live vehicle positions
    const vehicles = await getVehicles(route.route_id, tripLookup);
    
    return c.json({
      timestamp: Math.floor(Date.now() / 1000),
      vehicles
    });
    
  } catch (error) {
    console.error("Error fetching realtime data:", error);
    return c.json({ error: "Failed to fetch realtime data" }, 500);
  }
});

// GET /api/predictions/:routeId/:stopId - ETA predictions for a stop (both directions)
app.get("/predictions/:routeId/:stopId", async (c) => {
  try {
    const routeId = c.req.param("routeId");
    const stopId = c.req.param("stopId");
    if (!validRouteId(routeId)) return c.json({ error: "Invalid routeId" }, 400);
    if (!validStopId(stopId)) return c.json({ error: "Invalid stopId" }, 400);
    
    const route = getRoute(routeId);
    const stop = getStop(stopId);
    
    if (!route) return c.json({ error: "Route not found" }, 404);
    if (!stop) return c.json({ error: "Stop not found" }, 404);
    
    // Mock mode for testing/screenshots
    const mock = c.req.query("mock");
    if (mock) {
      const detail = getRouteDetail(route.route_id);
      const stops = detail?.stops || [];
      const headsigns = getRouteHeadsigns(route.route_id);
      return c.json({
        stop: { stop_id: stop.stop_id, name: stop.stop_name, lat: stop.stop_lat, lon: stop.stop_lon },
        predictions: getMockPredictions(route.route_id, stopId, stops, headsigns),
      });
    }

    const tripLookup = getTripLookup(route.route_id);
    
    // Get vehicle positions for tier classification
    const vehicles = await getVehicles(route.route_id, tripLookup);
    
    // findArrivals handles: paired stops, ETA, staleness, adherence, dedup, tier classification
    const allPredictions = await findArrivals({
      stopId,
      tripLookup,
      routeFilter: new Set([route.route_id]),
      vehicles,
    });

    return c.json({
      stop: {
        stop_id: stop.stop_id,
        name: stop.stop_name,
        lat: stop.stop_lat,
        lon: stop.stop_lon
      },
      predictions: allPredictions
    });
    
  } catch (error) {
    console.error("Error fetching predictions:", error);
    return c.json({ error: "Failed to fetch predictions" }, 500);
  }
});

// GET /api/stops/:stopId/arrivals — All arriving buses at a stop (multi-route)
app.get("/stops/:stopId/arrivals", async (c) => {
  try {
    const stopId = c.req.param("stopId");
    if (!validStopId(stopId)) return c.json({ error: "Invalid stopId" }, 400);
    const stop = getStop(stopId);
    if (!stop) return c.json({ error: "Stop not found" }, 404);

    const routes = getRoutesForStop(stopId);
    if (routes.length === 0) return c.json({ stop, arrivals: [] });

    // Build trip lookup across all routes at this stop
    const tripLookup = getTripLookup(); // all trips
    const arrivals = await getStopArrivals(stopId, routes, tripLookup);

    return c.json({
      stop: {
        stop_id: stop.stop_id,
        name: stop.stop_name,
        lat: stop.stop_lat,
        lon: stop.stop_lon,
      },
      routes: routes.map(r => ({
        route_id: r.route_id,
        route_short_name: r.route_short_name,
        route_long_name: r.route_long_name,
        route_color: r.route_color,
      })),
      arrivals,
    });
  } catch (error) {
    console.error("Error fetching stop arrivals:", error);
    return c.json({ error: "Failed to fetch arrivals" }, 500);
  }
});

// GET /api/trip/:tripId/stops — stop sequence for a trip (for ride view)
app.get("/trip/:tripId/stops", (c) => {
  try {
    const tripId = c.req.param("tripId");
    const sequences = getTripStopSequences([tripId]);
    const stops = sequences.get(tripId);
    if (!stops || stops.length === 0) {
      return c.json({ error: "Trip not found" }, 404);
    }
    // Enrich with stop names
    const enriched = stops.map(s => {
      const stop = getStop(s.stop_id);
      return {
        stop_id: s.stop_id,
        stop_name: stop?.stop_name || s.stop_id,
        lat: s.lat,
        lon: s.lon,
        sequence: s.sequence,
        arrival_time: s.arrival_time,
      };
    });
    c.header("Cache-Control", "public, max-age=86400"); // Trip data is static for the day
    return c.json(enriched);
  } catch (error) {
    console.error("Error fetching trip stops:", error);
    return c.json({ error: "Failed to fetch trip stops" }, 500);
  }
});

// ── Push / Pull the Cord ──

// GET /api/push/vapid — public key for client subscription
app.get("/push/vapid", (c) => {
  return c.json({ publicKey: getVapidPublicKey() });
});

// POST /api/push/cord — register a cord (subscribe to push for a bus)
app.post("/push/cord", async (c) => {
  try {
    const body = await c.req.json();
    const { subscription, routeId, stopId, vehicleId, tripId, directionId, thresholdMinutes } = body;

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return c.json({ error: "Invalid push subscription" }, 400);
    }
    if (!routeId || !stopId) {
      return c.json({ error: "routeId and stopId required" }, 400);
    }
    if (!validRouteId(routeId)) return c.json({ error: "Invalid routeId" }, 400);
    if (!validStopId(stopId)) return c.json({ error: "Invalid stopId" }, 400);

    const threshold = Math.max(1, Math.min(30, thresholdMinutes || 2));
    const cordId = registerCord(subscription, routeId, stopId, vehicleId || null, tripId || null, directionId ?? null, threshold);
    return c.json({ cordId, status: "watching" });
  } catch (error) {
    console.error("Error registering cord:", error);
    return c.json({ error: "Failed to register cord" }, 500);
  }
});

// GET /api/push/cord/:id — check if cord exists (for client-side state sync)
app.get("/push/cord/:id", (c) => {
  const id = c.req.param("id");
  return cordExists(id) ? c.json({ exists: true }) : c.json({ exists: false }, 404);
});

// DELETE /api/push/cord/:id — cancel a cord
app.delete("/push/cord/:id", (c) => {
  const id = c.req.param("id");
  const cancelled = cancelCord(id);
  return c.json({ cancelled });
});

// GET /api/push/status — debug: how many active cords
app.get("/push/status", (c) => {
  return c.json({ activeCords: getActiveCordCount() });
});

// POST /api/push/test — fire a test push to all active cords
app.post("/push/test", async (c) => {
  const sent = await testFireAll();
  return c.json({ sent });
});

export default app;