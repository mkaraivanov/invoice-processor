import { z } from 'zod'

// Validation schemas
export const uploadInvoiceSchema = z.object({
  file: z
    .instanceof(File)
    .refine(
      (file) => ['application/pdf', 'image/png', 'image/jpeg'].includes(file.type),
      'File must be PDF, PNG, or JPG'
    )
    .refine((file) => file.size <= 10 * 1024 * 1024, 'File must be smaller than 10MB'),
})

export const createUserSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().optional(),
})

export const signInSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
})

// DTOs
export type UploadInvoiceInput = z.infer<typeof uploadInvoiceSchema>
export type CreateUserInput = z.infer<typeof createUserSchema>
export type SignInInput = z.infer<typeof signInSchema>

export interface ExtractedInvoiceData {
  vendor?: string
  amount?: number
  date?: string
  lineItems?: Array<{
    description: string
    quantity: number
    unitPrice: number
    total: number
  }>
}
