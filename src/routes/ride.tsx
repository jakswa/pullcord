import { Hono } from "hono";
import { Layout } from "../views/Layout.js";
import { RidePage } from "../views/pages/Ride.js";

const app = new Hono();

// GET /ride?trip=TRIPID&stop=STOPID — ride view (track your position on a trip)
app.get("/ride", (c) => {
  const tripId = c.req.query("trip");
  const stopId = c.req.query("stop"); // destination stop
  const routeId = c.req.query("route");

  if (!tripId) return c.redirect("/");

  return c.html(
    <Layout
      title="Ride View — Pullcord"
      description="Track your position along the route. We'll tell you when to pull the cord."
      canonicalPath={`/ride?trip=${tripId}`}
    >
      <RidePage tripId={tripId} stopId={stopId || ""} routeId={routeId || ""} />
    </Layout>
  );
});

export default app;
