import type { Child } from "hono/jsx";

export interface ExperimentLayoutProps {
  title?: string;
  variant: string;
  children: Child;
}

export const ExperimentLayout = (props: ExperimentLayoutProps) => (
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{props.title || "Pullcord — Experiment"}</title>
      
      {/* Inter font */}
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
      
      {/* Experiment CSS */}
      <link rel="stylesheet" href={`/public/experiments/${props.variant}/styles.css`} />
      
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="theme-color" content="#0f172a" />
      <link rel="icon" type="image/svg+xml" href="/public/icons/favicon.svg" />
    </head>
    <body class="font-sans antialiased">
      {/* Experiment badge + base path for link rewriting */}
      <div style="position:fixed;top:0.5rem;left:50%;transform:translateX(-50%);z-index:9999;background:rgba(0,0,0,0.7);color:#fff;padding:0.2rem 0.75rem;border-radius:1rem;font-size:0.7rem;font-weight:600;letter-spacing:0.05em;pointer-events:none;">
        EXPERIMENT {props.variant.toUpperCase()}
      </div>
      <script dangerouslySetInnerHTML={{ __html: `window.__BASE_PATH__ = "/v/${props.variant}";` }} />

      {props.children}
      
      {/* Leaflet JS */}
      <script 
        src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
        integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
        crossorigin=""
      ></script>
      
      {/* Experiment JS */}
      <script src={`/public/experiments/${props.variant}/app.js`}></script>
    </body>
  </html>
);
