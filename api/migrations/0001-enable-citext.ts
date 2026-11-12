import type { QueryInterface } from 'sequelize'

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS citext')
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query('DROP EXTENSION IF EXISTS citext')
}
