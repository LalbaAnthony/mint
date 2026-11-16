import type { Locale } from '@mint/shared/types/user'
import type {
  AccountModel,
  AccountStatementModel,
  CategorizationRuleModel,
  CategoryModel,
  EnvelopeCategoryModel,
  EnvelopeModel,
  EnvelopeMonthOverrideModel,
  ImportBatchModel,
  ImportMappingModel,
  InterestRateModel,
  NotificationModel,
  NotificationPreferenceModel,
  PaymentMethodModel,
  PushSubscriptionModel,
  ScheduleModel,
  ScheduleOccurrenceModel,
  ScheduleTagModel,
  TagModel,
  TransactionModel,
  TransactionTagModel,
  ValuationModel,
  WebauthnCredentialModel,
} from './models.js'

export type CsvMoney = { cents: number }

export type CsvCell = string | number | boolean | null | CsvMoney

export type CsvFile = {
  name: string
  headers: string[]
  rows: CsvCell[][]
}

export type CsvTableKey =
  | 'accounts'
  | 'operations'
  | 'schedules'
  | 'envelopes'
  | 'categories'
  | 'tags'
  | 'rules'
  | 'statements'
  | 'valuations'

export type CsvTableLabels = {
  file: string
  headers: string[]
}

export type ExportLabels = {
  yes: string
  no: string
  tables: Record<CsvTableKey, CsvTableLabels>
}

export type ExportLabelSet = Record<Locale, ExportLabels>

export type ExportArchiveEntry = {
  name: string
  content: Buffer
}

export type ExportUserData = {
  accounts: AccountModel[]
  paymentMethods: PaymentMethodModel[]
  categories: CategoryModel[]
  tags: TagModel[]
  operations: TransactionModel[]
  operationTags: TransactionTagModel[]
  schedules: ScheduleModel[]
  scheduleTags: ScheduleTagModel[]
  scheduleOccurrences: ScheduleOccurrenceModel[]
  envelopes: EnvelopeModel[]
  envelopeCategories: EnvelopeCategoryModel[]
  envelopeMonthOverrides: EnvelopeMonthOverrideModel[]
  rules: CategorizationRuleModel[]
  importMappings: ImportMappingModel[]
  imports: ImportBatchModel[]
  statements: AccountStatementModel[]
  valuations: ValuationModel[]
  interestRates: InterestRateModel[]
  notifications: NotificationModel[]
  notificationPreferences: NotificationPreferenceModel[]
  passkeys: WebauthnCredentialModel[]
  pushDevices: PushSubscriptionModel[]
}
