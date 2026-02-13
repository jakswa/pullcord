// Pullcord Push Service Worker — notification delivery ONLY, zero caching
// This SW exists solely to receive push events and show notifications

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Pullcord';
  const options = {
    body: data.body || 'Your bus is arriving soon!',
    icon: '/public/icons/icon-192.png',
    badge: '/public/icons/icon-192.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'pullcord-alert',
    renotify: true,
    data: {
      url: data.url || '/',
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Clicking the notification opens/focuses the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing tab if found
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new tab
      return clients.openWindow(url);
    })
  );
});

// No fetch handler — we do NOT cache anything
