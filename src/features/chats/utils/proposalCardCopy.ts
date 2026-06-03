import type { ProfileRole } from "@/features/auth";
import type { ProposalStatus } from "@/features/negotiation-proposals";
import { MAX_PROPOSAL_REVISIONS } from "@/features/negotiation-proposals/constants/proposalRevisions";

export function resolveProposalCardHeadline(
  status: ProposalStatus | string,
  viewerRole: ProfileRole,
): string {
  switch (status) {
    case "PENDING":
      return viewerRole === "client" ? "Proposta recebida" : "Proposta enviada";
    case "ACCEPTED":
      return "Proposta aceita";
    case "REJECTED":
    case "REJECTED_AUTOMATICALLY":
    case "REVISED":
      return "Proposta recusada";
    case "EXPIRED":
      return "Proposta expirada";
    case "REVISION_REQUESTED":
      return "Revisão solicitada";
    default:
      return "Proposta";
  }
}

export function resolveProposalCardDescription(
  status: ProposalStatus | string,
  viewerRole: ProfileRole,
): string {
  switch (status) {
    case "PENDING":
      return viewerRole === "client"
        ? "Aguardando sua análise."
        : "Aguardando resposta do cliente.";
    case "ACCEPTED":
      return "Esta proposta foi aprovada.";
    case "REJECTED":
      return viewerRole === "client"
        ? "Você optou por não seguir com esta proposta."
        : "O cliente optou por não seguir com esta proposta.";
    case "REJECTED_AUTOMATICALLY":
      return viewerRole === "client"
        ? "Esta proposta foi encerrada automaticamente."
        : "O cliente seguiu com outra proposta ou encerrou o pedido.";
    case "EXPIRED":
      return "O prazo para resposta desta proposta encerrou.";
    case "REVISION_REQUESTED":
      return viewerRole === "provider"
        ? "O cliente pediu ajustes nesta proposta."
        : "Você solicitou alterações nesta proposta.";
    case "REVISED":
      return "Uma nova versão da proposta está disponível.";
    default:
      return "Atualização da negociação.";
  }
}

export interface ProposalCardCta {
  id: "accept" | "reject" | "request_revision" | "edit_proposal";
  label: string;
  variant: "default" | "outline" | "destructive";
  disabled?: boolean;
}

export function resolveProposalCardCtas(
  status: ProposalStatus | string,
  viewerRole: ProfileRole,
  revisionCount = 0,
): ProposalCardCta[] {
  if (viewerRole === "client" && status === "PENDING") {
    const revisionLimitReached = revisionCount >= MAX_PROPOSAL_REVISIONS;

    return [
      { id: "accept", label: "Aceitar", variant: "default" },
      { id: "reject", label: "Recusar", variant: "outline" },
      {
        id: "request_revision",
        label: "Pedir revisão",
        variant: "outline",
        disabled: revisionLimitReached,
      },
    ];
  }

  if (viewerRole === "provider" && status === "REVISION_REQUESTED") {
    return [{ id: "edit_proposal", label: "Editar proposta", variant: "default" }];
  }

  return [];
}

export function resolveProposalCardDetailsLabel(
  status: ProposalStatus | string,
  viewerRole: ProfileRole,
): string {
  if (viewerRole === "provider" && status === "REVISION_REQUESTED") {
    return "Ver detalhes da revisão solicitada";
  }

  return "Ver detalhes da proposta";
}
