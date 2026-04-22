import { z } from 'zod'

export const createVoteSchema = z.object({
  name: z.string().min(1).max(500),
  visible: z.boolean().optional().default(true),
})

export const updateVoteSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  visible: z.boolean().optional(),
})
