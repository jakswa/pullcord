import app from "./app.js";

const port = parseInt(process.env.PORT || "4200");

console.log(`🚌 Pullcord starting...`);
const dbPath = process.env.DATABASE_URL || "data/marta.db";
console.log(`📊 Database: ${Bun.file(dbPath).exists() ? "✓ Found" : "❌ Missing"} (${dbPath})`);
console.log(`🔑 API Key: ${process.env.MARTA_API_KEY ? "✓ Set" : "❌ Missing"}`);
console.log(`🌐 Server: http://localhost:${port}`);

export default {
  port,
  hostname: "0.0.0.0",
  fetch: app.fetch,
};