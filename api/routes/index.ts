import type { ApiRoute } from '../types/http.js'
import {
  createInvitationRoute,
  disableUserRoute,
  enableUserRoute,
  listInvitationsRoute,
  listUsersRoute,
  resendInvitationRoute,
  revokeInvitationRoute,
  sendPasswordResetRoute,
} from './admin.js'
import {
  acceptInvitationRoute,
  checkInvitationRoute,
  confirmEmailChangeRoute,
  confirmPasswordResetRoute,
  loginRoute,
  logoutRoute,
  requestPasswordResetRoute,
  sessionRoute,
} from './auth.js'
import { csrfRoute } from './csrf.js'
import { healthRoute } from './health.js'
import {
  changePasswordRoute,
  listSessionsRoute,
  requestEmailChangeRoute,
  revokeSessionsRoute,
  updateProfileRoute,
} from './profile.js'

export const apiRoutes: ApiRoute[] = [
  healthRoute,
  csrfRoute,
  loginRoute,
  logoutRoute,
  sessionRoute,
  checkInvitationRoute,
  acceptInvitationRoute,
  requestPasswordResetRoute,
  confirmPasswordResetRoute,
  confirmEmailChangeRoute,
  updateProfileRoute,
  changePasswordRoute,
  requestEmailChangeRoute,
  listSessionsRoute,
  revokeSessionsRoute,
  listInvitationsRoute,
  createInvitationRoute,
  resendInvitationRoute,
  revokeInvitationRoute,
  listUsersRoute,
  disableUserRoute,
  enableUserRoute,
  sendPasswordResetRoute,
]
