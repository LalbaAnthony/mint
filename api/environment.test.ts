import { describe, expect, it } from 'vitest'
import { parseEnvironment } from './environment.js'
import { serverEnvironmentSchema } from './schemas/environment.js'

const validEnvironment = {
  PORT: '3000',
  DATABASE_HOST: 'db',
  DATABASE_PORT: '5432',
  DATABASE_NAME: 'mint',
  DATABASE_USER: 'mint',
  DATABASE_PASSWORD: 'secret-value',
}

describe('parseEnvironment', () => {
  it('returns the variables with ports converted to numbers', () => {
    expect(parseEnvironment(serverEnvironmentSchema, validEnvironment)).toEqual(
      {
        PORT: 3000,
        DATABASE_HOST: 'db',
        DATABASE_PORT: 5432,
        DATABASE_NAME: 'mint',
        DATABASE_USER: 'mint',
        DATABASE_PASSWORD: 'secret-value',
      },
    )
  })

  it('names the missing variable', () => {
    const { DATABASE_HOST: _omitted, ...withoutHost } = validEnvironment

    expect(() =>
      parseEnvironment(serverEnvironmentSchema, withoutHost),
    ).toThrow(/DATABASE_HOST/)
  })

  it('rejects an invalid port without echoing the values', () => {
    const parse = () =>
      parseEnvironment(serverEnvironmentSchema, {
        ...validEnvironment,
        PORT: 'not-a-port',
      })

    expect(parse).toThrow(/PORT/)
    expect(parse).not.toThrow(/secret-value/)
  })
})
