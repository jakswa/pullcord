import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import {
  fetchArrivals,
  getArrivalsTimestamp,
  getRailApiError,
  __resetForTests,
} from '../src/rail/api';

// Mocked clock + fetch so we can drive the cache through its age bands.
const realFetch = globalThis.fetch;
const realNow = Date.now;
let now = 1_000_000;
let calls = 0;
let nextResponse: () => Promise<Response>;

function raw(station: string) {
  return [{
    STATION: station, LINE: 'RED', DESTINATION: 'North Springs', DIRECTION: 'N',
    WAITING_SECONDS: '120', WAITING_TIME: '2 min', TRAIN_ID: '101', TRIP_ID: 't1',
    NEXT_ARR: '', IS_REALTIME: 'true', HAS_STARTED_TRIP: 'true', IS_FIRST_STOP: 'false',
    EVENT_TIME: '',
  }];
}
const ok = (station: string) => () => Promise.resolve(new Response(JSON.stringify(raw(station))));
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  __resetForTests();
  now = 1_000_000;
  calls = 0;
  Date.now = () => now;
  globalThis.fetch = (() => { calls++; return nextResponse(); }) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  Date.now = realNow;
});

async function seed(station: string) {
  nextResponse = ok(station);
  const data = await fetchArrivals();
  expect(data[0].station).toBe(station);
  calls = 0;
}

describe('rail fetchArrivals cache', () => {
  test('cold start awaits a fetch and records the data timestamp', async () => {
    expect(getArrivalsTimestamp()).toBeNull();
    nextResponse = ok('A');
    const data = await fetchArrivals();
    expect(calls).toBe(1);
    expect(data[0].station).toBe('A');
    expect(getArrivalsTimestamp()).toBe(1_000_000);
  });

  test('within TTL serves cache without fetching', async () => {
    await seed('A');
    now += 5_000;
    const data = await fetchArrivals();
    expect(calls).toBe(0);
    expect(data[0].station).toBe('A');
  });

  test('between TTL and MAX_STALE serves cache and refreshes in background', async () => {
    await seed('A');
    now += 12_000;
    nextResponse = ok('B');
    const data = await fetchArrivals();
    expect(data[0].station).toBe('A');
    expect(calls).toBe(1);
    await flush();
    expect(getArrivalsTimestamp()).toBe(now);
    expect((await fetchArrivals())[0].station).toBe('B');
    expect(calls).toBe(1);
  });

  test('past MAX_STALE awaits fresh data instead of serving the old cache', async () => {
    await seed('A');
    now += 5 * 60_000;
    nextResponse = ok('B');
    const data = await fetchArrivals();
    expect(calls).toBe(1);
    expect(data[0].station).toBe('B');
    expect(getArrivalsTimestamp()).toBe(now);
  });

  test('past MAX_STALE with a failed refresh returns [] and sets the error', async () => {
    await seed('A');
    now += 5 * 60_000;
    nextResponse = () => Promise.resolve(new Response('nope', { status: 503 }));
    const data = await fetchArrivals();
    expect(data).toEqual([]);
    expect(getRailApiError()).toContain('503');
  });

  test('concurrent callers share one fetch', async () => {
    await seed('A');
    now += 60_000;
    let resolve!: (r: Response) => void;
    nextResponse = () => new Promise((r) => { resolve = r; });
    const p1 = fetchArrivals();
    const p2 = fetchArrivals();
    const p3 = fetchArrivals();
    await flush();
    expect(calls).toBe(1);
    resolve(new Response(JSON.stringify(raw('B'))));
    const results = await Promise.all([p1, p2, p3]);
    for (const r of results) expect(r[0].station).toBe('B');
  });
});

describe('rail response headers', () => {
  test('rail routes send no-store and data age; full page renders data-ts', async () => {
    const { default: app } = await import('../src/routes/rail');
    await seed('FIVE POINTS STATION');

    const partial = await app.request('/rail?partial=1');
    expect(partial.headers.get('Cache-Control')).toBe('no-store');
    expect(partial.headers.get('X-Data-Ts')).toBe('1000000');
    expect(partial.headers.get('X-Data-Age')).toBe('0');

    now += 3_000;
    const page = await app.request('/rail');
    expect(page.headers.get('Cache-Control')).toBe('no-store');
    const html = await page.text();
    expect(html).toContain('data-ts="1000000"');
    expect(html).toContain('data-age="3000"');

    const station = await app.request('/rail/five-points?partial=1');
    expect(station.headers.get('Cache-Control')).toBe('no-store');
    expect(station.headers.get('X-Data-Age')).toBe('3000');
  });
});
