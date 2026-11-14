import { randomUUID } from 'node:crypto'
import { BaseError } from 'sequelize'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createMigratedDatabase } from '../tests/database.js'
import type {
  AccountModel,
  CategoryModel,
  Models,
  PaymentMethodModel,
  ScheduleCreationAttributes,
  TransactionCreationAttributes,
  UserModel,
} from '../types/models.js'
import type { DatabaseRejection, IsolatedDatabase } from '../types/tests.js'
import { createModels } from './models.js'

let database: IsolatedDatabase
let models: Models
let alice: UserModel
let aliceAccount: AccountModel
let aliceSavings: AccountModel
let aliceCard: PaymentMethodModel
let aliceGroceries: CategoryModel
let aliceSalary: CategoryModel
let bob: UserModel
let bobAccount: AccountModel
let bobCategory: CategoryModel

async function rejection(
  operation: Promise<unknown>,
): Promise<DatabaseRejection> {
  try {
    await operation
  } catch (error) {
    if (error instanceof BaseError && 'parent' in error) {
      const parent = error.parent
      if (
        parent instanceof Error &&
        'code' in parent &&
        typeof parent.code === 'string'
      ) {
        return {
          code: parent.code,
          constraint:
            'constraint' in parent && typeof parent.constraint === 'string'
              ? parent.constraint
              : null,
        }
      }
    }
    throw error
  }
  throw new Error('The database accepted the operation')
}

function createUser(email: string): Promise<UserModel> {
  return models.User.create({
    email,
    passwordHash: 'hash',
    role: 'user',
    locale: 'fr',
  })
}

function createCurrentAccount(user: UserModel): Promise<AccountModel> {
  return models.Account.create({
    userId: user.id,
    name: 'Compte courant',
    nature: 'current_account',
    usage: 'current',
    initialBalanceCents: 100_000,
    initialBalanceDate: '2026-11-01',
  })
}

function createGroceries(user: UserModel): Promise<CategoryModel> {
  return models.Category.create({
    userId: user.id,
    kind: 'expense',
    expenseGroup: 'needs',
    name: 'Courses',
  })
}

function expenseSchedule(
  overrides: Partial<ScheduleCreationAttributes> = {},
): ScheduleCreationAttributes {
  return {
    userId: alice.id,
    kind: 'expense',
    label: 'Loyer',
    amountCents: 60_000,
    accountId: aliceAccount.id,
    categoryId: aliceGroceries.id,
    frequency: 'monthly',
    startDate: '2026-12-01',
    ...overrides,
  }
}

function movement(
  overrides: Partial<TransactionCreationAttributes> = {},
): TransactionCreationAttributes {
  return {
    userId: alice.id,
    accountId: aliceAccount.id,
    date: '2026-11-11',
    amountCents: -4_500,
    label: 'Courses',
    categoryId: aliceGroceries.id,
    status: 'categorized',
    origin: 'manual',
    ...overrides,
  }
}

function invalidSchedule(
  name: string,
  overrides: () => Partial<ScheduleCreationAttributes>,
  constraint: string,
) {
  return { name, overrides, constraint }
}

function invalidMovement(
  name: string,
  overrides: () => Partial<TransactionCreationAttributes>,
  constraint: string,
) {
  return { name, overrides, constraint }
}

beforeAll(async () => {
  database = await createMigratedDatabase()
  models = createModels(database.sequelize)
  alice = await createUser('alice@example.org')
  aliceAccount = await createCurrentAccount(alice)
  aliceGroceries = await createGroceries(alice)
  aliceSavings = await models.Account.create({
    userId: alice.id,
    name: 'Livret A',
    nature: 'regulated_savings',
    regulatedProduct: 'livret_a',
    usage: 'savings',
    initialBalanceCents: 0,
    initialBalanceDate: '2026-11-01',
  })
  aliceCard = await models.PaymentMethod.create({
    userId: alice.id,
    accountId: aliceAccount.id,
    label: 'Carte',
    kind: 'card',
  })
  aliceSalary = await models.Category.create({
    userId: alice.id,
    kind: 'income',
    name: 'Salaire',
  })
  bob = await createUser('bob@example.org')
  bobAccount = await createCurrentAccount(bob)
  bobCategory = await createGroceries(bob)
})

afterAll(async () => {
  await database.drop()
})

describe('schedules', () => {
  it('stores an expense, an income through a payment method and a transfer', async () => {
    const expense = await models.Schedule.create(expenseSchedule())
    const income = await models.Schedule.create({
      userId: alice.id,
      kind: 'income',
      label: 'Salaire',
      amountCents: 200_000,
      paymentMethodId: aliceCard.id,
      categoryId: aliceSalary.id,
      frequency: 'monthly',
      startDate: '2026-11-28',
    })
    const transfer = await models.Schedule.create({
      userId: alice.id,
      kind: 'transfer',
      label: 'Epargne',
      amountCents: 10_000,
      sourceAccountId: aliceAccount.id,
      targetAccountId: aliceSavings.id,
      frequency: 'monthly',
      startDate: '2026-11-06',
    })

    const stored = await models.Schedule.findByPk(expense.id)

    expect(stored?.amountCents).toBe(60_000)
    expect(stored?.interval).toBe(1)
    expect(stored?.businessDayRule).toBe('exact')
    expect(stored?.triggerMode).toBe('auto')
    expect(stored?.startDate).toBe('2026-12-01')
    expect((await models.Schedule.findByPk(income.id))?.accountId).toBeNull()
    expect((await models.Schedule.findByPk(transfer.id))?.categoryId).toBeNull()
  })

  it.each([
    invalidSchedule(
      'both a payment method and an account',
      () => ({ paymentMethodId: aliceCard.id }),
      'schedules_kind_fields_check',
    ),
    invalidSchedule(
      'no category',
      () => ({ categoryId: null }),
      'schedules_kind_fields_check',
    ),
    invalidSchedule(
      'a zero amount',
      () => ({ amountCents: 0 }),
      'schedules_amount_cents_check',
    ),
    invalidSchedule(
      'an interval of zero',
      () => ({ interval: 0 }),
      'schedules_interval_check',
    ),
    invalidSchedule(
      'an end date and a number of occurrences',
      () => ({ endDate: '2027-12-01', maxOccurrences: 3 }),
      'schedules_single_end_check',
    ),
    invalidSchedule(
      'an end date before the start date',
      () => ({ endDate: '2026-11-30' }),
      'schedules_end_date_check',
    ),
    invalidSchedule(
      'a last-day anchor on a weekly recurrence',
      () => ({ frequency: 'weekly', anchorLastDay: true }),
      'schedules_anchor_last_day_check',
    ),
    invalidSchedule(
      'a one-off recurrence with an interval',
      () => ({ frequency: 'once', interval: 2 }),
      'schedules_once_check',
    ),
    invalidSchedule(
      'the subscription marker on an income',
      () => ({
        kind: 'income',
        categoryId: aliceSalary.id,
        isSubscription: true,
      }),
      'schedules_subscription_check',
    ),
    invalidSchedule(
      'a transfer to the same account',
      () => ({
        kind: 'transfer',
        accountId: null,
        categoryId: null,
        sourceAccountId: aliceAccount.id,
        targetAccountId: aliceAccount.id,
      }),
      'schedules_kind_fields_check',
    ),
  ])('rejects $name', async ({ overrides, constraint }) => {
    expect(
      await rejection(models.Schedule.create(expenseSchedule(overrides()))),
    ).toEqual({ code: '23514', constraint })
  })

  it("rejects a reference to another user's account or category", async () => {
    expect(
      await rejection(
        models.Schedule.create(expenseSchedule({ accountId: bobAccount.id })),
      ),
    ).toEqual({ code: '23503', constraint: 'schedules_account_same_user_fkey' })
    expect(
      await rejection(
        models.Schedule.create(expenseSchedule({ categoryId: bobCategory.id })),
      ),
    ).toEqual({
      code: '23503',
      constraint: 'schedules_category_same_user_fkey',
    })
  })
})

describe('schedule_occurrences', () => {
  it('keeps one row per original date and requires the values of its state', async () => {
    const schedule = await models.Schedule.create(expenseSchedule())
    const override = await models.ScheduleOccurrence.create({
      scheduleId: schedule.id,
      originalDate: '2027-01-01',
      amountCents: 61_000,
      state: 'overridden',
    })

    expect(
      (await models.ScheduleOccurrence.findByPk(override.id))?.amountCents,
    ).toBe(61_000)
    expect(
      await rejection(
        models.ScheduleOccurrence.create({
          scheduleId: schedule.id,
          originalDate: '2027-01-01',
          state: 'skipped',
        }),
      ),
    ).toEqual({
      code: '23505',
      constraint: 'schedule_occurrences_schedule_original_date_key',
    })
    expect(
      await rejection(
        models.ScheduleOccurrence.create({
          scheduleId: schedule.id,
          originalDate: '2027-02-01',
          state: 'overridden',
        }),
      ),
    ).toEqual({
      code: '23514',
      constraint: 'schedule_occurrences_override_check',
    })
    expect(
      await rejection(
        models.ScheduleOccurrence.create({
          scheduleId: schedule.id,
          originalDate: '2027-03-01',
          effectiveDate: '2027-03-01',
          state: 'executed',
        }),
      ),
    ).toEqual({
      code: '23514',
      constraint: 'schedule_occurrences_executed_check',
    })
  })
})

describe('transactions', () => {
  it('stores categorized, uncategorized and transfer movements', async () => {
    const groupId = randomUUID()
    const categorized = await models.Transaction.create(
      movement({ paymentMethodId: aliceCard.id }),
    )
    await models.Transaction.create(
      movement({ categoryId: null, status: 'to_categorize' }),
    )
    await models.Transaction.create(
      movement({
        categoryId: null,
        transferGroupId: groupId,
        amountCents: -10_000,
      }),
    )
    await models.Transaction.create(
      movement({
        accountId: aliceSavings.id,
        categoryId: null,
        transferGroupId: groupId,
        amountCents: 10_000,
      }),
    )

    const stored = await models.Transaction.findByPk(categorized.id)

    expect(stored?.amountCents).toBe(-4_500)
    expect(stored?.date).toBe('2026-11-11')
    expect(
      await models.Transaction.count({ where: { transferGroupId: groupId } }),
    ).toBe(2)
  })

  it.each([
    invalidMovement(
      'a zero amount',
      () => ({ amountCents: 0 }),
      'transactions_amount_cents_check',
    ),
    invalidMovement(
      'a category on a transfer movement',
      () => ({ transferGroupId: randomUUID() }),
      'transactions_transfer_without_category_check',
    ),
    invalidMovement(
      'a categorized status without category',
      () => ({ categoryId: null }),
      'transactions_status_category_check',
    ),
    invalidMovement(
      'a to-categorize status with a category',
      () => ({ status: 'to_categorize' }),
      'transactions_status_category_check',
    ),
  ])('rejects $name', async ({ overrides, constraint }) => {
    expect(
      await rejection(models.Transaction.create(movement(overrides()))),
    ).toEqual({ code: '23514', constraint })
  })

  it("rejects a reference to another user's account or category", async () => {
    expect(
      await rejection(
        models.Transaction.create(movement({ accountId: bobAccount.id })),
      ),
    ).toEqual({
      code: '23503',
      constraint: 'transactions_account_same_user_fkey',
    })
    expect(
      await rejection(
        models.Transaction.create(movement({ categoryId: bobCategory.id })),
      ),
    ).toEqual({
      code: '23503',
      constraint: 'transactions_category_same_user_fkey',
    })
  })

  it('links one operation per account to an occurrence and keeps it when the schedule is deleted', async () => {
    const schedule = await models.Schedule.create(expenseSchedule())
    const occurrence = await models.ScheduleOccurrence.create({
      scheduleId: schedule.id,
      originalDate: '2026-12-01',
      effectiveDate: '2026-12-01',
      amountCents: 60_000,
      state: 'executed',
    })
    const generated = await models.Transaction.create(
      movement({
        amountCents: -60_000,
        origin: 'schedule',
        occurrenceId: occurrence.id,
      }),
    )

    expect(
      await rejection(
        models.Transaction.create(
          movement({ origin: 'schedule', occurrenceId: occurrence.id }),
        ),
      ),
    ).toEqual({
      code: '23505',
      constraint: 'transactions_occurrence_account_key',
    })

    await schedule.destroy()
    await generated.reload()

    expect(generated.occurrenceId).toBeNull()
    expect(await models.ScheduleOccurrence.findByPk(occurrence.id)).toBeNull()
  })
})

describe('envelopes', () => {
  it('stores an envelope on one default account with its categories', async () => {
    const envelope = await models.Envelope.create({
      userId: alice.id,
      label: 'Courses',
      monthlyAmountCents: 30_000,
      paymentMethodId: aliceCard.id,
    })
    await models.EnvelopeCategory.create({
      userId: alice.id,
      envelopeId: envelope.id,
      categoryId: aliceGroceries.id,
    })

    expect(
      (await models.Envelope.findByPk(envelope.id))?.monthlyAmountCents,
    ).toBe(30_000)
    expect(
      await rejection(
        models.Envelope.create({
          userId: alice.id,
          label: 'Double',
          monthlyAmountCents: 30_000,
          paymentMethodId: aliceCard.id,
          accountId: aliceAccount.id,
        }),
      ),
    ).toEqual({ code: '23514', constraint: 'envelopes_default_account_check' })
  })

  it('puts a category in one envelope at most, of the same user', async () => {
    const other = await models.Envelope.create({
      userId: alice.id,
      label: 'Autre',
      monthlyAmountCents: 10_000,
      accountId: aliceAccount.id,
    })

    expect(
      await rejection(
        models.EnvelopeCategory.create({
          userId: alice.id,
          envelopeId: other.id,
          categoryId: aliceGroceries.id,
        }),
      ),
    ).toEqual({
      code: '23505',
      constraint: 'envelope_categories_category_id_key',
    })
    expect(
      await rejection(
        models.EnvelopeCategory.create({
          userId: alice.id,
          envelopeId: other.id,
          categoryId: bobCategory.id,
        }),
      ),
    ).toEqual({
      code: '23503',
      constraint: 'envelope_categories_category_same_user_fkey',
    })
  })
})

describe('user deletion', () => {
  it('removes the planning data of the user by cascade', async () => {
    await models.User.destroy({ where: { id: alice.id } })

    expect(await models.Schedule.count()).toBe(0)
    expect(await models.ScheduleOccurrence.count()).toBe(0)
    expect(await models.Transaction.count()).toBe(0)
    expect(await models.Envelope.count()).toBe(0)
    expect(await models.EnvelopeCategory.count()).toBe(0)
    expect(await models.Account.count({ where: { userId: bob.id } })).toBe(1)
  })
})
