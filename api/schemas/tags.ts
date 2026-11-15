import { z } from 'zod'

export const tagUsageRowsSchema = z.array(
  z.object({
    id: z.uuid(),
    name: z.string(),
    operationCount: z.coerce.number().int(),
    scheduleCount: z.coerce.number().int(),
    ruleCount: z.coerce.number().int(),
  }),
)
