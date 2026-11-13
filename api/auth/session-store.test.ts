import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createClient,
  createTestContext,
  createTestUser,
} from '../tests/context.js'
import type { TestContext } from '../types/tests.js'
import { SequelizeSessionStore } from './session-store.js'

let context: TestContext

beforeAll(async () => {
  context = await createTestContext()
})

afterAll(async () => {
  await context.close()
})

function storeOf(testContext: TestContext): SequelizeSessionStore {
  const { sequelize, models, clock } = testContext.dependencies
  return new SequelizeSessionStore(sequelize, models, clock)
}

describe('SequelizeSessionStore', () => {
  it('discards a session whose stored data is not valid', async () => {
    const user = await createTestUser(context, { email: 'store@example.org' })
    const client = createClient(context.server)
    await client.login(user.email)
    const { Session } = context.dependencies.models
    const row = await Session.findOne({ where: { userId: user.id } })
    await row?.update({ data: { cookie: 'broken' } })

    const loaded = await new Promise((resolve, reject) => {
      storeOf(context).get(row?.sid ?? '', (error, data) =>
        error ? reject(error) : resolve(data),
      )
    })

    expect(loaded).toBeNull()
    expect(await Session.count({ where: { userId: user.id } })).toBe(0)
  })
})
