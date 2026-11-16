import type { QueryInterface } from 'sequelize'

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    ALTER TABLE users ADD COLUMN theme text NOT NULL DEFAULT 'system'
      CONSTRAINT users_theme_check CHECK (theme IN ('system', 'light', 'dark'))
  `)
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(
    'ALTER TABLE users DROP COLUMN IF EXISTS theme',
  )
}
