import type { QueryInterface } from 'sequelize'

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    CREATE TABLE import_mappings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      account_id uuid NOT NULL,
      delimiter text NOT NULL CONSTRAINT import_mappings_delimiter_check
        CHECK (delimiter IN ('semicolon', 'comma', 'tab')),
      encoding text NOT NULL CONSTRAINT import_mappings_encoding_check
        CHECK (encoding IN ('utf-8', 'windows-1252')),
      has_header boolean NOT NULL,
      skip_top smallint NOT NULL CONSTRAINT import_mappings_skip_top_check
        CHECK (skip_top BETWEEN 0 AND 100),
      skip_bottom smallint NOT NULL CONSTRAINT import_mappings_skip_bottom_check
        CHECK (skip_bottom BETWEEN 0 AND 100),
      date_format text NOT NULL CONSTRAINT import_mappings_date_format_check
        CHECK (date_format IN (
          'DD/MM/YYYY', 'DD/MM/YY', 'DD-MM-YYYY', 'DD.MM.YYYY',
          'YYYY-MM-DD', 'MM/DD/YYYY'
        )),
      decimal_separator text NOT NULL
        CONSTRAINT import_mappings_decimal_separator_check
        CHECK (decimal_separator IN ('comma', 'dot')),
      col_date smallint NOT NULL CHECK (col_date >= 0),
      col_label smallint NOT NULL CHECK (col_label >= 0),
      col_amount smallint CHECK (col_amount >= 0),
      col_debit smallint CHECK (col_debit >= 0),
      col_credit smallint CHECK (col_credit >= 0),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT import_mappings_account_id_key UNIQUE (account_id),
      CONSTRAINT import_mappings_account_same_user_fkey
        FOREIGN KEY (account_id, user_id) REFERENCES accounts (id, user_id)
        ON DELETE CASCADE,
      CONSTRAINT import_mappings_amount_columns_check CHECK (
        (col_amount IS NOT NULL AND col_debit IS NULL AND col_credit IS NULL)
        OR (col_amount IS NULL AND col_debit IS NOT NULL
          AND col_credit IS NOT NULL)
      )
    )
  `)
  await queryInterface.sequelize.query(`
    CREATE TABLE import_batches (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      account_id uuid NOT NULL,
      filename text NOT NULL CONSTRAINT import_batches_filename_check
        CHECK (length(btrim(filename)) > 0),
      status text NOT NULL CONSTRAINT import_batches_status_check
        CHECK (status IN ('pending', 'validated', 'cancelled')),
      raw_file bytea,
      rows_read integer NOT NULL DEFAULT 0,
      rows_created integer NOT NULL DEFAULT 0,
      rows_duplicate integer NOT NULL DEFAULT 0,
      rows_merged integer NOT NULL DEFAULT 0,
      validated_at timestamptz,
      cancelled_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT import_batches_id_user_id_key UNIQUE (id, user_id),
      CONSTRAINT import_batches_account_same_user_fkey
        FOREIGN KEY (account_id, user_id) REFERENCES accounts (id, user_id)
        ON DELETE CASCADE,
      CONSTRAINT import_batches_raw_file_check
        CHECK (status = 'pending' OR raw_file IS NULL)
    )
  `)
  await queryInterface.sequelize.query(
    'CREATE INDEX import_batches_account_id_idx ON import_batches (account_id, created_at)',
  )
  await queryInterface.sequelize.query(`
    CREATE TABLE import_rows (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      batch_id uuid NOT NULL REFERENCES import_batches (id) ON DELETE CASCADE,
      row_index integer NOT NULL CHECK (row_index >= 0),
      raw jsonb NOT NULL,
      date date,
      amount_cents bigint,
      bank_label text,
      dedup_hash text,
      error text,
      duplicate boolean NOT NULL DEFAULT false,
      proposed_rule_id uuid,
      proposed_category_id uuid,
      proposed_transfer_account_id uuid,
      proposed_schedule_id uuid,
      proposed_original_date date,
      candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT import_rows_batch_row_key UNIQUE (batch_id, row_index),
      CONSTRAINT import_rows_error_check CHECK (
        (error IS NULL) = (date IS NOT NULL AND amount_cents IS NOT NULL
          AND bank_label IS NOT NULL AND dedup_hash IS NOT NULL)
      )
    )
  `)
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query('DROP TABLE IF EXISTS import_rows')
  await queryInterface.sequelize.query('DROP TABLE IF EXISTS import_batches')
  await queryInterface.sequelize.query('DROP TABLE IF EXISTS import_mappings')
}
