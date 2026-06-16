import { MAX_PROPOSAL_REVISIONS } from "../constants/proposalRevisions";
import { isPendingProposalStatus } from "./proposalStatus";

export interface ClientProposalCta {
  id: "accept" | "reject" | "request_revision";
  label: string;
  variant: "default" | "outline" | "destructive";
  disabled?: boolean;
}

export function resolveClientProposalCtas(
  status: string,
  revisionCount = 0,
): ClientProposalCta[] {
  if (!isPendingProposalStatus(status)) {
    return [];
  }

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
