import type { QueryInterface } from 'sequelize'

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    CREATE TABLE envelopes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      label text NOT NULL CONSTRAINT envelopes_label_check
        CHECK (length(btrim(label)) > 0),
      monthly_amount_cents bigint NOT NULL
        CONSTRAINT envelopes_monthly_amount_cents_check
        CHECK (monthly_amount_cents > 0),
      payment_method_id uuid,
      account_id uuid,
      carry_over boolean NOT NULL DEFAULT false,
      active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT envelopes_id_user_id_key UNIQUE (id, user_id),
      CONSTRAINT envelopes_payment_method_same_user_fkey
        FOREIGN KEY (payment_method_id, user_id)
        REFERENCES payment_methods (id, user_id),
      CONSTRAINT envelopes_account_same_user_fkey
        FOREIGN KEY (account_id, user_id) REFERENCES accounts (id, user_id),
      CONSTRAINT envelopes_default_account_check
        CHECK (num_nonnulls(payment_method_id, account_id) = 1)
    )
  `)
  await queryInterface.sequelize.query(
    'CREATE INDEX envelopes_user_id_idx ON envelopes (user_id)',
  )
  await queryInterface.sequelize.query(`
    CREATE TABLE envelope_categories (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      envelope_id uuid NOT NULL,
      category_id uuid NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT envelope_categories_envelope_same_user_fkey
        FOREIGN KEY (envelope_id, user_id) REFERENCES envelopes (id, user_id)
        ON DELETE CASCADE,
      CONSTRAINT envelope_categories_category_same_user_fkey
        FOREIGN KEY (category_id, user_id) REFERENCES categories (id, user_id),
      CONSTRAINT envelope_categories_category_id_key UNIQUE (category_id)
    )
  `)
  await queryInterface.sequelize.query(
    'CREATE INDEX envelope_categories_envelope_id_idx ON envelope_categories (envelope_id)',
  )
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(
    'DROP TABLE IF EXISTS envelope_categories',
  )
  await queryInterface.sequelize.query('DROP TABLE IF EXISTS envelopes')
}
