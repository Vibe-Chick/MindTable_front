/* MindTable 서비스 워커 — Web Push 수신 및 알림 클릭 처리
 * 백엔드(pywebpush)가 보내는 payload 형식: { title, body, url, tag? }
 */

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

// 푸시 수신 → OS 알림 표시
self.addEventListener('push', (event) => {
  let data = { title: 'MindTable', body: '', url: '/' }
  try {
    data = { ...data, ...event.data.json() }
  } catch {
    if (event.data) data.body = event.data.text()
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: data.tag || data.url, // 같은 종류 알림은 하나로 합침
      data: { url: data.url },
    }),
  )
})

// 알림 탭 → 이미 열린 탭이 있으면 그 탭으로, 없으면 새로 열기
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const existing = list.find((c) => c.url.startsWith(self.location.origin))
      if (existing) {
        existing.navigate(url)
        return existing.focus()
      }
      return self.clients.openWindow(url)
    }),
  )
})
