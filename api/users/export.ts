import { Op } from 'sequelize'
import { ZipFile } from 'yazl'
import { parisDate } from '../clock.js'
import type { AppDependencies } from '../types/app.js'
import type {
  CsvCell,
  CsvFile,
  CsvTableKey,
  ExportArchiveEntry,
  ExportLabels,
  ExportUserData,
} from '../types/export.js'
import type { RouteDownload } from '../types/http.js'
import type {
  AccountModel,
  CategoryModel,
  PaymentMethodModel,
  TagModel,
  UserModel,
} from '../types/models.js'
import { renderCsv } from './csv-export.js'
import { exportLabels } from './export-labels.js'

export const exportFormatVersion = 1

function money(cents: number | null): CsvCell {
  return cents === null ? null : { cents }
}

function groupIds<Row>(
  rows: readonly Row[],
  key: (row: Row) => string,
  value: (row: Row) => string,
): Map<string, string[]> {
  const groups = new Map<string, string[]>()
  for (const row of rows) {
    groups.set(key(row), [...(groups.get(key(row)) ?? []), value(row)])
  }
  return groups
}

async function loadUserData(
  app: AppDependencies,
  userId: string,
): Promise<ExportUserData> {
  const where = { userId }
  const order: [string, string][] = [['createdAt', 'ASC']]
  const [
    accounts,
    paymentMethods,
    categories,
    tags,
    operations,
    operationTags,
    schedules,
    scheduleTags,
    envelopes,
    envelopeCategories,
    rules,
    importMappings,
    imports,
    statements,
    valuations,
    interestRates,
    notifications,
    notificationPreferences,
    passkeys,
    pushDevices,
  ] = await Promise.all([
    app.models.Account.findAll({
      where,
      order: [['sortOrder', 'ASC'], ...order],
    }),
    app.models.PaymentMethod.findAll({ where, order }),
    app.models.Category.findAll({
      where,
      order: [['sortOrder', 'ASC'], ...order],
    }),
    app.models.Tag.findAll({ where, order: [['name', 'ASC']] }),
    app.models.Transaction.findAll({
      where,
      order: [['date', 'ASC'], ...order],
    }),
    app.models.TransactionTag.findAll({ where }),
    app.models.Schedule.findAll({ where, order }),
    app.models.ScheduleTag.findAll({ where }),
    app.models.Envelope.findAll({ where, order }),
    app.models.EnvelopeCategory.findAll({ where }),
    app.models.CategorizationRule.findAll({
      where,
      order: [['priority', 'ASC'], ...order],
    }),
    app.models.ImportMapping.findAll({ where, order }),
    app.models.ImportBatch.findAll({
      where,
      order,
      attributes: { exclude: ['rawFile'] },
    }),
    app.models.AccountStatement.findAll({
      where,
      order: [['date', 'ASC'], ...order],
    }),
    app.models.Valuation.findAll({ where, order: [['date', 'ASC'], ...order] }),
    app.models.InterestRate.findAll({
      where,
      order: [['effectiveDate', 'ASC'], ...order],
    }),
    app.models.Notification.findAll({ where, order }),
    app.models.NotificationPreference.findAll({ where }),
    app.models.WebauthnCredential.findAll({ where, order }),
    app.models.PushSubscription.findAll({ where, order }),
  ])
  const scheduleOccurrences =
    schedules.length === 0
      ? []
      : await app.models.ScheduleOccurrence.findAll({
          where: {
            scheduleId: { [Op.in]: schedules.map((schedule) => schedule.id) },
          },
          order: [['originalDate', 'ASC']],
        })
  const envelopeMonthOverrides =
    envelopes.length === 0
      ? []
      : await app.models.EnvelopeMonthOverride.findAll({
          where: {
            envelopeId: { [Op.in]: envelopes.map((envelope) => envelope.id) },
          },
          order: [['month', 'ASC']],
        })
  return {
    accounts,
    paymentMethods,
    categories,
    tags,
    operations,
    operationTags,
    schedules,
    scheduleTags,
    scheduleOccurrences,
    envelopes,
    envelopeCategories,
    envelopeMonthOverrides,
    rules,
    importMappings,
    imports,
    statements,
    valuations,
    interestRates,
    notifications,
    notificationPreferences,
    passkeys,
    pushDevices,
  }
}

function exportDocument(
  user: UserModel,
  data: ExportUserData,
  exportedAt: Date,
) {
  const operationTagIds = groupIds(
    data.operationTags,
    (row) => row.transactionId,
    (row) => row.tagId,
  )
  const scheduleTagIds = groupIds(
    data.scheduleTags,
    (row) => row.scheduleId,
    (row) => row.tagId,
  )
  const envelopeCategoryIds = groupIds(
    data.envelopeCategories,
    (row) => row.envelopeId,
    (row) => row.categoryId,
  )
  return {
    format: 'mint-export',
    version: exportFormatVersion,
    exportedAt: exportedAt.toISOString(),
    profile: {
      id: user.id,
      email: user.email,
      role: user.role,
      locale: user.locale,
      theme: user.theme,
      forecastHorizonMonths: user.forecastHorizonMonths,
      targets: {
        needs: user.targetNeedsPct,
        wants: user.targetWantsPct,
        save: user.targetSavePct,
      },
      defaultAccountId: user.defaultAccountId,
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    },
    accounts: data.accounts.map((row) => {
      const { userId: _userId, ...account } = row.get({ plain: true })
      return account
    }),
    paymentMethods: data.paymentMethods.map((row) => {
      const { userId: _userId, ...paymentMethod } = row.get({ plain: true })
      return paymentMethod
    }),
    categories: data.categories.map((row) => {
      const { userId: _userId, ...category } = row.get({ plain: true })
      return category
    }),
    tags: data.tags.map((row) => {
      const { userId: _userId, ...tag } = row.get({ plain: true })
      return tag
    }),
    operations: data.operations.map((row) => {
      const {
        userId: _userId,
        dedupHash: _dedupHash,
        preMergeSnapshot: _preMergeSnapshot,
        ...operation
      } = row.get({ plain: true })
      return { ...operation, tagIds: operationTagIds.get(row.id) ?? [] }
    }),
    schedules: data.schedules.map((row) => {
      const { userId: _userId, ...schedule } = row.get({ plain: true })
      return { ...schedule, tagIds: scheduleTagIds.get(row.id) ?? [] }
    }),
    scheduleOccurrences: data.scheduleOccurrences.map((row) =>
      row.get({ plain: true }),
    ),
    envelopes: data.envelopes.map((row) => {
      const { userId: _userId, ...envelope } = row.get({ plain: true })
      return { ...envelope, categoryIds: envelopeCategoryIds.get(row.id) ?? [] }
    }),
    envelopeMonthOverrides: data.envelopeMonthOverrides.map((row) =>
      row.get({ plain: true }),
    ),
    rules: data.rules.map((row) => {
      const { userId: _userId, ...rule } = row.get({ plain: true })
      return rule
    }),
    importMappings: data.importMappings.map((row) => {
      const { userId: _userId, ...mapping } = row.get({ plain: true })
      return mapping
    }),
    imports: data.imports.map((row) => {
      const {
        userId: _userId,
        rawFile: _rawFile,
        ...batch
      } = row.get({ plain: true })
      return batch
    }),
    statements: data.statements.map((row) => {
      const { userId: _userId, ...statement } = row.get({ plain: true })
      return statement
    }),
    valuations: data.valuations.map((row) => {
      const { userId: _userId, ...valuation } = row.get({ plain: true })
      return valuation
    }),
    interestRates: data.interestRates.map((row) => {
      const { userId: _userId, ...rate } = row.get({ plain: true })
      return rate
    }),
    notifications: data.notifications.map((row) => ({
      id: row.id,
      type: row.type,
      payload: row.payload,
      readAt: row.readAt,
      createdAt: row.createdAt,
    })),
    notificationPreferences: data.notificationPreferences.map((row) => ({
      type: row.type,
      push: row.push,
    })),
    passkeys: data.passkeys.map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.createdAt,
      lastUsedAt: row.lastUsedAt,
    })),
    pushDevices: data.pushDevices.map((row) => ({
      id: row.id,
      userAgent: row.userAgent,
      createdAt: row.createdAt,
      lastSuccessAt: row.lastSuccessAt,
    })),
  }
}

function namesById<Row extends { id: string }>(
  rows: readonly Row[],
  name: (row: Row) => string,
): Map<string, string> {
  return new Map(rows.map((row) => [row.id, name(row)]))
}

function categoryPaths(
  categories: readonly CategoryModel[],
): Map<string, string> {
  const names = namesById(categories, (category) => category.name)
  return namesById(categories, (category) =>
    category.parentId === null
      ? category.name
      : `${names.get(category.parentId) ?? ''} > ${category.name}`,
  )
}

function lookup(
  names: ReadonlyMap<string, string>,
  id: string | null,
): CsvCell {
  return id === null ? null : (names.get(id) ?? null)
}

function joinNames(
  names: ReadonlyMap<string, string>,
  ids: readonly string[],
): string {
  return ids
    .map((id) => names.get(id) ?? '')
    .filter((name) => name !== '')
    .join(', ')
}

function csvTables(data: ExportUserData): Record<CsvTableKey, CsvCell[][]> {
  const accountNames = namesById<AccountModel>(
    data.accounts,
    (account) => account.name,
  )
  const methodNames = namesById<PaymentMethodModel>(
    data.paymentMethods,
    (method) => method.label,
  )
  const categoryNames = categoryPaths(data.categories)
  const tagNames = namesById<TagModel>(data.tags, (tag) => tag.name)
  const operationTagIds = groupIds(
    data.operationTags,
    (row) => row.transactionId,
    (row) => row.tagId,
  )
  const scheduleTagIds = groupIds(
    data.scheduleTags,
    (row) => row.scheduleId,
    (row) => row.tagId,
  )
  const envelopeCategoryIds = groupIds(
    data.envelopeCategories,
    (row) => row.envelopeId,
    (row) => row.categoryId,
  )
  const transferLegs = groupIds(
    data.operations.filter((operation) => operation.transferGroupId !== null),
    (operation) => operation.transferGroupId ?? '',
    (operation) => operation.id,
  )
  const accountOfOperation = new Map(
    data.operations.map((operation) => [operation.id, operation.accountId]),
  )
  const counterpart = (operationId: string, groupId: string | null) => {
    const otherLeg = (
      groupId === null ? [] : (transferLegs.get(groupId) ?? [])
    ).find((id) => id !== operationId)
    return otherLeg === undefined
      ? null
      : lookup(accountNames, accountOfOperation.get(otherLeg) ?? null)
  }
  const sourceName = (accountId: string | null, methodId: string | null) =>
    methodId === null
      ? lookup(accountNames, accountId)
      : lookup(methodNames, methodId)
  return {
    accounts: data.accounts.map((account) => [
      account.name,
      account.nature,
      account.regulatedProduct,
      account.usage,
      account.institution,
      money(account.initialBalanceCents),
      account.initialBalanceDate,
      money(account.lowBalanceThresholdCents),
      money(account.depositCapCents),
      money(account.capitalizedInterestCents),
      account.interestMethod,
      account.capitalization,
      account.anniversaryDate,
      account.archivedAt !== null,
    ]),
    operations: data.operations.map((operation) => [
      operation.date,
      lookup(accountNames, operation.accountId),
      money(operation.amountCents),
      operation.label,
      operation.bankLabel,
      lookup(categoryNames, operation.categoryId),
      joinNames(tagNames, operationTagIds.get(operation.id) ?? []),
      lookup(methodNames, operation.paymentMethodId),
      counterpart(operation.id, operation.transferGroupId),
      operation.note,
      operation.status,
      operation.origin,
    ]),
    schedules: data.schedules
      .filter((schedule) => !schedule.isSystem)
      .map((schedule) => [
        schedule.label,
        schedule.kind,
        money(schedule.amountCents),
        schedule.triggerMode,
        schedule.reminderDaysBefore,
        schedule.frequency,
        schedule.interval,
        schedule.startDate,
        schedule.anchorLastDay,
        schedule.endDate,
        schedule.maxOccurrences,
        schedule.businessDayRule,
        sourceName(schedule.accountId, schedule.paymentMethodId),
        lookup(accountNames, schedule.sourceAccountId),
        lookup(accountNames, schedule.targetAccountId),
        lookup(categoryNames, schedule.categoryId),
        schedule.isSubscription,
        schedule.amountTolerancePct,
        schedule.bankLabelPatterns.join(', '),
        joinNames(tagNames, scheduleTagIds.get(schedule.id) ?? []),
        schedule.note,
        schedule.active,
      ]),
    envelopes: data.envelopes.map((envelope) => [
      envelope.label,
      money(envelope.monthlyAmountCents),
      joinNames(categoryNames, envelopeCategoryIds.get(envelope.id) ?? []),
      sourceName(envelope.accountId, envelope.paymentMethodId),
      envelope.carryOver,
      envelope.active,
    ]),
    categories: data.categories.map((category) => [
      category.name,
      lookup(categoryNames, category.parentId),
      category.kind,
      category.expenseGroup,
      category.isSystem,
      category.archivedAt !== null,
    ]),
    tags: data.tags.map((tag) => [tag.name]),
    rules: data.rules.map((rule) => [
      rule.priority,
      rule.matchType,
      rule.pattern,
      lookup(accountNames, rule.accountId),
      rule.sign,
      money(rule.amountMinCents),
      money(rule.amountMaxCents),
      lookup(categoryNames, rule.actionCategoryId),
      joinNames(tagNames, rule.actionTagIds),
      lookup(accountNames, rule.actionTransferAccountId),
      rule.active,
    ]),
    statements: data.statements.map((statement) => [
      lookup(accountNames, statement.accountId),
      statement.date,
      money(statement.balanceCents),
    ]),
    valuations: data.valuations.map((valuation) => [
      lookup(accountNames, valuation.accountId),
      valuation.date,
      money(valuation.valueCents),
    ]),
  }
}

export const csvTableOrder: readonly CsvTableKey[] = [
  'accounts',
  'operations',
  'schedules',
  'envelopes',
  'categories',
  'tags',
  'rules',
  'statements',
  'valuations',
]

function archiveEntries(
  user: UserModel,
  data: ExportUserData,
  exportedAt: Date,
): ExportArchiveEntry[] {
  const labels: ExportLabels = exportLabels[user.locale]
  const tables = csvTables(data)
  const csvFiles: CsvFile[] = csvTableOrder.map((key) => ({
    name: labels.tables[key].file,
    headers: labels.tables[key].headers,
    rows: tables[key],
  }))
  return [
    {
      name: 'mint-export.json',
      content: Buffer.from(
        `${JSON.stringify(exportDocument(user, data, exportedAt), null, 2)}\n`,
        'utf8',
      ),
    },
    ...csvFiles.map((file) => ({
      name: file.name,
      content: renderCsv(file, labels),
    })),
  ]
}

export async function buildExportArchive(
  app: AppDependencies,
  user: UserModel,
): Promise<RouteDownload> {
  const exportedAt = app.clock.now()
  const data = await loadUserData(app, user.id)
  const zip = new ZipFile()
  for (const entry of archiveEntries(user, data, exportedAt)) {
    zip.addBuffer(entry.content, entry.name, { mtime: exportedAt })
  }
  zip.end()
  return {
    filename: `mint-export-${parisDate(exportedAt)}.zip`,
    stream: zip.outputStream,
  }
}
