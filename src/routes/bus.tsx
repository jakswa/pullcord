import { Hono } from "hono";
import { Layout } from "../views/Layout.js";
import { BusTrackerPage } from "../views/pages/BusTracker.js";
import { StopViewPage } from "../views/pages/StopView.js";
import { getRoute, getStop, getRouteDetail, getRoutesForStop } from "../data/db.js";

const app = new Hono();

// GET /bus?route=39&stop=204230 - Bus tracker page
app.get("/bus", async (c) => {
  const routeId = c.req.query("route");
  const stopId = c.req.query("stop");

  if (!routeId || !stopId) {
    return c.redirect("/");
  }

  try {
    // Get route and stop data
    const route = getRoute(routeId);
    const stop = getStop(stopId);

    if (!route) {
      return c.html(
        <Layout title="Route Not Found — Pullcord">
          <div class="min-h-screen bg-gray-50 flex items-center justify-center">
            <div class="text-center">
              <h1 class="text-2xl font-bold text-gray-900 mb-4">Route Not Found</h1>
              <p class="text-gray-600 mb-6">The route "{routeId}" could not be found.</p>
              <a href="/" class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700">
                ← Back to Home
              </a>
            </div>
          </div>
        </Layout>
      );
    }

    if (!stop) {
      return c.html(
        <Layout title="Stop Not Found — Pullcord">
          <div class="min-h-screen bg-gray-50 flex items-center justify-center">
            <div class="text-center">
              <h1 class="text-2xl font-bold text-gray-900 mb-4">Stop Not Found</h1>
              <p class="text-gray-600 mb-6">The stop "{stopId}" could not be found.</p>
              <a href="/" class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700">
                ← Back to Home
              </a>
            </div>
          </div>
        </Layout>
      );
    }

    // Get route details (shapes and stops)
    const routeDetail = getRouteDetail(route.route_id);
    
    if (!routeDetail) {
      throw new Error("Failed to load route details");
    }

    // Prepare initial data for client-side JavaScript
    const initialData = {
      route: {
        id: route.route_id,
        shortName: route.route_short_name,
        longName: route.route_long_name,
        color: route.route_color || "#1f2937"
      },
      stop: {
        id: stop.stop_id,
        name: stop.stop_name,
        lat: stop.stop_lat,
        lon: stop.stop_lon
      },
      shapes: routeDetail.shapes,
      stops: routeDetail.stops.map(s => ({
        id: s.stop_id,
        name: s.stop_name,
        lat: s.stop_lat,
        lon: s.stop_lon,
        direction: s.direction_id,
        sequence: s.stop_sequence ?? 0
      })),
      timestamp: Date.now()
    };

    // Render the bus tracker page
    return c.html(
      <Layout title={`Route ${route.route_short_name} at ${stop.stop_name} — Pullcord`}>
        <BusTrackerPage
          route={route}
          stop={stop}
          routeDetail={routeDetail}
          initialData={initialData}
        />
      </Layout>
    );

  } catch (error) {
    console.error("Error rendering bus tracker page:", error);
    
    return c.html(
      <Layout title="Error — Pullcord">
        <div class="min-h-screen bg-gray-50 flex items-center justify-center">
          <div class="text-center">
            <h1 class="text-2xl font-bold text-gray-900 mb-4">Something went wrong</h1>
            <p class="text-gray-600 mb-6">Unable to load the bus tracker. Please try again.</p>
            <a href="/" class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700">
              ← Back to Home
            </a>
          </div>
        </div>
      </Layout>
    );
  }
});

// GET /stop?id=104012 — Multi-route stop view
app.get("/stop", async (c) => {
  const stopId = c.req.query("id");
  if (!stopId) return c.redirect("/");

  try {
    const stop = getStop(stopId);
    if (!stop) return c.redirect("/");

    const routes = getRoutesForStop(stopId);
    if (routes.length === 0) return c.redirect("/");

    // If only one bus route serves this stop, go straight to route tracker
    if (routes.length === 1) {
      return c.redirect(`/bus?route=${routes[0].route_id}&stop=${stopId}`);
    }

    return c.html(
      <StopViewPage
        stop={{ stop_id: stop.stop_id, stop_name: stop.stop_name, stop_lat: stop.stop_lat, stop_lon: stop.stop_lon }}
        routes={routes.map(r => ({ route_id: r.route_id, route_short_name: r.route_short_name, route_long_name: r.route_long_name, route_color: r.route_color }))}
      />
    );
  } catch (error) {
    console.error("Error rendering stop view:", error);
    return c.redirect("/");
  }
});

export default app;