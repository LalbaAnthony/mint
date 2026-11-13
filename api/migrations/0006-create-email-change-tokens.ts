import type { QueryInterface } from 'sequelize'

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    CREATE TABLE email_change_tokens (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      new_email citext NOT NULL,
      token_hash text NOT NULL
        CONSTRAINT email_change_tokens_token_hash_key UNIQUE,
      expires_at timestamptz NOT NULL,
      used_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `)
  await queryInterface.sequelize.query(
    'CREATE INDEX email_change_tokens_user_id_idx ON email_change_tokens (user_id)',
  )
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(
    'DROP TABLE IF EXISTS email_change_tokens',
  )
}
