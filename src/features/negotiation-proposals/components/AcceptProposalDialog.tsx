import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, WifiOff, X } from "lucide-react";
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
import { CheckoutStepper } from "@/features/payments/components/CheckoutStepper/CheckoutStepper";
import { useProposalCheckoutContext } from "@/features/payments/hooks/useProposalCheckoutContext";
import {
  CHAT_CONVERSATIONS_LIST_QUERY_KEY,
  CHAT_FREE_MESSAGING_QUERY_KEY,
  CHAT_MESSAGES_QUERY_KEY,
  CHAT_PROPOSAL_TIMELINE_QUERY_KEY,
  CONVERSATION_DETAIL_QUERY_KEY,
} from "@/features/chats/constants/queryKeys";
import {
  SERVICE_DETAIL_QUERY_KEY,
  SERVICES_LIST_QUERY_KEY,
} from "@/features/view-services";
import { toast } from "sonner";
import type { ProposalSuggestedSlotRpc } from "../types/proposals.types";
import { MAX_PROPOSAL_REVISIONS } from "../constants/proposalRevisions";
import { SERVICE_REQUEST_BUDGET_COMPARE_DETAIL_QUERY_KEY } from "../constants/queryKeys";
import { useAcceptProposalMutation } from "../hooks/useProposalClientMutations";
import { AcceptProposalDialogSkeleton } from "./proposalDialogSkeletons";
import { formatProposalSuggestedSlot } from "../utils/formatProposalSuggestedSlot";

type AcceptDialogPhase = "slot" | "checkout";

export interface AcceptProposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatId: string | null;
  serviceRequestId: string | null;
  proposalId: string | null;
  suggestedSlots: ProposalSuggestedSlotRpc[];
  serviceTitle?: string;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  revisionCount?: number;
  onRequestRevision?: () => void;
}

function invalidateAfterAccept(
  queryClient: ReturnType<typeof useQueryClient>,
  chatId: string | null,
  serviceRequestId: string | null,
) {
  if (chatId) {
    void queryClient.invalidateQueries({ queryKey: [CHAT_MESSAGES_QUERY_KEY, chatId] });
    void queryClient.invalidateQueries({ queryKey: [CONVERSATION_DETAIL_QUERY_KEY, chatId] });
    void queryClient.invalidateQueries({ queryKey: [CHAT_PROPOSAL_TIMELINE_QUERY_KEY, chatId] });
    void queryClient.invalidateQueries({ queryKey: [CHAT_FREE_MESSAGING_QUERY_KEY, chatId] });
    void queryClient.invalidateQueries({ queryKey: [CHAT_CONVERSATIONS_LIST_QUERY_KEY] });
  }

  void queryClient.invalidateQueries({ queryKey: SERVICES_LIST_QUERY_KEY });

  if (serviceRequestId) {
    void queryClient.invalidateQueries({
      queryKey: [...SERVICE_DETAIL_QUERY_KEY, serviceRequestId],
    });
    void queryClient.invalidateQueries({
      queryKey: [SERVICE_REQUEST_BUDGET_COMPARE_DETAIL_QUERY_KEY, serviceRequestId],
    });
  }
}

export function AcceptProposalDialog({
  open,
  onOpenChange,
  chatId,
  serviceRequestId,
  proposalId,
  suggestedSlots,
  serviceTitle,
  isLoading = false,
  isError = false,
  onRetry,
  revisionCount = 0,
  onRequestRevision,
}: AcceptProposalDialogProps) {
  const isOnline = useOnlineStatus();
  const queryClient = useQueryClient();
  const acceptMutation = useAcceptProposalMutation(chatId, serviceRequestId);
  const checkoutContextQuery = useProposalCheckoutContext(proposalId, open);
  const { contentRef, scheduleSync } = useMobileDialogViewport(open);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [phase, setPhase] = useState<AcceptDialogPhase>("slot");

  useEffect(() => {
    if (!open) return;
    setSelectedIndex(0);
    setPhase("slot");
  }, [open, proposalId]);

  const selectedSlot = suggestedSlots[selectedIndex] ?? null;
  const paymentRequired = checkoutContextQuery.data?.paymentRequired ?? false;
  const checkoutContext = useMemo(() => {
    if (!selectedSlot || !checkoutContextQuery.data) {
      return undefined;
    }

    return {
      serviceTitle: serviceTitle ?? "Serviço",
      scheduledDate: selectedSlot.start_date,
      baseAmount: checkoutContextQuery.data.proposedAmount,
      providerId: checkoutContextQuery.data.providerId,
      selectedSlot,
      pricingSignature: checkoutContextQuery.data.pricingSignature,
    };
  }, [checkoutContextQuery.data, selectedSlot, serviceTitle]);

  const canSubmitSlot =
    Boolean(proposalId) && Boolean(selectedSlot) && isOnline && !isLoading && !isError;
  const revisionLimitReached = revisionCount >= MAX_PROPOSAL_REVISIONS;
  const showRevisionCard =
    Boolean(onRequestRevision) &&
    !revisionLimitReached &&
    !isLoading &&
    !isError &&
    suggestedSlots.length > 0 &&
    phase === "slot";

  const handleSlotContinue = () => {
    if (!proposalId || !selectedSlot || !isOnline) return;

    if (paymentRequired) {
      if (!checkoutContextQuery.data) {
        toast.error("Não foi possível carregar os dados de pagamento. Tente novamente.");
        return;
      }
      setPhase("checkout");
      return;
    }

    acceptMutation.mutate(
      { proposalId, selectedSlot },
      {
        onSuccess: () => onOpenChange(false),
      },
    );
  };

  const handleCheckoutSuccess = () => {
    invalidateAfterAccept(queryClient, chatId, serviceRequestId);
    toast.success("Proposta aceita com sucesso.");
    onOpenChange(false);
  };

  const primaryButtonLabel = paymentRequired ? "Continuar para pagamento" : "Confirmar aceite";
  const isPrimaryPending = acceptMutation.isPending
    || (paymentRequired && checkoutContextQuery.isLoading);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ShellDialogContent ref={contentRef}>
        <DialogHeader className="shrink-0 space-y-0 border-b px-4 py-3 pr-0 text-left sm:border-b-0 sm:px-0 sm:py-0">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-base sm:text-lg">
              {phase === "checkout" ? "Pagamento" : "Aceitar proposta"}
            </DialogTitle>
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
            {phase === "checkout"
              ? "Complete o checkout para confirmar a contratação."
              : "Escolha a data sugerida pelo prestador para confirmar o serviço."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 touch-pan-y overscroll-y-contain sm:px-0">
          {!isOnline ? (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p>Você está offline. Conecte-se à internet para aceitar a proposta.</p>
            </div>
          ) : null}

          {phase === "checkout" && proposalId && serviceRequestId && checkoutContext ? (
            <CheckoutStepper
              proposalId={proposalId}
              serviceId={serviceRequestId}
              checkoutContext={checkoutContext}
              onCheckoutSuccess={handleCheckoutSuccess}
            />
          ) : null}

          {phase === "slot" ? (
            <>
              {isLoading ? <AcceptProposalDialogSkeleton /> : null}

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

              {showRevisionCard ? (
                <button
                  type="button"
                  onClick={onRequestRevision}
                  className="flex w-full items-start gap-3 rounded-xl border border-border bg-muted/30 px-3 py-3 text-left transition-colors hover:bg-muted/50"
                >
                  <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="block text-sm font-medium text-foreground">
                      Nenhuma data funciona?
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      Você pode solicitar uma revisão da proposta para o prestador sugerir outras datas.
                    </span>
                  </span>
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              ) : null}
            </>
          ) : null}
        </div>

        {phase === "slot" ? (
          <DialogFooter className="relative z-10 shrink-0 flex-row gap-2 border-t bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_40px_-12px_rgba(0,0,0,0.18)] backdrop-blur-md supports-[backdrop-filter]:bg-background/85 sm:border-t-0 sm:bg-transparent sm:px-0 sm:py-0 sm:pb-0 sm:shadow-none sm:backdrop-blur-none sm:supports-[backdrop-filter]:bg-transparent [&>button]:flex-1 sm:[&>button]:flex-none">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={acceptMutation.isPending}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={
                !canSubmitSlot || isPrimaryPending || isLoading || isError || suggestedSlots.length === 0
              }
              onClick={handleSlotContinue}
            >
              {isPrimaryPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Carregando…
                </>
              ) : (
                primaryButtonLabel
              )}
            </Button>
          </DialogFooter>
        ) : (
          <DialogFooter className="relative z-10 shrink-0 flex-row gap-2 border-t bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:border-t-0 sm:bg-transparent sm:px-0 sm:py-0 sm:pb-0 sm:shadow-none [&>button]:flex-1 sm:[&>button]:flex-none">
            <Button type="button" variant="outline" onClick={() => setPhase("slot")}>
              <ChevronLeft className="mr-1 h-4 w-4" aria-hidden />
              Voltar às datas
            </Button>
          </DialogFooter>
        )}
      </ShellDialogContent>
    </Dialog>
  );
}
