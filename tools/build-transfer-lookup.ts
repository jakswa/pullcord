/**
 * Build bus↔rail transfer stop lookup table.
 *
 * Computes which bus stops are within 200 m of MARTA rail stations
 * using haversine distance on GPS coordinates from the GTFS database.
 *
 * Usage: bun run tools/build-transfer-lookup.ts
 * Output: data/transfer-stops.json
 */

import { Database } from "bun:sqlite";

const RADIUS_M = 200;
const DB_PATH = "data/marta.db";
const OUT_PATH = "data/transfer-stops.json";

// Rail routes in MARTA GTFS (no route_type column, so match by short name)
const RAIL_SHORT_NAMES = ["BLUE", "GOLD", "GREEN", "RED"];

// ---------------------------------------------------------------------------
// Haversine distance in meters
// ---------------------------------------------------------------------------
function haversine(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------------------------------------------------------------------------
// Normalize station name — collapse extra spaces, title case, trim
// ---------------------------------------------------------------------------
function normalizeStationName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const db = new Database(DB_PATH, { readonly: true });

// 1. Find rail route IDs
const railRouteIds: string[] = db
  .query(
    `SELECT route_id FROM routes WHERE route_short_name IN (${RAIL_SHORT_NAMES.map(() => "?").join(",")})`,
  )
  .all(...RAIL_SHORT_NAMES)
  .map((r: any) => r.route_id);

if (railRouteIds.length === 0) {
  console.error("No rail routes found — check RAIL_SHORT_NAMES");
  process.exit(1);
}

// 2. Find all stop_ids served by rail routes
const railStopRows: { stop_id: string; stop_name: string; stop_lat: number; stop_lon: number }[] =
  db.query(
    `SELECT DISTINCT s.stop_id, s.stop_name, s.stop_lat, s.stop_lon
     FROM stops s
     JOIN stop_times st ON s.stop_id = st.stop_id
     JOIN trips t ON st.trip_id = t.trip_id
     WHERE t.route_id IN (${railRouteIds.map(() => "?").join(",")})`,
  ).all(...railRouteIds) as any;

const railStopIds = new Set(railStopRows.map((r) => r.stop_id));

// 3. Group rail stops by station name → pick representative coords (centroid)
interface RailStation {
  name: string;
  stop_ids: string[];
  points: { stop_id: string; lat: number; lon: number }[];
  lat: number; // centroid
  lon: number; // centroid
  representative_stop_id: string;
}

const stationMap = new Map<string, RailStation>();

for (const row of railStopRows) {
  const name = normalizeStationName(row.stop_name);
  let station = stationMap.get(name);
  if (!station) {
    station = {
      name,
      stop_ids: [],
      points: [],
      lat: 0,
      lon: 0,
      representative_stop_id: row.stop_id,
    };
    stationMap.set(name, station);
  }
  station.stop_ids.push(row.stop_id);
  station.points.push({ stop_id: row.stop_id, lat: row.stop_lat, lon: row.stop_lon });
}

// Compute centroid for each station
for (const station of stationMap.values()) {
  const n = station.points.length;
  station.lat = station.points.reduce((s, p) => s + p.lat, 0) / n;
  station.lon = station.points.reduce((s, p) => s + p.lon, 0) / n;
  // Use the first stop_id as representative
  station.representative_stop_id = station.stop_ids[0];
}

// 4. Get all bus stops (stops NOT in railStopIds)
const allStops: { stop_id: string; stop_name: string; stop_lat: number; stop_lon: number }[] =
  db.query(`SELECT stop_id, stop_name, stop_lat, stop_lon FROM stops`).all() as any;

const busStops = allStops.filter((s) => !railStopIds.has(s.stop_id));

console.log(`Rail stations: ${stationMap.size} (${railStopIds.size} stop points)`);
console.log(`Bus stops: ${busStops.length}`);

// 5. For each bus stop, find the closest rail station point within RADIUS_M
interface BusStopEntry {
  rail_station: string;
  rail_stop_id: string;
  distance_m: number;
}

const busStopLookup: Record<string, BusStopEntry> = {};
const railStationBusStops: Record<string, Set<string>> = {};

// Initialize rail station bus stop sets
for (const station of stationMap.values()) {
  railStationBusStops[station.name] = new Set();
}

for (const bus of busStops) {
  let closestDist = Infinity;
  let closestStation: RailStation | null = null;

  for (const station of stationMap.values()) {
    // Check distance to every physical rail stop point in this station
    for (const point of station.points) {
      const dist = haversine(bus.stop_lat, bus.stop_lon, point.lat, point.lon);
      if (dist <= RADIUS_M && dist < closestDist) {
        closestDist = dist;
        closestStation = station;
      }
    }
  }

  if (closestStation) {
    busStopLookup[bus.stop_id] = {
      rail_station: closestStation.name,
      rail_stop_id: closestStation.representative_stop_id,
      distance_m: Math.round(closestDist),
    };
    railStationBusStops[closestStation.name].add(bus.stop_id);
  }
}

// 6. Build output
const railStationsOutput: Record<
  string,
  { stop_id: string; lat: number; lon: number; bus_stops: string[] }
> = {};

for (const station of stationMap.values()) {
  const busIds = railStationBusStops[station.name];
  if (busIds.size > 0) {
    railStationsOutput[station.name] = {
      stop_id: station.representative_stop_id,
      lat: Math.round(station.lat * 1e6) / 1e6,
      lon: Math.round(station.lon * 1e6) / 1e6,
      bus_stops: [...busIds].sort(),
    };
  }
}

const output = {
  generated: new Date().toISOString(),
  radius_m: RADIUS_M,
  bus_stops: busStopLookup,
  rail_stations: railStationsOutput,
};

await Bun.write(OUT_PATH, JSON.stringify(output, null, 2) + "\n");

const busCount = Object.keys(busStopLookup).length;
const railCount = Object.keys(railStationsOutput).length;
console.log(`\nResult: ${busCount} bus stops mapped to ${railCount} rail stations`);
console.log(`Written to ${OUT_PATH}`);

db.close();
