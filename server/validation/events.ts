import { z } from 'zod'
import { getDefaultApiErrorMessage } from '#server-utils/apiErrorMessages'

function parseDateValue(value: string) {
  return new Date(value).getTime()
}

function hasValidDateRange(startDate: string, endDate: string) {
  const startTime = parseDateValue(startDate)
  const endTime = parseDateValue(endDate)

  if (Number.isNaN(startTime) || Number.isNaN(endTime)) {
    return false
  }

  return startTime <= endTime
}

const dateString = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/,
    getDefaultApiErrorMessage('invalidDateFormat')
  )

const slugField = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9-]+$/, getDefaultApiErrorMessage('invalidSlug'))

export const createEventSchema = z
  .object({
    name: z.string().min(1).max(500),
    slug: slugField.optional(),
    startDate: dateString,
    endDate: dateString,
    visible: z.boolean().optional().default(true),
  })
  .refine((data) => hasValidDateRange(data.startDate, data.endDate), {
    message: getDefaultApiErrorMessage('invalidDateRange'),
    path: ['endDate'],
  })

export const updateEventSchema = z
  .object({
    name: z.string().min(1).max(500).optional(),
    slug: slugField.optional(),
    startDate: dateString.optional(),
    endDate: dateString.optional(),
    visible: z.boolean().optional(),
    banner: z
      .string()
      .regex(/^\/banners\/[\w-]+\.webp$/, getDefaultApiErrorMessage('invalidBannerPath'))
      .nullable()
      .optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) return hasValidDateRange(data.startDate, data.endDate)
      return true
    },
    {
      message: getDefaultApiErrorMessage('invalidDateRange'),
      path: ['endDate'],
    }
  )

export function validateEventDateRange(startDate: string, endDate: string) {
  return hasValidDateRange(startDate, endDate)
}
