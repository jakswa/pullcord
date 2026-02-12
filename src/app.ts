import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import homeRoutes from "./routes/home.js";
import busRoutes from "./routes/bus.js";
import apiRoutes from "./routes/api.js";

type Env = {
  Variables: {
    // Add any context variables here if needed
  };
};

const app = new Hono<Env>();

// Security headers
app.use("*", async (c, next) => {
  await next();
  
  // Add security headers
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("X-XSS-Protection", "1; mode=block");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
});

// Static file serving
app.use("/public/*", serveStatic({ root: "./" }));

// API routes
app.route("/api", apiRoutes);

// Page routes
app.route("/", homeRoutes);
app.route("/", busRoutes);

// Health check endpoint
app.get("/health", (c) => {
  return c.json({ 
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0"
  });
});

// Error handling
app.onError((err, c) => {
  console.error("Application error:", err);
  
  // Return JSON for API routes
  if (c.req.path.startsWith("/api/")) {
    return c.json({ 
      error: process.env.NODE_ENV === "development" ? err.message : "Internal server error"
    }, 500);
  }
  
  // Return HTML for page routes
  return c.html(`
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
          ${process.env.NODE_ENV === "development" ? `<p><code>${err.message}</code></p>` : ''}
          <p><a href="/">← Back to Home</a></p>
        </div>
      </body>
    </html>
  `, 500);
});

// 404 handler
app.notFound((c) => {
  // Return JSON for API routes
  if (c.req.path.startsWith("/api/")) {
    return c.json({ error: "Not found" }, 404);
  }
  
  // Return HTML for page routes
  return c.html(`
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
  `, 404);
});

export default app;