import type { BadgeProps } from "@/components/ui/badge";
import {
  coerceProposalStatus,
  defineProposalStatusMap,
} from "./proposalStatus";

type BudgetStatusConfig = { label: string; variant: BadgeProps["variant"] };

const BUDGET_STATUS_CONFIG = defineProposalStatusMap<BudgetStatusConfig>({
  PENDING: { label: "Aguardando avaliação", variant: "warning" },
  ACCEPTED: { label: "Aceito", variant: "success" },
  REJECTED: { label: "Recusado", variant: "destructive" },
  REJECTED_AUTOMATICALLY: { label: "Recusado", variant: "destructive" },
  REVISION_REQUESTED: { label: "Revisão solicitada", variant: "warning" },
  REVISED: { label: "Orçamento revisado", variant: "secondary" },
  EXPIRED: { label: "Expirado", variant: "secondary" },
});

export type ServiceRequestBudgetSheetMode = "compare" | "history";

export function getBudgetStatusConfig(status: string | null | undefined): BudgetStatusConfig {
  if (!status) return BUDGET_STATUS_CONFIG.PENDING;

  const resolved = coerceProposalStatus(status);
  if (resolved) return BUDGET_STATUS_CONFIG[resolved];

  return { label: status, variant: "secondary" };
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
