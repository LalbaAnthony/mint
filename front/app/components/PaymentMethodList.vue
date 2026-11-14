<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { PaymentMethod } from '@mint/shared/types/payment-methods'
import type {
  PaymentMethodListEmits,
  PaymentMethodListProps,
} from '~~/types/components'
import type { PaymentMethodActionKind } from '~~/types/referentials'

const props = defineProps<PaymentMethodListProps>()
const emit = defineEmits<PaymentMethodListEmits>()

const { t } = useI18n()

function actionItems(paymentMethod: PaymentMethod): DropdownMenuItem[][] {
  const select = (kind: PaymentMethodActionKind) =>
    emit('paymentMethodAction', { kind, paymentMethod })
  const remove: DropdownMenuItem = {
    label: t('common.delete'),
    icon: icons.delete,
    color: 'error',
    onSelect: () => select('delete'),
  }
  if (paymentMethod.archivedAt !== null) {
    return [
      [
        {
          label: t('common.restore'),
          icon: icons.restore,
          onSelect: () => select('restore'),
        },
      ],
      [remove],
    ]
  }
  return [
    [
      {
        label: t('common.edit'),
        icon: icons.edit,
        onSelect: () => select('edit'),
      },
      {
        label: t('common.archive'),
        icon: icons.archive,
        onSelect: () => select('archive'),
      },
    ],
    [remove],
  ]
}
</script>

<template>
  <div
    class="flex flex-col gap-2 pb-3 pl-10"
    :data-testid="`payment-methods-${props.account.id}`"
  >
    <h3 class="sr-only">
      {{ t('paymentMethods.of', { name: account.name }) }}
    </h3>
    <ul v-if="paymentMethods.length > 0" class="flex flex-col">
      <li
        v-for="paymentMethod in paymentMethods"
        :key="paymentMethod.id"
        class="flex items-center gap-2 rounded-md py-1 pl-2"
        :data-testid="`payment-method-${paymentMethod.id}`"
      >
        <UIcon
          :name="icons.paymentMethod"
          class="size-4 shrink-0 text-muted"
          aria-hidden="true"
        />
        <div class="min-w-0 flex-1">
          <p
            class="truncate text-sm"
            :class="
              paymentMethod.archivedAt === null ? 'text-default' : 'text-muted'
            "
          >
            {{ paymentMethod.label }}
          </p>
          <p class="truncate text-xs text-muted">
            {{ t(`paymentMethods.kinds.${paymentMethod.kind}`) }}
          </p>
        </div>
        <UBadge
          v-if="paymentMethod.archivedAt !== null"
          :label="t('common.archived')"
          color="neutral"
          variant="soft"
        />
        <UDropdownMenu
          :items="actionItems(paymentMethod)"
          :content="{ align: 'end' }"
        >
          <UButton
            :icon="icons.rowActions"
            :aria-label="t('common.actionsFor', { name: paymentMethod.label })"
            :class="touchIconButtonClass"
            color="neutral"
            variant="ghost"
            square
            data-testid="payment-method-actions"
          />
        </UDropdownMenu>
      </li>
    </ul>
    <p v-else class="text-sm text-muted">{{ t('paymentMethods.none') }}</p>
    <div>
      <UButton
        :label="t('paymentMethods.add')"
        :icon="icons.add"
        color="neutral"
        variant="ghost"
        data-testid="add-payment-method"
        @click="emit('accountAction', { kind: 'addPaymentMethod', account })"
      />
    </div>
  </div>
</template>
