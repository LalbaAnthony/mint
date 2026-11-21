<script setup lang="ts">
import type { EnvelopeBudgetProps } from '~~/types/planning'

defineProps<EnvelopeBudgetProps>()

const { t } = useI18n()
const { money, spokenMoney } = useAmountMask()
</script>

<template>
  <span class="inline-flex flex-wrap items-center justify-end gap-2">
    <UTooltip
      v-if="line.status.overridden"
      :text="
        t('envelopes.monthlyReference', {
          amount: money(line.envelope.monthlyAmountCents),
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
              amount: spokenMoney(line.envelope.monthlyAmountCents),
            })
          }}
        </span>
      </UBadge>
    </UTooltip>
    <MoneyAmount
      :cents="line.status.budgetCents"
      concealable
      data-testid="envelope-budget"
    />
  </span>
</template>
