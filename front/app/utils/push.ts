import { pushDeviceSchema } from '@mint/shared/schemas/notifications'
import type { PushDevice } from '@mint/shared/types/notifications'
import type { PushSupport } from '~~/types/notifications'

function isAppleMobile(userAgent: string, touchPoints: number): boolean {
  return (
    /iPad|iPhone|iPod/.test(userAgent) ||
    (userAgent.includes('Macintosh') && touchPoints > 1)
  )
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Reflect.get(navigator, 'standalone') === true
  )
}

export function pushSupport(): PushSupport {
  if (
    isAppleMobile(navigator.userAgent, navigator.maxTouchPoints) &&
    !isStandalone()
  ) {
    return 'ios-install'
  }
  return 'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
    ? 'available'
    : 'unsupported'
}

function applicationServerKey(publicKey: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (publicKey.length % 4)) % 4)
  const base64 = (publicKey + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index)
  }
  return bytes
}

async function pushRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    return null
  }
  return (await navigator.serviceWorker.getRegistration()) ?? null
}

export async function currentPushEndpoint(): Promise<string | null> {
  const registration = await pushRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  return subscription?.endpoint ?? null
}

function isKeyMismatch(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'InvalidStateError'
}

async function browserSubscription(
  registration: ServiceWorkerRegistration,
  publicKey: string,
): Promise<PushSubscription> {
  const options = {
    userVisibleOnly: true,
    applicationServerKey: applicationServerKey(publicKey),
  }
  try {
    return await registration.pushManager.subscribe(options)
  } catch (error) {
    const existing = await registration.pushManager.getSubscription()
    if (!isKeyMismatch(error) || existing === null) {
      throw error
    }
    await existing.unsubscribe()
    return registration.pushManager.subscribe(options)
  }
}

export function notificationPermission(): NotificationPermission {
  return 'Notification' in window ? Notification.permission : 'default'
}

export async function subscribeThisDevice(
  publicKey: string,
): Promise<PushDevice | 'denied' | 'unavailable'> {
  const registration = await pushRegistration()
  if (registration === null) {
    return 'unavailable'
  }
  if ((await Notification.requestPermission()) !== 'granted') {
    return 'denied'
  }
  const subscription = await browserSubscription(registration, publicKey)
  const json = subscription.toJSON()
  return apiCall('POST', '/push/subscriptions', pushDeviceSchema, {
    endpoint: subscription.endpoint,
    keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' },
  })
}

export async function unsubscribeThisDevice(): Promise<void> {
  const registration = await pushRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  await subscription?.unsubscribe()
}
