import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import MoneyAmount from '~/components/MoneyAmount.vue'
import ValuationChart from '~/components/ValuationChart.vue'
import { chartInitOptions, frenchChartLocale } from '~/charts/locale'

const placeholderPattern = /\{(\w+)\}/g

function flatten(node: unknown, prefix = ''): Map<string, string> {
  const entries = new Map<string, string>()
  if (typeof node === 'string') {
    entries.set(prefix, node)
    return entries
  }
  if (typeof node === 'object' && node !== null) {
    for (const [key, value] of Object.entries(node)) {
      for (const [path, text] of flatten(
        value,
        prefix === '' ? key : `${prefix}.${key}`,
      )) {
        entries.set(path, text)
      }
    }
  }
  return entries
}

function placeholders(text: string): string[] {
  const names = [...text.matchAll(placeholderPattern)].map(
    (match) => match[1] ?? '',
  )
  return [...new Set(names)].sort()
}

function messagesOf(locale: 'fr' | 'en'): unknown {
  return JSON.parse(
    readFileSync(
      join(process.cwd(), 'front', 'i18n', 'locales', `${locale}.json`),
      'utf8',
    ),
  )
}

const french = flatten(messagesOf('fr'))
const english = flatten(messagesOf('en'))

afterEach(async () => {
  await useNuxtApp().$i18n.setLocale('fr')
})

describe('complete English translation (NF-I18N-01)', () => {
  it('has the same keys in French and in English', () => {
    expect([...english.keys()].sort()).toEqual([...french.keys()].sort())
  })

  it('keeps the variables of every message', () => {
    const mismatches = [...french].filter(
      ([key, text]) =>
        placeholders(text).join() !==
        placeholders(english.get(key) ?? '').join(),
    )
    expect(mismatches).toEqual([])
  })

  it('leaves no French accent in the English messages', () => {
    const accented = [...english].filter(
      ([key, text]) => key !== 'locales.fr' && /[àâçéèêëîïôûùœ«»]/i.test(text),
    )
    expect(accented).toEqual([])
  })
})

describe('chart descriptions in the profile language (NF-I18N-01, CHG-77)', () => {
  it('initializes the charts with the locale of the interface', () => {
    expect(chartInitOptions('fr')).toEqual({ renderer: 'svg', locale: 'FR' })
    expect(chartInitOptions('en')).toEqual({ renderer: 'svg', locale: 'EN' })
    expect(frenchChartLocale.aria.general.withoutTitle).toBe('Graphique.')
  })

  it('follows a language change of the profile', async () => {
    const wrapper = await mountSuspended(ValuationChart, {
      props: {
        valuations: [
          {
            id: '00000000-0000-4000-8000-000000000401',
            accountId: '00000000-0000-4000-8000-0000000000a1',
            date: '2026-11-01',
            valueCents: 100_000,
          },
        ],
      },
    })
    const chart = () => wrapper.getComponent({ name: 'Echarts' })
    expect(chart().props('initOptions')).toEqual({
      renderer: 'svg',
      locale: 'FR',
    })

    await useNuxtApp().$i18n.setLocale('en')

    expect(chart().props('initOptions')).toEqual({
      renderer: 'svg',
      locale: 'EN',
    })
    wrapper.unmount()
  })
})

describe('formats of the profile language (NF-I18N-02)', () => {
  it('formats amounts and dates with the English locale', async () => {
    await useNuxtApp().$i18n.setLocale('en')
    const wrapper = await mountSuspended(MoneyAmount, {
      props: { cents: -123_456 },
    })
    const DateHost = defineComponent({
      setup() {
        const { formatDate } = useFormatters()
        return () => h('span', formatDate('2026-11-16'))
      },
    })
    const dated = await mountSuspended(DateHost)

    expect(wrapper.text()).toContain(
      new Intl.NumberFormat('en', {
        style: 'currency',
        currency: 'EUR',
      }).format(-1234.56),
    )
    expect(dated.text()).toBe(
      new Intl.DateTimeFormat('en', {
        dateStyle: 'medium',
        timeZone: 'UTC',
      }).format(new Date('2026-11-16T00:00:00Z')),
    )
    dated.unmount()
    wrapper.unmount()
  })
})
