import type { QueryInterface } from 'sequelize'

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    CREATE TABLE schedule_occurrences (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      schedule_id uuid NOT NULL REFERENCES schedules (id) ON DELETE CASCADE,
      original_date date NOT NULL,
      effective_date date,
      amount_cents bigint CONSTRAINT schedule_occurrences_amount_cents_check
        CHECK (amount_cents IS NULL OR amount_cents > 0),
      state text NOT NULL CONSTRAINT schedule_occurrences_state_check
        CHECK (state IN ('overridden', 'skipped', 'executed')),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT schedule_occurrences_schedule_original_date_key
        UNIQUE (schedule_id, original_date),
      CONSTRAINT schedule_occurrences_override_check CHECK (
        state <> 'overridden' OR num_nonnulls(effective_date, amount_cents) > 0
      ),
      CONSTRAINT schedule_occurrences_executed_check CHECK (
        state <> 'executed'
        OR (effective_date IS NOT NULL AND amount_cents IS NOT NULL)
      )
    )
  `)
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(
    'DROP TABLE IF EXISTS schedule_occurrences',
  )
}
