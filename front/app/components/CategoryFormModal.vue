<script setup lang="ts">
import {
  categorySchema,
  createCategoryRequestSchema,
  editableCategoryKinds,
  expenseGroups,
  updateCategoryRequestSchema,
} from '@mint/shared/schemas/categories'
import type {
  EditableCategoryKind,
  ExpenseGroup,
  UpdateCategoryRequest,
} from '@mint/shared/types/categories'
import type {
  CategoryFormModalEmits,
  CategoryFormModalProps,
} from '~~/types/components'
import type { CategoryFormState, SelectItem } from '~~/types/forms'

const props = defineProps<CategoryFormModalProps>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<CategoryFormModalEmits>()

const { t } = useI18n()
const toast = useToast()
const { validator, errorMessage } = useFormValidation()

const saving = ref(false)
const state = reactive<CategoryFormState>({
  name: '',
  kind: 'expense',
  expenseGroup: 'needs',
  parentId: null,
})

const edited = computed(() => props.category)
const isFirstLevel = computed(() =>
  edited.value === null
    ? props.parent === null
    : edited.value.parentId === null,
)
const showsKind = computed(() => edited.value === null && props.parent === null)
const showsGroup = computed(
  () => isFirstLevel.value && state.kind === 'expense',
)
const showsParent = computed(
  () => edited.value !== null && edited.value.parentId !== null,
)

const title = computed(() => {
  if (edited.value !== null) {
    return t('categories.editTitle')
  }
  return props.parent === null
    ? t('categories.createTitle')
    : t('categories.createChildTitle', { parent: props.parent.name })
})

watch(
  open,
  (isOpen) => {
    if (!isOpen) {
      return
    }
    const category = props.category
    if (category !== null) {
      Object.assign(state, {
        name: category.name,
        kind: category.kind === 'income' ? 'income' : 'expense',
        expenseGroup: category.parentId === null ? category.expenseGroup : null,
        parentId: category.parentId,
      })
      return
    }
    const parent = props.parent
    Object.assign(state, {
      name: '',
      kind: parent?.kind === 'income' ? 'income' : 'expense',
      expenseGroup: parent === null ? 'needs' : null,
      parentId: parent?.id ?? null,
    })
  },
  { immediate: true },
)

watch(
  () => state.kind,
  (kind) => {
    if (showsKind.value) {
      state.expenseGroup = kind === 'expense' ? 'needs' : null
    }
  },
)

const expenseGroupModel = computed({
  get: () => state.expenseGroup ?? undefined,
  set: (group: ExpenseGroup | undefined) => {
    state.expenseGroup = group ?? null
  },
})

const parentIdModel = computed({
  get: () => state.parentId ?? undefined,
  set: (parentId: string | undefined) => {
    state.parentId = parentId ?? null
  },
})

const kindItems = computed<SelectItem<EditableCategoryKind>[]>(() =>
  editableCategoryKinds.map((kind) => ({
    label: t(`categories.kinds.${kind}`),
    value: kind,
  })),
)

const groupItems = computed<SelectItem<ExpenseGroup>[]>(() =>
  expenseGroups.map((group) => ({ label: t(`groups.${group}`), value: group })),
)

const parentItems = computed<SelectItem<string>[]>(() =>
  props.parents
    .filter((parent) => parent.kind === edited.value?.kind)
    .map((parent) => ({ label: parent.name, value: parent.id })),
)

function validate(formState: unknown) {
  return edited.value === null
    ? validator(createCategoryRequestSchema)(formState)
    : validator(updateCategoryRequestSchema)(updateBody())
}

function updateBody(): UpdateCategoryRequest {
  if (showsParent.value && state.parentId !== null) {
    return { name: state.name, parentId: state.parentId }
  }
  if (showsGroup.value && state.expenseGroup !== null) {
    return { name: state.name, expenseGroup: state.expenseGroup }
  }
  return { name: state.name }
}

async function submit(): Promise<void> {
  saving.value = true
  try {
    const category = edited.value
    const saved =
      category === null
        ? await apiCall(
            'POST',
            '/categories',
            categorySchema,
            createCategoryRequestSchema.parse(state),
          )
        : await apiCall(
            'PATCH',
            `/categories/${category.id}`,
            categorySchema,
            updateCategoryRequestSchema.parse(updateBody()),
          )
    emit('saved', saved)
    open.value = false
  } catch (error) {
    toast.add({ title: errorMessage(error), icon: icons.error, color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="title">
    <template #body>
      <UForm
        :state="state"
        :validate="validate"
        :validate-on="['blur']"
        class="flex flex-col gap-4"
        data-testid="category-form"
        @submit="submit"
      >
        <AppFormField :label="t('categories.fields.name')" name="name">
          <UInput
            v-model="state.name"
            class="w-full"
            data-testid="category-name-input"
          />
        </AppFormField>
        <AppFormField
          v-if="showsKind"
          :label="t('categories.fields.kind')"
          name="kind"
        >
          <USelect
            v-model="state.kind"
            :items="kindItems"
            class="w-full"
            data-testid="category-kind"
          />
        </AppFormField>
        <AppFormField
          v-if="showsGroup"
          :label="t('categories.fields.group')"
          name="expenseGroup"
        >
          <USelect
            v-model="expenseGroupModel"
            :items="groupItems"
            class="w-full"
            data-testid="category-group"
          />
        </AppFormField>
        <AppFormField
          v-if="showsParent"
          :label="t('categories.fields.parent')"
          name="parentId"
        >
          <USelect
            v-model="parentIdModel"
            :items="parentItems"
            class="w-full"
            data-testid="category-parent"
          />
        </AppFormField>
        <OfflineGuard block v-slot="{ offline }">
          <UButton
            :disabled="offline"
            type="submit"
            :label="t('common.save')"
            :loading="saving"
            color="primary"
            variant="solid"
            block
            data-testid="category-submit"
          />
        </OfflineGuard>
      </UForm>
    </template>
  </UModal>
</template>
