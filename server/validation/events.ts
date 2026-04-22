import { z } from 'zod'

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
    'Formato de fecha no válido (use YYYY-MM-DD o YYYY-MM-DDTHH:MM)'
  )

export const createEventSchema = z
  .object({
    name: z.string().min(1).max(500),
    startDate: dateString,
    endDate: dateString,
    visible: z.boolean().optional().default(true),
  })
  .refine((data) => hasValidDateRange(data.startDate, data.endDate), {
    message: 'La fecha de fin debe ser posterior a la de inicio',
    path: ['endDate'],
  })

export const updateEventSchema = z
  .object({
    name: z.string().min(1).max(500).optional(),
    startDate: dateString.optional(),
    endDate: dateString.optional(),
    visible: z.boolean().optional(),
    banner: z.string().nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) return hasValidDateRange(data.startDate, data.endDate)
      return true
    },
    {
      message: 'La fecha de fin debe ser posterior a la de inicio',
      path: ['endDate'],
    }
  )

export function validateEventDateRange(startDate: string, endDate: string) {
  return hasValidDateRange(startDate, endDate)
}
