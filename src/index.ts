import { runMigrations } from "./data/migrate.js";

// ── Migrations run FIRST, before any imports that touch the DB ──
// If this throws, the process exits non-zero → Fly health check fails → deploy halts.
console.log(`🚌 Pullcord starting...`);
const dbPath = process.env.DATABASE_URL || "data/marta.db";
console.log(`📊 Database: ${Bun.file(dbPath).exists() ? "✓ Found" : "❌ Missing"} (${dbPath})`);

runMigrations(); // throws on failure → process crashes → no server bind → deploy fails

// ── Safe to import DB-dependent modules now ──
import app from "./app.js";
import { Cron } from "croner";
import { refreshGTFS } from "./data/gtfs-import.js";
import { collectMetrics, cleanOldMetrics } from "./data/metrics.js";

const port = parseInt(process.env.PORT || "4200");

console.log(`🔑 API Key: ${process.env.MARTA_API_KEY ? "✓ Set" : "❌ Missing"}`);
console.log(`🌐 Server: http://localhost:${port}`);

// Weekly GTFS refresh: Sunday 3am ET
const gtfsCron = new Cron("0 3 * * 0", { timezone: "America/New_York" }, async () => {
  console.log("⏰ Weekly GTFS refresh triggered");
  await refreshGTFS();
  cleanOldMetrics(); // prune old metrics during weekly maintenance
});
console.log(`📅 GTFS refresh scheduled: next run ${gtfsCron.nextRun()?.toISOString() ?? "unknown"}`);

// Metrics collection: every 5 minutes during operation
const metricsCron = new Cron("*/5 * * * *", { timezone: "America/New_York" }, async () => {
  await collectMetrics();
});
console.log(`📊 Metrics collection: every 5 min (next ${metricsCron.nextRun()?.toISOString() ?? "unknown"})`);

export default {
  port,
  hostname: "0.0.0.0",
  fetch: app.fetch,
};
