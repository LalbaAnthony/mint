import {
  searchQuerySchema,
  searchResponseSchema,
} from '@mint/shared/schemas/search'
import { defineUserRoute } from '../http/route.js'
import { errorResponse, noBody, noParams } from '../schemas/http.js'
import { globalSearch } from '../search/search.js'

export const searchRoute = defineUserRoute({
  method: 'get',
  path: '/search',
  summary:
    'Search the accounts, operations, schedules and envelopes by text, case and accent insensitive, or by exact amount, with the values of their views; operations come in batches (RCH-01 to RCH-07)',
  tag: 'search',
  body: noBody,
  params: noParams,
  query: searchQuerySchema,
  responses: {
    200: {
      description:
        'Matching accounts, one batch of matching operations with their total, matching schedules and envelopes',
      schema: searchResponseSchema,
    },
    400: errorResponse('Invalid query'),
    401: errorResponse('No valid session'),
  },
  handle: async ({ app, user, query }) => ({
    status: 200,
    body: await globalSearch(app, user, query),
  }),
})
