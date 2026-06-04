import { Bell, Loader2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ShellDialogContent } from '@/components/ui/shell-dialog'
import type { ProfileRole } from '@/features/auth'
import { useMobileDialogViewport } from '@/hooks/useMobileDialogViewport'

import { getPushPermissionCopy } from '../utils/pushPermissionCopy'

export interface PushPermissionPromptDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAccept: () => void
  onDismiss: () => void
  requesting: boolean
  userRole?: ProfileRole | null
}

export function PushPermissionPromptDialog({
  open,
  onOpenChange,
  onAccept,
  onDismiss,
  requesting,
  userRole,
}: PushPermissionPromptDialogProps) {
  const { contentRef } = useMobileDialogViewport(open)
  const { benefits } = getPushPermissionCopy(userRole)

  const handleDismiss = () => {
    onDismiss()
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !requesting) handleDismiss()
      }}
    >
      <ShellDialogContent ref={contentRef} size="sm">
        <DialogHeader className="shrink-0 space-y-0 border-b px-4 py-3 pr-0 text-left sm:border-b-0 sm:px-0 sm:py-0">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Bell className="h-5 w-5 text-primary" aria-hidden />
              Ative as notificações
            </DialogTitle>
            <DialogClose asChild>
              <button
                type="button"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Fechar"
                disabled={requesting}
                onClick={handleDismiss}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </DialogClose>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain px-4 py-4 [-webkit-overflow-scrolling:touch] sm:px-0 sm:py-0">
          <DialogDescription asChild>
            <div className="space-y-3 text-left text-sm text-muted-foreground">
              <p>{benefits}</p>
              <p>
                Na próxima etapa, o sistema do seu aparelho vai pedir permissão para enviar
                notificações. Você pode mudar isso depois nas configurações do dispositivo ou do
                navegador.
              </p>
            </div>
          </DialogDescription>
        </div>

        <DialogFooter className="relative z-10 shrink-0 flex-row gap-2 border-t bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_40px_-12px_rgba(0,0,0,0.18)] backdrop-blur-md supports-[backdrop-filter]:bg-background/85 sm:border-t-0 sm:bg-transparent sm:px-0 sm:py-0 sm:pb-0 sm:shadow-none sm:backdrop-blur-none sm:supports-[backdrop-filter]:bg-transparent [&>button]:min-h-11 [&>button]:flex-1 sm:[&>button]:flex-none">
          <Button
            type="button"
            variant="outline"
            disabled={requesting}
            onClick={handleDismiss}
          >
            Agora não
          </Button>
          <Button type="button" disabled={requesting} onClick={onAccept}>
            {requesting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Ativando…
              </>
            ) : (
              'Continuar'
            )}
          </Button>
        </DialogFooter>
      </ShellDialogContent>
    </Dialog>
  )
}
