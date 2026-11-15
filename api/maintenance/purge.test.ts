import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { QueryTypes } from 'sequelize'
import {
  createFakeClock,
  createTestContext,
  createTestUser,
} from '../tests/context.js'
import type { HealthcheckSignal } from '../types/planning.js'
import type { TestContext } from '../types/tests.js'
import { purgeExpiredRecords, purgeLockKey, runPurgeJob } from './purge.js'

let context: TestContext

const now = new Date('2026-11-11T02:00:00Z')
const past = new Date('2026-11-11T01:59:59Z')
const future = new Date('2026-11-11T02:30:00Z')

beforeAll(async () => {
  context = await createTestContext({ now })
})

afterAll(async () => {
  await context.close()
})

afterEach(() => {
  vi.restoreAllMocks()
})

function data() {
  return {
    sequelize: context.dependencies.sequelize,
    models: context.dependencies.models,
  }
}

function silenceLogs(): void {
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
}

let tokenCounter = 0

function tokenHash(): string {
  tokenCounter += 1
  return `hash-${tokenCounter}`.padEnd(64, '0')
}

async function seed(email: string) {
  const { models } = context.dependencies
  const user = await createTestUser(context, { email })
  const session = (sid: string, expiresAt: Date) =>
    models.Session.create({
      sid,
      userId: user.id,
      data: {},
      expiresAt,
      lastSeenAt: past,
    })
  await session(`${email}-expired`, past)
  await session(`${email}-live`, future)
  await models.PasswordResetToken.create({
    userId: user.id,
    tokenHash: tokenHash(),
    expiresAt: past,
  })
  await models.PasswordResetToken.create({
    userId: user.id,
    tokenHash: tokenHash(),
    expiresAt: future,
    usedAt: past,
  })
  const live = await models.PasswordResetToken.create({
    userId: user.id,
    tokenHash: tokenHash(),
    expiresAt: future,
  })
  await models.EmailChangeToken.create({
    userId: user.id,
    newEmail: `new-${email}`,
    tokenHash: tokenHash(),
    expiresAt: past,
  })
  const liveChange = await models.EmailChangeToken.create({
    userId: user.id,
    newEmail: `next-${email}`,
    tokenHash: tokenHash(),
    expiresAt: future,
  })
  return { user, live, liveChange }
}

describe('purge of 03:00 (section 7.3)', () => {
  it('removes the expired sessions and the expired or used tokens only', async () => {
    const { user, live, liveChange } = await seed('purge@example.org')
    const { models } = context.dependencies

    const summary = await purgeExpiredRecords(data(), now)

    expect(summary).toEqual({
      sessions: 1,
      passwordResetTokens: 2,
      emailChangeTokens: 1,
    })
    expect(
      (await models.Session.findAll({ where: { userId: user.id } })).map(
        (session) => session.sid,
      ),
    ).toEqual(['purge@example.org-live'])
    expect(
      (await models.PasswordResetToken.findAll()).map((token) => token.id),
    ).toEqual([live.id])
    expect(
      (await models.EmailChangeToken.findAll()).map((token) => token.id),
    ).toEqual([liveChange.id])
  })

  it('pings start then success', async () => {
    silenceLogs()
    const signals: HealthcheckSignal[] = []

    const outcome = await runPurgeJob(
      data(),
      createFakeClock(now),
      async (signal) => {
        signals.push(signal)
      },
    )

    expect(outcome).toBe('completed')
    expect(signals).toEqual(['start', 'success'])
  })

  it('does nothing while another run holds the advisory lock', async () => {
    silenceLogs()
    const signals: HealthcheckSignal[] = []

    const outcome = await context.dependencies.sequelize.transaction(
      async (transaction) => {
        await context.dependencies.sequelize.query(
          'SELECT pg_advisory_xact_lock(:key)',
          {
            replacements: { key: purgeLockKey },
            type: QueryTypes.SELECT,
            transaction,
          },
        )
        return runPurgeJob(data(), context.clock, async (signal) => {
          signals.push(signal)
        })
      },
    )

    expect(outcome).toBe('locked')
    expect(signals).toEqual([])
  })

  it('pings fail when the purge fails', async () => {
    silenceLogs()
    const signals: HealthcheckSignal[] = []
    vi.spyOn(
      context.dependencies.models.Session,
      'destroy',
    ).mockRejectedValueOnce(new Error('database gone'))

    const outcome = await runPurgeJob(data(), context.clock, async (signal) => {
      signals.push(signal)
    })

    expect(outcome).toBe('failed')
    expect(signals).toEqual(['start', 'fail'])
  })
})
