import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export const signupSchema = z.object({
  email: z.string().email('Invalid email'),
  phone: z.string().min(10, 'Invalid phone number'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  primaryRole: z.enum(['customer', 'provider', 'landlord', 'tenant']),
  businessName: z.string().optional(),
})

export const bookingSchema = z.object({
  serviceId: z.string().uuid(),
  providerId: z.string().uuid(),
  scheduledDate: z.string(),
  scheduledTimeStart: z.string(),
  baseAmount: z.number().positive(),
  customerNotes: z.string().optional(),
})
