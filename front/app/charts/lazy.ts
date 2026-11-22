import BalanceCurveChartSkeleton from '~/components/BalanceCurveChartSkeleton.vue'
import BreakdownChartSkeleton from '~/components/BreakdownChartSkeleton.vue'
import MonthlyChartSkeleton from '~/components/MonthlyChartSkeleton.vue'
import ValuationChartSkeleton from '~/components/ValuationChartSkeleton.vue'

export const balanceCurveChart = lazyComponent(
  () => import('~/components/BalanceCurveChart.vue'),
  BalanceCurveChartSkeleton,
)

export const breakdownChart = lazyComponent(
  () => import('~/components/BreakdownChart.vue'),
  BreakdownChartSkeleton,
)

export const monthlyChart = lazyComponent(
  () => import('~/components/MonthlyChart.vue'),
  MonthlyChartSkeleton,
)

export const valuationChart = lazyComponent(
  () => import('~/components/ValuationChart.vue'),
  ValuationChartSkeleton,
)
