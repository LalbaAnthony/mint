import { parseArgs } from 'node:util'
import { z } from 'zod'
import {
  emailSchema,
  localeSchema,
  newPasswordSchema,
} from '@mint/shared/schemas/user'
import { hashPassword } from '../auth/passwords.js'
import { createModels } from '../db/models.js'
import { createSequelize } from '../db/sequelize.js'
import { parseEnvironment } from '../environment.js'
import { describeError } from '../logger.js'
import { databaseEnvironmentSchema } from '../schemas/environment.js'
import type { CliDatabase } from '../types/cli.js'
import {
  createAdministrator,
  promoteToAdministrator,
} from './admin-commands.js'
import { promptHidden } from './prompt.js'

const usage = [
  'Usage:',
  '  node dist/cli/admin.js create-admin --email <email> [--locale fr|en]',
  '  node dist/cli/admin.js promote --email <email>',
].join('\n')

function parseOrExplain<Schema extends z.ZodType>(
  schema: Schema,
  value: unknown,
  label: string,
): z.output<Schema> {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw new Error(`Invalid ${label}: ${z.prettifyError(result.error)}`)
  }
  return result.data
}

async function readNewPassword(): Promise<string> {
  const password = await promptHidden(
    process.stdin,
    process.stdout,
    'Password: ',
  )
  const confirmation = await promptHidden(
    process.stdin,
    process.stdout,
    'Confirm password: ',
  )
  if (password !== confirmation) {
    throw new Error('The two passwords differ')
  }
  return parseOrExplain(newPasswordSchema, password, 'password')
}

async function runCommand(
  database: CliDatabase,
  command: string | undefined,
  options: { email: string; locale: string },
): Promise<string> {
  if (command === 'create-admin') {
    const locale = parseOrExplain(localeSchema, options.locale, 'locale')
    const password = await readNewPassword()
    await createAdministrator(database, {
      email: options.email,
      locale,
      passwordHash: await hashPassword(password),
    })
    return `Administrator ${options.email} created`
  }
  if (command === 'promote') {
    const result = await promoteToAdministrator(database, options.email)
    return result === 'promoted'
      ? `${options.email} is now an administrator`
      : `${options.email} was already an administrator`
  }
  throw new Error(usage)
}

async function main(): Promise<string> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    strict: true,
    options: {
      email: { type: 'string' },
      locale: { type: 'string', default: 'fr' },
    },
  })
  if (values.email === undefined) {
    throw new Error(usage)
  }
  const email = parseOrExplain(emailSchema, values.email, 'email')
  const environment = parseEnvironment(databaseEnvironmentSchema, process.env)
  const sequelize = createSequelize(environment)
  try {
    return await runCommand(
      { sequelize, models: createModels(sequelize) },
      positionals[0],
      { email, locale: values.locale },
    )
  } finally {
    await sequelize.close()
  }
}

try {
  process.stdout.write(`${await main()}\n`)
} catch (error) {
  process.stderr.write(`${describeError(error)}\n`)
  process.exitCode = 1
}
