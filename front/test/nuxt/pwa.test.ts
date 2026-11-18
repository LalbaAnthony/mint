import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { appleSplashScreenLinks } from '~~/pwa/splash-screens'

const publicDirectory = resolve(process.cwd(), 'front', 'public')
const nuxtConfigSpecifier = '~~/nuxt.config'

function publicFile(href: string): string {
  return resolve(publicDirectory, href.replace(/^\//, ''))
}

function readProperty(source: unknown, key: string): unknown {
  if (typeof source !== 'object' || source === null) {
    return undefined
  }
  return Reflect.get(source, key)
}

async function readManifestOptions(): Promise<unknown> {
  const nuxtConfigModule: unknown = await import(
    /* @vite-ignore */ String(nuxtConfigSpecifier)
  )
  return ['default', 'pwa', 'manifest'].reduce(readProperty, nuxtConfigModule)
}

describe('PWA resources (NF-PWA-01, CHG-80 to CHG-84)', () => {
  it('links one light splash screen per Apple device and orientation, each one generated', () => {
    const links = appleSplashScreenLinks('light')

    expect(links).toHaveLength(40)
    expect(links[0]).toEqual({
      rel: 'apple-touch-startup-image',
      media:
        'screen and (device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
      href: '/apple-splash-portrait-light-2048x2732.png',
    })
    expect(links.filter((link) => !existsSync(publicFile(link.href)))).toEqual(
      [],
    )
  })

  it('targets the dark scheme for the dark splash screens', () => {
    const [first] = appleSplashScreenLinks('dark')

    expect(first?.media).toContain('(prefers-color-scheme: dark)')
    expect(first?.href).toBe('/apple-splash-portrait-dark-2048x2732.png')
  })

  it('ships the icons of the manifest, the favicon and the push badge', () => {
    for (const name of [
      'favicon.ico',
      'pwa-64x64.png',
      'pwa-192x192.png',
      'pwa-512x512.png',
      'maskable-icon-512x512.png',
      'apple-touch-icon-180x180.png',
      'badge-96x96.png',
    ]) {
      expect(existsSync(publicFile(name)), name).toBe(true)
    }
  })

  it('declares theme_color as undefined so the plugin default is not applied (ADR 0028)', async () => {
    const manifestOptions = await readManifestOptions()

    expect(manifestOptions).toHaveProperty('theme_color', undefined)
    expect(manifestOptions).toHaveProperty('background_color', '#FBFBF9')
  })
})
