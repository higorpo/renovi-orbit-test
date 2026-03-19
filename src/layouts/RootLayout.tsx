import { Outlet } from 'react-router'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/features/auth'
import { OfflineBanner } from '@/components/OfflineBanner'

export function RootLayout() {
  return (
    <AuthProvider>
      <OfflineBanner />
      <Outlet />
      <Toaster richColors position="top-center" />
    </AuthProvider>
  )
}
