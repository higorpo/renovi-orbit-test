import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/formatCurrency";
import { CardStep } from "./CheckoutStepper/CardStep";
import { SavedCardSelector } from "./CheckoutStepper/SavedCardSelector";
import { fetchPaymentTokenById } from "../api/cards.api";
import { updatePaymentMethod } from "../api/cards.api";
import { useInstallmentOptions } from "../hooks/useInstallmentOptions";
import { useManualChargePayment } from "../hooks/useManualChargePayment";
import type { PaymentScheduleSummary } from "../types/paymentSchedule.types";
import type { SavedPaymentToken } from "../types/paymentToken.types";
import {
  formatCardExpiry,
  formatMaskedCardLabel,
  getCardBrandLabel,
} from "../utils/cardPresentation";
import {
  formatManualPaymentFailureMessage,
  isTerminalManualChargeOutcome,
} from "../utils/manualPaymentErrors";

export type ManualPaymentModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: PaymentScheduleSummary;
  acceptedProposalId: string;
  serviceRequestId: string;
  onCompleted?: () => void;
};

type ModalView = "confirm" | "change-card" | "terminal-error" | "service-cancelled";

export function ManualPaymentModal({
  open,
  onOpenChange,
  schedule,
  acceptedProposalId,
  serviceRequestId,
  onCompleted,
}: ManualPaymentModalProps) {
  const [clearsaleSessionId, setClearsaleSessionId] = useState<string | null>(null);
  const [paymentToken, setPaymentToken] = useState<SavedPaymentToken | null>(null);
  const [isLoadingToken, setIsLoadingToken] = useState(false);
  const [view, setView] = useState<ModalView>("confirm");
  const [terminalErrorMessage, setTerminalErrorMessage] = useState<string | null>(null);
  const [isUpdatingCard, setIsUpdatingCard] = useState(false);
  const manualCharge = useManualChargePayment();

  const installmentQuery = useInstallmentOptions({
    proposalId: acceptedProposalId,
    serviceId: serviceRequestId,
    cardBrand: paymentToken?.card_brand ?? "",
    enabled: open && Boolean(paymentToken?.card_brand),
  });

  const selectedInstallment = useMemo(() => {
    const options = installmentQuery.data?.installment_options ?? [];
    return options.find((option) => option.installment_number === schedule.installmentNumber) ?? null;
  }, [installmentQuery.data?.installment_options, schedule.installmentNumber]);

  useEffect(() => {
    if (!open) {
      setView("confirm");
      setTerminalErrorMessage(null);
      setClearsaleSessionId(null);
      return;
    }

    let cancelled = false;

    async function loadToken() {
      if (!schedule.paymentTokenId) {
        setPaymentToken(null);
        return;
      }

      setIsLoadingToken(true);
      const result = await fetchPaymentTokenById(schedule.paymentTokenId);
      if (!cancelled) {
        setPaymentToken(result.data);
        setIsLoadingToken(false);
      }
    }

    void loadToken();

    return () => {
      cancelled = true;
    };
  }, [open, schedule.paymentTokenId]);

  const handleConfirmPayment = async () => {
    if (!clearsaleSessionId) {
      toast.error("Aguarde a inicialização da verificação de segurança.");
      return;
    }

    try {
      const result = await manualCharge.mutateAsync({
        scheduleId: schedule.id,
        clearsaleSessionId,
      });

      if (result.outcome === "PAID" || result.outcome === "IN_ANALYSIS") {
        toast.success(
          result.outcome === "PAID"
            ? "Pagamento realizado com sucesso!"
            : "Pagamento em análise. Você será notificado em breve.",
        );
        onCompleted?.();
        onOpenChange(false);
        return;
      }

      if (isTerminalManualChargeOutcome(result.outcome)) {
        setTerminalErrorMessage(
          formatManualPaymentFailureMessage(schedule.failureReason, schedule.failureCode),
        );
        setView("terminal-error");
      }
    } catch (error) {
      const err = error as Error & { errorCode?: string; status?: number };

      if (err.errorCode === "SERVICE_AUTO_CANCELLED") {
        setView("service-cancelled");
        return;
      }

      toast.error(err.message ?? "Falha ao processar pagamento.");
    }
  };

  const handleCardChanged = async (paymentTokenId: string, cardBrand: string) => {
    setIsUpdatingCard(true);

    const brandChanged = paymentToken?.card_brand && paymentToken.card_brand !== cardBrand;
    const installmentData = installmentQuery.data;

    const result = await updatePaymentMethod({
      contractedServiceId: schedule.contractedServiceId,
      newPaymentTokenId: paymentTokenId,
      ...(brandChanged && installmentData
        ? {
            installmentSelectionHmac: installmentData.installment_selection_hmac,
            installmentHmacPayload: installmentData.installment_hmac_payload,
          }
        : {}),
    });

    setIsUpdatingCard(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    const tokenResult = await fetchPaymentTokenById(paymentTokenId);
    setPaymentToken(tokenResult.data);
    setView("confirm");
    toast.success("Cartão atualizado.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {open ? (
          <CardStep onSessionIdGenerated={setClearsaleSessionId} />
        ) : null}

        {view === "service-cancelled" ? (
          <>
            <DialogHeader>
              <DialogTitle>Serviço cancelado</DialogTitle>
              <DialogDescription>
                Este serviço foi cancelado automaticamente por falta de pagamento. Entre em contato com o suporte se precisar de ajuda.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </>
        ) : null}

        {view === "terminal-error" ? (
          <>
            <DialogHeader>
              <DialogTitle>Pagamento não concluído</DialogTitle>
              <DialogDescription>{terminalErrorMessage}</DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button type="button" onClick={() => setView("change-card")}>
                Tentar com outro cartão
              </Button>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Falar com suporte
              </Button>
            </DialogFooter>
          </>
        ) : null}

        {view === "change-card" ? (
          <>
            <DialogHeader>
              <DialogTitle>Trocar cartão</DialogTitle>
              <DialogDescription>
                Selecione outro cartão salvo ou adicione um novo para tentar novamente.
              </DialogDescription>
            </DialogHeader>
            {isUpdatingCard ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Atualizando cartão…
              </div>
            ) : (
              <SavedCardSelector
                providerServiceId={acceptedProposalId}
                onSelect={(selection) => {
                  void handleCardChanged(selection.paymentTokenId, selection.cardBrand);
                }}
                onBack={() => setView("confirm")}
              />
            )}
          </>
        ) : null}

        {view === "confirm" ? (
          <>
            <DialogHeader>
              <DialogTitle>Efetuar pagamento</DialogTitle>
              <DialogDescription>
                Confira o cartão e o valor antes de confirmar o pagamento manual.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 text-sm">
              {isLoadingToken ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Carregando cartão…
                </div>
              ) : paymentToken ? (
                <div className="rounded-lg border border-border p-4">
                  <p className="font-medium">
                    {getCardBrandLabel(paymentToken.card_brand)} · {formatMaskedCardLabel(paymentToken.card_number_masked)}
                  </p>
                  <p className="text-muted-foreground">
                    Validade {formatCardExpiry(paymentToken.expiry_month, paymentToken.expiry_year)}
                  </p>
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 text-sm"
                    onClick={() => setView("change-card")}
                  >
                    Trocar cartão
                  </Button>
                </div>
              ) : (
                <p className="text-destructive">Nenhum cartão vinculado a este pagamento.</p>
              )}

              <div className="rounded-lg border border-border p-4 space-y-1">
                <p>
                  Parcelas:{" "}
                  <span className="font-medium">
                    {schedule.installmentNumber}x
                  </span>
                </p>
                {installmentQuery.isLoading ? (
                  <p className="text-muted-foreground">Calculando valor…</p>
                ) : selectedInstallment ? (
                  <>
                    <p>
                      Valor total:{" "}
                      <span className="font-medium">
                        {formatCurrency(selectedInstallment.total_with_fees)}
                      </span>
                    </p>
                    <p className="text-muted-foreground">
                      {formatCurrency(selectedInstallment.installment_amount)} por parcela
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    Valor base: {formatCurrency(schedule.baseAmount)}
                  </p>
                )}
              </div>
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button
                type="button"
                disabled={manualCharge.isPending || !paymentToken || !clearsaleSessionId}
                onClick={() => void handleConfirmPayment()}
              >
                {manualCharge.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Processando…
                  </>
                ) : (
                  "Confirmar pagamento"
                )}
              </Button>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
