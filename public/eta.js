// Pure ETA computation — no dependencies.
// Mirrors src/data/eta.ts for client-side use.

/**
 * Parse HH:MM:SS to seconds since midnight. GTFS allows H > 23 for overnight.
 */
function parseTimeToSec(time) {
  const parts = time.split(':').map(Number);
  return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
}

/**
 * Squared distance between two points (comparison only — avoids sqrt).
 * Applies cos(lat) correction to longitude.
 */
function distSq(lat1, lon1, lat2, lon2) {
  const dLat = lat2 - lat1;
  const dLon = (lon2 - lon1) * Math.cos(((lat1 + lat2) / 2) * Math.PI / 180);
  return dLat * dLat + dLon * dLon;
}

/**
 * Compute ETA from a vehicle's current position to a target stop,
 * using scheduled inter-stop deltas from a representative trip.
 *
 * @param {number} vehicleLat
 * @param {number} vehicleLon
 * @param {Array<{id: string, lat: number, lon: number, sequence: number, arrivalSec: number}>} tripStops
 * @param {string} targetStopId - the user's stop ID
 * @param {string} targetStopName - the user's stop name (for paired stop matching)
 * @returns {number|null} seconds until arrival, or null
 */
function computeClientETA(vehicleLat, vehicleLon, tripStops, targetStopId, targetStopName, staleSeconds) {
  if (tripStops.length < 2) return null;

  // Find the target stop index (match by ID or name for paired stops)
  const targetIdx = tripStops.findIndex(s =>
    s.id === targetStopId || s.name === targetStopName
  );
  if (targetIdx === -1) return null;

  // Find nearest stop to vehicle
  let nearestIdx = 0;
  let nearestDist = Infinity;
  for (let i = 0; i < tripStops.length; i++) {
    const d = distSq(vehicleLat, vehicleLon, tripStops[i].lat, tripStops[i].lon);
    if (d < nearestDist) {
      nearestDist = d;
      nearestIdx = i;
    }
  }

  // Bus past our stop
  if (nearestIdx > targetIdx) return null;

  // Bus at terminal (first stop) — waiting to depart, fall back to MARTA
  if (nearestIdx <= 1 && targetIdx > 3) return null;

  // Scheduled delta
  const deltaSec = tripStops[targetIdx].arrivalSec - tripStops[nearestIdx].arrivalSec;
  if (deltaSec < 0 || deltaSec > 7200) return null;

  let eta = deltaSec;

  // Interpolate within current segment
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
      const fraction = Math.min(1, Math.sqrt(busDist / segDist));
      const segTime = tripStops[nearestIdx + 1].arrivalSec - tripStops[nearestIdx].arrivalSec;
      eta -= fraction * segTime;
    }
  }

  // Subtract position staleness — bus has been moving since GPS reading
  eta -= (staleSeconds || 0);

  return Math.max(0, Math.round(eta));
}
