import type { RailArrival } from "../../../rail/api.js";
import { stationSlug, stationDisplayName } from "../../../rail/api.js";
export { LINE_COLORS } from "../../../data/rail-colors.js";

// ── Station orderings for train timeline (north→south per line) ──
export const LINE_STATIONS: Record<string, string[]> = {
  RED: [
    "Airport", "College Park", "East Point", "Lakewood", "Oakland City", "West End",
    "Garnett", "Five Points", "Peachtree Center", "Civic Center", "North Ave",
    "Midtown", "Arts Center", "Lindbergh", "Buckhead", "Medical Center", "Dunwoody",
    "Sandy Springs", "North Springs",
  ],
  GOLD: [
    "Airport", "College Park", "East Point", "Lakewood", "Oakland City", "West End",
    "Garnett", "Five Points", "Peachtree Center", "Civic Center", "North Ave",
    "Midtown", "Arts Center", "Lindbergh", "Lenox", "Brookhaven", "Chamblee", "Doraville",
  ],
  BLUE: [
    "Hamilton E Holmes", "West Lake", "Ashby", "Vine City", "Omni Dome",
    "Five Points", "Georgia State", "King Memorial", "Inman Park",
    "Edgewood Candler Park", "East Lake", "Decatur", "Avondale", "Kensington",
    "Indian Creek",
  ],
  GREEN: [
    "Bankhead", "Ashby", "Vine City", "Omni Dome", "Five Points", "Georgia State",
    "King Memorial", "Inman Park", "Edgewood Candler Park",
  ],
};

// Station coordinates for nearby feature [lat, lng]
export const STATION_COORDS: Record<string, [number, number]> = {
  "airport": [33.64056, -84.44620],
  "arts-center": [33.78926, -84.38727],
  "ashby": [33.75648, -84.41728],
  "avondale": [33.77538, -84.28198],
  "bankhead": [33.77241, -84.42892],
  "brookhaven": [33.86016, -84.33932],
  "buckhead": [33.84788, -84.36767],
  "chamblee": [33.88772, -84.30596],
  "civic-center": [33.76616, -84.38754],
  "college-park": [33.65043, -84.44863],
  "decatur": [33.77469, -84.29537],
  "doraville": [33.90254, -84.28075],
  "dunwoody": [33.92099, -84.34440],
  "east-lake": [33.76522, -84.31318],
  "east-point": [33.67699, -84.44057],
  "edgewood-candler-park": [33.76183, -84.34064],
  "five-points": [33.75398, -84.39157],
  "garnett": [33.74882, -84.39564],
  "georgia-state": [33.75015, -84.38590],
  "hamilton-e-holmes": [33.75454, -84.46956],
  "indian-creek": [33.76987, -84.22939],
  "inman-park": [33.75734, -84.35291],
  "kensington": [33.77263, -84.25200],
  "king-memorial": [33.74990, -84.37583],
  "lakewood": [33.70059, -84.42882],
  "lenox": [33.84531, -84.35821],
  "lindbergh": [33.82346, -84.36933],
  "medical-center": [33.91069, -84.35162],
  "midtown": [33.78123, -84.38653],
  "north-ave": [33.77179, -84.38674],
  "north-springs": [33.94491, -84.35725],
  "oakland-city": [33.71723, -84.42549],
  "omni-dome": [33.75790, -84.39650],
  "peachtree-center": [33.75811, -84.38757],
  "sandy-springs": [33.93169, -84.35100],
  "vine-city": [33.75661, -84.40396],
  "west-end": [33.73606, -84.41362],
  "west-lake": [33.75329, -84.44545],
};

// Canonical station order — alphabetical for landing page
export const STATION_ORDER = [
  "AIRPORT STATION",
  "ARTS CENTER STATION",
  "ASHBY STATION",
  "AVONDALE STATION",
  "BANKHEAD STATION",
  "BROOKHAVEN STATION",
  "BUCKHEAD STATION",
  "CHAMBLEE STATION",
  "CIVIC CENTER STATION",
  "COLLEGE PARK STATION",
  "DECATUR STATION",
  "DORAVILLE STATION",
  "DUNWOODY STATION",
  "EAST LAKE STATION",
  "EAST POINT STATION",
  "EDGEWOOD CANDLER PARK STATION",
  "FIVE POINTS STATION",
  "GARNETT STATION",
  "GEORGIA STATE STATION",
  "HAMILTON E HOLMES STATION",
  "INDIAN CREEK STATION",
  "INMAN PARK STATION",
  "KENSINGTON STATION",
  "KING MEMORIAL STATION",
  "LAKEWOOD STATION",
  "LENOX STATION",
  "LINDBERGH STATION",
  "MEDICAL CENTER STATION",
  "MIDTOWN STATION",
  "NORTH AVE STATION",
  "NORTH SPRINGS STATION",
  "OAKLAND CITY STATION",
  "OMNI DOME STATION",
  "PEACHTREE CENTER STATION",
  "SANDY SPRINGS STATION",
  "VINE CITY STATION",
  "WEST END STATION",
  "WEST LAKE STATION",
];

// Direction → glyph used across hero cards, board rows, and list tokens.
export const DIR_ARROW: Record<string, string> = { N: "↑", S: "↓", E: "→", W: "←" };

// Canonical direction order (N/S then E/W) so quad-direction hubs lay out
// consistently as ↑/↓ over →/←.
export const DIR_ORDER = ["N", "S", "E", "W"];

// Canonical line order for line dots / chips.
export const LINE_ORDER = ["RED", "GOLD", "BLUE", "GREEN"];

// ── Types ──
// A single upcoming arrival in one direction, trimmed to what the hero card and
// list rows need to render (the full RailArrival is heavier than the view uses).
export interface DirArrival {
  eta: number; // seconds until arrival (waitSeconds)
  dest: string; // display-cased destination, line dropped of "STATION"
  line: string; // RED | GOLD | BLUE | GREEN
  rt: boolean; // realtime (vs scheduled)
}

export interface StationRow {
  name: string; // display name, e.g. "Five Points"
  slug: string; // url slug, e.g. "five-points"
  lines: string[]; // lines serving this station, canonical order
  // Up to 3 soonest arrivals per direction, soonest first. Only directions with
  // service are present. This is the single payload the client projects into
  // both compact list rows (soonest token) and full hero cards (then-times).
  dirs: Record<string, DirArrival[]>;
}

// ── Helpers ──
export function formatTime(seconds: number): string {
  if (seconds < 60) return "NOW";
  const mins = Math.floor(seconds / 60);
  return `:${mins.toString().padStart(2, "0")}`;
}

export function normalizeStation(s: string): string {
  return s.toUpperCase().replace(/ STATION$/i, "").trim();
}

export function buildStationRows(arrivals: RailArrival[]): StationRow[] {
  const byStation = new Map<string, RailArrival[]>();
  for (const a of arrivals) {
    const list = byStation.get(a.station) || [];
    list.push(a);
    byStation.set(a.station, list);
  }

  const seen = new Set<string>();
  const rows: StationRow[] = [];

  const allStations = [...STATION_ORDER];
  for (const name of byStation.keys()) {
    if (!allStations.includes(name)) {
      allStations.push(name);
    }
  }

  for (const stationName of allStations) {
    if (seen.has(stationName)) continue;
    seen.add(stationName);

    const stationArrivals = byStation.get(stationName) || [];

    // Group arrivals by direction, soonest first, keep up to 3 per direction.
    const byDir: Record<string, DirArrival[]> = {};
    const sorted = [...stationArrivals].sort((a, b) => a.waitSeconds - b.waitSeconds);
    for (const a of sorted) {
      const list = byDir[a.direction] || (byDir[a.direction] = []);
      if (list.length < 3) {
        list.push({
          eta: a.waitSeconds,
          dest: stationDisplayName(a.destination),
          line: a.line,
          rt: a.isRealtime,
        });
      }
    }

    // Lines serving this station, in canonical order, derived from live arrivals.
    const lineSet = new Set<string>(stationArrivals.map((a) => a.line));
    const lines = LINE_ORDER.filter((l) => lineSet.has(l));

    rows.push({
      name: stationDisplayName(stationName),
      slug: stationSlug(stationName),
      lines,
      dirs: byDir,
    });
  }

  return rows;
}
