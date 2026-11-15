import { describe, expect, it } from 'vitest'
import { parseEnvironment } from './environment.js'
import {
  mailEnvironmentSchema,
  serverEnvironmentSchema,
  workerEnvironmentSchema,
} from './schemas/environment.js'

const validEnvironment = {
  PORT: '3000',
  DATABASE_HOST: 'db',
  DATABASE_PORT: '5432',
  DATABASE_NAME: 'mint',
  DATABASE_USER: 'mint',
  DATABASE_PASSWORD: 'secret-value',
  APP_ORIGIN: 'https://mint.dev-it.app',
  SESSION_SECRET: 'a-session-secret-of-at-least-32-characters',
  SMTP_HOST: 'smtp.example.org',
  SMTP_PORT: '587',
  SMTP_TLS_MODE: 'starttls',
  SMTP_USER: 'mint',
  SMTP_PASSWORD: 'smtp-secret',
  MAIL_FROM: 'Mint <no-reply@example.org>',
}

describe('parseEnvironment', () => {
  it('returns the variables with ports converted to numbers', () => {
    expect(parseEnvironment(serverEnvironmentSchema, validEnvironment)).toEqual(
      {
        ...validEnvironment,
        PORT: 3000,
        DATABASE_PORT: 5432,
        SMTP_PORT: 587,
      },
    )
  })

  it('names the missing variable', () => {
    const { DATABASE_HOST: _omitted, ...withoutHost } = validEnvironment

    expect(() =>
      parseEnvironment(serverEnvironmentSchema, withoutHost),
    ).toThrow(/DATABASE_HOST/)
  })

  it('rejects an invalid port without echoing the values', () => {
    const parse = () =>
      parseEnvironment(serverEnvironmentSchema, {
        ...validEnvironment,
        PORT: 'not-a-port',
      })

    expect(parse).toThrow(/PORT/)
    expect(parse).not.toThrow(/secret-value/)
  })

  it.each([
    'https://mint.dev-it.app/',
    'https://mint.dev-it.app/app',
    'ftp://mint.dev-it.app',
  ])('rejects the application origin %s', (origin) => {
    expect(() =>
      parseEnvironment(serverEnvironmentSchema, {
        ...validEnvironment,
        APP_ORIGIN: origin,
      }),
    ).toThrow(/APP_ORIGIN/)
  })

  it('rejects a session secret shorter than 32 characters', () => {
    expect(() =>
      parseEnvironment(serverEnvironmentSchema, {
        ...validEnvironment,
        SESSION_SECRET: 'too-short',
      }),
    ).toThrow(/SESSION_SECRET/)
  })
})

describe('VAPID keys (NOTIF-03)', () => {
  const vapid = {
    VAPID_PUBLIC_KEY: 'vapid-public-key',
    VAPID_PRIVATE_KEY: 'vapid-private-key',
    VAPID_SUBJECT: 'mailto:admin@example.org',
  }

  it('accepts the three keys together or none of them', () => {
    expect(
      parseEnvironment(serverEnvironmentSchema, {
        ...validEnvironment,
        ...vapid,
      }),
    ).toMatchObject(vapid)
    const disabled = parseEnvironment(workerEnvironmentSchema, {
      ...validEnvironment,
      VAPID_PUBLIC_KEY: '',
      VAPID_PRIVATE_KEY: '',
      VAPID_SUBJECT: '',
    })
    expect(disabled.VAPID_PUBLIC_KEY).toBeUndefined()
    expect(disabled.VAPID_PRIVATE_KEY).toBeUndefined()
    expect(disabled.VAPID_SUBJECT).toBeUndefined()
  })

  it('rejects a partial configuration without echoing the keys', () => {
    const parse = () =>
      parseEnvironment(workerEnvironmentSchema, {
        ...validEnvironment,
        VAPID_PUBLIC_KEY: vapid.VAPID_PUBLIC_KEY,
        VAPID_PRIVATE_KEY: vapid.VAPID_PRIVATE_KEY,
      })

    expect(parse).toThrow(/must be all set or all empty/)
    expect(parse).not.toThrow(/vapid-private-key/)
  })

  it('requires a mailto: or https:// subject', () => {
    expect(() =>
      parseEnvironment(serverEnvironmentSchema, {
        ...validEnvironment,
        ...vapid,
        VAPID_SUBJECT: 'admin@example.org',
      }),
    ).toThrow(/VAPID_SUBJECT/)
  })
})

describe('mailEnvironmentSchema', () => {
  const mailEnvironment = {
    SMTP_HOST: 'mailpit',
    SMTP_PORT: '1025',
    SMTP_TLS_MODE: 'none',
    MAIL_FROM: 'Mint <no-reply@mint.localhost>',
  }

  it('accepts a server without authentication, empty values included', () => {
    expect(
      mailEnvironmentSchema.parse({
        ...mailEnvironment,
        SMTP_USER: '',
        SMTP_PASSWORD: '',
      }),
    ).toEqual({
      ...mailEnvironment,
      SMTP_PORT: 1025,
      SMTP_USER: undefined,
      SMTP_PASSWORD: undefined,
    })
  })

  it('rejects a user without password', () => {
    expect(
      mailEnvironmentSchema.safeParse({ ...mailEnvironment, SMTP_USER: 'mint' })
        .success,
    ).toBe(false)
  })
})
