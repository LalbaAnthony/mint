import { parseEnvironment } from '../environment.js'
import { describeError, log } from '../logger.js'
import { databaseEnvironmentSchema } from '../schemas/environment.js'
import { createMigrator } from './migrator.js'
import { createSequelize } from './sequelize.js'

async function migrate(): Promise<boolean> {
  const environment = parseEnvironment(databaseEnvironmentSchema, process.env)
  const sequelize = createSequelize(environment)
  try {
    return await createMigrator(sequelize).runAsCLI(process.argv.slice(2))
  } finally {
    await sequelize.close()
  }
}

try {
  if (!(await migrate())) {
    process.exitCode = 1
  }
} catch (error) {
  log('error', 'migration_failed', { error: describeError(error) })
  process.exitCode = 1
}
