import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatCurrency";
import { PaymentTrustDisclosure } from "../PaymentTrustDisclosure";
import { useAcceptProposalWithPayment } from "@/features/negotiation-proposals";
import type { InstallmentHmacPayload, InstallmentOption } from "../../types/paymentToken.types";
import type { ProposalSuggestedSlotRpc } from "@/features/negotiation-proposals";
import { getChargeTimingDisclosure } from "../../utils/chargeTimingDisclosure";

export type ConfirmationStepProps = {
  serviceTitle: string;
  scheduledDate: string;
  installmentNumber: number;
  installmentAmount: number;
  totalWithFees: number;
  proposalId: string;
  selectedSlot: ProposalSuggestedSlotRpc;
  pricingSignature: string;
  paymentTokenId: string;
  clearsaleSessionId?: string | null;
  installmentSelectionHmac: string;
  installmentHmacPayload: InstallmentHmacPayload;
  installmentOptions: InstallmentOption[];
  idempotencyKey: string;
  onSuccess: (contractedServiceId: string) => void;
  onInstallmentSignatureExpired: () => void;
  onBack?: () => void;
};

export function ConfirmationStep({
  serviceTitle,
  scheduledDate,
  installmentNumber,
  installmentAmount,
  totalWithFees,
  proposalId,
  selectedSlot,
  pricingSignature,
  paymentTokenId,
  clearsaleSessionId,
  installmentSelectionHmac,
  installmentHmacPayload,
  idempotencyKey,
  onSuccess,
  onInstallmentSignatureExpired,
  onBack,
}: ConfirmationStepProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const acceptProposal = useAcceptProposalWithPayment();

  const chargeDisclosure = useMemo(
    () => getChargeTimingDisclosure(new Date(scheduledDate)),
    [scheduledDate],
  );

  const handleConfirm = async () => {
    setSubmitError(null);

    if (!clearsaleSessionId) {
      setSubmitError("Aguarde a inicialização da verificação de segurança.");
      return;
    }

    try {
      const result = await acceptProposal.mutateAsync({
        proposalId,
        selectedSlot,
        paymentTokenId,
        installmentNumber,
        installmentSelectionHmac,
        installmentHmacPayload,
        clearsaleSessionId,
        pricingSignature,
        idempotencyKey,
      });

      onSuccess(result.contractedServiceId);
    } catch (error) {
      const errorCode = (error as Error & { code?: string }).code;

      if (errorCode === "INSTALLMENT_SIGNATURE_EXPIRED") {
        onInstallmentSignatureExpired();
        return;
      }

      setSubmitError(error instanceof Error ? error.message : "Não foi possível confirmar.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Confirme a contratação</h2>
        <p className="text-sm text-muted-foreground">
          Revise os detalhes do serviço e do pagamento antes de confirmar.
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-border p-4 text-sm">
        <div>
          <p className="text-muted-foreground">Serviço</p>
          <p className="font-medium">{serviceTitle}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Parcelamento</p>
          <p className="font-medium">
            {installmentNumber}x de {formatCurrency(installmentAmount)}
          </p>
          <p className="text-xs text-muted-foreground">
            Total com taxas: {formatCurrency(totalWithFees)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Quando será cobrado</p>
          <p className="font-medium">{chargeDisclosure.message}</p>
        </div>
      </div>

      <PaymentTrustDisclosure />

      {submitError ? (
        <p className="text-sm text-destructive" role="alert">
          {submitError}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {onBack ? (
          <Button type="button" variant="outline" onClick={onBack} disabled={acceptProposal.isPending}>
            Voltar
          </Button>
        ) : null}
        <Button type="button" onClick={() => void handleConfirm()} disabled={acceptProposal.isPending}>
          {acceptProposal.isPending ? "Confirmando..." : "Confirmar contratação"}
        </Button>
      </div>
    </div>
  );
}
