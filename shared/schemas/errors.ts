import { z } from 'zod'

export const apiErrorCodes = [
  'validation_failed',
  'unauthenticated',
  'forbidden',
  'not_found',
  'csrf_invalid',
  'invalid_credentials',
  'account_locked',
  'too_many_attempts',
  'account_disabled',
  'invitation_invalid',
  'invitation_expired',
  'token_invalid',
  'token_expired',
  'email_taken',
  'invitation_pending',
  'invitation_not_resendable',
  'invitation_not_revocable',
  'cannot_disable_self',
  'user_disabled',
  'mail_delivery_failed',
  'archived',
  'not_archived',
  'account_archived',
  'parent_archived',
  'category_name_taken',
  'tag_name_taken',
  'system_category',
  'invalid_parent',
  'order_mismatch',
  'account_has_operations',
  'account_in_use',
  'payment_method_in_use',
  'payment_method_archived',
  'category_archived',
  'category_in_use',
  'category_in_envelope',
  'invalid_replacement',
  'operations_before_initial_balance',
  'occurrence_not_editable',
  'operation_is_transfer',
  'operation_without_bank_label',
  'statement_exists',
  'statement_balanced',
  'import_not_pending',
  'import_not_validated',
  'import_not_previewed',
  'occurrence_not_candidate',
  'operation_reconciled',
  'operation_not_reconciled',
  'internal_error',
] as const

export const apiErrorCodeSchema = z.enum(apiErrorCodes)

export const validationIssueSchema = z.object({
  path: z.array(z.union([z.string(), z.number()])),
  message: z.string(),
})

export const apiErrorResponseSchema = z
  .object({
    error: z.string(),
    issues: z.array(validationIssueSchema).optional(),
    retryAfterSeconds: z.number().int().optional(),
  })
  .meta({ id: 'ApiError' })
