import type { Transaction } from 'sequelize'
import { hashPassword } from '../auth/passwords.js'
import type { CliDatabase } from '../types/cli.js'
import type { CategoryModel, Models } from '../types/models.js'
import type {
  SeedSubcategoryGroup,
  SeedSummary,
  SeedTopLevelCategory,
  SeedUser,
} from '../types/seed.js'
import { defaultCategories } from '../users/default-categories.js'
import { createUserWithDefaults } from '../users/users.js'

export const seedPassword = 'mint-dev-only-password'
export const seedAdministratorEmail = 'admin@mint.localhost'
export const seedCustomizedUserEmail = 'user@mint.localhost'
export const seedExtraUserCount = 30

const dayMs = 24 * 60 * 60 * 1000

export const seedTopLevelCategories: SeedTopLevelCategory[] = [
  { kind: 'expense', expenseGroup: 'needs', name: 'Animaux', archived: false },
  { kind: 'expense', expenseGroup: 'wants', name: 'Cadeaux', archived: false },
  { kind: 'expense', expenseGroup: 'wants', name: 'Jardinage', archived: true },
  {
    kind: 'income',
    expenseGroup: null,
    name: "Ventes d'occasion",
    archived: false,
  },
]

export const seedSubcategoryGroups: SeedSubcategoryGroup[] = [
  {
    parentName: 'Logement',
    children: [
      { name: 'Loyer', archived: false },
      { name: 'Charges de copropriété', archived: false },
      { name: 'Travaux', archived: true },
    ],
  },
  {
    parentName: 'Transports',
    children: [
      { name: 'Carburant', archived: false },
      { name: 'Transports en commun', archived: false },
    ],
  },
  {
    parentName: 'Loisirs',
    children: [
      { name: 'Cinéma', archived: false },
      { name: 'Concerts', archived: false },
    ],
  },
  {
    parentName: 'Animaux',
    children: [
      { name: 'Vétérinaire', archived: false },
      { name: 'Nourriture', archived: false },
    ],
  },
  {
    parentName: 'Salaire',
    children: [
      { name: 'Salaire principal', archived: false },
      { name: 'Heures supplémentaires', archived: false },
    ],
  },
]

function daysBefore(now: Date, days: number): Date {
  return new Date(now.getTime() - days * dayMs)
}

function extraUser(index: number, now: Date): SeedUser {
  const number = String(index).padStart(2, '0')
  return {
    email: `user-${number}@mint.localhost`,
    role: 'user',
    locale: index % 2 === 0 ? 'fr' : 'en',
    status: 'active',
    lastLoginAt: index % 3 === 0 ? null : daysBefore(now, index),
    customizedCategories: false,
  }
}

export function seedUsers(now: Date): SeedUser[] {
  const namedUsers: SeedUser[] = [
    {
      email: seedAdministratorEmail,
      role: 'admin',
      locale: 'fr',
      status: 'active',
      lastLoginAt: daysBefore(now, 1),
      customizedCategories: false,
    },
    {
      email: seedCustomizedUserEmail,
      role: 'user',
      locale: 'fr',
      status: 'active',
      lastLoginAt: daysBefore(now, 2),
      customizedCategories: true,
    },
    {
      email: 'user-en@mint.localhost',
      role: 'user',
      locale: 'en',
      status: 'active',
      lastLoginAt: null,
      customizedCategories: false,
    },
    {
      email: 'disabled@mint.localhost',
      role: 'user',
      locale: 'fr',
      status: 'disabled',
      lastLoginAt: daysBefore(now, 40),
      customizedCategories: false,
    },
  ]
  const extraUsers = Array.from({ length: seedExtraUserCount }, (_, index) =>
    extraUser(index + 1, now),
  )
  return [...namedUsers, ...extraUsers]
}

async function wipeUsersAndInvitations(
  models: Models,
  transaction: Transaction,
): Promise<void> {
  await models.Invitation.destroy({ where: {}, transaction })
  await models.User.destroy({ where: {}, transaction })
}

async function findTopLevelCategory(
  models: Models,
  userId: string,
  name: string,
  transaction: Transaction,
): Promise<CategoryModel> {
  const category = await models.Category.findOne({
    where: { userId, parentId: null, name },
    transaction,
  })
  if (category === null) {
    throw new Error(`Seed parent category ${name} does not exist`)
  }
  return category
}

async function customizeCategories(
  models: Models,
  userId: string,
  now: Date,
  transaction: Transaction,
): Promise<void> {
  await models.Category.bulkCreate(
    seedTopLevelCategories.map((category, index) => ({
      userId,
      kind: category.kind,
      expenseGroup: category.expenseGroup,
      name: category.name,
      sortOrder: defaultCategories.length + index,
      archivedAt: category.archived ? now : null,
    })),
    { transaction },
  )
  for (const group of seedSubcategoryGroups) {
    const parent = await findTopLevelCategory(
      models,
      userId,
      group.parentName,
      transaction,
    )
    await models.Category.bulkCreate(
      group.children.map((child, index) => ({
        userId,
        parentId: parent.id,
        kind: parent.kind,
        expenseGroup: null,
        name: child.name,
        sortOrder: index,
        archivedAt: child.archived ? now : null,
      })),
      { transaction },
    )
  }
}

export async function seedDatabase(
  { sequelize, models }: CliDatabase,
  now: Date,
): Promise<SeedSummary> {
  const passwordHash = await hashPassword(seedPassword)
  const users = seedUsers(now)
  await sequelize.transaction(async (transaction) => {
    await wipeUsersAndInvitations(models, transaction)
    for (const seedUser of users) {
      const user = await createUserWithDefaults(
        models,
        {
          email: seedUser.email,
          passwordHash,
          role: seedUser.role,
          locale: seedUser.locale,
        },
        transaction,
      )
      await user.update(
        { status: seedUser.status, lastLoginAt: seedUser.lastLoginAt },
        { transaction },
      )
      if (seedUser.customizedCategories) {
        await customizeCategories(models, user.id, now, transaction)
      }
    }
  })
  return {
    users: users.length,
    administratorEmail: seedAdministratorEmail,
    customizedUserEmail: seedCustomizedUserEmail,
    password: seedPassword,
  }
}
