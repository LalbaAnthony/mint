import { Op } from 'sequelize'
import type { Transaction } from 'sequelize'
import type { AccountInput } from '@mint/shared/types/accounts'
import type { CategoryInput } from '@mint/shared/types/categories'
import type { EnvelopeInput } from '@mint/shared/types/envelopes'
import type { InterestSettings } from '@mint/shared/types/interest'
import type {
  OccurrenceException,
  Recurrence,
  ScheduleInput,
  SchedulePosting,
} from '@mint/shared/types/schedules'
import type { OperationInput } from '@mint/shared/types/transactions'
import { parisDate } from '../clock.js'
import type {
  AccountModel,
  CategoryModel,
  EnvelopeModel,
  PaymentMethodModel,
  ScheduleModel,
  ScheduleOccurrenceModel,
  TransactionModel,
  ValuationModel,
  InterestRateModel,
} from '../types/models.js'
import type { DataAccess, PostingReference } from '../types/planning.js'

function interestSettings(
  account: AccountModel,
  rates: readonly InterestRateModel[],
): InterestSettings | null {
  if (account.interestMethod === null || account.capitalization === null) {
    return null
  }
  return {
    method: account.interestMethod,
    capitalization: account.capitalization,
    anniversaryDate: account.anniversaryDate,
    rates: rates
      .filter((rate) => rate.accountId === account.id)
      .map((rate) => ({
        effectiveDate: rate.effectiveDate,
        annualRatePct: rate.annualRate,
      })),
  }
}

export function toAccountInput(
  account: AccountModel,
  valuations: readonly ValuationModel[] = [],
  rates: readonly InterestRateModel[] = [],
): AccountInput {
  return {
    id: account.id,
    usage: account.usage,
    initialBalanceCents: account.initialBalanceCents,
    initialBalanceDate: account.initialBalanceDate,
    lowBalanceThresholdCents: account.lowBalanceThresholdCents,
    archived: account.archivedAt !== null,
    valuations: valuations
      .filter((valuation) => valuation.accountId === account.id)
      .map((valuation) => ({
        date: valuation.date,
        valueCents: valuation.valueCents,
      })),
    depositCapCents: account.depositCapCents,
    capitalizedInterestCents: account.capitalizedInterestCents ?? 0,
    interest: interestSettings(account, rates),
  }
}

export function toCategoryInput(category: CategoryModel): CategoryInput {
  return {
    id: category.id,
    parentId: category.parentId,
    kind: category.kind,
    expenseGroup: category.expenseGroup,
  }
}

export function toOperationInput(
  transaction: TransactionModel,
): OperationInput {
  return {
    id: transaction.id,
    accountId: transaction.accountId,
    date: transaction.date,
    amountCents: transaction.amountCents,
    categoryId: transaction.categoryId,
    transferGroupId: transaction.transferGroupId,
  }
}

export function toOccurrenceException(
  row: ScheduleOccurrenceModel,
): OccurrenceException {
  return {
    originalDate: row.originalDate,
    state: row.state,
    effectiveDate: row.effectiveDate,
    amountCents: row.amountCents,
  }
}

export function scheduleRecurrence(schedule: ScheduleModel): Recurrence {
  return {
    frequency: schedule.frequency,
    interval: schedule.interval,
    startDate: schedule.startDate,
    anchorLastDay: schedule.anchorLastDay,
    endDate: schedule.endDate,
    maxOccurrences: schedule.maxOccurrences,
    businessDayRule: schedule.businessDayRule,
  }
}

function requireId(value: string | null, field: string, id: string): string {
  if (value === null) {
    throw new Error(`Schedule ${id} has no ${field}`)
  }
  return value
}

export function resolvedAccountId(
  record: PostingReference,
  paymentMethods: ReadonlyMap<string, PaymentMethodModel>,
): string {
  if (record.accountId !== null) {
    return record.accountId
  }
  const paymentMethodId = requireId(
    record.paymentMethodId,
    'payment method',
    record.id,
  )
  const paymentMethod = paymentMethods.get(paymentMethodId)
  if (paymentMethod === undefined) {
    throw new Error(`Unknown payment method ${paymentMethodId}`)
  }
  return paymentMethod.accountId
}

export function schedulePosting(
  schedule: ScheduleModel,
  paymentMethods: ReadonlyMap<string, PaymentMethodModel>,
): SchedulePosting {
  if (schedule.kind === 'transfer') {
    return {
      kind: 'transfer',
      sourceAccountId: requireId(
        schedule.sourceAccountId,
        'source account',
        schedule.id,
      ),
      targetAccountId: requireId(
        schedule.targetAccountId,
        'target account',
        schedule.id,
      ),
    }
  }
  return {
    kind: schedule.kind,
    accountId: resolvedAccountId(schedule, paymentMethods),
    paymentMethodId: schedule.paymentMethodId,
    categoryId: requireId(schedule.categoryId, 'category', schedule.id),
  }
}

export function toScheduleInput(
  schedule: ScheduleModel,
  occurrences: readonly ScheduleOccurrenceModel[],
  paymentMethods: ReadonlyMap<string, PaymentMethodModel>,
): ScheduleInput {
  return {
    id: schedule.id,
    label: schedule.label,
    amountCents: schedule.amountCents,
    active: schedule.active,
    isSubscription: schedule.isSubscription,
    triggerMode: schedule.triggerMode,
    createdOn: parisDate(schedule.createdAt),
    recurrence: scheduleRecurrence(schedule),
    posting: schedulePosting(schedule, paymentMethods),
    exceptions: occurrences.map(toOccurrenceException),
    system: schedule.isSystem,
  }
}

export async function loadPaymentMethodsById(
  data: DataAccess,
  userId: string,
  transaction?: Transaction,
): Promise<Map<string, PaymentMethodModel>> {
  const paymentMethods = await data.models.PaymentMethod.findAll({
    where: { userId },
    transaction,
  })
  return new Map(
    paymentMethods.map((paymentMethod) => [paymentMethod.id, paymentMethod]),
  )
}

export async function loadOccurrencesBySchedule(
  data: DataAccess,
  scheduleIds: readonly string[],
  transaction?: Transaction,
): Promise<Map<string, ScheduleOccurrenceModel[]>> {
  const grouped = new Map<string, ScheduleOccurrenceModel[]>()
  if (scheduleIds.length === 0) {
    return grouped
  }
  const rows = await data.models.ScheduleOccurrence.findAll({
    where: { scheduleId: { [Op.in]: [...scheduleIds] } },
    order: [['originalDate', 'ASC']],
    transaction,
  })
  for (const row of rows) {
    const list = grouped.get(row.scheduleId)
    if (list === undefined) {
      grouped.set(row.scheduleId, [row])
    } else {
      list.push(row)
    }
  }
  return grouped
}

export async function loadScheduleInputs(
  data: DataAccess,
  userId: string,
  transaction?: Transaction,
): Promise<ScheduleInput[]> {
  const schedules = await data.models.Schedule.findAll({
    where: { userId },
    order: [
      ['createdAt', 'ASC'],
      ['id', 'ASC'],
    ],
    transaction,
  })
  const paymentMethods = await loadPaymentMethodsById(data, userId, transaction)
  const occurrences = await loadOccurrencesBySchedule(
    data,
    schedules.map((schedule) => schedule.id),
    transaction,
  )
  return schedules.map((schedule) =>
    toScheduleInput(
      schedule,
      occurrences.get(schedule.id) ?? [],
      paymentMethods,
    ),
  )
}

export async function loadAccountInputs(
  data: DataAccess,
  userId: string,
  transaction?: Transaction,
): Promise<AccountInput[]> {
  const accounts = await data.models.Account.findAll({
    where: { userId },
    transaction,
  })
  const valuations = await data.models.Valuation.findAll({
    where: { userId },
    order: [['date', 'ASC']],
    transaction,
  })
  const rates = await data.models.InterestRate.findAll({
    where: { userId },
    transaction,
  })
  return accounts.map((account) => toAccountInput(account, valuations, rates))
}

export async function loadInterestCategoryId(
  data: Pick<DataAccess, 'models'>,
  userId: string,
  transaction?: Transaction,
): Promise<string | null> {
  const category = await data.models.Category.findOne({
    attributes: ['id'],
    where: { userId, isSystem: true, kind: 'income' },
    transaction,
  })
  return category?.id ?? null
}

export async function loadCategoryInputs(
  data: DataAccess,
  userId: string,
  transaction?: Transaction,
): Promise<CategoryInput[]> {
  const categories = await data.models.Category.findAll({
    where: { userId },
    transaction,
  })
  return categories.map(toCategoryInput)
}

export async function loadEnvelopeCategoryIds(
  data: DataAccess,
  envelopeIds: readonly string[],
  transaction?: Transaction,
): Promise<Map<string, string[]>> {
  const grouped = new Map<string, string[]>()
  if (envelopeIds.length === 0) {
    return grouped
  }
  const rows = await data.models.EnvelopeCategory.findAll({
    where: { envelopeId: { [Op.in]: [...envelopeIds] } },
    order: [['createdAt', 'ASC']],
    transaction,
  })
  for (const row of rows) {
    grouped.set(row.envelopeId, [
      ...(grouped.get(row.envelopeId) ?? []),
      row.categoryId,
    ])
  }
  return grouped
}

export function toEnvelopeInput(
  envelope: EnvelopeModel,
  categoryIds: readonly string[],
  paymentMethods: ReadonlyMap<string, PaymentMethodModel>,
): EnvelopeInput {
  return {
    id: envelope.id,
    label: envelope.label,
    accountId: resolvedAccountId(envelope, paymentMethods),
    monthlyAmountCents: envelope.monthlyAmountCents,
    carryOver: envelope.carryOver,
    active: envelope.active,
    createdOn: parisDate(envelope.createdAt),
    categoryIds: [...categoryIds],
    monthOverrides: [],
  }
}
