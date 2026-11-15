import type { z } from 'zod'
import type {
  accountDeletionRequestSchema,
  changePasswordRequestSchema,
  emailChangeRequestSchema,
  exportRequestSchema,
  sessionSummarySchema,
  updateProfileRequestSchema,
} from '../schemas/profile.js'

export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>

export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>

export type EmailChangeRequest = z.infer<typeof emailChangeRequestSchema>

export type SessionSummary = z.infer<typeof sessionSummarySchema>

export type ExportRequest = z.infer<typeof exportRequestSchema>

export type AccountDeletionRequest = z.infer<
  typeof accountDeletionRequestSchema
>
