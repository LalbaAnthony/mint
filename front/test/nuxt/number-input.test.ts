import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import type { Component } from 'vue'
import AmountInput from '~/components/AmountInput.vue'
import OperationFilters from '~/components/OperationFilters.vue'
import RateInput from '~/components/RateInput.vue'
import { emptyOperationFilters } from '~/utils/operations'
import {
  amountInputPlaceholder,
  formatAmountInput,
  formatRateInput,
  parseAmountInput,
  parseRateInput,
} from '~/utils/money'
import { interestRateFormSchema, operationFormSchema } from '~~/schemas/forms'
import type { OperationFilterState } from '~~/types/planning'

function decimals(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function rateText(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
    useGrouping: false,
  }).format(value)
}

const mounted: { unmount: () => void }[] = []

afterEach(async () => {
  for (const wrapper of mounted.splice(0)) {
    wrapper.unmount()
  }
  await useNuxtApp().$i18n.setLocale('fr')
})

describe('reading an amount in the language of the interface (ADR 0032, CA-13)', () => {
  it.each([
    ['1234,5', 'fr', 123_450],
    ['1234.5', 'fr', 123_450],
    ['1,234.56', 'fr', null],
    ['1.234,56', 'fr', 123_456],
    ['1,234', 'fr', null],
    ['1.234', 'fr', null],
    ['1 2 3', 'fr', 12_300],
    ['1 234,56 €', 'fr', 123_456],
    ['€1,234.56', 'fr', null],
    ['12.', 'fr', null],
    ['.5', 'fr', null],
    ['1234,5', 'en', 123_450],
    ['1234.5', 'en', 123_450],
    ['1,234.56', 'en', 123_456],
    ['1.234,56', 'en', null],
    ['1,234', 'en', 123_400],
    ['1.234', 'en', null],
    ['1 2 3', 'en', 12_300],
    ['1 234,56 €', 'en', 123_456],
    ['€1,234.56', 'en', 123_456],
    ['12.', 'en', null],
    ['.5', 'en', null],
  ])('reads the example %j in %s as %s cents', (text, locale, cents) => {
    expect(parseAmountInput(text, locale)).toBe(cents)
  })

  it.each([
    ['1.234.567,89', 'fr', 123_456_789],
    ['1 234,56', 'fr', 123_456],
    ['1 234,56', 'fr', 123_456],
    ['-1 234,56', 'fr', -123_456],
    ['−12.5', 'fr', -1_250],
    ['+0,07', 'fr', 7],
    ['-0', 'fr', 0],
    ['12,345,678.9', 'en', 1_234_567_890],
    ['12,5', 'en', 1_250],
    ['1,23', 'en', 123],
    ['-€1,234.56', 'en', -123_456],
  ])('reads %j in %s as %s cents', (text, locale, cents) => {
    expect(parseAmountInput(text, locale)).toBe(cents)
  })

  it.each([
    ['12.34,5', 'fr'],
    ['1.234.567', 'fr'],
    ['1,2,3', 'fr'],
    ['12,50-', 'fr'],
    ['--3', 'fr'],
    ['', 'fr'],
    ['abc', 'fr'],
    ['1,2345', 'en'],
    ['0,123', 'en'],
    ['12,345,67', 'en'],
    ['1,234.567', 'en'],
    ['1e3', 'en'],
  ])('refuses %j in %s', (text, locale) => {
    expect(parseAmountInput(text, locale)).toBeNull()
  })

  it.each(['fr', 'en'])(
    'reads back every amount formatted for %s',
    (locale) => {
      for (const cents of [
        0, 7, -1_250, 123_456, -123_456, 100_000_000, 99_999_999_999,
      ]) {
        expect(parseAmountInput(formatAmountInput(cents, locale), locale)).toBe(
          cents,
        )
      }
    },
  )

  it('formats amounts with two decimals and the group separator of Intl', () => {
    expect(formatAmountInput(123_456, 'fr')).toBe(decimals(1234.56, 'fr'))
    expect(formatAmountInput(-200_000, 'en')).toBe(decimals(-2000, 'en'))
    expect(amountInputPlaceholder('fr')).toBe(decimals(1234.56, 'fr'))
    expect(amountInputPlaceholder('en')).toBe(decimals(1234.56, 'en'))
  })
})

describe('reading a rate in the language of the interface (ADR 0032, CA-13)', () => {
  it.each([
    ['3,125', 'fr', 3.125],
    ['3.125', 'fr', 3.125],
    ['3,125', 'en', 3.125],
    ['3.125', 'en', 3.125],
    [' 2,7 ', 'fr', 2.7],
    ['0', 'en', 0],
    ['3,12345', 'fr', 3.12345],
  ])('reads %j in %s as %s', (text, locale, rate) => {
    expect(parseRateInput(text, locale)).toBe(rate)
  })

  it.each([
    ['0x10', 'fr'],
    ['1e1', 'en'],
    ['1.234,5', 'fr'],
    ['1,234.5', 'en'],
    ['3,1,2', 'fr'],
    ['3,', 'fr'],
    ['', 'en'],
  ])('refuses %j in %s', (text, locale) => {
    expect(parseRateInput(text, locale)).toBeNull()
  })

  it.each(['fr', 'en'])('reads back every rate formatted for %s', (locale) => {
    for (const rate of [0, 0.5, 2.7, 3.125, 99.9999]) {
      expect(parseRateInput(formatRateInput(rate, locale), locale)).toBe(rate)
    }
    expect(formatRateInput(3, locale)).toBe(rateText(3, locale))
  })
})

describe('form schemas in the language of the interface (ADR 0032)', () => {
  const operation = {
    source: 'account:1',
    date: '2026-11-21',
    label: 'Courses',
    note: '',
  }

  it('reads the amount with the separators of the language', () => {
    const english = operationFormSchema('en').safeParse({
      ...operation,
      amount: '1,234.56',
    })
    const french = operationFormSchema('fr').safeParse({
      ...operation,
      amount: '1,234.56',
    })

    expect(english.success && english.data.amount).toBe(123_456)
    expect(french.error?.issues.map((issue) => issue.message)).toEqual([
      'invalid_amount',
    ])
  })

  it('leaves the precision of a rate to the shared schema', () => {
    const precise = interestRateFormSchema('fr').safeParse({
      effectiveDate: '2026-11-21',
      rate: '3,12345',
    })
    const unreadable = interestRateFormSchema('fr').safeParse({
      effectiveDate: '2026-11-21',
      rate: '0x10',
    })
    const english = interestRateFormSchema('en').safeParse({
      effectiveDate: '2026-11-21',
      rate: '2,7',
    })

    expect(precise.error?.issues.map((issue) => issue.message)).toEqual([
      'rate_too_precise',
    ])
    expect(unreadable.error?.issues.map((issue) => issue.message)).toEqual([
      'invalid_rate',
    ])
    expect(english.success && english.data.rate).toBe(2.7)
  })
})

function boundTo(component: Component) {
  const text = ref('')
  const host = defineComponent({
    setup: () => () =>
      h(component, {
        modelValue: text.value,
        'onUpdate:modelValue': (value: string) => {
          text.value = value
        },
      }),
  })
  return { text, host }
}

async function typeAndLeave(
  wrapper: Awaited<ReturnType<typeof mountSuspended>>,
  value: string,
): Promise<void> {
  const input = wrapper.get('input')
  await input.setValue(value)
  await input.trigger('blur')
  await nextTick()
}

describe('AmountInput (CHG-69)', () => {
  it('is a right-aligned decimal field with the euro suffix and an example', async () => {
    const { host } = boundTo(AmountInput)
    const wrapper = await mountSuspended(host)
    mounted.push(wrapper)

    const input = wrapper.get('input')
    expect(input.attributes('inputmode')).toBe('decimal')
    expect(input.attributes('placeholder')).toBe(amountInputPlaceholder('fr'))
    expect(input.classes()).toEqual(
      expect.arrayContaining(['text-right', 'tabular-nums']),
    )
    expect(wrapper.get('[data-slot="trailing"]').text()).toBe('€')
  })

  it('rewrites a readable amount in the format of the language on blur', async () => {
    const { text, host } = boundTo(AmountInput)
    const wrapper = await mountSuspended(host)
    mounted.push(wrapper)

    await typeAndLeave(wrapper, '1234.5')

    expect(text.value).toBe(formatAmountInput(123_450, 'fr'))
    expect(wrapper.get('input').element.value).toBe(
      formatAmountInput(123_450, 'fr'),
    )
  })

  it('keeps an unreadable amount as typed', async () => {
    const { text, host } = boundTo(AmountInput)
    const wrapper = await mountSuspended(host)
    mounted.push(wrapper)

    await typeAndLeave(wrapper, '1.234')

    expect(text.value).toBe('1.234')
  })

  it('reads and rewrites in English for an English profile', async () => {
    await useNuxtApp().$i18n.setLocale('en')
    const { text, host } = boundTo(AmountInput)
    const wrapper = await mountSuspended(host)
    mounted.push(wrapper)

    expect(wrapper.get('input').attributes('placeholder')).toBe(
      amountInputPlaceholder('en'),
    )
    await typeAndLeave(wrapper, '1234,5')

    expect(text.value).toBe(formatAmountInput(123_450, 'en'))
  })
})

describe('RateInput (CHG-69)', () => {
  it('rewrites a readable rate with two to four decimals and a percent suffix', async () => {
    const { text, host } = boundTo(RateInput)
    const wrapper = await mountSuspended(host)
    mounted.push(wrapper)

    expect(wrapper.get('[data-slot="trailing"]').text()).toBe('%')
    await typeAndLeave(wrapper, '3')

    expect(text.value).toBe(rateText(3, 'fr'))
  })

  it('never rounds a rate that is too precise', async () => {
    const { text, host } = boundTo(RateInput)
    const wrapper = await mountSuspended(host)
    mounted.push(wrapper)

    await typeAndLeave(wrapper, '3,12345')

    expect(text.value).toBe('3,12345')
  })
})

describe('operation amount filters (ADR 0032)', () => {
  it('shows an error under an unreadable amount once the field is left', async () => {
    const filters = ref<OperationFilterState>(emptyOperationFilters())
    const host = defineComponent({
      setup: () => () =>
        h(OperationFilters, {
          accounts: [],
          categories: [],
          tags: [],
          modelValue: filters.value,
          'onUpdate:modelValue': (value: OperationFilterState) => {
            filters.value = value
          },
        }),
    })
    const wrapper = await mountSuspended(host)
    mounted.push(wrapper)

    const min = wrapper.get('[data-testid="operation-filter-min-amount"]')
    await min.setValue('1.234')
    expect(wrapper.text()).not.toContain('Montant invalide')
    await min.trigger('blur')
    await nextTick()

    expect(wrapper.text()).toContain('Montant invalide')
    await min.setValue('12,5')
    await min.trigger('blur')
    await nextTick()

    expect(wrapper.text()).not.toContain('Montant invalide')
    expect(filters.value.minAmount).toBe(formatAmountInput(1_250, 'fr'))
  })
})
