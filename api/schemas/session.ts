import { z } from 'zod'

export const persistedSessionSchema = z.object({
  cookie: z.object({
    originalMaxAge: z.number().nullable(),
    expires: z.iso
      .datetime()
      .nullable()
      .optional()
      .transform((value) =>
        typeof value === 'string' ? new Date(value) : value,
      ),
    httpOnly: z.boolean().optional(),
    path: z.string().optional(),
    domain: z.string().optional(),
    secure: z.union([z.boolean(), z.literal('auto')]).optional(),
    sameSite: z
      .union([z.boolean(), z.enum(['lax', 'strict', 'none'])])
      .optional(),
  }),
  userId: z.uuid(),
  userAgent: z.string().nullable(),
  ip: z.string().nullable(),
})
