export interface NumberInputSymbols {
  decimal: string
  other: string
  group: string
  standaloneGroups: boolean
}

export interface DecimalInputRules {
  maxFractionDigits: number | null
  grouping: boolean
}

export interface DecimalReading {
  units: string
  fraction: string
}

export interface SignedDecimalReading {
  negative: boolean
  reading: DecimalReading
}
