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

// Telegram schemas
export const telegramPhotoSchema = z.object({
  file_id: z.string(),
  file_unique_id: z.string(),
  width: z.number(),
  height: z.number(),
  file_size: z.number().optional(),
})

export const telegramDocumentSchema = z.object({
  file_id: z.string(),
  file_unique_id: z.string(),
  file_name: z.string().optional(),
  mime_type: z.string().optional(),
  file_size: z.number().optional(),
})

export const telegramMessageSchema = z.object({
  message_id: z.number(),
  date: z.number(),
  chat: z.object({
    id: z.number(),
    type: z.enum(['private', 'group', 'supergroup', 'channel']),
    first_name: z.string().optional(),
  }),
  photo: z.array(telegramPhotoSchema).optional(),
  document: telegramDocumentSchema.optional(),
  text: z.string().optional(),
})

export const telegramUpdateSchema = z.object({
  update_id: z.number(),
  message: telegramMessageSchema.optional(),
})

// DTOs for Telegram
export type TelegramUpdate = z.infer<typeof telegramUpdateSchema>
export type TelegramMessage = z.infer<typeof telegramMessageSchema>
export type TelegramPhoto = z.infer<typeof telegramPhotoSchema>
export type TelegramDocument = z.infer<typeof telegramDocumentSchema>
