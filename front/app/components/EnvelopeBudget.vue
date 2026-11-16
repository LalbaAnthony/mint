<script setup lang="ts">
import type { EnvelopeBudgetProps } from '~~/types/planning'

defineProps<EnvelopeBudgetProps>()

const { t } = useI18n()
const { formatMoney } = useFormatters()
</script>

<template>
  <span class="inline-flex flex-wrap items-center justify-end gap-2">
    <UTooltip
      v-if="line.status.overridden"
      :text="
        t('envelopes.monthlyReference', {
          amount: formatMoney(line.envelope.monthlyAmountCents),
        })
      "
    >
      <UBadge
        color="neutral"
        variant="soft"
        size="sm"
        data-testid="envelope-overridden"
      >
        {{ t('envelopes.overridden') }}
        <span class="sr-only">
          {{
            t('envelopes.monthlyReference', {
              amount: formatMoney(line.envelope.monthlyAmountCents),
            })
          }}
        </span>
      </UBadge>
    </UTooltip>
    <MoneyAmount
      :cents="line.status.budgetCents"
      data-testid="envelope-budget"
    />
  </span>
</template>
