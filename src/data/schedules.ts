import { Database } from "bun:sqlite";
import fs from "fs";
import path from "path";

export const MARTA_GTFS_PAGE_URL = "https://itsmarta.com/app-developer-resources.aspx";
export const MARTA_GTFS_ZIP_URL = "https://itsmarta.com/google_transit_feed/google_transit.zip";

export interface ScheduleManifest {
  effectiveDate: string;
  downloadedAt: string;
  sourceUrl: string;
  pageUrl: string;
  routeCount: number;
  stopCount: number;
  tripCount: number;
  stopTimeCount: number;
}

export interface ScheduleSnapshot extends ScheduleManifest {
  dir: string;
  dbPath: string;
}

export interface GTFSDatabaseValidation {
  routeCount: number;
  stopCount: number;
  tripCount: number;
  stopTimeCount: number;
  duplicateRouteShortNames: number;
}

export interface PromotionResult {
  promoted: boolean;
  active: ScheduleSnapshot | null;
  previous: ScheduleSnapshot | null;
  reason?: string;
}

export function getDataDir(): string {
  return process.env.PULLCORD_DATA_DIR || path.join(process.cwd(), "data");
}

export function buildSnapshotPath(dataDir: string, effectiveDate: string): string {
  return path.join(dataDir, "schedules", effectiveDate);
}

export function atlantaServiceDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: string) => parts.find(p => p.type === type)?.value;
  return `${value("year")}${value("month")}${value("day")}`;
}

export function parseEffectiveDateFromHtml(html: string): string {
  const zipIndex = html.toLowerCase().indexOf("google_transit.zip");
  const searchArea = zipIndex >= 0
    ? html.slice(Math.max(0, zipIndex - 2000), zipIndex + 4000)
    : html;

  const match = searchArea.match(/Effective\s+Date\s*:\s*(\d{1,2})\s*[/-]\s*(\d{1,2})\s*[/-]\s*(\d{4})/i);
  if (!match) {
    throw new Error("MARTA GTFS Effective Date not found near google_transit.zip");
  }

  const [, month, day, year] = match;
  return `${year}${month.padStart(2, "0")}${day.padStart(2, "0")}`;
}

export async function fetchMartaEffectiveDate(fetchImpl: typeof fetch = fetch): Promise<string> {
  const response = await fetchImpl(MARTA_GTFS_PAGE_URL);
  if (!response.ok) {
    throw new Error(`MARTA GTFS page fetch failed: ${response.status}`);
  }
  return parseEffectiveDateFromHtml(await response.text());
}

function readManifest(dir: string): ScheduleSnapshot | null {
  const manifestPath = path.join(dir, "manifest.json");
  const dbPath = path.join(dir, "marta.db");
  if (!fs.existsSync(manifestPath) || !fs.existsSync(dbPath)) return null;

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as ScheduleManifest;
    if (!/^\d{8}$/.test(manifest.effectiveDate)) return null;
    return { ...manifest, dir, dbPath };
  } catch {
    return null;
  }
}

export function listScheduleSnapshots(dataDir = getDataDir()): ScheduleSnapshot[] {
  const schedulesDir = path.join(dataDir, "schedules");
  if (!fs.existsSync(schedulesDir)) return [];

  return fs.readdirSync(schedulesDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => readManifest(path.join(schedulesDir, entry.name)))
    .filter((snapshot): snapshot is ScheduleSnapshot => snapshot !== null)
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
}

export function resolveScheduleDbPath(dataDir = getDataDir()): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const activeDb = path.join(dataDir, "active-schedule", "marta.db");
  if (fs.existsSync(activeDb)) return activeDb;

  return path.join(dataDir, "marta.db");
}

function snapshotFromLink(dataDir: string, linkName: string): ScheduleSnapshot | null {
  const linkPath = path.join(dataDir, linkName);
  if (!fs.existsSync(linkPath)) return null;
  try {
    return readManifest(fs.realpathSync(linkPath));
  } catch {
    return null;
  }
}

function replaceSymlink(linkPath: string, targetDir: string) {
  const tmpLink = `${linkPath}.tmp-${process.pid}-${Date.now()}`;
  const relativeTarget = path.relative(path.dirname(linkPath), targetDir);
  try { fs.rmSync(tmpLink, { recursive: true, force: true }); } catch {}
  fs.symlinkSync(relativeTarget, tmpLink, "dir");
  fs.renameSync(tmpLink, linkPath);
}

export function validateGTFSDatabase(dbPath: string): GTFSDatabaseValidation {
  const db = new Database(dbPath, { readonly: true });
  try {
    const count = (table: string) => (db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c;
    const duplicateRouteShortNames = (db.prepare(`
      SELECT COUNT(*) AS c FROM (
        SELECT route_short_name
        FROM routes
        WHERE route_short_name NOT IN ('BLUE','GREEN','RED','GOLD')
        GROUP BY route_short_name
        HAVING COUNT(*) > 1
      )
    `).get() as { c: number }).c;

    const result = {
      routeCount: count("routes"),
      stopCount: count("stops"),
      tripCount: count("trips"),
      stopTimeCount: count("stop_times"),
      duplicateRouteShortNames,
    };

    if (result.routeCount === 0 || result.stopCount === 0 || result.tripCount === 0 || result.stopTimeCount === 0) {
      throw new Error(`GTFS database is empty or incomplete: ${JSON.stringify(result)}`);
    }

    return result;
  } finally {
    db.close();
  }
}

export function maybePromoteSchedule(opts: {
  dataDir?: string;
  now?: Date;
  validate?: boolean;
} = {}): PromotionResult {
  const dataDir = opts.dataDir || getDataDir();
  const today = atlantaServiceDate(opts.now || new Date());
  const snapshots = listScheduleSnapshots(dataDir);
  const active = snapshotFromLink(dataDir, "active-schedule");

  const best = snapshots
    .filter(snapshot => snapshot.effectiveDate <= today)
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0] || null;

  if (!best) {
    return { promoted: false, active, previous: snapshotFromLink(dataDir, "previous-schedule"), reason: "no-live-snapshot" };
  }

  if (active?.dir && fs.realpathSync(active.dir) === fs.realpathSync(best.dir)) {
    return { promoted: false, active, previous: snapshotFromLink(dataDir, "previous-schedule"), reason: "already-active" };
  }

  if (opts.validate !== false) {
    try {
      validateGTFSDatabase(best.dbPath);
    } catch (error: any) {
      return {
        promoted: false,
        active,
        previous: snapshotFromLink(dataDir, "previous-schedule"),
        reason: `candidate-invalid: ${error?.message || String(error)}`,
      };
    }
  }

  fs.mkdirSync(dataDir, { recursive: true });
  const activeLink = path.join(dataDir, "active-schedule");
  if (active) {
    replaceSymlink(path.join(dataDir, "previous-schedule"), active.dir);
  }
  replaceSymlink(activeLink, best.dir);

  return { promoted: true, active: best, previous: active, reason: "promoted" };
}

export function getScheduleStatus(dataDir = getDataDir()) {
  const active = snapshotFromLink(dataDir, "active-schedule");
  const previous = snapshotFromLink(dataDir, "previous-schedule");
  const snapshots = listScheduleSnapshots(dataDir);
  const today = atlantaServiceDate();
  const pending = snapshots.filter(s => s.effectiveDate > today);
  const validation = active ? validateGTFSDatabase(active.dbPath) : undefined;

  return {
    activeEffectiveDate: active?.effectiveDate ?? null,
    activeDb: active?.dbPath ?? resolveScheduleDbPath(dataDir),
    previousEffectiveDate: previous?.effectiveDate ?? null,
    pendingEffectiveDates: pending.map(s => s.effectiveDate),
    snapshotCount: snapshots.length,
    ...(validation || {}),
  };
}
