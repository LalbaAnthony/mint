import type { Transaction } from 'sequelize'
import { hashPassword } from '../auth/passwords.js'
import { parisDate } from '../clock.js'
import type { CliDatabase } from '../types/cli.js'
import type { CategoryModel, Models } from '../types/models.js'
import type {
  SeedAccount,
  SeedPaymentMethod,
  SeedReferences,
  SeedSubcategoryGroup,
  SeedSummary,
  SeedTopLevelCategory,
  SeedUser,
} from '../types/seed.js'
import {
  defaultCategories,
  systemCategories,
} from '../users/default-categories.js'
import { createUserWithDefaults } from '../users/users.js'
import { seedInitialBalanceDate, seedPlanning } from './seed-planning.js'

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

export const seedAccounts: SeedAccount[] = [
  {
    name: 'Compte courant',
    nature: 'current_account',
    regulatedProduct: null,
    usage: 'current',
    institution: 'Crédit Agricole',
    initialBalanceCents: 200_000,
    lowBalanceThresholdCents: 20_000,
    archived: false,
  },
  {
    name: 'LEP',
    nature: 'regulated_savings',
    regulatedProduct: 'lep',
    usage: 'emergency',
    institution: 'Crédit Agricole',
    initialBalanceCents: 500_000,
    lowBalanceThresholdCents: null,
    archived: false,
  },
  {
    name: 'Livret A',
    nature: 'regulated_savings',
    regulatedProduct: 'livret_a',
    usage: 'savings',
    institution: 'Crédit Agricole',
    initialBalanceCents: 1_200_000,
    lowBalanceThresholdCents: null,
    archived: false,
  },
  {
    name: 'PEA',
    nature: 'securities_account',
    regulatedProduct: null,
    usage: 'investment',
    institution: null,
    initialBalanceCents: 300_000,
    lowBalanceThresholdCents: null,
    archived: false,
  },
  {
    name: 'Compte Revolut',
    nature: 'current_account',
    regulatedProduct: null,
    usage: 'current',
    institution: 'Revolut',
    initialBalanceCents: 0,
    lowBalanceThresholdCents: null,
    archived: true,
  },
]

export const seedPaymentMethods: SeedPaymentMethod[] = [
  {
    label: 'Carte CA',
    kind: 'card',
    accountName: 'Compte courant',
    archived: false,
  },
  {
    label: 'Virement CA',
    kind: 'transfer_out',
    accountName: 'Compte courant',
    archived: false,
  },
  {
    label: 'Prélèvements CA',
    kind: 'third_party',
    accountName: 'Compte courant',
    archived: false,
  },
  {
    label: 'Ancienne carte CA',
    kind: 'card',
    accountName: 'Compte courant',
    archived: true,
  },
  {
    label: 'Carte Revolut',
    kind: 'card',
    accountName: 'Compte Revolut',
    archived: true,
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
    withAccounts: false,
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
      withAccounts: false,
    },
    {
      email: seedCustomizedUserEmail,
      role: 'user',
      locale: 'fr',
      status: 'active',
      lastLoginAt: daysBefore(now, 2),
      customizedCategories: true,
      withAccounts: true,
    },
    {
      email: 'user-en@mint.localhost',
      role: 'user',
      locale: 'en',
      status: 'active',
      lastLoginAt: null,
      customizedCategories: false,
      withAccounts: false,
    },
    {
      email: 'disabled@mint.localhost',
      role: 'user',
      locale: 'fr',
      status: 'disabled',
      lastLoginAt: daysBefore(now, 40),
      customizedCategories: false,
      withAccounts: false,
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
      sortOrder: defaultCategories.length + systemCategories.length + index,
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

async function createAccounts(
  models: Models,
  userId: string,
  now: Date,
  transaction: Transaction,
): Promise<SeedReferences> {
  const accountIds = new Map<string, string>()
  const paymentMethodIds = new Map<string, string>()
  for (const [index, seedAccount] of seedAccounts.entries()) {
    const account = await models.Account.create(
      {
        userId,
        name: seedAccount.name,
        nature: seedAccount.nature,
        regulatedProduct: seedAccount.regulatedProduct,
        usage: seedAccount.usage,
        institution: seedAccount.institution,
        initialBalanceCents: seedAccount.initialBalanceCents,
        initialBalanceDate: seedInitialBalanceDate(parisDate(now)),
        lowBalanceThresholdCents: seedAccount.lowBalanceThresholdCents,
        sortOrder: index,
        archivedAt: seedAccount.archived ? now : null,
      },
      { transaction },
    )
    accountIds.set(seedAccount.name, account.id)
  }
  for (const seedPaymentMethod of seedPaymentMethods) {
    const accountId = accountIds.get(seedPaymentMethod.accountName)
    if (accountId === undefined) {
      throw new Error(
        `Seed account ${seedPaymentMethod.accountName} does not exist`,
      )
    }
    const paymentMethod = await models.PaymentMethod.create(
      {
        userId,
        accountId,
        label: seedPaymentMethod.label,
        kind: seedPaymentMethod.kind,
        archivedAt: seedPaymentMethod.archived ? now : null,
      },
      { transaction },
    )
    paymentMethodIds.set(seedPaymentMethod.label, paymentMethod.id)
  }
  const categories = await models.Category.findAll({
    where: { userId, parentId: null },
    transaction,
  })
  return {
    accounts: accountIds,
    paymentMethods: paymentMethodIds,
    categories: new Map(
      categories.map((category) => [category.name, category.id]),
    ),
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
      if (seedUser.withAccounts) {
        const references = await createAccounts(
          models,
          user.id,
          now,
          transaction,
        )
        await seedPlanning(
          models,
          user.id,
          parisDate(now),
          references,
          transaction,
        )
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
