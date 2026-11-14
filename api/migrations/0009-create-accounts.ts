import type { QueryInterface } from 'sequelize'

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    CREATE TABLE accounts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      name text NOT NULL CONSTRAINT accounts_name_check
        CHECK (length(btrim(name)) > 0),
      nature text NOT NULL CONSTRAINT accounts_nature_check
        CHECK (nature IN (
          'current_account', 'regulated_savings', 'housing_savings',
          'life_insurance', 'securities_account', 'crypto_wallet',
          'meal_vouchers', 'e_wallet', 'other'
        )),
      regulated_product text,
      usage text NOT NULL CONSTRAINT accounts_usage_check
        CHECK (usage IN ('current', 'emergency', 'savings', 'investment')),
      institution text CONSTRAINT accounts_institution_check
        CHECK (institution IS NULL OR length(btrim(institution)) > 0),
      initial_balance_cents bigint NOT NULL,
      initial_balance_date date NOT NULL,
      low_balance_threshold_cents bigint,
      sort_order integer NOT NULL DEFAULT 0,
      archived_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT accounts_id_user_id_key UNIQUE (id, user_id),
      CONSTRAINT accounts_regulated_product_check CHECK (
        (nature = 'regulated_savings'
          AND regulated_product IN ('livret_a', 'ldds', 'lep'))
        OR (nature = 'housing_savings'
          AND regulated_product IN ('pel', 'cel'))
        OR (nature NOT IN ('regulated_savings', 'housing_savings')
          AND regulated_product IS NULL)
      )
    )
  `)
  await queryInterface.sequelize.query(
    'CREATE INDEX accounts_user_id_idx ON accounts (user_id)',
  )
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query('DROP TABLE IF EXISTS accounts')
}
