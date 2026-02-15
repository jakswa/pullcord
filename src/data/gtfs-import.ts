#!/usr/bin/env bun
import { Database } from "bun:sqlite";
import { parse } from "csv-parse";
import { createReadStream } from "fs";
import path from "path";

const GTFS_DIR = path.join(process.cwd(), "data", "gtfs");
const DB_PATH = path.join(process.cwd(), "data", "marta.db");

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
        stop_lon REAL
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS trips (
        trip_id TEXT PRIMARY KEY,
        route_id TEXT,
        trip_headsign TEXT,
        direction_id INTEGER,
        shape_id TEXT
      )
    `);

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
      this.db.run(`DELETE FROM ${tableName}`);
      for (const record of records) {
        stmt.run(...Object.values(record));
      }
    });
    tx();
    return records.length;
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
      })
    );
    const count = this.upsertTable('stops', records);
    console.log(`✓ Imported ${count} stops`);
    return count;
  }

  async importTrips() {
    console.log("Importing trips...");
    const records = await this.loadCSV(
      path.join(GTFS_DIR, 'trips.txt'),
      (r) => ({
        trip_id: r.trip_id,
        route_id: r.route_id,
        trip_headsign: r.trip_headsign || '',
        direction_id: parseInt(r.direction_id) || 0,
        shape_id: r.shape_id || '',
      })
    );
    const count = this.upsertTable('trips', records);
    console.log(`✓ Imported ${count} trips`);
    return count;
  }

  async importShapes() {
    console.log("Importing shapes...");
    const records = await this.loadCSV(
      path.join(GTFS_DIR, 'shapes.txt'),
      (r) => ({
        shape_id: r.shape_id,
        shape_pt_lat: parseFloat(r.shape_pt_lat),
        shape_pt_lon: parseFloat(r.shape_pt_lon),
        shape_pt_sequence: parseInt(r.shape_pt_sequence),
      })
    );
    const count = this.upsertTable('shapes', records);
    console.log(`✓ Imported ${count} shape points`);
    return count;
  }

  async importStopTimes() {
    console.log("Importing stop times (this may take a moment)...");
    const records = await this.loadCSV(
      path.join(GTFS_DIR, 'stop_times.txt'),
      (r) => ({
        trip_id: r.trip_id,
        stop_id: r.stop_id,
        stop_sequence: parseInt(r.stop_sequence),
        arrival_time: r.arrival_time || '',
        departure_time: r.departure_time || '',
      })
    );
    const count = this.upsertTable('stop_times', records);
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

  printStats() {
    console.log("\n📊 DATABASE STATISTICS");
    console.log("======================");

    const tables = ['routes', 'stops', 'trips', 'shapes', 'stop_times', 'route_stops'];
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
    await importer.importStops();
    await importer.importTrips();
    await importer.importShapes();
    await importer.importStopTimes();
    importer.buildRouteStops();

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

if (import.meta.main) {
  main();
}
