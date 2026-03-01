// Versioned migration system for marta.db
// Migrations run sequentially on startup before the server binds.
// If any migration fails, the process exits non-zero → Fly health check fails → deploy halts.

import { Database } from "bun:sqlite";
import path from "path";

const DB_PATH = process.env.DATABASE_URL || path.join(process.cwd(), "data", "marta.db");

interface Migration {
  version: number;
  name: string;
  up: (db: Database) => void;
}

// ──────────────────────────────────────────
// Migration definitions — append only!
// ──────────────────────────────────────────

const migrations: Migration[] = [
  {
    version: 1,
    name: "baseline_columns",
    up(db) {
      // group_id column for paired stop resolution
      const cols = db.prepare("PRAGMA table_info(stops)").all() as Array<{ name: string }>;

      if (!cols.some(c => c.name === "group_id")) {
        db.exec(`ALTER TABLE stops ADD COLUMN group_id TEXT`);
        db.exec(`
          UPDATE stops SET group_id = (
            SELECT MIN(s2.stop_id) FROM stops s2 WHERE s2.stop_name = stops.stop_name
          )
        `);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_stops_group ON stops(group_id)`);
        const count = db.prepare("SELECT COUNT(*) as c FROM stops WHERE group_id IS NOT NULL").get() as any;
        console.log(`  ↳ Added stops.group_id (${count.c} stops)`);
      }

      // Transfer lookup columns
      if (!cols.some(c => c.name === "nearest_rail_station")) {
        db.exec(`ALTER TABLE stops ADD COLUMN nearest_rail_station TEXT`);
      }
      if (!cols.some(c => c.name === "nearest_rail_distance_m")) {
        db.exec(`ALTER TABLE stops ADD COLUMN nearest_rail_distance_m INTEGER`);
      }

      // Drop legacy table
      db.exec(`DROP TABLE IF EXISTS stop_groups`);
    },
  },
  {
    version: 2,
    name: "metrics_table",
    up(db) {
      db.exec(`
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
      db.exec(`CREATE INDEX IF NOT EXISTS idx_metrics_ts ON metrics(ts)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_metrics_kind_route ON metrics(kind, route_id)`);
    },
  },
];

// ──────────────────────────────────────────
// Runner
// ──────────────────────────────────────────

function ensureVersionTable(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

function getCurrentVersion(db: Database): number {
  const row = db.prepare("SELECT MAX(version) as v FROM schema_version").get() as any;
  return row?.v ?? 0;
}

export function runMigrations(): void {
  const db = new Database(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL");

  try {
    ensureVersionTable(db);
    const current = getCurrentVersion(db);
    const pending = migrations.filter(m => m.version > current);

    if (pending.length === 0) {
      console.log(`✅ Database schema v${current} — up to date`);
      db.close();
      return;
    }

    console.log(`🔄 Running ${pending.length} migration(s) from v${current} → v${pending[pending.length - 1].version}...`);

    for (const migration of pending) {
      const start = Date.now();
      console.log(`  [v${migration.version}] ${migration.name}...`);

      // Each migration runs in a transaction — atomic success or rollback
      db.exec("BEGIN");
      try {
        migration.up(db);
        db.prepare("INSERT INTO schema_version (version, name) VALUES (?, ?)").run(migration.version, migration.name);
        db.exec("COMMIT");
        console.log(`  [v${migration.version}] ✓ (${Date.now() - start}ms)`);
      } catch (err) {
        db.exec("ROLLBACK");
        console.error(`  [v${migration.version}] ✗ FAILED:`, err);
        db.close();
        throw new Error(`Migration v${migration.version} (${migration.name}) failed: ${err}`);
      }
    }

    console.log(`✅ Database schema v${pending[pending.length - 1].version} — ${pending.length} migration(s) applied`);
  } finally {
    try { db.close(); } catch {}
  }
}

// Verify the database is queryable — used by /health endpoint
export function verifyDatabase(): { ok: boolean; version: number; tables: number; error?: string } {
  try {
    const db = new Database(DB_PATH, { readonly: true });
    const version = getCurrentVersion(db);
    const tables = (db.prepare(
      "SELECT COUNT(*) as c FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    ).get() as any).c;
    // Quick smoke test: can we read from a core table?
    db.prepare("SELECT COUNT(*) FROM routes").get();
    db.close();
    return { ok: true, version, tables };
  } catch (err: any) {
    return { ok: false, version: 0, tables: 0, error: err.message };
  }
}
