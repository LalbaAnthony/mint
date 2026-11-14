import type { Transaction } from 'sequelize'
import type { Locale } from '@mint/shared/types/user'
import type { DefaultCategory, SystemCategory } from '../types/categories.js'
import type { Models } from '../types/models.js'

export const defaultCategories: DefaultCategory[] = [
  {
    kind: 'expense',
    expenseGroup: 'needs',
    names: { fr: 'Logement', en: 'Housing' },
  },
  {
    kind: 'expense',
    expenseGroup: 'needs',
    names: { fr: 'Courses', en: 'Groceries' },
  },
  {
    kind: 'expense',
    expenseGroup: 'needs',
    names: { fr: 'Alimentation', en: 'Food' },
  },
  {
    kind: 'expense',
    expenseGroup: 'needs',
    names: { fr: 'Transports', en: 'Transport' },
  },
  {
    kind: 'expense',
    expenseGroup: 'needs',
    names: { fr: 'Santé', en: 'Health' },
  },
  {
    kind: 'expense',
    expenseGroup: 'needs',
    names: { fr: 'Énergie et télécoms', en: 'Energy and telecoms' },
  },
  {
    kind: 'expense',
    expenseGroup: 'needs',
    names: { fr: 'Assurances', en: 'Insurance' },
  },
  {
    kind: 'expense',
    expenseGroup: 'wants',
    names: { fr: 'Loisirs', en: 'Leisure' },
  },
  {
    kind: 'expense',
    expenseGroup: 'wants',
    names: { fr: 'Restaurants', en: 'Restaurants' },
  },
  {
    kind: 'expense',
    expenseGroup: 'wants',
    names: { fr: 'Shopping', en: 'Shopping' },
  },
  {
    kind: 'expense',
    expenseGroup: 'wants',
    names: { fr: 'Sport', en: 'Sport' },
  },
  {
    kind: 'expense',
    expenseGroup: 'wants',
    names: { fr: 'Services numériques', en: 'Digital services' },
  },
  {
    kind: 'expense',
    expenseGroup: 'wants',
    names: { fr: 'Voyages', en: 'Travel' },
  },
  {
    kind: 'income',
    expenseGroup: null,
    names: { fr: 'Salaire', en: 'Salary' },
  },
  {
    kind: 'income',
    expenseGroup: null,
    names: { fr: 'Aides', en: 'Benefits' },
  },
  {
    kind: 'income',
    expenseGroup: null,
    names: { fr: 'Primes', en: 'Bonuses' },
  },
  {
    kind: 'income',
    expenseGroup: null,
    names: { fr: 'Remboursements', en: 'Refunds' },
  },
  {
    kind: 'income',
    expenseGroup: null,
    names: { fr: 'Autres revenus', en: 'Other income' },
  },
]

export const systemCategories: SystemCategory[] = [
  { kind: 'income', names: { fr: 'Intérêts', en: 'Interest' } },
  { kind: 'adjustment', names: { fr: 'Ajustement', en: 'Adjustment' } },
]

export async function createDefaultCategories(
  models: Models,
  userId: string,
  locale: Locale,
  transaction: Transaction,
): Promise<void> {
  await models.Category.bulkCreate(
    [
      ...defaultCategories.map((category, index) => ({
        userId,
        kind: category.kind,
        expenseGroup: category.expenseGroup,
        name: category.names[locale],
        sortOrder: index,
      })),
      ...systemCategories.map((category, index) => ({
        userId,
        kind: category.kind,
        expenseGroup: null,
        name: category.names[locale],
        isSystem: true,
        sortOrder: defaultCategories.length + index,
      })),
    ],
    { transaction },
  )
}
