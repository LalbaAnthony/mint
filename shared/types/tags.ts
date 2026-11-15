import type { z } from 'zod'
import type {
  tagListResponseSchema,
  tagRequestSchema,
  tagSchema,
} from '../schemas/tags.js'

export type TagRequest = z.infer<typeof tagRequestSchema>

export type Tag = z.infer<typeof tagSchema>

export type TagListResponse = z.infer<typeof tagListResponseSchema>
