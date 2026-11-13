import type { QueryInterface } from 'sequelize'

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    CREATE TABLE invitations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email citext NOT NULL,
      token_hash text NOT NULL CONSTRAINT invitations_token_hash_key UNIQUE,
      invited_by uuid REFERENCES users (id) ON DELETE SET NULL,
      expires_at timestamptz NOT NULL,
      accepted_at timestamptz,
      revoked_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT invitations_single_outcome_check
        CHECK (accepted_at IS NULL OR revoked_at IS NULL)
    )
  `)
  await queryInterface.sequelize.query(
    'CREATE INDEX invitations_email_idx ON invitations (email)',
  )
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query('DROP TABLE IF EXISTS invitations')
}
