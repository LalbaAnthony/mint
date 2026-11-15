import type { z } from 'zod'
import type {
  passkeyAuthenticationOptionsSchema,
  passkeyAuthenticationResponseSchema,
  passkeyListResponseSchema,
  passkeyLoginRequestSchema,
  passkeyRegistrationOptionsRequestSchema,
  passkeyRegistrationOptionsSchema,
  passkeyRegistrationRequestSchema,
  passkeyRegistrationResponseSchema,
  passkeySchema,
  renamePasskeyRequestSchema,
} from '../schemas/passkeys.js'

export type PasskeyRegistrationOptions = z.infer<
  typeof passkeyRegistrationOptionsSchema
>

export type PasskeyAuthenticationOptions = z.infer<
  typeof passkeyAuthenticationOptionsSchema
>

export type PasskeyRegistrationResponse = z.infer<
  typeof passkeyRegistrationResponseSchema
>

export type PasskeyAuthenticationResponse = z.infer<
  typeof passkeyAuthenticationResponseSchema
>

export type Passkey = z.infer<typeof passkeySchema>

export type PasskeyListResponse = z.infer<typeof passkeyListResponseSchema>

export type PasskeyRegistrationOptionsRequest = z.infer<
  typeof passkeyRegistrationOptionsRequestSchema
>

export type PasskeyRegistrationRequest = z.infer<
  typeof passkeyRegistrationRequestSchema
>

export type RenamePasskeyRequest = z.infer<typeof renamePasskeyRequestSchema>

export type PasskeyLoginRequest = z.infer<typeof passkeyLoginRequestSchema>
