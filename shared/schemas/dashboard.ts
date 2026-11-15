import { z } from 'zod'
import { isoDateSchema } from './common.js'
import { allocationTargetsSchema } from './user.js'

export const breakdownQuerySchema = z
  .object({
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
  })
  .refine(
    (query) =>
      query.from === undefined ||
      query.to === undefined ||
      query.from <= query.to,
    { error: 'end_before_start', path: ['to'] },
  )
  .meta({ id: 'BreakdownQuery' })

const groupSpendingSchema = z.object({
  totalCents: z.number().int(),
  categories: z.array(
    z.object({ categoryId: z.uuid(), totalCents: z.number().int() }),
  ),
})

export const breakdownResponseSchema = z
  .object({
    from: z.iso.date(),
    to: z.iso.date(),
    needs: groupSpendingSchema,
    wants: groupSpendingSchema,
    saveCents: z.number().int(),
    toCategorizeCents: z.number().int(),
    targets: allocationTargetsSchema,
  })
  .meta({ id: 'BreakdownResponse' })

const incomeExpenseSchema = z.object({
  incomeCents: z.number().int(),
  expenseCents: z.number().int(),
})

export const monthlyReportSchema = z
  .object({
    month: z.iso.date(),
    real: incomeExpenseSchema,
    planned: incomeExpenseSchema,
    balanceCents: z.number().int(),
  })
  .meta({ id: 'MonthlyReport' })

export const monthlyReportResponseSchema = z
  .object({
    today: z.iso.date(),
    currentMonth: z.iso.date(),
    months: z.array(monthlyReportSchema),
  })
  .meta({ id: 'MonthlyReportResponse' })

export const balanceAlertSchema = z
  .object({
    accountId: z.uuid(),
    firstBelowThresholdDate: z.iso.date(),
    minBalanceCents: z.number().int(),
    thresholdCents: z.number().int(),
  })
  .meta({ id: 'BalanceAlert' })

export const dashboardSummarySchema = z
  .object({
    wealthCents: z.number().int(),
    alerts: z.array(balanceAlertSchema),
    toCategorizeCount: z.number().int(),
    pendingProposalsCount: z.number().int(),
    pendingImportIds: z.array(z.uuid()),
  })
  .meta({ id: 'DashboardSummary' })
