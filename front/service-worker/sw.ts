import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from '@vite-pwa/workbox-swkit/precaching'
import { NavigationRoute, registerRoute } from '@vite-pwa/workbox-swkit/routing'
import {
  clickTarget,
  displayOfPush,
  notificationsChangedMessage,
} from './notifications'

declare let self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/200'), {
    denylist: [/^\/api\//],
  }),
)

self.addEventListener('message', (event) => {
  const data: unknown = event.data
  if (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    data.type === 'SKIP_WAITING'
  ) {
    void self.skipWaiting()
  }
})

async function announceNotifications(): Promise<void> {
  const clients = await self.clients.matchAll({ type: 'window' })
  for (const client of clients) {
    client.postMessage({ type: notificationsChangedMessage })
  }
}

self.addEventListener('push', (event) => {
  const display = displayOfPush(event.data?.json())
  if (display === null) {
    return
  }
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(display.title, display.options),
      announceNotifications(),
    ]),
  )
})

async function openTarget(url: string): Promise<void> {
  const clients = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  })
  const [existing] = clients
  if (existing === undefined) {
    await self.clients.openWindow(url)
    return
  }
  const focused = await existing.focus()
  await focused.navigate(url)
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    openTarget(clickTarget(event.notification.data, self.location.origin)),
  )
})
