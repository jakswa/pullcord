import { Hono } from "hono";
import { getRoutes, getRoute, searchStops, getNearbyStops, getStop, getRouteDetail, getTripLookup, getRoutesForStop } from "../data/db.js";
import { getVehicles, getPredictions } from "../data/realtime.js";

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
      // Text search
      const stops = searchStops(query, limit);
      
      // Enrich with routes for each stop
      const enrichedStops = stops.map(stop => {
        const routes = getRoutesForStop(stop.stop_id);
        return {
          ...stop,
          routes: routes.map(r => r.route_short_name)
        };
      });
      
      return c.json(enrichedStops);
      
    } else if (lat && lon) {
      // Location search
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lon);
      
      if (isNaN(latitude) || isNaN(longitude)) {
        return c.json({ error: "Invalid lat/lon parameters" }, 400);
      }
      
      const stops = getNearbyStops(latitude, longitude, radius, limit);
      
      // Enrich with routes
      const enrichedStops = stops.map(stop => {
        const routes = getRoutesForStop(stop.stop_id);
        return {
          ...stop,
          routes: routes.map(r => r.route_short_name)
        };
      });
      
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

// GET /api/predictions/:routeId/:stopId - ETA predictions for a specific stop
app.get("/predictions/:routeId/:stopId", async (c) => {
  try {
    const routeId = c.req.param("routeId");
    const stopId = c.req.param("stopId");
    
    // Verify route and stop exist
    const route = getRoute(routeId);
    const stop = getStop(stopId);
    
    if (!route) {
      return c.json({ error: "Route not found" }, 404);
    }
    
    if (!stop) {
      return c.json({ error: "Stop not found" }, 404);
    }
    
    // Get trip lookup for this route
    const tripLookup = getTripLookup(route.route_id);
    
    // Get predictions
    const predictions = await getPredictions(route.route_id, stopId, tripLookup);
    
    return c.json({
      stop: {
        stop_id: stop.stop_id,
        name: stop.stop_name,
        lat: stop.stop_lat,
        lon: stop.stop_lon
      },
      predictions
    });
    
  } catch (error) {
    console.error("Error fetching predictions:", error);
    return c.json({ error: "Failed to fetch predictions" }, 500);
  }
});

export default app;