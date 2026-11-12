import type { z } from 'zod'
import type {
  databaseEnvironmentSchema,
  serverEnvironmentSchema,
} from '../schemas/environment.js'

export type DatabaseEnvironment = z.infer<typeof databaseEnvironmentSchema>

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>
