import { z } from 'zod'
import { getDefaultApiErrorMessage } from '#server-utils/apiErrorMessages'

const shortcutField = z
  .string()
  .length(1, getDefaultApiErrorMessage('requiredShortcutSingleCharacter'))
  .nullable()
  .optional()

const HEX_COLOR_RE = /^#([0-9a-fA-F]{6})$/

const colorField = z
  .string()
  .length(7)
  .regex(HEX_COLOR_RE, getDefaultApiErrorMessage('invalidColor'))
  .nullable()
  .optional()

export const createOptionSchema = z.object({
  label: z.string().min(1).max(500),
  color: colorField,
  shortcut: shortcutField,
  canWin: z.boolean().optional().default(true),
})

export const updateOptionSchema = z.object({
  label: z.string().min(1).max(500).optional(),
  color: colorField,
  shortcut: shortcutField,
  count: z.number().int().min(0).max(999_999).optional(),
  canWin: z.boolean().optional(),
})
