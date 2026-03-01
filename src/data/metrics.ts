// Metrics collection — samples MARTA operational stats every 5 minutes
// Piggybacks on existing cached data, zero extra API calls
// Computes schedule adherence: vehicles observed vs trips scheduled, per-vehicle delay

import { Database } from "bun:sqlite";
import path from "path";
import { getTripLookup, getRoutes } from "./db";
import { getAllVehicles, isVehicleCacheWarm, type VehiclePosition } from "./realtime";
// Rail sampling paused — no good KPI yet
// import { fetchArrivals as fetchRailArrivals, isRailCacheWarm } from "../rail/api";
import { parseTimeToSec, type TripStop } from "./eta";

const DB_PATH = process.env.DATABASE_URL || path.join(process.cwd(), "data", "marta.db");
const SAMPLE_INTERVAL = 5 * 60 * 1000; // 5 minutes
const RETENTION_DAYS = 60;
const MAX_DELAY_SEC = 1800; // 30 min — beyond this, assume data error
const STALE_VEHICLE_SEC = 300; // 5 min — GPS older than this = ghost

// MARTA rail route IDs in GTFS — exclude from bus metrics
const RAIL_ROUTE_IDS = new Set(["27448", "27449", "27450", "27451"]);

let metricsDb: Database | null = null;
let lastSampleTs = 0;

function getDb(): Database {
  if (!metricsDb) {
    metricsDb = new Database(DB_PATH);
    metricsDb.exec("PRAGMA journal_mode=WAL");
  }
  return metricsDb;
}

// ─── Spatial math (same as eta.ts, not exported there) ───

function distSq(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = lat2 - lat1;
  const dLon = (lon2 - lon1) * Math.cos(((lat1 + lat2) / 2) * Math.PI / 180);
  return dLat * dLat + dLon * dLon;
}

// ─── Time helpers ───

function getCurrentTimeSec(): number {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  return now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
}

function getTodayString(): string {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function getDayOfWeek(): string {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  return ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][now.getDay()];
}

// ─── GTFS schedule queries (cached) ───

// Trip time spans: first/last stop time per trip. Cached 24h (changes only on GTFS refresh).
interface TripSpan {
  routeId: string;
  serviceId: string;
  firstSec: number;
  lastSec: number;
}

let tripSpanCache: Map<string, TripSpan> | null = null;
let tripSpanCacheTime = 0;
const TRIP_SPAN_CACHE_TTL = 24 * 60 * 60 * 1000;

function getTripTimeSpans(db: Database): Map<string, TripSpan> {
  if (tripSpanCache && Date.now() - tripSpanCacheTime < TRIP_SPAN_CACHE_TTL) {
    return tripSpanCache;
  }

  const rows = db.prepare(`
    SELECT trip_spans.trip_id, t.route_id, t.service_id,
           first_st.arrival_time as first_time,
           last_st.arrival_time as last_time
    FROM (
      SELECT trip_id, MIN(stop_sequence) as min_seq, MAX(stop_sequence) as max_seq
      FROM stop_times GROUP BY trip_id
    ) trip_spans
    JOIN trips t ON t.trip_id = trip_spans.trip_id
    JOIN stop_times first_st ON first_st.trip_id = trip_spans.trip_id AND first_st.stop_sequence = trip_spans.min_seq
    JOIN stop_times last_st ON last_st.trip_id = trip_spans.trip_id AND last_st.stop_sequence = trip_spans.max_seq
  `).all() as any[];

  tripSpanCache = new Map();
  for (const r of rows) {
    tripSpanCache.set(r.trip_id, {
      routeId: r.route_id,
      serviceId: r.service_id,
      firstSec: parseTimeToSec(r.first_time.trim()),
      lastSec: parseTimeToSec(r.last_time.trim()),
    });
  }
  tripSpanCacheTime = Date.now();
  console.log(`📊 Trip time spans cached: ${tripSpanCache.size} trips`);
  return tripSpanCache;
}

// Invalidate cache (called during GTFS refresh)
export function invalidateTripSpanCache(): void {
  tripSpanCache = null;
  tripSpanCacheTime = 0;
}

function getActiveServiceIds(db: Database): Set<string> {
  const today = getTodayString();
  const dayCol = getDayOfWeek();

  // Regular services
  const regular = db.prepare(
    `SELECT service_id FROM calendar WHERE ${dayCol} = 1 AND start_date <= ? AND end_date >= ?`
  ).all(today, today).map((r: any) => r.service_id);

  // Exceptions
  const added = db.prepare(
    `SELECT service_id FROM calendar_dates WHERE date = ? AND exception_type = 1`
  ).all(today).map((r: any) => r.service_id);

  const removed = new Set(
    db.prepare(
      `SELECT service_id FROM calendar_dates WHERE date = ? AND exception_type = 2`
    ).all(today).map((r: any) => r.service_id)
  );

  const result = new Set([...regular, ...added]);
  for (const id of removed) result.delete(id);
  return result;
}

// Count scheduled trips per route at current time
function getScheduledTripsPerRoute(db: Database): Map<string, number> {
  const serviceIds = getActiveServiceIds(db);
  if (serviceIds.size === 0) return new Map();

  const spans = getTripTimeSpans(db);
  const nowSec = getCurrentTimeSec();

  const counts = new Map<string, number>();
  for (const [, span] of spans) {
    if (RAIL_ROUTE_IDS.has(span.routeId)) continue; // rail tracked separately
    if (!serviceIds.has(span.serviceId)) continue;
    if (span.firstSec > nowSec || span.lastSec < nowSec) continue;
    counts.set(span.routeId, (counts.get(span.routeId) || 0) + 1);
  }
  return counts;
}

// ─── Delay computation ───

// Batch-load stop_times + coordinates for multiple trips
function getBatchTripStops(db: Database, tripIds: string[]): Map<string, TripStop[]> {
  if (tripIds.length === 0) return new Map();

  const placeholders = tripIds.map(() => "?").join(",");
  const rows = db.prepare(`
    SELECT st.trip_id, st.stop_sequence, TRIM(st.arrival_time) as arrival_time,
           s.stop_lat, s.stop_lon, st.stop_id
    FROM stop_times st
    JOIN stops s ON s.stop_id = st.stop_id
    WHERE st.trip_id IN (${placeholders})
    ORDER BY st.trip_id, st.stop_sequence
  `).all(...tripIds) as any[];

  const result = new Map<string, TripStop[]>();
  for (const r of rows) {
    let stops = result.get(r.trip_id);
    if (!stops) { stops = []; result.set(r.trip_id, stops); }
    stops.push({
      stop_id: r.stop_id,
      lat: r.stop_lat,
      lon: r.stop_lon,
      sequence: r.stop_sequence,
      arrivalSec: parseTimeToSec(r.arrival_time),
    });
  }
  return result;
}

// Estimate delay for a single vehicle by comparing GPS position to scheduled trip stops.
// Returns seconds (positive = late, negative = early), or null if unreliable.
function computeVehicleDelay(vehicle: VehiclePosition, tripStops: TripStop[], nowSec: number): number | null {
  if (tripStops.length < 2) return null;

  // Find nearest stop to vehicle by GPS
  let nearestIdx = 0;
  let nearestDist = Infinity;
  for (let i = 0; i < tripStops.length; i++) {
    const d = distSq(vehicle.lat, vehicle.lon, tripStops[i].lat, tripStops[i].lon);
    if (d < nearestDist) {
      nearestDist = d;
      nearestIdx = i;
    }
  }

  // Interpolate: where on the schedule should a vehicle at this GPS position be?
  let scheduledSec: number;
  if (nearestIdx < tripStops.length - 1) {
    const segDist = distSq(
      tripStops[nearestIdx].lat, tripStops[nearestIdx].lon,
      tripStops[nearestIdx + 1].lat, tripStops[nearestIdx + 1].lon
    );
    if (segDist > 0) {
      const busDist = distSq(
        tripStops[nearestIdx].lat, tripStops[nearestIdx].lon,
        vehicle.lat, vehicle.lon
      );
      const fraction = Math.min(1, Math.sqrt(busDist / segDist));
      const segTime = tripStops[nearestIdx + 1].arrivalSec - tripStops[nearestIdx].arrivalSec;
      scheduledSec = tripStops[nearestIdx].arrivalSec + fraction * segTime;
    } else {
      scheduledSec = tripStops[nearestIdx].arrivalSec;
    }
  } else {
    scheduledSec = tripStops[nearestIdx].arrivalSec;
  }

  // Adjust for GPS staleness: the position was recorded staleSeconds ago
  const vehicleTimeSec = nowSec - vehicle.staleSeconds;
  const delay = vehicleTimeSec - scheduledSec;

  // Sanity: large |delay| is probably wrong trip assignment or data error
  if (Math.abs(delay) > MAX_DELAY_SEC) return null;
  return delay;
}

// ─── Bus sampling ───

interface RouteSample {
  routeId: string;
  vehicles: number;
  ghostCount: number;
  totalDelaySec: number;
  delayCount: number;
  tripsActive: number;
  tripsScheduled: number;
}

async function sampleBusMetrics(): Promise<RouteSample[]> {
  const tripLookup = getTripLookup();
  const db = getDb();

  // 1. Get ALL vehicles at once (one cached proto fetch)
  const allVehicles = await getAllVehicles(tripLookup);

  // 2. Group by route
  const vehiclesByRoute = new Map<string, VehiclePosition[]>();
  for (const v of allVehicles) {
    const trip = tripLookup.get(v.tripId);
    if (!trip) continue;
    let list = vehiclesByRoute.get(trip.route_id);
    if (!list) { list = []; vehiclesByRoute.set(trip.route_id, list); }
    list.push(v);
  }

  // 3. Scheduled trips per route (from GTFS static + calendar)
  const scheduledByRoute = getScheduledTripsPerRoute(db);

  // 4. Batch-load trip stops for delay computation (~10ms for 175 trips)
  const activeTripIds = allVehicles.map(v => v.tripId);
  const tripStopsMap = getBatchTripStops(db, activeTripIds);

  // 5. Current time for delay computation
  const nowSec = getCurrentTimeSec();

  // 6. Build per-route samples
  const allRouteIds = new Set([...vehiclesByRoute.keys(), ...scheduledByRoute.keys()]);
  const samples: RouteSample[] = [];

  for (const routeId of allRouteIds) {
    const vehicles = vehiclesByRoute.get(routeId) || [];
    const scheduled = scheduledByRoute.get(routeId) || 0;
    if (vehicles.length === 0 && scheduled === 0) continue;

    let totalDelay = 0;
    let delayCount = 0;
    let ghostCount = 0;

    for (const v of vehicles) {
      if (v.staleSeconds > STALE_VEHICLE_SEC) { ghostCount++; continue; }

      const stops = tripStopsMap.get(v.tripId);
      if (!stops || stops.length < 2) continue;

      const delay = computeVehicleDelay(v, stops, nowSec);
      if (delay !== null) {
        totalDelay += delay;
        delayCount++;
      }
    }

    samples.push({
      routeId,
      vehicles: vehicles.length,
      ghostCount,
      totalDelaySec: totalDelay,
      delayCount,
      tripsActive: vehicles.length - ghostCount,
      tripsScheduled: scheduled,
    });
  }

  return samples;
}

// ─── Rail sampling (unchanged) ───

interface RailSample {
  line: string;
  trains: number;
  avgDelaySec: number;
  realtimeCount: number;
  scheduledCount: number;
}

async function sampleRailMetrics(): Promise<RailSample[]> {
  let arrivals;
  try {
    arrivals = await fetchRailArrivals();
  } catch {
    return [];
  }

  const byLine = new Map<string, { trains: Set<string>; totalWait: number; count: number; realtime: number; scheduled: number }>();

  for (const a of arrivals) {
    let line = byLine.get(a.line);
    if (!line) {
      line = { trains: new Set(), totalWait: 0, count: 0, realtime: 0, scheduled: 0 };
      byLine.set(a.line, line);
    }
    line.trains.add(a.trainId);
    line.totalWait += a.waitSeconds;
    line.count++;
    if (a.isRealtime) line.realtime++;
    else line.scheduled++;
  }

  return Array.from(byLine.entries()).map(([lineName, data]) => ({
    line: lineName,
    trains: data.trains.size,
    avgDelaySec: data.count > 0 ? data.totalWait / data.count : 0,
    realtimeCount: data.realtime,
    scheduledCount: data.scheduled,
  }));
}

// ─── Collection orchestrator ───

export async function collectMetrics(): Promise<void> {
  const now = Date.now();
  if (now - lastSampleTs < SAMPLE_INTERVAL) return;

  // Only sample when users are active — if the vehicle cache is cold,
  // no one's using the app and we'd be making unnecessary API calls.
  // Gaps in the time series double as anonymous usage signal.
  if (!isVehicleCacheWarm()) return;

  lastSampleTs = now;

  const ts = Math.floor(now / 1000);
  const db = getDb();

  try {
    const busSamples = await sampleBusMetrics();
    // Rail sampling paused — no good KPI yet. Re-enable when we find one.
    const railSamples: RailSample[] = [];

    const insert = db.prepare(
      `INSERT INTO metrics (ts, kind, route_id, vehicles, ghost_count, avg_delay_sec, trips_active, trips_scheduled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const tx = db.transaction(() => {
      let totalVehicles = 0;
      let totalGhosts = 0;
      let totalActive = 0;
      let totalScheduled = 0;
      let systemDelay = 0;
      let systemDelayCount = 0;

      for (const s of busSamples) {
        const avgDelay = s.delayCount > 0 ? s.totalDelaySec / s.delayCount : null;
        insert.run(ts, "route", s.routeId, s.vehicles, s.ghostCount,
          avgDelay, s.tripsActive, s.tripsScheduled || null);

        totalVehicles += s.vehicles;
        totalGhosts += s.ghostCount;
        totalActive += s.tripsActive;
        totalScheduled += s.tripsScheduled;
        if (s.delayCount > 0) {
          systemDelay += s.totalDelaySec;
          systemDelayCount += s.delayCount;
        }
      }

      // System summary — now includes scheduled count and avg delay
      const sysAvgDelay = systemDelayCount > 0 ? systemDelay / systemDelayCount : null;
      insert.run(ts, "system", null, totalVehicles, totalGhosts, sysAvgDelay, totalActive, totalScheduled);

      // Rail
      let totalTrains = 0;
      for (const s of railSamples) {
        insert.run(ts, "rail", s.line, s.trains, null,
          s.avgDelaySec, s.realtimeCount, s.scheduledCount);
        totalTrains += s.trains;
      }

      if (railSamples.length > 0) {
        const avgWait = railSamples.reduce((sum, s) => sum + s.avgDelaySec, 0) / railSamples.length;
        const totalRealtime = railSamples.reduce((sum, s) => sum + s.realtimeCount, 0);
        const totalScheduledRail = railSamples.reduce((sum, s) => sum + s.scheduledCount, 0);
        insert.run(ts, "rail-system", null, totalTrains, null, avgWait, totalRealtime, totalScheduledRail);
      }
    });

    tx();

    // Log with adherence %
    const busVehicles = busSamples.reduce((s, r) => s + r.vehicles, 0);
    const busScheduled = busSamples.reduce((s, r) => s + r.tripsScheduled, 0);
    const adherence = busScheduled > 0 ? ((busVehicles / busScheduled) * 100).toFixed(0) : "?";
    const avgDelay = busSamples.reduce((s, r) => s + r.totalDelaySec, 0);
    const delayN = busSamples.reduce((s, r) => s + r.delayCount, 0);
    const delayStr = delayN > 0 ? `${(avgDelay / delayN / 60).toFixed(1)}min avg delay` : "no delay data";
    const trains = railSamples.reduce((s, r) => s + r.trains, 0);

    console.log(`📊 Metrics: ${busVehicles}/${busScheduled} buses (${adherence}% adherence, ${delayStr}), ${trains} trains`);
  } catch (err) {
    console.error("📊 Metrics collection failed:", err);
  }
}

export function cleanOldMetrics(): void {
  const cutoff = Math.floor(Date.now() / 1000) - RETENTION_DAYS * 86400;
  try {
    const db = getDb();
    const result = db.run(`DELETE FROM metrics WHERE ts < ?`, cutoff);
    if (result.changes > 0) {
      console.log(`📊 Metrics cleanup: removed ${result.changes} old rows`);
    }
  } catch (err) {
    console.error("📊 Metrics cleanup failed:", err);
  }
}

// ─── Query helpers for dashboard API ───

export interface SystemSnapshot {
  ts: number;
  busVehicles: number;
  busGhosts: number;
  busRoutes: number;
  busScheduled: number;
  busAdherence: number | null;
  busAvgDelay: number | null;
  railTrains: number;
  railAvgWait: number | null;
}

export function getLatestSnapshot(): SystemSnapshot | null {
  const db = getDb();
  const bus = db.prepare(
    `SELECT ts, vehicles, ghost_count, trips_active, trips_scheduled, avg_delay_sec
     FROM metrics WHERE kind = 'system' ORDER BY ts DESC LIMIT 1`
  ).get() as any;
  const rail = db.prepare(
    `SELECT vehicles, avg_delay_sec FROM metrics WHERE kind = 'rail-system' ORDER BY ts DESC LIMIT 1`
  ).get() as any;

  if (!bus) return null;

  const scheduled = bus.trips_scheduled || 0;
  return {
    ts: bus.ts,
    busVehicles: bus.vehicles || 0,
    busGhosts: bus.ghost_count || 0,
    busRoutes: bus.trips_active || 0,
    busScheduled: scheduled,
    busAdherence: scheduled > 0 ? bus.vehicles / scheduled : null,
    busAvgDelay: bus.avg_delay_sec ?? null,
    railTrains: rail?.vehicles || 0,
    railAvgWait: rail?.avg_delay_sec ?? null,
  };
}

export interface TimeSeriesPoint {
  ts: number;
  vehicles: number;
  ghosts: number;
  scheduled: number;
  avgDelay: number | null;
}

export function getSystemTimeSeries(hours: number = 24): TimeSeriesPoint[] {
  const db = getDb();
  const cutoff = Math.floor(Date.now() / 1000) - hours * 3600;
  return db.prepare(
    `SELECT ts, vehicles, ghost_count as ghosts, trips_scheduled as scheduled, avg_delay_sec as avgDelay
     FROM metrics WHERE kind = 'system' AND ts > ? ORDER BY ts`
  ).all(cutoff) as TimeSeriesPoint[];
}

export interface RouteSnapshot {
  routeId: string;
  vehicles: number;
  ghostCount: number;
  avgDelay: number | null;
  tripsScheduled: number;
  adherence: number | null;
}

export function getLatestRouteSnapshots(): RouteSnapshot[] {
  const db = getDb();
  const latest = db.prepare(
    `SELECT MAX(ts) as ts FROM metrics WHERE kind = 'route'`
  ).get() as any;
  if (!latest?.ts) return [];

  return db.prepare(
    `SELECT route_id as routeId, vehicles, ghost_count as ghostCount, avg_delay_sec as avgDelay,
            trips_scheduled as tripsScheduled
     FROM metrics WHERE kind = 'route' AND ts = ? ORDER BY vehicles DESC`
  ).all(latest.ts).map((r: any) => ({
    ...r,
    tripsScheduled: r.tripsScheduled || 0,
    adherence: r.tripsScheduled > 0 ? r.vehicles / r.tripsScheduled : null,
  })) as RouteSnapshot[];
}

export interface RailLineSnapshot {
  line: string;
  trains: number;
  avgWait: number;
  realtime: number;
  scheduled: number;
}

export function getLatestRailSnapshots(): RailLineSnapshot[] {
  const db = getDb();
  const latest = db.prepare(
    `SELECT MAX(ts) as ts FROM metrics WHERE kind = 'rail'`
  ).get() as any;
  if (!latest?.ts) return [];

  return db.prepare(
    `SELECT route_id as line, vehicles as trains, avg_delay_sec as avgWait,
            trips_active as realtime, trips_scheduled as scheduled
     FROM metrics WHERE kind = 'rail' AND ts = ?
     GROUP BY route_id ORDER BY route_id`
  ).all(latest.ts) as RailLineSnapshot[];
}

export function getRouteTimeSeries(routeId: string, hours: number = 24): TimeSeriesPoint[] {
  const db = getDb();
  const cutoff = Math.floor(Date.now() / 1000) - hours * 3600;
  return db.prepare(
    `SELECT ts, vehicles, ghost_count as ghosts, trips_scheduled as scheduled, avg_delay_sec as avgDelay
     FROM metrics WHERE kind = 'route' AND route_id = ? AND ts > ? ORDER BY ts`
  ).all(routeId, cutoff) as TimeSeriesPoint[];
}
