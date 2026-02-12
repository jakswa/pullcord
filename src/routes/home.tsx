import { Hono } from "hono";
import { Layout } from "../views/Layout.js";
import { HomePage } from "../views/pages/Home.js";

const app = new Hono();

// GET / - Home page (stop discovery)
app.get("/", (c) => {
  return c.html(
    <Layout title="Find Your Stop — Pullcord">
      <HomePage />
    </Layout>
  );
});

export default app;