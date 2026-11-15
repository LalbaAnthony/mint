import type { Transaction } from 'sequelize'
import { Op } from 'sequelize'
import { forecastEndDate } from '@mint/shared/engines/forecast'
import { activeAccountsById } from '@mint/shared/engines/postings'
import {
  occurrencesBetween,
  orphanedExceptions,
} from '@mint/shared/engines/recurrence'
import { resourceIdParamsSchema } from '@mint/shared/schemas/admin'
import {
  createScheduleRequestSchema,
  occurrenceParamsSchema,
  overrideOccurrenceRequestSchema,
  scheduleListResponseSchema,
  scheduleOccurrenceListResponseSchema,
  scheduleOccurrenceSchema,
  scheduleSchema,
  subscriptionListResponseSchema,
  updateScheduleRequestSchema,
  updateScheduleResponseSchema,
} from '@mint/shared/schemas/schedules'
import type { Schedule } from '@mint/shared/types/schedules'
import { parisDate } from '../clock.js'
import { conflict, validationFailed } from '../http/http-error.js'
import { defineUserRoute } from '../http/route.js'
import {
  loadAccountInputs,
  loadOccurrencesBySchedule,
  loadPaymentMethodsById,
  scheduleRecurrence,
  toOccurrenceException,
  toScheduleInput,
} from '../planning/inputs.js'
import {
  currentOccurrence,
  editableOccurrence,
  findUserSchedule,
  loadScheduleViews,
  mergeScheduleUpdate,
  subscriptionList,
  scheduleColumns,
  scheduleTotals,
  toSchedule,
  toScheduleOccurrence,
  validateScheduleReferences,
} from '../schedules/schedules.js'
import { errorResponse, noBody, noParams } from '../schemas/http.js'
import { replaceScheduleTags, tagIdsBySchedule } from '../tags/tags.js'
import type { AppDependencies } from '../types/app.js'
import type {
  ScheduleModel,
  ScheduleOccurrenceAttributes,
} from '../types/models.js'

const tag = 'schedules'

const accessErrors = { 401: errorResponse('No valid session') }

const resourceErrors = {
  ...accessErrors,
  404: errorResponse(
    'Unknown schedule, occurrence, account, payment method, category or tag',
  ),
}

function today(app: AppDependencies): string {
  return parisDate(app.clock.now())
}

async function scheduleInputOf(
  app: AppDependencies,
  schedule: ScheduleModel,
  transaction?: Transaction,
) {
  const paymentMethods = await loadPaymentMethodsById(
    app,
    schedule.userId,
    transaction,
  )
  const occurrences = await loadOccurrencesBySchedule(
    app,
    [schedule.id],
    transaction,
  )
  return toScheduleInput(
    schedule,
    occurrences.get(schedule.id) ?? [],
    paymentMethods,
  )
}

async function scheduleView(
  app: AppDependencies,
  schedule: ScheduleModel,
  transaction?: Transaction,
): Promise<Schedule> {
  const accounts = await loadAccountInputs(app, schedule.userId, transaction)
  const tagIds = await tagIdsBySchedule(app, [schedule.id], transaction)
  return toSchedule(
    schedule,
    await scheduleInputOf(app, schedule, transaction),
    tagIds.get(schedule.id) ?? [],
    activeAccountsById(accounts),
    today(app),
  )
}

export const listSchedulesRoute = defineUserRoute({
  method: 'get',
  path: '/schedules',
  summary:
    'List the schedules with their monthly equivalent and next occurrence, and the monthly totals of the active ones (ECH-10)',
  tag,
  body: noBody,
  params: noParams,
  responses: {
    200: { description: 'Schedules', schema: scheduleListResponseSchema },
    ...accessErrors,
  },
  handle: async ({ app, user }) => {
    const { views, inputs, accounts } = await loadScheduleViews(
      app,
      user.id,
      today(app),
    )
    return {
      status: 200,
      body: {
        schedules: views,
        totals: scheduleTotals(inputs, views, accounts),
      },
    }
  },
})

export const createScheduleRoute = defineUserRoute({
  method: 'post',
  path: '/schedules',
  summary: 'Create an expense, income or transfer schedule (ECH-01 to ECH-06)',
  tag,
  body: createScheduleRequestSchema,
  params: noParams,
  responses: {
    201: { description: 'Schedule created', schema: scheduleSchema },
    400: errorResponse(
      'Invalid body, inconsistent recurrence or category of another kind',
    ),
    ...resourceErrors,
    409: errorResponse(
      'Archived account, payment method or category newly referenced',
    ),
  },
  handle: async ({ app, user, body }) => {
    const schedule = await app.sequelize.transaction(async (transaction) => {
      await validateScheduleReferences(app, user.id, body, null, transaction)
      const created = await app.models.Schedule.create(
        { ...scheduleColumns(body), userId: user.id },
        { transaction },
      )
      await replaceScheduleTags(
        app,
        user.id,
        created.id,
        body.tagIds,
        transaction,
      )
      return created
    })
    return { status: 201, body: await scheduleView(app, schedule) }
  },
})

export const updateScheduleRoute = defineUserRoute({
  method: 'patch',
  path: '/schedules/:id',
  summary:
    'Modify a schedule, its kind excepted; only the non-executed occurrences change and exceptions whose original date no longer exists are removed (ECH-08)',
  tag,
  body: updateScheduleRequestSchema,
  params: resourceIdParamsSchema,
  responses: {
    200: {
      description: 'Schedule modified, with the number of removed exceptions',
      schema: updateScheduleResponseSchema,
    },
    400: errorResponse(
      'Invalid body, field not applicable to the kind, inconsistent recurrence or category of another kind',
    ),
    ...resourceErrors,
    409: errorResponse(
      'Archived account, payment method or category newly referenced',
    ),
  },
  handle: async ({ app, user, params, body }) => {
    const result = await app.sequelize.transaction(async (transaction) => {
      const schedule = await findUserSchedule(
        app,
        user.id,
        params.id,
        transaction,
      )
      const tagIds = await tagIdsBySchedule(app, [schedule.id], transaction)
      const fields = mergeScheduleUpdate(
        schedule,
        tagIds.get(schedule.id) ?? [],
        body,
      )
      await validateScheduleReferences(
        app,
        user.id,
        fields,
        schedule,
        transaction,
      )
      await schedule.update(scheduleColumns(fields), { transaction })
      await replaceScheduleTags(
        app,
        user.id,
        schedule.id,
        fields.tagIds,
        transaction,
      )
      const rows = await app.models.ScheduleOccurrence.findAll({
        where: { scheduleId: schedule.id },
        transaction,
      })
      const orphans = orphanedExceptions(
        scheduleRecurrence(schedule),
        rows.map(toOccurrenceException),
      )
      if (orphans.length > 0) {
        await app.models.ScheduleOccurrence.destroy({
          where: {
            scheduleId: schedule.id,
            originalDate: {
              [Op.in]: orphans.map((orphan) => orphan.originalDate),
            },
            state: { [Op.ne]: 'executed' },
          },
          transaction,
        })
      }
      return {
        schedule: await scheduleView(app, schedule, transaction),
        removedExceptions: orphans.length,
      }
    })
    return { status: 200, body: result }
  },
})

export const deleteScheduleRoute = defineUserRoute({
  method: 'delete',
  path: '/schedules/:id',
  summary:
    'Delete a schedule and its occurrence exceptions; operations already generated stay',
  tag,
  body: noBody,
  params: resourceIdParamsSchema,
  responses: {
    204: { description: 'Schedule deleted' },
    ...resourceErrors,
  },
  handle: async ({ app, user, params }) => {
    const schedule = await findUserSchedule(app, user.id, params.id)
    await schedule.destroy()
    return { status: 204 }
  },
})

export const listScheduleOccurrencesRoute = defineUserRoute({
  method: 'get',
  path: '/schedules/:id/occurrences',
  summary:
    'Occurrences of a schedule from today to the end of the forecast horizon of the user, skipped ones included',
  tag,
  body: noBody,
  params: resourceIdParamsSchema,
  responses: {
    200: {
      description: 'Occurrences',
      schema: scheduleOccurrenceListResponseSchema,
    },
    ...resourceErrors,
  },
  handle: async ({ app, user, params }) => {
    const schedule = await findUserSchedule(app, user.id, params.id)
    const from = today(app)
    const to = forecastEndDate(from, user.forecastHorizonMonths)
    const input = await scheduleInputOf(app, schedule)
    const occurrences = input.active
      ? occurrencesBetween(input, from, to).map((occurrence) =>
          toScheduleOccurrence(occurrence, from),
        )
      : []
    return { status: 200, body: { from, to, occurrences } }
  },
})

async function writeException(
  app: AppDependencies,
  scheduleId: string,
  originalDate: string,
  values: Pick<
    ScheduleOccurrenceAttributes,
    'state' | 'effectiveDate' | 'amountCents'
  >,
  transaction: Transaction,
): Promise<void> {
  const row = await app.models.ScheduleOccurrence.findOne({
    where: { scheduleId, originalDate },
    transaction,
  })
  if (row === null) {
    await app.models.ScheduleOccurrence.create(
      { scheduleId, originalDate, ...values },
      { transaction },
    )
  } else {
    await row.update(values, { transaction })
  }
}

export const overrideOccurrenceRoute = defineUserRoute({
  method: 'post',
  path: '/schedules/:id/occurrences/:originalDate/override',
  summary:
    'Override the amount or the date of one future occurrence without changing the schedule (ECH-07)',
  tag,
  body: overrideOccurrenceRequestSchema,
  params: occurrenceParamsSchema,
  responses: {
    200: {
      description: 'Occurrence overridden',
      schema: scheduleOccurrenceSchema,
    },
    400: errorResponse('Invalid body or new date not after today'),
    ...resourceErrors,
    409: errorResponse(
      'Occurrence executed, skipped, not after today, or of an inactive schedule',
    ),
  },
  handle: async ({ app, user, params, body }) => {
    const from = today(app)
    if (body.effectiveDate !== null && body.effectiveDate <= from) {
      throw validationFailed([
        { path: ['effectiveDate'], message: 'date_not_future' },
      ])
    }
    const occurrence = await app.sequelize.transaction(async (transaction) => {
      const schedule = await findUserSchedule(
        app,
        user.id,
        params.id,
        transaction,
      )
      const input = await scheduleInputOf(app, schedule, transaction)
      const current = editableOccurrence(input, params.originalDate, from)
      if (current.status !== 'pending') {
        throw conflict('occurrence_not_editable')
      }
      await writeException(
        app,
        schedule.id,
        params.originalDate,
        {
          state: 'overridden',
          effectiveDate: body.effectiveDate,
          amountCents: body.amountCents,
        },
        transaction,
      )
      return currentOccurrence(
        await scheduleInputOf(app, schedule, transaction),
        params.originalDate,
        from,
      )
    })
    return { status: 200, body: occurrence }
  },
})

export const skipOccurrenceRoute = defineUserRoute({
  method: 'post',
  path: '/schedules/:id/occurrences/:originalDate/skip',
  summary: 'Skip one future occurrence without changing the schedule (ECH-07)',
  tag,
  body: noBody,
  params: occurrenceParamsSchema,
  responses: {
    200: {
      description: 'Occurrence skipped',
      schema: scheduleOccurrenceSchema,
    },
    ...resourceErrors,
    409: errorResponse(
      'Occurrence executed, already skipped, not after today, or of an inactive schedule',
    ),
  },
  handle: async ({ app, user, params }) => {
    const from = today(app)
    const occurrence = await app.sequelize.transaction(async (transaction) => {
      const schedule = await findUserSchedule(
        app,
        user.id,
        params.id,
        transaction,
      )
      const input = await scheduleInputOf(app, schedule, transaction)
      const current = editableOccurrence(input, params.originalDate, from)
      if (current.status !== 'pending') {
        throw conflict('occurrence_not_editable')
      }
      const exception = input.exceptions.find(
        (candidate) => candidate.originalDate === params.originalDate,
      )
      await writeException(
        app,
        schedule.id,
        params.originalDate,
        {
          state: 'skipped',
          effectiveDate: exception?.effectiveDate ?? null,
          amountCents: exception?.amountCents ?? null,
        },
        transaction,
      )
      return currentOccurrence(
        await scheduleInputOf(app, schedule, transaction),
        params.originalDate,
        from,
      )
    })
    return { status: 200, body: occurrence }
  },
})

export const restoreOccurrenceRoute = defineUserRoute({
  method: 'delete',
  path: '/schedules/:id/occurrences/:originalDate',
  summary:
    'Remove the exception of one future occurrence: its amount and date come back from the schedule',
  tag,
  body: noBody,
  params: occurrenceParamsSchema,
  responses: {
    200: {
      description: 'Occurrence restored',
      schema: scheduleOccurrenceSchema,
    },
    ...resourceErrors,
    409: errorResponse(
      'Occurrence without exception, executed, not after today, or of an inactive schedule',
    ),
  },
  handle: async ({ app, user, params }) => {
    const from = today(app)
    const occurrence = await app.sequelize.transaction(async (transaction) => {
      const schedule = await findUserSchedule(
        app,
        user.id,
        params.id,
        transaction,
      )
      const input = await scheduleInputOf(app, schedule, transaction)
      const current = editableOccurrence(input, params.originalDate, from)
      if (current.status === 'pending' && !current.overridden) {
        throw conflict('occurrence_not_editable')
      }
      await app.models.ScheduleOccurrence.destroy({
        where: {
          scheduleId: schedule.id,
          originalDate: params.originalDate,
          state: { [Op.ne]: 'executed' },
        },
        transaction,
      })
      return currentOccurrence(
        await scheduleInputOf(app, schedule, transaction),
        params.originalDate,
        from,
      )
    })
    return { status: 200, body: occurrence }
  },
})

export const listSubscriptionsRoute = defineUserRoute({
  method: 'get',
  path: '/subscriptions',
  summary:
    'Active subscriptions with their monthly equivalent and next occurrence, and their monthly and annual totals (ECH-09)',
  tag,
  body: noBody,
  params: noParams,
  responses: {
    200: {
      description: 'Subscriptions',
      schema: subscriptionListResponseSchema,
    },
    ...accessErrors,
  },
  handle: async ({ app, user }) => ({
    status: 200,
    body: subscriptionList(await loadScheduleViews(app, user.id, today(app))),
  }),
})
