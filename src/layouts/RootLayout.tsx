import { Outlet } from 'react-router'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/features/auth'
import { DeviceBeaconProvider } from '@/features/device-beacon'
import { PushPermissionPromptHost } from '@/features/push-permission'
import { OfflineBanner } from '@/components/OfflineBanner'
import PWABadge from '@/PWABadge'

export function RootLayout() {
  return (
    <AuthProvider>
      <DeviceBeaconProvider>
        <PushPermissionPromptHost />
        <OfflineBanner />
        <Outlet />
        {/* Registers the service worker on every route (injectRegister: false). */}
        <PWABadge />
        <Toaster richColors position="top-center" />
      </DeviceBeaconProvider>
    </AuthProvider>
  )
}
