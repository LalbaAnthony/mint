import type { QueryInterface } from 'sequelize'

const parisToday = "(now() AT TIME ZONE 'Europe/Paris')::date"

export async function up(queryInterface: QueryInterface): Promise<void> {
  for (const table of ['schedules', 'envelopes']) {
    await queryInterface.sequelize.query(`
      ALTER TABLE ${table} ADD COLUMN created_on date DEFAULT ${parisToday}
    `)
    await queryInterface.sequelize.query(`
      UPDATE ${table}
      SET created_on = (created_at AT TIME ZONE 'Europe/Paris')::date
    `)
    await queryInterface.sequelize.query(`
      ALTER TABLE ${table} ALTER COLUMN created_on SET NOT NULL
    `)
  }
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  for (const table of ['schedules', 'envelopes']) {
    await queryInterface.sequelize.query(
      `ALTER TABLE ${table} DROP COLUMN IF EXISTS created_on`,
    )
  }
}
