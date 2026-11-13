import { argon2id, hash, verify } from 'argon2'

let decoyHash: Promise<string> | undefined

export function hashPassword(password: string): Promise<string> {
  return hash(password, { type: argon2id })
}

export function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  return verify(passwordHash, password)
}

export async function verifyAgainstDecoy(password: string): Promise<false> {
  decoyHash ??= hashPassword('decoy-password-for-unknown-accounts')
  await verify(await decoyHash, password)
  return false
}
