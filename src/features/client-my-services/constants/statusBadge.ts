import type { ServiceRequestListPhase } from "../utils/serviceRequestListPhase";

export const LIST_PHASE_LABELS: Record<ServiceRequestListPhase, string> = {
  negotiation: "Em negociação",
  in_progress: "Em andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
};

export function getStatusLabel(
  listPhase: ServiceRequestListPhase,
  hasPendingClientProposal?: boolean,
): string {
  if (listPhase === "negotiation" && hasPendingClientProposal) {
    return "Aguardando decisão";
  }
  return LIST_PHASE_LABELS[listPhase];
}

export type StatusBadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning";

export const LIST_PHASE_BADGE_VARIANT: Record<ServiceRequestListPhase, StatusBadgeVariant> = {
  negotiation: "warning",
  in_progress: "default",
  completed: "success",
  cancelled: "secondary",
};

export function getStatusBadgeVariant(
  listPhase: ServiceRequestListPhase,
  proposalCount?: number,
): StatusBadgeVariant {
  if (listPhase === "negotiation" && (proposalCount ?? 0) === 0) {
    return "secondary";
  }
  return LIST_PHASE_BADGE_VARIANT[listPhase];
}
