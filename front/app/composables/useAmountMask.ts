import type { MoneySignDisplay } from '~~/types/referentials'

export function useAmountMask() {
  const store = useAmountMaskStore()
  const { t, locale } = useI18n()
  const { formatMoney } = useFormatters()

  const masked = computed(() => store.masked)

  function signOf(cents: number, signDisplay: MoneySignDisplay): string {
    return new Intl.NumberFormat(locale.value, {
      style: 'currency',
      currency: 'EUR',
      signDisplay,
    })
      .formatToParts(cents / 100)
      .filter((part) => part.type === 'minusSign' || part.type === 'plusSign')
      .map((part) => part.value)
      .join('')
  }

  function maskedText(
    cents: number,
    signDisplay: MoneySignDisplay = 'auto',
  ): string {
    return `${signOf(cents, signDisplay)}${maskedAmountGlyph}`
  }

  function maskedSpeech(
    cents: number,
    signDisplay: MoneySignDisplay = 'auto',
  ): string {
    const sign = signOf(cents, signDisplay)
    return sign === '' ? t('money.masked') : `${sign} ${t('money.masked')}`
  }

  function money(
    cents: number,
    signDisplay: MoneySignDisplay = 'auto',
  ): string {
    return masked.value
      ? maskedText(cents, signDisplay)
      : formatMoney(cents, signDisplay)
  }

  function spokenMoney(
    cents: number,
    signDisplay: MoneySignDisplay = 'auto',
  ): string {
    return masked.value
      ? maskedSpeech(cents, signDisplay)
      : formatMoney(cents, signDisplay)
  }

  function chartMoney(
    format: (cents: number) => string,
  ): (cents: number) => string {
    return (cents) => (masked.value ? maskedText(cents) : format(cents))
  }

  const chartDescription = computed(() =>
    masked.value ? t('amountMask.chartDescription') : null,
  )

  return {
    masked,
    maskedText,
    maskedSpeech,
    money,
    spokenMoney,
    chartMoney,
    chartDescription,
  }
}
