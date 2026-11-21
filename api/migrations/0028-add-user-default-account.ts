import type { QueryInterface } from 'sequelize'

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    ALTER TABLE users ADD COLUMN default_account_id uuid,
      ADD CONSTRAINT users_default_account_same_user_fkey
        FOREIGN KEY (default_account_id, id) REFERENCES accounts (id, user_id)
        ON DELETE SET NULL (default_account_id)
  `)
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(
    'ALTER TABLE users DROP COLUMN IF EXISTS default_account_id',
  )
}
