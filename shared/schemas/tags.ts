import { z } from 'zod'
import { labelSchema } from './common.js'

export const maxTagsPerItem = 20

export const tagIdsSchema = z
  .array(z.uuid({ error: 'invalid' }), { error: 'invalid' })
  .max(maxTagsPerItem, { error: 'too_many_tags' })
  .transform((ids) => [...new Set(ids)])

export const tagRequestSchema = z
  .object({ name: labelSchema })
  .meta({ id: 'TagRequest' })

export const tagSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    operationCount: z.number().int(),
    scheduleCount: z.number().int(),
    ruleCount: z.number().int(),
  })
  .meta({ id: 'Tag' })

export const tagListResponseSchema = z
  .array(tagSchema)
  .meta({ id: 'TagListResponse' })
