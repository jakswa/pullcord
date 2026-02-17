// Pullcord Push Service Worker — notification delivery ONLY, zero caching
// This SW exists solely to receive push events and show notifications

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Pullcord';
  const options = {
    body: data.body || 'Your bus is arriving soon!',
    icon: '/public/icons/icon-192.png',
    badge: '/public/icons/icon-192.png',
    vibrate: [200, 100, 200, 100, 200],
    tag: data.tag || 'pullcord-alert',
    renotify: true,
    requireInteraction: true, // keep notification visible until tapped (don't auto-dismiss)
    data: {
      url: data.url || '/',
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Clicking the notification opens the cordFired URL
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = event.notification.data?.url || '/';
  // Build full URL — Firefox needs absolute URLs for openWindow
  const fullUrl = new URL(path, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Try to reuse an existing Pullcord tab
      for (const client of windowClients) {
        try {
          if (client.url.startsWith(self.location.origin) && 'navigate' in client) {
            return client.navigate(fullUrl).then(() => client.focus());
          }
        } catch (e) {
          // Some browsers throw on navigate — fall through to openWindow
        }
      }
      // No existing tab or navigate failed — open new one
      return clients.openWindow(fullUrl);
    })
  );
});

// No fetch handler — we do NOT cache anything
