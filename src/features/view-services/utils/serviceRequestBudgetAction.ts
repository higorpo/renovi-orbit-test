import type { LucideIcon } from "lucide-react";
import { GitCompare, History } from "lucide-react";
import type { ServiceListPhase, ServiceModel } from "../types/service.types";

export type ServiceRequestBudgetSheetMode = "compare" | "history";

export interface ServiceRequestBudgetActionParams {
  proposalCount: number;
  listPhase: ServiceListPhase;
}

export function getServiceRequestBudgetSheetMode(
  listPhase: ServiceListPhase,
): ServiceRequestBudgetSheetMode {
  return listPhase === "negotiation" ? "compare" : "history";
}

export function getServiceRequestBudgetActionLabel({
  proposalCount,
  listPhase,
}: ServiceRequestBudgetActionParams): string {
  const isNegotiation = listPhase === "negotiation";

  if (proposalCount > 1) {
    return isNegotiation ? "Comparar orçamentos" : "Histórico de orçamentos";
  }

  return isNegotiation ? "Ver orçamento" : "Ver histórico";
}

export function getServiceRequestBudgetActionIcon(
  listPhase: ServiceListPhase,
): LucideIcon {
  return listPhase === "negotiation" ? GitCompare : History;
}

export function getServiceRequestBudgetActionState(
  model: Pick<ServiceModel, "proposalCount" | "listPhase">,
) {
  return {
    label: getServiceRequestBudgetActionLabel(model),
    sheetMode: getServiceRequestBudgetSheetMode(model.listPhase),
    disabled: model.proposalCount <= 0,
    disabledReason:
      model.proposalCount <= 0 ? "Nenhum orçamento recebido ainda" : undefined,
  };
}
