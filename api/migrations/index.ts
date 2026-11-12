import type { Migration } from '../types/migration.js'
import * as enableCitext from './0001-enable-citext.js'

export const migrations: Migration[] = [
  { name: '0001-enable-citext', ...enableCitext },
]
