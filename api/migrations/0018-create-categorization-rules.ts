import type { QueryInterface } from 'sequelize'

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    CREATE TABLE categorization_rules (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      priority integer NOT NULL,
      match_type text NOT NULL CONSTRAINT categorization_rules_match_type_check
        CHECK (match_type IN ('contains', 'starts_with', 'regex')),
      pattern text NOT NULL CONSTRAINT categorization_rules_pattern_check
        CHECK (length(btrim(pattern)) > 0),
      account_id uuid,
      sign text NOT NULL CONSTRAINT categorization_rules_sign_check
        CHECK (sign IN ('debit', 'credit', 'any')),
      amount_min_cents bigint CHECK (amount_min_cents >= 0),
      amount_max_cents bigint CHECK (amount_max_cents >= 0),
      action_category_id uuid,
      action_transfer_account_id uuid,
      active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT categorization_rules_account_same_user_fkey
        FOREIGN KEY (account_id, user_id) REFERENCES accounts (id, user_id),
      CONSTRAINT categorization_rules_category_same_user_fkey
        FOREIGN KEY (action_category_id, user_id)
        REFERENCES categories (id, user_id),
      CONSTRAINT categorization_rules_transfer_account_same_user_fkey
        FOREIGN KEY (action_transfer_account_id, user_id)
        REFERENCES accounts (id, user_id),
      CONSTRAINT categorization_rules_single_action_check CHECK (
        (action_category_id IS NULL) <> (action_transfer_account_id IS NULL)
      ),
      CONSTRAINT categorization_rules_amount_range_check CHECK (
        amount_min_cents IS NULL OR amount_max_cents IS NULL
        OR amount_min_cents <= amount_max_cents
      )
    )
  `)
  await queryInterface.sequelize.query(
    'CREATE INDEX categorization_rules_user_priority_idx ON categorization_rules (user_id, priority)',
  )
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(
    'DROP TABLE IF EXISTS categorization_rules',
  )
}
