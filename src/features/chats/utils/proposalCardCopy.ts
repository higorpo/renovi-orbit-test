import type { ProfileRole } from "@/features/auth";
import type { ProposalStatus } from "@/features/negotiation-proposals";

export function resolveProposalCardHeadline(status: ProposalStatus | string): string {
  switch (status) {
    case "PENDING":
      return "Proposta enviada";
    case "ACCEPTED":
      return "Proposta aceita";
    case "REJECTED":
    case "REJECTED_AUTOMATICALLY":
      return "Proposta recusada";
    case "EXPIRED":
      return "Proposta expirada";
    case "REVISION_REQUESTED":
      return "Revisão solicitada";
    case "REVISED":
      return "Proposta atualizada";
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
}

export function resolveProposalCardCtas(
  status: ProposalStatus | string,
  viewerRole: ProfileRole,
): ProposalCardCta[] {
  if (viewerRole === "client" && status === "PENDING") {
    return [
      { id: "accept", label: "Aceitar", variant: "default" },
      { id: "reject", label: "Recusar", variant: "outline" },
      { id: "request_revision", label: "Pedir revisão", variant: "outline" },
    ];
  }

  if (viewerRole === "provider" && status === "REVISION_REQUESTED") {
    return [{ id: "edit_proposal", label: "Editar proposta", variant: "default" }];
  }

  return [];
}
