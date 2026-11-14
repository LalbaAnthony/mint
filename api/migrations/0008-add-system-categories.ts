import type { QueryInterface } from 'sequelize'

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    ALTER TABLE categories
      DROP CONSTRAINT categories_kind_check,
      DROP CONSTRAINT categories_expense_root_group_check,
      ADD CONSTRAINT categories_kind_check
        CHECK (kind IN ('expense', 'income', 'adjustment')),
      ADD CONSTRAINT categories_expense_root_group_check
        CHECK (kind <> 'expense' OR parent_id IS NOT NULL OR expense_group IS NOT NULL),
      ADD CONSTRAINT categories_adjustment_system_check
        CHECK (kind <> 'adjustment' OR is_system),
      ADD CONSTRAINT categories_system_kind_check
        CHECK (NOT is_system OR kind IN ('income', 'adjustment')),
      ADD CONSTRAINT categories_system_root_check
        CHECK (NOT is_system OR parent_id IS NULL)
  `)
  await queryInterface.sequelize.query(
    'CREATE UNIQUE INDEX categories_user_system_kind_key ON categories (user_id, kind) WHERE is_system',
  )
  await queryInterface.sequelize.query(`
    INSERT INTO categories (user_id, kind, name, is_system, sort_order)
    SELECT id, 'income', CASE locale WHEN 'en' THEN 'Interest' ELSE 'Intérêts' END, true,
      (SELECT coalesce(max(sort_order) + 1, 0) FROM categories WHERE user_id = users.id)
    FROM users
  `)
  await queryInterface.sequelize.query(`
    INSERT INTO categories (user_id, kind, name, is_system, sort_order)
    SELECT id, 'adjustment', CASE locale WHEN 'en' THEN 'Adjustment' ELSE 'Ajustement' END, true,
      (SELECT coalesce(max(sort_order) + 1, 0) FROM categories WHERE user_id = users.id)
    FROM users
  `)
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query('DELETE FROM categories WHERE is_system')
  await queryInterface.sequelize.query(
    'DROP INDEX IF EXISTS categories_user_system_kind_key',
  )
  await queryInterface.sequelize.query(`
    ALTER TABLE categories
      DROP CONSTRAINT categories_system_root_check,
      DROP CONSTRAINT categories_system_kind_check,
      DROP CONSTRAINT categories_adjustment_system_check,
      DROP CONSTRAINT categories_expense_root_group_check,
      DROP CONSTRAINT categories_kind_check,
      ADD CONSTRAINT categories_kind_check
        CHECK (kind IN ('expense', 'income')),
      ADD CONSTRAINT categories_expense_root_group_check
        CHECK (kind = 'income' OR parent_id IS NOT NULL OR expense_group IS NOT NULL)
  `)
}
