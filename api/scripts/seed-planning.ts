import type { Transaction } from 'sequelize'
import {
  addDays,
  addMonthsToMonth,
  isoDate,
  monthStart,
  parseIsoDate,
} from '@mint/shared/engines/dates'
import type { Models } from '../types/models.js'
import type { SeedReferences } from '../types/seed.js'

function referenceId(map: ReadonlyMap<string, string>, name: string): string {
  const id = map.get(name)
  if (id === undefined) {
    throw new Error(`Seed reference ${name} does not exist`)
  }
  return id
}

export function seedInitialBalanceDate(today: string): string {
  return addMonthsToMonth(monthStart(today), -1)
}

function nextYearlyDate(today: string, month: number, day: number): string {
  const { year } = parseIsoDate(today)
  const candidate = isoDate(year, month, day)
  return candidate > today ? candidate : isoDate(year + 1, month, day)
}

export async function seedPlanning(
  models: Models,
  userId: string,
  today: string,
  references: SeedReferences,
  transaction: Transaction,
): Promise<void> {
  const current = referenceId(references.accounts, 'Compte courant')
  const livret = referenceId(references.accounts, 'Livret A')
  const card = referenceId(references.paymentMethods, 'Carte CA')
  const directDebits = referenceId(references.paymentMethods, 'Prélèvements CA')
  const groceries = referenceId(references.categories, 'Courses')
  const housing = referenceId(references.categories, 'Logement')
  const digital = referenceId(references.categories, 'Services numériques')
  const salary = referenceId(references.categories, 'Salaire')
  const firstMonth = seedInitialBalanceDate(today)
  const thisMonth = monthStart(today)
  const recurrence = {
    interval: 1,
    anchorLastDay: false,
    endDate: null,
    maxOccurrences: null,
    note: null,
    active: true,
  }

  await models.Schedule.create(
    {
      ...recurrence,
      userId,
      kind: 'expense',
      label: 'Abonnement musique',
      amountCents: 4_416,
      paymentMethodId: card,
      categoryId: digital,
      isSubscription: true,
      frequency: 'yearly',
      startDate: nextYearlyDate(today, 1, 25),
      businessDayRule: 'exact',
    },
    { transaction },
  )
  await models.Schedule.create(
    {
      ...recurrence,
      userId,
      kind: 'expense',
      label: 'Loyer',
      amountCents: 60_000,
      paymentMethodId: directDebits,
      categoryId: housing,
      frequency: 'monthly',
      startDate: firstMonth,
      businessDayRule: 'next',
    },
    { transaction },
  )
  const income = await models.Schedule.create(
    {
      ...recurrence,
      userId,
      kind: 'income',
      label: 'Prestation',
      amountCents: 20_000,
      accountId: current,
      categoryId: salary,
      frequency: 'monthly',
      startDate: addDays(firstMonth, 4),
      businessDayRule: 'exact',
    },
    { transaction },
  )
  await models.ScheduleOccurrence.create(
    {
      scheduleId: income.id,
      originalDate: addDays(addMonthsToMonth(thisMonth, 2), 4),
      amountCents: 18_000,
      state: 'overridden',
    },
    { transaction },
  )
  await models.Schedule.create(
    {
      ...recurrence,
      userId,
      kind: 'transfer',
      label: 'Epargne Livret A',
      amountCents: 10_000,
      sourceAccountId: current,
      targetAccountId: livret,
      triggerMode: 'manual',
      frequency: 'monthly',
      startDate: addDays(firstMonth, 5),
      businessDayRule: 'exact',
    },
    { transaction },
  )
  const envelope = await models.Envelope.create(
    {
      userId,
      label: 'Courses',
      monthlyAmountCents: 30_000,
      accountId: current,
      carryOver: false,
    },
    { transaction },
  )
  await models.EnvelopeCategory.create(
    { userId, envelopeId: envelope.id, categoryId: groceries },
    { transaction },
  )
  const operation = (
    date: string,
    amountCents: number,
    label: string,
    categoryId: string | null,
  ) => ({
    userId,
    accountId: current,
    paymentMethodId: amountCents < 0 ? card : null,
    date,
    amountCents,
    label,
    categoryId,
    status:
      categoryId === null
        ? ('to_categorize' as const)
        : ('categorized' as const),
    origin: 'manual' as const,
  })
  await models.Transaction.bulkCreate(
    [
      operation(addDays(firstMonth, 2), -8_540, 'Supermarché', groceries),
      operation(addDays(firstMonth, 16), -6_210, 'Marché', groceries),
      operation(thisMonth, -12_000, 'Supermarché', groceries),
      operation(thisMonth, -2_350, 'CB BOULANGERIE', null),
      operation(addDays(today, 3), -1_999, 'Cinéma prévu', null),
    ],
    { transaction },
  )
}
