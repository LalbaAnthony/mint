import {
  defineConfig,
  minimal2023Preset,
} from '@vite-pwa/assets-generator/config'

export default defineConfig({
  headLinkOptions: {
    preset: '2023',
    resolveSvgName: () => 'logo.svg',
  },
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    maskable: {
      ...minimal2023Preset.maskable,
      resizeOptions: { background: '#E7FDE6' },
    },
    apple: {
      ...minimal2023Preset.apple,
      resizeOptions: { background: '#E7FDE6' },
    },
  },
  images: ['public/icon.svg'],
})
