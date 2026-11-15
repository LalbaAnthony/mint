import { z } from 'zod'
import { apiErrorResponseSchema } from '@mint/shared/schemas/errors'

export const noBody = z.unknown().transform(() => undefined)

export const noParams = z.object({})

export const noQuery = z.object({})

export const errorResponse = (description: string) => ({
  description,
  schema: apiErrorResponseSchema,
})
