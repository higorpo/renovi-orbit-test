import { Loader2, Mic, Settings, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ShellDialogContent } from "@/components/ui/shell-dialog";
import { useMobileDialogViewport } from "@/hooks/useMobileDialogViewport";
import { CHAT_AUDIO_PERMISSION_COPY } from "../../utils/chatAudioPermissionCopy";

export interface ChatAudioPermissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept: () => void;
  onDismiss: () => void;
  requesting: boolean;
}

export function ChatAudioPermissionDialog({
  open,
  onOpenChange,
  onAccept,
  onDismiss,
  requesting,
}: ChatAudioPermissionDialogProps) {
  const { contentRef } = useMobileDialogViewport(open);
  const copy = CHAT_AUDIO_PERMISSION_COPY;

  const handleDismiss = () => {
    onDismiss();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !requesting) handleDismiss();
      }}
    >
      <ShellDialogContent ref={contentRef} size="sm">
        <DialogHeader className="shrink-0 space-y-0 border-b px-4 py-3 text-left sm:border-b-0 sm:px-0 sm:pt-0 sm:pb-0">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Mic className="h-5 w-5 text-primary" aria-hidden />
              {copy.title}
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

        <div className="shrink-0 px-4 pt-3 pb-0 sm:px-0 sm:pt-4">
          <DialogDescription asChild>
            <div className="space-y-3 text-left text-sm text-muted-foreground">
              <p>{copy.benefits}</p>
              <p>{copy.nextStep}</p>
            </div>
          </DialogDescription>
        </div>

        <DialogFooter className="relative z-10 mt-0 max-sm:mt-auto shrink-0 flex-row gap-2 border-t bg-background/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-4 shadow-[0_-10px_40px_-12px_rgba(0,0,0,0.18)] backdrop-blur-md supports-[backdrop-filter]:bg-background/85 sm:border-t-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-4 sm:shadow-none sm:backdrop-blur-none sm:supports-[backdrop-filter]:bg-transparent [&>button]:min-h-11 [&>button]:flex-1 sm:[&>button]:flex-none">
          <Button type="button" variant="outline" disabled={requesting} onClick={handleDismiss}>
            Agora não
          </Button>
          <Button type="button" disabled={requesting} onClick={onAccept}>
            {requesting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Aguarde…
              </>
            ) : (
              "Continuar"
            )}
          </Button>
        </DialogFooter>
      </ShellDialogContent>
    </Dialog>
  );
}

export interface ChatAudioPermissionBlockedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenSettings: () => void;
  onDismiss: () => void;
  showOpenSettings: boolean;
}

export function ChatAudioPermissionBlockedDialog({
  open,
  onOpenChange,
  onOpenSettings,
  onDismiss,
  showOpenSettings,
}: ChatAudioPermissionBlockedDialogProps) {
  const { contentRef } = useMobileDialogViewport(open);
  const copy = CHAT_AUDIO_PERMISSION_COPY;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ShellDialogContent ref={contentRef} size="sm">
        <DialogHeader className="shrink-0 space-y-0 border-b px-4 py-3 text-left sm:border-b-0 sm:px-0 sm:pt-0 sm:pb-0">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Settings className="h-5 w-5 text-primary" aria-hidden />
            {copy.blockedTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="shrink-0 px-4 pt-3 pb-0 sm:px-0 sm:pt-4">
          <DialogDescription asChild>
            <div className="space-y-3 text-left text-sm text-muted-foreground">
              <p>{copy.blockedBody}</p>
              {!showOpenSettings ? <p>{copy.webSettingsHint}</p> : null}
            </div>
          </DialogDescription>
        </div>

        <DialogFooter className="relative z-10 mt-0 max-sm:mt-auto shrink-0 flex-row gap-2 border-t bg-background/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur-md sm:border-t-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-4 sm:shadow-none [&>button]:min-h-11 [&>button]:flex-1 sm:[&>button]:flex-none">
          <Button type="button" variant="outline" onClick={onDismiss}>
            Fechar
          </Button>
          {showOpenSettings ? (
            <Button type="button" onClick={onOpenSettings}>
              Abrir configurações
            </Button>
          ) : null}
        </DialogFooter>
      </ShellDialogContent>
    </Dialog>
  );
}
