import { Cron } from "croner";
import { runMigrations } from "./data/migrate.js";
import { refreshGTFS, isRefreshing, bootstrapScheduleFromExistingGTFS } from "./data/gtfs-import.js";
import { maybePromoteSchedule, resolveScheduleDbPath } from "./data/schedules.js";

// ── Schedule promotion and migrations run FIRST, before DB-dependent imports ──
// If this throws, the process exits non-zero → Fly health check fails → deploy halts.
console.log(`🚌 Pullcord starting...`);

let startupPromotion = maybePromoteSchedule();
if (!startupPromotion.active && !startupPromotion.promoted) {
  const bootstrap = await bootstrapScheduleFromExistingGTFS();
  if (bootstrap.promoted) {
    console.log(`📦 Bootstrapped and promoted GTFS schedule ${bootstrap.effectiveDate} before startup DB open`);
    startupPromotion = maybePromoteSchedule();
  }
}
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

// Daily GTFS refresh: every day at 3am ET. This builds a separate snapshot and
// only promotes it when MARTA's published Effective Date is live.
const gtfsCron = new Cron("0 3 * * *", { timezone: "America/New_York" }, async () => {
  await refreshAndRestartIfPromoted("⏰ Daily GTFS snapshot refresh triggered");
  cleanOldMetrics(); // prune old metrics during daily maintenance
});
console.log(`📅 GTFS refresh scheduled: next run ${gtfsCron.nextRun()?.toISOString() ?? "unknown"}`);

// Hourly GTFS change check: HEAD request to detect upstream zip changes.
// A change only builds a candidate snapshot; activation still uses Effective Date.
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
      await refreshAndRestartIfPromoted("🔄 Building changed GTFS snapshot");
    }
  } catch (err) {
    console.error("❌ GTFS HEAD check error:", err);
  }
});
console.log(`🔍 GTFS change check: hourly (next ${gtfsCheckCron.nextRun()?.toISOString() ?? "unknown"})`);

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
