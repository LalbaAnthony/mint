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

const vapidShape = {
  VAPID_PUBLIC_KEY: optionalSecretSchema,
  VAPID_PRIVATE_KEY: optionalSecretSchema,
  VAPID_SUBJECT: optionalSecretSchema.pipe(
    z
      .string()
      .regex(/^(mailto:|https:\/\/)/, {
        error: 'VAPID_SUBJECT must be a mailto: or https:// contact',
      })
      .optional(),
  ),
}

function hasCompleteVapidKeys(environment: {
  VAPID_PUBLIC_KEY?: string | undefined
  VAPID_PRIVATE_KEY?: string | undefined
  VAPID_SUBJECT?: string | undefined
}): boolean {
  const defined = [
    environment.VAPID_PUBLIC_KEY,
    environment.VAPID_PRIVATE_KEY,
    environment.VAPID_SUBJECT,
  ].filter((value) => value !== undefined).length
  return defined === 0 || defined === 3
}

const vapidKeysMessage =
  'VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT must be all set or all empty'

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
    ...vapidShape,
  })
  .refine(hasCompleteSmtpCredentials, { error: smtpCredentialsMessage })
  .refine(hasCompleteVapidKeys, { error: vapidKeysMessage })

export const testDatabaseEnvironmentSchema = z.object({
  POSTGRES_DB: z.string().min(1),
  POSTGRES_USER: z.string().min(1),
  POSTGRES_PASSWORD: z.string().min(1),
  DB_HOST_PORT: portSchema,
})

const healthcheckUrlSchema = z
  .string()
  .optional()
  .transform((value) => (value === '' ? undefined : value))
  .pipe(z.url({ protocol: /^https?$/ }).optional())

export const workerEnvironmentSchema = databaseEnvironmentSchema
  .extend({
    HEALTHCHECK_EXECUTION_URL: healthcheckUrlSchema,
    HEALTHCHECK_PURGE_URL: healthcheckUrlSchema,
    HEALTHCHECK_NOTIFICATIONS_URL: healthcheckUrlSchema,
    ...vapidShape,
  })
  .refine(hasCompleteVapidKeys, { error: vapidKeysMessage })
