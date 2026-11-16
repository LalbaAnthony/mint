<script setup lang="ts">
import type { OfflineGuardProps } from '~~/types/components'

defineProps<OfflineGuardProps>()

const connectivity = useConnectivityStore()
const { t } = useI18n()
</script>

<template>
  <UTooltip v-if="connectivity.offline" :text="t('offline.writeDisabled')">
    <span
      :class="block ? 'flex w-full' : 'inline-flex'"
      data-testid="offline-guard"
    >
      <slot :offline="true" />
    </span>
  </UTooltip>
  <slot v-else :offline="false" />
</template>
