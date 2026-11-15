import { defineConfig } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  preset: {
    transparent: { sizes: [96], padding: 0 },
    maskable: { sizes: [] },
    apple: { sizes: [] },
    assetName: (_type, size) => `badge-${size.width}x${size.height}.png`,
  },
  images: ['public/badge.svg'],
})
