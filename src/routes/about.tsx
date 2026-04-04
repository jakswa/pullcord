import { Hono } from "hono";
import { Layout } from "../views/Layout.js";
import { AboutPage } from "../views/pages/About.js";
import { aboutView as railAboutView } from "../rail/views.js";

const app = new Hono();

app.get("/about", (c) => {
  const isRailHost = (c.get as any)("isRailHost") || false;

  if (isRailHost) {
    return c.html(railAboutView());
  }

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
