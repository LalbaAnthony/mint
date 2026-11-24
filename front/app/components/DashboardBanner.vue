<script setup lang="ts">
import type { DashboardBannerProps } from '~~/types/dashboard'

const props = defineProps<DashboardBannerProps>()

const { t } = useI18n()
const { formatDate } = useFormatters()
const referentials = useReferentialsStore()

const alertCount = computed(
  () => props.summary.alerts.length + props.summary.capAlerts.length,
)

const manualPaymentsLink = computed(() => {
  const next = props.summary.nextManualPayment
  return next === null
    ? '/calendar'
    : `/calendar?account=${next.accountId}&day=${next.date}`
})

const proposalsLink = computed(() => {
  const [latest] = props.summary.pendingImportIds
  return latest === undefined ? '/import' : `/import?batch=${latest}`
})
</script>

<template>
  <StatGrid :columns="4" data-testid="dashboard-banner">
    <UCard data-testid="dashboard-alerts">
      <p class="flex items-center gap-2 text-sm font-medium text-muted">
        <UIcon :name="icons.belowThreshold" class="size-5 text-warning" />
        {{ t('dashboard.alerts', alertCount) }}
      </p>
      <ul v-if="alertCount > 0" class="mt-2 flex flex-col gap-1">
        <li
          v-for="alert in summary.alerts"
          :key="alert.accountId"
          class="flex flex-wrap items-center gap-1 text-sm text-default"
        >
          <span class="font-medium">
            {{ referentials.accountName(alert.accountId) }}
          </span>
          <span class="text-muted">
            {{
              t('dashboard.belowFrom', {
                date: formatDate(alert.firstBelowThresholdDate),
              })
            }}
          </span>
          <MoneyAmount
            :cents="alert.minBalanceCents"
            :threshold="alert.thresholdCents"
            concealable
          />
        </li>
        <li
          v-for="alert in summary.capAlerts"
          :key="`cap-${alert.accountId}`"
          class="flex flex-wrap items-center gap-1 text-sm text-default"
          data-testid="dashboard-cap-alert"
        >
          <span class="font-medium">
            {{ referentials.accountName(alert.accountId) }}
          </span>
          <span class="text-muted">
            {{ t('dashboard.capFrom', { date: formatDate(alert.date) }) }}
          </span>
          <CapExcessBadge :excess-cents="alert.excessCents" concealable />
        </li>
      </ul>
      <p v-else class="mt-2 text-sm text-muted">
        {{ t('dashboard.noAlert') }}
      </p>
    </UCard>
    <UCard>
      <NuxtLink
        :to="manualPaymentsLink"
        class="flex items-center justify-between gap-2"
        data-testid="dashboard-manual-payments"
      >
        <span class="flex items-center gap-2 text-sm font-medium text-muted">
          <UIcon :name="icons.manualMode" class="size-5" />
          {{ t('dashboard.manualPayments') }}
        </span>
        <span
          class="rounded-full bg-accent-fill px-2 text-xs font-semibold text-accent-on-fill tabular-nums"
        >
          {{ summary.manualPaymentsCount }}
        </span>
      </NuxtLink>
    </UCard>
    <UCard>
      <NuxtLink
        to="/operations?status=to_categorize"
        class="flex items-center justify-between gap-2"
        data-testid="dashboard-to-categorize"
      >
        <span class="flex items-center gap-2 text-sm font-medium text-muted">
          <UIcon :name="icons.uncategorized" class="size-5" />
          {{ t('dashboard.toCategorize') }}
        </span>
        <span
          class="rounded-full bg-accent-fill px-2 text-xs font-semibold text-accent-on-fill tabular-nums"
        >
          {{ summary.toCategorizeCount }}
        </span>
      </NuxtLink>
    </UCard>
    <UCard>
      <NuxtLink
        :to="proposalsLink"
        class="flex items-center justify-between gap-2"
        data-testid="dashboard-proposals"
      >
        <span class="flex items-center gap-2 text-sm font-medium text-muted">
          <UIcon :name="icons.reconciled" class="size-5" />
          {{ t('dashboard.proposals') }}
        </span>
        <span
          class="rounded-full bg-accent-fill px-2 text-xs font-semibold text-accent-on-fill tabular-nums"
        >
          {{ summary.pendingProposalsCount }}
        </span>
      </NuxtLink>
    </UCard>
  </StatGrid>
</template>
