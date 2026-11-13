import { z } from 'zod'

const portSchema = z.coerce.number().int().min(1).max(65_535)

const optionalSecretSchema = z
  .string()
  .optional()
  .transform((value) => (value === '' ? undefined : value))

export const databaseEnvironmentSchema = z.object({
  DATABASE_HOST: z.string().min(1),
  DATABASE_PORT: portSchema,
  DATABASE_NAME: z.string().min(1),
  DATABASE_USER: z.string().min(1),
  DATABASE_PASSWORD: z.string().min(1),
})

const mailEnvironmentShape = {
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: portSchema,
  SMTP_TLS_MODE: z.enum(['tls', 'starttls', 'none']),
  SMTP_USER: optionalSecretSchema,
  SMTP_PASSWORD: optionalSecretSchema,
  MAIL_FROM: z.string().min(3),
}

function hasCompleteSmtpCredentials(environment: {
  SMTP_USER: string | undefined
  SMTP_PASSWORD: string | undefined
}): boolean {
  return (
    (environment.SMTP_USER === undefined) ===
    (environment.SMTP_PASSWORD === undefined)
  )
}

const smtpCredentialsMessage =
  'SMTP_USER and SMTP_PASSWORD must be both set or both empty'

export const mailEnvironmentSchema = z
  .object(mailEnvironmentShape)
  .refine(hasCompleteSmtpCredentials, { error: smtpCredentialsMessage })

const appOriginSchema = z
  .url({ protocol: /^https?$/ })
  .refine((value) => new URL(value).origin === value, {
    error: 'APP_ORIGIN must be an origin, without path or trailing slash',
  })

export const serverEnvironmentSchema = databaseEnvironmentSchema
  .extend({
    PORT: portSchema,
    APP_ORIGIN: appOriginSchema,
    SESSION_SECRET: z.string().min(32),
    ...mailEnvironmentShape,
  })
  .refine(hasCompleteSmtpCredentials, { error: smtpCredentialsMessage })

export const testDatabaseEnvironmentSchema = z.object({
  POSTGRES_DB: z.string().min(1),
  POSTGRES_USER: z.string().min(1),
  POSTGRES_PASSWORD: z.string().min(1),
  DB_HOST_PORT: portSchema,
})
