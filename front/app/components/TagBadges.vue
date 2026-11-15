<script setup lang="ts">
import type { TagBadgesProps } from '~~/types/components'

const props = defineProps<TagBadgesProps>()

const { t } = useI18n()
const referentials = useReferentialsStore()

const tags = computed(() => referentials.tagsOf(props.tagIds))
</script>

<template>
  <ul
    v-if="tags.length > 0"
    class="flex flex-wrap gap-1"
    :aria-label="t('tags.listLabel')"
    data-testid="tag-badges"
  >
    <li v-for="tag in tags" :key="tag.id">
      <UBadge :label="tag.name" color="neutral" variant="soft" size="sm" />
    </li>
  </ul>
</template>
