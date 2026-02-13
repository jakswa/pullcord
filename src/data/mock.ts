// Mock data for screenshots/testing when no buses are running

export function getMockVehicles(routeId: string, stops: any[], headsigns?: Record<number, string>) {
  if (!stops || stops.length === 0) return [];
  
  const dir0 = stops.filter((s: any) => (s.direction_id ?? s.direction) === 0);
  const dir1 = stops.filter((s: any) => (s.direction_id ?? s.direction) === 1);
  const stopsDir0 = dir0.length > 0 ? dir0 : stops;
  
  const outboundName = headsigns?.[0] || "Outbound";
  const inboundName = headsigns?.[1] || "Inbound";
  
  const now = Math.floor(Date.now() / 1000);
  const busPositions = [
    { offset: 0.2, stale: 12, bearing: 180, id: "1401", dir: 0 },
    { offset: 0.5, stale: 28, bearing: 195, id: "1823", dir: 0 },
    { offset: 0.8, stale: 65, bearing: 15, id: "1607", dir: 1 },
  ];
  
  return busPositions.map((bp, i) => {
    const useStops = bp.dir === 1 && dir1.length > 0 ? dir1 : stopsDir0;
    const stopIdx = Math.floor(bp.offset * (useStops.length - 1));
    const stop = useStops[stopIdx] || useStops[0];
    const jitter = (i - 1) * 0.001;
    const sLat = stop.stop_lat ?? stop.lat ?? 33.749;
    const sLon = stop.stop_lon ?? stop.lon ?? -84.388;
    return {
      id: bp.id,
      vehicleId: `v${bp.id}`,
      lat: sLat + jitter,
      lon: sLon + jitter * 0.8,
      bearing: bp.bearing,
      speed: i === 2 ? 0 : 8 + i * 4,
      headsign: bp.dir === 0 ? outboundName : inboundName,
      tripId: `trip_mock_${i}`,
      directionId: bp.dir,
      timestamp: now - bp.stale,
      staleSeconds: bp.stale,
    };
  });
}

export function getMockPredictions(routeId: string, stopId: string, stops: any[], headsigns?: Record<number, string>) {
  const outbound = headsigns?.[0] || "Outbound";
  const inbound = headsigns?.[1] || "Inbound";
  
  return [
    {
      headsign: outbound,
      directionId: 0,
      etaSeconds: 180,
      vehicleId: "v1401",
      tripId: "trip_mock_0",
      staleSeconds: 12,
      tier: "active",
    },
    {
      headsign: inbound,
      directionId: 1,
      etaSeconds: 420,
      vehicleId: "v1607",
      tripId: "trip_mock_2",
      staleSeconds: 65,
      tier: "active",
    },
    {
      headsign: outbound,
      directionId: 0,
      etaSeconds: 840,
      vehicleId: "v1823",
      tripId: "trip_mock_1",
      staleSeconds: 28,
      tier: "active",
    },
    {
      headsign: outbound,
      directionId: 0,
      etaSeconds: 2100,
      vehicleId: "v1823",
      tripId: "trip_mock_3",
      staleSeconds: 28,
      tier: "next",
    },
    {
      headsign: inbound,
      directionId: 1,
      etaSeconds: 3600,
      vehicleId: null,
      tripId: null,
      staleSeconds: 0,
      tier: "scheduled",
    },
  ];
}
