import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto'
import type {
  PasskeyAuthenticationOptions,
  PasskeyAuthenticationResponse,
  PasskeyRegistrationOptions,
  PasskeyRegistrationResponse,
} from '@mint/shared/types/passkeys'
import type { CborValue, SoftAuthenticatorOptions } from '../types/tests.js'

const userPresent = 0x01
const userVerifiedFlag = 0x04
const attestedCredentialData = 0x40

function cborHead(major: number, value: number): Buffer {
  if (value < 24) {
    return Buffer.from([(major << 5) | value])
  }
  if (value < 0x100) {
    return Buffer.from([(major << 5) | 24, value])
  }
  if (value < 0x10000) {
    const head = Buffer.alloc(3)
    head[0] = (major << 5) | 25
    head.writeUInt16BE(value, 1)
    return head
  }
  const head = Buffer.alloc(5)
  head[0] = (major << 5) | 26
  head.writeUInt32BE(value, 1)
  return head
}

export function encodeCbor(value: CborValue): Buffer {
  if (typeof value === 'number') {
    return value >= 0 ? cborHead(0, value) : cborHead(1, -1 - value)
  }
  if (typeof value === 'string') {
    const text = Buffer.from(value, 'utf8')
    return Buffer.concat([cborHead(3, text.length), text])
  }
  if (value instanceof Uint8Array) {
    return Buffer.concat([cborHead(2, value.length), value])
  }
  return Buffer.concat([
    cborHead(5, value.size),
    ...[...value].flatMap(([key, entry]) => [
      encodeCbor(key),
      encodeCbor(entry),
    ]),
  ])
}

function base64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url')
}

function sha256(bytes: Uint8Array): Buffer {
  return createHash('sha256').update(bytes).digest()
}

function counterBytes(counter: number): Buffer {
  const bytes = Buffer.alloc(4)
  bytes.writeUInt32BE(counter, 0)
  return bytes
}

export function createSoftAuthenticator({
  origin,
  userVerified = true,
}: SoftAuthenticatorOptions) {
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'P-256',
  })
  const jwk = publicKey.export({ format: 'jwk' })
  const credentialId = randomBytes(16)
  const rpIdHash = sha256(Buffer.from(new URL(origin).hostname, 'utf8'))
  const flags = userPresent | (userVerified ? userVerifiedFlag : 0)
  let counter = 0
  let userHandle = ''

  function clientData(type: string, challenge: string): Buffer {
    return Buffer.from(
      JSON.stringify({ type, challenge, origin, crossOrigin: false }),
      'utf8',
    )
  }

  function coseKey(): Map<number, CborValue> {
    return new Map<number, CborValue>([
      [1, 2],
      [3, -7],
      [-1, 1],
      [-2, Buffer.from(jwk.x ?? '', 'base64url')],
      [-3, Buffer.from(jwk.y ?? '', 'base64url')],
    ])
  }

  return {
    credentialId: base64Url(credentialId),
    register(options: PasskeyRegistrationOptions): PasskeyRegistrationResponse {
      userHandle = options.user.id
      const lengthBytes = Buffer.alloc(2)
      lengthBytes.writeUInt16BE(credentialId.length, 0)
      const authData = Buffer.concat([
        rpIdHash,
        Buffer.from([flags | attestedCredentialData]),
        counterBytes(counter),
        Buffer.alloc(16),
        lengthBytes,
        credentialId,
        encodeCbor(coseKey()),
      ])
      const attestationObject = encodeCbor(
        new Map<string, CborValue>([
          ['fmt', 'none'],
          ['attStmt', new Map<string, CborValue>()],
          ['authData', authData],
        ]),
      )
      return {
        id: base64Url(credentialId),
        rawId: base64Url(credentialId),
        response: {
          clientDataJSON: base64Url(
            clientData('webauthn.create', options.challenge),
          ),
          attestationObject: base64Url(attestationObject),
          transports: ['internal'],
        },
        authenticatorAttachment: 'platform',
        clientExtensionResults: {},
        type: 'public-key',
      }
    },
    authenticate(
      options: PasskeyAuthenticationOptions,
    ): PasskeyAuthenticationResponse {
      counter += 1
      const authData = Buffer.concat([
        rpIdHash,
        Buffer.from([flags]),
        counterBytes(counter),
      ])
      const clientDataJSON = clientData('webauthn.get', options.challenge)
      const signature = sign(
        'sha256',
        Buffer.concat([authData, sha256(clientDataJSON)]),
        privateKey,
      )
      return {
        id: base64Url(credentialId),
        rawId: base64Url(credentialId),
        response: {
          clientDataJSON: base64Url(clientDataJSON),
          authenticatorData: base64Url(authData),
          signature: base64Url(signature),
          ...(userHandle === '' ? {} : { userHandle }),
        },
        authenticatorAttachment: 'platform',
        clientExtensionResults: {},
        type: 'public-key',
      }
    },
  }
}
