import type { RailArrival } from "../../rail/api.js";
import { stationSlug, stationDisplayName } from "../../rail/api.js";

// ── Accessible line colors ──
const LINE_COLORS = {
  dark: {
    RED: "#E05555",
    GOLD: "#D4A020",
    BLUE: "#4A9FE5",
    GREEN: "#3BAA6E",
  },
  light: {
    RED: "#B33030",
    GOLD: "#8B6D14",
    BLUE: "#1A6BB5",
    GREEN: "#1B7A45",
  },
};

// ── Station orderings for train timeline (north→south per line) ──
const LINE_STATIONS: Record<string, string[]> = {
  RED: [
    "Airport", "College Park", "East Point", "Lakewood", "Oakland City", "West End",
    "Garnett", "Five Points", "Peachtree Center", "Civic Center", "North Ave",
    "Midtown", "Arts Center", "Lindbergh", "Buckhead", "Medical Center", "Dunwoody",
    "Sandy Springs", "North Springs",
  ],
  GOLD: [
    "Airport", "College Park", "East Point", "Lakewood", "Oakland City", "West End",
    "Garnett", "Five Points", "Peachtree Center", "Civic Center", "North Ave",
    "Midtown", "Arts Center", "Lindbergh", "Lenox", "Brookhaven", "Chamblee", "Doraville",
  ],
  BLUE: [
    "Hamilton E Holmes", "West Lake", "Ashby", "Vine City", "Omni Dome",
    "Five Points", "Georgia State", "King Memorial", "Inman Park",
    "Edgewood Candler Park", "East Lake", "Decatur", "Avondale", "Kensington",
    "Indian Creek",
  ],
  GREEN: [
    "Bankhead", "Ashby", "Vine City", "Omni Dome", "Five Points", "Georgia State",
    "King Memorial", "Inman Park", "Edgewood Candler Park",
  ],
};

// Station coordinates for nearby feature [lat, lng]
const STATION_COORDS: Record<string, [number, number]> = {
  "airport": [33.64056, -84.44620],
  "arts-center": [33.78926, -84.38727],
  "ashby": [33.75648, -84.41728],
  "avondale": [33.77538, -84.28198],
  "bankhead": [33.77241, -84.42892],
  "brookhaven": [33.86016, -84.33932],
  "buckhead": [33.84788, -84.36767],
  "chamblee": [33.88772, -84.30596],
  "civic-center": [33.76616, -84.38754],
  "college-park": [33.65043, -84.44863],
  "decatur": [33.77469, -84.29537],
  "doraville": [33.90254, -84.28075],
  "dunwoody": [33.92099, -84.34440],
  "east-lake": [33.76522, -84.31318],
  "east-point": [33.67699, -84.44057],
  "edgewood-candler-park": [33.76183, -84.34064],
  "five-points": [33.75398, -84.39157],
  "garnett": [33.74882, -84.39564],
  "georgia-state": [33.75015, -84.38590],
  "hamilton-e-holmes": [33.75454, -84.46956],
  "indian-creek": [33.76987, -84.22939],
  "inman-park": [33.75734, -84.35291],
  "kensington": [33.77263, -84.25200],
  "king-memorial": [33.74990, -84.37583],
  "lakewood": [33.70059, -84.42882],
  "lenox": [33.84531, -84.35821],
  "lindbergh": [33.82346, -84.36933],
  "medical-center": [33.91069, -84.35162],
  "midtown": [33.78123, -84.38653],
  "north-ave": [33.77179, -84.38674],
  "north-springs": [33.94491, -84.35725],
  "oakland-city": [33.71723, -84.42549],
  "omni-dome": [33.75790, -84.39650],
  "peachtree-center": [33.75811, -84.38757],
  "sandy-springs": [33.93169, -84.35100],
  "vine-city": [33.75661, -84.40396],
  "west-end": [33.73606, -84.41362],
  "west-lake": [33.75329, -84.44545],
};

// Inline JS — zero external requests, handles polling + starred/nearby reordering
function buildInlineJS(isLanding: boolean): string {
  const base = `(function(){var P=1e4,d=document.getElementById("rail-data"),f=document.getElementById("freshness");if(!d||!f)return;var t=Date.now(),p=null,b=window.location.pathname;function u(){var a=Math.floor((Date.now()-t)/1e3);f.textContent=a<2?"live":a+"s ago";f.style.color=a>30?"#E85D3A":""}setInterval(u,1e3);u();function q(){fetch(b+"?partial=1",{signal:AbortSignal.timeout(8e3)}).then(function(r){if(r.ok)return r.text()}).then(function(h){if(h){d.innerHTML=h;t=Date.now();u();typeof reorder==="function"&&reorder();typeof postUpdate==="function"&&postUpdate()}}).catch(function(){})}p=setInterval(q,P);document.addEventListener("visibilitychange",function(){if(document.hidden){clearInterval(p);p=null}else{q();p=setInterval(q,P)}})})();`;

  if (!isLanding) return base;

  // Landing page: starred, nearby (opt-in geo), collapsible sections
  const landing = `
(function(){
var SK="rail-starred",SEC="rail-sections",coords=window.__COORDS||{};
function getStarred(){try{return JSON.parse(localStorage.getItem(SK))||[]}catch(e){return[]}}
function setStarred(a){localStorage.setItem(SK,JSON.stringify(a))}
function toggleStar(slug){var s=getStarred(),i=s.indexOf(slug);if(i>-1)s.splice(i,1);else s.push(slug);setStarred(s);reorder()}
function getSections(){try{return JSON.parse(localStorage.getItem(SEC))||{}}catch(e){return{}}}
function setSections(o){localStorage.setItem(SEC,JSON.stringify(o))}

// Haversine in km
function dist(a,b){var R=6371,dLat=(b[0]-a[0])*Math.PI/180,dLon=(b[1]-a[1])*Math.PI/180;var x=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(a[0]*Math.PI/180)*Math.cos(b[0]*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))}

var userPos=null,geoRequested=false,GEO_KEY="rail-geo";

// Restore cached position immediately
try{var cached=JSON.parse(sessionStorage.getItem(GEO_KEY));if(cached&&Date.now()-cached.ts<300000)userPos=[cached.lat,cached.lng]}catch(e){}

function requestGeo(){
  if(geoRequested||!navigator.geolocation)return;
  geoRequested=true;
  // Use cached position immediately, refresh in background
  if(userPos)reorder();
  navigator.geolocation.getCurrentPosition(function(p){
    userPos=[p.coords.latitude,p.coords.longitude];
    try{sessionStorage.setItem(GEO_KEY,JSON.stringify({lat:userPos[0],lng:userPos[1],ts:Date.now()}))}catch(e){}
    reorder();
  },function(){
    var s=getSections();s.nearby=false;setSections(s);reorder();
  },{ maximumAge:120000,timeout:8000 });
}

function getSlug(row){var h=row.getAttribute("href");return h?h.replace("/rail/",""):""}

function isOpen(key,def){var s=getSections();return s.hasOwnProperty(key)?s[key]:def}
function toggleSection(key){var s=getSections();s[key]=!isOpen(key,key!=="nearby");setSections(s);if(key==="nearby"&&s[key])requestGeo();reorder()}

window.reorder=function(){
  var list=document.querySelector(".rail-station-list");
  if(!list)return;
  list.classList.remove("rail-loading");
  var rows=Array.from(list.querySelectorAll(".rail-row"));
  var starred=getStarred();

  // Remove old sections/stars
  list.querySelectorAll(".rail-section,.rail-section-items").forEach(function(el){el.remove()});
  rows.forEach(function(row){
    var old=row.querySelector(".rail-star");if(old)old.remove();
    var slug=getSlug(row);
    var btn=document.createElement("span");
    btn.className="rail-star"+(starred.indexOf(slug)>-1?" starred":"");
    btn.textContent=starred.indexOf(slug)>-1?"\\u2605":"\\u2606";
    btn.setAttribute("role","button");
    btn.setAttribute("aria-label",starred.indexOf(slug)>-1?"Unstar":"Star");
    btn.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();toggleStar(slug)});
    row.insertBefore(btn,row.firstChild);
  });

  var starredSet=new Set(starred);

  // Compute nearby (top 3 non-starred, sorted by distance)
  var nearby=[];
  if(userPos){
    var dists=rows.map(function(r){var s=getSlug(r);var c=coords[s];return{slug:s,d:c?dist(userPos,c):999}}).filter(function(x){return!starredSet.has(x.slug)}).sort(function(a,b){return a.d-b.d});
    nearby=dists.slice(0,3).map(function(x){return x.slug});
  }

  var nearbySet=new Set(nearby);
  var starredRows=[],nearbyRows=[],restRows=[];
  rows.forEach(function(r){
    var s=getSlug(r);
    if(starredSet.has(s))starredRows.push(r);
    else if(nearbySet.has(s))nearbyRows.push(r);
    else restRows.push(r);
  });

  while(list.firstChild)list.removeChild(list.firstChild);

  function addSection(key,label,items,defaultOpen){
    var open=isOpen(key,defaultOpen);
    var hasItems=items.length>0;
    // nearby always shows as a section (it's the geo opt-in)
    if(!hasItems&&key!=="nearby")return;

    var h=document.createElement("div");
    h.className="rail-section"+(open?" open":"");
    h.setAttribute("role","button");
    h.setAttribute("aria-expanded",open?"true":"false");

    var txt=document.createElement("span");
    txt.textContent=label;
    h.appendChild(txt);

    var toggle=document.createElement("span");
    toggle.className="rail-toggle"+(open?" on":"");
    var knob=document.createElement("span");
    knob.className="rail-toggle-knob";
    toggle.appendChild(knob);
    h.appendChild(toggle);

    h.addEventListener("click",function(){toggleSection(key)});
    list.appendChild(h);

    if(hasItems){
      var wrap=document.createElement("div");
      wrap.className="rail-section-items";
      if(!open)wrap.style.display="none";
      items.forEach(function(r){wrap.appendChild(r)});
      list.appendChild(wrap);
    } else if(key==="nearby"&&open&&!userPos){
      // Skeleton while waiting for geolocation
      var skel=document.createElement("div");
      skel.className="rail-section-items rail-skeleton";
      for(var i=0;i<3;i++){var row=document.createElement("div");row.className="rail-skel-row";skel.appendChild(row)}
      list.appendChild(skel);
    }
  }

  var hasAnySections=starredRows.length>0||navigator.geolocation;
  if(hasAnySections){
    addSection("starred","starred",starredRows,true);
    if(navigator.geolocation)addSection("nearby","nearby",nearbyRows,false);
    addSection("all","all stations",restRows,true);
  } else {
    restRows.forEach(function(r){list.appendChild(r)});
  }
};
// If user previously enabled nearby, silently re-request geo on load
if(isOpen("nearby",false))requestGeo();
reorder();
})();`;

  return base + landing;
}

// Map direction codes to short labels
const DIR_LABELS: Record<string, string> = {
  N: "N",
  S: "S",
  E: "E",
  W: "W",
};

// Canonical station order — alphabetical for landing page
const STATION_ORDER = [
  "AIRPORT STATION",
  "ARTS CENTER STATION",
  "ASHBY STATION",
  "AVONDALE STATION",
  "BANKHEAD STATION",
  "BROOKHAVEN STATION",
  "BUCKHEAD STATION",
  "CHAMBLEE STATION",
  "CIVIC CENTER STATION",
  "COLLEGE PARK STATION",
  "DECATUR STATION",
  "DORAVILLE STATION",
  "DUNWOODY STATION",
  "EAST LAKE STATION",
  "EAST POINT STATION",
  "EDGEWOOD CANDLER PARK STATION",
  "FIVE POINTS STATION",
  "GARNETT STATION",
  "GEORGIA STATE STATION",
  "HAMILTON E HOLMES STATION",
  "INDIAN CREEK STATION",
  "INMAN PARK STATION",
  "KENSINGTON STATION",
  "KING MEMORIAL STATION",
  "LAKEWOOD STATION",
  "LENOX STATION",
  "LINDBERGH STATION",
  "MEDICAL CENTER STATION",
  "MIDTOWN STATION",
  "NORTH AVE STATION",
  "NORTH SPRINGS STATION",
  "OAKLAND CITY STATION",
  "OMNI DOME STATION",
  "PEACHTREE CENTER STATION",
  "SANDY SPRINGS STATION",
  "VINE CITY STATION",
  "WEST END STATION",
  "WEST LAKE STATION",
];

// ── Types ──
interface StationPill {
  direction: string;
  waitSeconds: number;
  line: string;
}

interface StationRow {
  name: string;
  slug: string;
  pills: StationPill[];
  isFourDir: boolean;
}

// ── Helpers ──
function formatTime(seconds: number): string {
  if (seconds < 60) return "NOW";
  const mins = Math.floor(seconds / 60);
  return `:${mins.toString().padStart(2, "0")}`;
}

function normalizeStation(s: string): string {
  return s.toUpperCase().replace(/ STATION$/i, "").trim();
}

function buildStationRows(arrivals: RailArrival[]): StationRow[] {
  const byStation = new Map<string, RailArrival[]>();
  for (const a of arrivals) {
    const list = byStation.get(a.station) || [];
    list.push(a);
    byStation.set(a.station, list);
  }

  const seen = new Set<string>();
  const rows: StationRow[] = [];

  const allStations = [...STATION_ORDER];
  for (const name of byStation.keys()) {
    if (!allStations.includes(name)) {
      allStations.push(name);
    }
  }

  for (const stationName of allStations) {
    if (seen.has(stationName)) continue;
    seen.add(stationName);

    const stationArrivals = byStation.get(stationName) || [];

    const bestByDir = new Map<string, RailArrival>();
    for (const a of stationArrivals) {
      const existing = bestByDir.get(a.direction);
      if (!existing || a.waitSeconds < existing.waitSeconds) {
        bestByDir.set(a.direction, a);
      }
    }

    const dirOrder = ["N", "S", "E", "W"];
    const pills: StationPill[] = dirOrder
      .filter((d) => bestByDir.has(d))
      .map((d) => {
        const a = bestByDir.get(d)!;
        return { direction: d, waitSeconds: a.waitSeconds, line: a.line };
      });

    const isFourDir = pills.length === 4 || stationName === "FIVE POINTS STATION";

    rows.push({
      name: stationDisplayName(stationName),
      slug: stationSlug(stationName),
      pills,
      isFourDir,
    });
  }

  return rows;
}

// ── Pill component ──
function Pill({ pill, mode = "dark" }: { pill: StationPill; mode?: "dark" | "light" }) {
  const colors = LINE_COLORS[mode];
  const bg = colors[pill.line as keyof typeof colors] || "#666";
  const isNow = pill.waitSeconds < 60;
  const label = `${DIR_LABELS[pill.direction] || pill.direction} ${formatTime(pill.waitSeconds)}`;

  return (
    <span
      class={`rail-pill${isNow ? " rail-pill-now" : ""}`}
      style={`background:${bg}`}
      aria-label={`${pill.direction} direction: ${isNow ? "arriving now" : Math.floor(pill.waitSeconds / 60) + " minutes"}`}
    >
      {label}
    </span>
  );
}

// ── Four-direction pill grid (Five Points) ──
function FourPillGrid({ pills, mode = "dark" }: { pills: StationPill[]; mode?: "dark" | "light" }) {
  const byDir = new Map(pills.map((p) => [p.direction, p]));
  const grid = [
    ["N", "E"],
    ["S", "W"],
  ];

  return (
    <span class="rail-pills-grid">
      {grid.flat().map((dir) => {
        const p = byDir.get(dir);
        return p ? (
          <Pill pill={p} mode={mode} />
        ) : (
          <span class="rail-pill rail-pill-empty">—</span>
        );
      })}
    </span>
  );
}

// ── Station row ──
function StationRowEl({ row, mode = "dark" }: { row: StationRow; mode?: "dark" | "light" }) {
  return (
    <a href={`/rail/${row.slug}`} class="rail-row" aria-label={`${row.name} station`}>
      <span class="rail-station-name">{row.name.toLowerCase()}</span>
      <span class="rail-pills-wrap">
        {row.pills.length === 0 ? (
          <span class="rail-no-data">—</span>
        ) : row.isFourDir ? (
          <FourPillGrid pills={row.pills} mode={mode} />
        ) : (
          <span class="rail-pills-inline">
            {row.pills.map((p) => (
              <Pill pill={p} mode={mode} />
            ))}
          </span>
        )}
      </span>
    </a>
  );
}

// ── Landing page inner HTML (used for partial updates) ──
export function RailStationList({ arrivals }: { arrivals: RailArrival[] }) {
  const rows = buildStationRows(arrivals);

  return (
    <div class="rail-station-list rail-loading">
      {rows.map((row) => (
        <StationRowEl row={row} />
      ))}
    </div>
  );
}

// ── Full landing page ──
export function RailLandingPage({ arrivals, standalone = false }: { arrivals: RailArrival[]; standalone?: boolean }) {
  const title = standalone ? "MARTA Rail" : "MARTA Rail — Pullcord";
  const backHref = standalone ? "/rail" : "/";
  const backLabel = standalone ? "Refresh" : "Back to home";

  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <title>{title}</title>
        <meta name="description" content="Real-time MARTA rail arrivals for all 38 stations." />
        {standalone && <link rel="manifest" href="/manifest.json" />}
        {standalone && <meta name="apple-mobile-web-app-capable" content="yes" />}
        {standalone && <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />}
        {standalone && <meta name="theme-color" content="#1a1a2e" />}
        <style>{railStyles()}</style>
      </head>
      <body class="rail-body">
        <div class="rail-shell">
          <header class="rail-header">
            <div class="rail-header-top">
              {!standalone && (
                <a href={backHref} class="rail-back" aria-label={backLabel}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M15 10H5M5 10L10 5M5 10L10 15" />
                  </svg>
                </a>
              )}
              <h1 class="rail-title">marta rail</h1>
              <span class="rail-freshness" id="freshness">—</span>
            </div>
          </header>
          <main class="rail-main">
            <div id="rail-data">
              <RailStationList arrivals={arrivals} />
            </div>
          </main>
        </div>
        <script dangerouslySetInnerHTML={{ __html: `window.__COORDS=${JSON.stringify(STATION_COORDS)};` }} />
        <script dangerouslySetInnerHTML={{ __html: buildInlineJS(true) }} />
      </body>
    </html>
  );
}

// ── Station detail page ──
export function RailStationPage({
  stationName,
  arrivals,
  standalone = false,
}: {
  stationName: string;
  arrivals: RailArrival[];
  standalone?: boolean;
}) {
  const displayName = stationDisplayName(stationName);
  const title = standalone
    ? `${displayName} — MARTA Rail`
    : `${displayName} — MARTA Rail — Pullcord`;

  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <title>{title}</title>
        {standalone && <link rel="manifest" href="/manifest.json" />}
        {standalone && <meta name="theme-color" content="#1a1a2e" />}
        <style>{railStyles()}</style>
      </head>
      <body class="rail-body">
        <div class="rail-shell">
          <header class="rail-header">
            <div class="rail-header-top">
              <a href="/rail" class="rail-back" aria-label="Back to all stations">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M15 10H5M5 10L10 5M5 10L10 15" />
                </svg>
              </a>
              <h1 class="rail-title">{displayName.toLowerCase()}</h1>
              <span class="rail-freshness" id="freshness">—</span>
            </div>
          </header>
          <main class="rail-main rail-station-detail">
            <div id="rail-data">
              <RailStationDetail stationName={stationName} arrivals={arrivals} />
            </div>
          </main>
        </div>
        <script dangerouslySetInnerHTML={{ __html: `window.__RAIL_STATION = ${JSON.stringify(stationName)};` }} />
        <script dangerouslySetInnerHTML={{ __html: buildInlineJS(false) }} />
      </body>
    </html>
  );
}

// Station detail inner (for partials) — flat list, soonest first
export function RailStationDetail({
  stationName,
  arrivals,
}: {
  stationName: string;
  arrivals: RailArrival[];
}) {
  const sorted = [...arrivals].sort((a, b) => a.waitSeconds - b.waitSeconds);
  const colors = LINE_COLORS.dark;

  return (
    <div class="rail-detail-list">
      {sorted.map((a) => {
        const bg = colors[a.line as keyof typeof colors] || "#666";
        const isNow = a.waitSeconds < 60;
        const isScheduled = !a.isRealtime;
        const isBoarding = a.isRealtime && !a.hasStarted && a.isFirstStop;
        const rowClass = `rail-arrival-row${isScheduled ? " rail-scheduled" : ""}${isBoarding ? " rail-boarding" : ""}`;

        // Scheduled entries have no trainId — render as div (not tappable)
        const Tag = isScheduled ? "div" : "a";
        const linkProps = isScheduled ? {} : { href: `/rail/train/${a.trainId}` };

        return (
          <Tag {...linkProps} class={rowClass}>
            <span class="rail-arrival-dir">
              {a.direction}
            </span>
            <span class="rail-arrival-line-pill" style={`background:${bg}`}>
              {a.line.toLowerCase()}
            </span>
            {isBoarding && <span class="rail-badge-boarding">boarding</span>}
            <span class="rail-arrival-dest">
              {stationDisplayName(a.destination).toLowerCase()}
            </span>
            <span class={`rail-arrival-time${isNow ? " rail-arrival-now" : ""}`}>
              {isScheduled ? "~" : ""}{isNow ? "NOW" : `${Math.floor(a.waitSeconds / 60)} min`}
            </span>
          </Tag>
        );
      })}
      {sorted.length === 0 && (
        <div class="rail-empty">No arrivals currently available for this station.</div>
      )}
    </div>
  );
}

// ── Train timeline page ──
export function RailTrainPage({
  trainId,
  arrivals,
  standalone = false,
}: {
  trainId: string;
  arrivals: RailArrival[];
  standalone?: boolean;
}) {
  const trainArrivals = arrivals.filter((a) => a.trainId === trainId);
  const hasData = trainArrivals.length > 0;
  const line = hasData ? trainArrivals[0].line : "";
  const destination = hasData ? stationDisplayName(trainArrivals[0].destination) : "Unknown";
  const color = hasData ? (LINE_COLORS.dark[line as keyof typeof LINE_COLORS["dark"]] || "#666") : "#666";

  const title = standalone
    ? `Train ${trainId} — MARTA Rail`
    : `Train ${trainId} — MARTA Rail — Pullcord`;

  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <title>{title}</title>
        {standalone && <link rel="manifest" href="/manifest.json" />}
        {standalone && <meta name="theme-color" content="#1a1a2e" />}
        <style>{railStyles()}</style>
        <style>{trainTimelineStyles(color)}</style>
      </head>
      <body class="rail-body">
        <div class="rail-shell">
          <header class="rail-header">
            <div class="rail-header-top">
              <a href="/rail" class="rail-back" aria-label="Back to all stations">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M15 10H5M5 10L10 5M5 10L10 15" />
                </svg>
              </a>
              <div class="rail-train-header-info">
                <span class="rail-train-id">Train {trainId}</span>
                {hasData && (
                  <span class="rail-train-line-badge" style={`background:${color}`}>
                    {line}
                  </span>
                )}
              </div>
              <span class="rail-freshness" id="freshness">—</span>
            </div>
            {hasData && (
              <div class="rail-train-dest">→ {destination.toLowerCase()}</div>
            )}
          </header>
          <main class="rail-main rail-train-main">
            <div id="rail-data">
              <RailTrainTimeline trainId={trainId} arrivals={arrivals} />
            </div>
          </main>
        </div>
        <script dangerouslySetInnerHTML={{ __html: buildInlineJS(false) }} />
        <script dangerouslySetInnerHTML={{ __html: `
          // First load: record initially-visited stops and hide them.
          // On poll updates, re-hide those same stops (but newly-visited ones stay visible).
          (function(){
            window._initialVisited = new Set();
            var visited = document.querySelectorAll(".rail-tl-stop.visited");
            for(var i=0;i<visited.length;i++){
              var name = visited[i].querySelector(".rail-tl-name");
              if(name) window._initialVisited.add(name.textContent);
              visited[i].style.display="none";
            }
            window.postUpdate = function(){
              var stops = document.querySelectorAll(".rail-tl-stop.visited");
              for(var i=0;i<stops.length;i++){
                var n = stops[i].querySelector(".rail-tl-name");
                if(n && window._initialVisited.has(n.textContent)){
                  stops[i].style.display="none";
                }
              }
            };
          })();
        ` }} />
      </body>
    </html>
  );
}

// Train timeline inner (for partials)
export function RailTrainTimeline({
  trainId,
  arrivals,
}: {
  trainId: string;
  arrivals: RailArrival[];
}) {
  const trainArrivals = arrivals.filter((a) => a.trainId === trainId);

  if (trainArrivals.length === 0) {
    return (
      <div class="rail-empty">
        No data for train {trainId}. It may have completed its trip.
      </div>
    );
  }

  const line = trainArrivals[0].line;
  const direction = trainArrivals[0].direction;
  const color = LINE_COLORS.dark[line as keyof typeof LINE_COLORS["dark"]] || "#666";

  // Get station order for this line, reversed if heading south/west
  let stationOrder = LINE_STATIONS[line] || [];
  if (direction === "S" || direction === "W") {
    stationOrder = [...stationOrder].reverse();
  }

  // Find the soonest arrival — that's where the train is
  const soonest = [...trainArrivals].sort((a, b) => a.waitSeconds - b.waitSeconds)[0];
  const currentNorm = normalizeStation(soonest.station);

  const currentIdx = stationOrder.findIndex((stn) => normalizeStation(stn) === currentNorm);
  let foundCurrent = false;

  return (
    <div class="rail-timeline" style={`--tl-color:${color}`}>
      <div class="rail-tl-line" style={`background:${color}`}></div>
      {stationOrder.map((stn) => {
        const stnNorm = normalizeStation(stn);
        const match = trainArrivals.find((a) => normalizeStation(a.station) === stnNorm);
        const isCurrent = stnNorm === currentNorm;
        if (isCurrent) foundCurrent = true;
        const visited = !foundCurrent;

        const cls = isCurrent ? "rail-tl-stop current" : visited ? "rail-tl-stop visited" : "rail-tl-stop";

        const isNow = match && match.waitSeconds < 60;
        const mins = match ? Math.floor(match.waitSeconds / 60) : 0;

        const stnSlug = stationSlug(stn + " STATION");

        return (
          <a href={`/rail/${stnSlug}`} class={cls} id={isCurrent ? "rail-current" : undefined}>
            <span class="rail-tl-dot" style={`background:${color}`}></span>
            <span class="rail-tl-name">{stationDisplayName(stn).toLowerCase()}</span>
            {match && !visited && (
              <span class={`rail-tl-time${isNow ? " rail-tl-now" : ""}`}>
                {isNow ? "NOW" : `${mins}m`}
              </span>
            )}
          </a>
        );
      })}
    </div>
  );
}

// ── Dynamic train timeline styles (per-line color) ──
function trainTimelineStyles(color: string): string {
  return `
    .rail-tl-stop.current .rail-tl-name {
      color: ${color};
      font-weight: 700;
    }
  `;
}

// ── Styles ──
function railStyles(): string {
  return `
    /* ── CSS Variables (design system tokens) ── */
    :root {
      --bg-primary: #0f0f0f;
      --bg-surface: #1a1a18;
      --text-primary: #d4d0c8;
      --text-body: #b0a898;
      --text-muted: #807870;
      --border-color: #2a2a26;
      --border-subtle: #333330;
      --brand: #E85D3A;
      --font-sans: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif;
      --font-mono: ui-monospace, Cascadia Code, Source Code Pro, Menlo, Consolas, monospace;
    }

    @media (prefers-color-scheme: light) {
      :root {
        --bg-primary: #f5f0eb;
        --bg-surface: #ece5dc;
        --text-primary: #3B2820;
        --text-body: #5C4030;
        --text-muted: #A89282;
        --border-color: #d8cfc4;
        --border-subtle: #e0d8cf;
      }
    }

    /* ── Rail base ── */
    .rail-body {
      margin: 0;
      font-family: var(--font-sans);
      font-size: 16px;
      -webkit-font-smoothing: antialiased;
      background: var(--bg-primary);
      color: var(--text-primary);
      overflow-x: hidden;
    }

    .rail-shell {
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      max-width: 100vw;
      overflow-x: hidden;
    }

    *, *::before, *::after {
      box-sizing: border-box;
    }

    /* ── Header ── */
    .rail-header {
      position: sticky;
      top: 0;
      z-index: 10;
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border-color);
      padding: 0.65rem 0.75rem;
    }

    .rail-header-top {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      max-width: 600px;
      margin: 0 auto;
    }

    .rail-back {
      color: var(--text-muted);
      display: flex;
      align-items: center;
      text-decoration: none;
      padding: 0.2rem;
      border-radius: 0.25rem;
      flex-shrink: 0;
    }
    .rail-back:active { color: var(--brand); }

    .rail-title {
      font-size: 1.2rem;
      font-weight: 700;
      margin: 0;
      flex: 1;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .rail-freshness {
      font-family: var(--font-mono);
      font-size: 0.85rem;
      font-variant-numeric: tabular-nums;
      color: var(--text-muted);
      flex-shrink: 0;
      min-width: 3rem;
      text-align: right;
    }

    /* ── Train header extras ── */
    .rail-train-header-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex: 1;
      min-width: 0;
    }

    .rail-train-id {
      font-size: 1.2rem;
      font-weight: 700;
      font-family: var(--font-mono);
      font-variant-numeric: tabular-nums;
    }

    .rail-train-line-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.15rem 0.5rem;
      border-radius: 0.25rem;
      font-size: 0.85rem;
      font-weight: 800;
      color: #fff;
      letter-spacing: 0.04em;
      flex-shrink: 0;
    }

    .rail-train-dest {
      max-width: 600px;
      margin: 0.15rem auto 0;
      padding-left: 2rem;
      font-size: 1rem;
      color: var(--text-muted);
    }

    /* ── Main content ── */
    .rail-main {
      flex: 1;
      max-width: 600px;
      width: 100%;
      margin: 0 auto;
      padding: 0;
    }

    /* ── Station list ── */
    .rail-station-list {
      display: flex;
      flex-direction: column;
    }

    .rail-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.85rem 1rem;
      text-decoration: none;
      color: inherit;
      border-bottom: 1px solid var(--border-subtle);
      min-height: 2.25rem;
      -webkit-tap-highlight-color: transparent;
    }
    .rail-row:active {
      background: var(--border-subtle);
    }

    .rail-station-name {
      flex: 1;
      min-width: 0;
      font-size: 1.15rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.3;
    }

    .rail-pills-wrap {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: flex-end;
    }

    .rail-pills-inline {
      display: flex;
      gap: 0.25rem;
      align-items: center;
    }

    /* ── Pill ── */
    .rail-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 66px;
      height: 1.9rem;
      border-radius: 0.3rem;
      font-family: var(--font-mono);
      font-size: 1rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      color: #fff;
      white-space: nowrap;
      letter-spacing: 0.02em;
      line-height: 1;
    }

    .rail-pill-now {
      animation: rail-pulse 1.5s ease-in-out infinite;
    }

    .rail-pill-empty {
      background: var(--border-color);
      color: #555;
      width: 66px;
    }

    @media (prefers-color-scheme: light) {
      .rail-pill-empty {
        color: #aaa;
      }
    }

    /* ── Four-direction grid (Five Points) ── */
    .rail-pills-grid {
      display: grid;
      grid-template-columns: 66px 66px;
      gap: 0.2rem;
    }

    /* ── No data ── */
    .rail-no-data {
      color: #555;
      font-size: 1rem;
      min-width: 66px;
      text-align: center;
    }

    /* ── Star button ── */
    .rail-star {
      flex-shrink: 0;
      font-size: 1.2rem;
      line-height: 1;
      color: var(--text-muted);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      padding: 0.1rem 0.15rem;
      user-select: none;
    }
    .rail-star.starred {
      color: #D4A020;
    }

    /* ── Section headers (collapsible) ── */
    .rail-section {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.95rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      color: var(--text-muted);
      padding: 0.85rem 1rem;
      min-height: 3rem;
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border-color);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
    }
    .rail-section:active {
      background: var(--border-color);
    }
    .rail-toggle {
      margin-left: auto;
      width: 36px;
      height: 20px;
      border-radius: 10px;
      background: var(--border-color);
      position: relative;
      flex-shrink: 0;
      transition: background 0.15s;
    }
    .rail-toggle.on {
      background: #888;
    }
    .rail-toggle-knob {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #fff;
      transition: left 0.15s;
    }
    .rail-toggle.on .rail-toggle-knob {
      left: 18px;
    }
    .rail-section-items {
      display: flex;
      flex-direction: column;
    }

    /* Hide list until JS reorders (prevents unsorted flash) */
    .rail-loading {
      visibility: hidden;
    }

    /* Nearby skeleton rows */
    .rail-skel-row {
      height: 3.7rem;
      border-bottom: 1px solid var(--border-subtle);
      background: linear-gradient(90deg, transparent 0%, var(--border-subtle) 50%, transparent 100%);
      background-size: 200% 100%;
      animation: rail-shimmer 1.5s ease-in-out infinite;
    }
    @keyframes rail-shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    /* ── Animations ── */
    @keyframes rail-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    /* ── Station detail ── */
    .rail-station-detail {
      padding: 0.75rem 1rem;
    }

    .rail-detail-list {
      display: flex;
      flex-direction: column;
    }

    .rail-arrival-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 0;
      text-decoration: none;
      color: inherit;
      border-bottom: 1px solid var(--border-subtle);
      -webkit-tap-highlight-color: transparent;
    }
    .rail-arrival-row:active {
      background: var(--border-subtle);
    }

    .rail-arrival-dir {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.75rem;
      height: 1.75rem;
      border-radius: 0.25rem;
      font-size: 1rem;
      font-weight: 800;
      color: var(--text-primary);
      background: var(--border-color);
      flex-shrink: 0;
    }

    .rail-arrival-line-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.15rem 0.4rem;
      border-radius: 0.2rem;
      font-size: 0.85rem;
      font-weight: 700;
      color: #fff;
      flex-shrink: 0;
      letter-spacing: 0.02em;
    }

    .rail-arrival-dest {
      flex: 1;
      font-size: 1.05rem;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .rail-arrival-time {
      font-family: var(--font-mono);
      font-size: 1.1rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      flex-shrink: 0;
      min-width: 3rem;
      text-align: right;
    }

    .rail-arrival-now {
      color: var(--brand);
      animation: rail-pulse 1.5s ease-in-out infinite;
    }

    /* Scheduled (non-realtime) — muted, not tappable */
    .rail-scheduled {
      opacity: 0.45;
      cursor: default;
    }
    .rail-scheduled:active {
      background: transparent;
    }

    /* Boarding — train at terminal, can board now */
    .rail-badge-boarding {
      display: inline-block;
      margin-left: 0.4rem;
      padding: 0.1rem 0.35rem;
      border-radius: 0.2rem;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      background: #2d8a4e;
      color: #fff;
      vertical-align: middle;
    }

    .rail-empty {
      text-align: center;
      padding: 2rem 1rem;
      color: var(--text-muted);
      font-size: 1rem;
    }

    /* ── Train timeline ── */
    .rail-train-main {
      padding: 0.75rem 1rem;
    }

    .rail-timeline {
      position: relative;
      padding: 0.5rem 1rem;
    }

    .rail-tl-line {
      position: absolute;
      left: 1.65rem;
      top: 0;
      bottom: 0;
      width: 3px;
      border-radius: 2px;
      opacity: 0.35;
    }

    .rail-tl-stop.visited {
      opacity: 0.3;
    }
    .rail-tl-stop.visited .rail-tl-dot {
      width: 8px;
      height: 8px;
      left: 0.84rem;
    }

    .rail-tl-stop {
      position: relative;
      padding: 0.7rem 0 0.7rem 2.25rem;
      display: flex;
      align-items: center;
      text-decoration: none;
      color: inherit;
      -webkit-tap-highlight-color: transparent;
      min-height: 3rem;
    }

    .rail-tl-dot {
      position: absolute;
      left: 0.65rem;
      top: 50%;
      transform: translateY(-50%);
      width: 14px;
      height: 14px;
      border-radius: 50%;
      z-index: 1;
      flex-shrink: 0;
    }

    .rail-tl-stop.current .rail-tl-dot {
      width: 18px;
      height: 18px;
      left: 0.52rem;
      animation: rail-tl-pulse 1.5s ease-in-out infinite;
      box-shadow: 0 0 8px var(--tl-color, #666);
    }

    @keyframes rail-tl-pulse {
      0%, 100% { opacity: 1; transform: translateY(-50%) scale(1); }
      50% { opacity: 0.7; transform: translateY(-50%) scale(0.85); }
    }

    .rail-tl-name {
      font-size: 1.1rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
    }

    .rail-tl-time {
      font-family: var(--font-mono);
      font-size: 1.1rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      flex-shrink: 0;
      margin-left: 0.5rem;
      color: var(--text-primary);
    }

    .rail-tl-now {
      color: #4ADE80;
      font-weight: 800;
    }
  `;
}
