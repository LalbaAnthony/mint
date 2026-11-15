import {
  balanceCurveResponseSchema,
  calendarMonthParamsSchema,
  calendarMonthResponseSchema,
  forecastScopeQuerySchema,
} from '@mint/shared/schemas/forecast'
import { parisDate } from '../clock.js'
import { balanceCurve, calendarMonth } from '../forecast/views.js'
import { defineUserRoute } from '../http/route.js'
import { errorResponse, noBody, noParams } from '../schemas/http.js'

const tag = 'forecast'

const scopeErrors = {
  401: errorResponse('No valid session'),
  404: errorResponse('Unknown account'),
  409: errorResponse('Archived account'),
}

export const balanceCurveRoute = defineUserRoute({
  method: 'get',
  path: '/forecast/curve',
  summary:
    'Real end-of-day balance of the last 30 days and forecast balance up to the end of the horizon, for one account or all active accounts (DSH-01, PRV-01 to PRV-09)',
  tag,
  body: noBody,
  params: noParams,
  query: forecastScopeQuerySchema,
  responses: {
    200: { description: 'Balance curve', schema: balanceCurveResponseSchema },
    400: errorResponse('Invalid account or horizon'),
    ...scopeErrors,
  },
  handle: async ({ app, user, query }) => ({
    status: 200,
    body: await balanceCurve(app, user, query, parisDate(app.clock.now())),
  }),
})

export const calendarMonthRoute = defineUserRoute({
  method: 'get',
  path: '/calendar/:month',
  summary:
    'Days of one month: real operations and end-of-day balance in the past, planned occurrences, envelope shares and forecast balance up to the end of the horizon (CAL-01 to CAL-05)',
  tag,
  body: noBody,
  params: calendarMonthParamsSchema,
  query: forecastScopeQuerySchema,
  responses: {
    200: {
      description: 'Calendar month',
      schema: calendarMonthResponseSchema,
    },
    400: errorResponse(
      'Invalid account or horizon, or month before the history or after the horizon',
    ),
    ...scopeErrors,
  },
  handle: async ({ app, user, params, query }) => ({
    status: 200,
    body: await calendarMonth(
      app,
      user,
      params.month,
      query,
      parisDate(app.clock.now()),
    ),
  }),
})
