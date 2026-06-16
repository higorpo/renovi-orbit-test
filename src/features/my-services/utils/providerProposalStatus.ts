import {
  defineProposalStatusMap,
} from "@/features/negotiation-proposals/constants/proposalStatus";
import type { ProposalStatus } from "@/features/negotiation-proposals";
import type { ServiceListPhase } from "@/features/view-services";

export interface ProviderProposalStatusPresentation {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline" | "warning" | "success";
}

const PROPOSAL_STATUS_LABELS = defineProposalStatusMap({
  PENDING: "Aguardando cliente",
  REVISION_REQUESTED: "Revisão solicitada",
  REVISED: "Proposta revisada",
  ACCEPTED: "Proposta aceita",
  REJECTED: "Proposta recusada",
  REJECTED_AUTOMATICALLY: "Recusada automaticamente",
  EXPIRED: "Proposta expirada",
});

export function getProviderProposalContextLabel(
  status: ProposalStatus | undefined,
  listPhase: ServiceListPhase,
  hasChat?: boolean,
): string | null {
  if (status) {
    return PROPOSAL_STATUS_LABELS[status];
  }
  if (listPhase === "negotiation" && !status) {
    return hasChat ? "Conversa iniciada" : "Em negociação";
  }
  return null;
}

export function isProposalExpiringSoon(expiredAt: string | null | undefined): boolean {
  if (!expiredAt) return false;
  const expiresMs = new Date(expiredAt).getTime();
  if (Number.isNaN(expiresMs)) return false;
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
  return expiresMs - Date.now() <= threeDaysMs && expiresMs > Date.now();
}
