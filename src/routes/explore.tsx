import { Hono } from "hono";
import { Layout } from "../views/Layout.js";
import { ExplorePage } from "../views/pages/Explore.js";

const app = new Hono();

app.get("/explore", (c) => {
  return c.html(
    <Layout
      title="Explore Stops — Pullcord"
      description="Browse all MARTA bus stops on a map. Tap any stop to see live arrivals."
      canonicalPath="/explore"
    >
      <ExplorePage />
    </Layout>
  );
});

export default app;
