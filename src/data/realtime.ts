import { load } from "protobufjs";
import path from "path";
import { getScheduledArrivals, getStopIdsByName, getTripStopSequences, type Trip } from "./db";
import { computeETA, parseTimeToSec, type TripStop } from "./eta";

const VEHICLE_POSITIONS_URL = "https://gtfs-rt.itsmarta.com/TMGTFSRealTimeWebService/vehicle/vehiclepositions.pb";
const TRIP_UPDATES_URL = "https://gtfs-rt.itsmarta.com/TMGTFSRealTimeWebService/tripupdate/tripupdates.pb";
const CACHE_DURATION = 30 * 1000; // 30 seconds
const STALE_SERVE_LIMIT = 90 * 1000; // serve stale up to 90s while refreshing

interface VehiclePosition {
  id: string;         // entity.id = vehicle label (display ID)
  vehicleId: string;  // vehicle.vehicle.id (internal, matches trip updates)
  lat: number;
  lon: number;
  bearing?: number;
  speed?: number;
  tripId: string;
  headsign?: string;
  directionId?: number;
  staleSeconds: number;
}

// Legacy type — kept for backward compatibility. Identical to ArrivalPrediction.
interface PredictionUpdate {
  vehicleId?: string;
  tripId?: string;
  headsign?: string;
  directionId?: number;
  etaSeconds: number;
  staleSeconds: number;
  tier?: string;
  adherenceSec?: number | null; // positive = late, negative = early, null = unknown
}

// Unified prediction type returned by findArrivals()
interface ArrivalPrediction {
  vehicleId?: string;
  tripId?: string;
  headsign?: string;
  directionId?: number;
  etaSeconds: number;
  staleSeconds: number;
  tier?: string;
  adherenceSec?: number | null;
  etaSource?: 'marta' | 'computed'; // 'computed' = vehicle position + schedule deltas
  martaEtaSeconds?: number; // original MARTA ETA before computed override (for comparison)
  rescued?: boolean; // true = ghost vehicle rescue (no valid MARTA trip update existed)
  // Route enrichment — present when routeInfo provided
  routeId?: string;
  routeShortName?: string;
  routeColor?: string;
}

interface FindArrivalsOptions {
  stopId: string;
  tripLookup: Map<string, Trip>;
  routeFilter?: Set<string>;  // only include these route IDs (undefined = all in tripLookup)
  routeInfo?: Map<string, { route_short_name: string; route_color: string }>;
  vehicles?: VehiclePosition[];  // provide for tier classification
}

interface CachedData<T> {
  data: T;
  timestamp: number;
}

class RealtimeDataService {
  // protobufjs Root type is deeply nested/recursive and not worth wrapping
  private protoRoot: any = null;
  private vehicleCache: CachedData<any[]> | null = null;
  private tripUpdatesCache: CachedData<any[]> | null = null;
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.MARTA_API_KEY!;
    if (!this.apiKey) {
      throw new Error("MARTA_API_KEY is required in environment");
    }
  }

  private async loadProtoDefinitions() {
    if (!this.protoRoot) {
      const protoPath = path.join(process.cwd(), "gtfs-realtime.proto");
      this.protoRoot = await load(protoPath);
    }
    return this.protoRoot;
  }

  private async fetchProtobufData(url: string): Promise<any[]> {
    const response = await fetch(`${url}?apiKey=${this.apiKey}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const protoRoot = await this.loadProtoDefinitions();
    const FeedMessage = protoRoot.lookupType("transit_realtime.FeedMessage");
    const message = FeedMessage.decode(new Uint8Array(buffer));
    
    return message.entity || [];
  }

  private isCacheValid<T>(cache: CachedData<T> | null): boolean {
    if (!cache) return false;
    return Date.now() - cache.timestamp < CACHE_DURATION;
  }

  private isCacheServable<T>(cache: CachedData<T> | null): boolean {
    if (!cache) return false;
    return Date.now() - cache.timestamp < STALE_SERVE_LIMIT;
  }

  // Flags to prevent duplicate concurrent fetches
  private vehicleFetching = false;
  private tripUpdatesFetching = false;

  private async getVehiclePositions(): Promise<any[]> {
    if (this.isCacheValid(this.vehicleCache)) {
      return this.vehicleCache!.data;
    }

    // Stale-while-revalidate: serve stale, refresh in background
    if (this.isCacheServable(this.vehicleCache) && !this.vehicleFetching) {
      this.vehicleFetching = true;
      this.fetchProtobufData(VEHICLE_POSITIONS_URL).then(entities => {
        this.vehicleCache = { data: entities, timestamp: Date.now() };
        this.vehicleFetching = false;
      }).catch((err) => { console.error('Vehicle fetch failed:', err); this.vehicleFetching = false; });
      return this.vehicleCache!.data;
    }

    const entities = await this.fetchProtobufData(VEHICLE_POSITIONS_URL);
    this.vehicleCache = { data: entities, timestamp: Date.now() };
    return entities;
  }

  async getTripUpdates(): Promise<any[]> {
    if (this.isCacheValid(this.tripUpdatesCache)) {
      return this.tripUpdatesCache!.data;
    }

    // Stale-while-revalidate: serve stale, refresh in background
    if (this.isCacheServable(this.tripUpdatesCache) && !this.tripUpdatesFetching) {
      this.tripUpdatesFetching = true;
      this.fetchProtobufData(TRIP_UPDATES_URL).then(entities => {
        this.tripUpdatesCache = { data: entities, timestamp: Date.now() };
        this.tripUpdatesFetching = false;
      }).catch((err) => { console.error('Trip updates fetch failed:', err); this.tripUpdatesFetching = false; });
      return this.tripUpdatesCache!.data;
    }

    const entities = await this.fetchProtobufData(TRIP_UPDATES_URL);
    this.tripUpdatesCache = { data: entities, timestamp: Date.now() };
    return entities;
  }

  async getVehicles(routeId: string, tripLookup: Map<string, Trip>): Promise<VehiclePosition[]> {
    const entities = await this.getVehiclePositions();
    const timestamp = Date.now();

    return entities
      .filter(entity => {
        if (!entity.vehicle?.trip?.tripId || !entity.vehicle?.position) return false;
        const trip = tripLookup.get(entity.vehicle.trip.tripId);
        return trip?.route_id === routeId;
      })
      .map(entity => {
        const vehicle = entity.vehicle;
        const trip = tripLookup.get(vehicle.trip.tripId);
        
        // Calculate staleness
        const vehicleTimestamp = vehicle.timestamp ? parseInt(vehicle.timestamp) * 1000 : timestamp;
        const staleSeconds = Math.floor((timestamp - vehicleTimestamp) / 1000);

        // MARTA pre-assigns buses to their next trip before they reach its first stop.
        // When that happens, the static trip headsign is the NEXT destination,
        // but the bus is still physically heading to the start point.
        // Use the realtime direction_id from the protobuf as ground truth.
        const realtimeDirectionId = vehicle.trip.directionId;
        const staticDirectionId = trip?.direction_id;
        
        let headsign = trip?.trip_headsign || "Unknown Destination";
        let directionId = staticDirectionId;
        
        // If realtime and static disagree on direction, the bus is likely
        // heading to the start of its next trip. Find the correct headsign
        // for the realtime direction.
        if (realtimeDirectionId !== undefined && staticDirectionId !== undefined && 
            realtimeDirectionId !== staticDirectionId) {
          // Look up any trip with the realtime direction to get the right headsign
          for (const [, t] of tripLookup) {
            if (t.route_id === routeId && t.direction_id === realtimeDirectionId) {
              headsign = t.trip_headsign + " (returning)";
              directionId = realtimeDirectionId;
              break;
            }
          }
        }

        return {
          id: entity.id,
          vehicleId: vehicle.vehicle?.id || entity.id,
          lat: vehicle.position.latitude,
          lon: vehicle.position.longitude,
          bearing: vehicle.position.bearing || undefined,
          speed: vehicle.position.speed || undefined,
          tripId: vehicle.trip.tripId,
          headsign,
          directionId,
          staleSeconds
        };
      });
  }

}

// ─────────────────────────────────────
// SHARED CORE: findArrivals()
// Single function for all prediction paths — single-route, multi-route, with or without tiers.
// Handles: paired stops, ETA, staleness, adherence, dedup, tier classification.
// ─────────────────────────────────────

// Compute schedule adherence: positive = late, negative = early
// Returns null if delta is unreasonable (>30 min, likely midnight edge case)
function computeAdherenceSec(rtArrivalSec: number, scheduledTimeStr: string): number | null {
  const parts = scheduledTimeStr.split(':').map(Number);
  if (parts.length < 2) return null;
  const [h, m, s] = [parts[0], parts[1], parts[2] || 0];
  const schedTotalSec = h * 3600 + m * 60 + s;

  // Determine service midnight from the RT arrival date
  const rtDate = new Date(rtArrivalSec * 1000);
  const todayMidnightSec = new Date(rtDate.getFullYear(), rtDate.getMonth(), rtDate.getDate()).getTime() / 1000;

  // GTFS times >= 24:00:00 mean the service day started yesterday
  const serviceMidnightSec = h >= 24 ? todayMidnightSec - 86400 : todayMidnightSec;
  const scheduledSec = serviceMidnightSec + schedTotalSec;
  const delta = Math.round(rtArrivalSec - scheduledSec);

  // Cap at ±30 min — anything beyond is likely a data edge case
  if (Math.abs(delta) > 1800) return null;
  return delta;
}

// Singleton instance
const realtimeService = new RealtimeDataService();

async function findArrivals(opts: FindArrivalsOptions): Promise<ArrivalPrediction[]> {
  const { stopId, tripLookup, routeFilter, routeInfo, vehicles } = opts;

  // Paired stop resolution — one place, every path
  const allStopIds = new Set(getStopIdsByName(stopId));

  const entities = await realtimeService.getTripUpdates();
  const timestamp = Date.now();

  // Vehicle lookup for tier classification (when vehicles provided)
  let activeVehicleIds: Set<string> | undefined;
  let activeTripIds: Set<string> | undefined;
  if (vehicles) {
    activeVehicleIds = new Set(vehicles.map(v => v.vehicleId));
    activeTripIds = new Set(vehicles.map(v => v.tripId));
  }

  const arrivals: (ArrivalPrediction & { _rtArrivalSec?: number })[] = [];

  for (const entity of entities) {
    if (!entity.tripUpdate?.trip?.tripId) continue;

    const tripId = entity.tripUpdate.trip.tripId;
    const trip = tripLookup.get(tripId);
    if (!trip) continue;

    // Route filter
    if (routeFilter && !routeFilter.has(trip.route_id)) continue;

    const stopTimeUpdates = entity.tripUpdate.stopTimeUpdate || [];
    for (const stu of stopTimeUpdates) {
      if (!allStopIds.has(stu.stopId)) continue;

      const timeUpdate = stu.arrival || stu.departure;
      if (!timeUpdate?.time) continue;

      const rtArrivalSec = parseInt(timeUpdate.time);
      const etaTimestamp = rtArrivalSec * 1000;
      const rawEtaSeconds = Math.floor((etaTimestamp - timestamp) / 1000);

      // Skip predictions more than 2 minutes past due — bus likely already passed
      if (rawEtaSeconds < -120) continue;

      const etaSeconds = Math.max(0, rawEtaSeconds);
      const updateTimestamp = entity.tripUpdate.timestamp
        ? parseInt(entity.tripUpdate.timestamp) * 1000 : timestamp;
      const staleSeconds = Math.floor((timestamp - updateTimestamp) / 1000);

      const vehicleId = entity.tripUpdate.vehicle?.id || undefined;

      // Tier classification (when vehicle positions available)
      let tier: string | undefined;
      if (activeVehicleIds && activeTripIds) {
        if (vehicleId && activeVehicleIds.has(vehicleId) && activeTripIds.has(tripId)) {
          tier = 'active';
        } else if (vehicleId && activeVehicleIds.has(vehicleId)) {
          tier = 'next';
        } else {
          tier = 'scheduled';
        }
      }

      const arrival: ArrivalPrediction & { _rtArrivalSec?: number } = {
        headsign: trip.trip_headsign || 'Unknown Destination',
        directionId: trip.direction_id,
        vehicleId,
        tripId,
        etaSeconds,
        staleSeconds,
        tier,
        _rtArrivalSec: rtArrivalSec,
      };

      // Route enrichment (multi-route mode)
      if (routeInfo) {
        const ri = routeInfo.get(trip.route_id);
        arrival.routeId = trip.route_id;
        arrival.routeShortName = ri?.route_short_name;
        arrival.routeColor = ri?.route_color;
      }

      arrivals.push(arrival);
    }
  }

  // Batch adherence lookup
  const tripIds = arrivals.map(a => a.tripId).filter(Boolean) as string[];
  if (tripIds.length > 0) {
    const scheduled = getScheduledArrivals(stopId, tripIds);
    for (const arr of arrivals) {
      if (arr.tripId && arr._rtArrivalSec) {
        const schedTime = scheduled.get(arr.tripId);
        if (schedTime) {
          arr.adherenceSec = computeAdherenceSec(arr._rtArrivalSec, schedTime);
        }
      }
      delete arr._rtArrivalSec;
    }
  }

  // Unified active-tier ETA: for ALL vehicles with GPS positions, compute ETA from
  // vehicle position + scheduled inter-stop deltas. Updates existing MARTA predictions
  // (preserving martaEtaSeconds) or synthesizes new ones for ghost vehicles (rescued: true).
  if (vehicles && vehicles.length > 0) {
    const existingByTrip = new Map(
      arrivals.filter(a => a.tripId).map(a => [a.tripId!, a])
    );

    // One batch query for all vehicle trip stop sequences
    const allVehicleTripIds = vehicles
      .filter(v => v.tripId && v.vehicleId)
      .map(v => v.tripId);
    const tripStopSeqs = allVehicleTripIds.length > 0
      ? getTripStopSequences(allVehicleTripIds) : new Map();

    for (const veh of vehicles) {
      if (!veh.tripId || !veh.vehicleId) continue;

      const rawStops = tripStopSeqs.get(veh.tripId);
      if (!rawStops) continue;

      // For rescue candidates, verify trip serves our target stops
      const existing = existingByTrip.get(veh.tripId);
      if (!existing && !rawStops.some(s => allStopIds.has(s.stop_id))) continue;

      const tripStops: TripStop[] = rawStops.map(s => ({
        stop_id: s.stop_id,
        lat: s.lat,
        lon: s.lon,
        sequence: s.sequence,
        arrivalSec: parseTimeToSec(s.arrival_time),
      }));

      const eta = computeETA(veh.lat, veh.lon, tripStops, allStopIds, veh.staleSeconds);
      if (eta === null) continue;

      if (existing && existing.tier === 'active') {
        // Override existing MARTA prediction with computed ETA
        existing.martaEtaSeconds = existing.etaSeconds;
        existing.etaSeconds = eta;
        existing.etaSource = 'computed';
      } else if (!existing) {
        // Ghost vehicle rescue — synthesize prediction
        const trip = tripLookup.get(veh.tripId);
        if (!trip) continue;
        if (routeFilter && !routeFilter.has(trip.route_id)) continue;

        const arrival: ArrivalPrediction = {
          headsign: trip.trip_headsign || 'Unknown Destination',
          directionId: trip.direction_id,
          vehicleId: veh.vehicleId,
          tripId: veh.tripId,
          etaSeconds: eta,
          staleSeconds: veh.staleSeconds,
          tier: 'active',
          etaSource: 'computed',
          rescued: true,
        };

        if (routeInfo) {
          const ri = routeInfo.get(trip.route_id);
          arrival.routeId = trip.route_id;
          arrival.routeShortName = ri?.route_short_name;
          arrival.routeColor = ri?.route_color;
        }

        arrivals.push(arrival);
      }
    }
  }

  // Dedup by tripId (paired stops can match same trip from both directions)
  const seen = new Set<string>();
  const deduped = arrivals.filter(a => {
    if (!a.tripId || !seen.has(a.tripId)) {
      if (a.tripId) seen.add(a.tripId);
      return true;
    }
    return false;
  });

  // Drop stale "next" tier predictions where the bus already passed
  // (etaSeconds clamped to 0 means the scheduled arrival is in the past)
  const filtered = deduped.filter(a => !(a.tier === 'next' && a.etaSeconds < 60));

  filtered.sort((a, b) => a.etaSeconds - b.etaSeconds);
  return filtered;
}

// ─────────────────────────────────────
// PUBLIC API — thin wrappers over findArrivals()
// ─────────────────────────────────────

export async function getVehicles(routeId: string, tripLookup: Map<string, Trip>): Promise<VehiclePosition[]> {
  return realtimeService.getVehicles(routeId, tripLookup);
}

// Single-route predictions (no tier classification — use findArrivals directly for tiers)
export async function getPredictions(routeId: string, stopId: string, tripLookup: Map<string, Trip>): Promise<PredictionUpdate[]> {
  return findArrivals({
    stopId,
    tripLookup,
    routeFilter: new Set([routeId]),
  });
}

// Multi-route arrivals for a stop
export interface StopArrival extends PredictionUpdate {
  routeId: string;
  routeShortName: string;
  routeColor: string;
}

export async function getStopArrivals(
  stopId: string,
  routes: Array<{ route_id: string; route_short_name: string; route_color: string }>,
  tripLookup: Map<string, Trip>
): Promise<StopArrival[]> {
  const routeInfo = new Map(
    routes.map(r => [r.route_id, { route_short_name: r.route_short_name, route_color: r.route_color }])
  );

  // Fetch vehicles for all routes at this stop so tier classification works
  const allVehicles: VehiclePosition[] = [];
  for (const route of routes) {
    const v = await realtimeService.getVehicles(route.route_id, tripLookup);
    allVehicles.push(...v);
  }

  const arrivals = await findArrivals({
    stopId,
    tripLookup,
    routeFilter: new Set(routes.map(r => r.route_id)),
    routeInfo,
    vehicles: allVehicles,
  });
  return arrivals as StopArrival[];
}

// Direct access to the shared core — for callers that need tier classification or custom options
export { findArrivals };

export type { VehiclePosition, PredictionUpdate, ArrivalPrediction };