import type { z } from 'zod'
import type {
  databaseEnvironmentSchema,
  mailEnvironmentSchema,
  serverEnvironmentSchema,
  workerEnvironmentSchema,
} from '../schemas/environment.js'

export type DatabaseEnvironment = z.infer<typeof databaseEnvironmentSchema>

export type MailEnvironment = z.infer<typeof mailEnvironmentSchema>

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>

export type WorkerEnvironment = z.infer<typeof workerEnvironmentSchema>
