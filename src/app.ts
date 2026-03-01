import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import homeRoutes from "./routes/home.js";
import busRoutes from "./routes/bus.js";
import aboutRoutes from "./routes/about.js";
import exploreRoutes from "./routes/explore.js";
import rideRoutes from "./routes/ride.js";
import railRoutes from "./routes/rail.js";
// Rail shootout candidates kept in src/routes/rail-candidates.ts for reference
import apiRoutes from "./routes/api.js";

const RAIL_HOST = process.env.RAIL_HOST || ""; // e.g. "train.home.jake.town"

type Env = {
  Variables: {
    isRailHost: boolean;
  };
};

const app = new Hono<Env>();

// Host detection — set isRailHost for downstream routes
app.use("*", async (c, next) => {
  const host = (c.req.header("host") || "").split(":")[0]; // strip port
  c.set("isRailHost", RAIL_HOST !== "" && host === RAIL_HOST);
  await next();
});

// Rail host: serve rail landing at /
app.get("/", async (c, next) => {
  if (c.get("isRailHost")) {
    // Rewrite to /rail handler internally (no redirect, URL stays /)
    const url = new URL(c.req.url);
    url.pathname = "/rail";
    const newReq = new Request(url.toString(), c.req.raw);
    return app.fetch(newReq, c.env);
  }
  return next();
});

// Rail host: serve rail manifest at /manifest.json
app.get("/manifest.json", async (c, next) => {
  if (c.get("isRailHost")) {
    return c.json({
      name: "MARTA Rail",
      short_name: "Rail",
      description: "Real-time MARTA rail arrivals for all 38 stations.",
      start_url: "/rail",
      display: "standalone",
      background_color: "#0f0f0f",
      theme_color: "#1a1a2e",
      orientation: "portrait",
      icons: [
        {
          src: "/public/icons/rail-192.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          src: "/public/icons/rail-512.png",
          sizes: "512x512",
          type: "image/png",
        },
      ],
    });
  }
  return next();
});

// Security headers
app.use("*", async (c, next) => {
  await next();

  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("X-XSS-Protection", "1; mode=block");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' https://unpkg.com; style-src 'self' https://unpkg.com 'unsafe-inline'; connect-src 'self' https://developerservices.itsmarta.com:*; img-src 'self' https://*.tile.openstreetmap.org data: blob:; font-src 'self'; worker-src 'self'; manifest-src 'self'"
  );
});

// Static file serving — cache JS/CSS for 1 hour, icons for 1 day
app.use("/public/*", async (c, next) => {
  await next();
  const path = c.req.path;
  if (path.endsWith(".js") || path.endsWith(".css")) {
    c.header("Cache-Control", "public, max-age=3600");
  } else if (path.endsWith(".png") || path.endsWith(".svg") || path.endsWith(".webp")) {
    c.header("Cache-Control", "public, max-age=86400");
  }
});
app.use("/public/*", serveStatic({ root: "./" }));

// API routes
app.route("/api", apiRoutes);

// Page routes
app.route("/", homeRoutes);
app.route("/", busRoutes);
app.route("/", aboutRoutes);
app.route("/", exploreRoutes);
app.route("/", rideRoutes);
app.route("/", railRoutes);
// Shootout candidates removed — reference: src/routes/rail-candidates.ts

// Serve push SW from root scope (SW scope = path of the file)
app.get("/push-sw.js", async (c) => {
  const file = Bun.file("./public/push-sw.js");
  return new Response(await file.arrayBuffer(), {
    headers: {
      "Content-Type": "application/javascript",
      "Service-Worker-Allowed": "/",
    },
  });
});

// Health check endpoint
app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// Error handling
app.onError((err, c) => {
  console.error("Application error:", err);

  if (c.req.path.startsWith("/api/")) {
    return c.json(
      {
        error:
          process.env.NODE_ENV === "development"
            ? err.message
            : "Internal server error",
      },
      500,
    );
  }

  return c.html(
    `
    <html>
      <head>
        <title>Error — Pullcord</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          body { font-family: system-ui; text-align: center; padding: 50px; background: #f9fafb; }
          .error { max-width: 400px; margin: 0 auto; }
          h1 { color: #ef4444; }
          p { color: #6b7280; margin: 20px 0; }
          a { color: #2563eb; text-decoration: none; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <div class="error">
          <h1>Something went wrong</h1>
          <p>We're sorry, but an error occurred while processing your request.</p>
          ${process.env.NODE_ENV === "development" ? `<p><code>${err.message}</code></p>` : ""}
          <p><a href="/">← Back to Home</a></p>
        </div>
      </body>
    </html>
  `,
    500,
  );
});

// 404 handler
app.notFound((c) => {
  if (c.req.path.startsWith("/api/")) {
    return c.json({ error: "Not found" }, 404);
  }

  return c.html(
    `
    <html>
      <head>
        <title>Not Found — Pullcord</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          body { font-family: system-ui; text-align: center; padding: 50px; background: #f9fafb; }
          .error { max-width: 400px; margin: 0 auto; }
          h1 { color: #6b7280; }
          p { color: #6b7280; margin: 20px 0; }
          a { color: #2563eb; text-decoration: none; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <div class="error">
          <h1>Page not found</h1>
          <p>The page you're looking for doesn't exist.</p>
          <p><a href="/">← Back to Home</a></p>
        </div>
      </body>
    </html>
  `,
    404,
  );
});

export default app;
