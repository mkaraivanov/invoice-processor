import { redirect } from 'next/navigation'
import { authService } from '@/services/auth.service'

export default async function Home() {
  try {
    const user = await authService.getUser()
    if (user) {
      redirect('/dashboard')
    }
  } catch {
    // User not authenticated
  }

  redirect('/login')
}
