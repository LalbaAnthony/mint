import type { z } from 'zod'
import type {
  allocationTargetsSchema,
  localeSchema,
  userProfileSchema,
  userRoleSchema,
  userStatusSchema,
} from '../schemas/user.js'

export type Locale = z.infer<typeof localeSchema>

export type UserRole = z.infer<typeof userRoleSchema>

export type UserStatus = z.infer<typeof userStatusSchema>

export type AllocationTargets = z.infer<typeof allocationTargetsSchema>

export type UserProfile = z.infer<typeof userProfileSchema>
