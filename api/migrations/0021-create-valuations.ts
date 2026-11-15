import type { QueryInterface } from 'sequelize'

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    CREATE TABLE valuations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      account_id uuid NOT NULL,
      date date NOT NULL,
      value_cents bigint NOT NULL CONSTRAINT valuations_value_cents_check
        CHECK (value_cents >= 0),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT valuations_account_date_key UNIQUE (account_id, date),
      CONSTRAINT valuations_account_same_user_fkey
        FOREIGN KEY (account_id, user_id) REFERENCES accounts (id, user_id)
        ON DELETE CASCADE
    )
  `)
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query('DROP TABLE IF EXISTS valuations')
}
