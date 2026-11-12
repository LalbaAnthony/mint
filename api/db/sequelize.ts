import { Sequelize } from 'sequelize'
import { describeError, log } from '../logger.js'
import type { DatabaseEnvironment } from '../types/environment.js'

export function createSequelize(environment: DatabaseEnvironment): Sequelize {
  return new Sequelize({
    dialect: 'postgres',
    host: environment.DATABASE_HOST,
    port: environment.DATABASE_PORT,
    database: environment.DATABASE_NAME,
    username: environment.DATABASE_USER,
    password: environment.DATABASE_PASSWORD,
    logging: false,
    define: { underscored: true },
    pool: { max: 10, min: 0, acquire: 5_000, idle: 10_000 },
    dialectOptions: { connectionTimeoutMillis: 3_000 },
  })
}

export async function isDatabaseReachable(
  sequelize: Sequelize,
): Promise<boolean> {
  try {
    await sequelize.authenticate()
    return true
  } catch (error) {
    log('error', 'database_unreachable', { error: describeError(error) })
    return false
  }
}
