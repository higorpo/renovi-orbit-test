/**
 * Confirm sheet/dialog to open a service dispute with optional reason.
 */

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ShellDialogContent } from "@/components/ui/shell-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useMobileDialogViewport } from "@/hooks/useMobileDialogViewport";
import { useOpenDispute } from "../hooks/useOpenDispute";

const REASON_MAX_LENGTH = 2000;

export type OpenDisputeConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceRequestId: string;
  contractedServiceId: string;
  /** Called after a successful open (parent closes evaluate wizard). */
  onOpened?: () => void;
};

export function OpenDisputeConfirmDialog({
  open,
  onOpenChange,
  serviceRequestId,
  contractedServiceId,
  onOpened,
}: OpenDisputeConfirmDialogProps) {
  const { contentRef, scheduleSync } = useMobileDialogViewport(open);
  const [reason, setReason] = useState("");
  const openDisputeMutation = useOpenDispute({
    serviceRequestId,
    contractedServiceId,
    onOpened: () => {
      onOpenChange(false);
      onOpened?.();
    },
  });

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const handleConfirm = () => {
    void openDisputeMutation.mutateAsync({
      reason: reason.trim() || null,
    });
  };

  const pending = openDisputeMutation.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending && !next) return;
        onOpenChange(next);
      }}
    >
      <ShellDialogContent
        ref={contentRef}
        data-testid="open-dispute-confirm-dialog"
      >
        <DialogHeader className="shrink-0 space-y-0 border-b px-4 py-3 pr-0 text-left sm:border-b-0 sm:px-0 sm:py-0">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-base sm:text-lg">
              Abrir disputa?
            </DialogTitle>
            <DialogClose asChild>
              <button
                type="button"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Fechar"
                disabled={pending}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </DialogClose>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            A plataforma analisa o caso. Você não poderá confirmar o
            recebimento nem cancelar o serviço enquanto a disputa estiver
            aberta. O chat permanece disponível.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4 touch-pan-y overscroll-y-contain [-webkit-overflow-scrolling:touch] sm:px-0 sm:py-0">
          <Label htmlFor="open-dispute-reason">Motivo (opcional)</Label>
          <Textarea
            id="open-dispute-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onFocus={scheduleSync}
            maxLength={REASON_MAX_LENGTH}
            placeholder="Descreva o que não está correto na execução do serviço."
            rows={4}
            disabled={pending}
            className="min-h-28 resize-y max-sm:resize-none"
            data-testid="open-dispute-reason"
          />
          <p className="text-xs text-muted-foreground">
            {reason.length}/{REASON_MAX_LENGTH} caracteres
          </p>
        </div>

        <DialogFooter className="relative z-10 shrink-0 flex-row items-stretch gap-2 border-t bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_40px_-12px_rgba(0,0,0,0.18)] backdrop-blur-md supports-[backdrop-filter]:bg-background/85 sm:mt-4 sm:border-t-0 sm:bg-transparent sm:px-0 sm:py-0 sm:pb-0 sm:shadow-none sm:backdrop-blur-none sm:supports-[backdrop-filter]:bg-transparent [&>button]:h-auto [&>button]:min-h-10 [&>button]:flex-1 sm:[&>button]:h-10 sm:[&>button]:flex-none">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={pending}
            data-testid="open-dispute-confirm"
            className="whitespace-normal px-2.5 text-center leading-snug sm:whitespace-nowrap sm:px-4"
          >
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Abrindo…
              </>
            ) : (
              "Abrir disputa"
            )}
          </Button>
        </DialogFooter>
      </ShellDialogContent>
    </Dialog>
  );
}
