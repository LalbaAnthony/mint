import type { AccountInput } from '@mint/shared/types/accounts'
import type { ForecastInput } from '@mint/shared/types/forecast'

export type ForecastData = Omit<ForecastInput, 'today' | 'horizonMonths'>

export type ForecastScope = {
  today: string
  horizonMonths: number
  endDate: string
  account: AccountInput | null
  scopeAccounts: AccountInput[]
  activeAccountIds: Set<string>
}
