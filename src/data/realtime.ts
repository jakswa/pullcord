import { load } from "protobufjs";
import path from "path";
import { getScheduledArrivals } from "./db";

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

interface PredictionUpdate {
  vehicleId?: string;
  tripId?: string;
  headsign?: string;
  directionId?: number;
  etaSeconds: number;
  staleSeconds: number;
  tier?: string;
  adherenceSec?: number; // positive = late, negative = early, null = unknown
}

interface CachedData<T> {
  data: T;
  timestamp: number;
}

class RealtimeDataService {
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
      }).catch(() => { this.vehicleFetching = false; });
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
      }).catch(() => { this.tripUpdatesFetching = false; });
      return this.tripUpdatesCache!.data;
    }

    const entities = await this.fetchProtobufData(TRIP_UPDATES_URL);
    this.tripUpdatesCache = { data: entities, timestamp: Date.now() };
    return entities;
  }

  async getVehicles(routeId: string, tripLookup: Map<string, any>): Promise<VehiclePosition[]> {
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

  async getPredictions(routeId: string, stopId: string, tripLookup: Map<string, any>): Promise<PredictionUpdate[]> {
    const entities = await this.getTripUpdates();
    const timestamp = Date.now();

    // Collect predictions with raw RT arrival timestamps for adherence computation
    const predictions: (PredictionUpdate & { _rtArrivalSec?: number })[] = [];

    for (const entity of entities) {
      if (!entity.tripUpdate?.trip?.tripId) continue;
      
      const tripId = entity.tripUpdate.trip.tripId;
      const trip = tripLookup.get(tripId);
      
      if (trip?.route_id !== routeId) continue;

      const stopTimeUpdates = entity.tripUpdate.stopTimeUpdate || [];
      for (const stu of stopTimeUpdates) {
        if (stu.stopId !== stopId) continue;

        // Use arrival or departure time
        const timeUpdate = stu.arrival || stu.departure;
        if (!timeUpdate?.time) continue;

        const rtArrivalSec = parseInt(timeUpdate.time);
        const etaTimestamp = rtArrivalSec * 1000;
        const etaSeconds = Math.max(0, Math.floor((etaTimestamp - timestamp) / 1000));
        
        // Calculate staleness from trip update timestamp
        const updateTimestamp = entity.tripUpdate.timestamp ? 
          parseInt(entity.tripUpdate.timestamp) * 1000 : timestamp;
        const staleSeconds = Math.floor((timestamp - updateTimestamp) / 1000);

        predictions.push({
          headsign: trip.trip_headsign || "Unknown Destination",
          directionId: trip.direction_id,
          vehicleId: entity.tripUpdate.vehicle?.id || undefined,
          tripId,
          etaSeconds,
          staleSeconds,
          _rtArrivalSec: rtArrivalSec
        });
      }
    }

    // Batch lookup scheduled arrivals and compute adherence
    const tripIds = predictions.map(p => p.tripId).filter(Boolean) as string[];
    if (tripIds.length > 0) {
      const scheduled = getScheduledArrivals(stopId, tripIds);
      for (const pred of predictions) {
        if (pred.tripId && pred._rtArrivalSec) {
          const schedTime = scheduled.get(pred.tripId);
          if (schedTime) {
            pred.adherenceSec = computeAdherenceSec(pred._rtArrivalSec, schedTime);
          }
        }
        delete (pred as any)._rtArrivalSec;
      }
    }

    // Sort by ETA
    predictions.sort((a, b) => a.etaSeconds - b.etaSeconds);
    return predictions;
  }
}

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

// Export async functions that use the singleton
export async function getVehicles(routeId: string, tripLookup: Map<string, any>): Promise<VehiclePosition[]> {
  return realtimeService.getVehicles(routeId, tripLookup);
}

export async function getPredictions(routeId: string, stopId: string, tripLookup: Map<string, any>): Promise<PredictionUpdate[]> {
  return realtimeService.getPredictions(routeId, stopId, tripLookup);
}

// Multi-route arrivals for a stop
export interface StopArrival extends PredictionUpdate {
  routeId: string;
  routeShortName: string;
  routeColor: string;
  adherenceSec?: number;
}

export async function getStopArrivals(
  stopId: string,
  routes: Array<{ route_id: string; route_short_name: string; route_color: string }>,
  tripLookup: Map<string, any>
): Promise<StopArrival[]> {
  const routeMap = new Map(routes.map(r => [r.route_id, r]));
  const entities = await realtimeService.getTripUpdates();
  const timestamp = Date.now();
  const arrivals: (StopArrival & { _rtArrivalSec?: number })[] = [];

  for (const entity of entities) {
    if (!entity.tripUpdate?.trip?.tripId) continue;
    const tripId = entity.tripUpdate.trip.tripId;
    const trip = tripLookup.get(tripId);
    if (!trip || !routeMap.has(trip.route_id)) continue;

    const route = routeMap.get(trip.route_id)!;
    const stopTimeUpdates = entity.tripUpdate.stopTimeUpdate || [];
    for (const stu of stopTimeUpdates) {
      if (stu.stopId !== stopId) continue;
      const timeUpdate = stu.arrival || stu.departure;
      if (!timeUpdate?.time) continue;

      const rtArrivalSec = parseInt(timeUpdate.time);
      const etaTimestamp = rtArrivalSec * 1000;
      const etaSeconds = Math.max(0, Math.floor((etaTimestamp - timestamp) / 1000));
      const updateTimestamp = entity.tripUpdate.timestamp
        ? parseInt(entity.tripUpdate.timestamp) * 1000 : timestamp;
      const staleSeconds = Math.floor((timestamp - updateTimestamp) / 1000);

      arrivals.push({
        headsign: trip.trip_headsign || "Unknown",
        directionId: trip.direction_id,
        vehicleId: entity.tripUpdate.vehicle?.id || undefined,
        tripId,
        etaSeconds,
        staleSeconds,
        routeId: trip.route_id,
        routeShortName: route.route_short_name,
        routeColor: route.route_color,
        _rtArrivalSec: rtArrivalSec
      });
    }
  }

  // Batch lookup scheduled arrivals and compute adherence
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
      delete (arr as any)._rtArrivalSec;
    }
  }

  arrivals.sort((a, b) => a.etaSeconds - b.etaSeconds);
  return arrivals;
}

export type { VehiclePosition, PredictionUpdate };