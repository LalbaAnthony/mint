import { z } from 'zod'

export const accountMovementsRowsSchema = z.array(
  z.object({
    accountId: z.uuid(),
    movementsCents: z.coerce.number().int(),
  }),
)

export const insertedIdRowsSchema = z.array(z.object({ id: z.uuid() }))

export const lockRowsSchema = z.array(z.object({ locked: z.boolean() }))

export const statementRowsSchema = z.array(
  z.object({
    id: z.uuid(),
    accountId: z.uuid(),
    date: z.iso.date(),
    balanceCents: z.coerce.number().int(),
    adjustmentOperationId: z.uuid().nullable(),
    calculatedBalanceCents: z.coerce.number().int(),
  }),
)
