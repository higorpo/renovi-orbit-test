import { Outlet } from 'react-router'
import { Toaster } from 'sonner'
import { CapacitorSplashHider } from '@/lib/capacitor'
import { AuthProvider } from '@/features/auth'
import { DeviceBeaconProvider } from '@/features/device-beacon'
import { PushPermissionPromptHost } from '@/features/push-permission'
import { PushNotificationNavigationHost } from '@/components/PushNotificationNavigationHost'
import { OfflineBanner } from '@/components/OfflineBanner'
import { OverlayNavigationBlocker } from '@/components/OverlayNavigationBlocker'
import { OnlineStatusProvider } from '@/hooks/useOnlineStatus'
import PWABadge from '@/PWABadge'

export function RootLayout() {
  return (
    <OnlineStatusProvider>
      <AuthProvider>
        <OverlayNavigationBlocker />
        <CapacitorSplashHider />
        <DeviceBeaconProvider>
          <PushPermissionPromptHost />
          <PushNotificationNavigationHost />
          <OfflineBanner />
          <Outlet />
          {/* Registers the service worker on every route (injectRegister: false). */}
          <PWABadge />
          <Toaster richColors position="top-center" />
        </DeviceBeaconProvider>
      </AuthProvider>
    </OnlineStatusProvider>
  )
}
