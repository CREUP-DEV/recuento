import { z } from 'zod'
import { getDefaultApiErrorMessage } from '#server-utils/apiErrorMessages'

const slugField = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9-]+$/, getDefaultApiErrorMessage('invalidSlug'))

export const createVoteSchema = z.object({
  name: z.string().min(1).max(500),
  slug: slugField.optional(),
  visible: z.boolean().optional().default(true),
  minimumVotes: z.number().int().min(1).nullable().optional(),
  maxWinners: z.number().int().min(1).nullable().optional(),
  confettiEnabled: z.boolean().optional(),
})

export const updateVoteSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  slug: slugField.optional(),
  visible: z.boolean().optional(),
  minimumVotes: z.number().int().min(1).nullable().optional(),
  maxWinners: z.number().int().min(1).nullable().optional(),
  confettiEnabled: z.boolean().optional(),
})
