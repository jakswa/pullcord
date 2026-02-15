// Server-side Web Push — subscription management + cord monitoring
// Cords persist in SQLite — survive restarts and deploys
// Polls MARTA only when active cords exist — zero API calls when idle
import { Database } from 'bun:sqlite';
import webpush from 'web-push';
import path from 'path';
import { getVehicles, getPredictions } from './realtime.js';
import { getTripLookup, getPairedStops } from './db.js';

// Configure VAPID
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:hello@pullcord.app';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
  console.log('🔔 Web Push configured');
} else {
  console.warn('⚠️ VAPID keys not set — push notifications disabled');
}

// ─────────────────────────────────────
// SQLITE CORD STORE
// Separate DB from GTFS (which is readonly)
// ─────────────────────────────────────

const CORD_DB_PATH = path.join(process.cwd(), 'data', 'cords.db');
const db = new Database(CORD_DB_PATH);

// WAL mode for concurrent reads during polls
db.exec('PRAGMA journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS cords (
    id TEXT PRIMARY KEY,
    endpoint TEXT NOT NULL,
    subscription TEXT NOT NULL,
    route_id TEXT NOT NULL,
    stop_id TEXT NOT NULL,
    vehicle_id TEXT,
    trip_id TEXT,
    direction_id INTEGER,
    threshold_seconds INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  )
`);

// Migration: add direction_id if missing (existing cords table)
try {
  db.exec('ALTER TABLE cords ADD COLUMN direction_id INTEGER');
} catch (e) {
  // Column already exists — fine
}

// Prepared statements
const stmtInsert = db.prepare(`
  INSERT INTO cords (id, endpoint, subscription, route_id, stop_id, vehicle_id, trip_id, direction_id, threshold_seconds, created_at, expires_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const stmtDeleteById = db.prepare('DELETE FROM cords WHERE id = ?');
const stmtDeleteByEndpoint = db.prepare('DELETE FROM cords WHERE endpoint = ?');
const stmtDeleteExpired = db.prepare('DELETE FROM cords WHERE expires_at < ?');
const stmtCount = db.prepare('SELECT COUNT(*) as count FROM cords');
const stmtAll = db.prepare('SELECT * FROM cords');
const stmtByRouteStop = db.prepare('SELECT * FROM cords WHERE route_id = ? AND stop_id = ?');
const stmtGroups = db.prepare('SELECT DISTINCT route_id, stop_id FROM cords');

interface CordRow {
  id: string;
  endpoint: string;
  subscription: string;
  route_id: string;
  stop_id: string;
  vehicle_id: string | null;
  trip_id: string | null;
  direction_id: number | null;
  threshold_seconds: number;
  created_at: number;
  expires_at: number;
}

interface PushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

// ─────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC;
}

export function registerCord(
  subscription: PushSubscription,
  routeId: string,
  stopId: string,
  vehicleId: string | null,
  tripId: string | null,
  directionId: number | null,
  thresholdMinutes: number = 2,
): string {
  const id = Math.random().toString(36).slice(2, 10);
  const now = Date.now();

  // Remove any existing cord for this subscription endpoint
  stmtDeleteByEndpoint.run(subscription.endpoint);

  stmtInsert.run(
    id,
    subscription.endpoint,
    JSON.stringify(subscription),
    routeId,
    stopId,
    vehicleId,
    tripId,
    directionId,
    thresholdMinutes * 60,
    now,
    now + 60 * 60 * 1000, // 1 hour expiry
  );

  console.log(`🔔 Cord registered: ${id} for route ${routeId} at stop ${stopId}${vehicleId ? ` (vehicle ${vehicleId})` : ''}${tripId ? ` (trip ${tripId})` : ''} dir:${directionId}`);
  startCordPolling();
  return id;
}

export function cancelCord(id: string): boolean {
  const result = stmtDeleteById.run(id);
  const deleted = result.changes > 0;
  if (deleted) console.log(`🔕 Cord cancelled: ${id}`);
  return deleted;
}

export function getActiveCordCount(): number {
  return (stmtCount.get() as { count: number }).count;
}

// Test: fire a push to all active cords (for debugging)
export async function testFireAll(): Promise<number> {
  const cords = stmtAll.all() as CordRow[];
  let sent = 0;
  for (const cord of cords) {
    const sub = JSON.parse(cord.subscription) as PushSubscription;
    try {
      await webpush.sendNotification(
        sub,
        JSON.stringify({
          title: '🚌 Test push from Pullcord!',
          body: 'If you see this, push notifications are working.',
          tag: `test-${cord.id}`,
          url: '/',
        }),
      );
      console.log(`🔔 Test push sent for cord ${cord.id}`);
      sent++;
    } catch (err: any) {
      console.error(`Test push failed for ${cord.id}:`, err.statusCode || err.message);
      if (err.statusCode === 410 || err.statusCode === 404) {
        stmtDeleteById.run(cord.id);
      }
    }
  }
  return sent;
}

// ─────────────────────────────────────
// CORD CHECK — called per route+stop group during poll
// ─────────────────────────────────────

export async function checkCords(
  routeId: string,
  stopId: string,
  predictions: Array<{ vehicleId?: string; tripId?: string; directionId?: number; etaSeconds: number; headsign?: string }>,
): Promise<void> {
  const now = Date.now();
  const cords = stmtByRouteStop.all(routeId, stopId) as CordRow[];

  for (const cord of cords) {
    // Clean expired
    if (now > cord.expires_at) {
      stmtDeleteById.run(cord.id);
      continue;
    }

    // Grace period — don't fire on first poll cycle (prevents instant re-fire on re-subscribe)
    if (now - cord.created_at < CORD_POLL_INTERVAL) continue;

    // Find the relevant prediction
    // Priority: tripId → vehicleId → soonest in same direction → soonest overall
    let pred: typeof predictions[0] | undefined;
    if (cord.trip_id) {
      pred = predictions.find(p => p.tripId === cord.trip_id);
    }
    if (!pred && cord.vehicle_id) {
      pred = predictions.find(p => p.vehicleId === cord.vehicle_id);
    }
    if (!pred && cord.direction_id != null) {
      pred = predictions.find(p => p.directionId === cord.direction_id);
    }
    if (!pred && predictions.length > 0) {
      pred = predictions[0];
    }

    if (!pred) continue;

    // Fire when ETA ≤ threshold
    if (pred.etaSeconds <= cord.threshold_seconds) {
      const mins = Math.max(1, Math.floor(pred.etaSeconds / 60));
      const headsign = pred.headsign ? ` → ${pred.headsign}` : '';
      const sub = JSON.parse(cord.subscription) as PushSubscription;

      try {
        await webpush.sendNotification(
          sub,
          JSON.stringify({
            title: `🚌 Bus arriving in ~${mins} min!`,
            body: `Route ${cord.route_id}${headsign} — head to your stop.`,
            tag: `cord-${cord.id}`,
            url: `/bus?route=${cord.route_id}&stop=${cord.stop_id}&cordFired=${cord.id}`,
          }),
        );
        console.log(`🔔 Push sent for cord ${cord.id}`);
      } catch (err: any) {
        console.error(`Push failed for cord ${cord.id}:`, err.statusCode || err.message);
      }

      // Cord served its purpose — delete immediately
      stmtDeleteById.run(cord.id);
    }
  }
}

// ─────────────────────────────────────
// SELF-MANAGING POLL LOOP
// Only polls MARTA when active cords exist.
// Starts when first cord is registered, stops when last cord expires/cancels.
// Resumes automatically on startup if cords survived from previous run.
// ─────────────────────────────────────

let pollTimer: ReturnType<typeof setInterval> | null = null;
const CORD_POLL_INTERVAL = 30_000; // 30s

function startCordPolling() {
  if (pollTimer) return;
  if (getActiveCordCount() === 0) return;

  console.log('🔔 Cord poll loop started');
  pollTimer = setInterval(pollForCords, CORD_POLL_INTERVAL);
  pollForCords();
}

function stopCordPolling() {
  if (!pollTimer) return;
  clearInterval(pollTimer);
  pollTimer = null;
  console.log('🔔 Cord poll loop stopped — no active cords');
}

async function pollForCords() {
  // Clean expired
  stmtDeleteExpired.run(Date.now());

  // If none remain, stop
  if (getActiveCordCount() === 0) {
    stopCordPolling();
    return;
  }

  // Get distinct route+stop groups
  const groups = stmtGroups.all() as Array<{ route_id: string; stop_id: string }>;

  for (const { route_id, stop_id } of groups) {
    try {
      const tripLookup = getTripLookup(route_id);
      const pairedStops = getPairedStops(stop_id, route_id);
      const stopIds = pairedStops.length > 0
        ? pairedStops.map(ps => ps.stop_id)
        : [stop_id];

      const allPreds: Array<{ vehicleId?: string; tripId?: string; directionId?: number; etaSeconds: number; headsign?: string }> = [];
      for (const sid of [...new Set(stopIds)]) {
        const preds = await getPredictions(route_id, sid, tripLookup);
        allPreds.push(...preds);
      }
      allPreds.sort((a, b) => a.etaSeconds - b.etaSeconds);

      await checkCords(route_id, stop_id, allPreds);
    } catch (err) {
      console.error(`Cord poll error for ${route_id}/${stop_id}:`, err);
    }
  }
}

// Resume polling on startup if there are surviving cords
startCordPolling();
