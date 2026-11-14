import type { QueryInterface } from 'sequelize'

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    CREATE TABLE schedules (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      kind text NOT NULL CONSTRAINT schedules_kind_check
        CHECK (kind IN ('expense', 'income', 'transfer')),
      label text NOT NULL CONSTRAINT schedules_label_check
        CHECK (length(btrim(label)) > 0),
      amount_cents bigint NOT NULL CONSTRAINT schedules_amount_cents_check
        CHECK (amount_cents > 0),
      payment_method_id uuid,
      account_id uuid,
      source_account_id uuid,
      target_account_id uuid,
      category_id uuid,
      is_subscription boolean NOT NULL DEFAULT false,
      trigger_mode text NOT NULL DEFAULT 'auto'
        CONSTRAINT schedules_trigger_mode_check
        CHECK (trigger_mode IN ('auto', 'manual')),
      frequency text NOT NULL CONSTRAINT schedules_frequency_check
        CHECK (frequency IN ('once', 'weekly', 'monthly', 'yearly')),
      "interval" integer NOT NULL DEFAULT 1
        CONSTRAINT schedules_interval_check CHECK ("interval" >= 1),
      start_date date NOT NULL,
      anchor_last_day boolean NOT NULL DEFAULT false,
      end_date date,
      max_occurrences integer CONSTRAINT schedules_max_occurrences_check
        CHECK (max_occurrences IS NULL OR max_occurrences >= 1),
      business_day_rule text NOT NULL DEFAULT 'exact'
        CONSTRAINT schedules_business_day_rule_check
        CHECK (business_day_rule IN ('exact', 'previous', 'next')),
      active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT schedules_id_user_id_key UNIQUE (id, user_id),
      CONSTRAINT schedules_payment_method_same_user_fkey
        FOREIGN KEY (payment_method_id, user_id)
        REFERENCES payment_methods (id, user_id),
      CONSTRAINT schedules_account_same_user_fkey
        FOREIGN KEY (account_id, user_id) REFERENCES accounts (id, user_id),
      CONSTRAINT schedules_source_account_same_user_fkey
        FOREIGN KEY (source_account_id, user_id)
        REFERENCES accounts (id, user_id),
      CONSTRAINT schedules_target_account_same_user_fkey
        FOREIGN KEY (target_account_id, user_id)
        REFERENCES accounts (id, user_id),
      CONSTRAINT schedules_category_same_user_fkey
        FOREIGN KEY (category_id, user_id) REFERENCES categories (id, user_id),
      CONSTRAINT schedules_kind_fields_check CHECK (
        (kind IN ('expense', 'income')
          AND num_nonnulls(payment_method_id, account_id) = 1
          AND category_id IS NOT NULL
          AND source_account_id IS NULL
          AND target_account_id IS NULL)
        OR (kind = 'transfer'
          AND source_account_id IS NOT NULL
          AND target_account_id IS NOT NULL
          AND source_account_id <> target_account_id
          AND payment_method_id IS NULL
          AND account_id IS NULL
          AND category_id IS NULL)
      ),
      CONSTRAINT schedules_subscription_check
        CHECK (NOT is_subscription OR kind = 'expense'),
      CONSTRAINT schedules_single_end_check
        CHECK (end_date IS NULL OR max_occurrences IS NULL),
      CONSTRAINT schedules_end_date_check
        CHECK (end_date IS NULL OR end_date >= start_date),
      CONSTRAINT schedules_anchor_last_day_check
        CHECK (NOT anchor_last_day OR frequency IN ('monthly', 'yearly')),
      CONSTRAINT schedules_once_check CHECK (
        frequency <> 'once'
        OR ("interval" = 1 AND end_date IS NULL AND max_occurrences IS NULL)
      )
    )
  `)
  await queryInterface.sequelize.query(
    'CREATE INDEX schedules_user_id_idx ON schedules (user_id)',
  )
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query('DROP TABLE IF EXISTS schedules')
}
