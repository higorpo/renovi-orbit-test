import { PushPermissionPromptDialog } from './PushPermissionPromptDialog'
import { usePushPermissionPrompt } from '../hooks/usePushPermissionPrompt'

export function PushPermissionPromptHost() {
  const { open, requesting, userRole, setOpen, dismiss, acceptAndRequestPermission } =
    usePushPermissionPrompt()

  return (
    <PushPermissionPromptDialog
      open={open}
      onOpenChange={setOpen}
      onAccept={() => void acceptAndRequestPermission()}
      onDismiss={dismiss}
      requesting={requesting}
      userRole={userRole}
    />
  )
}
