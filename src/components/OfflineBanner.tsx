import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { cn } from '@/lib/utils'

const BANNER_HEIGHT = 'h-11'

export function OfflineBanner() {
  const isOnline = useOnlineStatus()

  if (isOnline) return null

  return (
    <>
      {/* Fixed bar at the very top */}
      <div
        role="alert"
        aria-live="polite"
        className={cn(
          'fixed left-0 right-0 top-0 z-[100] flex items-center justify-center',
          BANNER_HEIGHT,
          'bg-amber-500 px-4 text-center text-sm font-medium text-amber-950',
          'shadow-sm'
        )}
      >
        Você está sem conexão com a internet. Algumas ações podem não estar disponíveis.
      </div>
      {/* Spacer so nav and content start below the banner */}
      <div className={BANNER_HEIGHT} aria-hidden="true" />
    </>
  )
}
