import type { QueryInterface } from 'sequelize'

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    CREATE TABLE payment_methods (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      account_id uuid NOT NULL,
      label text NOT NULL CONSTRAINT payment_methods_label_check
        CHECK (length(btrim(label)) > 0),
      kind text NOT NULL CONSTRAINT payment_methods_kind_check
        CHECK (kind IN ('card', 'transfer_out', 'third_party')),
      archived_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT payment_methods_id_user_id_key UNIQUE (id, user_id),
      CONSTRAINT payment_methods_account_same_user_fkey
        FOREIGN KEY (account_id, user_id) REFERENCES accounts (id, user_id)
    )
  `)
  await queryInterface.sequelize.query(
    'CREATE INDEX payment_methods_user_id_idx ON payment_methods (user_id)',
  )
  await queryInterface.sequelize.query(
    'CREATE INDEX payment_methods_account_id_idx ON payment_methods (account_id)',
  )
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query('DROP TABLE IF EXISTS payment_methods')
}
