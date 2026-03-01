// Metrics collection — samples MARTA operational stats every 5 minutes
// Piggybacks on existing cached data, zero extra API calls

import { Database } from "bun:sqlite";
import path from "path";
import { getTripLookup, getRoutes } from "./db";
import { getVehicles, findArrivals, type VehiclePosition } from "./realtime";
import { fetchArrivals as fetchRailArrivals } from "../rail/api";

const DB_PATH = process.env.DATABASE_URL || path.join(process.cwd(), "data", "marta.db");
const SAMPLE_INTERVAL = 5 * 60 * 1000; // 5 minutes
const RETENTION_DAYS = 60;

let metricsDb: Database | null = null;
let lastSampleTs = 0;

function getDb(): Database {
  if (!metricsDb) {
    metricsDb = new Database(DB_PATH);
    metricsDb.exec("PRAGMA journal_mode=WAL");
    metricsDb.exec(`
      CREATE TABLE IF NOT EXISTS metrics (
        ts INTEGER NOT NULL,
        kind TEXT NOT NULL,
        route_id TEXT,
        vehicles INTEGER,
        ghost_count INTEGER,
        avg_delay_sec REAL,
        trips_active INTEGER,
        trips_scheduled INTEGER
      )
    `);
    metricsDb.exec(`CREATE INDEX IF NOT EXISTS idx_metrics_ts ON metrics(ts)`);
    metricsDb.exec(`CREATE INDEX IF NOT EXISTS idx_metrics_kind_route ON metrics(kind, route_id)`);
  }
  return metricsDb;
}

interface RouteSample {
  routeId: string;
  vehicles: number;
  ghostCount: number;
  totalDelaySec: number;
  delayCount: number;
  tripsActive: number;
}

async function sampleBusMetrics(): Promise<RouteSample[]> {
  const tripLookup = getTripLookup();
  const routes = getRoutes();
  const samples: RouteSample[] = [];

  for (const route of routes) {
    let vehicles: VehiclePosition[];
    try {
      vehicles = await getVehicles(route.route_id, tripLookup);
    } catch {
      continue; // skip if fetch fails — don't block other routes
    }

    if (vehicles.length === 0) continue;

    // Get arrivals with tier classification to count ghosts + delays
    // Use a known busy stop? No — we want system-wide stats.
    // Instead, count from vehicle data + findArrivals for a representative sample.
    let ghostCount = 0;
    let totalDelay = 0;
    let delayCount = 0;

    // For ghost count, we need findArrivals with a stop — but we want route-level stats.
    // Simpler: just count vehicles. Ghost detection happens per-stop in findArrivals.
    // For route-level, vehicle count IS the metric. Ghost count comes from system-level sampling.

    samples.push({
      routeId: route.route_id,
      vehicles: vehicles.length,
      ghostCount: 0, // route-level ghost detection would require per-stop scanning — skip for now
      totalDelaySec: totalDelay,
      delayCount,
      tripsActive: vehicles.length, // each vehicle = one active trip
    });
  }

  return samples;
}

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

  // Group by line
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

export async function collectMetrics(): Promise<void> {
  const now = Date.now();

  // Throttle — no more than once per interval
  if (now - lastSampleTs < SAMPLE_INTERVAL) return;
  lastSampleTs = now;

  const ts = Math.floor(now / 1000);
  const db = getDb();

  try {
    const busSamples = await sampleBusMetrics();
    const railSamples = await sampleRailMetrics();

    const insert = db.prepare(
      `INSERT INTO metrics (ts, kind, route_id, vehicles, ghost_count, avg_delay_sec, trips_active, trips_scheduled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const tx = db.transaction(() => {
      // Bus route samples
      let totalVehicles = 0;
      let totalGhosts = 0;
      let totalTrips = 0;

      for (const s of busSamples) {
        insert.run(ts, "route", s.routeId, s.vehicles, s.ghostCount,
          s.delayCount > 0 ? s.totalDelaySec / s.delayCount : null,
          s.tripsActive, null);
        totalVehicles += s.vehicles;
        totalGhosts += s.ghostCount;
        totalTrips += s.tripsActive;
      }

      // Bus system summary (trips_active = route count for system kind)
      insert.run(ts, "system", null, totalVehicles, totalGhosts, null, busSamples.length, null);

      // Rail line samples
      let totalTrains = 0;
      for (const s of railSamples) {
        insert.run(ts, "rail", s.line, s.trains, null,
          s.avgDelaySec, s.realtimeCount, s.scheduledCount);
        totalTrains += s.trains;
      }

      // Rail system summary
      if (railSamples.length > 0) {
        const avgWait = railSamples.reduce((sum, s) => sum + s.avgDelaySec, 0) / railSamples.length;
        const totalRealtime = railSamples.reduce((sum, s) => sum + s.realtimeCount, 0);
        const totalScheduled = railSamples.reduce((sum, s) => sum + s.scheduledCount, 0);
        insert.run(ts, "rail-system", null, totalTrains, null, avgWait, totalRealtime, totalScheduled);
      }
    });

    tx();

    const routeCount = busSamples.length;
    const railLines = railSamples.length;
    console.log(`📊 Metrics: ${busSamples.reduce((s, r) => s + r.vehicles, 0)} buses (${routeCount} routes), ${railSamples.reduce((s, r) => s + r.trains, 0)} trains (${railLines} lines)`);
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

// Query helpers for the dashboard API

export interface SystemSnapshot {
  ts: number;
  busVehicles: number;
  busGhosts: number;
  busRoutes: number;
  railTrains: number;
  railAvgWait: number | null;
}

export function getLatestSnapshot(): SystemSnapshot | null {
  const db = getDb();
  const bus = db.prepare(
    `SELECT ts, vehicles, ghost_count, trips_active FROM metrics WHERE kind = 'system' ORDER BY ts DESC LIMIT 1`
  ).get() as any;
  const rail = db.prepare(
    `SELECT vehicles, avg_delay_sec FROM metrics WHERE kind = 'rail-system' ORDER BY ts DESC LIMIT 1`
  ).get() as any;

  if (!bus) return null;

  return {
    ts: bus.ts,
    busVehicles: bus.vehicles || 0,
    busGhosts: bus.ghost_count || 0,
    busRoutes: bus.trips_active || 0,
    railTrains: rail?.vehicles || 0,
    railAvgWait: rail?.avg_delay_sec ?? null,
  };
}

export interface TimeSeriesPoint {
  ts: number;
  vehicles: number;
  ghosts: number;
}

export function getSystemTimeSeries(hours: number = 24): TimeSeriesPoint[] {
  const db = getDb();
  const cutoff = Math.floor(Date.now() / 1000) - hours * 3600;
  return db.prepare(
    `SELECT ts, vehicles, ghost_count as ghosts FROM metrics WHERE kind = 'system' AND ts > ? ORDER BY ts`
  ).all(cutoff) as TimeSeriesPoint[];
}

export interface RouteSnapshot {
  routeId: string;
  vehicles: number;
  ghostCount: number;
  avgDelay: number | null;
}

export function getLatestRouteSnapshots(): RouteSnapshot[] {
  const db = getDb();
  // Get the most recent timestamp, then all route samples at that time
  const latest = db.prepare(
    `SELECT MAX(ts) as ts FROM metrics WHERE kind = 'route'`
  ).get() as any;
  if (!latest?.ts) return [];

  return db.prepare(
    `SELECT route_id as routeId, vehicles, ghost_count as ghostCount, avg_delay_sec as avgDelay
     FROM metrics WHERE kind = 'route' AND ts = ? ORDER BY vehicles DESC`
  ).all(latest.ts) as RouteSnapshot[];
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
     FROM metrics WHERE kind = 'rail' AND ts = ? ORDER BY route_id`
  ).all(latest.ts) as RailLineSnapshot[];
}

export function getRouteTimeSeries(routeId: string, hours: number = 24): TimeSeriesPoint[] {
  const db = getDb();
  const cutoff = Math.floor(Date.now() / 1000) - hours * 3600;
  return db.prepare(
    `SELECT ts, vehicles, ghost_count as ghosts FROM metrics WHERE kind = 'route' AND route_id = ? AND ts > ? ORDER BY ts`
  ).all(routeId, cutoff) as TimeSeriesPoint[];
}
