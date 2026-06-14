// Offline preview harness: render rail pages with synthetic arrivals to static
// HTML so the redesign can be screenshotted without a live MARTA API key.
// Usage: bun run tools/rail-preview.ts  (writes /tmp/rail-*.html)
import type { RailArrival } from "../src/rail/api.js";
import {
  RailLandingPage,
  RailStationPage,
  RailTrainPage,
} from "../src/views/pages/rail/index.js";

function a(
  station: string,
  line: RailArrival["line"],
  destination: string,
  direction: string,
  waitSeconds: number,
  trainId: string,
  opts: Partial<RailArrival> = {},
): RailArrival {
  return {
    station,
    line,
    destination,
    direction,
    waitSeconds,
    waitTime: waitSeconds < 60 ? "Boarding" : `${Math.round(waitSeconds / 60)} min`,
    trainId,
    tripId: trainId + "-trip",
    nextArr: "",
    isRealtime: true,
    hasStarted: true,
    isFirstStop: false,
    eventTime: "",
    ...opts,
  };
}

// A spread of stations covering 1/2/4-direction layouts + scheduled + boarding.
const arrivals: RailArrival[] = [
  // Midtown — N (gold soon, red later), S (red)
  a("MIDTOWN STATION", "GOLD", "DORAVILLE STATION", "N", 60, "401"),
  a("MIDTOWN STATION", "RED", "NORTH SPRINGS STATION", "N", 240, "402"),
  a("MIDTOWN STATION", "GOLD", "DORAVILLE STATION", "N", 600, "403"),
  a("MIDTOWN STATION", "RED", "AIRPORT STATION", "S", 540, "404"),
  a("MIDTOWN STATION", "RED", "AIRPORT STATION", "S", 1080, "405"),
  // Five Points — all four directions
  a("FIVE POINTS STATION", "GOLD", "DORAVILLE STATION", "N", 420, "410"),
  a("FIVE POINTS STATION", "RED", "AIRPORT STATION", "S", 180, "411"),
  a("FIVE POINTS STATION", "BLUE", "INDIAN CREEK STATION", "E", 60, "412"),
  a("FIVE POINTS STATION", "GREEN", "BANKHEAD STATION", "W", 300, "413"),
  a("FIVE POINTS STATION", "BLUE", "HAMILTON E HOLMES STATION", "W", 900, "414"),
  // Decatur — blue E/W
  a("DECATUR STATION", "BLUE", "INDIAN CREEK STATION", "E", 240, "420"),
  a("DECATUR STATION", "BLUE", "HAMILTON E HOLMES STATION", "W", 480, "421"),
  // Arts Center
  a("ARTS CENTER STATION", "RED", "NORTH SPRINGS STATION", "N", 180, "430"),
  a("ARTS CENTER STATION", "GOLD", "AIRPORT STATION", "S", 60, "431"),
  // North Avenue
  a("NORTH AVE STATION", "RED", "NORTH SPRINGS STATION", "N", 300, "440"),
  a("NORTH AVE STATION", "GOLD", "AIRPORT STATION", "S", 60, "441"),
  // Airport — single direction, one scheduled
  a("AIRPORT STATION", "RED", "NORTH SPRINGS STATION", "N", 60, "450"),
  a("AIRPORT STATION", "GOLD", "DORAVILLE STATION", "N", 900, "451", { isRealtime: false }),
  // Buckhead
  a("BUCKHEAD STATION", "RED", "NORTH SPRINGS STATION", "N", 360, "460"),
  a("BUCKHEAD STATION", "RED", "AIRPORT STATION", "S", 720, "461"),
];

// A train timeline: train 411 southbound on RED, mid-route near Midtown.
// Stops north of the current one (North Springs, Arts Center) render dimmed
// "departed"; Midtown is the soonest (next) stop; the rest are upcoming.
const trainArrivals: RailArrival[] = [
  a("NORTH SPRINGS STATION", "RED", "AIRPORT STATION", "S", 720, "411"),
  a("ARTS CENTER STATION", "RED", "AIRPORT STATION", "S", 480, "411"),
  a("MIDTOWN STATION", "RED", "AIRPORT STATION", "S", 40, "411"),
  a("NORTH AVE STATION", "RED", "AIRPORT STATION", "S", 240, "411"),
  a("FIVE POINTS STATION", "RED", "AIRPORT STATION", "S", 420, "411"),
  a("WEST END STATION", "RED", "AIRPORT STATION", "S", 660, "411"),
  a("EAST POINT STATION", "RED", "AIRPORT STATION", "S", 900, "411"),
  a("AIRPORT STATION", "RED", "AIRPORT STATION", "S", 1140, "411"),
];

const pages: Record<string, string> = {
  "/tmp/rail-landing.html": (<RailLandingPage arrivals={arrivals} standalone />).toString(),
  "/tmp/rail-station.html": (
    <RailStationPage stationName="FIVE POINTS STATION" arrivals={arrivals.filter((x) => x.station === "FIVE POINTS STATION")} standalone />
  ).toString(),
  "/tmp/rail-train.html": (<RailTrainPage trainId="411" arrivals={trainArrivals} standalone />).toString(),
};

// Seed favorites on the landing page so a plain headless-browser screenshot
// (which starts with empty localStorage) renders the hero cards instead of the
// empty state. Runs before the client script that reads localStorage.
const seed = `<script>localStorage.setItem("rail-starred",JSON.stringify(["midtown","five-points"]))</script>`;

for (const [path, html] of Object.entries(pages)) {
  const out = path.includes("landing")
    ? html.replace('<body class="rail-body">', '<body class="rail-body">' + seed)
    : html;
  await Bun.write(path, out);
  console.log("wrote", path);
}
