import type { Transaction } from 'sequelize'
import { createScheduleRequestSchema } from '@mint/shared/schemas/schedules'
import {
  equivalentTotals,
  monthlyEquivalentCents,
  periodicAmount,
} from '@mint/shared/engines/equivalents'
import {
  activeAccountsById,
  postingStartDate,
} from '@mint/shared/engines/postings'
import {
  isOriginalDate,
  nextPendingOccurrence,
  resolveOccurrence,
} from '@mint/shared/engines/recurrence'
import type { AccountInput, AccountUsage } from '@mint/shared/types/accounts'
import type {
  Occurrence,
  Schedule,
  ScheduleFields,
  ScheduleInput,
  ScheduleOccurrence,
  ScheduleCapExcess,
  ScheduleTotals,
  SubscriptionListResponse,
} from '@mint/shared/types/schedules'
import { findUserAccount } from '../accounts/accounts.js'
import { findUserCategory } from '../categories/categories.js'
import {
  conflict,
  notFound,
  toIssues,
  validationFailed,
} from '../http/http-error.js'
import { findUserPaymentMethod } from '../payment-methods/payment-methods.js'
import { ensureUserTags, tagIdsBySchedule } from '../tags/tags.js'
import { loadCapForecast, scheduleCapExcesses } from '../accounts/caps.js'
import type { ScheduleAttributes, ScheduleModel } from '../types/models.js'
import type { DataAccess } from '../types/planning.js'
import { loadAccountInputs, loadScheduleInputs } from '../planning/inputs.js'
import type {
  ScheduleDraft,
  ScheduleUpdate,
  ScheduleViews,
} from '../types/schedules.js'

const savingsUsages: ReadonlySet<AccountUsage> = new Set([
  'emergency',
  'savings',
  'investment',
])

export async function findUserSchedule(
  data: DataAccess,
  userId: string,
  id: string,
  transaction?: Transaction,
): Promise<ScheduleModel> {
  const schedule = await data.models.Schedule.findOne({
    where: { id, userId },
    transaction,
  })
  if (schedule === null) {
    throw notFound()
  }
  return schedule
}

export async function findEditableSchedule(
  data: DataAccess,
  userId: string,
  id: string,
  transaction?: Transaction,
): Promise<ScheduleModel> {
  const schedule = await findUserSchedule(data, userId, id, transaction)
  if (schedule.isSystem) {
    throw conflict('system_schedule')
  }
  return schedule
}

export function scheduleFieldsOf(
  schedule: ScheduleModel,
  tagIds: string[],
): ScheduleDraft {
  return {
    kind: schedule.kind,
    label: schedule.label,
    amountCents: schedule.amountCents,
    triggerMode: schedule.triggerMode,
    reminderDaysBefore: schedule.reminderDaysBefore,
    note: schedule.note,
    active: schedule.active,
    frequency: schedule.frequency,
    interval: schedule.interval,
    startDate: schedule.startDate,
    anchorLastDay: schedule.anchorLastDay,
    endDate: schedule.endDate,
    maxOccurrences: schedule.maxOccurrences,
    businessDayRule: schedule.businessDayRule,
    amountTolerancePct: schedule.amountTolerancePct,
    bankLabelPatterns: schedule.bankLabelPatterns,
    tagIds,
    ...(schedule.kind === 'transfer'
      ? {
          sourceAccountId: schedule.sourceAccountId ?? undefined,
          targetAccountId: schedule.targetAccountId ?? undefined,
        }
      : {
          accountId: schedule.accountId,
          paymentMethodId: schedule.paymentMethodId,
          categoryId: schedule.categoryId ?? undefined,
          ...(schedule.kind === 'expense'
            ? { isSubscription: schedule.isSubscription }
            : {}),
        }),
  }
}

export function parseScheduleFields(fields: unknown): ScheduleFields {
  const parsed = createScheduleRequestSchema.safeParse(fields)
  if (!parsed.success) {
    throw validationFailed(toIssues(parsed.error))
  }
  return parsed.data
}

function notApplicableFields(
  kind: ScheduleModel['kind'],
  update: ScheduleUpdate,
): string[] {
  const categorized = [
    'accountId',
    'paymentMethodId',
    'categoryId',
    'isSubscription',
  ] as const
  const transfer = ['sourceAccountId', 'targetAccountId'] as const
  const forbidden: readonly (keyof ScheduleUpdate)[] =
    kind === 'transfer'
      ? categorized
      : kind === 'income'
        ? [...transfer, 'isSubscription']
        : transfer
  return forbidden.filter((field) => update[field] !== undefined)
}

export function mergeScheduleUpdate(
  schedule: ScheduleModel,
  tagIds: string[],
  update: ScheduleUpdate,
): ScheduleFields {
  const misplaced = notApplicableFields(schedule.kind, update)
  if (misplaced.length > 0) {
    throw validationFailed(
      misplaced.map((field) => ({ path: [field], message: 'not_allowed' })),
    )
  }
  return parseScheduleFields({
    ...scheduleFieldsOf(schedule, tagIds),
    ...update,
  })
}

async function ensureAccountUsable(
  data: DataAccess,
  userId: string,
  accountId: string,
  isNewReference: boolean,
  transaction?: Transaction,
): Promise<void> {
  const account = await findUserAccount(data, userId, accountId, transaction)
  if (isNewReference && account.archivedAt !== null) {
    throw conflict('account_archived')
  }
}

export async function validateScheduleReferences(
  data: DataAccess,
  userId: string,
  fields: ScheduleFields,
  previous: ScheduleModel | null,
  transaction?: Transaction,
): Promise<void> {
  await ensureUserTags(data, userId, fields.tagIds, transaction)
  if (fields.kind === 'transfer') {
    await ensureAccountUsable(
      data,
      userId,
      fields.sourceAccountId,
      previous?.sourceAccountId !== fields.sourceAccountId,
      transaction,
    )
    await ensureAccountUsable(
      data,
      userId,
      fields.targetAccountId,
      previous?.targetAccountId !== fields.targetAccountId,
      transaction,
    )
    return
  }
  if (fields.accountId !== null) {
    await ensureAccountUsable(
      data,
      userId,
      fields.accountId,
      previous?.accountId !== fields.accountId,
      transaction,
    )
  }
  if (fields.paymentMethodId !== null) {
    const paymentMethod = await findUserPaymentMethod(
      data,
      userId,
      fields.paymentMethodId,
      transaction,
    )
    const isNewReference = previous?.paymentMethodId !== paymentMethod.id
    if (isNewReference && paymentMethod.archivedAt !== null) {
      throw conflict('payment_method_archived')
    }
    await ensureAccountUsable(
      data,
      userId,
      paymentMethod.accountId,
      isNewReference,
      transaction,
    )
  }
  const category = await findUserCategory(
    data,
    userId,
    fields.categoryId,
    transaction,
  )
  if (category.kind !== fields.kind) {
    throw validationFailed([
      { path: ['categoryId'], message: 'category_kind_mismatch' },
    ])
  }
  if (previous?.categoryId !== category.id && category.archivedAt !== null) {
    throw conflict('category_archived')
  }
}

export function scheduleColumns(
  fields: ScheduleFields,
): Omit<
  ScheduleAttributes,
  'id' | 'userId' | 'isSystem' | 'createdAt' | 'updatedAt'
> {
  const common = {
    kind: fields.kind,
    label: fields.label,
    amountCents: fields.amountCents,
    triggerMode: fields.triggerMode,
    reminderDaysBefore: fields.reminderDaysBefore,
    note: fields.note,
    active: fields.active,
    frequency: fields.frequency,
    interval: fields.interval,
    startDate: fields.startDate,
    anchorLastDay: fields.anchorLastDay,
    endDate: fields.endDate,
    maxOccurrences: fields.maxOccurrences,
    businessDayRule: fields.businessDayRule,
    amountTolerancePct: fields.amountTolerancePct,
    bankLabelPatterns: fields.bankLabelPatterns,
  }
  if (fields.kind === 'transfer') {
    return {
      ...common,
      accountId: null,
      paymentMethodId: null,
      categoryId: null,
      isSubscription: false,
      sourceAccountId: fields.sourceAccountId,
      targetAccountId: fields.targetAccountId,
    }
  }
  return {
    ...common,
    accountId: fields.accountId,
    paymentMethodId: fields.paymentMethodId,
    categoryId: fields.categoryId,
    isSubscription: fields.kind === 'expense' ? fields.isSubscription : false,
    sourceAccountId: null,
    targetAccountId: null,
  }
}

export function toScheduleOccurrence(
  occurrence: Occurrence,
  today: string,
): ScheduleOccurrence {
  return {
    originalDate: occurrence.originalDate,
    effectiveDate: occurrence.effectiveDate,
    amountCents: occurrence.amountCents,
    status: occurrence.status,
    overridden: occurrence.overridden,
    editable:
      occurrence.status !== 'executed' && occurrence.effectiveDate > today,
  }
}

export function toSchedule(
  schedule: ScheduleModel,
  input: ScheduleInput,
  tagIds: string[],
  activeAccounts: ReadonlyMap<string, AccountInput>,
  today: string,
  capExcess: ScheduleCapExcess | null = null,
): Schedule {
  const next = nextPendingOccurrence(input, today)
  const postable = postingStartDate(input, activeAccounts) !== null
  return {
    id: schedule.id,
    kind: schedule.kind,
    label: schedule.label,
    amountCents: schedule.amountCents,
    triggerMode: schedule.triggerMode,
    reminderDaysBefore: schedule.reminderDaysBefore,
    note: schedule.note,
    active: schedule.active,
    isSubscription: schedule.isSubscription,
    accountId: schedule.accountId,
    paymentMethodId: schedule.paymentMethodId,
    categoryId: schedule.categoryId,
    sourceAccountId: schedule.sourceAccountId,
    targetAccountId: schedule.targetAccountId,
    frequency: schedule.frequency,
    interval: schedule.interval,
    startDate: schedule.startDate,
    anchorLastDay: schedule.anchorLastDay,
    endDate: schedule.endDate,
    maxOccurrences: schedule.maxOccurrences,
    businessDayRule: schedule.businessDayRule,
    amountTolerancePct: schedule.amountTolerancePct,
    bankLabelPatterns: schedule.bankLabelPatterns,
    tagIds,
    createdAt: schedule.createdAt.toISOString(),
    monthlyEquivalentCents: monthlyEquivalentCents(periodicAmount(input)),
    nextOccurrence:
      next === null || !postable ? null : toScheduleOccurrence(next, today),
    ended: next === null,
    capExcess,
  }
}

export function scheduleTotals(
  inputs: readonly ScheduleInput[],
  schedules: readonly Schedule[],
  accounts: readonly AccountInput[],
): ScheduleTotals {
  const usageById = new Map(
    accounts.map((account) => [account.id, account.usage]),
  )
  const counted = new Set(
    schedules.filter(isCounted).map((schedule) => schedule.id),
  )
  const totals = { expensesCents: 0, incomesCents: 0, savingsTransfersCents: 0 }
  for (const input of inputs) {
    const monthly = monthlyEquivalentCents(periodicAmount(input))
    if (!counted.has(input.id) || monthly === null) {
      continue
    }
    const posting = input.posting
    if (posting.kind === 'transfer') {
      if (
        usageById.get(posting.sourceAccountId) === 'current' &&
        savingsUsages.has(usageById.get(posting.targetAccountId) ?? 'current')
      ) {
        totals.savingsTransfersCents += monthly
      }
    } else if (posting.kind === 'expense') {
      totals.expensesCents += monthly
    } else {
      totals.incomesCents += monthly
    }
  }
  return totals
}

export function editableOccurrence(
  input: ScheduleInput,
  originalDate: string,
  today: string,
): Occurrence {
  if (!isOriginalDate(input.recurrence, originalDate)) {
    throw notFound()
  }
  const exception = input.exceptions.find(
    (candidate) => candidate.originalDate === originalDate,
  )
  const occurrence = resolveOccurrence(input, originalDate, exception)
  if (
    !input.active ||
    occurrence.status === 'executed' ||
    occurrence.effectiveDate <= today
  ) {
    throw conflict('occurrence_not_editable')
  }
  return occurrence
}

export function currentOccurrence(
  input: ScheduleInput,
  originalDate: string,
  today: string,
): ScheduleOccurrence {
  const exception = input.exceptions.find(
    (candidate) => candidate.originalDate === originalDate,
  )
  return toScheduleOccurrence(
    resolveOccurrence(input, originalDate, exception),
    today,
  )
}

export function isCounted(schedule: Schedule): boolean {
  return schedule.active && !schedule.ended && schedule.nextOccurrence !== null
}

export async function loadScheduleViews(
  data: DataAccess,
  userId: string,
  today: string,
  horizonMonths: number,
): Promise<ScheduleViews> {
  const capExcesses = scheduleCapExcesses(
    await loadCapForecast(data, userId, today, horizonMonths),
  )
  const schedules = await data.models.Schedule.findAll({
    where: { userId, isSystem: false },
    order: [
      ['createdAt', 'ASC'],
      ['id', 'ASC'],
    ],
  })
  const inputs = await loadScheduleInputs(data, userId)
  const accounts = await loadAccountInputs(data, userId)
  const activeAccounts = activeAccountsById(accounts)
  const inputsById = new Map(inputs.map((input) => [input.id, input]))
  const tagIds = await tagIdsBySchedule(
    data,
    schedules.map((schedule) => schedule.id),
  )
  const views = schedules.flatMap((schedule) => {
    const input = inputsById.get(schedule.id)
    return input === undefined
      ? []
      : [
          toSchedule(
            schedule,
            input,
            tagIds.get(schedule.id) ?? [],
            activeAccounts,
            today,
            capExcesses.get(schedule.id) ?? null,
          ),
        ]
  })
  return { views, inputs, accounts }
}

export function subscriptionList(
  scheduleViews: ScheduleViews,
): SubscriptionListResponse {
  const subscriptions = scheduleViews.views
    .filter(
      (schedule) =>
        schedule.kind === 'expense' &&
        schedule.isSubscription &&
        schedule.active &&
        !schedule.ended,
    )
    .sort((first, second) =>
      (first.nextOccurrence?.effectiveDate ?? '9999-12-31').localeCompare(
        second.nextOccurrence?.effectiveDate ?? '9999-12-31',
      ),
    )
  const counted = new Set(
    subscriptions.filter(isCounted).map((schedule) => schedule.id),
  )
  return {
    subscriptions,
    totals: equivalentTotals(
      scheduleViews.inputs
        .filter((input) => counted.has(input.id))
        .map(periodicAmount),
    ),
  }
}
