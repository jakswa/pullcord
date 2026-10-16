// Drop shape points closer than ~minMeters to the last kept point, and round
// to 5 decimals (~1m). GTFS shapes can run to 20k+ points; this keeps the
// route-map payload small without visibly changing the line.
export function thinShape(points: Array<[number, number]>, minMeters = 12): Array<[number, number]> {
  if (points.length <= 2) return points.map(([la, lo]) => [round5(la), round5(lo)]);
  const DEG_M = 111_320;
  const min2 = minMeters * minMeters;
  const out: Array<[number, number]> = [];
  let last = points[0];
  out.push([round5(last[0]), round5(last[1])]);
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const dy = (p[0] - last[0]) * DEG_M;
    const dx = (p[1] - last[1]) * DEG_M * Math.cos((p[0] * Math.PI) / 180);
    if (dx * dx + dy * dy >= min2) {
      out.push([round5(p[0]), round5(p[1])]);
      last = p;
    }
  }
  const end = points[points.length - 1];
  out.push([round5(end[0]), round5(end[1])]);
  return out;
}

function round5(n: number): number {
  return Math.round(n * 1e5) / 1e5;
}
