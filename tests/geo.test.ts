import { describe, expect, test } from "bun:test";
import { thinShape } from "../src/data/geo";

describe("thinShape", () => {
  test("keeps endpoints and drops points closer than the threshold", () => {
    // ~1.1m steps along a meridian; 12m threshold keeps roughly every 11th
    const pts: Array<[number, number]> = Array.from({ length: 101 }, (_, i) => [33.7 + i * 0.00001, -84.4]);
    const out = thinShape(pts);
    expect(out[0]).toEqual([33.7, -84.4]);
    expect(out[out.length - 1]).toEqual([33.701, -84.4]);
    expect(out.length).toBeGreaterThan(5);
    expect(out.length).toBeLessThan(15);
  });

  test("rounds to 5 decimals and passes short shapes through", () => {
    expect(thinShape([[33.123456789, -84.987654321]])).toEqual([[33.12346, -84.98765]]);
    expect(thinShape([])).toEqual([]);
  });
});
