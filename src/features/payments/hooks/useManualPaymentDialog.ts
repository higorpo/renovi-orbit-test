import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/features/auth";
import { updatePaymentMethod } from "../api/cards.api";
import type { PaymentScheduleSummary } from "../types/paymentSchedule.types";
import type {
  InstallmentSelection,
  SavedCardSelection,
} from "../types/paymentToken.types";
import {
  formatManualPaymentFailureMessage,
  isTerminalManualChargeOutcome,
} from "../utils/manualPaymentErrors";
import { mapPaymentErrorToUserMessage, mapPaymentUserMessage } from "../utils/mapPaymentUserMessage";
import { useClientCpfForPayment } from "./useClientCpfForPayment";
import { useManualChargePayment } from "./useManualChargePayment";

export type ManualPaymentDialogView =
  | "card"
  | "installments"
  | "confirm"
  | "terminal-error"
  | "service-cancelled";

export type ManualPaymentDialogSelection = {
  paymentTokenId: string;
  cardBrand: string;
  cardNumberMasked?: string | null;
  expiryMonth?: number | null;
  expiryYear?: number | null;
  installment: InstallmentSelection | null;
};

type UseManualPaymentDialogParams = {
  open: boolean;
  schedule: PaymentScheduleSummary;
  onOpenChange: (open: boolean) => void;
  onCompleted?: () => void;
};

export function useManualPaymentDialog({
  open,
  schedule,
  onOpenChange,
  onCompleted,
}: UseManualPaymentDialogParams) {
  const [clearsaleSessionId, setClearsaleSessionId] = useState<string | null>(null);
  const [view, setView] = useState<ManualPaymentDialogView>("card");
  const [terminalErrorMessage, setTerminalErrorMessage] = useState<string | null>(null);
  const [isUpdatingMethod, setIsUpdatingMethod] = useState(false);
  const [selection, setSelection] = useState<ManualPaymentDialogSelection | null>(null);

  const manualCharge = useManualChargePayment();
  const { profile } = useAuth();
  const { cpf: savedCpf } = useClientCpfForPayment();
  const savedPhone = profile?.phone ?? undefined;

  useEffect(() => {
    if (!open) {
      setView("card");
      setTerminalErrorMessage(null);
      setClearsaleSessionId(null);
      setSelection(null);
      setIsUpdatingMethod(false);
    }
  }, [open]);

  const handleCardSelected = (card: SavedCardSelection) => {
    setSelection({
      paymentTokenId: card.paymentTokenId,
      cardBrand: card.cardBrand,
      cardNumberMasked: card.cardNumberMasked ?? null,
      expiryMonth: card.expiryMonth ?? null,
      expiryYear: card.expiryYear ?? null,
      installment: null,
    });
    setView("installments");
  };

  const handleInstallmentSelected = (installment: InstallmentSelection) => {
    setSelection((current) =>
      current
        ? { ...current, installment }
        : null,
    );
    setView("confirm");
  };

  const handleConfirmPayment = async () => {
    if (!selection?.installment) {
      toast.error("Selecione o cartão e as parcelas antes de continuar.");
      return;
    }

    if (!clearsaleSessionId) {
      toast.error("Aguarde a inicialização da verificação de segurança.");
      return;
    }

    setIsUpdatingMethod(true);

    const updateResult = await updatePaymentMethod({
      contractedServiceId: schedule.contractedServiceId,
      newPaymentTokenId: selection.paymentTokenId,
      installmentNumber: selection.installment.installmentNumber,
      installmentSelectionHmac: selection.installment.installmentSelectionHmac,
      installmentHmacPayload: selection.installment.installmentHmacPayload,
    });

    setIsUpdatingMethod(false);

    if (updateResult.error) {
      toast.error(
        mapPaymentUserMessage(updateResult.errorCode ?? updateResult.error, {
          fallback: "Não foi possível atualizar o pagamento. Tente novamente.",
        }),
      );

      if (
        updateResult.errorCode === "INSTALLMENT_SIGNATURE_EXPIRED" ||
        updateResult.errorCode === "INVALID_INSTALLMENT_SIGNATURE"
      ) {
        setView("installments");
      }
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
          formatManualPaymentFailureMessage(
            null,
            result.failureCode ?? schedule.failureCode,
          ),
        );
        setView("terminal-error");
      }
    } catch (error) {
      const err = error as Error & { errorCode?: string; status?: number };

      if (err.errorCode === "SERVICE_AUTO_CANCELLED") {
        setView("service-cancelled");
        return;
      }

      toast.error(
        mapPaymentErrorToUserMessage(err, {
          fallback: "Não foi possível processar o pagamento. Tente novamente.",
        }),
      );
    }
  };

  const isSubmitting = isUpdatingMethod || manualCharge.isPending;

  return {
    view,
    setView,
    selection,
    clearsaleSessionId,
    setClearsaleSessionId,
    terminalErrorMessage,
    savedCpf,
    savedPhone,
    isSubmitting,
    handleCardSelected,
    handleInstallmentSelected,
    handleConfirmPayment,
  };
}
