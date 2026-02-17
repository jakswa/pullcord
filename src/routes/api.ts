import { Hono } from "hono";
import { getRoutes, getRoute, searchStops, getStopsForRoute, getNearbyStops, getStop, getRouteDetail, getTripLookup, getRoutesForStop, getRouteHeadsigns } from "../data/db.js";
import { getVehicles, findArrivals, getStopArrivals } from "../data/realtime.js";
import { getMockVehicles, getMockPredictions } from "../data/mock.js";
import { getVapidPublicKey, registerCord, cancelCord, getActiveCordCount, testFireAll } from "../data/push.js";

const app = new Hono();

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
    const query = c.req.query("q");
    const lat = c.req.query("lat");
    const lon = c.req.query("lon");
    const radius = parseInt(c.req.query("radius") || "500");
    const limit = parseInt(c.req.query("limit") || "20");

    if (query) {
      let routeMatch: { route_short_name: string; route_color: string } | null = null;
      let routeStops: any[] = [];

      // If query looks like a route number, try matching a route
      if (/^\d+$/.test(query.trim())) {
        const route = getRoute(query.trim());
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
      
      if (isNaN(latitude) || isNaN(longitude)) {
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

// GET /api/route/:routeId - Route detail with shapes and stops
app.get("/route/:routeId", (c) => {
  try {
    const routeId = c.req.param("routeId");
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

    const threshold = Math.max(1, Math.min(30, thresholdMinutes || 2));
    const cordId = registerCord(subscription, routeId, stopId, vehicleId || null, tripId || null, directionId ?? null, threshold);
    return c.json({ cordId, status: "watching" });
  } catch (error) {
    console.error("Error registering cord:", error);
    return c.json({ error: "Failed to register cord" }, 500);
  }
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