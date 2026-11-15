import { randomUUID } from 'node:crypto'
import { Op } from 'sequelize'
import { resourceIdParamsSchema } from '@mint/shared/schemas/admin'
import {
  operationSchema,
  transferSchema,
} from '@mint/shared/schemas/operations'
import {
  candidateListResponseSchema,
  convertToTransferRequestSchema,
  reconcileRequestSchema,
} from '@mint/shared/schemas/reconciliation'
import { parisDate } from '../clock.js'
import { conflict, validationFailed } from '../http/http-error.js'
import { defineUserRoute } from '../http/route.js'
import {
  findUserOperation,
  toOperation,
  toTransfer,
} from '../operations/operations.js'
import { findUserAccount } from '../accounts/accounts.js'
import {
  dissociateOperation,
  linkOrCreateCounterpart,
  reconcileOperation,
  shareTagsAcross,
} from '../reconciliation/apply.js'
import { rankedCandidatesFor } from '../reconciliation/occurrences.js'
import { errorResponse, noBody } from '../schemas/http.js'

const tag = 'reconciliation'

const operationErrors = {
  401: errorResponse('No valid session'),
  404: errorResponse('Unknown operation, schedule or account'),
}

export const operationCandidatesRoute = defineUserRoute({
  method: 'get',
  path: '/operations/:id/candidates',
  summary:
    'Occurrences that a manual or imported operation could reconcile with, best first (RAP-01, RAP-02, RAP-05)',
  tag,
  body: noBody,
  params: resourceIdParamsSchema,
  responses: {
    200: { description: 'Candidates', schema: candidateListResponseSchema },
    ...operationErrors,
  },
  handle: async ({ app, user, params }) => {
    const operation = await findUserOperation(app, user.id, params.id)
    if (
      operation.origin === 'schedule' ||
      operation.occurrenceId !== null ||
      operation.transferGroupId !== null
    ) {
      return { status: 200, body: { candidates: [] } }
    }
    const ranked = await rankedCandidatesFor(app, user.id, {
      accountId: operation.accountId,
      date: operation.date,
      amountCents: operation.amountCents,
      bankLabel: operation.bankLabel ?? operation.label,
    })
    const linkedIds = ranked.flatMap(
      (candidate) => candidate.occurrence.operationId ?? [],
    )
    const generated = new Set(
      linkedIds.length === 0
        ? []
        : (
            await app.models.Transaction.findAll({
              attributes: ['id'],
              where: {
                id: { [Op.in]: linkedIds },
                origin: 'schedule',
              },
            })
          ).map((linked) => linked.id),
    )
    const schedules = await app.models.Schedule.findAll({
      attributes: ['id', 'kind'],
      where: { userId: user.id, kind: 'transfer' },
    })
    const transfers = new Set(schedules.map((schedule) => schedule.id))
    return {
      status: 200,
      body: {
        candidates: ranked
          .filter(
            ({ occurrence }) =>
              !transfers.has(occurrence.scheduleId) &&
              (occurrence.operationId === null ||
                generated.has(occurrence.operationId)),
          )
          .map(({ occurrence, score }) => ({
            scheduleId: occurrence.scheduleId,
            scheduleLabel: occurrence.scheduleLabel,
            originalDate: occurrence.originalDate,
            effectiveDate: occurrence.effectiveDate,
            amountCents: occurrence.amountCents,
            operationId: occurrence.operationId,
            score,
          })),
      },
    }
  },
})

export const reconcileOperationRoute = defineUserRoute({
  method: 'post',
  path: '/operations/:id/reconcile',
  summary:
    'Associate an operation with an occurrence: a future one is marked executed, an executed one gives up its generated operation (RAP-04, RAP-05)',
  tag,
  body: reconcileRequestSchema,
  params: resourceIdParamsSchema,
  responses: {
    200: { description: 'Reconciled operation', schema: operationSchema },
    400: errorResponse('Invalid body'),
    ...operationErrors,
    409: errorResponse(
      'Transfer or already reconciled operation, or occurrence not a candidate',
    ),
  },
  handle: async ({ app, user, params, body }) => {
    const operation = await app.sequelize.transaction(async (transaction) => {
      const row = await findUserOperation(app, user.id, params.id, transaction)
      if (row.origin === 'schedule') {
        throw conflict('operation_reconciled')
      }
      await reconcileOperation(app, user.id, row, body, transaction)
      return toOperation(app, row, transaction)
    })
    return { status: 200, body: operation }
  },
})

export const dissociateOperationRoute = defineUserRoute({
  method: 'delete',
  path: '/operations/:id/reconcile',
  summary:
    'Dissociate an operation from its occurrence: a past occurrence is marked skipped without regeneration, a future one is planned again (RAP-05)',
  tag,
  body: noBody,
  params: resourceIdParamsSchema,
  responses: {
    200: { description: 'Dissociated operation', schema: operationSchema },
    ...operationErrors,
    409: errorResponse('Operation not reconciled'),
  },
  handle: async ({ app, user, params }) => {
    const operation = await app.sequelize.transaction(async (transaction) => {
      const row = await findUserOperation(app, user.id, params.id, transaction)
      await dissociateOperation(
        app,
        user.id,
        row,
        parisDate(app.clock.now()),
        transaction,
      )
      return toOperation(app, row, transaction)
    })
    return { status: 200, body: operation }
  },
})

export const convertToTransferRoute = defineUserRoute({
  method: 'post',
  path: '/operations/:id/convert-to-transfer',
  summary:
    'Convert an operation into an internal transfer: linked to an opposite operation of the counterpart account within 3 days, otherwise with a created counterpart (OPE-07)',
  tag,
  body: convertToTransferRequestSchema,
  params: resourceIdParamsSchema,
  responses: {
    200: { description: 'Transfer', schema: transferSchema },
    400: errorResponse('Invalid body or same account'),
    ...operationErrors,
    409: errorResponse(
      'Operation already a transfer, generated, reconciled or of the adjustment category, archived account, or date before the initial balance of the counterpart',
    ),
  },
  handle: async ({ app, user, params, body }) => {
    const transfer = await app.sequelize.transaction(async (transaction) => {
      const operation = await findUserOperation(
        app,
        user.id,
        params.id,
        transaction,
      )
      if (operation.transferGroupId !== null) {
        throw conflict('operation_is_transfer')
      }
      if (operation.origin === 'schedule' || operation.occurrenceId !== null) {
        throw conflict('operation_reconciled')
      }
      if (operation.categoryId !== null) {
        const category = await app.models.Category.findByPk(
          operation.categoryId,
          { transaction },
        )
        if (category?.kind === 'adjustment') {
          throw conflict('system_category')
        }
      }
      const counterpartAccount = await findUserAccount(
        app,
        user.id,
        body.counterpartAccountId,
        transaction,
      )
      if (counterpartAccount.archivedAt !== null) {
        throw conflict('account_archived')
      }
      if (counterpartAccount.id === operation.accountId) {
        throw validationFailed([
          { path: ['counterpartAccountId'], message: 'same_account' },
        ])
      }
      await operation.update(
        {
          transferGroupId: randomUUID(),
          categoryId: null,
          status: 'categorized',
        },
        { transaction },
      )
      const counterpart = await linkOrCreateCounterpart(
        app,
        user.id,
        operation,
        counterpartAccount.id,
        null,
        transaction,
      )
      await shareTagsAcross(
        app,
        user.id,
        [operation, counterpart],
        [],
        transaction,
      )
      const [source, target] =
        operation.amountCents < 0
          ? [operation, counterpart]
          : [counterpart, operation]
      return toTransfer(app, { source, target }, transaction)
    })
    return { status: 200, body: transfer }
  },
})
