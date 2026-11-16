<script setup lang="ts">
const { t } = useI18n()
const localeHead = useLocaleHead({ dir: true, lang: true, seo: false })
const toasterPosition = useToasterPosition()

usePwaUpdates()

useHead({
  htmlAttrs: {
    lang: () => localeHead.value.htmlAttrs.lang,
    dir: () => localeHead.value.htmlAttrs.dir,
  },
  titleTemplate: (title) =>
    title
      ? t('app.documentTitle', { view: title, name: t('app.name') })
      : t('app.name'),
})
</script>

<template>
  <UApp :toaster="{ position: toasterPosition }">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
