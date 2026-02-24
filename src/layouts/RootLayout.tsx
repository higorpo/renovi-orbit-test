import { Outlet } from 'react-router'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/features/auth'

export function RootLayout() {
  return (
    <AuthProvider>
      <Outlet />
      <Toaster richColors position="top-center" />
    </AuthProvider>
  )
}
