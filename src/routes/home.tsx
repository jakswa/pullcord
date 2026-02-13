import { Hono } from "hono";
import { Layout } from "../views/Layout.js";
import { HomePage } from "../views/pages/Home.js";

const app = new Hono();

// GET / - Home page (stop discovery)
app.get("/", (c) => {
  return c.html(
    <Layout title="Pullcord — Real-time MARTA Bus Tracker">
      <HomePage />
    </Layout>
  );
});

export default app;