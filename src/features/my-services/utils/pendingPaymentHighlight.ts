import { formatScheduledSummary, type ServiceModel } from "@/features/view-services";

type ContractedServiceSummary = NonNullable<ServiceModel["contracted"]>;

export type PendingPaymentAudience = "client" | "provider";

export type PendingPaymentHighlightEmphasis = "attention" | "error";

export interface PendingPaymentHighlightContent {
  title: string;
  detail: string;
  emphasis: PendingPaymentHighlightEmphasis;
}

function formatScheduledForDetail(contracted: ContractedServiceSummary): string | null {
  const scheduled = formatScheduledSummary(contracted);
  if (!scheduled) return null;
  return scheduled.dateLabel;
}

export function getPendingPaymentHighlightContent(
  contracted: ContractedServiceSummary,
  audience: PendingPaymentAudience,
): PendingPaymentHighlightContent {
  const isPermanentFailure = contracted.paymentScheduleState === "FAILED_PERMANENT";

  if (audience === "client" && isPermanentFailure) {
    return {
      title: "Pagamento falhou",
      detail:
        "Atualize suas informações de pagamento manualmente para confirmar o serviço.",
      emphasis: "error",
    };
  }

  const title =
    audience === "provider"
      ? "Aguardando pagamento do cliente"
      : "Aguardando pagamento";

  const scheduledPart = formatScheduledForDetail(contracted);

  return {
    title,
    detail: scheduledPart
      ? `Serviço agendado para ${scheduledPart}, pagamento ainda pendente.`
      : "Pagamento ainda pendente.",
    emphasis: "attention",
  };
}
