import { formatScheduledSummary, type ServiceModel } from "@/features/view-services";

type ContractedServiceSummary = NonNullable<ServiceModel["contracted"]>;

export type PendingPaymentAudience = "client" | "provider";

export interface PendingPaymentHighlightContent {
  title: string;
  detail: string;
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
  };
}
