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

  if (partial === "1") {
    // Return just the station list HTML for live updates
    return c.html(<RailStationList arrivals={arrivals} />);
  }

  return c.html(<RailLandingPage arrivals={arrivals} />);
});

// GET /rail/:slug — station detail
app.get("/rail/:slug", async (c) => {
  const slug = c.req.param("slug");
  const arrivals = await fetchArrivals();

  // Find matching station
  const stationArrivals = arrivals.filter(
    (a) => stationSlug(a.station) === slug
  );

  if (stationArrivals.length === 0) {
    // Check if the station exists at all (might just have no current arrivals)
    // Try to find a station name that matches the slug
    const allStations = new Set(arrivals.map((a) => a.station));
    let matchedStation = "";
    for (const s of allStations) {
      if (stationSlug(s) === slug) {
        matchedStation = s;
        break;
      }
    }

    if (!matchedStation) {
      // Station not found at all — could be valid but no trains running
      // Try to reconstruct station name from slug
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
      <RailStationPage stationName={matchedStation} arrivals={[]} />
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
    <RailStationPage stationName={stationName} arrivals={stationArrivals} />
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
