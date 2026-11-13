import type { Migration } from '../types/migration.js'
import * as enableCitext from './0001-enable-citext.js'
import * as createUsers from './0002-create-users.js'
import * as createSessions from './0003-create-sessions.js'
import * as createInvitations from './0004-create-invitations.js'
import * as createPasswordResetTokens from './0005-create-password-reset-tokens.js'
import * as createEmailChangeTokens from './0006-create-email-change-tokens.js'
import * as createCategories from './0007-create-categories.js'

export const migrations: Migration[] = [
  { name: '0001-enable-citext', ...enableCitext },
  { name: '0002-create-users', ...createUsers },
  { name: '0003-create-sessions', ...createSessions },
  { name: '0004-create-invitations', ...createInvitations },
  { name: '0005-create-password-reset-tokens', ...createPasswordResetTokens },
  { name: '0006-create-email-change-tokens', ...createEmailChangeTokens },
  { name: '0007-create-categories', ...createCategories },
]
