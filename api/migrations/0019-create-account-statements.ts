import type { QueryInterface } from 'sequelize'

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    CREATE TABLE account_statements (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      account_id uuid NOT NULL,
      date date NOT NULL,
      balance_cents bigint NOT NULL,
      adjustment_transaction_id uuid
        REFERENCES transactions (id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT account_statements_account_date_key UNIQUE (account_id, date),
      CONSTRAINT account_statements_account_same_user_fkey
        FOREIGN KEY (account_id, user_id) REFERENCES accounts (id, user_id)
        ON DELETE CASCADE
    )
  `)
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(
    'DROP TABLE IF EXISTS account_statements',
  )
}
