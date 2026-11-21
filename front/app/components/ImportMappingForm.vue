<script setup lang="ts">
import {
  csvDateFormats,
  csvDecimalSeparators,
  csvDelimiters,
  csvEncodings,
} from '@mint/shared/schemas/imports'
import type { CsvMapping } from '@mint/shared/types/imports'
import type { SelectItem } from '~~/types/forms'
import type {
  AmountMode,
  ImportMappingFormEmits,
  ImportMappingFormProps,
} from '~~/types/imports'

const props = defineProps<ImportMappingFormProps>()
const emit = defineEmits<ImportMappingFormEmits>()

const { t } = useI18n()

const mapping = reactive<CsvMapping>({ ...props.view.mapping })
const amountColumn = computed({
  get: () => mapping.colAmount ?? 2,
  set: (column: number) => {
    mapping.colAmount = column
  },
})
const debitColumn = computed({
  get: () => mapping.colDebit ?? 2,
  set: (column: number) => {
    mapping.colDebit = column
  },
})
const creditColumn = computed({
  get: () => mapping.colCredit ?? 3,
  set: (column: number) => {
    mapping.colCredit = column
  },
})

const amountMode = ref<AmountMode>(
  props.view.mapping.colAmount === null ? 'split' : 'signed',
)

provideFieldAutofocus({
  values: () => ({
    ...mapping,
    amountMode: amountMode.value,
    colAmount: amountColumn.value,
    colDebit: debitColumn.value,
    colCredit: creditColumn.value,
  }),
})

watch(
  () => props.view.mapping,
  (next) => {
    Object.assign(mapping, next)
    amountMode.value = next.colAmount === null ? 'split' : 'signed'
  },
)

const columnCount = computed(() =>
  Math.max(1, ...props.view.sampleLines.map((line) => line.length)),
)

const headerLine = computed(() => props.view.sampleLines[mapping.skipTop] ?? [])

const columnItems = computed<SelectItem<number>[]>(() =>
  Array.from({ length: columnCount.value }, (_, index) => {
    const title = mapping.hasHeader ? (headerLine.value[index] ?? '') : ''
    return {
      label: t('imports.column', {
        n: index + 1,
        title: title === '' ? '' : ` · ${title}`,
      }),
      value: index,
    }
  }),
)

function options<Value extends string>(values: readonly Value[], key: string) {
  return values.map((value) => ({ label: t(`${key}.${value}`), value }))
}

const delimiterItems = computed(() =>
  options(csvDelimiters, 'imports.delimiters'),
)
const encodingItems = computed(() => options(csvEncodings, 'imports.encodings'))
const decimalItems = computed(() =>
  options(csvDecimalSeparators, 'imports.decimals'),
)
const dateItems = computed(() =>
  csvDateFormats.map((format) => ({
    label: t(`imports.dateFormats.${format}`),
    value: format,
  })),
)
const amountModeItems = computed<SelectItem<AmountMode>[]>(() => [
  { label: t('imports.amountModes.signed'), value: 'signed' },
  { label: t('imports.amountModes.split'), value: 'split' },
])

function submit(): void {
  const signed = amountMode.value === 'signed'
  emit('preview', {
    ...mapping,
    colAmount: signed ? amountColumn.value : null,
    colDebit: signed ? null : debitColumn.value,
    colCredit: signed ? null : creditColumn.value,
  })
}
</script>

<template>
  <div class="flex flex-col gap-4" data-testid="import-mapping">
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <AppFormField :label="t('imports.fields.delimiter')" name="delimiter">
        <USelect
          v-model="mapping.delimiter"
          :items="delimiterItems"
          class="w-full"
          data-testid="import-delimiter"
        />
      </AppFormField>
      <AppFormField :label="t('imports.fields.encoding')" name="encoding">
        <USelect
          v-model="mapping.encoding"
          :items="encodingItems"
          class="w-full"
          data-testid="import-encoding"
        />
      </AppFormField>
      <AppFormField :label="t('imports.fields.dateFormat')" name="dateFormat">
        <USelect
          v-model="mapping.dateFormat"
          :items="dateItems"
          class="w-full"
          data-testid="import-date-format"
        />
      </AppFormField>
      <AppFormField
        :label="t('imports.fields.decimalSeparator')"
        name="decimalSeparator"
      >
        <USelect
          v-model="mapping.decimalSeparator"
          :items="decimalItems"
          class="w-full"
        />
      </AppFormField>
      <AppFormField :label="t('imports.fields.skipTop')" name="skipTop">
        <UInputNumber
          v-model="mapping.skipTop"
          :min="0"
          :max="100"
          class="w-full"
        />
      </AppFormField>
      <AppFormField :label="t('imports.fields.skipBottom')" name="skipBottom">
        <UInputNumber
          v-model="mapping.skipBottom"
          :min="0"
          :max="100"
          class="w-full"
        />
      </AppFormField>
      <USwitch
        v-model="mapping.hasHeader"
        :label="t('imports.fields.hasHeader')"
        class="self-end"
      />
    </div>
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <AppFormField :label="t('imports.fields.colDate')" name="colDate">
        <USelect
          v-model="mapping.colDate"
          :items="columnItems"
          class="w-full"
          data-testid="import-col-date"
        />
      </AppFormField>
      <AppFormField :label="t('imports.fields.colLabel')" name="colLabel">
        <USelect
          v-model="mapping.colLabel"
          :items="columnItems"
          class="w-full"
          data-testid="import-col-label"
        />
      </AppFormField>
      <AppFormField :label="t('imports.fields.amountMode')" name="amountMode">
        <USelect
          v-model="amountMode"
          :items="amountModeItems"
          class="w-full"
          data-testid="import-amount-mode"
        />
      </AppFormField>
      <AppFormField
        v-if="amountMode === 'signed'"
        :label="t('imports.fields.colAmount')"
        name="colAmount"
      >
        <USelect
          v-model="amountColumn"
          :items="columnItems"
          class="w-full"
          data-testid="import-col-amount"
        />
      </AppFormField>
      <template v-else>
        <AppFormField :label="t('imports.fields.colDebit')" name="colDebit">
          <USelect
            v-model="debitColumn"
            :items="columnItems"
            class="w-full"
            data-testid="import-col-debit"
          />
        </AppFormField>
        <AppFormField :label="t('imports.fields.colCredit')" name="colCredit">
          <USelect
            v-model="creditColumn"
            :items="columnItems"
            class="w-full"
            data-testid="import-col-credit"
          />
        </AppFormField>
      </template>
    </div>
    <div class="overflow-x-auto rounded-md border border-default">
      <table class="w-full text-xs" data-testid="import-sample">
        <tbody>
          <tr
            v-for="(line, index) in view.sampleLines"
            :key="index"
            class="border-b border-default last:border-b-0"
            :class="
              index < mapping.skipTop ||
              (mapping.hasHeader && index === mapping.skipTop)
                ? 'text-muted'
                : 'text-default'
            "
          >
            <td class="px-2 py-1 text-muted tabular-nums">{{ index + 1 }}</td>
            <td
              v-for="(cell, column) in line"
              :key="column"
              class="px-2 py-1 whitespace-nowrap"
            >
              {{ cell }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <OfflineGuard v-slot="{ offline }">
      <UButton
        :disabled="offline"
        :label="t('imports.preview')"
        color="primary"
        variant="solid"
        :loading="busy"
        class="self-end"
        data-testid="import-preview"
        @click="submit"
      />
    </OfflineGuard>
  </div>
</template>
