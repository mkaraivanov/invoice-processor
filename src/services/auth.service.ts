import { createClient } from '@/lib/supabase/server'
import { userRepository } from '@/repositories/user.repository'
import { CreateUserInput, SignInInput } from '@/types'

export const authService = {
  async signUp(input: CreateUserInput) {
    const supabase = await createClient()

    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
    })

    if (error) throw new Error(`Sign-up failed: ${error.message}`)

    // Sync user to app DB
    if (data.user) {
      await userRepository.upsert(
        data.user.id,
        data.user.email!,
        input.fullName
      )
    }

    return data
  },

  async signIn(input: SignInInput) {
    const supabase = await createClient()

    const { data, error } = await supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    })

    if (error) throw new Error(`Sign-in failed: ${error.message}`)

    return data
  },

  async signOut() {
    const supabase = await createClient()
    const { error } = await supabase.auth.signOut()

    if (error) throw new Error(`Sign-out failed: ${error.message}`)
  },

  async getUser() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error) throw new Error(`Failed to get user: ${error.message}`)

    return user
  },
}
