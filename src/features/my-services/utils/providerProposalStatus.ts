import type { ProposalStatus } from "@/features/negotiation-proposals";
import type { ServiceListPhase } from "@/features/view-services";

export interface ProviderProposalStatusPresentation {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline" | "warning" | "success";
}

const PROPOSAL_STATUS_LABELS: Partial<Record<ProposalStatus, string>> = {
  PENDING: "Aguardando cliente",
  REVISION_REQUESTED: "Revisão solicitada",
  REVISED: "Proposta revisada",
  ACCEPTED: "Proposta aceita",
  REJECTED: "Proposta recusada",
  REJECTED_AUTOMATICALLY: "Recusada automaticamente",
  EXPIRED: "Proposta expirada",
};

export function getProviderProposalContextLabel(
  status: ProposalStatus | undefined,
  listPhase: ServiceListPhase,
): string | null {
  if (status && PROPOSAL_STATUS_LABELS[status]) {
    return PROPOSAL_STATUS_LABELS[status] ?? null;
  }
  if (listPhase === "negotiation") return "Em negociação";
  return null;
}

export function isProposalExpiringSoon(expiredAt: string | null | undefined): boolean {
  if (!expiredAt) return false;
  const expiresMs = new Date(expiredAt).getTime();
  if (Number.isNaN(expiresMs)) return false;
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
  return expiresMs - Date.now() <= threeDaysMs && expiresMs > Date.now();
}
