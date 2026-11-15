import type { AccountInput } from '../types/accounts.js'
import type { CategoryInput } from '../types/categories.js'
import type { EnvelopeInput } from '../types/envelopes.js'
import type { ForecastInput } from '../types/forecast.js'
import type {
  CategorizedPosting,
  OccurrenceException,
  Recurrence,
  ScheduleInput,
  TransferPosting,
} from '../types/schedules.js'
import type { OperationInput } from '../types/transactions.js'

export const today = '2026-11-11'

export function recurrence(overrides: Partial<Recurrence> = {}): Recurrence {
  return {
    frequency: 'monthly',
    interval: 1,
    startDate: '2026-11-05',
    anchorLastDay: false,
    endDate: null,
    maxOccurrences: null,
    businessDayRule: 'exact',
    ...overrides,
  }
}

export function expensePosting(
  overrides: Partial<CategorizedPosting> = {},
): CategorizedPosting {
  return {
    kind: 'expense',
    accountId: 'current',
    paymentMethodId: null,
    categoryId: 'groceries',
    ...overrides,
  }
}

export function incomePosting(
  overrides: Partial<CategorizedPosting> = {},
): CategorizedPosting {
  return expensePosting({ kind: 'income', categoryId: 'salary', ...overrides })
}

export function transferPosting(
  sourceAccountId = 'current',
  targetAccountId = 'livret-a',
): TransferPosting {
  return { kind: 'transfer', sourceAccountId, targetAccountId }
}

export function schedule(
  overrides: Partial<ScheduleInput> = {},
): ScheduleInput {
  return {
    id: 'schedule',
    label: 'Planned',
    amountCents: 10_000,
    active: true,
    isSubscription: false,
    triggerMode: 'auto',
    createdOn: '2026-11-01',
    recurrence: recurrence(),
    posting: expensePosting(),
    exceptions: [],
    system: false,
    ...overrides,
  }
}

export function exception(
  overrides: Partial<OccurrenceException> = {},
): OccurrenceException {
  return {
    originalDate: '2026-12-05',
    state: 'overridden',
    effectiveDate: null,
    amountCents: null,
    ...overrides,
  }
}

export function account(overrides: Partial<AccountInput> = {}): AccountInput {
  return {
    id: 'current',
    usage: 'current',
    initialBalanceCents: 0,
    initialBalanceDate: '2026-11-01',
    lowBalanceThresholdCents: null,
    archived: false,
    valuations: [],
    depositCapCents: null,
    capitalizedInterestCents: 0,
    interest: null,
    ...overrides,
  }
}

export function operation(
  overrides: Partial<OperationInput> = {},
): OperationInput {
  return {
    id: 'operation',
    accountId: 'current',
    date: today,
    amountCents: -1_000,
    categoryId: null,
    transferGroupId: null,
    ...overrides,
  }
}

export function category(
  overrides: Partial<CategoryInput> = {},
): CategoryInput {
  return {
    id: 'groceries',
    parentId: null,
    kind: 'expense',
    expenseGroup: 'needs',
    ...overrides,
  }
}

export const categories: CategoryInput[] = [
  category({ id: 'groceries', expenseGroup: 'needs' }),
  category({ id: 'drive', parentId: 'groceries', expenseGroup: null }),
  category({ id: 'housing', expenseGroup: 'needs' }),
  category({ id: 'leisure', expenseGroup: 'wants' }),
  category({ id: 'restaurants', expenseGroup: 'wants' }),
  category({ id: 'salary', kind: 'income', expenseGroup: null }),
  category({ id: 'adjustment', kind: 'adjustment', expenseGroup: null }),
]

export function envelope(
  overrides: Partial<EnvelopeInput> = {},
): EnvelopeInput {
  return {
    id: 'envelope',
    label: 'Courses',
    accountId: 'current',
    monthlyAmountCents: 30_000,
    carryOver: false,
    active: true,
    createdOn: '2026-10-01',
    categoryIds: ['groceries'],
    monthOverrides: [],
    ...overrides,
  }
}

export function forecastInput(
  overrides: Partial<ForecastInput> = {},
): ForecastInput {
  return {
    today,
    horizonMonths: 3,
    accounts: [account()],
    operations: [],
    schedules: [],
    envelopes: [],
    categories,
    interestCategoryId: 'interest',
    ...overrides,
  }
}
