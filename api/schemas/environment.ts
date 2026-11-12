import { z } from 'zod'

const portSchema = z.coerce.number().int().min(1).max(65_535)

export const databaseEnvironmentSchema = z.object({
  DATABASE_HOST: z.string().min(1),
  DATABASE_PORT: portSchema,
  DATABASE_NAME: z.string().min(1),
  DATABASE_USER: z.string().min(1),
  DATABASE_PASSWORD: z.string().min(1),
})

export const serverEnvironmentSchema = databaseEnvironmentSchema.extend({
  PORT: portSchema,
})

export const testDatabaseEnvironmentSchema = z.object({
  POSTGRES_DB: z.string().min(1),
  POSTGRES_USER: z.string().min(1),
  POSTGRES_PASSWORD: z.string().min(1),
  DB_HOST_PORT: portSchema,
})
