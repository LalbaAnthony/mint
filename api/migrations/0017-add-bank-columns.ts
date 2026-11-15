import type { QueryInterface } from 'sequelize'

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    ALTER TABLE transactions
      ADD COLUMN bank_label text CONSTRAINT transactions_bank_label_check
        CHECK (bank_label IS NULL OR length(btrim(bank_label)) > 0),
      ADD COLUMN import_batch_id uuid
        REFERENCES import_batches (id) ON DELETE SET NULL,
      ADD COLUMN dedup_hash text,
      ADD COLUMN pre_merge_snapshot jsonb
  `)
  await queryInterface.sequelize.query(
    'CREATE INDEX transactions_account_dedup_hash_idx ON transactions (account_id, dedup_hash)',
  )
  await queryInterface.sequelize.query(
    'CREATE INDEX transactions_import_batch_id_idx ON transactions (import_batch_id)',
  )
  await queryInterface.sequelize.query(`
    ALTER TABLE schedules
      ADD COLUMN amount_tolerance_pct smallint NOT NULL DEFAULT 10
        CONSTRAINT schedules_amount_tolerance_pct_check
        CHECK (amount_tolerance_pct BETWEEN 0 AND 100),
      ADD COLUMN bank_label_patterns text[] NOT NULL DEFAULT '{}'
  `)
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    ALTER TABLE schedules
      DROP COLUMN IF EXISTS bank_label_patterns,
      DROP COLUMN IF EXISTS amount_tolerance_pct
  `)
  await queryInterface.sequelize.query(`
    ALTER TABLE transactions
      DROP COLUMN IF EXISTS pre_merge_snapshot,
      DROP COLUMN IF EXISTS dedup_hash,
      DROP COLUMN IF EXISTS import_batch_id,
      DROP COLUMN IF EXISTS bank_label
  `)
}
