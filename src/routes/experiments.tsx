import { Hono } from "hono";
import { ExperimentLayout } from "../views/ExperimentLayout.js";
import { getRoute, getStop, getRouteDetail } from "../data/db.js";

// Experiment page imports
import { HomePage as HomeA } from "../views/experiments/a/Home.js";
import { BusTrackerPage as BusTrackerA } from "../views/experiments/a/BusTracker.js";
import { HomePage as HomeB } from "../views/experiments/b/Home.js";
import { BusTrackerPage as BusTrackerB } from "../views/experiments/b/BusTracker.js";
import { HomePage as HomeC } from "../views/experiments/c/Home.js";
import { BusTrackerPage as BusTrackerC } from "../views/experiments/c/BusTracker.js";

const experiments: Record<string, { Home: any; BusTracker: any }> = {
  a: { Home: HomeA, BusTracker: BusTrackerA },
  b: { Home: HomeB, BusTracker: BusTrackerB },
  c: { Home: HomeC, BusTracker: BusTrackerC },
};

const app = new Hono();

// GET /v/:variant/ — Experiment home page
app.get("/:variant", (c) => {
  const variant = c.req.param("variant");
  const exp = experiments[variant];
  if (!exp) return c.text(`Experiment "${variant}" not found. Available: ${Object.keys(experiments).join(", ")}`, 404);

  const HomePage = exp.Home;
  return c.html(
    <ExperimentLayout title={`Experiment ${variant.toUpperCase()} — Pullcord`} variant={variant}>
      <HomePage />
    </ExperimentLayout>
  );
});

// GET /v/:variant/bus?route=X&stop=Y — Experiment tracker page
app.get("/:variant/bus", async (c) => {
  const variant = c.req.param("variant");
  const exp = experiments[variant];
  if (!exp) return c.text(`Experiment "${variant}" not found`, 404);

  const routeId = c.req.query("route");
  const stopId = c.req.query("stop");
  if (!routeId || !stopId) return c.redirect(`/v/${variant}`);

  try {
    const route = getRoute(routeId);
    const stop = getStop(stopId);
    if (!route || !stop) return c.redirect(`/v/${variant}`);

    const routeDetail = getRouteDetail(route.route_id);
    if (!routeDetail) throw new Error("Failed to load route details");

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

    const BusTrackerPage = exp.BusTracker;
    return c.html(
      <ExperimentLayout title={`Route ${route.route_short_name} at ${stop.stop_name} — Experiment ${variant.toUpperCase()}`} variant={variant}>
        <BusTrackerPage
          route={route}
          stop={stop}
          routeDetail={routeDetail}
          initialData={initialData}
        />
      </ExperimentLayout>
    );
  } catch (error) {
    console.error("Experiment error:", error);
    return c.text("Error loading experiment", 500);
  }
});

export default app;
