import type { QueryInterface } from 'sequelize'

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    CREATE TABLE categories (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      parent_id uuid,
      kind text NOT NULL CONSTRAINT categories_kind_check
        CHECK (kind IN ('expense', 'income')),
      expense_group text CONSTRAINT categories_expense_group_check
        CHECK (expense_group IN ('needs', 'wants')),
      name text NOT NULL CONSTRAINT categories_name_check
        CHECK (length(btrim(name)) > 0),
      is_system boolean NOT NULL DEFAULT false,
      sort_order integer NOT NULL DEFAULT 0,
      archived_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT categories_id_user_id_key UNIQUE (id, user_id),
      CONSTRAINT categories_parent_same_user_fkey
        FOREIGN KEY (parent_id, user_id) REFERENCES categories (id, user_id),
      CONSTRAINT categories_user_parent_name_key
        UNIQUE NULLS NOT DISTINCT (user_id, parent_id, name),
      CONSTRAINT categories_not_own_parent_check
        CHECK (parent_id IS NULL OR parent_id <> id),
      CONSTRAINT categories_income_without_group_check
        CHECK (kind = 'expense' OR expense_group IS NULL),
      CONSTRAINT categories_expense_root_group_check
        CHECK (kind = 'income' OR parent_id IS NOT NULL OR expense_group IS NOT NULL)
    )
  `)
  await queryInterface.sequelize.query(
    'CREATE INDEX categories_user_id_idx ON categories (user_id)',
  )
  await queryInterface.sequelize.query(
    'CREATE INDEX categories_parent_id_idx ON categories (parent_id)',
  )
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query('DROP TABLE IF EXISTS categories')
}
