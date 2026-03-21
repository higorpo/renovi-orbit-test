import { Outlet } from 'react-router'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/features/auth'
import { OfflineBanner } from '@/components/OfflineBanner'
import PWABadge from '@/PWABadge'

export function RootLayout() {
  return (
    <AuthProvider>
      <OfflineBanner />
      <Outlet />
      {/* Registers the service worker on every route (injectRegister: false). */}
      <PWABadge />
      <Toaster richColors position="top-center" />
    </AuthProvider>
  )
}
