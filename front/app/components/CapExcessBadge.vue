<script setup lang="ts">
import type { CapExcessBadgeProps } from '~~/types/components'

const props = defineProps<CapExcessBadgeProps>()

const { t } = useI18n()
const { formatMoney } = useFormatters()

const label = computed(() =>
  t('caps.exceeds', { amount: formatMoney(props.excessCents) }),
)
</script>

<template>
  <UBadge
    :label="label"
    :icon="icons.belowThreshold"
    color="warning"
    variant="soft"
    size="sm"
    class="tabular-nums"
    data-testid="cap-excess"
  />
</template>
