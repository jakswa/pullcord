// Server-side Web Push — subscription management + cord monitoring
import webpush from 'web-push';

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
    createdAt: Date.now(),
    notified: false,
    expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour
  });

  console.log(`🔔 Cord registered: ${id} for route ${routeId} at stop ${stopId}${vehicleId ? ` (vehicle ${vehicleId})` : ''}`);
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

    // Fire at ≤ 2 minutes
    if (pred.etaSeconds <= 120) {
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
