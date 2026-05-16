import { Hono } from "hono";
import { Layout } from "../views/Layout.js";
import { RidePage } from "../views/pages/Ride.js";
import { getRoute } from "../data/db.js";

const app = new Hono();

const SAFE_PARAM = /^[a-zA-Z0-9_.\-]{1,80}$/;

// GET /ride?trip=TRIPID&stop=STOPID — ride view (track your position on a trip)
app.get("/ride", (c) => {
  const tripId = c.req.query("trip");
  const stopId = c.req.query("stop"); // destination stop
  const routeId = c.req.query("route");

  // Validate query params to prevent XSS via crafted URLs
  if (tripId && !SAFE_PARAM.test(tripId)) return c.redirect("/");
  if (stopId && !SAFE_PARAM.test(stopId)) return c.redirect("/");
  if (routeId && !SAFE_PARAM.test(routeId)) return c.redirect("/");

  const publicRouteId = routeId ? (getRoute(routeId)?.route_short_name || routeId) : "";

  if (!tripId) return c.redirect("/");

  if (routeId && publicRouteId !== routeId) {
    const url = new URL(c.req.url);
    url.searchParams.set("route", publicRouteId);
    return c.redirect(`${url.pathname}?${url.searchParams.toString()}`);
  }

  return c.html(
    <Layout
      title="Ride View — Pullcord"
      description="Track your position along the route. We'll tell you when to pull the cord."
      canonicalPath={`/ride?trip=${tripId}`}
    >
      <RidePage tripId={tripId} stopId={stopId || ""} routeId={publicRouteId} />
    </Layout>
  );
});

export default app;
