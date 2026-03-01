import { Hono } from "hono";
import { getLatestSnapshot, getSystemTimeSeries, getLatestRouteSnapshots, getLatestRailSnapshots } from "../data/metrics.js";
import { getRoutes } from "../data/db.js";
import { StatsPage, StatsContent } from "../views/pages/Stats.js";

const app = new Hono();

app.get("/stats", (c) => {
  const partial = c.req.query("partial");
  const snapshot = getLatestSnapshot();
  const timeSeries = getSystemTimeSeries(6);
  const routeSnapshots = getLatestRouteSnapshots();
  const railSnapshots = getLatestRailSnapshots();
  const routes = getRoutes();
  const nameMap = new Map(routes.map(r => [r.route_id, r.route_short_name]));
  const firstTs = timeSeries.length > 0 ? timeSeries[0].ts : 0;
  const lastTs = timeSeries.length > 0 ? timeSeries[timeSeries.length - 1].ts : 0;
  const hoursOfData = ((lastTs - firstTs) / 3600).toFixed(1);

  if (partial === "1") {
    return c.html(
      <StatsContent
        snapshot={snapshot}
        timeSeries={timeSeries}
        routeSnapshots={routeSnapshots}
        railSnapshots={railSnapshots}
        nameMap={nameMap}
        hoursOfData={hoursOfData}
      />
    );
  }

  return c.html(<StatsPage />);
});

export default app;
