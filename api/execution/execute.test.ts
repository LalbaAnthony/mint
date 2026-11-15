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
import { operationListResponseSchema } from '@mint/shared/schemas/operations'
import { createFakeClock, createTestContext } from '../tests/context.js'
import {
  categoryId,
  createAccount,
  createSavingsAccount,
  createSchedule,
  expenseScheduleBody,
  signedInClient,
} from '../tests/fixtures.js'
import type { HealthcheckSignal } from '../types/planning.js'
import type { TestClient, TestContext } from '../types/tests.js'
import { executeDueOccurrences } from './execute.js'
import {
  createHealthcheckPinger,
  executionLockKey,
  runExecutionJob,
} from './job.js'

let context: TestContext

beforeAll(async () => {
  context = await createTestContext({ now: new Date('2026-11-11T10:00:00Z') })
})

afterAll(async () => {
  await context.close()
})

afterEach(() => {
  vi.restoreAllMocks()
})

function client(): Promise<TestClient> {
  return signedInClient(context, 'execution')
}

function data() {
  return {
    sequelize: context.dependencies.sequelize,
    models: context.dependencies.models,
  }
}

function silenceLogs(): void {
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
}

async function operations(user: TestClient) {
  return operationListResponseSchema.parse((await user.get('/operations')).body)
    .items
}

async function incomeSchedule(user: TestClient, accountId: string) {
  return createSchedule(user, {
    ...expenseScheduleBody(accountId, await categoryId(user, 'Salaire'), {
      label: 'Prestation',
      amountCents: 20_000,
      startDate: '2026-11-05',
    }),
    kind: 'income',
    isSubscription: undefined,
  })
}

async function userIdOf(user: TestClient): Promise<string> {
  const session = await user.get('/auth/session')
  const id: string = session.body.id
  return id
}

async function stopOtherUsers(user: TestClient): Promise<void> {
  const ownId = await userIdOf(user)
  const others = await context.dependencies.models.User.findAll()
  for (const other of others) {
    if (other.id !== ownId) {
      await other.update({ status: 'disabled' })
    }
  }
}

describe('EXE-01 to EXE-03 execution of due occurrences', () => {
  it('creates one definitive operation of origin schedule on its date and never a second one (US-09)', async () => {
    const user = await client()
    await stopOtherUsers(user)
    const accountId = await createAccount(user)
    const scheduleId = await incomeSchedule(user, accountId)

    const first = await executeDueOccurrences(data(), '2026-12-05')
    const second = await executeDueOccurrences(data(), '2026-12-05')
    const generated = await operations(user)

    expect(first).toEqual({
      users: 1,
      occurrences: 1,
      operations: 1,
      failures: 0,
    })
    expect(second.occurrences).toBe(0)
    expect(generated).toEqual([
      expect.objectContaining({
        accountId,
        date: '2026-12-05',
        amountCents: 20_000,
        label: 'Prestation',
        status: 'categorized',
        origin: 'schedule',
        scheduleId,
      }),
    ])
  })

  it('catches up missed days, executes overridden occurrences with their values and both movements of a transfer', async () => {
    const user = await client()
    await stopOtherUsers(user)
    const accountId = await createAccount(user)
    const savingsId = await createSavingsAccount(user)
    const incomeId = await incomeSchedule(user, accountId)
    await createSchedule(user, {
      ...expenseScheduleBody(accountId, await categoryId(user, 'Logement')),
      kind: 'transfer',
      label: 'Epargne',
      amountCents: 10_000,
      startDate: '2026-11-06',
      accountId: undefined,
      paymentMethodId: undefined,
      categoryId: undefined,
      isSubscription: undefined,
      sourceAccountId: accountId,
      targetAccountId: savingsId,
    })
    await user.post(`/schedules/${incomeId}/occurrences/2026-12-05/override`, {
      amountCents: 18_000,
      effectiveDate: '2026-12-07',
    })

    const summary = await executeDueOccurrences(data(), '2026-12-08')
    const generated = await operations(user)
    const rows = await context.dependencies.models.ScheduleOccurrence.findAll({
      where: { scheduleId: incomeId, originalDate: '2026-12-05' },
    })

    expect(summary.occurrences).toBe(2)
    expect(summary.operations).toBe(3)
    expect(
      generated
        .map((item) => [item.date, item.accountId, item.amountCents])
        .sort((first, second) => Number(first[2]) - Number(second[2])),
    ).toEqual([
      ['2026-12-06', accountId, -10_000],
      ['2026-12-06', savingsId, 10_000],
      ['2026-12-07', accountId, 18_000],
    ])
    const transferGroups = generated.flatMap(
      (item) => item.transferGroupId ?? [],
    )
    expect(transferGroups).toHaveLength(2)
    expect(new Set(transferGroups).size).toBe(1)
    expect(
      rows.map((row) => [row.state, row.effectiveDate, row.amountCents]),
    ).toEqual([['executed', '2026-12-07', 18_000]])
  })

  it('never regenerates an occurrence whose operation was deleted (EXE-04) nor executes a skipped one', async () => {
    const user = await client()
    await stopOtherUsers(user)
    const accountId = await createAccount(user)
    const scheduleId = await incomeSchedule(user, accountId)
    await user.post(`/schedules/${scheduleId}/occurrences/2027-01-05/skip`)
    await executeDueOccurrences(data(), '2026-12-05')
    const [generated] = await operations(user)

    await user.delete(`/operations/${generated?.id}`)
    const rerun = await executeDueOccurrences(data(), '2027-01-10')

    expect(rerun.occurrences).toBe(0)
    expect(await operations(user)).toEqual([])
  })

  it('skips disabled users and archived accounts, then catches up after reactivation', async () => {
    const user = await client()
    await stopOtherUsers(user)
    const accountId = await createAccount(user)
    await incomeSchedule(user, accountId)
    const userId = await userIdOf(user)
    await context.dependencies.models.User.update(
      { status: 'disabled' },
      { where: { id: userId } },
    )

    const whileDisabled = await executeDueOccurrences(data(), '2026-12-05')
    await context.dependencies.models.User.update(
      { status: 'active' },
      { where: { id: userId } },
    )
    await user.login(
      (await context.dependencies.models.User.findByPk(userId))?.email ?? '',
    )
    await user.post(`/accounts/${accountId}/archive`)
    const whileArchived = await executeDueOccurrences(data(), '2026-12-05')
    await user.post(`/accounts/${accountId}/restore`)
    const afterRestore = await executeDueOccurrences(data(), '2026-12-05')

    expect(whileDisabled.users).toBe(0)
    expect(whileArchived.occurrences).toBe(0)
    expect(afterRestore.occurrences).toBe(1)
  })
})

describe('execution job', () => {
  it('pings start then success and reports the run', async () => {
    silenceLogs()
    const signals: HealthcheckSignal[] = []

    const outcome = await runExecutionJob(
      data(),
      createFakeClock(new Date('2026-12-05T00:05:00+01:00')),
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
            replacements: { key: executionLockKey },
            type: QueryTypes.SELECT,
            transaction,
          },
        )
        return runExecutionJob(data(), context.clock, async (signal) => {
          signals.push(signal)
        })
      },
    )

    expect(outcome).toBe('locked')
    expect(signals).toEqual([])
  })

  it('pings fail when the run fails', async () => {
    silenceLogs()
    const signals: HealthcheckSignal[] = []
    vi.spyOn(context.dependencies.models.User, 'findAll').mockRejectedValueOnce(
      new Error('database gone'),
    )

    const outcome = await runExecutionJob(
      data(),
      context.clock,
      async (signal) => {
        signals.push(signal)
      },
    )

    expect(outcome).toBe('failed')
    expect(signals).toEqual(['start', 'fail'])
  })
})

describe('createHealthcheckPinger (NF-OPS-02)', () => {
  it('calls the start, success and fail URLs', async () => {
    const urls: string[] = []
    const ping = createHealthcheckPinger(
      'https://hc.example.org/ping/abc',
      async (input) => {
        urls.push(String(input))
        return new Response(null, { status: 200 })
      },
    )

    await ping('start')
    await ping('success')
    await ping('fail')

    expect(urls).toEqual([
      'https://hc.example.org/ping/abc/start',
      'https://hc.example.org/ping/abc',
      'https://hc.example.org/ping/abc/fail',
    ])
  })

  it('does nothing without URL and never throws on a failed ping', async () => {
    silenceLogs()
    const send = vi.fn(async () => {
      throw new Error('offline')
    })

    await createHealthcheckPinger(undefined, send)('start')
    await createHealthcheckPinger('https://hc.example.org/x', send)('fail')
    await createHealthcheckPinger(
      'https://hc.example.org/x',
      async () => new Response(null, { status: 500 }),
    )('success')

    expect(send).toHaveBeenCalledTimes(1)
  })
})
