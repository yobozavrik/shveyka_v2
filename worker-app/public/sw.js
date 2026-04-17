// public/sw.js — Service Worker for Web Push Notifications
// Handles push events and notification clicks for the Worker App PWA.

self.addEventListener('push', (event) => {
  let data = { title: 'Нове завдання', body: 'Нова партія очікує в роботі' };
  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch {
    // Fallback to default if data is not JSON
  }

  self.registration.showNotification(data.title || 'Нове завдання', {
    body: data.body || 'Нова партія очікує в роботі',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'pending-tasks',
    renotify: true,
  });
});

// When user clicks a notification, open the app and focus on the tasks page
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = new URL('/tasks', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window/tab open
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window
      return clients.openWindow(urlToOpen);
    })
  );
});

// Handle service worker installation
self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker installed');
  self.skipWaiting();
});

// Handle service worker activation
self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker activated');
  event.waitUntil(self.clients.claim());
});
