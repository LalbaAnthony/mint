import { parseArgs } from 'node:util'
import { systemClock } from '../clock.js'
import { createModels } from '../db/models.js'
import { createSequelize } from '../db/sequelize.js'
import { parseEnvironment } from '../environment.js'
import { describeError } from '../logger.js'
import { databaseEnvironmentSchema } from '../schemas/environment.js'
import { seedDatabase } from './seed-database.js'

const usage = [
  'Usage: npm run seed -- --wipe',
  'Deletes every user and invitation, then creates the development data set.',
].join('\n')

async function main(): Promise<string> {
  const { values } = parseArgs({
    strict: true,
    options: { wipe: { type: 'boolean', default: false } },
  })
  if (!values.wipe) {
    throw new Error(usage)
  }
  const environment = parseEnvironment(databaseEnvironmentSchema, process.env)
  const sequelize = createSequelize(environment)
  try {
    const summary = await seedDatabase(
      { sequelize, models: createModels(sequelize) },
      systemClock.now(),
    )
    return [
      `${summary.users} users created, all with the password ${summary.password}`,
      `Administrator: ${summary.administratorEmail}`,
      `Customized categories: ${summary.customizedUserEmail}`,
    ].join('\n')
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
