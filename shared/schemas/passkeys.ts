import { z } from 'zod'
import { currentPasswordSchema } from './user.js'

export const passkeyNameMaxLength = 60

export const maxPasskeysPerUser = 10

const base64UrlSchema = z
  .string({ error: 'invalid' })
  .min(1, { error: 'invalid' })
  .max(4096, { error: 'invalid' })
  .regex(/^[A-Za-z0-9_-]+$/, { error: 'invalid' })

const transportsSchema = z.array(z.string().max(32)).max(10)

const userVerificationSchema = z.enum(['discouraged', 'preferred', 'required'])

const hintsSchema = z.array(z.enum(['hybrid', 'security-key', 'client-device']))

const credentialDescriptorSchema = z.object({
  id: base64UrlSchema,
  type: z.string(),
  transports: transportsSchema.optional(),
})

export const passkeyNameSchema = z
  .string({ error: 'required' })
  .trim()
  .min(1, { error: 'required' })
  .max(passkeyNameMaxLength, { error: 'too_long' })

export const passkeyRegistrationOptionsSchema = z
  .object({
    rp: z.object({ name: z.string(), id: z.string().optional() }),
    user: z.object({
      id: z.string(),
      name: z.string(),
      displayName: z.string(),
    }),
    challenge: base64UrlSchema,
    pubKeyCredParams: z.array(
      z.object({ alg: z.number().int(), type: z.literal('public-key') }),
    ),
    timeout: z.number().int().optional(),
    excludeCredentials: z.array(credentialDescriptorSchema).optional(),
    authenticatorSelection: z
      .object({
        authenticatorAttachment: z
          .enum(['cross-platform', 'platform'])
          .optional(),
        requireResidentKey: z.boolean().optional(),
        residentKey: z
          .enum(['discouraged', 'preferred', 'required'])
          .optional(),
        userVerification: userVerificationSchema.optional(),
      })
      .optional(),
    hints: hintsSchema.optional(),
    attestation: z
      .enum(['direct', 'enterprise', 'indirect', 'none'])
      .optional(),
  })
  .meta({ id: 'PasskeyRegistrationOptions' })

export const passkeyAuthenticationOptionsSchema = z
  .object({
    challenge: base64UrlSchema,
    timeout: z.number().int().optional(),
    rpId: z.string().optional(),
    allowCredentials: z.array(credentialDescriptorSchema).optional(),
    userVerification: userVerificationSchema.optional(),
    hints: hintsSchema.optional(),
  })
  .meta({ id: 'PasskeyAuthenticationOptions' })

const clientExtensionResultsSchema = z.object({
  credProps: z.object({ rk: z.boolean().optional() }).optional(),
})

export const passkeyRegistrationResponseSchema = z
  .object({
    id: base64UrlSchema,
    rawId: base64UrlSchema,
    response: z.object({
      clientDataJSON: base64UrlSchema,
      attestationObject: base64UrlSchema,
      authenticatorData: base64UrlSchema.optional(),
      transports: transportsSchema.optional(),
      publicKeyAlgorithm: z.number().int().optional(),
      publicKey: base64UrlSchema.optional(),
    }),
    authenticatorAttachment: z.enum(['cross-platform', 'platform']).optional(),
    clientExtensionResults: clientExtensionResultsSchema,
    type: z.literal('public-key'),
  })
  .meta({ id: 'PasskeyRegistrationResponse' })

export const passkeyAuthenticationResponseSchema = z
  .object({
    id: base64UrlSchema,
    rawId: base64UrlSchema,
    response: z.object({
      clientDataJSON: base64UrlSchema,
      authenticatorData: base64UrlSchema,
      signature: base64UrlSchema,
      userHandle: base64UrlSchema.optional(),
    }),
    authenticatorAttachment: z.enum(['cross-platform', 'platform']).optional(),
    clientExtensionResults: clientExtensionResultsSchema,
    type: z.literal('public-key'),
  })
  .meta({ id: 'PasskeyAuthenticationResponse' })

export const passkeySchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    createdAt: z.iso.datetime(),
    lastUsedAt: z.iso.datetime().nullable(),
  })
  .meta({ id: 'Passkey' })

export const passkeyListResponseSchema = z
  .array(passkeySchema)
  .meta({ id: 'PasskeyListResponse' })

export const passkeyRegistrationOptionsRequestSchema = z
  .object({ password: currentPasswordSchema })
  .meta({ id: 'PasskeyRegistrationOptionsRequest' })

export const passkeyRegistrationRequestSchema = z
  .object({
    name: passkeyNameSchema,
    response: passkeyRegistrationResponseSchema,
  })
  .meta({ id: 'PasskeyRegistrationRequest' })

export const renamePasskeyRequestSchema = z
  .object({ name: passkeyNameSchema })
  .meta({ id: 'RenamePasskeyRequest' })

export const passkeyLoginRequestSchema = z
  .object({ response: passkeyAuthenticationResponseSchema })
  .meta({ id: 'PasskeyLoginRequest' })
