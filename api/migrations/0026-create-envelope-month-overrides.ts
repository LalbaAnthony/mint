import type { QueryInterface } from 'sequelize'

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    CREATE TABLE envelope_month_overrides (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      envelope_id uuid NOT NULL REFERENCES envelopes (id) ON DELETE CASCADE,
      month date NOT NULL CONSTRAINT envelope_month_overrides_month_check
        CHECK (extract(day FROM month) = 1),
      amount_cents bigint NOT NULL
        CONSTRAINT envelope_month_overrides_amount_cents_check
        CHECK (amount_cents >= 0),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT envelope_month_overrides_envelope_month_key
        UNIQUE (envelope_id, month)
    )
  `)
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(
    'DROP TABLE IF EXISTS envelope_month_overrides',
  )
}
