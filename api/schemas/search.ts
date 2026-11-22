import { z } from 'zod'

export const searchIdRowsSchema = z.array(z.object({ id: z.uuid() }))

export const searchCountRowsSchema = z
  .array(z.object({ total: z.coerce.number().int() }))
  .length(1)
