import { Hono } from "hono";
import { Layout } from "../views/Layout.js";
import { BusTrackerPage } from "../views/pages/BusTracker.js";
import { getRoute, getStop, getRouteDetail, getRoutesForStop } from "../data/db.js";

const app = new Hono();

const ROUTE_ID_RE = /^[a-zA-Z0-9_-]{1,20}$/;
const STOP_ID_RE = /^[a-zA-Z0-9]{1,20}$/;

// GET /bus?stop=204230 — multi-route stop view
// GET /bus?route=39&stop=204230 — single-route tracker
app.get("/bus", async (c) => {
  const routeId = c.req.query("route");
  const stopId = c.req.query("stop");

  if (!stopId) {
    return c.redirect("/");
  }

  // Validate params before hitting the DB
  if (!STOP_ID_RE.test(stopId)) {
    return c.redirect("/");
  }
  if (routeId && !ROUTE_ID_RE.test(routeId)) {
    return c.redirect("/");
  }

  // No route specified → multi-route mode
  if (!routeId) {
    try {
      const stop = getStop(stopId);
      if (!stop) return c.redirect("/");

      const routes = getRoutesForStop(stopId);
      if (routes.length === 0) return c.redirect("/");

      // Single route? Redirect to route-specific view
      if (routes.length === 1) {
        return c.redirect(`/bus?route=${routes[0].route_short_name}&stop=${stopId}`);
      }

      const initialData = {
        multiRoute: true,
        stop: { id: stop.stop_id, name: stop.stop_name, lat: stop.stop_lat, lon: stop.stop_lon },
        routes: routes.map(r => ({ id: r.route_short_name, internalId: r.route_id, shortName: r.route_short_name, longName: r.route_long_name, color: r.route_color })),
        timestamp: Date.now(),
      };

      return c.html(
        <Layout title={`${stop.stop_name} — Pullcord`} description={`Live bus arrivals at ${stop.stop_name}. Routes: ${routes.map(r => r.route_short_name).join(', ')}.`} ogImage="/public/icons/og-bus.png" canonicalPath={`/bus?stop=${stop.stop_id}`}>
          <BusTrackerPage
            route={null}
            stop={stop}
            routeDetail={null}
            initialData={initialData}
          />
        </Layout>
      );
    } catch (error) {
      console.error("Error rendering multi-route view:", error);
      return c.redirect("/");
    }
  }

  try {
    // Get route and stop data
    const route = getRoute(routeId);
    const stop = getStop(stopId);

    if (!route) {
      return c.html(
        <Layout title="Route Not Found — Pullcord">
          <div style="min-height:100vh;background:#f9fafb;display:flex;align-items:center;justify-content:center">
            <div style="text-align:center;max-width:400px;margin:0 auto">
              <h1 style="font-size:1.5rem;font-weight:bold;color:#111827;margin-bottom:1rem">Route Not Found</h1>
              <p style="color:#6b7280;margin-bottom:1.5rem">The route "{routeId}" could not be found.</p>
              <a href="/" style="display:inline-block;background:#2563eb;color:#fff;padding:0.75rem 1.5rem;border-radius:0.5rem;text-decoration:none">
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
          <div style="min-height:100vh;background:#f9fafb;display:flex;align-items:center;justify-content:center">
            <div style="text-align:center;max-width:400px;margin:0 auto">
              <h1 style="font-size:1.5rem;font-weight:bold;color:#111827;margin-bottom:1rem">Stop Not Found</h1>
              <p style="color:#6b7280;margin-bottom:1.5rem">The stop "{stopId}" could not be found.</p>
              <a href="/" style="display:inline-block;background:#2563eb;color:#fff;padding:0.75rem 1.5rem;border-radius:0.5rem;text-decoration:none">
                ← Back to Home
              </a>
            </div>
          </div>
        </Layout>
      );
    }

    if (routeId !== route.route_short_name) {
      const url = new URL(c.req.url);
      url.searchParams.set("route", route.route_short_name);
      return c.redirect(`${url.pathname}?${url.searchParams.toString()}`);
    }

    // Get route details (shapes and stops)
    const routeDetail = getRouteDetail(route.route_id);
    
    if (!routeDetail) {
      throw new Error("Failed to load route details");
    }

    // Prepare initial data for client-side JavaScript
    const initialData = {
      route: {
        id: route.route_short_name,
        internalId: route.route_id,
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
        sequence: s.stop_sequence ?? 0,
        arrivalTime: s.arrival_time ?? null
      })),
      timestamp: Date.now()
    };

    // Render the bus tracker page
    return c.html(
      <Layout title={`Route ${route.route_short_name} at ${stop.stop_name} — Pullcord`} ogImage="/public/icons/og-bus.png" canonicalPath={`/bus?route=${route.route_short_name}&stop=${stop.stop_id}`}>
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
        <div style="min-height:100vh;background:#f9fafb;display:flex;align-items:center;justify-content:center">
          <div style="text-align:center;max-width:400px;margin:0 auto">
            <h1 style="font-size:1.5rem;font-weight:bold;color:#111827;margin-bottom:1rem">Something went wrong</h1>
            <p style="color:#6b7280;margin-bottom:1.5rem">Unable to load the bus tracker. Please try again.</p>
            <a href="/" style="display:inline-block;background:#2563eb;color:#fff;padding:0.75rem 1.5rem;border-radius:0.5rem;text-decoration:none">
              ← Back to Home
            </a>
          </div>
        </div>
      </Layout>
    );
  }
});

// Redirect old /stop URLs to /bus
app.get("/stop", (c) => {
  const stopId = c.req.query("id");
  return stopId ? c.redirect(`/bus?stop=${stopId}`) : c.redirect("/");
});

export default app;