import { EventEmitter } from 'node:events'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '../auth/passwords.js'
import { createModels } from '../db/models.js'
import { createMigratedDatabase } from '../tests/database.js'
import type { CliDatabase } from '../types/cli.js'
import type { IsolatedDatabase } from '../types/tests.js'
import {
  createAdministrator,
  promoteToAdministrator,
} from './admin-commands.js'
import { promptHidden } from './prompt.js'

function createTerminal(isTTY = true) {
  const emitter = new EventEmitter()
  const rawModes: boolean[] = []
  let written = ''
  return {
    input: {
      isTTY,
      setRawMode: (mode: boolean) => rawModes.push(mode),
      on: (event: 'data', listener: (chunk: Buffer | string) => void) =>
        emitter.on(event, listener),
      removeListener: (
        event: 'data',
        listener: (chunk: Buffer | string) => void,
      ) => emitter.removeListener(event, listener),
      resume: () => undefined,
      pause: () => undefined,
    },
    output: {
      write: (text: string) => {
        written += text
      },
    },
    type: (text: string) => emitter.emit('data', Buffer.from(text)),
    rawModes,
    written: () => written,
  }
}

describe('promptHidden', () => {
  it('reads a line without echoing it, backspace included', async () => {
    const terminal = createTerminal()

    const answer = promptHidden(terminal.input, terminal.output, 'Password: ')
    terminal.type('secreX')
    terminal.type('\u007ft value\r')

    expect(await answer).toBe('secret value')
    expect(terminal.written()).toBe('Password: \n')
    expect(terminal.rawModes).toEqual([true, false])
  })

  it('rejects on Ctrl+C', async () => {
    const terminal = createTerminal()

    const answer = promptHidden(terminal.input, terminal.output, 'Password: ')
    terminal.type('abc\u0003')

    await expect(answer).rejects.toThrow('Cancelled')
  })

  it('refuses to run without a terminal', async () => {
    const terminal = createTerminal(false)

    await expect(
      promptHidden(terminal.input, terminal.output, 'Password: '),
    ).rejects.toThrow(/TTY/)
  })
})

describe('administrator commands (ADM-07)', () => {
  let database: IsolatedDatabase
  let cli: CliDatabase

  beforeAll(async () => {
    database = await createMigratedDatabase()
    cli = {
      sequelize: database.sequelize,
      models: createModels(database.sequelize),
    }
  })

  afterAll(async () => {
    await database.drop()
  })

  it('creates the first administrator with its default and system categories', async () => {
    const user = await createAdministrator(cli, {
      email: 'owner@example.org',
      locale: 'fr',
      passwordHash: await hashPassword('the owner password'),
    })

    expect(user.role).toBe('admin')
    expect(await verifyPassword(user.passwordHash, 'the owner password')).toBe(
      true,
    )
    expect(
      await cli.models.Category.count({ where: { userId: user.id } }),
    ).toBe(20)
  })

  it('refuses an address already used', async () => {
    await expect(
      createAdministrator(cli, {
        email: 'OWNER@example.org',
        locale: 'fr',
        passwordHash: 'unused',
      }),
    ).rejects.toThrow(/promote/)
  })

  it('promotes an existing user, once', async () => {
    await cli.models.User.create({
      email: 'member@example.org',
      passwordHash: await hashPassword('the member password'),
      role: 'user',
      locale: 'en',
    })

    expect(await promoteToAdministrator(cli, 'member@example.org')).toBe(
      'promoted',
    )
    expect(await promoteToAdministrator(cli, 'member@example.org')).toBe(
      'already_admin',
    )
    await expect(
      promoteToAdministrator(cli, 'nobody@example.org'),
    ).rejects.toThrow(/No user/)
  })
})
