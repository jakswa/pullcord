import { Hono } from "hono";
import { landingView, stationView, trainView } from "../rail/views.js";

const rail = new Hono();

// Station list
rail.get("/rail", async (c) => {
  const partial = c.req.query("partial") === "1";
  const html = await landingView(partial);
  return c.html(html);
});

// Station detail
rail.get("/rail/:slug", async (c) => {
  const slug = c.req.param("slug");

  // Train view: /rail/train/302
  if (slug === "train") return c.redirect("/rail");

  const partial = c.req.query("partial") === "1";
  const html = await stationView(slug, partial);
  if (!html) return c.notFound();
  return c.html(html);
});

// Train detail
rail.get("/rail/train/:id", async (c) => {
  const id = c.req.param("id");
  const partial = c.req.query("partial") === "1";
  const html = await trainView(id, partial);
  if (!html) return c.notFound();
  return c.html(html);
});

export default rail;
