import type { BadgeProps } from "@/components/ui/badge";

const BUDGET_STATUS_MAP: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
  submitted: { label: "Aguardando avaliação", variant: "warning" },
  pending: { label: "Aguardando avaliação", variant: "warning" },
  accepted: { label: "Aceito", variant: "success" },
  rejected: { label: "Recusado", variant: "destructive" },
  rejected_automatically: { label: "Recusado", variant: "destructive" },
  revised: { label: "Orçamento revisado", variant: "secondary" },
  expired: { label: "Expirado", variant: "secondary" },
  cancelled: { label: "Cancelado", variant: "secondary" },
  closed: { label: "Encerrado", variant: "secondary" },
  completed: { label: "Encerrado", variant: "secondary" },
};

export type ServiceRequestBudgetSheetMode = "compare" | "history";

export function getBudgetStatusConfig(status: string | null | undefined) {
  if (!status) return { label: "Aguardando avaliação", variant: "warning" as const };
  return BUDGET_STATUS_MAP[status.toLowerCase()] ?? { label: status, variant: "secondary" as const };
}

export function getServiceRequestBudgetSheetTitle(mode: ServiceRequestBudgetSheetMode): string {
  if (mode === "compare") return "Comparar orçamentos";
  return "Histórico de orçamentos";
}

/** Sheet mode for a service request on the client "Meus serviços" list. */
export function getServiceRequestBudgetSheetMode(serviceRequestStatus: string): ServiceRequestBudgetSheetMode {
  if (serviceRequestStatus === "open") return "compare";
  return "history";
}

export function getServiceRequestBudgetActionLabel(serviceRequestStatus: string): string {
  return getServiceRequestBudgetSheetTitle(getServiceRequestBudgetSheetMode(serviceRequestStatus));
}
