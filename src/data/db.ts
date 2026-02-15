import { Database } from "bun:sqlite";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "marta.db");

interface Route {
  route_id: string;
  route_short_name: string;
  route_long_name: string;
  route_color: string;
  route_text_color: string;
}

interface Stop {
  stop_id: string;
  stop_name: string;
  stop_lat: number;
  stop_lon: number;
}

interface Trip {
  trip_id: string;
  route_id: string;
  trip_headsign: string;
  direction_id: number;
  shape_id: string;
}

interface ShapePoint {
  shape_id: string;
  shape_pt_lat: number;
  shape_pt_lon: number;
  shape_pt_sequence: number;
}

interface RouteStop {
  route_id: string;
  stop_id: string;
  direction_id: number;
  stop_name: string;
  stop_lat: number;
  stop_lon: number;
  stop_sequence?: number;
}

interface RouteDetail {
  route: Route;
  shapes: Record<string, Array<[number, number]>>; // direction_id -> [[lat, lon], ...]
  stops: RouteStop[];
}

// MARTA rail route short names — not part of the bus tracker
const RAIL_ROUTES = new Set(['BLUE', 'GREEN', 'RED', 'GOLD']);

class MARTADatabase {
  private db: Database;
  private tripLookupCache: Map<string, Trip> | null = null;

  constructor() {
    this.db = new Database(DB_PATH, { readonly: true });
  }

  // Get all routes
  getRoutes(): Route[] {
    return this.db.prepare(`
      SELECT route_id, route_short_name, route_long_name, route_color, route_text_color 
      FROM routes 
      ORDER BY CAST(route_short_name AS INTEGER), route_short_name
    `).all() as Route[];
  }

  // Get single route by ID or short name
  getRoute(routeIdentifier: string): Route | null {
    const stmt = this.db.prepare(`
      SELECT route_id, route_short_name, route_long_name, route_color, route_text_color 
      FROM routes 
      WHERE route_id = ? OR route_short_name = ?
    `);
    return stmt.get(routeIdentifier, routeIdentifier) as Route | null;
  }

  // Search stops by name
  // Search stops by name, deduplicated.
  // MARTA GTFS has separate stop IDs per direction at the same physical location.
  // The tracker's paired-stop logic merges both directions regardless of which ID
  // you use, so we GROUP BY stop_name to avoid duplicate cards in results.
  searchStops(query: string, limit: number = 20): Stop[] {
    const stmt = this.db.prepare(`
      SELECT MIN(stop_id) as stop_id, stop_name, stop_lat, stop_lon 
      FROM stops 
      WHERE stop_name LIKE ?
      GROUP BY stop_name
      ORDER BY 
        CASE 
          WHEN stop_name LIKE ? THEN 1
          ELSE 2
        END,
        stop_name
      LIMIT ?
    `);
    
    const searchPattern = `%${query}%`;
    const exactPattern = `${query}%`;
    
    return stmt.all(searchPattern, exactPattern, limit) as Stop[];
  }

  // Get stops on a route (for route-first search), deduplicated by name
  // MARTA GTFS has separate stop IDs for each direction at the same physical location
  // (opposite sides of the street, ~25m apart). Since the tracker's paired-stop logic
  // automatically merges predictions from both directions regardless of which stop ID
  // you land on, we deduplicate by stop_name to avoid showing identical-looking cards.
  getStopsForRoute(routeId: string, limit: number = 40): Stop[] {
    return this.db.prepare(`
      SELECT MIN(s.stop_id) as stop_id, s.stop_name, s.stop_lat, s.stop_lon
      FROM route_stops rs
      JOIN stops s ON rs.stop_id = s.stop_id
      WHERE rs.route_id = ?
      GROUP BY s.stop_name
      ORDER BY s.stop_name
      LIMIT ?
    `).all(routeId, limit) as Stop[];
  }

  // Get stops near a location
  getNearbyStops(lat: number, lon: number, radiusMeters: number = 500, limit: number = 20): (Stop & { distance: number })[] {
    // Bounding box filter in SQL, precise Haversine in JS
    // ~111,000 meters per degree latitude; longitude varies by cos(lat)
    const latDelta = radiusMeters / 111000;
    const lonDelta = radiusMeters / (111000 * Math.cos(lat * Math.PI / 180));

    const stmt = this.db.prepare(`
      SELECT stop_id, stop_name, stop_lat, stop_lon
      FROM stops
      WHERE stop_lat BETWEEN ? AND ?
        AND stop_lon BETWEEN ? AND ?
    `);

    const candidates = stmt.all(
      lat - latDelta, lat + latDelta,
      lon - lonDelta, lon + lonDelta
    ) as Stop[];

    // Haversine distance
    const toRad = (d: number) => d * Math.PI / 180;
    const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
      return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    // Dedup by stop_name — MARTA has separate IDs per direction at same location
    const withDist = candidates
      .map(s => ({ ...s, distance: haversine(lat, lon, s.stop_lat, s.stop_lon) }))
      .filter(s => s.distance <= radiusMeters)
      .sort((a, b) => a.distance - b.distance);
    
    const seen = new Set<string>();
    return withDist
      .filter(s => {
        if (seen.has(s.stop_name)) return false;
        seen.add(s.stop_name);
        return true;
      })
      .slice(0, limit);
  }

  // Get single stop
  getStop(stopId: string): Stop | null {
    return this.db.prepare(`
      SELECT stop_id, stop_name, stop_lat, stop_lon 
      FROM stops 
      WHERE stop_id = ?
    `).get(stopId) as Stop | null;
  }

  // Get routes serving a stop (bus only, excludes rail)
  getRoutesForStop(stopId: string): Route[] {
    const routes = this.db.prepare(`
      SELECT DISTINCT r.route_id, r.route_short_name, r.route_long_name, r.route_color, r.route_text_color
      FROM routes r
      JOIN route_stops rs ON r.route_id = rs.route_id
      WHERE rs.stop_id = ?
      ORDER BY CAST(r.route_short_name AS INTEGER), r.route_short_name
    `).all(stopId) as Route[];
    return routes.filter(r => !RAIL_ROUTES.has(r.route_short_name));
  }

  // Get route detail with shapes and stops
  getRouteDetail(routeId: string): RouteDetail | null {
    const route = this.getRoute(routeId);
    if (!route) return null;

    // Get shapes for this route
    const shapeIds = this.db.prepare(`
      SELECT DISTINCT shape_id, direction_id
      FROM trips 
      WHERE route_id = ? AND shape_id != ''
    `).all(routeId) as Array<{ shape_id: string; direction_id: number }>;

    const shapes: Record<string, Array<[number, number]>> = {};
    
    for (const { shape_id, direction_id } of shapeIds) {
      const points = this.db.prepare(`
        SELECT shape_pt_lat, shape_pt_lon 
        FROM shapes 
        WHERE shape_id = ? 
        ORDER BY shape_pt_sequence
      `).all(shape_id) as Array<{ shape_pt_lat: number; shape_pt_lon: number }>;

      shapes[direction_id.toString()] = points.map(p => [p.shape_pt_lat, p.shape_pt_lon]);
    }

    // Get stops for this route, ordered by stop_sequence from a representative trip per direction
    // First, find a representative trip for each direction
    const repTrips = this.db.prepare(`
      SELECT direction_id, trip_id FROM trips
      WHERE route_id = ?
      GROUP BY direction_id
    `).all(routeId) as Array<{ direction_id: number; trip_id: string }>;

    let stops: RouteStop[] = [];
    for (const { direction_id, trip_id } of repTrips) {
      const dirStops = this.db.prepare(`
        SELECT 
          ? as route_id,
          st.stop_id, 
          ? as direction_id,
          s.stop_name,
          s.stop_lat,
          s.stop_lon,
          st.stop_sequence
        FROM stop_times st
        JOIN stops s ON st.stop_id = s.stop_id
        WHERE st.trip_id = ?
        ORDER BY st.stop_sequence
      `).all(routeId, direction_id, trip_id) as RouteStop[];
      stops = stops.concat(dirStops);
    }

    return {
      route,
      shapes,
      stops
    };
  }

  // Get trip lookup map for realtime enrichment
  getTripLookup(routeId?: string): Map<string, Trip> {
    if (!routeId && this.tripLookupCache) {
      return this.tripLookupCache;
    }

    let query = `SELECT trip_id, route_id, trip_headsign, direction_id, shape_id FROM trips`;
    let params: any[] = [];

    if (routeId) {
      query += ` WHERE route_id = ?`;
      params = [routeId];
    }

    const trips = this.db.prepare(query).all(...params) as Trip[];
    const lookup = new Map<string, Trip>();
    
    for (const trip of trips) {
      lookup.set(trip.trip_id, trip);
    }

    // Cache if loading all trips
    if (!routeId) {
      this.tripLookupCache = lookup;
    }

    return lookup;
  }

  // Get stop details with routes
  getStopWithRoutes(stopId: string) {
    const stop = this.getStop(stopId);
    if (!stop) return null;

    const routes = this.getRoutesForStop(stopId);
    
    return {
      ...stop,
      routes
    };
  }

  // Find paired stops: same route, different direction, within ~150m of the given stop
  getPairedStops(stopId: string, routeId: string): Array<{ stop_id: string; direction_id: number; trip_headsign: string }> {
    const stop = this.getStop(stopId);
    if (!stop) return [];

    // Bounding box filter (~150m ≈ 0.0015° at Atlanta latitude)
    const delta = 0.0015;
    const latMin = stop.stop_lat - delta;
    const latMax = stop.stop_lat + delta;
    const lonMin = stop.stop_lon - delta;
    const lonMax = stop.stop_lon + delta;

    // Fast: get nearby stops on this route (no trip join — get headsign separately)
    const nearbyStops = this.db.prepare(`
      SELECT DISTINCT rs.stop_id, rs.direction_id, s.stop_lat, s.stop_lon
      FROM route_stops rs
      JOIN stops s ON rs.stop_id = s.stop_id
      WHERE rs.route_id = ?
        AND s.stop_lat BETWEEN ? AND ?
        AND s.stop_lon BETWEEN ? AND ?
    `).all(routeId, latMin, latMax, lonMin, lonMax) as Array<{
      stop_id: string; direction_id: number; stop_lat: number; stop_lon: number;
    }>;

    // Haversine for precise 150m filter
    const toRad = (d: number) => d * Math.PI / 180;
    const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
      return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    // Get headsign per direction (small separate query, much cheaper than joining in main query)
    const hsRows = this.db.prepare(`
      SELECT DISTINCT direction_id, trip_headsign FROM trips
      WHERE route_id = ? AND trip_headsign != '' ORDER BY direction_id
    `).all(routeId) as Array<{ direction_id: number; trip_headsign: string }>;
    const headsigns: Record<number, string> = {};
    for (const r of hsRows) {
      if (!(r.direction_id in headsigns)) headsigns[r.direction_id] = r.trip_headsign;
    }

    return nearbyStops
      .filter(rs => haversine(stop.stop_lat, stop.stop_lon, rs.stop_lat, rs.stop_lon) < 150)
      .map(rs => ({
        stop_id: rs.stop_id,
        direction_id: rs.direction_id,
        trip_headsign: headsigns[rs.direction_id] || 'Unknown',
      }));
  }

  // Batch lookup scheduled arrival times for (stop_id, trip_id[]) pairs
  // Returns Map<tripId, arrival_time string> e.g. "14:52:00"
  getScheduledArrivals(stopId: string, tripIds: string[]): Map<string, string> {
    if (tripIds.length === 0) return new Map();
    const placeholders = tripIds.map(() => '?').join(',');
    const rows = this.db.prepare(`
      SELECT trip_id, arrival_time 
      FROM stop_times 
      WHERE stop_id = ? AND trip_id IN (${placeholders})
    `).all(stopId, ...tripIds) as Array<{ trip_id: string; arrival_time: string }>;
    const result = new Map<string, string>();
    for (const row of rows) {
      // For loop routes with duplicate (trip_id, stop_id), first row wins
      if (!result.has(row.trip_id)) {
        result.set(row.trip_id, row.arrival_time);
      }
    }
    return result;
  }

  close() {
    this.db.close();
  }
}

// Singleton instance
const db = new MARTADatabase();

// Export convenience functions
export function getRoutes(): Route[] {
  return db.getRoutes();
}

export function getRoute(routeIdentifier: string): Route | null {
  return db.getRoute(routeIdentifier);
}

export function searchStops(query: string, limit?: number): Stop[] {
  return db.searchStops(query, limit);
}

export function getStopsForRoute(routeId: string, limit?: number): Stop[] {
  return db.getStopsForRoute(routeId, limit);
}

export function getNearbyStops(lat: number, lon: number, radiusMeters?: number, limit?: number): Stop[] {
  return db.getNearbyStops(lat, lon, radiusMeters, limit);
}

export function getStop(stopId: string): Stop | null {
  return db.getStop(stopId);
}

export function getRoutesForStop(stopId: string): Route[] {
  return db.getRoutesForStop(stopId);
}

export function getRouteDetail(routeId: string): RouteDetail | null {
  return db.getRouteDetail(routeId);
}

export function getTripLookup(routeId?: string): Map<string, Trip> {
  return db.getTripLookup(routeId);
}

export function getRouteHeadsigns(routeId: string): Record<number, string> {
  const rows = db.db.prepare(`
    SELECT DISTINCT direction_id, trip_headsign 
    FROM trips WHERE route_id = ? AND trip_headsign != ''
    ORDER BY direction_id
  `).all(routeId) as Array<{ direction_id: number; trip_headsign: string }>;
  
  const result: Record<number, string> = {};
  for (const r of rows) {
    // Use the first headsign per direction (most common)
    if (!(r.direction_id in result)) {
      result[r.direction_id] = r.trip_headsign;
    }
  }
  return result;
}

export function getStopWithRoutes(stopId: string) {
  return db.getStopWithRoutes(stopId);
}

export function getPairedStops(stopId: string, routeId: string) {
  return db.getPairedStops(stopId, routeId);
}

export function getScheduledArrivals(stopId: string, tripIds: string[]): Map<string, string> {
  return db.getScheduledArrivals(stopId, tripIds);
}

export type { Route, Stop, Trip, RouteStop, RouteDetail };