import { z } from 'zod'

export const ReservationInput = z
  .strictObject({
    sku: z.string().regex(/^[A-Z][A-Z0-9-]{0,23}$/),
    quantity: z.number().int().min(1).max(100),
    expectedVersion: z.number().int().min(1).max(1000000),
    priority: z.enum(['standard', 'express']),
    note: z
      .string()
      .refine((value) => [...value].length <= 80)
      .optional(),
  })
  .superRefine((value, context) => {
    if (value.priority === 'express' && value.quantity > 5) {
      context.addIssue({ code: 'custom', path: ['quantity'], message: 'express_limit' })
    }
  })

export const ReservationOutput = z.strictObject({
  sku: z.string(),
  reserved: z.number().int().min(1).max(100),
  version: z.number().int().min(2).max(1000001),
})

export function fieldErrors(error) {
  const fields = new Set(['sku', 'quantity', 'expectedVersion', 'priority', 'note'])
  const pointers = new Set(
    error.issues.map((issue) => {
      const field = issue.path[0]
      return fields.has(field) ? `/${field}` : ''
    }),
  )
  return [...pointers].sort().map((pointer) => ({ pointer, code: 'invalid_field' }))
}
