<script setup lang="ts">
import {
  categoryListResponseSchema,
  categorySchema,
} from '@mint/shared/schemas/categories'
import type { Category } from '@mint/shared/types/categories'
import type {
  CategoryAction,
  CategorySectionId,
  DataTone,
} from '~~/types/referentials'

const { t } = useI18n()
const toast = useToast()
const { errorMessage } = useFormValidation()

const categories = ref<Category[]>([])
const reordering = ref(false)
const busy = ref(false)

function sectionTone(id: CategorySectionId): DataTone | null {
  return id === 'needs' || id === 'wants' ? id : null
}

const sections = computed(() =>
  buildCategorySections(categories.value).map((section) => ({
    ...section,
    tone: sectionTone(section.id),
  })),
)

const parentCandidates = computed(() =>
  categories.value.filter(
    (category) =>
      category.parentId === null &&
      !category.isSystem &&
      category.archivedAt === null,
  ),
)

function sectionTitle(id: CategorySectionId): string {
  switch (id) {
    case 'needs':
    case 'wants':
      return t(`groups.${id}`)
    case 'income':
      return t('categories.sections.income')
    case 'system':
      return t('categories.sections.system')
  }
}

function notify(title: string): void {
  toast.add({ title, icon: icons.success, color: 'success' })
}

function notifyFailure(error: unknown): void {
  toast.add({ title: errorMessage(error), icon: icons.error, color: 'error' })
}

const loadState = useLoadState({ onError: notifyFailure })

async function fetchCategories(): Promise<void> {
  categories.value = await apiGet('/categories', categoryListResponseSchema)
}

function load(): Promise<void> {
  return loadState.run(fetchCategories, 'background')
}

async function run(action: () => Promise<void>): Promise<void> {
  busy.value = true
  try {
    await action()
  } catch (error) {
    notifyFailure(error)
  } finally {
    busy.value = false
    await load()
  }
}

function activeChildCount(category: Category): number {
  return categories.value.filter(
    (child) => child.parentId === category.id && child.archivedAt === null,
  ).length
}

const formOpen = ref(false)
const editedCategory = ref<Category | null>(null)
const parentCategory = ref<Category | null>(null)

function openForm(category: Category | null, parent: Category | null): void {
  editedCategory.value = category
  parentCategory.value = parent
  formOpen.value = true
}

async function saved(category: Category): Promise<void> {
  notify(t('categories.saved', { name: category.name }))
  await load()
}

const categoryToDelete = ref<Category | null>(null)
const deleteOpen = computed({
  get: () => categoryToDelete.value !== null,
  set: (open) => {
    if (!open) {
      categoryToDelete.value = null
    }
  },
})

async function categoryDeleted(category: Category): Promise<void> {
  categoryToDelete.value = null
  notify(t('categories.deleted', { name: category.name }))
  await load()
}

function onAction({ kind, category }: CategoryAction): Promise<void> {
  switch (kind) {
    case 'edit':
      openForm(category, null)
      return Promise.resolve()
    case 'addChild':
      openForm(null, category)
      return Promise.resolve()
    case 'delete':
      categoryToDelete.value = category
      return Promise.resolve()
    case 'archive':
      return run(async () => {
        const count = activeChildCount(category)
        await apiCall(
          'POST',
          `/categories/${category.id}/archive`,
          categorySchema,
        )
        notify(
          t(
            'categories.archivedNotice',
            { name: category.name, n: count },
            count,
          ),
        )
      })
    case 'restore':
      return run(async () => {
        await apiCall(
          'POST',
          `/categories/${category.id}/restore`,
          categorySchema,
        )
        notify(t('categories.restoredNotice', { name: category.name }))
      })
  }
}

function reorder(categoryIds: string[]): Promise<void> {
  categories.value = applyCategoryOrder(categories.value, categoryIds)
  return run(async () => {
    await apiCommand('POST', '/categories/reorder', { categoryIds })
  })
}

onMounted(() => loadState.run(fetchCategories))

const categoryRows = useRememberedRows(
  'categories',
  loadState,
  () =>
    sections.value.map((section) =>
      section.nodes.reduce(
        (total, node) => total + 1 + node.children.length,
        0,
      ),
    ),
  sections.value.map(() => skeletonRowCount),
)
</script>

<template>
  <UCard data-testid="category-manager">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-base font-semibold text-highlighted">
          {{ t('categories.title') }}
        </h2>
        <div class="flex flex-wrap gap-2">
          <OfflineGuard v-slot="{ offline }">
            <UButton
              :disabled="offline"
              :icon="reordering ? icons.success : icons.reorder"
              :label="
                reordering ? t('common.doneReordering') : t('common.reorder')
              "
              :aria-pressed="reordering"
              color="primary"
              variant="soft"
              data-testid="categories-reorder"
              @click="reordering = !reordering"
            />
          </OfflineGuard>
          <OfflineGuard v-slot="{ offline }">
            <UButton
              :disabled="offline"
              :icon="icons.add"
              :label="t('categories.add')"
              color="primary"
              variant="soft"
              data-testid="categories-add"
              @click="openForm(null, null)"
            />
          </OfflineGuard>
        </div>
      </div>
    </template>
    <LoadZone :state="loadState" class="flex flex-col gap-6">
      <template #skeleton>
        <section
          v-for="(section, sectionIndex) in sections"
          :key="section.id"
          class="flex flex-col gap-1"
        >
          <h3 class="flex items-center gap-2 text-sm font-medium text-default">
            <DataDot v-if="section.tone !== null" :tone="section.tone" />
            {{ sectionTitle(section.id) }}
          </h3>
          <p v-if="section.id === 'system'" class="text-xs text-muted">
            {{ t('categories.system.help') }}
          </p>
          <SkeletonList
            :count="categoryRows[sectionIndex] ?? skeletonRowCount"
            :row="{ padding: 1.5 }"
            class="divide-y divide-default"
          >
            <template #default="{ index }">
              <div class="min-w-0 flex-1">
                <SkeletonText
                  :width="skeletonRowWidth(index)"
                  class="text-sm"
                />
              </div>
              <SkeletonControl kind="touch-icon-button" />
            </template>
          </SkeletonList>
        </section>
      </template>
      <div class="flex flex-col gap-6">
        <section
          v-for="section in sections"
          :key="section.id"
          :data-testid="`category-section-${section.id}`"
          class="flex flex-col gap-1"
        >
          <h3 class="flex items-center gap-2 text-sm font-medium text-default">
            <DataDot v-if="section.tone !== null" :tone="section.tone" />
            {{ sectionTitle(section.id) }}
          </h3>
          <p v-if="section.id === 'system'" class="text-xs text-muted">
            {{ t('categories.system.help') }}
          </p>
          <CategoryList
            :nodes="section.nodes"
            :reordering="reordering"
            @reorder="reorder"
            @action="onAction"
          />
        </section>
      </div>
    </LoadZone>

    <CategoryFormModal
      v-model:open="formOpen"
      :category="editedCategory"
      :parent="parentCategory"
      :parents="parentCandidates"
      @saved="saved"
    />

    <CategoryDeleteModal
      v-model:open="deleteOpen"
      :category="categoryToDelete"
      :categories="categories"
      @deleted="categoryDeleted"
    />
  </UCard>
</template>
