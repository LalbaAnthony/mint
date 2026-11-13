import request from 'supertest'
import type { Express } from 'express'
import { csrfTokenResponseSchema } from '@mint/shared/schemas/auth'
import type { Locale, UserRole } from '@mint/shared/types/user'
import { apiPrefix, createApp } from '../app.js'
import { hashPassword } from '../auth/passwords.js'
import { createModels } from '../db/models.js'
import { isDatabaseReachable } from '../db/sequelize.js'
import { createLimiters } from '../dependencies.js'
import type { AppDependencies } from '../types/app.js'
import type { UserModel } from '../types/models.js'
import type {
  FakeClock,
  MemoryMailer,
  TestContext,
  TestContextOptions,
} from '../types/tests.js'
import type { MailMessage } from '../types/mail.js'
import { createUserWithDefaults } from '../users/users.js'
import { createMigratedDatabase } from './database.js'

export const testPassword = 'correct horse battery'

export function createFakeClock(start: Date): FakeClock {
  let current = start.getTime()
  return {
    now: () => new Date(current),
    set: (date) => {
      current = date.getTime()
    },
    advance: (milliseconds) => {
      current += milliseconds
    },
  }
}

export function createMemoryMailer(): MemoryMailer {
  const messages: MailMessage[] = []
  let shouldFail = false
  return {
    messages,
    send: async (message) => {
      if (shouldFail) {
        shouldFail = false
        throw new Error('SMTP unavailable')
      }
      messages.push(message)
    },
    failNext: () => {
      shouldFail = true
    },
    tokenSentTo: (email) => {
      const message = messages.findLast((candidate) => candidate.to === email)
      const token = message?.text.match(/#token=([A-Za-z0-9_-]+)/)?.[1]
      if (token === undefined) {
        throw new Error(`No link was sent to ${email}`)
      }
      return token
    },
  }
}

export async function createTestContext(
  options: TestContextOptions = {},
): Promise<TestContext> {
  const database = await createMigratedDatabase()
  const clock = createFakeClock(options.now ?? new Date('2026-11-11T10:00:00Z'))
  const mailer = createMemoryMailer()
  const dependencies: AppDependencies = {
    config: {
      appOrigin: options.appOrigin ?? 'http://mint.test',
      sessionSecret: 'test-session-secret-of-at-least-32-characters',
    },
    sequelize: database.sequelize,
    models: createModels(database.sequelize),
    mailer,
    clock,
    limiters: createLimiters(clock),
    checkDatabase:
      options.checkDatabase ?? (() => isDatabaseReachable(database.sequelize)),
  }
  return {
    dependencies,
    server: createApp(dependencies),
    clock,
    mailer,
    close: database.drop,
  }
}

export async function createTestUser(
  context: TestContext,
  input: {
    email: string
    role?: UserRole
    locale?: Locale
    password?: string
  },
): Promise<UserModel> {
  const { models, sequelize } = context.dependencies
  const passwordHash = await hashPassword(input.password ?? testPassword)
  return sequelize.transaction((transaction) =>
    createUserWithDefaults(
      models,
      {
        email: input.email,
        passwordHash,
        role: input.role ?? 'user',
        locale: input.locale ?? 'fr',
      },
      transaction,
    ),
  )
}

export function createClient(server: Express) {
  const agent = request.agent(server)

  async function csrfToken(): Promise<string> {
    const response = await agent.get(`${apiPrefix}/csrf`)
    return csrfTokenResponseSchema.parse(response.body).token
  }

  async function send(
    method: 'post' | 'patch' | 'delete',
    path: string,
    body?: object,
  ) {
    const token = await csrfToken()
    const url = `${apiPrefix}${path}`
    const pending =
      method === 'post'
        ? agent.post(url)
        : method === 'patch'
          ? agent.patch(url)
          : agent.delete(url)
    pending.set('X-CSRF-Token', token)
    return body === undefined ? pending : pending.send(body)
  }

  return {
    agent,
    csrfToken,
    get: (path: string) => agent.get(`${apiPrefix}${path}`),
    post: (path: string, body?: object) => send('post', path, body),
    patch: (path: string, body?: object) => send('patch', path, body),
    delete: (path: string, body?: object) => send('delete', path, body),
    login: (email: string, password = testPassword) =>
      send('post', '/auth/login', { email, password }),
  }
}
