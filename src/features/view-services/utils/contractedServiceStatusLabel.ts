import type { ContractedServicePaymentStatus } from "@/features/payments";

const CONTRACTED_SERVICE_STATUS_LABELS: Record<
  ContractedServicePaymentStatus,
  string
> = {
  PENDING_PAYMENT: "Aguardando pagamento",
  CONFIRMED: "Confirmado",
  EXECUTED: "Executado",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
};

/** Translates a contracted_service_status enum value to a pt-BR UI label. */
export function getContractedServiceStatusLabel(status: string): string {
  return (
    CONTRACTED_SERVICE_STATUS_LABELS[status as ContractedServicePaymentStatus] ??
    status
  );
}
