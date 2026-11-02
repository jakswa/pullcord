// MARTA Rail Real-Time API client

export interface RailArrival {
  station: string;
  line: "GOLD" | "RED" | "BLUE" | "GREEN";
  destination: string;
  direction: string;
  waitSeconds: number;
  waitTime: string;
  trainId: string;
  nextArr: string;
  isRealtime: boolean;
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
  NEXT_ARR: string;
  IS_REALTIME: string;
  EVENT_TIME: string;
}

// MARTA's error envelope, returned instead of the arrivals array (e.g. on a
// bad key: HTTP 400 {"ErrorCode":"400","ErrorMessage":"Bad Request",
// "ErrorDetails":"Invalid API Key"}).
interface RawError {
  ErrorCode?: string;
  ErrorMessage?: string;
  ErrorDetails?: string;
}

// Migrated Oct 2026 (#105): the old :18096 endpoint was retired. The new feed
// dropped TRIP_ID, HAS_STARTED_TRIP and IS_FIRST_STOP; everything else matches.
const API_URL =
  "https://developerservices.itsmarta.com/mcsmrail/itsmarta/railrealtimearrivals/developerservices/traindata";
const API_KEY = process.env.MARTA_API_KEY || "";

// Single cache entry holds either a successful response OR the most recent
// failure. Both kinds honor the same TTL, so an API outage doesn't get
// hammered every request — we back off and show a stable error until TTL
// expires. We never serve data older than MAX_STALE_MS: cached waitSeconds go
// stale fast (countdowns into the past = misleading UX), and the cache only
// refreshes on demand, so after a quiet stretch it can be minutes old.
type CacheEntry =
  | { kind: "ok"; data: RailArrival[]; ts: number }
  | { kind: "err"; error: string; ts: number };

let cache: CacheEntry | null = null;
// When the most recent *successful* fetch happened. Kept separately so that
// during an outage the freshness pill keeps counting up from the last real
// data instead of resetting to "live" on every cached error.
let lastOkTs: number | null = null;
// TTL sits just under the client's 10s poll interval so each poll actually
// triggers a refresh (via stale-while-revalidate) instead of redundantly
// re-serving the same cached bytes. 9s leaves slack for small clock skew.
const CACHE_TTL = 9_000;
// Between CACHE_TTL and MAX_STALE_MS we serve the cached value and refresh in
// the background (stale-while-revalidate). Past MAX_STALE_MS — e.g. the first
// request after nobody has hit the site for a while, typically someone opening
// the PWA on a platform — the caller waits for a real refresh (bounded by the
// 4s fetch timeout) rather than getting minutes-old ETAs.
const MAX_STALE_MS = 20_000;
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
  // Slightly stale: kick off (or piggyback on) a background refresh, keep
  // serving the current cached value (empty array if we previously errored).
  if (cache && now - cache.ts < MAX_STALE_MS) {
    refresh().catch(() => {});
    return cache.kind === "ok" ? cache.data : [];
  }
  // Too stale, or cold start: wait for the shared refresh. On failure return
  // [] — the failure is cached, so RailApiBanner shows the error instead of
  // old ETAs masquerading as live.
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
    const details = errorDetails(await resp.json().catch(() => null));
    cache = {
      kind: "err",
      error: `MARTA rail API returned HTTP ${resp.status}${details ? ` (${details})` : ""}`,
      ts,
    };
    throw new Error(`Rail API ${resp.status}`);
  }
  let raw: unknown;
  try {
    raw = await resp.json();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    cache = { kind: "err", error: `MARTA rail API returned a bad response (${msg})`, ts };
    throw e;
  }
  // Anything but an array (e.g. an error envelope served with HTTP 200) would
  // otherwise blow up in .map() below without caching the error, leaving the
  // banner blank and retrying MARTA on every request.
  if (!Array.isArray(raw)) {
    const details = errorDetails(raw);
    cache = {
      kind: "err",
      error: `MARTA rail API returned an unexpected response${details ? ` (${details})` : ""}`,
      ts,
    };
    throw new Error("Rail API unexpected response");
  }

  const data = (raw as RawArrival[]).map((r) => ({
    station: r.STATION,
    line: r.LINE as RailArrival["line"],
    destination: r.DESTINATION,
    direction: r.DIRECTION,
    waitSeconds: parseInt(r.WAITING_SECONDS) || 0,
    waitTime: r.WAITING_TIME,
    trainId: r.TRAIN_ID,
    nextArr: r.NEXT_ARR,
    isRealtime: r.IS_REALTIME === "true",
    eventTime: r.EVENT_TIME,
  }));

  cache = { kind: "ok", data, ts };
  lastOkTs = ts;
  return data;
}

// Pull a human-readable reason out of MARTA's error envelope, if present.
function errorDetails(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const e = body as RawError;
  const d = e.ErrorDetails || e.ErrorMessage;
  return typeof d === "string" && d ? d : null;
}

// Current cached error message, or null if the last cached result was a success
// (or there's no cache yet).
export function getRailApiError(): string | null {
  return cache?.kind === "err" ? cache.error : null;
}

// When rail data was last successfully fetched from MARTA (ms epoch), or null
// if nothing has been fetched yet. Rendered to the client so its freshness
// indicator reflects the real age of the data, not when the page arrived.
export function getArrivalsTimestamp(): number | null {
  return lastOkTs;
}

// Test hook: module-level cache state otherwise leaks between tests.
export function __resetForTests(): void {
  cache = null;
  lastOkTs = null;
  inflight = null;
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

