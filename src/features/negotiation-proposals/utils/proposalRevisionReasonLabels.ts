import type { ProposalRevisionReason } from "../types/proposals.types";

export const PROPOSAL_REVISION_REASON_OPTIONS: Array<{
  value: ProposalRevisionReason;
  label: string;
}> = [
  { value: "PRICE_TOO_HIGH", label: "Preço alto" },
  { value: "REDUCE_SCOPE", label: "Reduzir escopo" },
  { value: "DATE_NOT_AVAILABLE", label: "Data indisponível" },
  { value: "CHANGE_TIMELINE", label: "Alterar prazo" },
  { value: "CLARIFY_DETAILS", label: "Esclarecer detalhes" },
  { value: "OTHER", label: "Outro" },
];

export function getProposalRevisionReasonLabel(reason: ProposalRevisionReason): string {
  return (
    PROPOSAL_REVISION_REASON_OPTIONS.find((option) => option.value === reason)?.label ?? reason
  );
}
