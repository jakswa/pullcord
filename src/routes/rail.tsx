import { Hono, type MiddlewareHandler } from "hono";
import type { AppEnv } from "../app.js";
import { fetchArrivals, stationSlug } from "../rail/api.js";
import {
  RailLandingPage,
  RailStationList,
  RailStationPage,
  RailStationDetail,
  RailTrainPage,
  RailTrainTimeline,
  railDataInfo,
} from "../views/pages/rail/index.js";

const app = new Hono<AppEnv>();

// Rail pages and partials carry live ETAs: never let a browser, PWA launch or
// tab restore reuse a cached copy (the rail-host "/" rewrite goes through
// /rail, so it's covered too). Partials also carry the data timestamp/age in
// headers (full pages render them as data-ts / data-age on #rail-data) so the
// client's freshness pill reflects the real age of the data.
const railHeaders: MiddlewareHandler = async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
  if (c.req.query("partial") !== "1") return;
  const info = railDataInfo();
  if (info) {
    c.header("X-Data-Ts", String(info.ts));
    c.header("X-Data-Age", String(info.age));
  }
};
// "/rail/*" also matches "/rail" itself in Hono, so one registration covers both.
app.use("/rail/*", railHeaders);

// GET /rail — landing page (all stations)
app.get("/rail", async (c) => {
  const arrivals = await fetchArrivals();
  const partial = c.req.query("partial");
  const isRailHost = c.get("isRailHost") || false;

  if (partial === "1") {
    return c.html(<RailStationList arrivals={arrivals} />);
  }

  return c.html(<RailLandingPage arrivals={arrivals} standalone={isRailHost} />);
});

// GET /rail/train/:trainId — train timeline
app.get("/rail/train/:trainId", async (c) => {
  const trainId = c.req.param("trainId");
  const arrivals = await fetchArrivals();
  const partial = c.req.query("partial");
  const isRailHost = c.get("isRailHost") || false;

  if (partial === "1") {
    return c.html(<RailTrainTimeline trainId={trainId} arrivals={arrivals} />);
  }

  return c.html(
    <RailTrainPage trainId={trainId} arrivals={arrivals} standalone={isRailHost} />
  );
});

// GET /rail/:slug — station detail
app.get("/rail/:slug", async (c) => {
  const slug = c.req.param("slug");
  const arrivals = await fetchArrivals();
  const isRailHost = c.get("isRailHost") || false;

  // Find matching station
  const stationArrivals = arrivals.filter(
    (a) => stationSlug(a.station) === slug
  );

  if (stationArrivals.length === 0) {
    const allStations = new Set(arrivals.map((a) => a.station));
    let matchedStation = "";
    for (const s of allStations) {
      if (stationSlug(s) === slug) {
        matchedStation = s;
        break;
      }
    }

    if (!matchedStation) {
      matchedStation = slug
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")
        .toUpperCase() + " STATION";
    }

    const partial = c.req.query("partial");
    if (partial === "1") {
      return c.html(
        <RailStationDetail stationName={matchedStation} arrivals={[]} />
      );
    }

    return c.html(
      <RailStationPage stationName={matchedStation} arrivals={[]} standalone={isRailHost} />
    );
  }

  const stationName = stationArrivals[0].station;
  const partial = c.req.query("partial");

  if (partial === "1") {
    return c.html(
      <RailStationDetail stationName={stationName} arrivals={stationArrivals} />
    );
  }

  return c.html(
    <RailStationPage stationName={stationName} arrivals={stationArrivals} standalone={isRailHost} />
  );
});

export default app;
