import { describe, test, expect, beforeEach, afterEach, setSystemTime } from 'bun:test';
import { fetchArrivals, getArrivalsAgeMs, _resetRailCacheForTests } from '../src/rail/api';

// The MARTA rail cache is stale-while-revalidate, but bounded: past MAX_STALE
// (30s) a request must wait for a fresh fetch rather than serve an old board.
// This is the "first open of the morning" bug — nobody hits the site overnight,
// so the cache is hours old, and the first load used to render it as "live".

function raw(trainId: string, wait: string) {
  return {
    STATION: 'FIVE POINTS STATION', LINE: 'RED', DESTINATION: 'North Springs',
    DIRECTION: 'N', WAITING_SECONDS: wait, WAITING_TIME: `${Math.round(+wait / 60)} min`,
    TRAIN_ID: trainId, TRIP_ID: `T${trainId}`, NEXT_ARR: '08:00:00',
    IS_REALTIME: 'true', HAS_STARTED_TRIP: 'true', IS_FIRST_STOP: 'false', EVENT_TIME: '',
  };
}

const T0 = new Date('2026-09-03T06:30:00-04:00').getTime();
const realFetch = globalThis.fetch;
let calls = 0;
let nextBody: unknown[] = [];
let fail = false;
let resolveNext: (() => void) | null = null; // when set, the fetch blocks until called

function installFetch() {
  globalThis.fetch = (async () => {
    calls++;
    if (resolveNext) await new Promise<void>((r) => { resolveNext = r; });
    if (fail) throw new Error('boom');
    return new Response(JSON.stringify(nextBody), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  _resetRailCacheForTests();
  calls = 0; fail = false; resolveNext = null; nextBody = [raw('101', '300')];
  setSystemTime(new Date(T0));
  installFetch();
});
afterEach(() => {
  globalThis.fetch = realFetch;
  setSystemTime();
});

describe('rail arrivals cache', () => {
  test('cold start waits for MARTA and reports zero age', async () => {
    const a = await fetchArrivals();
    expect(calls).toBe(1);
    expect(a.map((x) => x.trainId)).toEqual(['101']);
    expect(getArrivalsAgeMs()).toBe(0);
  });

  test('within TTL serves cache without refetching', async () => {
    await fetchArrivals();
    setSystemTime(new Date(T0 + 5_000));
    const a = await fetchArrivals();
    expect(calls).toBe(1);
    expect(a[0].trainId).toBe('101');
    expect(getArrivalsAgeMs()).toBe(5_000);
  });

  test('slightly stale (TTL..30s) serves cache and refreshes in background', async () => {
    await fetchArrivals();
    nextBody = [raw('202', '120')];
    setSystemTime(new Date(T0 + 20_000));
    const a = await fetchArrivals();
    expect(a[0].trainId).toBe('101'); // old board served immediately
    expect(calls).toBe(2);            // ...but a refresh was kicked off
    await Bun.sleep(0);
    expect(getArrivalsAgeMs()).toBe(0); // and it landed
    expect((await fetchArrivals())[0].trainId).toBe('202');
  });

  test('very stale (next morning) waits for a fresh board instead of serving last night', async () => {
    await fetchArrivals();
    nextBody = [raw('303', '90')];
    setSystemTime(new Date(T0 + 8 * 3600_000));
    const a = await fetchArrivals();
    expect(calls).toBe(2);
    expect(a[0].trainId).toBe('303');
    expect(getArrivalsAgeMs()).toBe(0);
  });

  test('very stale + MARTA down returns empty, never the ancient board', async () => {
    await fetchArrivals();
    fail = true;
    setSystemTime(new Date(T0 + 8 * 3600_000));
    const a = await fetchArrivals();
    expect(a).toEqual([]);
    expect(calls).toBe(2);
    // The failure is cached at the new timestamp so we back off, not hammer.
    expect(getArrivalsAgeMs()).toBe(0);
    expect(await fetchArrivals()).toEqual([]);
    expect(calls).toBe(2);
  });

  test('concurrent very-stale requests share one MARTA fetch', async () => {
    await fetchArrivals();
    nextBody = [raw('404', '60')];
    setSystemTime(new Date(T0 + 3600_000));
    resolveNext = () => {};
    const p = Promise.all([fetchArrivals(), fetchArrivals(), fetchArrivals()]);
    await Bun.sleep(0);
    expect(calls).toBe(1 + 1);
    resolveNext!();
    const results = await p;
    for (const r of results) expect(r[0].trainId).toBe('404');
  });
});
