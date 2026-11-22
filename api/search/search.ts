import { Op, QueryTypes } from 'sequelize'
import { monthStart } from '@mint/shared/engines/dates'
import type { Account } from '@mint/shared/types/accounts'
import type { Schedule } from '@mint/shared/types/schedules'
import type {
  SearchEnvelope,
  SearchOperations,
  SearchQuery,
  SearchResponse,
} from '@mint/shared/types/search'
import { buildAccountOverview, toAccount } from '../accounts/accounts.js'
import { loadInvestmentSummaries } from '../accounts/investments.js'
import { loadSavingsSummaries } from '../accounts/savings.js'
import { loadStatementGaps } from '../accounts/statements.js'
import { parisDate } from '../clock.js'
import { envelopeMonth } from '../envelopes/envelopes.js'
import { escapeLike } from '../operations/list.js'
import { toOperations } from '../operations/operations.js'
import { loadAccountBalances } from '../planning/usage.js'
import { loadScheduleViews } from '../schedules/schedules.js'
import { searchCountRowsSchema, searchIdRowsSchema } from '../schemas/search.js'
import type { AppDependencies } from '../types/app.js'
import type { UserModel } from '../types/models.js'
import type { DataAccess } from '../types/planning.js'
import type { SearchOperationPage, SearchTerms } from '../types/search.js'

function matches(column: string): string {
  return `unaccent(${column}) ILIKE unaccent(:pattern)`
}

function amountMatches(column: string): string {
  return `(CAST(:amountCents AS bigint) IS NOT NULL AND abs(${column}) = CAST(:amountCents AS bigint))`
}

const matchingCategoryIds = `
  SELECT category.id
  FROM categories category
  LEFT JOIN categories parent ON parent.id = category.parent_id
  WHERE category.user_id = :userId
    AND (${matches('category.name')} OR ${matches('parent.name')})`

function matchingTaggedIds(table: string, column: string): string {
  return `
  SELECT link.${column}
  FROM ${table} link
  JOIN tags tag ON tag.id = link.tag_id
  WHERE link.user_id = :userId AND ${matches('tag.name::text')}`
}

const operationConditions = `
  operation.user_id = :userId
  AND (
    ${matches('operation.label')}
    OR ${matches('operation.bank_label')}
    OR ${matches('operation.note')}
    OR operation.category_id IN (${matchingCategoryIds})
    OR operation.id IN (${matchingTaggedIds('transaction_tags', 'transaction_id')})
    OR ${amountMatches('operation.amount_cents')}
  )`

async function selectIds(
  data: DataAccess,
  sql: string,
  terms: SearchTerms,
  extra: Record<string, number> = {},
): Promise<string[]> {
  const rows = await data.sequelize.query(sql, {
    replacements: { ...terms, ...extra },
    type: QueryTypes.SELECT,
  })
  return searchIdRowsSchema.parse(rows).map((row) => row.id)
}

function matchingAccountIds(
  data: DataAccess,
  terms: SearchTerms,
): Promise<string[]> {
  return selectIds(
    data,
    `SELECT account.id
     FROM accounts account
     WHERE account.user_id = :userId
       AND (${matches('account.name')} OR ${matches('account.institution')})`,
    terms,
  )
}

function matchingScheduleIds(
  data: DataAccess,
  terms: SearchTerms,
): Promise<string[]> {
  return selectIds(
    data,
    `SELECT schedule.id
     FROM schedules schedule
     WHERE schedule.user_id = :userId
       AND NOT schedule.is_system
       AND (
         ${matches('schedule.label')}
         OR ${matches('schedule.note')}
         OR schedule.category_id IN (${matchingCategoryIds})
         OR schedule.id IN (${matchingTaggedIds('schedule_tags', 'schedule_id')})
         OR ${amountMatches('schedule.amount_cents')}
       )`,
    terms,
  )
}

function matchingEnvelopeIds(
  data: DataAccess,
  terms: SearchTerms,
): Promise<string[]> {
  return selectIds(
    data,
    `SELECT envelope.id
     FROM envelopes envelope
     WHERE envelope.user_id = :userId
       AND (
         ${matches('envelope.label')}
         OR envelope.id IN (
           SELECT link.envelope_id
           FROM envelope_categories link
           WHERE link.user_id = :userId
             AND link.category_id IN (${matchingCategoryIds})
         )
         OR ${amountMatches('envelope.monthly_amount_cents')}
       )`,
    terms,
  )
}

async function searchOperations(
  data: DataAccess,
  terms: SearchTerms,
  page: SearchOperationPage,
): Promise<SearchOperations> {
  const [countRows, ids] = await Promise.all([
    data.sequelize.query(
      `SELECT count(*) AS total FROM transactions operation
       WHERE ${operationConditions}`,
      { replacements: terms, type: QueryTypes.SELECT },
    ),
    selectIds(
      data,
      `SELECT operation.id
       FROM transactions operation
       WHERE ${operationConditions}
       ORDER BY operation.date DESC, operation.created_at DESC, operation.id DESC
       LIMIT :limit OFFSET :offset`,
      terms,
      { limit: page.limit, offset: page.offset },
    ),
  ])
  const [count] = searchCountRowsSchema.parse(countRows)
  const rows =
    ids.length === 0
      ? []
      : await data.models.Transaction.findAll({
          where: { userId: terms.userId, id: { [Op.in]: ids } },
        })
  const position = new Map(ids.map((id, index) => [id, index]))
  const ordered = [...rows].sort(
    (first, second) =>
      (position.get(first.id) ?? 0) - (position.get(second.id) ?? 0),
  )
  return {
    items: await toOperations(data, ordered),
    total: count?.total ?? 0,
  }
}

async function accountResults(
  app: AppDependencies,
  userId: string,
  ids: readonly string[],
  today: string,
): Promise<Account[]> {
  if (ids.length === 0) {
    return []
  }
  const rows = await app.models.Account.findAll({
    where: { userId, id: { [Op.in]: ids } },
    order: [
      ['sortOrder', 'ASC'],
      ['createdAt', 'ASC'],
    ],
  })
  const balances = await loadAccountBalances(app, userId, today)
  const gaps = await loadStatementGaps(app, userId)
  const investments = await loadInvestmentSummaries(app, userId, rows, today)
  const savings = await loadSavingsSummaries(app, userId, rows, today)
  const overview = buildAccountOverview(
    rows.map((row) => toAccount(row, balances, gaps, investments, savings)),
  )
  return [
    ...overview.groups.flatMap((group) => group.accounts),
    ...overview.archived,
  ]
}

function isCurrentSchedule(schedule: Schedule): boolean {
  return schedule.active && !schedule.ended
}

async function scheduleResults(
  app: AppDependencies,
  user: UserModel,
  ids: readonly string[],
  today: string,
): Promise<Schedule[]> {
  if (ids.length === 0) {
    return []
  }
  const { views } = await loadScheduleViews(
    app,
    user.id,
    today,
    user.forecastHorizonMonths,
  )
  const wanted = new Set(ids)
  const found = views.filter((schedule) => wanted.has(schedule.id))
  return [
    ...found.filter(isCurrentSchedule),
    ...found.filter((schedule) => !isCurrentSchedule(schedule)),
  ]
}

async function envelopeResults(
  app: AppDependencies,
  userId: string,
  ids: readonly string[],
  today: string,
): Promise<SearchEnvelope[]> {
  if (ids.length === 0) {
    return []
  }
  const wanted = new Set(ids)
  const month = await envelopeMonth(app, userId, monthStart(today), today)
  return [
    ...month.lines
      .filter((line) => wanted.has(line.envelope.id))
      .map((line) => ({ envelope: line.envelope, status: line.status })),
    ...month.inactive
      .filter((envelope) => wanted.has(envelope.id))
      .map((envelope) => ({ envelope, status: null })),
  ]
}

export async function globalSearch(
  app: AppDependencies,
  user: UserModel,
  query: SearchQuery,
): Promise<SearchResponse> {
  const terms: SearchTerms = {
    userId: user.id,
    pattern: `%${escapeLike(query.q)}%`,
    amountCents: query.amountCents ?? null,
  }
  const today = parisDate(app.clock.now())
  const [accountIds, scheduleIds, envelopeIds, operations] = await Promise.all([
    matchingAccountIds(app, terms),
    matchingScheduleIds(app, terms),
    matchingEnvelopeIds(app, terms),
    searchOperations(app, terms, {
      offset: query.operationsOffset,
      limit: query.operationsLimit,
    }),
  ])
  return {
    accounts: await accountResults(app, user.id, accountIds, today),
    operations,
    schedules: await scheduleResults(app, user, scheduleIds, today),
    envelopes: await envelopeResults(app, user.id, envelopeIds, today),
  }
}
