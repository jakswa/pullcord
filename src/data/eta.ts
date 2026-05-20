// Pure ETA computation — no I/O, no dependencies.
// Used server-side in findArrivals() and client-side in app.js.

export interface TripStop {
  stop_id: string;
  lat: number;
  lon: number;
  sequence: number;
  arrivalSec: number; // seconds since midnight from schedule
}

/**
 * Parse HH:MM:SS (GTFS allows H > 23 for overnight trips) to seconds since midnight.
 */
export function parseTimeToSec(time: string): number {
  const parts = time.split(':').map(Number);
  return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
}

/**
 * Squared distance between two points (for comparison only — avoids sqrt).
 */
function distSq(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = lat2 - lat1;
  const dLon = (lon2 - lon1) * Math.cos(((lat1 + lat2) / 2) * Math.PI / 180);
  return dLat * dLat + dLon * dLon;
}

export interface ETAResult {
  eta: number;          // seconds until arrival
  atTerminal: boolean;  // true = vehicle at terminal, ETA is from schedule not GPS
}

/**
 * Compute ETA from a vehicle's current position to a target stop,
 * using scheduled inter-stop deltas from a representative trip.
 *
 * Returns ETAResult, or null if we can't compute
 * (bus past stop, stop not on trip, etc).
 *
 * When a vehicle is at its terminal (first stop, waiting to depart),
 * returns the GTFS scheduled arrival time instead of interpolated GPS ETA.
 */
export function computeETA(
  vehicleLat: number,
  vehicleLon: number,
  tripStops: TripStop[],
  targetStopIds: Set<string>, // grouped stop IDs (paired directions)
  staleSeconds: number = 0, // vehicle position age — subtracted from result
): ETAResult | null {
  if (tripStops.length < 2) return null;

  // Find the target stop index
  const targetIdx = tripStops.findIndex(s => targetStopIds.has(s.stop_id));
  if (targetIdx === -1) return null;

  // Find nearest stop to vehicle (by distance)
  let nearestIdx = 0;
  let nearestDist = Infinity;
  for (let i = 0; i < tripStops.length; i++) {
    const d = distSq(vehicleLat, vehicleLon, tripStops[i].lat, tripStops[i].lon);
    if (d < nearestDist) {
      nearestDist = d;
      nearestIdx = i;
    }
  }

  // Bus is past our stop — already served
  if (nearestIdx > targetIdx) return null;

  // Bus is at/near the first stop (terminal) — likely waiting to depart.
  // We know the minimum travel time from terminal to target stop, but NOT
  // when the bus will actually depart (could be on time, could be late).
  // Return the travel delta as a floor estimate. UI should show "X+ min"
  // to indicate this is a minimum, not a countdown.
  if (nearestIdx <= 1 && targetIdx > 3) {
    const travelDelta = tripStops[targetIdx].arrivalSec - tripStops[0].arrivalSec;
    if (travelDelta > 0 && travelDelta <= 7200) {
      return { eta: travelDelta, atTerminal: true };
    }
    return null;
  }

  // Scheduled delta between nearest stop and target stop
  const deltaSec = tripStops[targetIdx].arrivalSec - tripStops[nearestIdx].arrivalSec;

  // Sanity: negative or huge deltas are data errors
  if (deltaSec < 0 || deltaSec > 7200) return null; // >2h is nonsensical

  let eta = deltaSec;

  // Interpolate within current segment.
  // If bus is between stops[nearestIdx] and stops[nearestIdx+1],
  // estimate fraction covered and subtract from delta.
  if (nearestIdx < tripStops.length - 1 && nearestIdx < targetIdx) {
    const segDist = distSq(
      tripStops[nearestIdx].lat, tripStops[nearestIdx].lon,
      tripStops[nearestIdx + 1].lat, tripStops[nearestIdx + 1].lon
    );
    if (segDist > 0) {
      const busDist = distSq(
        tripStops[nearestIdx].lat, tripStops[nearestIdx].lon,
        vehicleLat, vehicleLon
      );
      // Use sqrt for fraction since distSq isn't linear for ratios
      const fraction = Math.min(1, Math.sqrt(busDist / segDist));
      const segTime = tripStops[nearestIdx + 1].arrivalSec - tripStops[nearestIdx].arrivalSec;
      eta -= fraction * segTime;
    }
  }

  // Subtract position staleness — the bus has been moving since the GPS reading
  eta -= staleSeconds;

  return { eta: Math.max(0, Math.round(eta)), atTerminal: false };
}

/**
 * Compute schedule adherence: positive = late, negative = early.
 * Returns null if the delta exceeds ±30 min (likely a data edge case).
 *
 * Works correctly regardless of the server's local timezone by deriving
 * midnight-ET as a Unix timestamp from the ET time-of-day components.
 */
export function computeAdherenceSec(rtArrivalSec: number, scheduledTimeStr: string): number | null {
  const parts = scheduledTimeStr.split(':').map(Number);
  if (parts.length < 2) return null;
  const [h, m, s] = [parts[0], parts[1], parts[2] || 0];
  const schedTotalSec = h * 3600 + m * 60 + s;

  // Determine service midnight from the RT arrival date in Eastern time
  // (GTFS schedule times are in America/New_York; server may be UTC on Fly.io)
  const rtDate = new Date(rtArrivalSec * 1000);
  const etNow = new Date(rtDate.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const elapsedSinceETMidnight = etNow.getHours() * 3600 + etNow.getMinutes() * 60 + etNow.getSeconds();
  const todayMidnightSec = rtArrivalSec - elapsedSinceETMidnight;

  // GTFS times >= 24:00:00 mean the service day started yesterday
  const serviceMidnightSec = h >= 24 ? todayMidnightSec - 86400 : todayMidnightSec;
  const scheduledSec = serviceMidnightSec + schedTotalSec;
  const delta = Math.round(rtArrivalSec - scheduledSec);

  // Cap at ±30 min — anything beyond is likely a data edge case
  if (Math.abs(delta) > 1800) return null;
  return delta;
}
