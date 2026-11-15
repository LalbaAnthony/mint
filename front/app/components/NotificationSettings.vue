<script setup lang="ts">
import {
  notificationPreferencesSchema,
  pushDeviceListResponseSchema,
  pushKeyResponseSchema,
} from '@mint/shared/schemas/notifications'
import type {
  NotificationPreferences,
  PushDevice,
} from '@mint/shared/types/notifications'
import type { PushSupport } from '~~/types/notifications'

const preferenceKeys = ['lowBalancePush', 'manualReminderPush'] as const

const { t } = useI18n()
const toast = useToast()
const { errorMessage } = useFormValidation()
const { formatDateTime } = useFormatters()

const preferences = reactive<NotificationPreferences>({
  lowBalancePush: true,
  manualReminderPush: true,
})
const devices = ref<PushDevice[]>([])
const publicKey = ref<string | null>(null)
const support = ref<PushSupport>('unsupported')
const permission = ref<NotificationPermission>('default')
const thisEndpoint = ref<string | null>(null)
const loaded = ref(false)
const busy = ref(false)

const thisDevice = computed(
  () =>
    devices.value.find((device) => device.endpoint === thisEndpoint.value) ??
    null,
)

function notifyFailure(error: unknown): void {
  toast.add({ title: errorMessage(error), icon: icons.error, color: 'error' })
}

async function loadDevices(): Promise<void> {
  devices.value = await apiGet(
    '/push/subscriptions',
    pushDeviceListResponseSchema,
  )
}

async function load(): Promise<void> {
  try {
    const [savedPreferences, key] = await Promise.all([
      apiGet('/notifications/preferences', notificationPreferencesSchema),
      apiGet('/push/key', pushKeyResponseSchema),
      loadDevices(),
    ])
    Object.assign(preferences, savedPreferences)
    publicKey.value = key.publicKey
    if (support.value === 'available') {
      thisEndpoint.value = await currentPushEndpoint()
    }
    loaded.value = true
  } catch (error) {
    notifyFailure(error)
  }
}

async function savePreference(
  key: (typeof preferenceKeys)[number],
  value: boolean,
): Promise<void> {
  const previous = preferences[key]
  preferences[key] = value
  try {
    Object.assign(
      preferences,
      await apiCall(
        'PATCH',
        '/notifications/preferences',
        notificationPreferencesSchema,
        { [key]: value },
      ),
    )
  } catch (error) {
    preferences[key] = previous
    notifyFailure(error)
  }
}

async function enableThisDevice(): Promise<void> {
  const key = publicKey.value
  if (key === null) {
    return
  }
  busy.value = true
  try {
    const result = await subscribeThisDevice(key)
    permission.value = notificationPermission()
    if (result === 'denied') {
      toast.add({
        title: t('notifications.settings.permissionDenied'),
        icon: icons.error,
        color: 'warning',
      })
      return
    }
    if (result === 'unavailable') {
      toast.add({
        title: t('notifications.settings.workerUnavailable'),
        icon: icons.error,
        color: 'error',
      })
      return
    }
    thisEndpoint.value = result.endpoint
    await loadDevices()
    toast.add({
      title: t('notifications.settings.enabled'),
      icon: icons.success,
      color: 'success',
    })
  } catch (error) {
    notifyFailure(error)
  } finally {
    busy.value = false
  }
}

async function removeDevice(device: PushDevice): Promise<void> {
  busy.value = true
  try {
    await apiCommand('DELETE', `/push/subscriptions/${device.id}`)
    if (device.endpoint === thisEndpoint.value) {
      await unsubscribeThisDevice()
      thisEndpoint.value = null
    }
    await loadDevices()
  } catch (error) {
    notifyFailure(error)
  } finally {
    busy.value = false
  }
}

async function disableThisDevice(): Promise<void> {
  const device = thisDevice.value
  if (device !== null) {
    await removeDevice(device)
  }
}

function deviceDetails(device: PushDevice): string {
  return t('notifications.settings.deviceDetails', {
    createdAt: formatDateTime(device.createdAt),
    lastSuccess:
      device.lastSuccessAt === null
        ? t('notifications.settings.neverDelivered')
        : formatDateTime(device.lastSuccessAt),
  })
}

onMounted(() => {
  support.value = pushSupport()
  permission.value = notificationPermission()
  void load()
})
</script>

<template>
  <UCard data-testid="notification-settings">
    <template #header>
      <h2 class="text-base font-semibold text-highlighted">
        {{ t('notifications.settings.title') }}
      </h2>
    </template>
    <div class="flex flex-col gap-6">
      <section class="flex flex-col gap-3">
        <h3 class="text-sm font-semibold text-highlighted">
          {{ t('notifications.settings.pushTypes') }}
        </h3>
        <USwitch
          v-for="key in preferenceKeys"
          :key="key"
          :model-value="preferences[key]"
          :label="t(`notifications.settings.${key}`)"
          :description="t(`notifications.settings.${key}Help`)"
          :disabled="!loaded"
          :data-testid="`notification-preference-${key}`"
          @update:model-value="savePreference(key, $event)"
        />
        <p class="text-sm text-muted">
          {{ t('notifications.settings.inAppAlways') }}
        </p>
      </section>

      <section class="flex flex-col gap-3" data-testid="push-this-device">
        <h3 class="text-sm font-semibold text-highlighted">
          {{ t('notifications.settings.thisDevice') }}
        </h3>
        <p v-if="loaded && publicKey === null" class="text-sm text-muted">
          {{ t('notifications.settings.serverDisabled') }}
        </p>
        <UAlert
          v-else-if="support === 'ios-install'"
          :icon="icons.info"
          color="info"
          variant="soft"
          :title="t('notifications.settings.iosTitle')"
          :description="t('notifications.settings.iosSteps')"
          data-testid="push-ios-install"
        />
        <p v-else-if="support === 'unsupported'" class="text-sm text-muted">
          {{ t('notifications.settings.unsupported') }}
        </p>
        <p v-else-if="permission === 'denied'" class="text-sm text-muted">
          {{ t('notifications.settings.blocked') }}
        </p>
        <div
          v-else-if="thisDevice !== null"
          class="flex flex-wrap items-center justify-between gap-2"
        >
          <p class="text-sm text-default">
            {{ t('notifications.settings.activeHere') }}
          </p>
          <UButton
            :label="t('notifications.settings.disableHere')"
            :loading="busy"
            color="neutral"
            variant="outline"
            data-testid="push-disable"
            @click="disableThisDevice"
          />
        </div>
        <div v-else class="flex flex-wrap items-center justify-between gap-2">
          <p class="text-sm text-muted">
            {{ t('notifications.settings.inactiveHere') }}
          </p>
          <UButton
            :label="t('notifications.settings.enableHere')"
            :icon="icons.notifications"
            :loading="busy"
            :disabled="!loaded"
            color="primary"
            variant="soft"
            data-testid="push-enable"
            @click="enableThisDevice"
          />
        </div>
      </section>

      <section class="flex flex-col gap-3">
        <h3 class="text-sm font-semibold text-highlighted">
          {{ t('notifications.settings.devices') }}
        </h3>
        <p
          v-if="devices.length === 0"
          class="text-sm text-muted"
          data-testid="push-devices-empty"
        >
          {{ t('notifications.settings.noDevice') }}
        </p>
        <ul
          v-else
          class="flex flex-col divide-y divide-default"
          data-testid="push-devices"
        >
          <li
            v-for="device in devices"
            :key="device.id"
            class="flex items-center justify-between gap-2 py-2"
            :data-testid="`push-device-${device.id}`"
          >
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="truncate text-sm text-default">
                  {{ device.userAgent ?? t('profile.unknownDevice') }}
                </span>
                <UBadge
                  v-if="device.endpoint === thisEndpoint"
                  :label="t('notifications.settings.thisDeviceBadge')"
                  color="primary"
                  variant="soft"
                />
              </div>
              <p class="text-xs text-muted tabular-nums">
                {{ deviceDetails(device) }}
              </p>
            </div>
            <UButton
              :icon="icons.delete"
              :aria-label="
                t('notifications.settings.removeDevice', {
                  name: device.userAgent ?? t('profile.unknownDevice'),
                })
              "
              :disabled="busy"
              color="neutral"
              variant="ghost"
              :data-testid="`push-device-remove-${device.id}`"
              @click="removeDevice(device)"
            />
          </li>
        </ul>
      </section>
    </div>
  </UCard>
</template>
