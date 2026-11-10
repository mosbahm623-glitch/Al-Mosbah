// Phone notifications (web push). Loaded by the app's service worker.
self.addEventListener('push', (event) => {
  let d = {}
  try { d = event.data.json() } catch { /* empty */ }
  event.waitUntil(
    self.registration.showNotification(d.title || 'المصباح', {
      body: d.body || '',
      icon: 'pwa-192.png',
      badge: 'pwa-192.png',
      dir: 'rtl',
      lang: 'ar',
      data: { url: d.url || '#/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '#/', self.registration.scope).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          if ('navigate' in c) c.navigate(url)
          return c.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
