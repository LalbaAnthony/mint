import {
  breakdownQuerySchema,
  breakdownResponseSchema,
  dashboardSummarySchema,
  monthlyReportResponseSchema,
} from '@mint/shared/schemas/dashboard'
import { forecastScopeQuerySchema } from '@mint/shared/schemas/forecast'
import { parisDate } from '../clock.js'
import {
  breakdown,
  dashboardSummary,
  monthlyReport,
} from '../dashboard/dashboard.js'
import { defineUserRoute } from '../http/route.js'
import { errorResponse, noBody, noParams } from '../schemas/http.js'

const tag = 'dashboard'

const accessErrors = { 401: errorResponse('No valid session') }

const horizonQuerySchema = forecastScopeQuerySchema
  .pick({ horizonMonths: true })
  .meta({ id: 'HorizonQuery' })

export const dashboardSummaryRoute = defineUserRoute({
  method: 'get',
  path: '/dashboard/summary',
  summary:
    'Total wealth of the active accounts, accounts whose forecast balance goes below their threshold within 7 days, operations to categorize and pending reconciliation proposals (DSH-04)',
  tag,
  body: noBody,
  params: noParams,
  responses: {
    200: { description: 'Summary', schema: dashboardSummarySchema },
    ...accessErrors,
  },
  handle: async ({ app, user }) => ({
    status: 200,
    body: await dashboardSummary(
      app,
      user.id,
      parisDate(app.clock.now()),
      user.forecastHorizonMonths,
    ),
  }),
})

export const breakdownRoute = defineUserRoute({
  method: 'get',
  path: '/dashboard/breakdown',
  summary:
    'Spending of a period, the current month by default, by group Needs, Wants and Save and by category, compared with the allocation targets, adjustments excluded (DSH-02, CAT-03, CAT-06)',
  tag,
  body: noBody,
  params: noParams,
  query: breakdownQuerySchema,
  responses: {
    200: { description: 'Breakdown', schema: breakdownResponseSchema },
    400: errorResponse('Invalid period'),
    ...accessErrors,
  },
  handle: async ({ app, user, query }) => ({
    status: 200,
    body: await breakdown(app, user, query, parisDate(app.clock.now())),
  }),
})

export const monthlyReportRoute = defineUserRoute({
  method: 'get',
  path: '/dashboard/monthly',
  summary:
    'Incomes and expenses per month: the 12 last months in real, the current month completed by its planned rest, the months of the horizon planned (occurrences and envelopes), internal transfers excluded (DSH-03)',
  tag,
  body: noBody,
  params: noParams,
  query: horizonQuerySchema,
  responses: {
    200: { description: 'Monthly report', schema: monthlyReportResponseSchema },
    400: errorResponse('Invalid horizon'),
    ...accessErrors,
  },
  handle: async ({ app, user, query }) => ({
    status: 200,
    body: await monthlyReport(
      app,
      user,
      query.horizonMonths ?? user.forecastHorizonMonths,
      parisDate(app.clock.now()),
    ),
  }),
})
