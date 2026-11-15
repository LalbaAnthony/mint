import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { notificationListResponseSchema } from '@mint/shared/schemas/notifications'
import { executeDueOccurrences } from '../execution/execute.js'
import { notifyUsers } from '../notifications/job.js'
import { createTestContext } from '../tests/context.js'
import {
  categoryId,
  createAccount,
  expenseScheduleBody,
  operationBody,
  signedInClient,
} from '../tests/fixtures.js'
import type { PushMessage } from '@mint/shared/types/notifications'
import type { PushOutcome, PushSender } from '../types/notifications.js'
import type { TestClient, TestContext } from '../types/tests.js'

const sent: { endpoint: string; message: PushMessage }[] = []

function euros(cents: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
}

function longDate(isoDate: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${isoDate}T00:00:00Z`))
}
const outcomes = new Map<string, PushOutcome>()

const fakeSender: PushSender = {
  publicKey: 'test-public-key',
  send: (target, message) => {
    sent.push({ endpoint: target.endpoint, message })
    return Promise.resolve(outcomes.get(target.endpoint) ?? 'sent')
  },
}

let context: TestContext

beforeAll(async () => {
  context = await createTestContext({
    now: new Date('2026-12-01T09:00:00Z'),
    push: fakeSender,
  })
})

beforeEach(() => {
  context.clock.set(new Date('2026-12-01T09:00:00Z'))
  sent.length = 0
  outcomes.clear()
})

afterAll(async () => {
  await context.close()
})

function client(): Promise<TestClient> {
  return signedInClient(context, 'notifications')
}

function notificationContext() {
  return {
    sequelize: context.dependencies.sequelize,
    models: context.dependencies.models,
    clock: context.clock,
    push: fakeSender,
  }
}

async function settle(): Promise<void> {
  await context.dependencies.alerts.idle()
}

async function notifications(user: TestClient) {
  return notificationListResponseSchema.parse(
    (await user.get('/notifications')).body,
  )
}

async function subscribe(user: TestClient, endpoint: string) {
  const response = await user.post('/push/subscriptions', {
    endpoint,
    keys: { p256dh: 'device-key', auth: 'device-auth' },
  })
  expect(response.status).toBe(201)
  return response.body.id
}

async function lowBalanceUser(endpoint: string) {
  const user = await client()
  await subscribe(user, endpoint)
  const accountId = await createAccount(user, {
    initialBalanceCents: 30_000,
    lowBalanceThresholdCents: 20_000,
  })
  const housing = await categoryId(user, 'Logement')
  const schedule = await user.post(
    '/schedules',
    expenseScheduleBody(accountId, housing, {
      amountCents: 15_000,
      startDate: '2026-12-05',
      frequency: 'once',
    }),
  )
  expect(schedule.status).toBe(201)
  await settle()
  return { user, accountId }
}

describe('US-13 low balance alert (NOTIF-01, NOTIF-03, NOTIF-06)', () => {
  it('notifies in-app and by push once per episode, and again when the minimum goes down', async () => {
    const { user, accountId } = await lowBalanceUser(
      'https://push.example.org/us-13',
    )

    const first = await notifications(user)
    expect(first.unreadCount).toBe(1)
    expect(first.notifications[0]).toMatchObject({
      type: 'low_balance',
      readAt: null,
      payload: {
        accountId,
        accountName: 'Compte courant',
        minDate: '2026-12-05',
        minCents: 15_000,
        thresholdCents: 20_000,
      },
    })
    expect(sent).toEqual([
      {
        endpoint: 'https://push.example.org/us-13',
        message: {
          title: 'Solde bas : Compte courant',
          body: `${euros(15_000)} prévus le ${longDate('2026-12-05')}, sous le seuil de ${euros(20_000)}.`,
          url: `/calendar?account=${accountId}&day=2026-12-05`,
          tag: expect.stringMatching(/^low_balance:/),
        },
      },
    ])

    context.clock.set(new Date('2026-12-02T07:00:00Z'))
    await notifyUsers(notificationContext())
    expect((await notifications(user)).notifications).toHaveLength(1)

    await user.post(
      '/operations',
      operationBody(accountId, { date: '2026-12-04', amountCents: -5_000 }),
    )
    await settle()
    const worse = await notifications(user)
    expect(worse.notifications).toHaveLength(2)
    expect(worse.notifications[0]?.payload).toMatchObject({ minCents: 10_000 })
    expect(sent).toHaveLength(2)
  })

  it('keeps the in-app notification without push when push is off for the type', async () => {
    const user = await client()
    await subscribe(user, 'https://push.example.org/muted')
    await user.patch('/notifications/preferences', { lowBalancePush: false })
    const accountId = await createAccount(user, {
      initialBalanceCents: 10_000,
      lowBalanceThresholdCents: 20_000,
    })
    await settle()

    expect((await notifications(user)).notifications[0]?.payload).toMatchObject(
      { accountId, minCents: 10_000 },
    )
    expect(sent).toEqual([])
    expect((await user.get('/notifications/preferences')).body).toEqual({
      lowBalancePush: false,
      manualReminderPush: true,
    })
  })

  it('removes a device that the push service refuses (NOTIF-08)', async () => {
    outcomes.set('https://push.example.org/gone', 'gone')
    const { user } = await lowBalanceUser('https://push.example.org/gone')

    expect((await user.get('/push/subscriptions')).body).toEqual([])
  })
})

describe('US-14 manual payment reminders (NOTIF-02, EXE-02)', () => {
  it('reminds 2 days before and on the day of a manual transfer', async () => {
    const user = await client()
    await subscribe(user, 'https://push.example.org/us-14')
    const currentId = await createAccount(user)
    const livretId = await createAccount(user, { name: 'Livret' })
    const schedule = await user.post('/schedules', {
      kind: 'transfer',
      label: 'Versement Livret',
      amountCents: 10_000,
      triggerMode: 'manual',
      reminderDaysBefore: 2,
      note: null,
      active: true,
      frequency: 'once',
      interval: 1,
      startDate: '2026-12-10',
      anchorLastDay: false,
      endDate: null,
      maxOccurrences: null,
      businessDayRule: 'exact',
      sourceAccountId: currentId,
      targetAccountId: livretId,
    })
    expect(schedule.status).toBe(201)
    expect(schedule.body.reminderDaysBefore).toBe(2)
    await settle()

    for (const day of [
      '2026-12-07',
      '2026-12-08',
      '2026-12-09',
      '2026-12-10',
    ]) {
      context.clock.set(new Date(`${day}T07:00:00Z`))
      if (day === '2026-12-10') {
        await executeDueOccurrences(notificationContext(), day)
      }
      await notifyUsers(notificationContext())
    }

    const reminders = (await notifications(user)).notifications
    expect(
      reminders.map((notification) => [
        notification.type,
        notification.type === 'manual_reminder'
          ? notification.payload.dueToday
          : null,
      ]),
    ).toEqual([
      ['manual_reminder', true],
      ['manual_reminder', false],
    ])
    expect(sent.map((push) => push.message.body)).toEqual([
      `${euros(10_000)} à régler le ${longDate('2026-12-10')}.`,
      `${euros(10_000)} à régler aujourd'hui.`,
    ])
  })
})

describe('US-15 deposit cap notification (LIV-02, NOTIF-03)', () => {
  it('creates an in-app notification without push when a planned transfer exceeds the cap', async () => {
    const user = await client()
    await subscribe(user, 'https://push.example.org/us-15')
    const currentId = await createAccount(user)
    const lepId = await createAccount(user, {
      name: 'LEP',
      nature: 'regulated_savings',
      regulatedProduct: 'lep',
      usage: 'emergency',
      initialBalanceCents: 995_000,
    })
    await user.post('/schedules', {
      kind: 'transfer',
      label: 'Versement LEP',
      amountCents: 10_000,
      triggerMode: 'auto',
      note: null,
      active: true,
      frequency: 'once',
      interval: 1,
      startDate: '2026-12-06',
      anchorLastDay: false,
      endDate: null,
      maxOccurrences: null,
      businessDayRule: 'exact',
      sourceAccountId: currentId,
      targetAccountId: lepId,
    })
    await settle()

    expect((await notifications(user)).notifications).toEqual([
      expect.objectContaining({
        type: 'deposit_cap',
        payload: expect.objectContaining({
          accountId: lepId,
          date: '2026-12-06',
          excessCents: 5_000,
        }),
      }),
    ])
    expect(sent).toEqual([])
  })
})

describe('NOTIF-04 notification center', () => {
  it('marks one or every notification as read and deletes one', async () => {
    const { user } = await lowBalanceUser('https://push.example.org/center')
    await user.post('/accounts', {
      name: 'Second',
      nature: 'current_account',
      regulatedProduct: null,
      usage: 'current',
      institution: null,
      initialBalanceCents: 1_000,
      initialBalanceDate: '2026-11-01',
      lowBalanceThresholdCents: 5_000,
    })
    await settle()
    const [newest, oldest] = (await notifications(user)).notifications

    const read = await user.post(`/notifications/${oldest?.id ?? ''}/read`)
    expect(read.body.readAt).toBe('2026-12-01T09:00:00.000Z')
    expect((await notifications(user)).unreadCount).toBe(1)
    expect((await user.post('/notifications/read-all')).status).toBe(204)
    expect((await notifications(user)).unreadCount).toBe(0)
    expect(
      (await user.delete(`/notifications/${newest?.id ?? ''}`)).status,
    ).toBe(204)
    expect((await notifications(user)).notifications).toHaveLength(1)
  })

  it('gives the public key and moves a known device to the user who subscribes it', async () => {
    const first = await client()
    const second = await client()
    await subscribe(first, 'https://push.example.org/shared')

    await subscribe(second, 'https://push.example.org/shared')

    expect((await second.get('/push/key')).body).toEqual({
      publicKey: 'test-public-key',
    })
    expect((await first.get('/push/subscriptions')).body).toEqual([])
    expect((await second.get('/push/subscriptions')).body).toHaveLength(1)
  })

  it('notifies nobody for a disabled user (ADM-04)', async () => {
    const { user } = await lowBalanceUser('https://push.example.org/disabled')
    const session = await user.get('/auth/session')
    const before = (await notifications(user)).notifications.length
    await context.dependencies.models.User.update(
      { status: 'disabled' },
      { where: { id: session.body.id } },
    )
    await context.dependencies.models.Notification.destroy({
      where: { userId: session.body.id },
    })
    sent.length = 0

    await notifyUsers(notificationContext())

    expect(before).toBe(1)
    expect(
      await context.dependencies.models.Notification.count({
        where: { userId: session.body.id },
      }),
    ).toBe(0)
    expect(sent).toEqual([])
  })
})
