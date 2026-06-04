import { describe, expect, it } from "vitest";
import type { ProposalDetailView } from "../types/proposalDetails.types";
import { mapProposalDetailToSummary } from "../mapProposalDetailToSummary";

const baseProposal: ProposalDetailView = {
  id: "prop-1",
  service_request_id: "sr-1",
  provider_id: "provider-1",
  status: "PENDING",
  version: 1,
  revision_count: 0,
  revision_reason: null,
  revision_notes: null,
  submitted_at: "2026-03-20T10:00:00.000Z",
  expired_at: null,
  proposed_amount: 500,
  tax_rate: 0.15,
  tax_amount: 75,
  final_amount: 425,
  proposal_description: "Descrição",
  proposal_duration_unit: "hours",
  proposal_duration_value: 3,
  proposal_suggested_slots: [],
  photos: ["photo.jpg"],
  client_rejection_response: null,
  created_at: "2026-03-20T10:00:00.000Z",
  updated_at: "2026-03-20T10:00:00.000Z",
};

describe("mapProposalDetailToSummary", () => {
  it("maps provider pricing fields into summary", () => {
    expect(mapProposalDetailToSummary(baseProposal)).toEqual({
      serviceRequestId: "sr-1",
      proposalId: "prop-1",
      isLatestProposal: true,
      status: "PENDING",
      proposedAmount: 500,
      taxRate: 0.15,
      taxAmount: 75,
      description: "Descrição",
      photos: ["photo.jpg"],
      clientRejectionResponse: null,
      revisionReason: null,
      revisionNotes: null,
    });
  });

  it("marks revised proposals as not latest", () => {
    expect(
      mapProposalDetailToSummary({
        ...baseProposal,
        status: "REVISED",
      }).isLatestProposal,
    ).toBe(false);
  });

  it("maps revision request fields", () => {
    expect(
      mapProposalDetailToSummary({
        ...baseProposal,
        status: "REVISION_REQUESTED",
        revision_reason: "REDUCE_SCOPE",
        revision_notes: "  Menos itens  ",
      }),
    ).toMatchObject({
      revisionReason: "REDUCE_SCOPE",
      revisionNotes: "  Menos itens  ",
    });
  });
});
