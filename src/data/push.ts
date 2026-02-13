// Server-side Web Push — subscription management + cord monitoring
// Polls MARTA only when active cords exist — zero API calls when idle
import webpush from 'web-push';
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

// Types
interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface ActiveCord {
  id: string;
  subscription: PushSubscription;
  routeId: string;
  stopId: string;
  vehicleId: string | null;
  thresholdSeconds: number; // notify when ETA ≤ this
  createdAt: number;
  notified: boolean;
  expiresAt: number; // auto-expire after 1 hour
}

// In-memory store (fine for single-server, no persistence needed)
const activeCords: Map<string, ActiveCord> = new Map();

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC;
}

export function registerCord(
  subscription: PushSubscription,
  routeId: string,
  stopId: string,
  vehicleId: string | null,
  thresholdMinutes: number = 2,
): string {
  // Generate a cord ID
  const id = Math.random().toString(36).slice(2, 10);

  // Remove any existing cord for this subscription endpoint
  for (const [existingId, cord] of activeCords) {
    if (cord.subscription.endpoint === subscription.endpoint) {
      activeCords.delete(existingId);
    }
  }

  activeCords.set(id, {
    id,
    subscription,
    routeId,
    stopId,
    vehicleId,
    thresholdSeconds: thresholdMinutes * 60,
    createdAt: Date.now(),
    notified: false,
    expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour
  });

  console.log(`🔔 Cord registered: ${id} for route ${routeId} at stop ${stopId}${vehicleId ? ` (vehicle ${vehicleId})` : ''}`);
  startCordPolling(); // Ensure poll loop is running
  return id;
}

export function cancelCord(id: string): boolean {
  const deleted = activeCords.delete(id);
  if (deleted) console.log(`🔕 Cord cancelled: ${id}`);
  return deleted;
}

export function getActiveCordCount(): number {
  return activeCords.size;
}

// Test: fire a push to all active cords (for debugging)
export async function testFireAll(): Promise<number> {
  let sent = 0;
  for (const [id, cord] of activeCords) {
    try {
      await webpush.sendNotification(
        cord.subscription,
        JSON.stringify({
          title: '🚌 Test push from Pullcord!',
          body: 'If you see this, push notifications are working.',
          tag: `test-${id}`,
          url: '/',
        }),
      );
      console.log(`🔔 Test push sent for cord ${id}`);
      sent++;
    } catch (err: any) {
      console.error(`Test push failed for ${id}:`, err.statusCode || err.message);
      if (err.statusCode === 410 || err.statusCode === 404) {
        activeCords.delete(id);
      }
    }
  }
  return sent;
}

// Called by the server during each poll cycle
// predictions: { routeId, stopId, vehicleId, etaSeconds }[]
export async function checkCords(
  routeId: string,
  stopId: string,
  predictions: Array<{ vehicleId?: string; etaSeconds: number; headsign?: string }>,
): Promise<void> {
  const now = Date.now();

  for (const [id, cord] of activeCords) {
    // Clean expired cords
    if (now > cord.expiresAt) {
      activeCords.delete(id);
      continue;
    }

    // Match route + stop
    if (cord.routeId !== routeId || cord.stopId !== stopId) continue;

    // Already notified — we're done with this cord
    if (cord.notified) continue;

    // Find the relevant prediction
    let pred = cord.vehicleId
      ? predictions.find(p => p.vehicleId === cord.vehicleId)
      : predictions[0];

    if (!pred && predictions.length > 0) {
      pred = predictions[0]; // fallback
    }

    if (!pred) continue;

    // Fire when ETA ≤ threshold
    if (pred.etaSeconds <= cord.thresholdSeconds) {
      cord.notified = true;
      const mins = Math.max(1, Math.floor(pred.etaSeconds / 60));
      const routeName = cord.routeId;
      const headsign = pred.headsign ? ` → ${pred.headsign}` : '';

      try {
        await webpush.sendNotification(
          cord.subscription,
          JSON.stringify({
            title: `🚌 Bus arriving in ~${mins} min!`,
            body: `Route ${routeName}${headsign} — head to your stop.`,
            tag: `cord-${id}`,
            url: `/bus?route=${cord.routeId}&stop=${cord.stopId}`,
          }),
        );
        console.log(`🔔 Push sent for cord ${id}`);
      } catch (err: any) {
        console.error(`Push failed for cord ${id}:`, err.statusCode || err.message);
        // 410 Gone = subscription expired, remove it
        if (err.statusCode === 410 || err.statusCode === 404) {
          activeCords.delete(id);
        }
      }

      // Auto-remove after notification
      setTimeout(() => activeCords.delete(id), 5 * 60 * 1000); // clean up after 5 min
    }
  }
}

// ─────────────────────────────────────
// SELF-MANAGING POLL LOOP
// Only polls MARTA when active cords exist.
// Starts when first cord is registered, stops when last cord expires/cancels.
// ─────────────────────────────────────

let pollTimer: ReturnType<typeof setInterval> | null = null;
const CORD_POLL_INTERVAL = 30_000; // 30s — match client poll rate

function startCordPolling() {
  if (pollTimer) return; // Already running
  if (activeCords.size === 0) return; // Nothing to watch

  console.log('🔔 Cord poll loop started');
  pollTimer = setInterval(pollForCords, CORD_POLL_INTERVAL);
  // Also run immediately
  pollForCords();
}

function stopCordPolling() {
  if (!pollTimer) return;
  clearInterval(pollTimer);
  pollTimer = null;
  console.log('🔔 Cord poll loop stopped — no active cords');
}

async function pollForCords() {
  // Clean expired first
  const now = Date.now();
  for (const [id, cord] of activeCords) {
    if (now > cord.expiresAt) {
      activeCords.delete(id);
    }
  }

  // If no active cords remain, stop polling
  if (activeCords.size === 0) {
    stopCordPolling();
    return;
  }

  // Group active cords by route+stop to minimize API calls
  const groups = new Map<string, { routeId: string; stopId: string }>();
  for (const cord of activeCords.values()) {
    if (cord.notified) continue; // Already fired
    const key = `${cord.routeId}:${cord.stopId}`;
    if (!groups.has(key)) {
      groups.set(key, { routeId: cord.routeId, stopId: cord.stopId });
    }
  }

  // Fetch predictions for each unique route+stop pair
  for (const { routeId, stopId } of groups.values()) {
    try {
      const tripLookup = getTripLookup(routeId);
      const pairedStops = getPairedStops(stopId, routeId);
      const stopIds = pairedStops.length > 0
        ? pairedStops.map(ps => ps.stop_id)
        : [stopId];

      const allPreds: Array<{ vehicleId?: string; etaSeconds: number; headsign?: string }> = [];
      for (const sid of [...new Set(stopIds)]) {
        const preds = await getPredictions(routeId, sid, tripLookup);
        allPreds.push(...preds);
      }
      allPreds.sort((a, b) => a.etaSeconds - b.etaSeconds);

      await checkCords(routeId, stopId, allPreds);
    } catch (err) {
      console.error(`Cord poll error for ${routeId}/${stopId}:`, err);
    }
  }
}
