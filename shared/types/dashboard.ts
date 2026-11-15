import type { z } from 'zod'
import type {
  balanceAlertSchema,
  breakdownQuerySchema,
  breakdownResponseSchema,
  dashboardSummarySchema,
  monthlyReportResponseSchema,
  monthlyReportSchema,
} from '../schemas/dashboard.js'

export type BreakdownQuery = z.infer<typeof breakdownQuerySchema>

export type BreakdownResponse = z.infer<typeof breakdownResponseSchema>

export type MonthlyReport = z.infer<typeof monthlyReportSchema>

export type MonthlyReportResponse = z.infer<typeof monthlyReportResponseSchema>

export type BalanceAlert = z.infer<typeof balanceAlertSchema>

export type DashboardSummary = z.infer<typeof dashboardSummarySchema>
