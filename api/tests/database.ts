import type { Sequelize } from 'sequelize'
import { inject } from 'vitest'
import { createSequelize } from '../db/sequelize.js'

export function createTestSequelize(): Sequelize {
  return createSequelize(inject('testDatabase'))
}
