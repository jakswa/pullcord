import { afterEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  atlantaServiceDate,
  buildSnapshotPath,
  getScheduleStatus,
  maybePromoteSchedule,
  parseEffectiveDateFromHtml,
  resolveScheduleDbPath,
  validateGTFSDatabase,
} from '../src/data/schedules';
import { buildGTFSDatabase } from '../src/data/gtfs-import';
import { MARTADatabase } from '../src/data/db';

const tempDirs: string[] = [];

function tempDir(name: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `pullcord-${name}-`));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  delete process.env.DATABASE_URL;
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function writeManifest(dir: string, effectiveDate: string) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'marta.db'), 'sqlite placeholder');
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
    effectiveDate,
    downloadedAt: '2026-05-05T00:00:00.000Z',
    sourceUrl: 'test',
    pageUrl: 'test',
    routeCount: 1,
    stopCount: 1,
    tripCount: 1,
    stopTimeCount: 1,
  }));
}

function writeTinyGtfs(dir: string, routeId: string) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'routes.txt'), [
    'route_id,agency_id,route_short_name,route_long_name,route_type,route_color,route_text_color',
    `${routeId},MARTA,121,Memorial Drive,3,000000,FFFFFF`,
  ].join('\n'));
  fs.writeFileSync(path.join(dir, 'stops.txt'), [
    'stop_id,stop_name,stop_lat,stop_lon',
    '500212,Goldsmith Park & Ride,33.1,-84.1',
    '500213,Goldsmith Park & Ride,33.1,-84.1',
  ].join('\n'));
  fs.writeFileSync(path.join(dir, 'calendar.txt'), [
    'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date',
    'WK,1,1,1,1,1,0,0,20260418,20260821',
  ].join('\n'));
  fs.writeFileSync(path.join(dir, 'calendar_dates.txt'), 'service_id,date,exception_type\n');
  fs.writeFileSync(path.join(dir, 'trips.txt'), [
    'route_id,service_id,trip_id,trip_headsign,direction_id,shape_id',
    `${routeId},WK,TRIP_1,Downtown,0,SHAPE_1`,
  ].join('\n'));
  fs.writeFileSync(path.join(dir, 'shapes.txt'), [
    'shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence',
    'SHAPE_1,33.1,-84.1,1',
    'SHAPE_1,33.2,-84.2,2',
  ].join('\n'));
  fs.writeFileSync(path.join(dir, 'stop_times.txt'), [
    'trip_id,arrival_time,departure_time,stop_id,stop_sequence',
    'TRIP_1,08:00:00,08:00:00,500212,1',
    'TRIP_1,08:05:00,08:05:00,500213,2',
  ].join('\n'));
}

describe('GTFS effective-date parsing', () => {
  test('parses MARTA app developer resources HTML near google_transit.zip', () => {
    const html = `
      <a href="/google_transit_feed/google_transit.zip">google_transit.zip (20MB, ZIP)</a>
      <span>Effective Date: 4/18/2026</span>
    `;
    expect(parseEffectiveDateFromHtml(html)).toBe('20260418');
  });

  test('fails closed when no effective date is present', () => {
    expect(() => parseEffectiveDateFromHtml('<a>google_transit.zip</a>')).toThrow(/Effective Date/);
  });
});

describe('schedule promotion', () => {
  test('promotes the newest snapshot whose effective date is live and preserves previous active', () => {
    const dataDir = tempDir('promote');
    const oldDir = buildSnapshotPath(dataDir, '20260418');
    const liveDir = buildSnapshotPath(dataDir, '20260501');
    const futureDir = buildSnapshotPath(dataDir, '20260601');
    writeManifest(oldDir, '20260418');
    writeManifest(liveDir, '20260501');
    writeManifest(futureDir, '20260601');

    fs.symlinkSync(path.relative(dataDir, oldDir), path.join(dataDir, 'active-schedule'), 'dir');

    const result = maybePromoteSchedule({
      dataDir,
      now: new Date('2026-05-05T12:00:00-04:00'),
      validate: false,
    });

    expect(result.promoted).toBe(true);
    expect(result.active?.effectiveDate).toBe('20260501');
    expect(fs.realpathSync(path.join(dataDir, 'active-schedule'))).toBe(fs.realpathSync(liveDir));
    expect(fs.realpathSync(path.join(dataDir, 'previous-schedule'))).toBe(fs.realpathSync(oldDir));
  });

  test('resolveScheduleDbPath uses DATABASE_URL, active snapshot, then legacy DB', () => {
    const dataDir = tempDir('resolve');
    const legacy = path.join(dataDir, 'marta.db');
    fs.writeFileSync(legacy, 'legacy');
    expect(resolveScheduleDbPath(dataDir)).toBe(legacy);

    const activeDir = buildSnapshotPath(dataDir, '20260418');
    writeManifest(activeDir, '20260418');
    fs.symlinkSync(path.relative(dataDir, activeDir), path.join(dataDir, 'active-schedule'), 'dir');
    expect(resolveScheduleDbPath(dataDir)).toBe(path.join(dataDir, 'active-schedule', 'marta.db'));

    process.env.DATABASE_URL = '/tmp/explicit.db';
    expect(resolveScheduleDbPath(dataDir)).toBe('/tmp/explicit.db');
  });
});

describe('snapshot database import', () => {
  test('builds a fresh isolated database from GTFS files without stale rows', async () => {
    const dir = tempDir('import');
    const gtfsDir = path.join(dir, 'gtfs');
    const dbPath = path.join(dir, 'marta.db');
    writeTinyGtfs(gtfsDir, '26956');

    // Simulate a stale route that must not survive the fresh build.
    const stale = new Database(dbPath);
    stale.exec('CREATE TABLE routes(route_id TEXT PRIMARY KEY, route_short_name TEXT)');
    stale.prepare('INSERT INTO routes VALUES (?, ?)').run('27386', '121');
    stale.close();

    const stats = await buildGTFSDatabase({ dbPath, gtfsDir, effectiveDate: '20260418' });
    expect(stats.routeCount).toBe(1);

    const db = new Database(dbPath, { readonly: true });
    const routes = db.prepare('SELECT route_id FROM routes ORDER BY route_id').all() as Array<{ route_id: string }>;
    const routeStops = (db.prepare('SELECT COUNT(*) AS c FROM route_stops').get() as { c: number }).c;
    db.close();

    expect(routes.map(r => r.route_id)).toEqual(['26956']);
    expect(routeStops).toBe(2);
    expect(validateGTFSDatabase(dbPath).duplicateRouteShortNames).toBe(0);
  });
});

describe('route short-name behavior', () => {
  test('route detail resolves a public short name to the active internal route id', async () => {
    const dir = tempDir('route-detail');
    const gtfsDir = path.join(dir, 'gtfs');
    const dbPath = path.join(dir, 'marta.db');
    writeTinyGtfs(gtfsDir, '26956');
    await buildGTFSDatabase({ dbPath, gtfsDir, effectiveDate: '20260418' });

    const marta = new MARTADatabase(dbPath);
    const detail = marta.getRouteDetail('121');
    marta.close();

    expect(detail?.route.route_id).toBe('26956');
    expect(detail?.stops.length).toBe(2);
    expect(detail?.stops.every(stop => stop.route_id === '26956')).toBe(true);
  });
});

describe('Atlanta service date', () => {
  test('uses America/New_York date rather than UTC date', () => {
    expect(atlantaServiceDate(new Date('2026-05-05T03:30:00.000Z'))).toBe('20260504');
  });
});
