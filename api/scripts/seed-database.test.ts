import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { verifyPassword } from '../auth/passwords.js'
import { createModels } from '../db/models.js'
import { createMigratedDatabase } from '../tests/database.js'
import type { CliDatabase } from '../types/cli.js'
import type { IsolatedDatabase } from '../types/tests.js'
import { defaultCategories } from '../users/default-categories.js'
import { createUserWithDefaults } from '../users/users.js'
import {
  seedAdministratorEmail,
  seedCustomizedUserEmail,
  seedDatabase,
  seedExtraUserCount,
  seedPassword,
  seedSubcategoryGroups,
  seedTopLevelCategories,
} from './seed-database.js'

const now = new Date('2026-11-11T10:00:00Z')
const namedUserCount = 4

describe('seedDatabase', () => {
  let database: IsolatedDatabase
  let cli: CliDatabase

  beforeAll(async () => {
    database = await createMigratedDatabase()
    cli = {
      sequelize: database.sequelize,
      models: createModels(database.sequelize),
    }
    await seedDatabase(cli, now)
  })

  afterAll(() => database.drop())

  async function findUser(email: string) {
    const user = await cli.models.User.findOne({ where: { email } })
    if (user === null) {
      throw new Error(`Seeded user ${email} is missing`)
    }
    return user
  }

  it('creates one administrator, one disabled user and the extra users', async () => {
    const users = await cli.models.User.findAll()

    expect(users).toHaveLength(namedUserCount + seedExtraUserCount)
    expect(
      users.filter((user) => user.role === 'admin').map((user) => user.email),
    ).toEqual([seedAdministratorEmail])
    expect(
      users
        .filter((user) => user.status === 'disabled')
        .map((user) => user.email),
    ).toEqual(['disabled@mint.localhost'])
    expect(new Set(users.map((user) => user.locale))).toEqual(
      new Set(['fr', 'en']),
    )
    expect(users.some((user) => user.lastLoginAt === null)).toBe(true)
  })

  it('gives every seeded user the development password', async () => {
    const administrator = await findUser(seedAdministratorEmail)
    const extraUser = await findUser('user-30@mint.localhost')

    expect(await verifyPassword(administrator.passwordHash, seedPassword)).toBe(
      true,
    )
    expect(await verifyPassword(extraUser.passwordHash, seedPassword)).toBe(
      true,
    )
    expect(administrator.lastLoginAt).toEqual(new Date('2026-11-10T10:00:00Z'))
  })

  it('creates the default categories in the user locale', async () => {
    const user = await findUser('user-en@mint.localhost')
    const categories = await cli.models.Category.findAll({
      where: { userId: user.id },
      order: [['sortOrder', 'ASC']],
    })

    expect(categories.map((category) => category.name)).toEqual(
      defaultCategories.map((category) => category.names.en),
    )
  })

  it('adds custom, archived and second-level categories to the customized user', async () => {
    const user = await findUser(seedCustomizedUserEmail)
    const categories = await cli.models.Category.findAll({
      where: { userId: user.id },
    })
    const byName = new Map(
      categories.map((category) => [category.name, category]),
    )
    const subcategoryCount = seedSubcategoryGroups.reduce(
      (total, group) => total + group.children.length,
      0,
    )

    expect(categories).toHaveLength(
      defaultCategories.length +
        seedTopLevelCategories.length +
        subcategoryCount,
    )
    expect(byName.get('Jardinage')?.archivedAt).toEqual(now)
    expect(byName.get('Animaux')?.archivedAt).toBeNull()

    const housing = byName.get('Logement')
    const works = byName.get('Travaux')
    expect(works?.parentId).toBe(housing?.id)
    expect(works?.archivedAt).toEqual(now)
    expect(works?.kind).toBe('expense')
    expect(works?.expenseGroup).toBeNull()

    const salary = byName.get('Salaire')
    const mainSalary = byName.get('Salaire principal')
    expect(mainSalary?.parentId).toBe(salary?.id)
    expect(mainSalary?.kind).toBe('income')
  })

  it('deletes every user and invitation before seeding again', async () => {
    const intruder = await cli.sequelize.transaction((transaction) =>
      createUserWithDefaults(
        cli.models,
        {
          email: 'manual@mint.localhost',
          passwordHash: 'hash',
          role: 'user',
          locale: 'fr',
        },
        transaction,
      ),
    )
    await cli.models.Invitation.create({
      email: 'invited@mint.localhost',
      tokenHash: 'token-hash',
      invitedBy: intruder.id,
      expiresAt: now,
    })

    await seedDatabase(cli, now)

    expect(await cli.models.User.count()).toBe(
      namedUserCount + seedExtraUserCount,
    )
    expect(
      await cli.models.User.count({
        where: { email: 'manual@mint.localhost' },
      }),
    ).toBe(0)
    expect(await cli.models.Invitation.count()).toBe(0)
    expect(
      await cli.models.Category.count({ where: { userId: intruder.id } }),
    ).toBe(0)
  })
})
