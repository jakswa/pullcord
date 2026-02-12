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
}

interface RouteDetail {
  route: Route;
  shapes: Record<string, Array<[number, number]>>; // direction_id -> [[lat, lon], ...]
  stops: RouteStop[];
}

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
  searchStops(query: string, limit: number = 20): Stop[] {
    const stmt = this.db.prepare(`
      SELECT stop_id, stop_name, stop_lat, stop_lon 
      FROM stops 
      WHERE stop_name LIKE ?
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

  // Get stops near a location
  getNearbyStops(lat: number, lon: number, radiusMeters: number = 500, limit: number = 20): Stop[] {
    // Simple distance calculation using Haversine approximation
    const stmt = this.db.prepare(`
      SELECT 
        stop_id, 
        stop_name, 
        stop_lat, 
        stop_lon,
        (
          6371000 * acos(
            cos(radians(?)) * cos(radians(stop_lat)) * 
            cos(radians(stop_lon) - radians(?)) + 
            sin(radians(?)) * sin(radians(stop_lat))
          )
        ) as distance
      FROM stops
      HAVING distance <= ?
      ORDER BY distance
      LIMIT ?
    `);
    
    return stmt.all(lat, lon, lat, radiusMeters, limit) as Stop[];
  }

  // Get single stop
  getStop(stopId: string): Stop | null {
    return this.db.prepare(`
      SELECT stop_id, stop_name, stop_lat, stop_lon 
      FROM stops 
      WHERE stop_id = ?
    `).get(stopId) as Stop | null;
  }

  // Get routes serving a stop
  getRoutesForStop(stopId: string): Route[] {
    return this.db.prepare(`
      SELECT DISTINCT r.route_id, r.route_short_name, r.route_long_name, r.route_color, r.route_text_color
      FROM routes r
      JOIN route_stops rs ON r.route_id = rs.route_id
      WHERE rs.stop_id = ?
      ORDER BY CAST(r.route_short_name AS INTEGER), r.route_short_name
    `).all(stopId) as Route[];
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

    // Get stops for this route
    const stops = this.db.prepare(`
      SELECT 
        rs.route_id,
        rs.stop_id, 
        rs.direction_id,
        s.stop_name,
        s.stop_lat,
        s.stop_lon
      FROM route_stops rs
      JOIN stops s ON rs.stop_id = s.stop_id
      WHERE rs.route_id = ?
      ORDER BY rs.direction_id, s.stop_name
    `).all(routeId) as RouteStop[];

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

export function getStopWithRoutes(stopId: string) {
  return db.getStopWithRoutes(stopId);
}

export type { Route, Stop, Trip, RouteStop, RouteDetail };