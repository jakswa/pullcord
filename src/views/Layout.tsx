import type { Child } from "hono/jsx";
import { createHash } from "crypto";
import { readFileSync } from "fs";

// Cache-bust: hash static assets at startup so deploys get fresh files
function fileHash(path: string): string {
  try {
    const content = readFileSync(path);
    return createHash("md5").update(content).digest("hex").slice(0, 8);
  } catch { return Date.now().toString(36); }
}
const JS_HASH = fileHash("public/app.js");
const CSS_HASH = fileHash("public/styles.css");
const OG_HASH = fileHash("public/icons/og-image.png");

export interface LayoutProps {
  title?: string;
  description?: string;
  ogImage?: string;
  canonicalPath?: string;
  children: Child;
}

export const Layout = (props: LayoutProps) => {
  const title = props.title || "Pullcord — Real-time MARTA Bus Tracker";
  const description = props.description || "Pull the cord. Catch your ride. Real-time MARTA bus tracking with live positions and ETA predictions.";
  const ogImage = props.ogImage || `/public/icons/og-image.png?v=${OG_HASH}`;
  const siteUrl = process.env.SITE_URL || "https://bus.marta.io";
  const canonicalUrl = `${siteUrl}${props.canonicalPath || ""}`;

  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <title>{title}</title>

        {/* SEO */}
        <meta name="description" content={description} />
        <link rel="canonical" href={canonicalUrl} />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={`${siteUrl}${ogImage}`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:site_name" content="Pullcord" />
        <meta property="og:locale" content="en_US" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={`${siteUrl}${ogImage}`} />

        {/* PWA */}
        <link rel="manifest" href="/public/manifest.json" />
        <meta name="theme-color" content="#E85D3A" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#090e1a" media="(prefers-color-scheme: dark)" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Pullcord" />
        <link rel="apple-touch-icon" href="/public/icons/icon-192.png" />

        {/* Fonts — preconnect for speed */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />

        {/* Leaflet CSS */}
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossorigin=""
        />

        {/* Tailwind CSS (built) */}
        <link rel="stylesheet" href={`/public/styles.css?v=${CSS_HASH}`} />

        {/* Favicon */}
        <link rel="icon" type="image/svg+xml" href="/public/icons/favicon.svg" />
      </head>
      <body class="font-sans antialiased">
        {props.children}

        {/* Leaflet JS */}
        <script
          src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
          integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
          crossorigin=""
        ></script>

        {/* App JS */}
        <script src="/public/eta.js"></script>
        <script src={`/public/app.js?v=${JS_HASH}`}></script>

        {/* Push SW is registered on-demand by Pull the Cord — no page-load SW */}
      </body>
    </html>
  );
};
