import type { QueryInterface } from 'sequelize'

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    CREATE TABLE transactions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      account_id uuid NOT NULL,
      payment_method_id uuid,
      date date NOT NULL,
      amount_cents bigint NOT NULL CONSTRAINT transactions_amount_cents_check
        CHECK (amount_cents <> 0),
      label text NOT NULL CONSTRAINT transactions_label_check
        CHECK (length(btrim(label)) > 0),
      note text,
      category_id uuid,
      status text NOT NULL CONSTRAINT transactions_status_check
        CHECK (status IN ('categorized', 'to_categorize')),
      origin text NOT NULL CONSTRAINT transactions_origin_check
        CHECK (origin IN ('manual', 'import', 'schedule')),
      transfer_group_id uuid,
      occurrence_id uuid
        REFERENCES schedule_occurrences (id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT transactions_account_same_user_fkey
        FOREIGN KEY (account_id, user_id) REFERENCES accounts (id, user_id),
      CONSTRAINT transactions_payment_method_same_user_fkey
        FOREIGN KEY (payment_method_id, user_id)
        REFERENCES payment_methods (id, user_id),
      CONSTRAINT transactions_category_same_user_fkey
        FOREIGN KEY (category_id, user_id) REFERENCES categories (id, user_id),
      CONSTRAINT transactions_occurrence_account_key
        UNIQUE (occurrence_id, account_id),
      CONSTRAINT transactions_transfer_without_category_check
        CHECK (transfer_group_id IS NULL OR category_id IS NULL),
      CONSTRAINT transactions_status_category_check CHECK (
        (status = 'to_categorize')
        = (category_id IS NULL AND transfer_group_id IS NULL)
      )
    )
  `)
  await queryInterface.sequelize.query(
    'CREATE INDEX transactions_user_account_date_idx ON transactions (user_id, account_id, date)',
  )
  await queryInterface.sequelize.query(
    'CREATE INDEX transactions_category_id_idx ON transactions (category_id)',
  )
  await queryInterface.sequelize.query(
    'CREATE INDEX transactions_payment_method_id_idx ON transactions (payment_method_id)',
  )
  await queryInterface.sequelize.query(
    'CREATE INDEX transactions_transfer_group_id_idx ON transactions (transfer_group_id)',
  )
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query('DROP TABLE IF EXISTS transactions')
}
