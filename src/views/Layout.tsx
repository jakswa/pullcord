import type { Child } from "hono/jsx";

export interface LayoutProps {
  title?: string;
  children: Child;
}

export const Layout = (props: LayoutProps) => (
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{props.title || "Pullcord — Real-time MARTA Bus Tracker"}</title>
      
      {/* Inter font — preconnect for speed */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
      <link 
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" 
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
      <link rel="stylesheet" href="/public/styles.css" />
      
      {/* Mobile viewport optimizations */}
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      
      {/* PWA meta tags */}
      <meta name="description" content="Real-time MARTA bus tracker with live positions and ETA predictions" />
      <meta name="theme-color" content="#0f172a" />
      
      {/* Favicon */}
      <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🚌</text></svg>" />
    </head>
    <body class="bg-slate-50 font-sans antialiased">
      {props.children}
      
      {/* Leaflet JS */}
      <script 
        src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
        integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
        crossorigin=""
      ></script>
      
      {/* App JS */}
      <script src="/public/app.js"></script>
    </body>
  </html>
);
