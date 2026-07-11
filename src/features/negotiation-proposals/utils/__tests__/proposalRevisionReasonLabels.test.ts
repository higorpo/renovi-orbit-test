import { describe, expect, it } from "vitest";
import type { ProposalRevisionReason } from "../../types/proposals.types";
import {
  getProposalRevisionReasonLabel,
  PROPOSAL_REVISION_REASON_OPTIONS,
} from "../proposalRevisionReasonLabels";

describe("proposal revision reason labels", () => {
  it("provides a label for every supported revision reason", () => {
    expect(PROPOSAL_REVISION_REASON_OPTIONS).toEqual([
      { value: "PRICE_TOO_HIGH", label: "Preço alto" },
      { value: "REDUCE_SCOPE", label: "Reduzir escopo" },
      { value: "DATE_NOT_AVAILABLE", label: "Data indisponível" },
      { value: "CHANGE_TIMELINE", label: "Alterar prazo" },
      { value: "CLARIFY_DETAILS", label: "Esclarecer detalhes" },
      { value: "OTHER", label: "Outro" },
    ]);
  });

  it.each(PROPOSAL_REVISION_REASON_OPTIONS)(
    "resolves $value to its configured label",
    ({ value, label }) => {
      expect(getProposalRevisionReasonLabel(value)).toBe(label);
    },
  );

  it("preserves an unknown runtime reason as a safe fallback", () => {
    expect(
      getProposalRevisionReasonLabel("UNKNOWN_REASON" as ProposalRevisionReason),
    ).toBe("UNKNOWN_REASON");
  });
});
