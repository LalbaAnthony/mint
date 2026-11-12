import type { QueryInterface } from 'sequelize'

export type MigrationStep = (queryInterface: QueryInterface) => Promise<void>

export type Migration = {
  name: string
  up: MigrationStep
  down: MigrationStep
}
