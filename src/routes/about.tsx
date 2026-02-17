import { Hono } from "hono";
import { Layout } from "../views/Layout.js";
import { AboutPage } from "../views/pages/About.js";

const app = new Hono();

app.get("/about", (c) => {
  return c.html(
    <Layout
      title="About — Pullcord"
      description="Real-time MARTA bus tracker built in Atlanta. GPS-based ETAs, push notifications when your bus is close, and zero tracking. Open source."
      canonicalPath="/about"
    >
      <AboutPage />
    </Layout>
  );
});

export default app;
