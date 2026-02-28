import { Hono } from "hono";
import { landingView, stationView, trainView } from "../rail/views.js";
import { landingView as landingA, stationView as stationA, trainView as trainA } from "../rail/candidates/rail_views_A.js";
import { landingView as landingB, stationView as stationB, trainView as trainB } from "../rail/candidates/rail_views_B.js";
import { landingView as landingC, stationView as stationC, trainView as trainC } from "../rail/candidates/rail_views_C.js";
import { landingView as landingD, stationView as stationD, trainView as trainD } from "../rail/candidates/rail_views_D.js";
import { landingView as landingE, stationView as stationE, trainView as trainE } from "../rail/candidates/rail_views_E.js";
import { landingView as landingG, stationView as stationG, trainView as trainG } from "../rail/candidates/rail_views_G.js";
import { landingView as landingH, stationView as stationH, trainView as trainH } from "../rail/candidates/rail_views_H.js";
import { landingView as landingI, stationView as stationI, trainView as trainI } from "../rail/candidates/rail_views_I.js";
import { landingView as landingJ, stationView as stationJ, trainView as trainJ } from "../rail/candidates/rail_views_J.js";

const rail = new Hono();

// ── Candidate A: Transit Sign ──
rail.get("/rail-a", async (c) => c.html(await landingA(c.req.query("partial") === "1")));
rail.get("/rail-a/train/:id", async (c) => {
  const html = await trainA(c.req.param("id"), c.req.query("partial") === "1");
  return html ? c.html(html) : c.notFound();
});
rail.get("/rail-a/:slug", async (c) => {
  if (c.req.param("slug") === "train") return c.redirect("/rail-a");
  const html = await stationA(c.req.param("slug"), c.req.query("partial") === "1");
  return html ? c.html(html) : c.notFound();
});

// ── Candidate B: Modern Native ──
rail.get("/rail-b", async (c) => c.html(await landingB(c.req.query("partial") === "1")));
rail.get("/rail-b/train/:id", async (c) => {
  const html = await trainB(c.req.param("id"), c.req.query("partial") === "1");
  return html ? c.html(html) : c.notFound();
});
rail.get("/rail-b/:slug", async (c) => {
  if (c.req.param("slug") === "train") return c.redirect("/rail-b");
  const html = await stationB(c.req.param("slug"), c.req.query("partial") === "1");
  return html ? c.html(html) : c.notFound();
});

// ── Candidate C: Dense & Fast ──
rail.get("/rail-c", async (c) => c.html(await landingC(c.req.query("partial") === "1")));
rail.get("/rail-c/train/:id", async (c) => {
  const html = await trainC(c.req.param("id"), c.req.query("partial") === "1");
  return html ? c.html(html) : c.notFound();
});
rail.get("/rail-c/:slug", async (c) => {
  if (c.req.param("slug") === "train") return c.redirect("/rail-c");
  const html = await stationC(c.req.param("slug"), c.req.query("partial") === "1");
  return html ? c.html(html) : c.notFound();
});

// ── Candidate D: Pill-First ──
rail.get("/rail-d", async (c) => c.html(await landingD(c.req.query("partial") === "1")));
rail.get("/rail-d/train/:id", async (c) => {
  const html = await trainD(c.req.param("id"), c.req.query("partial") === "1");
  return html ? c.html(html) : c.notFound();
});
rail.get("/rail-d/:slug", async (c) => {
  if (c.req.param("slug") === "train") return c.redirect("/rail-d");
  const html = await stationD(c.req.param("slug"), c.req.query("partial") === "1");
  return html ? c.html(html) : c.notFound();
});

// ── Candidate E: Neon Lines ──
rail.get("/rail-e", async (c) => c.html(await landingE(c.req.query("partial") === "1")));
rail.get("/rail-e/train/:id", async (c) => {
  const html = await trainE(c.req.param("id"), c.req.query("partial") === "1");
  return html ? c.html(html) : c.notFound();
});
rail.get("/rail-e/:slug", async (c) => {
  if (c.req.param("slug") === "train") return c.redirect("/rail-e");
  const html = await stationE(c.req.param("slug"), c.req.query("partial") === "1");
  return html ? c.html(html) : c.notFound();
});

// ── Candidate G: Glass Morphism ──
rail.get("/rail-g", async (c) => c.html(await landingG(c.req.query("partial") === "1")));
rail.get("/rail-g/train/:id", async (c) => {
  const html = await trainG(c.req.param("id"), c.req.query("partial") === "1");
  return html ? c.html(html) : c.notFound();
});
rail.get("/rail-g/:slug", async (c) => {
  if (c.req.param("slug") === "train") return c.redirect("/rail-g");
  const html = await stationG(c.req.param("slug"), c.req.query("partial") === "1");
  return html ? c.html(html) : c.notFound();
});

// ── Candidate H ──
rail.get("/rail-h", async (c) => c.html(await landingH(c.req.query("partial") === "1")));
rail.get("/rail-h/train/:id", async (c) => {
  const html = await trainH(c.req.param("id"), c.req.query("partial") === "1");
  return html ? c.html(html) : c.notFound();
});
rail.get("/rail-h/:slug", async (c) => {
  if (c.req.param("slug") === "train") return c.redirect("/rail-h");
  const html = await stationH(c.req.param("slug"), c.req.query("partial") === "1");
  return html ? c.html(html) : c.notFound();
});

// ── Candidate I ──
rail.get("/rail-i", async (c) => c.html(await landingI(c.req.query("partial") === "1")));
rail.get("/rail-i/train/:id", async (c) => {
  const html = await trainI(c.req.param("id"), c.req.query("partial") === "1");
  return html ? c.html(html) : c.notFound();
});
rail.get("/rail-i/:slug", async (c) => {
  if (c.req.param("slug") === "train") return c.redirect("/rail-i");
  const html = await stationI(c.req.param("slug"), c.req.query("partial") === "1");
  return html ? c.html(html) : c.notFound();
});

// ── Candidate J ──
rail.get("/rail-j", async (c) => c.html(await landingJ(c.req.query("partial") === "1")));
rail.get("/rail-j/train/:id", async (c) => {
  const html = await trainJ(c.req.param("id"), c.req.query("partial") === "1");
  return html ? c.html(html) : c.notFound();
});
rail.get("/rail-j/:slug", async (c) => {
  if (c.req.param("slug") === "train") return c.redirect("/rail-j");
  const html = await stationJ(c.req.param("slug"), c.req.query("partial") === "1");
  return html ? c.html(html) : c.notFound();
});

// ── Original (current) ──
rail.get("/rail", async (c) => {
  const partial = c.req.query("partial") === "1";
  const html = await landingView(partial);
  return c.html(html);
});

rail.get("/rail/:slug", async (c) => {
  const slug = c.req.param("slug");
  if (slug === "train") return c.redirect("/rail");
  const partial = c.req.query("partial") === "1";
  const html = await stationView(slug, partial);
  if (!html) return c.notFound();
  return c.html(html);
});

rail.get("/rail/train/:id", async (c) => {
  const id = c.req.param("id");
  const partial = c.req.query("partial") === "1";
  const html = await trainView(id, partial);
  if (!html) return c.notFound();
  return c.html(html);
});

export default rail;
