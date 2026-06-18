import { useProviderLocationTracking } from '../hooks/useProviderLocationTracking'
import { LocationPermissionDialogHost } from './LocationPermissionDialogHost'

export function ProviderLocationProvider({ children }: { children: React.ReactNode }) {
  useProviderLocationTracking()

  return (
    <>
      <LocationPermissionDialogHost />
      {children}
    </>
  )
}
