import { describe, expect, it } from 'vitest'
import { readCookie } from './csrf.js'
import {
  hashPassword,
  verifyAgainstDecoy,
  verifyPassword,
} from './passwords.js'
import { generateToken, hashToken } from './tokens.js'

describe('passwords (AUTH-02)', () => {
  it('hashes with Argon2id and verifies', async () => {
    const passwordHash = await hashPassword('correct horse battery')

    expect(passwordHash.startsWith('$argon2id$')).toBe(true)
    expect(await verifyPassword(passwordHash, 'correct horse battery')).toBe(
      true,
    )
    expect(await verifyPassword(passwordHash, 'wrong horse battery')).toBe(
      false,
    )
  })

  it('spends a verification on unknown accounts and always fails', async () => {
    expect(await verifyAgainstDecoy('anything at all')).toBe(false)
  })
})

describe('tokens', () => {
  it('generates 256-bit url-safe tokens stored as SHA-256 hashes', () => {
    const { token, tokenHash } = generateToken()

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(tokenHash).toBe(hashToken(token))
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/)
    expect(generateToken().token).not.toBe(token)
  })
})

describe('readCookie', () => {
  it('reads one cookie among several', () => {
    expect(readCookie('a=1; mint-csrf=value=x; b=2', 'mint-csrf')).toBe(
      'value=x',
    )
  })

  it('returns undefined without header or matching cookie', () => {
    expect(readCookie(undefined, 'mint-csrf')).toBeUndefined()
    expect(readCookie('a=1; broken', 'mint-csrf')).toBeUndefined()
  })
})
