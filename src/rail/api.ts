// MARTA Rail Real-Time API client

export interface RailArrival {
  station: string;
  line: "GOLD" | "RED" | "BLUE" | "GREEN";
  destination: string;
  direction: string;
  waitSeconds: number;
  waitTime: string;
  trainId: string;
  tripId: string;
  nextArr: string;
  isRealtime: boolean;
  hasStarted: boolean;
  isFirstStop: boolean;
  eventTime: string;
}

interface RawArrival {
  STATION: string;
  LINE: string;
  DESTINATION: string;
  DIRECTION: string;
  WAITING_SECONDS: string;
  WAITING_TIME: string;
  TRAIN_ID: string;
  TRIP_ID: string;
  NEXT_ARR: string;
  IS_REALTIME: string;
  HAS_STARTED_TRIP: string;
  IS_FIRST_STOP: string;
  EVENT_TIME: string;
}

const API_URL = "https://developerservices.itsmarta.com:18096/itsmarta/railrealtimearrivals/traindata";
const API_KEY = process.env.MARTA_API_KEY || "";

// Single cache entry holds either a successful response OR the most recent
// failure. Both kinds honor the same TTL, so an API outage doesn't get
// hammered every request — we back off and show a stable error until TTL
// expires. The "serve stale data on failure" approach was removed because
// cached waitSeconds go stale fast (countdowns into the past = misleading UX).
type CacheEntry =
  | { kind: "ok"; data: RailArrival[]; ts: number }
  | { kind: "err"; error: string; ts: number };

let cache: CacheEntry | null = null;
// TTL sits just under the client's 10s poll interval so each poll actually
// triggers a refresh (via stale-while-revalidate) instead of redundantly
// re-serving the same cached bytes. 9s leaves slack for small clock skew.
const CACHE_TTL = 9_000;
// Shared in-flight promise: if a refresh is already running, any caller that
// needs one piggybacks on it instead of firing its own fetch. This prevents a
// thundering herd on cold start (100 concurrent /rail loads = 1 MARTA fetch,
// not 100) and also dedupes stale-while-revalidate background refreshes.
let inflight: Promise<RailArrival[]> | null = null;

function refresh(): Promise<RailArrival[]> {
  if (inflight) return inflight;
  inflight = _refresh().finally(() => {
    inflight = null;
  });
  return inflight;
}

export async function fetchArrivals(): Promise<RailArrival[]> {
  const now = Date.now();
  // Within TTL, serve the cached result — including cached errors.
  if (cache && now - cache.ts < CACHE_TTL) {
    return cache.kind === "ok" ? cache.data : [];
  }
  // Stale cache: kick off (or piggyback on) a background refresh, keep serving
  // the current cached value (empty array if we previously errored).
  if (cache) {
    refresh().catch(() => {});
    return cache.kind === "ok" ? cache.data : [];
  }
  // Cold start: wait for the shared refresh. On failure return [].
  try {
    return await refresh();
  } catch {
    return [];
  }
}

async function _refresh(): Promise<RailArrival[]> {
  const ts = Date.now();
  let resp: Response;
  try {
    resp = await fetch(`${API_URL}?apiKey=${API_KEY}`, {
      // 4s: short enough that a cold-start user doesn't stare at nothing if
      // MARTA is hanging, and short enough to fail, cache the error, and let
      // the next 10s poll recover cleanly.
      signal: AbortSignal.timeout(4000),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    cache = { kind: "err", error: `Unable to reach MARTA rail API (${msg})`, ts };
    throw e;
  }
  if (!resp.ok) {
    cache = { kind: "err", error: `MARTA rail API returned HTTP ${resp.status}`, ts };
    throw new Error(`Rail API ${resp.status}`);
  }
  const raw: RawArrival[] = await resp.json();

  const data = raw.map((r) => ({
    station: r.STATION,
    line: r.LINE as RailArrival["line"],
    destination: r.DESTINATION,
    direction: r.DIRECTION,
    waitSeconds: parseInt(r.WAITING_SECONDS) || 0,
    waitTime: r.WAITING_TIME,
    trainId: r.TRAIN_ID,
    tripId: r.TRIP_ID,
    nextArr: r.NEXT_ARR,
    isRealtime: r.IS_REALTIME === "true",
    hasStarted: r.HAS_STARTED_TRIP === "true",
    isFirstStop: r.IS_FIRST_STOP === "true",
    eventTime: r.EVENT_TIME,
  }));

  cache = { kind: "ok", data, ts };
  return data;
}

// True if rail data was recently fetched successfully.
export function isRailCacheWarm(): boolean {
  return cache?.kind === "ok" && Date.now() - cache.ts < 5 * 60 * 1000;
}

// Current cached error message, or null if the last cached result was a success
// (or there's no cache yet).
export function getRailApiError(): string | null {
  return cache?.kind === "err" ? cache.error : null;
}

export function stationSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/ station$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+$/, "");
}

export function stationDisplayName(name: string): string {
  return name
    .replace(/ STATION$/i, "")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

// Group arrivals by station
export function byStation(arrivals: RailArrival[]): Map<string, RailArrival[]> {
  const map = new Map<string, RailArrival[]>();
  for (const a of arrivals) {
    const list = map.get(a.station) || [];
    list.push(a);
    map.set(a.station, list);
  }
  return map;
}

// Lines that serve a station
export function stationLines(arrivals: RailArrival[]): Set<string> {
  return new Set(arrivals.map((a) => a.line));
}
