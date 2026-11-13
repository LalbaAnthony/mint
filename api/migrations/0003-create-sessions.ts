import type { QueryInterface } from 'sequelize'

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    CREATE TABLE sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      sid text NOT NULL CONSTRAINT sessions_sid_key UNIQUE,
      user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      data jsonb NOT NULL,
      expires_at timestamptz NOT NULL,
      user_agent text,
      ip text,
      last_seen_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `)
  await queryInterface.sequelize.query(
    'CREATE INDEX sessions_user_id_idx ON sessions (user_id)',
  )
  await queryInterface.sequelize.query(
    'CREATE INDEX sessions_expires_at_idx ON sessions (expires_at)',
  )
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query('DROP TABLE IF EXISTS sessions')
}
