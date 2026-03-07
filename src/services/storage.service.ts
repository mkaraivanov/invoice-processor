import { createClient } from '@/lib/supabase/server'
import { createBotClient } from '@/lib/supabase/bot'
import { v4 as uuidv4 } from 'uuid'

export const storageService = {
  async uploadInvoiceFile(userId: string, file: File, useBot = false) {
    const supabase = useBot ? createBotClient() : await createClient()

    // Generate safe filename with extension allowlist
    const ext = file.name.split('.').pop()?.toLowerCase()
    const allowedExtensions = ['pdf', 'png', 'jpg', 'jpeg']
    if (!ext || !allowedExtensions.includes(ext)) {
      throw new Error('File extension must be pdf, png, jpg, or jpeg')
    }
    const fileName = `${userId}/${uuidv4()}.${ext}`

    const { data, error } = await supabase.storage
      .from('invoices')
      .upload(fileName, file)

    if (error) throw new Error(`Storage upload failed: ${error.message}`)

    return data.path
  },

  async getSignedUrl(path: string, expiresIn = 3600) {
    const supabase = await createClient()
    const { data, error } = await supabase.storage
      .from('invoices')
      .createSignedUrl(path, expiresIn)

    if (error) throw new Error(`Failed to generate signed URL: ${error.message}`)

    return data.signedUrl
  },

  async deleteFile(path: string) {
    const supabase = await createClient()
    const { error } = await supabase.storage
      .from('invoices')
      .remove([path])

    if (error) throw new Error(`Storage delete failed: ${error.message}`)
  },
}
