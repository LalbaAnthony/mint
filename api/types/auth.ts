export type AttemptLimiterOptions = {
  maxFailures: number
  windowMs: number
  lockMs: number
  now: () => number
}

export type AttemptCheck =
  { allowed: true } | { allowed: false; retryAfterSeconds: number }

export type AttemptLimiter = {
  check: (key: string) => AttemptCheck
  recordFailure: (key: string) => AttemptCheck
  reset: (key: string) => void
}

export type GeneratedToken = {
  token: string
  tokenHash: string
}

export type CsrfOptions = {
  secret: string
  secureCookies: boolean
}

export type AuditEvent =
  | 'login_succeeded'
  | 'login_failed'
  | 'login_blocked'
  | 'login_refused_disabled'
  | 'logout'
  | 'sessions_revoked'
  | 'password_changed'
  | 'password_reset_requested'
  | 'password_reset_completed'
  | 'email_change_requested'
  | 'email_changed'
  | 'invitation_created'
  | 'invitation_resent'
  | 'invitation_revoked'
  | 'invitation_accepted'
  | 'user_disabled'
  | 'user_enabled'
  | 'user_password_reset_sent'
  | 'admin_created'
  | 'admin_promoted'
  | 'regulated_cap_updated'
