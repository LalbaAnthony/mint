import { log } from './logger.js'
import type { AuditEvent } from './types/auth.js'
import type { LogFields } from './types/logger.js'

export function audit(event: AuditEvent, fields: LogFields = {}): void {
  log('info', `audit_${event}`, { ...fields, audit: true })
}
