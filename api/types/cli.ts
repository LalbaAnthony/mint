import type { Sequelize } from 'sequelize'
import type { Models } from './models.js'

export type HiddenInput = {
  isTTY?: boolean
  setRawMode: (mode: boolean) => unknown
  on: (event: 'data', listener: (chunk: Buffer | string) => void) => unknown
  removeListener: (
    event: 'data',
    listener: (chunk: Buffer | string) => void,
  ) => unknown
  resume: () => unknown
  pause: () => unknown
}

export type PromptOutput = {
  write: (text: string) => unknown
}

export type CliDatabase = {
  sequelize: Sequelize
  models: Models
}

export type PromotionResult = 'promoted' | 'already_admin'
