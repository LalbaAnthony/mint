import type { QueryInterface, Sequelize } from 'sequelize'
import { SequelizeStorage, Umzug } from 'umzug'
import { log } from '../logger.js'
import { migrations } from '../migrations/index.js'
import type { LogFields, LogLevel } from '../types/logger.js'

export function logMigrationEvent(level: LogLevel, fields: LogFields): void {
  const { event, ...details } = fields
  const eventName =
    typeof event === 'string' ? `migration_${event}` : 'migration'
  log(level, eventName, details)
}

export function createMigrator(sequelize: Sequelize): Umzug<QueryInterface> {
  return new Umzug({
    migrations: migrations.map((migration) => ({
      name: migration.name,
      up: ({ context }) => migration.up(context),
      down: ({ context }) => migration.down(context),
    })),
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({
      sequelize,
      tableName: 'schema_migrations',
    }),
    logger: {
      debug: (fields) => logMigrationEvent('debug', fields),
      info: (fields) => logMigrationEvent('info', fields),
      warn: (fields) => logMigrationEvent('warn', fields),
      error: (fields) => logMigrationEvent('error', fields),
    },
  })
}
