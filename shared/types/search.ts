import type { z } from 'zod'
import type {
  searchEnvelopeSchema,
  searchOperationsSchema,
  searchQuerySchema,
  searchResponseSchema,
} from '../schemas/search.js'

export type SearchQuery = z.infer<typeof searchQuerySchema>

export type SearchEnvelope = z.infer<typeof searchEnvelopeSchema>

export type SearchOperations = z.infer<typeof searchOperationsSchema>

export type SearchResponse = z.infer<typeof searchResponseSchema>
