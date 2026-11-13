import type { QueryInterface } from 'sequelize'

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    CREATE TABLE users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email citext NOT NULL CONSTRAINT users_email_key UNIQUE,
      password_hash text NOT NULL,
      role text NOT NULL CONSTRAINT users_role_check
        CHECK (role IN ('admin', 'user')),
      locale text NOT NULL CONSTRAINT users_locale_check
        CHECK (locale IN ('fr', 'en')),
      status text NOT NULL DEFAULT 'active' CONSTRAINT users_status_check
        CHECK (status IN ('active', 'disabled')),
      forecast_horizon_months smallint NOT NULL DEFAULT 3
        CONSTRAINT users_forecast_horizon_check
        CHECK (forecast_horizon_months BETWEEN 1 AND 12),
      target_needs_pct smallint NOT NULL DEFAULT 50
        CONSTRAINT users_target_needs_check
        CHECK (target_needs_pct BETWEEN 0 AND 100),
      target_wants_pct smallint NOT NULL DEFAULT 30
        CONSTRAINT users_target_wants_check
        CHECK (target_wants_pct BETWEEN 0 AND 100),
      target_save_pct smallint NOT NULL DEFAULT 20
        CONSTRAINT users_target_save_check
        CHECK (target_save_pct BETWEEN 0 AND 100),
      last_login_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT users_targets_sum_check
        CHECK (target_needs_pct + target_wants_pct + target_save_pct = 100)
    )
  `)
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query('DROP TABLE IF EXISTS users')
}
