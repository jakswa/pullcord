import { describe, test, expect } from 'bun:test';

// Load client-side staleness.js at test time — it has no module exports,
// so we eval it and extract the function (same pattern as eta.test.ts).
const clientCode = require('fs').readFileSync(
  require('path').join(__dirname, '..', 'public', 'staleness.js'), 'utf8'
);
const { isStale } = new Function(
  clientCode + '\nreturn { isStale };'
)() as { isStale: (lastUpdatedAt: number | null, now: number, staleMs: number) => boolean };

describe('isStale', () => {
  test('stale when never updated', () => {
    expect(isStale(null, 1000, 10000)).toBe(true);
    expect(isStale(0, 1000, 10000)).toBe(true);
  });

  test('fresh within threshold (inclusive of the boundary)', () => {
    expect(isStale(1000, 6000, 10000)).toBe(false);   // 5s old
    expect(isStale(1000, 11000, 10000)).toBe(false);  // exactly 10s old
  });

  test('stale once older than threshold', () => {
    expect(isStale(1000, 11001, 10000)).toBe(true);   // 10.001s old
    expect(isStale(1000, 60000, 10000)).toBe(true);
  });
});
