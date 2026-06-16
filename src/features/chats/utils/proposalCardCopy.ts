import type { ProfileRole } from "@/features/auth";
import type { ProposalStatus } from "@/features/negotiation-proposals";
import {
  assertProposalStatusExhaustive,
  coerceProposalStatus,
} from "@/features/negotiation-proposals/constants/proposalStatus";
import { MAX_PROPOSAL_REVISIONS } from "@/features/negotiation-proposals/constants/proposalRevisions";

function resolveStatus(status: ProposalStatus | string): ProposalStatus | null {
  return coerceProposalStatus(status);
}

export function resolveProposalCardHeadline(
  status: ProposalStatus | string,
  viewerRole: ProfileRole,
): string {
  const resolved = resolveStatus(status);
  if (!resolved) return "Proposta";

  switch (resolved) {
    case "PENDING":
      return viewerRole === "client" ? "Proposta recebida" : "Proposta enviada";
    case "ACCEPTED":
      return "Proposta aceita";
    case "REJECTED":
    case "REJECTED_AUTOMATICALLY":
      return "Proposta recusada";
    case "REVISED":
      return "Proposta revisada";
    case "EXPIRED":
      return "Proposta expirada";
    case "REVISION_REQUESTED":
      return "Revisão solicitada";
    default:
      return assertProposalStatusExhaustive(resolved);
  }
}

export function resolveProposalCardDescription(
  status: ProposalStatus | string,
  viewerRole: ProfileRole,
): string {
  const resolved = resolveStatus(status);
  if (!resolved) return "Atualização da negociação.";

  switch (resolved) {
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
      return viewerRole === "provider"
        ? "Esta versão foi substituída por uma nova proposta que você enviou."
        : "Uma nova versão da proposta está disponível.";
    default:
      return assertProposalStatusExhaustive(resolved);
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
  const resolved = resolveStatus(status);

  if (viewerRole === "client" && coerceProposalStatus(status) === "PENDING") {
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

  if (viewerRole === "provider" && resolved === "REVISION_REQUESTED") {
    return [{ id: "edit_proposal", label: "Editar proposta", variant: "default" }];
  }

  return [];
}

export function resolveProposalCardDetailsLabel(
  _status: ProposalStatus | string,
  _viewerRole: ProfileRole,
): string {
  return "Ver detalhes da proposta";
}

export const PROPOSAL_CARD_ACCEPTED_SLOT_LABEL = "Data e turno escolhidos";
