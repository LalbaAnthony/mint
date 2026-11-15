import { accountUsages } from '@mint/shared/schemas/accounts'
import type { Account, AccountOverview } from '@mint/shared/types/accounts'
import type { Category } from '@mint/shared/types/categories'
import type {
  EnvelopeMonthLine,
  EnvelopeMonthResponse,
} from '@mint/shared/types/envelopes'
import type { Operation } from '@mint/shared/types/operations'
import type { PaymentMethod } from '@mint/shared/types/payment-methods'
import type { Schedule } from '@mint/shared/types/schedules'
import type { Tag } from '@mint/shared/types/tags'
import type { FakeHandler } from '~~/types/tests'

export const ids = {
  current: '00000000-0000-4000-8000-0000000000a1',
  livret: '00000000-0000-4000-8000-0000000000a2',
  card: '00000000-0000-4000-8000-0000000000b1',
  groceries: '00000000-0000-4000-8000-0000000000c1',
  salary: '00000000-0000-4000-8000-0000000000c2',
  leisure: '00000000-0000-4000-8000-0000000000c3',
  food: '00000000-0000-4000-8000-0000000000c4',
  operation: '00000000-0000-4000-8000-0000000000d1',
  transferGroup: '00000000-0000-4000-8000-0000000000e1',
  schedule: '00000000-0000-4000-8000-0000000000f1',
  envelope: '00000000-0000-4000-8000-0000000000f2',
  holidays: '00000000-0000-4000-8000-0000000000a7',
}

export function euros(
  cents: number,
  signDisplay: 'auto' | 'exceptZero' = 'auto',
) {
  return new Intl.NumberFormat('fr', {
    style: 'currency',
    currency: 'EUR',
    signDisplay,
  }).format(cents / 100)
}

export function account(overrides: Partial<Account> = {}): Account {
  return {
    id: ids.current,
    name: 'Compte courant',
    nature: 'current_account',
    regulatedProduct: null,
    usage: 'current',
    institution: null,
    initialBalanceCents: 200_000,
    initialBalanceDate: '2026-11-01',
    lowBalanceThresholdCents: null,
    sortOrder: 0,
    archivedAt: null,
    currentBalanceCents: 200_000,
    reconciliationGapCents: null,
    investment: null,
    ...overrides,
  }
}

export const livret = account({
  id: ids.livret,
  name: 'Livret A',
  nature: 'regulated_savings',
  regulatedProduct: 'livret_a',
  usage: 'savings',
})

export const card: PaymentMethod = {
  id: ids.card,
  label: 'Carte CA',
  kind: 'card',
  accountId: ids.current,
  archivedAt: null,
}

export function category(overrides: Partial<Category> = {}): Category {
  return {
    id: ids.groceries,
    parentId: null,
    kind: 'expense',
    expenseGroup: 'needs',
    name: 'Courses',
    isSystem: false,
    sortOrder: 0,
    archivedAt: null,
    ...overrides,
  }
}

export const holidaysTag: Tag = {
  id: ids.holidays,
  name: 'Vacances',
  operationCount: 1,
  scheduleCount: 0,
  ruleCount: 0,
}

export const categories: Category[] = [
  category(),
  category({ id: ids.food, name: 'Alimentation', sortOrder: 1 }),
  category({
    id: ids.leisure,
    name: 'Loisirs',
    expenseGroup: 'wants',
    sortOrder: 2,
  }),
  category({
    id: ids.salary,
    kind: 'income',
    expenseGroup: null,
    name: 'Salaire',
  }),
]

export function overview(accounts: Account[]): AccountOverview {
  return {
    totalCents: accounts.reduce(
      (total, item) => total + item.currentBalanceCents,
      0,
    ),
    groups: accountUsages
      .map((usage) => ({
        usage,
        subtotalCents: 0,
        accounts: accounts.filter((item) => item.usage === usage),
      }))
      .filter((group) => group.accounts.length > 0),
    archived: [],
  }
}

export function referentialHandlers(): Record<string, FakeHandler> {
  return {
    'GET /accounts/overview': () => overview([account(), livret]),
    'GET /payment-methods': () => [card],
    'GET /categories': () => categories,
    'GET /tags': () => [holidaysTag],
  }
}

export function operation(overrides: Partial<Operation> = {}): Operation {
  return {
    id: ids.operation,
    accountId: ids.current,
    paymentMethodId: null,
    date: '2026-11-05',
    amountCents: -4_500,
    label: 'Courses',
    note: null,
    categoryId: ids.groceries,
    tagIds: [],
    status: 'categorized',
    origin: 'manual',
    transferGroupId: null,
    counterpartAccountId: null,
    scheduleId: null,
    occurrenceDate: null,
    bankLabel: null,
    reconciled: false,
    unconfirmed: false,
    ...overrides,
  }
}

export function schedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: ids.schedule,
    kind: 'expense',
    label: 'Musique',
    amountCents: 4_416,
    triggerMode: 'auto',
    note: null,
    active: true,
    isSubscription: true,
    accountId: null,
    paymentMethodId: ids.card,
    categoryId: ids.leisure,
    sourceAccountId: null,
    targetAccountId: null,
    frequency: 'yearly',
    interval: 1,
    startDate: '2027-01-25',
    anchorLastDay: false,
    endDate: null,
    maxOccurrences: null,
    businessDayRule: 'exact',
    amountTolerancePct: 10,
    bankLabelPatterns: [],
    tagIds: [],
    createdAt: '2026-11-11T10:00:00.000Z',
    monthlyEquivalentCents: 368,
    nextOccurrence: {
      originalDate: '2027-01-25',
      effectiveDate: '2027-01-25',
      amountCents: 4_416,
      status: 'pending',
      overridden: false,
      editable: true,
    },
    ended: false,
    ...overrides,
  }
}

export function envelopeLine(
  consumedCents: number,
  overrides: Partial<EnvelopeMonthLine['status']> = {},
): EnvelopeMonthLine {
  return {
    envelope: {
      id: ids.envelope,
      label: 'Courses',
      monthlyAmountCents: 30_000,
      accountId: ids.current,
      paymentMethodId: null,
      carryOver: false,
      active: true,
      categoryIds: [ids.groceries],
      createdAt: '2026-10-01T10:00:00.000Z',
    },
    status: {
      budgetCents: 30_000,
      carriedOverCents: 0,
      consumedCents,
      availableCents: 30_000 - consumedCents,
      availablePerDayCents: Math.floor((30_000 - consumedCents) / 20),
      ...overrides,
    },
  }
}

export function envelopeMonth(
  lines: EnvelopeMonthLine[],
  month = '2026-11-01',
): EnvelopeMonthResponse {
  const isCurrent = month === '2026-11-01'
  return {
    month,
    currentMonth: '2026-11-01',
    remainingDays: isCurrent ? 20 : null,
    lines: lines.map((line) =>
      isCurrent
        ? line
        : { ...line, status: { ...line.status, availablePerDayCents: null } },
    ),
    inactive: [],
  }
}

export function findInBody(selector: string): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(selector)
}

export async function fillInput(
  selector: string,
  value: string,
): Promise<void> {
  const input = findInBody(`${selector} input`) ?? findInBody(selector)
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`No input for ${selector}`)
  }
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

export function submit(selector: string): void {
  findInBody(selector)?.dispatchEvent(
    new Event('submit', { bubbles: true, cancelable: true }),
  )
}

export function setViewportWidth(width: number): void {
  const happyDOM: unknown = Reflect.get(window, 'happyDOM')
  if (
    typeof happyDOM !== 'object' ||
    happyDOM === null ||
    !('setViewport' in happyDOM) ||
    typeof happyDOM.setViewport !== 'function'
  ) {
    throw new Error('The front tests require the happy-dom environment')
  }
  happyDOM.setViewport({ width })
}

export function typeInto(root: Element, selector: string, value: string): void {
  const host = root.querySelector(selector)
  const input =
    host instanceof HTMLInputElement ? host : host?.querySelector('input')
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`No input for ${selector}`)
  }
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}
