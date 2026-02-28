import { Hono } from "hono";
import { fetchArrivals, stationSlug, stationDisplayName } from "../rail/api.js";
import {
  RailLandingPage,
  RailStationList,
  RailStationPage,
  RailStationDetail,
} from "../views/pages/Rail.js";

const app = new Hono();

// GET /rail — landing page (all stations)
app.get("/rail", async (c) => {
  const arrivals = await fetchArrivals();
  const partial = c.req.query("partial");
  const isRailHost = c.get("isRailHost" as any) || false;

  if (partial === "1") {
    return c.html(<RailStationList arrivals={arrivals} />);
  }

  return c.html(<RailLandingPage arrivals={arrivals} standalone={isRailHost} />);
});

// GET /rail/:slug — station detail
app.get("/rail/:slug", async (c) => {
  const slug = c.req.param("slug");
  const arrivals = await fetchArrivals();
  const isRailHost = c.get("isRailHost" as any) || false;

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

// GET /api/rail — JSON endpoint
app.get("/api/rail", async (c) => {
  const arrivals = await fetchArrivals();
  return c.json({
    arrivals,
    timestamp: Date.now(),
  });
});

export default app;
