import { describe, expect, it } from 'vitest'
import { icons } from '~/utils/icons'

const nuxtConfigSpecifier = '~~/nuxt.config'
const nuxtUiIconPattern = /^i-([a-z0-9]+)-(.+)$/

function toBundleName(iconName: string): string {
  const match = nuxtUiIconPattern.exec(iconName)
  if (match === null) {
    return iconName
  }
  return `${match[1]}:${match[2]}`
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function readProperty(source: unknown, key: string): unknown {
  if (typeof source !== 'object' || source === null) {
    return undefined
  }
  return Reflect.get(source, key)
}

async function readClientBundleIcons(): Promise<string[]> {
  const nuxtConfigModule: unknown = await import(
    /* @vite-ignore */ String(nuxtConfigSpecifier)
  )
  const bundleIcons = ['default', 'icon', 'clientBundle', 'icons'].reduce(
    readProperty,
    nuxtConfigModule,
  )
  if (!isStringArray(bundleIcons)) {
    throw new Error('nuxt.config.ts must define icon.clientBundle.icons')
  }
  return bundleIcons
}

describe('icon client bundle (CA-08)', () => {
  it('contains every Nuxt UI internal icon', async () => {
    const bundledIcons = await readClientBundleIcons()
    const uiIcons = Object.values(useAppConfig().ui.icons).map(toBundleName)

    expect(uiIcons.length).toBeGreaterThan(0)
    expect(uiIcons.filter((name) => !bundledIcons.includes(name))).toEqual([])
  })

  it('contains every business icon (CHG-44)', async () => {
    const bundledIcons = await readClientBundleIcons()
    const businessIcons: string[] = Object.values(icons)

    expect(
      businessIcons.filter((name) => !bundledIcons.includes(name)),
    ).toEqual([])
  })

  it('only bundles Lucide icons (CHG-42)', async () => {
    const bundledIcons = await readClientBundleIcons()

    expect(bundledIcons.filter((name) => !name.startsWith('lucide:'))).toEqual(
      [],
    )
  })
})
