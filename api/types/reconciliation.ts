import type { z } from 'zod'
import type { operationSnapshotSchema } from '../schemas/imports.js'

export type OccurrenceTarget = {
  scheduleId: string
  originalDate: string
}

export type OperationSnapshot = z.infer<typeof operationSnapshotSchema>
