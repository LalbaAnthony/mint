import { Op } from 'sequelize'
import type { Transaction } from 'sequelize'
import { createEnvelopeRequestSchema } from '@mint/shared/schemas/envelopes'
import { daysBetween, monthEnd, monthStart } from '@mint/shared/engines/dates'
import {
  envelopeCategoryIndex,
  envelopeMonthOverride,
  envelopeMonthStatus,
} from '@mint/shared/engines/envelopes'
import type {
  CreateEnvelopeRequest,
  Envelope,
  EnvelopeMonthLine,
  EnvelopeMonthOverrideView,
  EnvelopeMonthResponse,
  EnvelopeMonthTotals,
} from '@mint/shared/types/envelopes'
import { findUserAccount } from '../accounts/accounts.js'
import { findUserCategory } from '../categories/categories.js'
import {
  conflict,
  notFound,
  toIssues,
  validationFailed,
} from '../http/http-error.js'
import { findUserPaymentMethod } from '../payment-methods/payment-methods.js'
import {
  loadCategoryInputs,
  loadEnvelopeCategoryIds,
  loadEnvelopeMonthOverrides,
  loadPaymentMethodsById,
  toEnvelopeInput,
  toOperationInput,
} from '../planning/inputs.js'
import type { EnvelopeSnapshot } from '../types/envelopes.js'
import type {
  EnvelopeModel,
  EnvelopeMonthOverrideModel,
} from '../types/models.js'
import type { DataAccess } from '../types/planning.js'

export async function findUserEnvelope(
  data: DataAccess,
  userId: string,
  id: string,
  transaction?: Transaction,
): Promise<EnvelopeModel> {
  const envelope = await data.models.Envelope.findOne({
    where: { id, userId },
    transaction,
  })
  if (envelope === null) {
    throw notFound()
  }
  return envelope
}

export function toEnvelope(
  envelope: EnvelopeModel,
  categoryIds: readonly string[],
): Envelope {
  return {
    id: envelope.id,
    label: envelope.label,
    monthlyAmountCents: envelope.monthlyAmountCents,
    accountId: envelope.accountId,
    paymentMethodId: envelope.paymentMethodId,
    carryOver: envelope.carryOver,
    active: envelope.active,
    categoryIds: [...categoryIds],
    createdAt: envelope.createdAt.toISOString(),
  }
}

export async function envelopeView(
  data: DataAccess,
  envelope: EnvelopeModel,
  transaction?: Transaction,
): Promise<Envelope> {
  const categoryIds = await loadEnvelopeCategoryIds(
    data,
    [envelope.id],
    transaction,
  )
  return toEnvelope(envelope, categoryIds.get(envelope.id) ?? [])
}

export function parseEnvelopeFields(fields: unknown): CreateEnvelopeRequest {
  const parsed = createEnvelopeRequestSchema.safeParse(fields)
  if (!parsed.success) {
    throw validationFailed(toIssues(parsed.error))
  }
  return parsed.data
}

export function envelopeFieldsOf(
  envelope: EnvelopeModel,
  categoryIds: readonly string[],
): CreateEnvelopeRequest {
  return {
    label: envelope.label,
    monthlyAmountCents: envelope.monthlyAmountCents,
    accountId: envelope.accountId,
    paymentMethodId: envelope.paymentMethodId,
    carryOver: envelope.carryOver,
    active: envelope.active,
    categoryIds: [...categoryIds],
  }
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

export async function validateEnvelopeReferences(
  data: DataAccess,
  userId: string,
  fields: CreateEnvelopeRequest,
  previous: EnvelopeSnapshot | null,
  transaction?: Transaction,
): Promise<void> {
  if (fields.accountId !== null) {
    await ensureAccountUsable(
      data,
      userId,
      fields.accountId,
      previous?.envelope.accountId !== fields.accountId,
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
    const isNewReference =
      previous?.envelope.paymentMethodId !== paymentMethod.id
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
  for (const [index, categoryId] of fields.categoryIds.entries()) {
    const category = await findUserCategory(
      data,
      userId,
      categoryId,
      transaction,
    )
    if (category.kind !== 'expense') {
      throw validationFailed([
        { path: ['categoryIds', index], message: 'category_kind_mismatch' },
      ])
    }
    const isNewMembership = !(
      previous?.categoryIds.includes(categoryId) ?? false
    )
    if (isNewMembership && category.archivedAt !== null) {
      throw conflict('category_archived')
    }
  }
  const elsewhere = await data.models.EnvelopeCategory.count({
    where: {
      userId,
      categoryId: { [Op.in]: fields.categoryIds },
      ...(previous === null
        ? {}
        : { envelopeId: { [Op.ne]: previous.envelope.id } }),
    },
    transaction,
  })
  if (elsewhere > 0) {
    throw conflict('category_in_envelope')
  }
}

export async function replaceEnvelopeCategories(
  data: DataAccess,
  userId: string,
  envelopeId: string,
  categoryIds: readonly string[],
  transaction: Transaction,
): Promise<void> {
  await data.models.EnvelopeCategory.destroy({
    where: { envelopeId, categoryId: { [Op.notIn]: [...categoryIds] } },
    transaction,
  })
  const existing = await data.models.EnvelopeCategory.findAll({
    where: { envelopeId },
    transaction,
  })
  const kept = new Set(existing.map((row) => row.categoryId))
  for (const categoryId of categoryIds) {
    if (!kept.has(categoryId)) {
      await data.models.EnvelopeCategory.create(
        { userId, envelopeId, categoryId },
        { transaction },
      )
    }
  }
}

export async function envelopeMonth(
  data: DataAccess,
  userId: string,
  month: string,
  today: string,
): Promise<EnvelopeMonthResponse> {
  const currentMonth = monthStart(today)
  const envelopes = await data.models.Envelope.findAll({
    where: { userId },
    order: [
      ['createdAt', 'ASC'],
      ['id', 'ASC'],
    ],
  })
  const envelopeIds = envelopes.map((envelope) => envelope.id)
  const categoryIds = await loadEnvelopeCategoryIds(data, envelopeIds)
  const monthOverrides = await loadEnvelopeMonthOverrides(data, envelopeIds)
  const paymentMethods = await loadPaymentMethodsById(data, userId)
  const inputs = envelopes.map((envelope) =>
    toEnvelopeInput(
      envelope,
      categoryIds.get(envelope.id) ?? [],
      paymentMethods,
      monthOverrides.get(envelope.id) ?? [],
    ),
  )
  const index = envelopeCategoryIndex(
    inputs,
    await loadCategoryInputs(data, userId),
  )
  const earliest = inputs.reduce(
    (first, input) =>
      input.carryOver && monthStart(input.createdOn) < first
        ? monthStart(input.createdOn)
        : first,
    month,
  )
  const operations =
    index.size === 0
      ? []
      : (
          await data.models.Transaction.findAll({
            where: {
              userId,
              categoryId: { [Op.in]: [...index.keys()] },
              date: { [Op.between]: [earliest, monthEnd(month)] },
            },
          })
        ).map(toOperationInput)
  const remainingDays =
    month === currentMonth ? daysBetween(today, monthEnd(today)) + 1 : null
  const lines = envelopes.flatMap((envelope, position): EnvelopeMonthLine[] => {
    const input = inputs[position]
    if (input === undefined || !envelope.active) {
      return []
    }
    const status = envelopeMonthStatus(
      month > currentMonth ? { ...input, carryOver: false } : input,
      month,
      operations,
      index,
    )
    return [
      {
        envelope: toEnvelope(envelope, categoryIds.get(envelope.id) ?? []),
        status: {
          budgetCents: status.budgetCents,
          overridden: envelopeMonthOverride(input, month) !== null,
          carriedOverCents: status.carriedOverCents,
          consumedCents: status.consumedCents,
          availableCents: status.availableCents,
          availablePerDayCents:
            remainingDays === null
              ? null
              : Math.max(0, Math.floor(status.availableCents / remainingDays)),
        },
      },
    ]
  })
  return {
    month,
    currentMonth,
    remainingDays,
    lines,
    totals: envelopeMonthTotals(lines),
    inactive: envelopes
      .filter((envelope) => !envelope.active)
      .map((envelope) =>
        toEnvelope(envelope, categoryIds.get(envelope.id) ?? []),
      ),
  }
}

export function envelopeMonthTotals(
  lines: readonly EnvelopeMonthLine[],
): EnvelopeMonthTotals {
  return lines.reduce<EnvelopeMonthTotals>(
    (totals, { status }) => ({
      budgetCents: totals.budgetCents + status.budgetCents,
      carriedOverCents: totals.carriedOverCents + status.carriedOverCents,
      consumedCents: totals.consumedCents + status.consumedCents,
      availableCents: totals.availableCents + status.availableCents,
    }),
    {
      budgetCents: 0,
      carriedOverCents: 0,
      consumedCents: 0,
      availableCents: 0,
    },
  )
}

export function toEnvelopeMonthOverride(
  override: EnvelopeMonthOverrideModel,
): EnvelopeMonthOverrideView {
  return {
    envelopeId: override.envelopeId,
    month: override.month,
    amountCents: override.amountCents,
  }
}

export async function setEnvelopeMonthAmount(
  data: DataAccess,
  userId: string,
  envelopeId: string,
  month: string,
  amountCents: number,
): Promise<EnvelopeMonthOverrideView> {
  return data.sequelize.transaction(async (transaction) => {
    const envelope = await findUserEnvelope(
      data,
      userId,
      envelopeId,
      transaction,
    )
    const existing = await data.models.EnvelopeMonthOverride.findOne({
      where: { envelopeId: envelope.id, month },
      transaction,
    })
    if (existing !== null) {
      await existing.update({ amountCents }, { transaction })
      return toEnvelopeMonthOverride(existing)
    }
    const created = await data.models.EnvelopeMonthOverride.create(
      { envelopeId: envelope.id, month, amountCents },
      { transaction },
    )
    return toEnvelopeMonthOverride(created)
  })
}

export async function removeEnvelopeMonthAmount(
  data: DataAccess,
  userId: string,
  envelopeId: string,
  month: string,
): Promise<void> {
  const envelope = await findUserEnvelope(data, userId, envelopeId)
  await data.models.EnvelopeMonthOverride.destroy({
    where: { envelopeId: envelope.id, month },
  })
}
