import app from "./app.js";

const port = parseInt(process.env.PORT || "4200");

console.log(`🚌 Pullcord starting...`);
console.log(`📊 Database: ${Bun.file("data/marta.db").exists() ? "✓ Found" : "❌ Missing"}`);
console.log(`🔑 API Key: ${process.env.MARTA_API_KEY ? "✓ Set" : "❌ Missing"}`);
console.log(`🌐 Server: http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};