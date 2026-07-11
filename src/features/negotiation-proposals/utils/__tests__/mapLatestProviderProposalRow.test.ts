import { describe, expect, it } from "vitest";
import { mapLatestProviderProposalRow } from "../mapLatestProviderProposalRow";
import type { ProviderLatestProposalRow } from "../../types/serviceRequestProposal.types";

const baseRow: ProviderLatestProposalRow = {
  id: "prop-1",
  service_request_id: "sr-1",
  status: "PENDING",
  proposed_amount: 250,
  tax_rate: 0.1,
  tax_amount: 25,
  proposal_description: "Scope details",
  photos: ["path/a.jpg"],
  client_rejection_response: null,
  revision_reason: null,
  revision_notes: null,
  proposal_duration_value: 2,
  proposal_duration_unit: "hours",
  proposal_suggested_slots: [{ start_date: "2026-06-10", shift: "morning" }],
  version: 2,
};

describe("mapLatestProviderProposalRow", () => {
  it("maps row to summary and draft", () => {
    const result = mapLatestProviderProposalRow(baseRow);

    expect(result.summary).toMatchObject({
      serviceRequestId: "sr-1",
      proposalId: "prop-1",
      isLatestProposal: true,
      status: "PENDING",
      proposedAmount: 250,
      taxRate: 0.1,
      taxAmount: 25,
      description: "Scope details",
      photos: ["path/a.jpg"],
    });
    expect(result.draft).toMatchObject({
      proposedAmount: 250,
      description: "Scope details",
      durationValue: 2,
      durationUnit: "hours",
    });
  });

  it("sets suggestedSlots to null when the RPC value is not an array", () => {
    const result = mapLatestProviderProposalRow({
      ...baseRow,
      proposal_suggested_slots: { unexpected: true } as never,
    });
    expect(result.draft.suggestedSlots).toBeNull();
  });
});
