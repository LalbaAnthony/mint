import { z } from 'zod'

export const usageCountsSchema = z
  .object({
    operations: z.number().int(),
    schedules: z.number().int(),
    envelopes: z.number().int(),
    rules: z.number().int(),
  })
  .meta({ id: 'UsageCounts' })
