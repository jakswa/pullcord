import { describe, test, expect } from 'bun:test';
import { computeETA, parseTimeToSec, type TripStop } from '../src/data/eta';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a sequence of stops along a north-south line in downtown Atlanta. */
function makeStops(count: number, opts?: {
  baseLat?: number;
  baseLon?: number;
  latStep?: number;
  baseArrival?: number;  // seconds since midnight
  arrivalStep?: number;  // seconds between stops
}): TripStop[] {
  const {
    baseLat = 33.749,
    baseLon = -84.388,
    latStep = 0.003,        // ~330 m between stops
    baseArrival = 28800,    // 08:00:00
    arrivalStep = 180,      // 3 minutes between stops
  } = opts ?? {};

  return Array.from({ length: count }, (_, i) => ({
    stop_id: `STOP_${i}`,
    lat: baseLat + i * latStep,
    lon: baseLon,
    sequence: i + 1,
    arrivalSec: baseArrival + i * arrivalStep,
  }));
}

// Extract .eta from ETAResult for convenience
function etaOrNull(result: ReturnType<typeof computeETA>): number | null {
  return result?.eta ?? null;
}

// Five stops, 3 min apart, heading north from Five Points
const STOPS = makeStops(5);
// STOP_0: 33.749, arrival 28800 (08:00)
// STOP_1: 33.752, arrival 28980 (08:03)
// STOP_2: 33.755, arrival 29160 (08:06)
// STOP_3: 33.758, arrival 29340 (08:09)
// STOP_4: 33.761, arrival 29520 (08:12)

// ---------------------------------------------------------------------------
// parseTimeToSec
// ---------------------------------------------------------------------------

describe('parseTimeToSec', () => {
  test('parses standard HH:MM:SS', () => {
    expect(parseTimeToSec('08:30:00')).toBe(30600);
    expect(parseTimeToSec('00:00:00')).toBe(0);
    expect(parseTimeToSec('23:59:59')).toBe(86399);
  });

  test('handles GTFS overnight hours (H > 23)', () => {
    // GTFS allows 25:00:00 for 1am the next service day
    expect(parseTimeToSec('25:00:00')).toBe(90000);
    expect(parseTimeToSec('26:30:15')).toBe(95415);
  });

  test('handles single-digit components', () => {
    expect(parseTimeToSec('8:5:3')).toBe(8 * 3600 + 5 * 60 + 3);
  });
});

// ---------------------------------------------------------------------------
// computeETA — normal cases
// ---------------------------------------------------------------------------

describe('computeETA', () => {
  describe('normal interpolation', () => {
    test('vehicle between two stops interpolates segment time', () => {
      // Vehicle halfway between STOP_2 and STOP_3 (avoids layover guard)
      const vLat = (STOPS[2].lat + STOPS[3].lat) / 2; // 33.7565
      const vLon = STOPS[2].lon;
      const target = new Set(['STOP_4']);

      const result = computeETA(vLat, vLon, STOPS, target);
      expect(result).not.toBeNull();

      // Full scheduled delta STOP_2→STOP_4 = 360s (6 min)
      // Minus ~half of segment STOP_2→STOP_3 time (180s * ~0.5 ≈ 90s)
      // Expected ≈ 270s
      expect(result!.eta).toBeGreaterThan(230);
      expect(result!.eta).toBeLessThan(310);
    });

    test('vehicle exactly at a stop returns full scheduled delta', () => {
      // Vehicle at STOP_2, target is STOP_4
      const target = new Set(['STOP_4']);
      const result = computeETA(STOPS[2].lat, STOPS[2].lon, STOPS, target);
      expect(result).not.toBeNull();
      // Delta STOP_2→STOP_4 = 360s. Vehicle at stop, fraction ~0, so eta ≈ 360
      expect(result!.eta).toBe(360);
    });

    test('vehicle at target stop returns 0', () => {
      const target = new Set(['STOP_3']);
      const result = computeETA(STOPS[3].lat, STOPS[3].lon, STOPS, target);
      // nearestIdx == targetIdx == 3, deltaSec = 0
      expect(result!.eta).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Vehicle past the target stop
  // ---------------------------------------------------------------------------

  describe('vehicle past target stop', () => {
    test('returns null when nearest stop is after target', () => {
      // Vehicle at STOP_4, target is STOP_1 → nearestIdx 4 > targetIdx 1
      const target = new Set(['STOP_1']);
      const eta = computeETA(STOPS[4].lat, STOPS[4].lon, STOPS, target);
      expect(eta).toBeNull();
    });

    test('returns null when vehicle is slightly past target', () => {
      // Vehicle just past STOP_2 heading toward STOP_3, target is STOP_2
      const vLat = STOPS[2].lat + 0.002; // closer to STOP_3 than STOP_2
      const target = new Set(['STOP_2']);
      const eta = computeETA(vLat, STOPS[2].lon, STOPS, target);
      // nearestIdx = 3 (closest to STOP_3), targetIdx = 2 → null
      expect(eta).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Vehicle before the first stop
  // ---------------------------------------------------------------------------

  describe('vehicle near start of route', () => {
    test('vehicle at first stop with nearby target returns ETA', () => {
      // nearestIdx=0, targetIdx=2 — within the <=1 && >3 guard
      const target = new Set(['STOP_2']);
      const result = computeETA(STOPS[0].lat, STOPS[0].lon, STOPS, target);
      expect(result).not.toBeNull();
      // Delta STOP_0→STOP_2 = 360s
      expect(result!.eta).toBe(360);
    });

    test('returns terminal estimate when vehicle at terminal and target is far', () => {
      // nearestIdx=0, targetIdx=4 → 0 <= 1 && 4 > 3 → terminal path
      const target = new Set(['STOP_4']);
      const result = computeETA(STOPS[0].lat, STOPS[0].lon, STOPS, target);
      expect(result).not.toBeNull();
      expect(result!.atTerminal).toBe(true);
      expect(result!.eta).toBe(720); // full delta STOP_0→STOP_4
    });

    test('returns terminal estimate when vehicle at stop 1 and target is far', () => {
      // nearestIdx=1, targetIdx=4 → 1 <= 1 && 4 > 3 → terminal path
      const target = new Set(['STOP_4']);
      const result = computeETA(STOPS[1].lat, STOPS[1].lon, STOPS, target);
      expect(result).not.toBeNull();
      expect(result!.atTerminal).toBe(true);
      expect(result!.eta).toBe(720); // full delta STOP_0→STOP_4
    });

    test('vehicle before first stop snaps to nearest (stop 0)', () => {
      // Vehicle south of STOP_0
      const vLat = STOPS[0].lat - 0.001;
      const target = new Set(['STOP_2']);
      const result = computeETA(vLat, STOPS[0].lon, STOPS, target);
      expect(result).not.toBeNull();
      // nearestIdx=0, targetIdx=2 → delta = 360s, plus some interpolation credit
      // fraction of segment 0→1 will be small (vehicle behind stop 0)
      expect(result!.eta).toBeGreaterThanOrEqual(300);
      expect(result!.eta).toBeLessThanOrEqual(360);
    });
  });

  // ---------------------------------------------------------------------------
  // Single-stop and empty sequences
  // ---------------------------------------------------------------------------

  describe('degenerate sequences', () => {
    test('returns null for single-stop sequence', () => {
      const single = makeStops(1);
      const target = new Set(['STOP_0']);
      expect(computeETA(single[0].lat, single[0].lon, single, target)).toBeNull();
    });

    test('returns null for empty stop sequence', () => {
      const target = new Set(['STOP_0']);
      expect(computeETA(33.749, -84.388, [], target)).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Target stop not found
  // ---------------------------------------------------------------------------

  describe('target stop not on trip', () => {
    test('returns null when target stop ID is not in trip', () => {
      const target = new Set(['NONEXISTENT']);
      expect(computeETA(STOPS[2].lat, STOPS[2].lon, STOPS, target)).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Staleness subtraction
  // ---------------------------------------------------------------------------

  describe('staleness', () => {
    test('subtracts staleSeconds from result', () => {
      const target = new Set(['STOP_4']);
      // Use stop 2 position, target stop 4 → base delta 360s
      const fresh = etaOrNull(computeETA(STOPS[2].lat, STOPS[2].lon, STOPS, target, 0))!;
      const stale = etaOrNull(computeETA(STOPS[2].lat, STOPS[2].lon, STOPS, target, 60))!;
      expect(fresh - stale).toBe(60);
    });

    test('clamps to zero when staleness exceeds delta', () => {
      const target = new Set(['STOP_3']);
      // Vehicle at STOP_2, delta = 180s, stale = 300s
      const result = computeETA(STOPS[2].lat, STOPS[2].lon, STOPS, target, 300);
      expect(result!.eta).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Schedule sanity guards
  // ---------------------------------------------------------------------------

  describe('schedule sanity', () => {
    test('returns null for negative arrival delta (data error)', () => {
      // Make stops where target has EARLIER arrival than nearest
      const badStops: TripStop[] = [
        { stop_id: 'A', lat: 33.749, lon: -84.388, sequence: 1, arrivalSec: 30000 },
        { stop_id: 'B', lat: 33.752, lon: -84.388, sequence: 2, arrivalSec: 29000 },
      ];
      const target = new Set(['B']);
      expect(computeETA(badStops[0].lat, badStops[0].lon, badStops, target)).toBeNull();
    });

    test('returns null for huge delta > 2 hours', () => {
      const farStops: TripStop[] = [
        { stop_id: 'A', lat: 33.749, lon: -84.388, sequence: 1, arrivalSec: 0 },
        { stop_id: 'B', lat: 33.752, lon: -84.388, sequence: 2, arrivalSec: 7201 },
      ];
      const target = new Set(['B']);
      expect(computeETA(farStops[0].lat, farStops[0].lon, farStops, target)).toBeNull();
    });

    test('accepts delta exactly at 2 hour boundary', () => {
      const borderStops: TripStop[] = [
        { stop_id: 'A', lat: 33.749, lon: -84.388, sequence: 1, arrivalSec: 0 },
        { stop_id: 'B', lat: 33.752, lon: -84.388, sequence: 2, arrivalSec: 7200 },
      ];
      const target = new Set(['B']);
      const eta = computeETA(borderStops[0].lat, borderStops[0].lon, borderStops, target);
      expect(eta).not.toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Grouped stop IDs (targetStopIds as Set)
  // ---------------------------------------------------------------------------

  describe('grouped target stop IDs', () => {
    test('matches any stop ID in the set', () => {
      // Target set contains both a real stop and a fake one
      const target = new Set(['FAKE', 'STOP_3']);
      const result = computeETA(STOPS[2].lat, STOPS[2].lon, STOPS, target);
      expect(result).not.toBeNull();
      expect(result!.eta).toBe(180); // delta STOP_2 → STOP_3
    });

    test('finds first matching stop in sequence', () => {
      // Both STOP_2 and STOP_4 in target set — should use first (STOP_2)
      const target = new Set(['STOP_2', 'STOP_4']);
      const result = computeETA(STOPS[0].lat, STOPS[0].lon, STOPS, target);
      expect(result).not.toBeNull();
      // Should match STOP_2 (idx 2), delta from STOP_0 = 360s
      expect(result!.eta).toBe(360);
    });
  });

  // ---------------------------------------------------------------------------
  // distSq behavior (tested indirectly via nearest-stop selection)
  // ---------------------------------------------------------------------------

  describe('distance calculation (via nearest-stop)', () => {
    test('selects correct nearest stop based on geographic distance', () => {
      // Vehicle clearly closest to STOP_2
      const target = new Set(['STOP_4']);
      // Put vehicle right at STOP_2's lat but offset lon slightly
      const result = computeETA(STOPS[2].lat, STOPS[2].lon + 0.0001, STOPS, target);
      expect(result).not.toBeNull();
      // Should snap to STOP_2, delta = 360s
      expect(result!.eta).toBeGreaterThan(350);
      expect(result!.eta).toBeLessThanOrEqual(360);
    });

    test('cos(lat) correction affects east-west distance differently at different latitudes', () => {
      // At the equator, 1° lon ≈ 1° lat in real distance.
      // At 60°N, 1° lon ≈ 0.5° lat (cos(60°) = 0.5).
      // Same relative geometry → different interpolation fractions.

      // Three east-west stops; vehicle offset in lat between S0 and S1
      const makeEW = (lat: number): TripStop[] => [
        { stop_id: 'S0', lat, lon: 0.0, sequence: 1, arrivalSec: 0 },
        { stop_id: 'S1', lat, lon: 0.02, sequence: 2, arrivalSec: 300 },
        { stop_id: 'S2', lat, lon: 0.04, sequence: 3, arrivalSec: 600 },
      ];

      const target = new Set(['S2']);
      // Vehicle at lon midpoint between S0 and S1, offset 0.005° in lat
      const etaEquator = etaOrNull(computeETA(0.005, 0.01, makeEW(0), target));
      const etaArctic = etaOrNull(computeETA(60.005, 0.01, makeEW(60), target));

      expect(etaEquator).not.toBeNull();
      expect(etaArctic).not.toBeNull();
      // cos(0°)=1.0 vs cos(60°)=0.5 changes how lon-spread is weighted
      // relative to the lat offset, producing different interpolation fractions.
      expect(etaEquator).not.toBe(etaArctic);
    });

    test('identical coordinates yields zero interpolation offset', () => {
      // Vehicle exactly at STOP_2
      const target = new Set(['STOP_3']);
      const result = computeETA(STOPS[2].lat, STOPS[2].lon, STOPS, target);
      // distSq from STOP_2 to vehicle = 0, fraction = 0, no subtraction
      expect(result!.eta).toBe(180);
    });
  });

  // ---------------------------------------------------------------------------
  // Two-stop minimal trip
  // ---------------------------------------------------------------------------

  describe('two-stop trip', () => {
    test('vehicle at first stop returns full delta', () => {
      const twoStops = makeStops(2);
      const target = new Set(['STOP_1']);
      const result = computeETA(twoStops[0].lat, twoStops[0].lon, twoStops, target);
      expect(result!.eta).toBe(180);
    });

    test('vehicle midway interpolates correctly', () => {
      const twoStops = makeStops(2);
      const midLat = (twoStops[0].lat + twoStops[1].lat) / 2;
      const target = new Set(['STOP_1']);
      const result = computeETA(midLat, twoStops[0].lon, twoStops, target);
      expect(result).not.toBeNull();
      // ~half of 180s = ~90s
      expect(result!.eta).toBeGreaterThan(70);
      expect(result!.eta).toBeLessThan(110);
    });
  });
});
