<script setup lang="ts">
import { en, fr } from '@nuxt/ui/locale'

const { t, locale } = useI18n()
const localeHead = useLocaleHead({ dir: true, lang: true, seo: false })
const toasterPosition = useToasterPosition()
const colorMode = useColorMode()

usePwaUpdates()

const uiLocale = computed(() => (locale.value === 'en' ? en : fr))

useHead({
  htmlAttrs: {
    lang: () => localeHead.value.htmlAttrs.lang,
    dir: () => localeHead.value.htmlAttrs.dir,
  },
  meta: [
    {
      key: 'theme-color-dark',
      name: 'theme-color',
      media: darkSchemeMedia,
      content: () =>
        colorMode.preference === 'light' ? themeColors.light : themeColors.dark,
    },
    {
      key: 'theme-color',
      name: 'theme-color',
      content: () =>
        colorMode.preference === 'dark' ? themeColors.dark : themeColors.light,
    },
  ],
  titleTemplate: (title) =>
    title
      ? t('app.documentTitle', { view: title, name: t('app.name') })
      : t('app.name'),
})
</script>

<template>
  <UApp :locale="uiLocale" :toaster="{ position: toasterPosition }">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
