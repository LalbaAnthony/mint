import { describe, expect, it } from 'vitest'
import {
  clickTarget,
  displayOfPush,
  pushBadge,
  pushIcon,
} from '~~/service-worker/notifications'

describe('service worker push helpers (NOTIF-07, CHG-85)', () => {
  it('turns a push message into a notification with the app icon and badge', () => {
    expect(
      displayOfPush({
        title: 'Solde bas : Compte courant',
        body: 'Sous le seuil.',
        url: '/calendar?account=a&day=2026-12-05',
        tag: 'low_balance:1:15000',
      }),
    ).toEqual({
      title: 'Solde bas : Compte courant',
      options: {
        body: 'Sous le seuil.',
        icon: pushIcon,
        badge: pushBadge,
        tag: 'low_balance:1:15000',
        data: { url: '/calendar?account=a&day=2026-12-05' },
      },
    })
    expect(pushIcon).toBe('/pwa-192x192.png')
    expect(pushBadge).toBe('/badge-96x96.png')
  })

  it('ignores a malformed push message', () => {
    expect(displayOfPush(null)).toBeNull()
    expect(
      displayOfPush({
        title: 'x',
        body: 'y',
        url: 'https://evil.example',
        tag: 't',
      }),
    ).toBeNull()
  })

  it('opens the linked object on the app origin only', () => {
    const origin = 'https://mint.dev-it.app'
    expect(clickTarget({ url: '/schedules?schedule=s' }, origin)).toBe(
      'https://mint.dev-it.app/schedules?schedule=s',
    )
    expect(clickTarget({ url: 'https://evil.example' }, origin)).toBe(
      'https://mint.dev-it.app/',
    )
    expect(clickTarget(undefined, origin)).toBe('https://mint.dev-it.app/')
  })
})
