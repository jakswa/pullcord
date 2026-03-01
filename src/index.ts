import app from "./app.js";
import { Cron } from "croner";
import { refreshGTFS } from "./data/gtfs-import.js";
import { collectMetrics, cleanOldMetrics } from "./data/metrics.js";

const port = parseInt(process.env.PORT || "4200");

console.log(`🚌 Pullcord starting...`);
const dbPath = process.env.DATABASE_URL || "data/marta.db";
console.log(`📊 Database: ${Bun.file(dbPath).exists() ? "✓ Found" : "❌ Missing"} (${dbPath})`);
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