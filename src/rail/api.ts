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

let cache: { data: RailArrival[]; ts: number } | null = null;
const CACHE_TTL = 8_000; // 8s — API updates ~every 10s

export async function fetchArrivals(): Promise<RailArrival[]> {
  const now = Date.now();
  if (cache && now - cache.ts < CACHE_TTL) return cache.data;

  const resp = await fetch(`${API_URL}?apiKey=${API_KEY}`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!resp.ok) throw new Error(`Rail API ${resp.status}`);
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

  cache = { data, ts: now };
  return data;
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
