import { Cron } from "croner";
import { runMigrations } from "./data/migrate.js";
import { refreshGTFS, isRefreshing } from "./data/gtfs-import.js";
import { maybePromoteSchedule, resolveScheduleDbPath } from "./data/schedules.js";

// ── Fast startup ──
// Do NOT build/import GTFS snapshots before binding the HTTP server. On Fly this
// app has a single volume-backed machine; blocking or grinding on startup leaves
// zero healthy instances and burns web capacity parsing giant CSVs.
console.log(`🚌 Pullcord starting...`);

const startupPromotion = maybePromoteSchedule();
if (startupPromotion.promoted) {
  console.log(`📅 Promoted GTFS schedule ${startupPromotion.active?.effectiveDate} before startup DB open`);
}

const dbPath = resolveScheduleDbPath();
console.log(`📊 Database: ${Bun.file(dbPath).exists() ? "✓ Found" : "❌ Missing"} (${dbPath})`);

runMigrations(); // throws on failure → process crashes → no server bind → deploy fails

// ── Safe to import DB-dependent modules now ──
const { default: app } = await import("./app.js");
const { collectMetrics, cleanOldMetrics } = await import("./data/metrics.js");
const { getMatchRate, isVehicleCacheWarm } = await import("./data/realtime.js");
const { getTripLookup, invalidateCaches } = await import("./data/db.js");

const port = parseInt(process.env.PORT || "4200");

console.log(`🔑 API Key: ${process.env.MARTA_API_KEY ? "✓ Set" : "❌ Missing"}`);
console.log(`🌐 Server: http://localhost:${port}`);

async function refreshAndRestartIfPromoted(reason: string) {
  console.log(reason);
  const result = await refreshGTFS();
  if (result.promoted) {
    console.log("📅 Schedule promoted; exiting for clean SQLite reopen");
    process.exit(0);
  }
  invalidateCaches();
}

// Daily GTFS refresh: every day at 3am ET. This is the only in-app path that
// does heavyweight GTFS download/extract/import work. Schedule promotion is
// based on MARTA's published Effective Date and Atlanta service date, not on
// realtime mismatch signals or hourly upstream polling.
const gtfsCron = new Cron("0 3 * * *", { timezone: "America/New_York" }, async () => {
  await refreshAndRestartIfPromoted("⏰ Daily GTFS snapshot refresh triggered");
  cleanOldMetrics(); // prune old metrics during daily maintenance
});
console.log(`📅 GTFS refresh scheduled: next run ${gtfsCron.nextRun()?.toISOString() ?? "unknown"}`);

// Metrics collection: every 5 minutes during operation
const metricsCron = new Cron("*/5 * * * *", { timezone: "America/New_York" }, async () => {
  await collectMetrics();

  // Realtime/static mismatch is a diagnostic now, not a switching signal.
  // Schedule promotion is driven by MARTA's published Effective Date.
  if (isVehicleCacheWarm() && !isRefreshing()) {
    try {
      const tripLookup = getTripLookup();
      const { matched, total, rate } = await getMatchRate(tripLookup);
      if (rate < 0.5 && total > 0) {
        console.warn(`⚠️ GTFS match rate critically low: ${matched}/${total} (${(rate * 100).toFixed(1)}%) — check /health/diag and schedule status`);
      }
    } catch {}
  }
});
console.log(`📊 Metrics collection: every 5 min (next ${metricsCron.nextRun()?.toISOString() ?? "unknown"})`);

export default {
  port,
  hostname: "0.0.0.0",
  fetch: app.fetch,
};
