import type { Migration } from '../types/migration.js'
import * as enableCitext from './0001-enable-citext.js'
import * as createUsers from './0002-create-users.js'
import * as createSessions from './0003-create-sessions.js'
import * as createInvitations from './0004-create-invitations.js'
import * as createPasswordResetTokens from './0005-create-password-reset-tokens.js'
import * as createEmailChangeTokens from './0006-create-email-change-tokens.js'
import * as createCategories from './0007-create-categories.js'
import * as addSystemCategories from './0008-add-system-categories.js'
import * as createAccounts from './0009-create-accounts.js'
import * as createPaymentMethods from './0010-create-payment-methods.js'
import * as createSchedules from './0011-create-schedules.js'
import * as createScheduleOccurrences from './0012-create-schedule-occurrences.js'
import * as createTransactions from './0013-create-transactions.js'
import * as createEnvelopes from './0014-create-envelopes.js'

export const migrations: Migration[] = [
  { name: '0001-enable-citext', ...enableCitext },
  { name: '0002-create-users', ...createUsers },
  { name: '0003-create-sessions', ...createSessions },
  { name: '0004-create-invitations', ...createInvitations },
  { name: '0005-create-password-reset-tokens', ...createPasswordResetTokens },
  { name: '0006-create-email-change-tokens', ...createEmailChangeTokens },
  { name: '0007-create-categories', ...createCategories },
  { name: '0008-add-system-categories', ...addSystemCategories },
  { name: '0009-create-accounts', ...createAccounts },
  { name: '0010-create-payment-methods', ...createPaymentMethods },
  { name: '0011-create-schedules', ...createSchedules },
  { name: '0012-create-schedule-occurrences', ...createScheduleOccurrences },
  { name: '0013-create-transactions', ...createTransactions },
  { name: '0014-create-envelopes', ...createEnvelopes },
]
