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
import { refreshGTFS, isRefreshing } from "./data/gtfs-import.js";
import { collectMetrics, cleanOldMetrics } from "./data/metrics.js";
import { getMatchRate, isVehicleCacheWarm } from "./data/realtime.js";
import { getTripLookup, invalidateCaches } from "./data/db.js";

const port = parseInt(process.env.PORT || "4200");

console.log(`🔑 API Key: ${process.env.MARTA_API_KEY ? "✓ Set" : "❌ Missing"}`);
console.log(`🌐 Server: http://localhost:${port}`);

// Daily GTFS refresh: every day at 3am ET
const gtfsCron = new Cron("0 3 * * *", { timezone: "America/New_York" }, async () => {
  console.log("⏰ Daily GTFS refresh triggered");
  await refreshGTFS();
  invalidateCaches();
  cleanOldMetrics(); // prune old metrics during daily maintenance
});
console.log(`📅 GTFS refresh scheduled: next run ${gtfsCron.nextRun()?.toISOString() ?? "unknown"}`);

// Hourly GTFS change check: HEAD request to detect upstream schedule changes
let lastGtfsLastModified: string | null = null;
let lastGtfsContentLength: string | null = null;
const GTFS_URL = "https://itsmarta.com/google_transit_feed/google_transit.zip";

const gtfsCheckCron = new Cron("0 * * * *", { timezone: "America/New_York" }, async () => {
  try {
    const resp = await fetch(GTFS_URL, { method: "HEAD" });
    if (!resp.ok) {
      console.warn(`⚠️ GTFS HEAD check failed: ${resp.status}`);
      return;
    }
    const lastModified = resp.headers.get("last-modified");
    const contentLength = resp.headers.get("content-length");

    // First run: just record values, don't trigger refresh
    if (lastGtfsLastModified === null && lastGtfsContentLength === null) {
      lastGtfsLastModified = lastModified;
      lastGtfsContentLength = contentLength;
      console.log(`📋 GTFS baseline recorded — Last-Modified: ${lastModified}, Content-Length: ${contentLength}`);
      return;
    }

    const changed =
      (lastModified !== null && lastModified !== lastGtfsLastModified) ||
      (contentLength !== null && contentLength !== lastGtfsContentLength);

    if (changed) {
      console.log(`🔔 GTFS change detected — Last-Modified: ${lastGtfsLastModified} → ${lastModified}, Content-Length: ${lastGtfsContentLength} → ${contentLength}`);
      lastGtfsLastModified = lastModified;
      lastGtfsContentLength = contentLength;
      await refreshGTFS();
      invalidateCaches();
    }
  } catch (err) {
    console.error("❌ GTFS HEAD check error:", err);
  }
});
console.log(`🔍 GTFS change check: hourly (next ${gtfsCheckCron.nextRun()?.toISOString() ?? "unknown"})`);

// Metrics collection: every 5 minutes during operation
const metricsCron = new Cron("*/5 * * * *", { timezone: "America/New_York" }, async () => {
  await collectMetrics();

  // Check GTFS staleness when vehicle cache is warm (users are active)
  if (isVehicleCacheWarm() && !isRefreshing()) {
    try {
      const tripLookup = getTripLookup();
      const { matched, total, rate } = await getMatchRate(tripLookup);
      if (rate < 0.5 && total > 0) {
        console.warn(`⚠️ GTFS match rate critically low: ${matched}/${total} (${(rate * 100).toFixed(1)}%) — triggering auto-refresh`);
        await refreshGTFS();
        invalidateCaches();
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
