import type { FormError } from '@nuxt/ui'
import type { z } from 'zod'
import type { ValidationIssue } from '@mint/shared/types/errors'

export function useFormValidation() {
  const { t, te } = useI18n()

  function validationMessage(code: string): string {
    const key = `validation.${code}`
    return te(key) ? t(key) : t('validation.invalid')
  }

  function toFormErrors(
    issues: { path: PropertyKey[]; message: string }[] | ValidationIssue[],
  ): FormError[] {
    return issues.map((issue) => ({
      name: issue.path.map(String).join('.'),
      message: validationMessage(issue.message),
    }))
  }

  function validator(schema: z.ZodType) {
    return (state: unknown): FormError[] => {
      const result = schema.safeParse(state)
      return result.success ? [] : toFormErrors(result.error.issues)
    }
  }

  function errorMessage(error: unknown): string {
    if (!(error instanceof ApiError)) {
      return t('errors.internal_error')
    }
    const key = `errors.${error.code}`
    if (!te(key)) {
      return t('errors.internal_error')
    }
    return t(key, {
      minutes: Math.max(1, Math.ceil((error.retryAfterSeconds ?? 60) / 60)),
    })
  }

  return { validator, toFormErrors, errorMessage }
}
