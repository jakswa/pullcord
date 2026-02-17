import { Hono } from "hono";
import { Layout } from "../views/Layout.js";
import { AboutPage } from "../views/pages/About.js";

const app = new Hono();

app.get("/about", (c) => {
  return c.html(
    <Layout
      title="About — Pullcord"
      description="What Pullcord is, how it was made, and why an AI wrote a bus tracker."
    >
      <AboutPage />
    </Layout>
  );
});

export default app;
