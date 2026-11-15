import type { QueryInterface } from 'sequelize'

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    CREATE TABLE webauthn_credentials (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      credential_id text NOT NULL
        CONSTRAINT webauthn_credentials_credential_id_key UNIQUE,
      public_key bytea NOT NULL,
      sign_count bigint NOT NULL DEFAULT 0
        CONSTRAINT webauthn_credentials_sign_count_check
        CHECK (sign_count >= 0),
      transports text[] NOT NULL DEFAULT '{}',
      name text NOT NULL CONSTRAINT webauthn_credentials_name_check
        CHECK (length(btrim(name)) BETWEEN 1 AND 60),
      last_used_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `)
  await queryInterface.sequelize.query(`
    CREATE INDEX webauthn_credentials_user_id_idx
      ON webauthn_credentials (user_id, created_at)
  `)
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(
    'DROP TABLE IF EXISTS webauthn_credentials',
  )
}
