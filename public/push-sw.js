// Pullcord Push Service Worker — notification delivery ONLY, zero caching
// This SW exists solely to receive push events and show notifications

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Pullcord';
  const options = {
    body: data.body || 'Your bus is arriving soon!',
    icon: '/public/icons/icon-192.png',
    badge: '/public/icons/badge-96.png',
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
  const fullUrl = new URL(path, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windowClients) => {
      // Try to focus an existing Pullcord tab and navigate it
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin)) {
          try {
            await client.focus();
            // Post message to navigate — more reliable than client.navigate() on Chrome Android
            client.postMessage({ type: 'navigate', url: fullUrl });
            return;
          } catch (e) {
            // focus() can throw if not allowed — fall through
          }
        }
      }
      // No existing tab — open new one
      return clients.openWindow(fullUrl);
    })
  );
});

// No fetch handler — we do NOT cache anything
