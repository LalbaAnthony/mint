import type { QueryInterface } from 'sequelize'

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    CREATE TABLE notifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      type text NOT NULL CONSTRAINT notifications_type_check
        CHECK (type IN ('low_balance', 'manual_reminder', 'deposit_cap')),
      payload jsonb NOT NULL,
      dedup_key text NOT NULL,
      read_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT notifications_user_dedup_key UNIQUE (user_id, dedup_key)
    )
  `)
  await queryInterface.sequelize.query(
    'CREATE INDEX notifications_user_created_idx ON notifications (user_id, created_at DESC)',
  )
  await queryInterface.sequelize.query(`
    CREATE TABLE alert_episodes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      account_id uuid NOT NULL,
      opened_at timestamptz NOT NULL,
      closed_at timestamptz,
      min_cents bigint NOT NULL,
      min_date date NOT NULL,
      last_notified_min_cents bigint NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT alert_episodes_account_same_user_fkey
        FOREIGN KEY (account_id, user_id) REFERENCES accounts (id, user_id)
        ON DELETE CASCADE
    )
  `)
  await queryInterface.sequelize.query(
    'CREATE UNIQUE INDEX alert_episodes_open_account_key ON alert_episodes (account_id) WHERE closed_at IS NULL',
  )
  await queryInterface.sequelize.query(`
    CREATE TABLE push_subscriptions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      endpoint text NOT NULL CONSTRAINT push_subscriptions_endpoint_key UNIQUE,
      p256dh text NOT NULL,
      auth text NOT NULL,
      user_agent text,
      last_success_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `)
  await queryInterface.sequelize.query(`
    CREATE TABLE notification_preferences (
      user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      type text NOT NULL CONSTRAINT notification_preferences_type_check
        CHECK (type IN ('low_balance', 'manual_reminder')),
      push boolean NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, type)
    )
  `)
  await queryInterface.sequelize.query(`
    ALTER TABLE schedules
      ADD COLUMN reminder_days_before smallint NOT NULL DEFAULT 2
        CONSTRAINT schedules_reminder_days_before_check
        CHECK (reminder_days_before BETWEEN 0 AND 30)
  `)
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(
    'ALTER TABLE schedules DROP COLUMN IF EXISTS reminder_days_before',
  )
  await queryInterface.sequelize.query(
    'DROP TABLE IF EXISTS notification_preferences',
  )
  await queryInterface.sequelize.query(
    'DROP TABLE IF EXISTS push_subscriptions',
  )
  await queryInterface.sequelize.query('DROP TABLE IF EXISTS alert_episodes')
  await queryInterface.sequelize.query('DROP TABLE IF EXISTS notifications')
}
