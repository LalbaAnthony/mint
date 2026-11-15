import type { QueryInterface } from 'sequelize'

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    ALTER TABLE schedules
      ADD COLUMN note text CONSTRAINT schedules_note_check
        CHECK (note IS NULL OR length(btrim(note)) > 0)
  `)
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(
    'ALTER TABLE schedules DROP COLUMN IF EXISTS note',
  )
}
