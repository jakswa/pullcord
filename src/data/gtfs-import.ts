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
    // Remove existing database if it exists
    try {
      const fs = require('fs');
      if (fs.existsSync(DB_PATH)) {
        fs.unlinkSync(DB_PATH);
      }
    } catch (e) {
      // File doesn't exist, that's fine
    }
    
    this.db = new Database(DB_PATH);
    this.createTables();
  }

  private createTables() {
    console.log("Creating SQLite tables...");
    
    // Routes table
    this.db.run(`
      CREATE TABLE routes (
        route_id TEXT PRIMARY KEY,
        route_short_name TEXT,
        route_long_name TEXT,
        route_color TEXT,
        route_text_color TEXT
      )
    `);

    // Stops table
    this.db.run(`
      CREATE TABLE stops (
        stop_id TEXT PRIMARY KEY,
        stop_name TEXT,
        stop_lat REAL,
        stop_lon REAL
      )
    `);

    // Trips table
    this.db.run(`
      CREATE TABLE trips (
        trip_id TEXT PRIMARY KEY,
        route_id TEXT,
        trip_headsign TEXT,
        direction_id INTEGER,
        shape_id TEXT
      )
    `);

    // Shapes table
    this.db.run(`
      CREATE TABLE shapes (
        shape_id TEXT,
        shape_pt_lat REAL,
        shape_pt_lon REAL,
        shape_pt_sequence INTEGER
      )
    `);
    this.db.run(`CREATE INDEX idx_shapes_id ON shapes(shape_id)`);

    // Stop times table
    this.db.run(`
      CREATE TABLE stop_times (
        trip_id TEXT,
        stop_id TEXT,
        stop_sequence INTEGER,
        arrival_time TEXT,
        departure_time TEXT
      )
    `);
    this.db.run(`CREATE INDEX idx_stop_times_trip ON stop_times(trip_id)`);
    this.db.run(`CREATE INDEX idx_stop_times_stop ON stop_times(stop_id)`);

    // Route stops derived table
    this.db.run(`
      CREATE TABLE route_stops (
        route_id TEXT,
        stop_id TEXT,
        direction_id INTEGER,
        UNIQUE(route_id, stop_id, direction_id)
      )
    `);
    this.db.run(`CREATE INDEX idx_route_stops_route ON route_stops(route_id)`);
    this.db.run(`CREATE INDEX idx_route_stops_stop ON route_stops(stop_id)`);

    console.log("✓ Tables created");
  }

  private async importCSV(tableName: string, csvPath: string, transform?: (record: any) => any): Promise<number> {
    return new Promise((resolve, reject) => {
      const records: any[] = [];
      
      createReadStream(csvPath)
        .pipe(parse({ 
          columns: true,
          skip_empty_lines: true
        }))
        .on('data', (record) => {
          if (transform) {
            record = transform(record);
          }
          records.push(record);
        })
        .on('end', () => {
          if (records.length === 0) {
            resolve(0);
            return;
          }

          // Build insert statement
          const columns = Object.keys(records[0]);
          const placeholders = columns.map(() => '?').join(', ');
          const stmt = this.db.prepare(`INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`);
          
          // Batch insert
          const transaction = this.db.transaction(() => {
            for (const record of records) {
              stmt.run(...Object.values(record));
            }
          });
          
          try {
            transaction();
            resolve(records.length);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject);
    });
  }

  async importRoutes() {
    console.log("Importing routes...");
    const count = await this.importCSV(
      'routes', 
      path.join(GTFS_DIR, 'routes.txt'),
      (record) => ({
        route_id: record.route_id,
        route_short_name: record.route_short_name,
        route_long_name: record.route_long_name,
        route_color: record.route_color || '',
        route_text_color: record.route_text_color || ''
      })
    );
    console.log(`✓ Imported ${count} routes`);
    return count;
  }

  async importStops() {
    console.log("Importing stops...");
    const count = await this.importCSV(
      'stops',
      path.join(GTFS_DIR, 'stops.txt'),
      (record) => ({
        stop_id: record.stop_id,
        stop_name: record.stop_name,
        stop_lat: parseFloat(record.stop_lat),
        stop_lon: parseFloat(record.stop_lon)
      })
    );
    console.log(`✓ Imported ${count} stops`);
    return count;
  }

  async importTrips() {
    console.log("Importing trips...");
    const count = await this.importCSV(
      'trips',
      path.join(GTFS_DIR, 'trips.txt'),
      (record) => ({
        trip_id: record.trip_id,
        route_id: record.route_id,
        trip_headsign: record.trip_headsign || '',
        direction_id: parseInt(record.direction_id) || 0,
        shape_id: record.shape_id || ''
      })
    );
    console.log(`✓ Imported ${count} trips`);
    return count;
  }

  async importShapes() {
    console.log("Importing shapes...");
    const count = await this.importCSV(
      'shapes',
      path.join(GTFS_DIR, 'shapes.txt'),
      (record) => ({
        shape_id: record.shape_id,
        shape_pt_lat: parseFloat(record.shape_pt_lat),
        shape_pt_lon: parseFloat(record.shape_pt_lon),
        shape_pt_sequence: parseInt(record.shape_pt_sequence)
      })
    );
    console.log(`✓ Imported ${count} shape points`);
    return count;
  }

  async importStopTimes() {
    console.log("Importing stop times (this may take a moment)...");
    const count = await this.importCSV(
      'stop_times',
      path.join(GTFS_DIR, 'stop_times.txt'),
      (record) => ({
        trip_id: record.trip_id,
        stop_id: record.stop_id,
        stop_sequence: parseInt(record.stop_sequence),
        arrival_time: record.arrival_time || '',
        departure_time: record.departure_time || ''
      })
    );
    console.log(`✓ Imported ${count} stop times`);
    return count;
  }

  buildRouteStops() {
    console.log("Building route_stops derived table...");
    
    this.db.run(`
      INSERT INTO route_stops (route_id, stop_id, direction_id)
      SELECT DISTINCT t.route_id, st.stop_id, t.direction_id
      FROM trips t
      JOIN stop_times st ON t.trip_id = st.trip_id
    `);
    
    const count = this.db.prepare(`SELECT COUNT(*) as count FROM route_stops`).get() as any;
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
    
    // Sample route data
    console.log("\n🚌 SAMPLE ROUTES");
    console.log("=================");
    const sampleRoutes = this.db.prepare(`
      SELECT route_short_name, route_long_name 
      FROM routes 
      ORDER BY CAST(route_short_name AS INTEGER)
      LIMIT 10
    `).all();
    
    for (const route of sampleRoutes) {
      console.log(`${route.route_short_name}: ${route.route_long_name}`);
    }
  }

  close() {
    this.db.close();
  }
}

// Main execution
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