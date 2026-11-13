import type { z } from 'zod'
import type {
  changePasswordRequestSchema,
  emailChangeRequestSchema,
  sessionSummarySchema,
  updateProfileRequestSchema,
} from '../schemas/profile.js'

export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>

export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>

export type EmailChangeRequest = z.infer<typeof emailChangeRequestSchema>

export type SessionSummary = z.infer<typeof sessionSummarySchema>
