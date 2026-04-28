import { z } from 'zod'

export const createVoteSchema = z.object({
  name: z.string().min(1).max(500),
  visible: z.boolean().optional().default(true),
  minimumVotes: z.number().int().min(1).nullable().optional(),
  maxWinners: z.number().int().min(1).nullable().optional(),
  confettiEnabled: z.boolean().optional(),
})

export const updateVoteSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  visible: z.boolean().optional(),
  minimumVotes: z.number().int().min(1).nullable().optional(),
  maxWinners: z.number().int().min(1).nullable().optional(),
  confettiEnabled: z.boolean().optional(),
})
