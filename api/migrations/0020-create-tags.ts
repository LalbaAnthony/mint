import type { QueryInterface } from 'sequelize'

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    CREATE TABLE tags (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      name citext NOT NULL CONSTRAINT tags_name_check
        CHECK (length(btrim(name)) > 0),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT tags_id_user_id_key UNIQUE (id, user_id),
      CONSTRAINT tags_user_name_key UNIQUE (user_id, name)
    )
  `)
  await queryInterface.sequelize.query(
    'ALTER TABLE transactions ADD CONSTRAINT transactions_id_user_id_key UNIQUE (id, user_id)',
  )
  await queryInterface.sequelize.query(`
    CREATE TABLE transaction_tags (
      transaction_id uuid NOT NULL,
      tag_id uuid NOT NULL,
      user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (transaction_id, tag_id),
      CONSTRAINT transaction_tags_transaction_same_user_fkey
        FOREIGN KEY (transaction_id, user_id)
        REFERENCES transactions (id, user_id) ON DELETE CASCADE,
      CONSTRAINT transaction_tags_tag_same_user_fkey
        FOREIGN KEY (tag_id, user_id) REFERENCES tags (id, user_id)
        ON DELETE CASCADE
    )
  `)
  await queryInterface.sequelize.query(
    'CREATE INDEX transaction_tags_tag_id_idx ON transaction_tags (tag_id)',
  )
  await queryInterface.sequelize.query(`
    CREATE TABLE schedule_tags (
      schedule_id uuid NOT NULL,
      tag_id uuid NOT NULL,
      user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (schedule_id, tag_id),
      CONSTRAINT schedule_tags_schedule_same_user_fkey
        FOREIGN KEY (schedule_id, user_id)
        REFERENCES schedules (id, user_id) ON DELETE CASCADE,
      CONSTRAINT schedule_tags_tag_same_user_fkey
        FOREIGN KEY (tag_id, user_id) REFERENCES tags (id, user_id)
        ON DELETE CASCADE
    )
  `)
  await queryInterface.sequelize.query(
    'CREATE INDEX schedule_tags_tag_id_idx ON schedule_tags (tag_id)',
  )
  await queryInterface.sequelize.query(`
    ALTER TABLE categorization_rules
      ADD COLUMN action_tag_ids uuid[] NOT NULL DEFAULT '{}'
  `)
  await queryInterface.sequelize.query(`
    ALTER TABLE import_rows
      ADD COLUMN proposed_tag_ids uuid[] NOT NULL DEFAULT '{}'
  `)
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(
    'ALTER TABLE import_rows DROP COLUMN IF EXISTS proposed_tag_ids',
  )
  await queryInterface.sequelize.query(
    'ALTER TABLE categorization_rules DROP COLUMN IF EXISTS action_tag_ids',
  )
  await queryInterface.sequelize.query('DROP TABLE IF EXISTS schedule_tags')
  await queryInterface.sequelize.query('DROP TABLE IF EXISTS transaction_tags')
  await queryInterface.sequelize.query(
    'ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_id_user_id_key',
  )
  await queryInterface.sequelize.query('DROP TABLE IF EXISTS tags')
}
