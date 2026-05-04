import { z } from 'zod'

const emailField = z.string().trim().toLowerCase().email().max(254)

export const createAdminAccessSchema = z.object({
  email: emailField,
  active: z.boolean().optional().default(true),
})

export const updateAdminAccessSchema = z.object({
  active: z.boolean(),
})
