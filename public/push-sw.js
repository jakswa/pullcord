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

// Clicking the notification navigates to the cordFired URL + focuses
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Navigate existing Pullcord tab to cordFired URL, then focus
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'navigate' in client) {
          return client.navigate(url).then(() => client.focus());
        }
      }
      // No existing tab — open new one
      return clients.openWindow(url);
    })
  );
});

// No fetch handler — we do NOT cache anything
