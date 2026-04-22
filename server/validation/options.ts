import { z } from 'zod'

const shortcutField = z
  .string()
  .length(1, 'El atajo debe ser un único carácter')
  .nullable()
  .optional()

// Accepts: #RGB, #RRGGBB, rgb(...), rgba(...), hsl(...), and CSS named colors
const CSS_COLOR_RE =
  /^(#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(0|1|0?\.\d+)\s*\)|hsl\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*\)|[a-zA-Z]{3,30})$/

const colorField = z
  .string()
  .max(50)
  .regex(CSS_COLOR_RE, 'Color no válido. Use formato hex (#RRGGBB), rgb(), hsl() o nombre CSS.')
  .nullable()
  .optional()

export const createOptionSchema = z.object({
  label: z.string().min(1).max(500),
  color: colorField,
  shortcut: shortcutField,
})

export const updateOptionSchema = z.object({
  label: z.string().min(1).max(500).optional(),
  color: colorField,
  shortcut: shortcutField,
  count: z.number().int().min(0).max(999_999).optional(),
})
