import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
  WebAuthnError,
} from '@simplewebauthn/browser'
import {
  passkeyAuthenticationOptionsSchema,
  passkeyRegistrationOptionsSchema,
  passkeySchema,
} from '@mint/shared/schemas/passkeys'
import { userProfileSchema } from '@mint/shared/schemas/user'
import type { Passkey } from '@mint/shared/types/passkeys'
import type { UserProfile } from '@mint/shared/types/user'
import type { PasskeyCeremonyFailure } from '~~/types/passkeys'

const devicePatterns: [RegExp, string][] = [
  [/iPhone/, 'iPhone'],
  [/iPad/, 'iPad'],
  [/Android/, 'Android'],
  [/CrOS/, 'Chromebook'],
  [/Macintosh|Mac OS X/, 'Mac'],
  [/Windows/, 'Windows'],
  [/Linux/, 'Linux'],
]

export function passkeysSupported(): boolean {
  return browserSupportsWebAuthn()
}

export function suggestedPasskeyName(userAgent: string): string {
  return (
    devicePatterns.find(([pattern]) => pattern.test(userAgent))?.[1] ??
    'Passkey'
  )
}

function ceremonyFailure(error: unknown): PasskeyCeremonyFailure | null {
  if (
    error instanceof WebAuthnError &&
    error.code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED'
  ) {
    return 'already_registered'
  }
  if (
    error instanceof Error &&
    (error.name === 'NotAllowedError' || error.name === 'AbortError')
  ) {
    return 'cancelled'
  }
  return null
}

async function ceremony<Result>(
  run: () => Promise<Result>,
): Promise<Result | PasskeyCeremonyFailure> {
  try {
    return await run()
  } catch (error) {
    const failure = ceremonyFailure(error)
    if (failure === null) {
      throw error
    }
    return failure
  }
}

export async function signInWithPasskey(): Promise<
  UserProfile | PasskeyCeremonyFailure
> {
  const optionsJSON = await apiCall(
    'POST',
    '/auth/passkey/options',
    passkeyAuthenticationOptionsSchema,
  )
  const response = await ceremony(() => startAuthentication({ optionsJSON }))
  if (typeof response === 'string') {
    return response
  }
  return apiCall('POST', '/auth/passkey/login', userProfileSchema, {
    response,
  })
}

export async function registerPasskey(
  name: string,
  password: string,
): Promise<Passkey | PasskeyCeremonyFailure> {
  const optionsJSON = await apiCall(
    'POST',
    '/profile/passkeys/options',
    passkeyRegistrationOptionsSchema,
    { password },
  )
  const response = await ceremony(() => startRegistration({ optionsJSON }))
  if (typeof response === 'string') {
    return response
  }
  return apiCall('POST', '/profile/passkeys', passkeySchema, {
    name,
    response,
  })
}

export async function deleteAccountWithPasskey(
  email: string,
): Promise<'deleted' | PasskeyCeremonyFailure> {
  const optionsJSON = await apiCall(
    'POST',
    '/profile/delete/options',
    passkeyAuthenticationOptionsSchema,
  )
  const response = await ceremony(() => startAuthentication({ optionsJSON }))
  if (typeof response === 'string') {
    return response
  }
  await apiCommand('POST', '/profile/delete', {
    method: 'passkey',
    email,
    response,
  })
  return 'deleted'
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
