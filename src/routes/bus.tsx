import { Hono } from "hono";
import { Layout } from "../views/Layout.js";
import { BusTrackerPage } from "../views/pages/BusTracker.js";
import { getRoute, getStop, getRouteDetail } from "../data/db.js";

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
        direction: s.direction_id
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

export default app;