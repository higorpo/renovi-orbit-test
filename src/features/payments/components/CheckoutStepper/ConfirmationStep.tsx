import { useEffect, useMemo, type MutableRefObject } from "react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatCurrency";
import {
  formatProposalSuggestedSlot,
  useAcceptProposalMutation,
  type ProposalSuggestedSlotRpc,
} from "@/features/negotiation-proposals";
import type { InstallmentHmacPayload, InstallmentOption } from "../../types/paymentToken.types";
import { getChargeTimingDisclosure } from "../../utils/chargeTimingDisclosure";

const TERMS_OF_USE_URL = `${(import.meta.env.VITE_MAIN_SITE_URL ?? "").replace(/\/$/, "")}/juridico/termos-de-uso`;

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
  chatId?: string | null;
  serviceRequestId?: string | null;
  onSuccess: (contractedServiceId: string) => void;
  onInstallmentSignatureExpired: () => void;
  /** Parent Continuar/Confirmar — runs the accept mutation. */
  confirmRef: MutableRefObject<(() => void) | null>;
  onPendingChange?: (pending: boolean) => void;
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
  chatId = null,
  serviceRequestId = null,
  onSuccess,
  onInstallmentSignatureExpired,
  confirmRef,
  onPendingChange,
}: ConfirmationStepProps) {
  const acceptProposal = useAcceptProposalMutation(chatId, serviceRequestId);

  const chargeDisclosure = useMemo(
    () => getChargeTimingDisclosure(new Date(scheduledDate)),
    [scheduledDate],
  );

  useEffect(() => {
    onPendingChange?.(acceptProposal.isPending);
  }, [acceptProposal.isPending, onPendingChange]);

  const handleConfirm = async () => {
    if (!clearsaleSessionId) {
      toast.error("Aguarde a inicialização da verificação de segurança.");
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

      toast.error(error instanceof Error ? error.message : "Não foi possível confirmar.");
    }
  };

  confirmRef.current = () => {
    void handleConfirm();
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h2 className="text-sm font-medium text-foreground">Confirme a contratação</h2>
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
          <p className="text-muted-foreground">Agendamento</p>
          <p className="font-medium">{formatProposalSuggestedSlot(selectedSlot)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Pagamento</p>
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

      <p className="text-xs text-muted-foreground">
        Ao confirmar o pagamento, você declara que leu e concorda com os{" "}
        <a
          href={TERMS_OF_USE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Termos de Uso
        </a>
        .
      </p>
    </div>
  );
}
