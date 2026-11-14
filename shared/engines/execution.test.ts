import { describe, expect, it } from 'vitest'
import {
  exception,
  expensePosting,
  incomePosting,
  recurrence,
  schedule,
  transferPosting,
} from '../tests/engine-fixtures.js'
import { planExecutions } from './execution.js'
import { isPostable, postingAccountIds } from './postings.js'

const activeAccountIds = new Set(['current', 'livret-a'])

describe('planExecutions (EXE-01 to EXE-04)', () => {
  it('turns the occurrence of the day into a definitive income operation (US-09)', () => {
    const income = schedule({
      id: 'income',
      label: 'Prestation',
      amountCents: 20_000,
      createdOn: '2026-11-11',
      posting: incomePosting({ paymentMethodId: 'transfer-in' }),
    })

    expect(
      planExecutions({
        today: '2026-12-04',
        schedules: [income],
        activeAccountIds,
      }),
    ).toEqual([])
    expect(
      planExecutions({
        today: '2026-12-05',
        schedules: [income],
        activeAccountIds,
      }),
    ).toEqual([
      {
        scheduleId: 'income',
        kind: 'income',
        label: 'Prestation',
        originalDate: '2026-12-05',
        effectiveDate: '2026-12-05',
        amountCents: 20_000,
        movements: [
          {
            accountId: 'current',
            paymentMethodId: 'transfer-in',
            categoryId: 'salary',
            amountCents: 20_000,
          },
        ],
      },
    ])
  })

  it('debits expenses and posts both movements of a transfer', () => {
    const [expense, transfer] = planExecutions({
      today: '2026-11-06',
      schedules: [
        schedule({ id: 'a-expense', createdOn: '2026-11-05' }),
        schedule({
          id: 'b-transfer',
          createdOn: '2026-11-06',
          recurrence: recurrence({ startDate: '2026-11-06' }),
          posting: transferPosting(),
        }),
      ],
      activeAccountIds,
    })

    expect(expense?.movements).toEqual([
      {
        accountId: 'current',
        paymentMethodId: null,
        categoryId: 'groceries',
        amountCents: -10_000,
      },
    ])
    expect(transfer?.movements).toEqual([
      {
        accountId: 'current',
        paymentMethodId: null,
        categoryId: null,
        amountCents: -10_000,
      },
      {
        accountId: 'livret-a',
        paymentMethodId: null,
        categoryId: null,
        amountCents: 10_000,
      },
    ])
  })

  it('never executes occurrences dated before the creation of the schedule', () => {
    const reentered = schedule({
      createdOn: '2026-11-14',
      recurrence: recurrence({ startDate: '2026-01-06' }),
    })

    expect(
      planExecutions({
        today: '2026-12-06',
        schedules: [reentered],
        activeAccountIds,
      }).map((execution) => execution.originalDate),
    ).toEqual(['2026-12-06'])
  })

  it('catches up missed days in date order', () => {
    const executions = planExecutions({
      today: '2027-01-06',
      schedules: [
        schedule({
          id: 'b',
          recurrence: recurrence({ startDate: '2026-11-05' }),
        }),
        schedule({
          id: 'a',
          recurrence: recurrence({ startDate: '2026-11-06' }),
        }),
      ],
      activeAccountIds,
    })

    expect(
      executions.map((execution) => [
        execution.effectiveDate,
        execution.scheduleId,
      ]),
    ).toEqual([
      ['2026-11-05', 'b'],
      ['2026-11-06', 'a'],
      ['2026-12-05', 'b'],
      ['2026-12-06', 'a'],
      ['2027-01-05', 'b'],
      ['2027-01-06', 'a'],
    ])
  })

  it('orders executions of the same day by schedule then original date', () => {
    const executions = planExecutions({
      today: '2026-11-05',
      schedules: [
        schedule({
          id: 'b',
          createdOn: '2026-11-05',
          exceptions: [
            exception({
              originalDate: '2026-12-05',
              effectiveDate: '2026-11-05',
            }),
          ],
        }),
        schedule({ id: 'a', createdOn: '2026-11-05' }),
      ],
      activeAccountIds,
    })

    expect(
      executions.map((execution) => [
        execution.scheduleId,
        execution.originalDate,
      ]),
    ).toEqual([
      ['a', '2026-11-05'],
      ['b', '2026-11-05'],
      ['b', '2026-12-05'],
    ])
  })

  it('is idempotent: executed and skipped occurrences produce nothing', () => {
    const done = schedule({
      exceptions: [
        exception({
          originalDate: '2026-11-05',
          state: 'executed',
          effectiveDate: '2026-11-05',
          amountCents: 10_000,
        }),
        exception({ originalDate: '2026-12-05', state: 'skipped' }),
      ],
    })

    expect(
      planExecutions({
        today: '2026-12-31',
        schedules: [done],
        activeAccountIds,
      }),
    ).toEqual([])
  })

  it('executes at the effective date, after the business-day rule and the overrides', () => {
    const rent = schedule({
      createdOn: '2026-12-01',
      recurrence: recurrence({
        startDate: '2026-12-01',
        businessDayRule: 'next',
      }),
      exceptions: [
        exception({ originalDate: '2027-02-01', amountCents: 61_000 }),
      ],
    })

    expect(
      planExecutions({
        today: '2027-01-03',
        schedules: [rent],
        activeAccountIds,
      }).map((execution) => execution.effectiveDate),
    ).toEqual(['2026-12-01'])
    expect(
      planExecutions({
        today: '2027-02-01',
        schedules: [rent],
        activeAccountIds,
      }).map((execution) => [execution.effectiveDate, execution.amountCents]),
    ).toEqual([
      ['2026-12-01', 10_000],
      ['2027-01-04', 10_000],
      ['2027-02-01', 61_000],
    ])
  })

  it('ignores inactive schedules (ECH-11)', () => {
    expect(
      planExecutions({
        today: '2026-12-31',
        schedules: [schedule({ active: false })],
        activeAccountIds,
      }),
    ).toEqual([])
  })

  it('ignores schedules touching an archived account (CPT-07)', () => {
    expect(
      planExecutions({
        today: '2026-12-31',
        schedules: [
          schedule({ posting: expensePosting({ accountId: 'archived' }) }),
          schedule({ posting: transferPosting('current', 'archived') }),
        ],
        activeAccountIds,
      }),
    ).toEqual([])
  })
})

describe('postings', () => {
  it('lists the accounts a schedule touches', () => {
    expect(postingAccountIds(expensePosting())).toEqual(['current'])
    expect(postingAccountIds(transferPosting('current', 'livret-a'))).toEqual([
      'current',
      'livret-a',
    ])
  })

  it('requires an active schedule on active accounts', () => {
    expect(isPostable(schedule(), activeAccountIds)).toBe(true)
    expect(isPostable(schedule({ active: false }), activeAccountIds)).toBe(
      false,
    )
    expect(
      isPostable(
        schedule({ posting: transferPosting('archived', 'current') }),
        activeAccountIds,
      ),
    ).toBe(false)
  })
})
