import { z } from 'zod'

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export const uuidSchema = z.string().uuid()

export const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
})

export const coordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

export const addressSchema = z.object({
  street: z.string().min(1),
  city: z.string().min(1),
  island: z.string().min(1),
  postalCode: z.string().optional(),
  coordinates: coordinatesSchema.optional(),
})
