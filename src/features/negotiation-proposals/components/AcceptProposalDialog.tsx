import { useEffect, useState } from "react";
import { Loader2, WifiOff, X } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { useMobileDialogViewport } from "@/hooks/useMobileDialogViewport";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import type { ProposalSuggestedSlotRpc } from "../types/proposals.types";
import { useAcceptProposalMutation } from "../hooks/useProposalClientMutations";
import { formatProposalSuggestedSlot } from "../utils/formatProposalSuggestedSlot";

export interface AcceptProposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatId: string | null;
  serviceRequestId: string | null;
  proposalId: string | null;
  suggestedSlots: ProposalSuggestedSlotRpc[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

export function AcceptProposalDialog({
  open,
  onOpenChange,
  chatId,
  serviceRequestId,
  proposalId,
  suggestedSlots,
  isLoading = false,
  isError = false,
  onRetry,
}: AcceptProposalDialogProps) {
  const isOnline = useOnlineStatus();
  const acceptMutation = useAcceptProposalMutation(chatId, serviceRequestId);
  const { contentRef, scheduleSync } = useMobileDialogViewport(open);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    setSelectedIndex(0);
  }, [open, proposalId]);

  const selectedSlot = suggestedSlots[selectedIndex] ?? null;
  const canSubmit =
    Boolean(proposalId) && Boolean(selectedSlot) && isOnline && !isLoading && !isError;

  const handleAccept = () => {
    if (!proposalId || !selectedSlot || !isOnline) return;

    acceptMutation.mutate(
      { proposalId, selectedSlot },
      {
        onSuccess: () => onOpenChange(false),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ShellDialogContent ref={contentRef}>
        <DialogHeader className="shrink-0 space-y-0 border-b px-4 py-3 pr-0 text-left sm:border-b-0 sm:px-0 sm:py-0">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-base sm:text-lg">Aceitar proposta</DialogTitle>
            <DialogClose asChild>
              <button
                type="button"
                aria-label="Fechar"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </DialogClose>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            Escolha a data sugerida pelo prestador para confirmar o serviço.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 touch-pan-y overscroll-y-contain sm:px-0">
            {!isOnline ? (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <p>Você está offline. Conecte-se à internet para aceitar a proposta.</p>
              </div>
            ) : null}

            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Carregando datas disponíveis…
              </div>
            ) : null}

            {isError ? (
              <div className="space-y-3 py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Não foi possível carregar as datas da proposta.
                </p>
                {onRetry ? (
                  <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                    Tentar novamente
                  </Button>
                ) : null}
              </div>
            ) : null}

            {!isLoading && !isError && suggestedSlots.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Não há datas disponíveis nesta proposta. Atualize a conversa e tente novamente.
              </p>
            ) : null}

            {!isLoading && !isError && suggestedSlots.length > 0 ? (
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium text-foreground">Data de execução</legend>
                {suggestedSlots.map((slot, index) => (
                  <label
                    key={`${slot.start_date}-${slot.shift}-${index}`}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 transition-colors",
                      selectedIndex === index
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/40",
                    )}
                  >
                    <input
                      type="radio"
                      name="proposal-selected-slot"
                      className="h-4 w-4"
                      checked={selectedIndex === index}
                      onChange={() => setSelectedIndex(index)}
                      onFocus={scheduleSync}
                    />
                    <span className="text-sm text-foreground">{formatProposalSuggestedSlot(slot)}</span>
                  </label>
                ))}
              </fieldset>
            ) : null}
        </div>

        <DialogFooter className="relative z-10 shrink-0 flex-row gap-2 border-t bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_40px_-12px_rgba(0,0,0,0.18)] backdrop-blur-md supports-[backdrop-filter]:bg-background/85 sm:border-t-0 sm:bg-transparent sm:px-0 sm:py-0 sm:pb-0 sm:shadow-none sm:backdrop-blur-none sm:supports-[backdrop-filter]:bg-transparent [&>button]:flex-1 sm:[&>button]:flex-none">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={acceptMutation.isPending}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={
              !canSubmit || acceptMutation.isPending || isLoading || isError || suggestedSlots.length === 0
            }
            onClick={handleAccept}
          >
            {acceptMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Aceitando…
              </>
            ) : (
              "Confirmar aceite"
            )}
          </Button>
        </DialogFooter>
      </ShellDialogContent>
    </Dialog>
  );
}
