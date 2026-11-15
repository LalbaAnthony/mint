import type { QueryInterface } from 'sequelize'

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    CREATE TABLE regulated_caps (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      product text NOT NULL CONSTRAINT regulated_caps_product_key UNIQUE
        CONSTRAINT regulated_caps_product_check
        CHECK (product IN ('livret_a', 'ldds', 'lep', 'pel', 'cel')),
      cap_cents bigint NOT NULL CONSTRAINT regulated_caps_cap_cents_check
        CHECK (cap_cents > 0),
      updated_by uuid REFERENCES users (id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `)
  await queryInterface.sequelize.query(`
    INSERT INTO regulated_caps (product, cap_cents) VALUES
      ('livret_a', 2295000),
      ('ldds', 1200000),
      ('lep', 1000000),
      ('pel', 6120000),
      ('cel', 1530000)
  `)
  await queryInterface.sequelize.query(`
    ALTER TABLE accounts
      ADD COLUMN deposit_cap_cents bigint
        CONSTRAINT accounts_deposit_cap_cents_check
        CHECK (deposit_cap_cents IS NULL OR deposit_cap_cents > 0),
      ADD COLUMN capitalized_interest_cents bigint
        CONSTRAINT accounts_capitalized_interest_cents_check
        CHECK (capitalized_interest_cents IS NULL OR capitalized_interest_cents >= 0),
      ADD COLUMN interest_method text
        CONSTRAINT accounts_interest_method_check
        CHECK (interest_method IN ('fortnight', 'daily')),
      ADD COLUMN capitalization text
        CONSTRAINT accounts_capitalization_check
        CHECK (capitalization IN ('dec31', 'anniversary')),
      ADD COLUMN anniversary_date date
  `)
  await queryInterface.sequelize.query(`
    UPDATE accounts a
       SET deposit_cap_cents = c.cap_cents,
           capitalized_interest_cents = 0,
           interest_method = 'fortnight',
           capitalization = 'dec31'
      FROM regulated_caps c
     WHERE c.product = a.regulated_product
  `)
  await queryInterface.sequelize.query(`
    ALTER TABLE accounts
      ADD CONSTRAINT accounts_savings_fields_check CHECK (
        (nature IN ('regulated_savings', 'housing_savings')
          AND capitalized_interest_cents IS NOT NULL
          AND interest_method IS NOT NULL
          AND capitalization IS NOT NULL)
        OR (nature NOT IN ('regulated_savings', 'housing_savings')
          AND deposit_cap_cents IS NULL
          AND capitalized_interest_cents IS NULL
          AND interest_method IS NULL
          AND capitalization IS NULL)
      ),
      ADD CONSTRAINT accounts_anniversary_date_check CHECK (
        (capitalization = 'anniversary') = (anniversary_date IS NOT NULL)
      )
  `)
  await queryInterface.sequelize.query(`
    CREATE TABLE interest_rates (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      account_id uuid NOT NULL,
      effective_date date NOT NULL,
      annual_rate numeric(6, 4) NOT NULL
        CONSTRAINT interest_rates_annual_rate_check CHECK (annual_rate >= 0),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT interest_rates_account_effective_date_key
        UNIQUE (account_id, effective_date),
      CONSTRAINT interest_rates_account_same_user_fkey
        FOREIGN KEY (account_id, user_id) REFERENCES accounts (id, user_id)
        ON DELETE CASCADE
    )
  `)
  await queryInterface.sequelize.query(`
    ALTER TABLE schedules
      ADD COLUMN is_system boolean NOT NULL DEFAULT false,
      DROP CONSTRAINT schedules_amount_cents_check,
      ADD CONSTRAINT schedules_amount_cents_check
        CHECK (amount_cents > 0 OR (is_system AND amount_cents = 0)),
      ADD CONSTRAINT schedules_system_interest_check CHECK (
        NOT is_system
        OR (kind = 'income' AND account_id IS NOT NULL
          AND trigger_mode = 'auto' AND frequency = 'yearly')
      )
  `)
  await queryInterface.sequelize.query(
    'CREATE UNIQUE INDEX schedules_system_account_key ON schedules (account_id) WHERE is_system',
  )
  await queryInterface.sequelize.query(`
    INSERT INTO schedules (
      user_id, kind, label, amount_cents, account_id, category_id,
      trigger_mode, frequency, "interval", start_date, anchor_last_day,
      business_day_rule, amount_tolerance_pct, is_system
    )
    SELECT a.user_id, 'income',
      CASE u.locale WHEN 'en' THEN 'Interest' ELSE 'Intérêts' END,
      0, a.id, c.id, 'auto', 'yearly', 1,
      make_date(extract(year FROM a.initial_balance_date)::int, 12, 31),
      false, 'exact', 100, true
    FROM accounts a
    JOIN users u ON u.id = a.user_id
    JOIN categories c
      ON c.user_id = a.user_id AND c.is_system AND c.kind = 'income'
    WHERE a.nature IN ('regulated_savings', 'housing_savings')
  `)
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query('DELETE FROM schedules WHERE is_system')
  await queryInterface.sequelize.query(
    'DROP INDEX IF EXISTS schedules_system_account_key',
  )
  await queryInterface.sequelize.query(`
    ALTER TABLE schedules
      DROP CONSTRAINT IF EXISTS schedules_system_interest_check,
      DROP CONSTRAINT schedules_amount_cents_check,
      ADD CONSTRAINT schedules_amount_cents_check CHECK (amount_cents > 0),
      DROP COLUMN IF EXISTS is_system
  `)
  await queryInterface.sequelize.query('DROP TABLE IF EXISTS interest_rates')
  await queryInterface.sequelize.query(`
    ALTER TABLE accounts
      DROP CONSTRAINT IF EXISTS accounts_anniversary_date_check,
      DROP CONSTRAINT IF EXISTS accounts_savings_fields_check,
      DROP COLUMN IF EXISTS anniversary_date,
      DROP COLUMN IF EXISTS capitalization,
      DROP COLUMN IF EXISTS interest_method,
      DROP COLUMN IF EXISTS capitalized_interest_cents,
      DROP COLUMN IF EXISTS deposit_cap_cents
  `)
  await queryInterface.sequelize.query('DROP TABLE IF EXISTS regulated_caps')
}
