import {
  createAppleSplashScreens,
  defineConfig,
} from '@vite-pwa/assets-generator/config'

export default defineConfig({
  preset: {
    transparent: { sizes: [] },
    maskable: { sizes: [] },
    apple: { sizes: [] },
    appleSplashScreens: createAppleSplashScreens({
      padding: 0.7,
      resizeOptions: { background: '#FBFBF9', fit: 'contain' },
      darkResizeOptions: { background: '#0C0C09', fit: 'contain' },
      linkMediaOptions: {
        log: true,
        addMediaScreen: true,
        basePath: '/',
        xhtml: false,
      },
    }),
  },
  images: ['public/logo.svg'],
})
