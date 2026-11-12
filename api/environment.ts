import { z } from 'zod'

export function parseEnvironment<Schema extends z.ZodType>(
  schema: Schema,
  environment: NodeJS.ProcessEnv,
): z.output<Schema> {
  const result = schema.safeParse(environment)
  if (!result.success) {
    throw new Error(`Invalid environment\n${z.prettifyError(result.error)}`)
  }
  return result.data
}
