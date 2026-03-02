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
  // We can't interpolate GPS (layover time is unknowable), but we know the
  // scheduled travel time from terminal to target stop. Use that as the ETA —
  // it represents the minimum time once the bus departs.
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
