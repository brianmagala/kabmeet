/* Kabmeet push handler. Loaded by the generated service worker (workbox importScripts). */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Kabmeet', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Kabmeet';
  event.waitUntil(
    (async () => {
      // If Kabmeet is already open and visible, the bell shows it. No pop-up on top of the page.
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (windows.some((w) => w.visibilityState === 'visible')) return;
      await self.registration.showNotification(title, {
        body: data.body || '',
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: data.tag || 'kabmeet',
        data: { href: data.href || '/' },
      });
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const href = (event.notification.data && event.notification.data.href) || '/';
  const url = new URL(href, self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const w of windows) {
        if (new URL(w.url).origin === self.location.origin && 'focus' in w) {
          await w.focus();
          if ('navigate' in w) await w.navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
