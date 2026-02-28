#!/usr/bin/env bun
import { Database } from "bun:sqlite";
import { parse } from "csv-parse";
import { createReadStream } from "fs";
import fs from "fs";
import path from "path";

const DB_PATH = process.env.DATABASE_URL || path.join(process.cwd(), "data", "marta.db");
const GTFS_DIR = path.join(path.dirname(DB_PATH), "gtfs");

class GTFSImporter {
  private db: Database;

  constructor() {
    this.db = new Database(DB_PATH);
    this.db.exec('PRAGMA journal_mode = WAL');
    this.ensureTables();
  }

  private ensureTables() {
    console.log("Ensuring SQLite tables exist...");

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS routes (
        route_id TEXT PRIMARY KEY,
        route_short_name TEXT,
        route_long_name TEXT,
        route_color TEXT,
        route_text_color TEXT
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS stops (
        stop_id TEXT PRIMARY KEY,
        stop_name TEXT,
        stop_lat REAL,
        stop_lon REAL,
        group_id TEXT,
        nearest_rail_station TEXT,
        nearest_rail_distance_m INTEGER
      )
    `);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_stops_group ON stops(group_id)`);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS trips (
        trip_id TEXT PRIMARY KEY,
        route_id TEXT,
        service_id TEXT,
        trip_headsign TEXT,
        direction_id INTEGER,
        shape_id TEXT
      )
    `);

    // Add service_id column if upgrading from old schema
    try {
      this.db.exec(`ALTER TABLE trips ADD COLUMN service_id TEXT`);
      console.log("  ↳ Added service_id column to trips");
    } catch (_) {
      // Column already exists
    }

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS shapes (
        shape_id TEXT,
        shape_pt_lat REAL,
        shape_pt_lon REAL,
        shape_pt_sequence INTEGER
      )
    `);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_shapes_id ON shapes(shape_id)`);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS stop_times (
        trip_id TEXT,
        stop_id TEXT,
        stop_sequence INTEGER,
        arrival_time TEXT,
        departure_time TEXT
      )
    `);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_stop_times_trip ON stop_times(trip_id)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_stop_times_stop ON stop_times(stop_id)`);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS route_stops (
        route_id TEXT,
        stop_id TEXT,
        direction_id INTEGER,
        UNIQUE(route_id, stop_id, direction_id)
      )
    `);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_route_stops_route ON route_stops(route_id)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_route_stops_stop ON route_stops(stop_id)`);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS calendar (
        service_id TEXT PRIMARY KEY,
        monday INTEGER,
        tuesday INTEGER,
        wednesday INTEGER,
        thursday INTEGER,
        friday INTEGER,
        saturday INTEGER,
        sunday INTEGER,
        start_date TEXT,
        end_date TEXT
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS calendar_dates (
        service_id TEXT,
        date TEXT,
        exception_type INTEGER,
        UNIQUE(service_id, date)
      )
    `);

    // Unique indexes for upsert support on tables without PKs
    this.db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_stop_times_unique ON stop_times(trip_id, stop_sequence)`);
    this.db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_shapes_unique ON shapes(shape_id, shape_pt_sequence)`);

    console.log("✓ Tables ready");
  }

  private async loadCSV(csvPath: string, transform?: (record: any) => any): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const records: any[] = [];
      createReadStream(csvPath)
        .pipe(parse({ columns: true, skip_empty_lines: true }))
        .on('data', (record) => {
          records.push(transform ? transform(record) : record);
        })
        .on('end', () => resolve(records))
        .on('error', reject);
    });
  }

  // Atomic refresh: clear + re-insert in one transaction per table.
  // App sees old data until commit, then instantly sees new data. Zero downtime.
  private upsertTable(tableName: string, records: any[]) {
    if (records.length === 0) return 0;

    const columns = Object.keys(records[0]);
    const placeholders = columns.map(() => '?').join(', ');
    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`
    );

    const tx = this.db.transaction(() => {
      for (const record of records) {
        stmt.run(...Object.values(record));
      }
    });
    tx();
    return records.length;
  }

  // Stream-based import for large tables (stop_times, shapes).
  // One transaction per table — single fsync at commit instead of per-chunk.
  // Chunks only control JS memory (flush objects to SQLite, not to disk).
  private async streamImport(
    tableName: string,
    csvPath: string,
    transform: (record: any) => any,
    chunkSize: number = 50000
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      let totalCount = 0;
      let chunk: any[] = [];
      let columns: string[] | null = null;
      let stmt: any = null;

      this.db.exec('BEGIN');

      const flushChunk = () => {
        if (chunk.length === 0) return;
        if (!columns) {
          columns = Object.keys(chunk[0]);
          const placeholders = columns.map(() => '?').join(', ');
          stmt = this.db.prepare(
            `INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`
          );
        }
        for (const record of chunk) {
          stmt!.run(...Object.values(record));
        }
        totalCount += chunk.length;
        chunk = [];
      };

      createReadStream(csvPath)
        .pipe(parse({ columns: true, skip_empty_lines: true }))
        .on('data', (record) => {
          chunk.push(transform(record));
          if (chunk.length >= chunkSize) {
            flushChunk();
          }
        })
        .on('end', () => {
          flushChunk();
          this.db.exec('COMMIT');
          resolve(totalCount);
        })
        .on('error', (err) => {
          try { this.db.exec('ROLLBACK'); } catch (_) {}
          reject(err);
        });
    });
  }

  async importRoutes() {
    console.log("Importing routes...");
    const records = await this.loadCSV(
      path.join(GTFS_DIR, 'routes.txt'),
      (r) => ({
        route_id: r.route_id,
        route_short_name: r.route_short_name,
        route_long_name: r.route_long_name,
        route_color: r.route_color || '',
        route_text_color: r.route_text_color || '',
      })
    );
    const count = this.upsertTable('routes', records);
    console.log(`✓ Imported ${count} routes`);
    return count;
  }

  async importStops() {
    console.log("Importing stops...");
    const records = await this.loadCSV(
      path.join(GTFS_DIR, 'stops.txt'),
      (r) => ({
        stop_id: r.stop_id,
        stop_name: r.stop_name,
        stop_lat: parseFloat(r.stop_lat),
        stop_lon: parseFloat(r.stop_lon),
        group_id: null,
      })
    );

    // Atomic: insert stops + set group_id in one transaction.
    // No window where stops exist with null group_id.
    const columns = Object.keys(records[0]);
    const placeholders = columns.map(() => '?').join(', ');
    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO stops (${columns.join(', ')}) VALUES (${placeholders})`
    );
    const tx = this.db.transaction(() => {
      for (const record of records) {
        stmt.run(...Object.values(record));
      }
      // group_id = MIN(stop_id) per stop_name — groups directional stops at same location
      this.db.run(`
        UPDATE stops SET group_id = (
          SELECT MIN(s2.stop_id) FROM stops s2 WHERE s2.stop_name = stops.stop_name
        )
      `);
    });
    tx();

    const groups = this.db.prepare('SELECT COUNT(DISTINCT group_id) as count FROM stops').get() as any;
    console.log(`✓ Imported ${records.length} stops → ${groups.count} groups`);
    return records.length;
  }

  async importTrips() {
    console.log("Importing trips...");
    const records = await this.loadCSV(
      path.join(GTFS_DIR, 'trips.txt'),
      (r) => ({
        trip_id: r.trip_id,
        route_id: r.route_id,
        service_id: r.service_id || '',
        trip_headsign: r.trip_headsign || '',
        direction_id: parseInt(r.direction_id) || 0,
        shape_id: r.shape_id || '',
      })
    );
    const count = this.upsertTable('trips', records);
    console.log(`✓ Imported ${count} trips`);
    return count;
  }

  async importCalendar() {
    console.log("Importing calendar...");
    const records = await this.loadCSV(
      path.join(GTFS_DIR, 'calendar.txt'),
      (r) => ({
        service_id: r.service_id,
        monday: parseInt(r.monday) || 0,
        tuesday: parseInt(r.tuesday) || 0,
        wednesday: parseInt(r.wednesday) || 0,
        thursday: parseInt(r.thursday) || 0,
        friday: parseInt(r.friday) || 0,
        saturday: parseInt(r.saturday) || 0,
        sunday: parseInt(r.sunday) || 0,
        start_date: r.start_date,
        end_date: r.end_date,
      })
    );
    const count = this.upsertTable('calendar', records);
    console.log(`✓ Imported ${count} calendar entries`);
    return count;
  }

  async importCalendarDates() {
    console.log("Importing calendar_dates...");
    const records = await this.loadCSV(
      path.join(GTFS_DIR, 'calendar_dates.txt'),
      (r) => ({
        service_id: r.service_id,
        date: r.date,
        exception_type: parseInt(r.exception_type) || 0,
      })
    );
    const count = this.upsertTable('calendar_dates', records);
    console.log(`✓ Imported ${count} calendar_dates entries`);
    return count;
  }

  async importShapes() {
    console.log("Importing shapes...");
    const count = await this.streamImport(
      'shapes',
      path.join(GTFS_DIR, 'shapes.txt'),
      (r) => ({
        shape_id: r.shape_id,
        shape_pt_lat: parseFloat(r.shape_pt_lat),
        shape_pt_lon: parseFloat(r.shape_pt_lon),
        shape_pt_sequence: parseInt(r.shape_pt_sequence),
      }),
      10000
    );
    console.log(`✓ Imported ${count} shape points`);
    return count;
  }

  async importStopTimes() {
    console.log("Importing stop times (this may take a moment)...");
    const count = await this.streamImport(
      'stop_times',
      path.join(GTFS_DIR, 'stop_times.txt'),
      (r) => ({
        trip_id: r.trip_id,
        stop_id: r.stop_id,
        stop_sequence: parseInt(r.stop_sequence),
        arrival_time: r.arrival_time || '',
        departure_time: r.departure_time || '',
      }),
      10000
    );
    console.log(`✓ Imported ${count} stop times`);
    return count;
  }

  buildRouteStops() {
    console.log("Building route_stops derived table...");

    const tx = this.db.transaction(() => {
      this.db.run('DELETE FROM route_stops');
      this.db.run(`
        INSERT INTO route_stops (route_id, stop_id, direction_id)
        SELECT DISTINCT t.route_id, st.stop_id, t.direction_id
        FROM trips t
        JOIN stop_times st ON t.trip_id = st.trip_id
      `);
    });
    tx();

    const count = this.db.prepare('SELECT COUNT(*) as count FROM route_stops').get() as any;
    console.log(`✓ Built ${count.count} route-stop relationships`);
    return count.count;
  }

  buildStopGroups() {
    console.log("Populating stops.group_id...");

    // group_id = MIN(stop_id) per stop_name.
    // Five Points 600031/600032 both get group_id 600031.
    this.db.run(`
      UPDATE stops SET group_id = (
        SELECT MIN(s2.stop_id) FROM stops s2 WHERE s2.stop_name = stops.stop_name
      )
    `);

    const groups = this.db.prepare('SELECT COUNT(DISTINCT group_id) as count FROM stops').get() as any;
    const total = this.db.prepare('SELECT COUNT(*) as count FROM stops').get() as any;
    console.log(`✓ ${total.count} stops → ${groups.count} groups`);
    return groups.count;
  }

  cleanExpiredServices() {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    console.log(`Cleaning expired services (before ${today})...`);

    // Get expired service_ids
    const expired = this.db.prepare('SELECT service_id FROM calendar WHERE end_date < ?').all(today) as { service_id: string }[];
    if (expired.length === 0) {
      console.log('No expired services to clean');
      return;
    }

    const ids = expired.map(r => r.service_id);
    const placeholders = ids.map(() => '?').join(',');

    // Get trip_ids for expired services
    const tripRows = this.db.prepare(`SELECT trip_id, shape_id FROM trips WHERE service_id IN (${placeholders})`).all(...ids) as { trip_id: string; shape_id: string }[];
    const tripIds = tripRows.map(r => r.trip_id);
    const shapeIds = [...new Set(tripRows.map(r => r.shape_id).filter(Boolean))];

    if (tripIds.length === 0) {
      console.log('No expired trips to clean');
      // Still clean calendar entries even if no trips
      this.db.run(`DELETE FROM calendar WHERE end_date < ?`, today);
      this.db.run(`DELETE FROM calendar_dates WHERE service_id IN (${placeholders})`, ...ids);
      return;
    }

    // Batch delete in transaction
    const tx = this.db.transaction(() => {
      // Delete stop_times in chunks (SQLite variable limit)
      for (let i = 0; i < tripIds.length; i += 500) {
        const chunk = tripIds.slice(i, i + 500);
        const ph = chunk.map(() => '?').join(',');
        this.db.run(`DELETE FROM stop_times WHERE trip_id IN (${ph})`, ...chunk);
      }

      // Delete trips
      this.db.run(`DELETE FROM trips WHERE service_id IN (${placeholders})`, ...ids);

      // Delete expired calendar entries
      this.db.run(`DELETE FROM calendar WHERE end_date < ?`, today);
      this.db.run(`DELETE FROM calendar_dates WHERE service_id IN (${placeholders})`, ...ids);

      // Shapes: only delete if no remaining trips reference them
      for (const shapeId of shapeIds) {
        const remaining = this.db.prepare('SELECT 1 FROM trips WHERE shape_id = ? LIMIT 1').get(shapeId);
        if (!remaining) {
          this.db.run('DELETE FROM shapes WHERE shape_id = ?', shapeId);
        }
      }
    });
    tx();

    console.log(`🧹 Cleaned ${ids.length} expired services, ${tripIds.length} trips`);

    // Rebuild derived tables
    this.buildRouteStops();
    this.buildStopGroups();
  }

  buildTransferLookup() {
    console.log("🚇 Building bus↔rail transfer lookup...");
    const RADIUS_M = 200;

    // Ensure columns exist (handles existing DBs without them)
    try { this.db.run('ALTER TABLE stops ADD COLUMN nearest_rail_station TEXT'); } catch {}
    try { this.db.run('ALTER TABLE stops ADD COLUMN nearest_rail_distance_m INTEGER'); } catch {}

    // Find rail stops (served by routes with rail short names)
    const railStops = this.db.prepare(`
      SELECT DISTINCT s.stop_id, s.stop_name, s.stop_lat, s.stop_lon
      FROM stops s
      JOIN stop_times st ON s.stop_id = st.stop_id
      JOIN trips t ON st.trip_id = t.trip_id
      JOIN routes r ON t.route_id = r.route_id
      WHERE r.route_short_name IN ('BLUE','GOLD','GREEN','RED')
    `).all() as { stop_id: string; stop_name: string; stop_lat: number; stop_lon: number }[];

    const railStopIds = new Set(railStops.map(s => s.stop_id));

    // Group rail stops by station name → collect all physical points
    const stations = new Map<string, { name: string; points: { lat: number; lon: number }[] }>();
    for (const s of railStops) {
      const name = s.stop_name.replace(/\s+/g, ' ').trim();
      let station = stations.get(name);
      if (!station) { station = { name, points: [] }; stations.set(name, station); }
      station.points.push({ lat: s.stop_lat, lon: s.stop_lon });
    }

    // Haversine
    const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371000;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    // Get all bus stops
    const allStops = this.db.prepare('SELECT stop_id, stop_lat, stop_lon FROM stops').all() as { stop_id: string; stop_lat: number; stop_lon: number }[];

    // Clear existing transfer data
    this.db.run('UPDATE stops SET nearest_rail_station = NULL, nearest_rail_distance_m = NULL');

    // For each bus stop, find closest rail station point within radius
    const update = this.db.prepare('UPDATE stops SET nearest_rail_station = ?, nearest_rail_distance_m = ? WHERE stop_id = ?');
    let count = 0;

    const tx = this.db.transaction(() => {
      for (const stop of allStops) {
        if (railStopIds.has(stop.stop_id)) continue;
        let closestDist = Infinity;
        let closestName: string | null = null;

        for (const station of stations.values()) {
          for (const point of station.points) {
            const dist = haversine(stop.stop_lat, stop.stop_lon, point.lat, point.lon);
            if (dist <= RADIUS_M && dist < closestDist) {
              closestDist = dist;
              closestName = station.name;
            }
          }
        }

        if (closestName) {
          update.run(closestName, Math.round(closestDist), stop.stop_id);
          count++;
        }
      }
    });
    tx();

    console.log(`🚇 ${count} bus stops linked to ${stations.size} rail stations (${RADIUS_M}m radius)`);
  }

  printStats() {
    console.log("\n📊 DATABASE STATISTICS");
    console.log("======================");

    const tables = ['routes', 'stops', 'trips', 'shapes', 'stop_times', 'route_stops', 'calendar', 'calendar_dates'];
    for (const table of tables) {
      const result = this.db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as any;
      console.log(`${table.padEnd(12)}: ${result.count.toLocaleString()} rows`);
    }

    console.log("\n🚌 SAMPLE ROUTES");
    console.log("=================");
    const sampleRoutes = this.db.prepare(`
      SELECT route_short_name, route_long_name 
      FROM routes 
      ORDER BY CAST(route_short_name AS INTEGER)
      LIMIT 10
    `).all() as any[];

    for (const route of sampleRoutes) {
      console.log(`${route.route_short_name}: ${route.route_long_name}`);
    }
  }

  close() {
    this.db.close();
  }
}

async function main() {
  console.log("🚌 MARTA GTFS Import Starting...\n");

  const importer = new GTFSImporter();

  try {
    await importer.importRoutes();
    await importer.importStops(); // includes atomic group_id assignment
    await importer.importCalendar();
    await importer.importCalendarDates();
    await importer.importTrips();
    await importer.importShapes();
    await importer.importStopTimes();
    importer.buildRouteStops();
    importer.cleanExpiredServices();
    importer.buildTransferLookup();

    importer.printStats();

    console.log("\n✅ GTFS import complete!");
    console.log(`📁 Database: ${DB_PATH}`);
  } catch (error) {
    console.error("❌ Import failed:", error);
    process.exit(1);
  } finally {
    importer.close();
  }
}

export async function refreshGTFS() {
  console.log("🔄 GTFS refresh starting...");

  // Use DB directory for temp files (persistent volume on Fly.io)
  const dataDir = path.dirname(DB_PATH);

  // Download zip with timeout
  const GTFS_URL = "https://itsmarta.com/google_transit_feed/google_transit.zip";
  const zipPath = path.join(dataDir, "gtfs.zip");
  console.log(`📥 Downloading GTFS from ${GTFS_URL}...`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const resp = await fetch(GTFS_URL, { signal: controller.signal });
    if (!resp.ok) throw new Error(`GTFS download failed: ${resp.status}`);
    const buf = await resp.arrayBuffer();
    await Bun.write(zipPath, buf);
    console.log(`✓ Downloaded ${(buf.byteLength / 1024 / 1024).toFixed(1)}MB`);
  } finally {
    clearTimeout(timeout);
  }

  // Extract zip — try unzip (Docker/Alpine), fall back to python3 (dev)
  const gtfsDir = path.join(dataDir, "gtfs");
  await fs.promises.mkdir(gtfsDir, { recursive: true });
  try {
    const proc = Bun.spawn(["unzip", "-o", zipPath, "-d", gtfsDir]);
    const code = await proc.exited;
    if (code !== 0) throw new Error(`unzip exited ${code}`);
  } catch {
    const proc = Bun.spawn(["python3", "-c", `import zipfile; zipfile.ZipFile("${zipPath}").extractall("${gtfsDir}")`]);
    const code = await proc.exited;
    if (code !== 0) throw new Error("Both unzip and python3 extraction failed");
  }
  await fs.promises.unlink(zipPath);

  // Run import
  const importer = new GTFSImporter();
  try {
    await importer.importRoutes();
    await importer.importStops(); // includes atomic group_id assignment
    await importer.importCalendar();
    await importer.importCalendarDates();
    await importer.importTrips();
    await importer.importShapes();
    await importer.importStopTimes();
    importer.buildRouteStops();
    importer.cleanExpiredServices();
    importer.buildTransferLookup();
    importer.printStats();
    console.log("✅ GTFS refresh complete!");
  } catch (error) {
    console.error("❌ GTFS refresh failed:", error);
  } finally {
    importer.close();
  }
}

if (import.meta.main) {
  main();
}
