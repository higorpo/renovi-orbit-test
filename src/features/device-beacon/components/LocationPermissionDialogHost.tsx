import { LocationPermissionDialog } from './LocationPermissionDialog'
import { useLocationPermissionDialog } from '../hooks/useLocationPermissionDialog'

export function LocationPermissionDialogHost() {
  const { open, requesting, setOpen, dismiss, acceptAndRequestPermission } =
    useLocationPermissionDialog()

  return (
    <LocationPermissionDialog
      open={open}
      onOpenChange={setOpen}
      onAccept={() => void acceptAndRequestPermission()}
      onDismiss={() => void dismiss()}
      requesting={requesting}
    />
  )
}
