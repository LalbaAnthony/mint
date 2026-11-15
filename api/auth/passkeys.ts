import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server'
import type { Request, Response } from 'express'
import type {
  Passkey,
  PasskeyAuthenticationResponse,
} from '@mint/shared/types/passkeys'
import type { AppDependencies } from '../types/app.js'
import type { ChallengePurpose, RelyingParty } from '../types/auth.js'
import type { WebauthnCredentialModel } from '../types/models.js'
import { describeError, log } from '../logger.js'
import { challengeLifetimeMs } from './challenges.js'
import { readCookie } from './csrf.js'
import { isSecureOrigin } from './session.js'

export const relyingPartyName = 'Mint'

export const ceremonyTimeoutMs = 120_000

export function relyingParty(app: AppDependencies): RelyingParty {
  return {
    rpID: new URL(app.config.appOrigin).hostname,
    rpName: relyingPartyName,
    origin: app.config.appOrigin,
  }
}

export function ceremonyCookieName(secure: boolean): string {
  return secure ? '__Host-mint-webauthn' : 'mint-webauthn'
}

function ceremonyCookieOptions(app: AppDependencies) {
  return {
    path: '/',
    httpOnly: true,
    secure: isSecureOrigin(app.config.appOrigin),
    sameSite: 'strict' as const,
  }
}

export function beginCeremony(
  app: AppDependencies,
  response: Response,
  entry: {
    challenge: string
    purpose: ChallengePurpose
    userId: string | null
  },
): void {
  const key = app.challenges.issue(entry)
  response.cookie(
    ceremonyCookieName(isSecureOrigin(app.config.appOrigin)),
    key,
    { ...ceremonyCookieOptions(app), maxAge: challengeLifetimeMs },
  )
}

export function takeCeremony(
  app: AppDependencies,
  request: Request,
  response: Response,
  purpose: ChallengePurpose,
  userId: string | null,
): string | null {
  const name = ceremonyCookieName(isSecureOrigin(app.config.appOrigin))
  const key = readCookie(request.headers.cookie, name)
  response.clearCookie(name, ceremonyCookieOptions(app))
  if (key === undefined) {
    return null
  }
  const entry = app.challenges.consume(key, purpose)
  if (entry === null || entry.userId !== userId) {
    return null
  }
  return entry.challenge
}

export function toPasskey(credential: WebauthnCredentialModel): Passkey {
  return {
    id: credential.id,
    name: credential.name,
    createdAt: credential.createdAt.toISOString(),
    lastUsedAt: credential.lastUsedAt?.toISOString() ?? null,
  }
}

export function userHandle(userId: string): Uint8Array<ArrayBuffer> {
  const bytes = new TextEncoder().encode(userId)
  const handle = new Uint8Array(new ArrayBuffer(bytes.length))
  handle.set(bytes)
  return handle
}

export async function assertionOptions(
  app: AppDependencies,
  credentials: readonly WebauthnCredentialModel[],
) {
  return generateAuthenticationOptions({
    rpID: relyingParty(app).rpID,
    timeout: ceremonyTimeoutMs,
    userVerification: 'required',
    allowCredentials: credentials.map((credential) => ({
      id: credential.credentialId,
      transports: credential.transports,
    })),
  })
}

async function verifiedCounter(
  app: AppDependencies,
  assertion: PasskeyAuthenticationResponse,
  expectedChallenge: string,
  credential: WebauthnCredentialModel,
): Promise<number | null> {
  const party = relyingParty(app)
  try {
    const verification = await verifyAuthenticationResponse({
      response: assertion,
      expectedChallenge,
      expectedOrigin: party.origin,
      expectedRPID: party.rpID,
      requireUserVerification: true,
      credential: {
        id: credential.credentialId,
        publicKey: new Uint8Array(credential.publicKey),
        counter: credential.signCount,
        transports: credential.transports,
      },
    })
    return verification.verified
      ? verification.authenticationInfo.newCounter
      : null
  } catch (error) {
    log('info', 'passkey_assertion_rejected', { error: describeError(error) })
    return null
  }
}

export async function verifyAssertion(
  app: AppDependencies,
  assertion: PasskeyAuthenticationResponse,
  expectedChallenge: string,
  userId: string | null,
): Promise<WebauthnCredentialModel | null> {
  const credential = await app.models.WebauthnCredential.findOne({
    where: {
      credentialId: assertion.id,
      ...(userId === null ? {} : { userId }),
    },
  })
  if (credential === null) {
    return null
  }
  const expectedHandle = Buffer.from(userHandle(credential.userId)).toString(
    'base64url',
  )
  if (
    assertion.response.userHandle !== undefined &&
    assertion.response.userHandle !== expectedHandle
  ) {
    return null
  }
  const newCounter = await verifiedCounter(
    app,
    assertion,
    expectedChallenge,
    credential,
  )
  if (newCounter === null) {
    return null
  }
  await credential.update({
    signCount: newCounter,
    lastUsedAt: app.clock.now(),
  })
  return credential
}
